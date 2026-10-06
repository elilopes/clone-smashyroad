import * as THREE from 'three'

export interface HeliHitResult {
  hitRegistered: boolean
  isNewExplosion: boolean
  hits: number
}

export class Helicopter {
  readonly scene: THREE.Scene
  readonly root = new THREE.Group()
  readonly mainRotor: THREE.Group
  readonly tailRotor: THREE.Group

  readonly maxHits = 25
  readonly smokeThreshold = 18
  hits = 0
  exploded = false
  hitCooldown = 0
  smokeTimer = 0
  fireTimer = 0

  speed = 0
  yaw = 0
  pitch = 0
  roll = 0
  altitude = 18.0

  private readonly bodyMaterial: THREE.MeshStandardMaterial
  private readonly darkMetalMaterial: THREE.MeshStandardMaterial
  private readonly glassMaterial: THREE.MeshStandardMaterial
  private readonly rotorMaterial: THREE.MeshStandardMaterial

  constructor(scene: THREE.Scene, startX: number, startZ: number, startAltitude = 20.0) {
    this.scene = scene
    this.altitude = startAltitude

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e2a38, // Navy / Military Dark Blue
      roughness: 0.55,
      metalness: 0.35,
    })

    this.darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x15181a,
      roughness: 0.72,
      metalness: 0.6,
    })

    this.glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x7ec8e3,
      roughness: 0.15,
      metalness: 0.4,
      transparent: true,
      opacity: 0.5,
    })

    this.rotorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f1112,
      roughness: 0.8,
      metalness: 0.5,
    })

    const heliBody = new THREE.Group()

    // 1. Fuselage
    const cabinGeo = new THREE.CylinderGeometry(0.9, 0.7, 4.4, 10)
    cabinGeo.rotateX(Math.PI / 2)
    const cabin = new THREE.Mesh(cabinGeo, this.bodyMaterial)
    cabin.position.set(0, 0, 0)
    cabin.castShadow = true
    cabin.receiveShadow = true
    heliBody.add(cabin)

    // Cockpit Glass Canopy
    const canopyGeo = new THREE.SphereGeometry(0.85, 10, 8)
    canopyGeo.scale(0.85, 0.75, 1.4)
    const canopy = new THREE.Mesh(canopyGeo, this.glassMaterial)
    canopy.position.set(0, 0.25, -1.2)
    canopy.castShadow = true
    heliBody.add(canopy)

    // Tail Boom
    const boom = new THREE.Mesh(new THREE.ConeGeometry(0.35, 4.8, 8), this.bodyMaterial)
    boom.rotateX(-Math.PI / 2)
    boom.position.set(0, 0.2, 3.6)
    boom.castShadow = true
    heliBody.add(boom)

    // Tail Fin (Vertical Stabilizer)
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.85), this.bodyMaterial)
    tailFin.position.set(0, 0.6, 5.8)
    tailFin.castShadow = true
    heliBody.add(tailFin)

    // 2. Main Rotor (4 blades)
    this.mainRotor = new THREE.Group()
    this.mainRotor.position.set(0, 1.15, -0.2)

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.55, 8), this.darkMetalMaterial)
    this.mainRotor.add(mast)

    const bladeGeo = new THREE.BoxGeometry(7.2, 0.04, 0.32)
    const blade1 = new THREE.Mesh(bladeGeo, this.rotorMaterial)
    this.mainRotor.add(blade1)
    const blade2 = new THREE.Mesh(bladeGeo, this.rotorMaterial)
    blade2.rotation.y = Math.PI / 2
    this.mainRotor.add(blade2)

    heliBody.add(this.mainRotor)

    // 3. Tail Rotor
    this.tailRotor = new THREE.Group()
    this.tailRotor.position.set(0.18, 0.85, 5.9)
    const tailBladeGeo = new THREE.BoxGeometry(1.4, 0.03, 0.12)
    const tailBlade1 = new THREE.Mesh(tailBladeGeo, this.rotorMaterial)
    this.tailRotor.add(tailBlade1)
    const tailBlade2 = new THREE.Mesh(tailBladeGeo, this.rotorMaterial)
    tailBlade2.rotation.z = Math.PI / 2
    this.tailRotor.add(tailBlade2)
    heliBody.add(this.tailRotor)

    // 4. Weapons & Stub Wings
    const stubWings = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.65), this.bodyMaterial)
    stubWings.position.set(0, -0.15, -0.4)
    stubWings.castShadow = true
    heliBody.add(stubWings)

    // Rocket Pods under wings
    for (const side of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.4, 8), this.darkMetalMaterial)
      pod.rotateX(Math.PI / 2)
      pod.position.set(side * 1.4, -0.35, -0.4)
      pod.castShadow = true
      heliBody.add(pod)
    }

    // Front Chin Machine Gun Turret
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), this.darkMetalMaterial)
    gun.rotateX(Math.PI / 2)
    gun.position.set(0, -0.65, -1.6)
    heliBody.add(gun)

    // 5. Landing Skids
    const skidMat = this.darkMetalMaterial
    for (const side of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.8, 8), skidMat)
      skid.rotateX(Math.PI / 2)
      skid.position.set(side * 0.9, -1.05, 0)
      skid.castShadow = true
      heliBody.add(skid)

      for (const z of [-0.9, 0.9]) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.65, 6), skidMat)
        strut.position.set(side * 0.75, -0.75, z)
        heliBody.add(strut)
      }
    }

    this.root.add(heliBody)
    this.setPosition(startX, startZ, this.altitude)
    this.scene.add(this.root)
  }

  get isSmoking(): boolean {
    return this.hits >= this.smokeThreshold && !this.exploded
  }

  setPosition(x: number, z: number, y = 20.0, yaw = 0): void {
    this.yaw = yaw
    this.altitude = y
    this.root.position.set(x, y, z)
    this.root.rotation.set(0, yaw, 0)
  }

  getFireOrigin(): THREE.Vector3 {
    const p = new THREE.Vector3(0, -0.5, -1.8)
    p.applyEuler(this.root.rotation)
    p.add(this.root.position)
    return p
  }

  getEnginePosition(): THREE.Vector3 {
    const p = new THREE.Vector3(0, 0.8, 0.4)
    p.applyEuler(this.root.rotation)
    p.add(this.root.position)
    return p
  }

  update(
    dt: number,
    targetPosition: THREE.Vector3,
  ): { readyToFire: boolean; fireOrigin: THREE.Vector3; fireTarget: THREE.Vector3 } {
    if (this.exploded) {
      return { readyToFire: false, fireOrigin: new THREE.Vector3(), fireTarget: new THREE.Vector3() }
    }

    if (this.hitCooldown > 0) {
      this.hitCooldown = Math.max(0, this.hitCooldown - dt)
    }

    // Spin Rotors
    this.mainRotor.rotation.y += dt * 26.0
    this.tailRotor.rotation.x += dt * 32.0

    const dx = targetPosition.x - this.root.position.x
    const dz = targetPosition.z - this.root.position.z
    const distToTarget = Math.hypot(dx, dz)

    // 1. Flight Movement & Tracking
    const desiredYaw = Math.atan2(-dx, -dz)
    const yawDiff = THREE.MathUtils.euclideanModulo(desiredYaw - this.yaw + Math.PI, Math.PI * 2) - Math.PI
    this.yaw += THREE.MathUtils.clamp(yawDiff, -dt * 1.5, dt * 1.5)

    // Tilt into movement
    this.pitch = THREE.MathUtils.lerp(this.pitch, distToTarget > 15 ? 0.22 : 0.05, dt * 2.0)
    this.roll = THREE.MathUtils.lerp(this.roll, yawDiff * -0.3, dt * 3.0)

    this.root.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ')

    // Maintain flight altitude relative to target (e.g. 15-22m above ground or matching airplane)
    const targetAlt = Math.max(14.0, targetPosition.y + 12.0)
    this.altitude = THREE.MathUtils.lerp(this.altitude, targetAlt, dt * 1.5)

    // Chase speed
    const chaseSpeed = distToTarget > 25 ? 32 : 18
    this.speed = THREE.MathUtils.lerp(this.speed, chaseSpeed, dt * 1.8)

    this.root.position.x += -Math.sin(this.yaw) * this.speed * dt
    this.root.position.z += -Math.cos(this.yaw) * this.speed * dt
    this.root.position.y = this.altitude

    // 2. Firing Logic (fires bursts every 2.4 seconds)
    this.fireTimer += dt
    let readyToFire = false
    const fireOrigin = this.getFireOrigin()
    const fireTarget = targetPosition.clone()

    if (this.fireTimer >= 2.4 && distToTarget > 8 && distToTarget < 110) {
      this.fireTimer = 0
      readyToFire = true
    }

    return { readyToFire, fireOrigin, fireTarget }
  }

  registerHit(_type: 'projectile' | 'collision' = 'collision', cooldown = 0.25): HeliHitResult {
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
