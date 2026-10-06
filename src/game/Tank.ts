import * as THREE from 'three'
import type { Car } from './Car'

export interface TankHitResult {
  hitRegistered: boolean
  isNewExplosion: boolean
  hits: number
}

export class Tank {
  readonly scene: THREE.Scene
  readonly root = new THREE.Group()
  readonly turretGroup = new THREE.Group()
  readonly cannonMesh: THREE.Mesh
  readonly muzzlePoint = new THREE.Vector3()

  readonly maxHits = 80 // Resiste a 80 colisões
  readonly smokeThreshold = 60
  hits = 0
  exploded = false
  hitCooldown = 0
  smokeTimer = 0
  fireTimer = 0

  speed = 0
  yaw = 0
  readonly mass = 6.5
  readonly width = 3.6
  readonly length = 6.2
  readonly collisionRadius = 2.4

  private readonly hullMaterial: THREE.MeshStandardMaterial
  private readonly trackMaterial: THREE.MeshStandardMaterial
  private readonly darkMetalMaterial: THREE.MeshStandardMaterial

  constructor(scene: THREE.Scene, startX: number, startZ: number, startYaw = 0) {
    this.scene = scene

    this.hullMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d4f36, // Olive Drab Military Green
      roughness: 0.82,
      metalness: 0.25,
    })

    this.trackMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f211f,
      roughness: 0.94,
      metalness: 0.45,
    })

    this.darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b302c,
      roughness: 0.65,
      metalness: 0.55,
    })

    const tankBody = new THREE.Group()

    // 1. Lower Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 5.6), this.hullMaterial)
    chassis.position.set(0, 0.65, 0)
    chassis.castShadow = true
    chassis.receiveShadow = true
    tankBody.add(chassis)

    // Upper Sloped Glacis Armor
    const upperHull = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.6, 4.8), this.hullMaterial)
    upperHull.position.set(0, 1.25, -0.2)
    upperHull.castShadow = true
    upperHull.receiveShadow = true
    tankBody.add(upperHull)

    // 2. Left & Right Heavy Treads / Tracks
    for (const side of [-1, 1]) {
      const trackX = side * 1.55
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.78, 5.8), this.trackMaterial)
      tread.position.set(trackX, 0.42, 0)
      tread.castShadow = true
      tread.receiveShadow = true
      tankBody.add(tread)

      // Road Wheels along the track
      for (let w = -2; w <= 2; w += 1) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.72, 10), this.darkMetalMaterial)
        wheel.rotation.z = Math.PI / 2
        wheel.position.set(trackX, 0.34, w * 1.15)
        tankBody.add(wheel)
      }

      // Track side armor skirts
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 5.6), this.hullMaterial)
      skirt.position.set(side * 1.92, 0.68, 0)
      skirt.castShadow = true
      tankBody.add(skirt)
    }

    // 3. Rotating Turret
    this.turretGroup.position.set(0, 1.55, -0.3)

    const turretMain = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 2.8), this.hullMaterial)
    turretMain.castShadow = true
    turretMain.receiveShadow = true
    this.turretGroup.add(turretMain)

    // Commander Cupola / Hatch
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.28, 10), this.darkMetalMaterial)
    hatch.position.set(-0.55, 0.52, -0.3)
    this.turretGroup.add(hatch)

    // Long Cannon Barrel
    const cannonGeo = new THREE.CylinderGeometry(0.16, 0.2, 4.4, 12)
    cannonGeo.rotateX(-Math.PI / 2)
    this.cannonMesh = new THREE.Mesh(cannonGeo, this.darkMetalMaterial)
    this.cannonMesh.position.set(0, 0.1, -3.2)
    this.cannonMesh.castShadow = true
    this.turretGroup.add(this.cannonMesh)

    // Muzzle Brake at tip of cannon
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.65), this.darkMetalMaterial)
    muzzle.position.set(0, 0.1, -5.2)
    this.turretGroup.add(muzzle)

    tankBody.add(this.turretGroup)

    this.root.add(tankBody)
    this.setPosition(startX, startZ, startYaw)
    this.scene.add(this.root)
  }

  get energyPercent(): number {
    return Math.max(0, Math.round(((this.maxHits - this.hits) / this.maxHits) * 100))
  }

  get isSmoking(): boolean {
    return this.hits >= this.smokeThreshold && !this.exploded
  }

  setPosition(x: number, z: number, yaw = 0): void {
    this.yaw = yaw
    this.root.position.set(x, 0, z)
    this.root.rotation.y = yaw
  }

  getTurretWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3()
    this.turretGroup.getWorldPosition(pos)
    return pos
  }

  getMuzzleWorldPosition(): THREE.Vector3 {
    const p = new THREE.Vector3(0, 1.65, -5.5)
    p.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw + this.turretGroup.rotation.y)
    p.add(this.root.position)
    return p
  }

  getHoodPosition(): THREE.Vector3 {
    const p = new THREE.Vector3(0, 1.4, -1.8)
    p.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw)
    p.add(this.root.position)
    return p
  }

  update(
    dt: number,
    targetPosition: THREE.Vector3,
    resolveBuildingCollision: (x: number, z: number, radius: number) => { x: number; z: number; collided: boolean },
  ): { readyToFire: boolean; fireOrigin: THREE.Vector3; fireTarget: THREE.Vector3 } {
    if (this.exploded) {
      return { readyToFire: false, fireOrigin: new THREE.Vector3(), fireTarget: new THREE.Vector3() }
    }

    if (this.hitCooldown > 0) {
      this.hitCooldown = Math.max(0, this.hitCooldown - dt)
    }

    const dx = targetPosition.x - this.root.position.x
    const dz = targetPosition.z - this.root.position.z
    const distToTarget = Math.hypot(dx, dz)

    // 1. Steering & Chassis Movement towards player
    const desiredYaw = Math.atan2(-dx, -dz)
    const yawDiff = THREE.MathUtils.euclideanModulo(desiredYaw - this.yaw + Math.PI, Math.PI * 2) - Math.PI
    this.yaw += THREE.MathUtils.clamp(yawDiff, -dt * 0.9, dt * 0.9)
    this.root.rotation.y = this.yaw

    // Speed (Tanks are heavy and steady, ~18-22 m/s)
    const targetSpeed = distToTarget > 18 ? 20 : 12
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, dt * 1.2)

    this.root.position.x += -Math.sin(this.yaw) * this.speed * dt
    this.root.position.z += -Math.cos(this.yaw) * this.speed * dt

    // Resolve building collisions
    const res = resolveBuildingCollision(this.root.position.x, this.root.position.z, this.collisionRadius)
    if (res.collided) {
      this.root.position.x = res.x
      this.root.position.z = res.z
      this.speed *= 0.7
    }

    // 2. Turret Aiming (Independently tracks player in 360 degrees)
    const worldTargetAngle = Math.atan2(-dx, -dz)
    const localTurretAngle = worldTargetAngle - this.yaw
    const turretDiff = THREE.MathUtils.euclideanModulo(localTurretAngle - this.turretGroup.rotation.y + Math.PI, Math.PI * 2) - Math.PI
    this.turretGroup.rotation.y += THREE.MathUtils.clamp(turretDiff, -dt * 2.2, dt * 2.2)

    // 3. Cannon Firing Logic
    this.fireTimer += dt
    let readyToFire = false
    const fireOrigin = this.getMuzzleWorldPosition()
    const fireTarget = targetPosition.clone()

    if (this.fireTimer >= 3.4 && distToTarget > 10 && distToTarget < 120 && Math.abs(turretDiff) < 0.4) {
      this.fireTimer = 0
      readyToFire = true
    }

    return { readyToFire, fireOrigin, fireTarget }
  }

  collideWithCar(car: Car): boolean {
    if (this.exploded || car.exploded) return false
    const dist = this.root.position.distanceTo(car.root.position)
    return dist < (this.collisionRadius + 1.4)
  }

  registerHit(_type: 'vehicle' | 'building' = 'vehicle', cooldown = 0.25): TankHitResult {
    if (this.exploded) {
      return { hitRegistered: false, isNewExplosion: false, hits: this.hits }
    }

    if (this.hitCooldown > 0) {
      return { hitRegistered: false, isNewExplosion: false, hits: this.hits }
    }

    this.hitCooldown = cooldown
    this.hits += 1

    if (this.hits >= this.maxHits) {
      this.exploded = true
      this.root.visible = false
      return { hitRegistered: true, isNewExplosion: true, hits: this.hits }
    }

    return { hitRegistered: true, isNewExplosion: false, hits: this.hits }
  }

  private readonly originalMaterials = new Map<THREE.Mesh, THREE.Material>()

  setGraphicsMode(mode: 'low' | 'medium' | 'high'): void {
    const isLow = mode === 'low'
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = !isLow
        obj.receiveShadow = !isLow
        if (isLow) {
          if (!this.originalMaterials.has(obj)) {
            this.originalMaterials.set(obj, obj.material)
          }
          const stdMat = this.originalMaterials.get(obj) as THREE.MeshStandardMaterial
          if (stdMat && stdMat.color) {
            obj.material = new THREE.MeshBasicMaterial({ color: stdMat.color })
          }
        } else if (this.originalMaterials.has(obj)) {
          obj.material = this.originalMaterials.get(obj)!
        }
      }
    })
  }

  dispose(): void {
    this.scene.remove(this.root)
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
        else obj.material.dispose()
      }
    })
  }
}
