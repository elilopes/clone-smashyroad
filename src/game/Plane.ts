import * as THREE from 'three'
import type { DriveInput } from './Car'

export type PlaneState = 'idle' | 'taxi' | 'flying'

export interface PlaneHitResult {
  hitRegistered: boolean
  isNewExplosion: boolean
  hits: number
}

export class Plane {
  readonly scene: THREE.Scene
  readonly root = new THREE.Group()
  readonly maxHits = 40
  readonly smokeThreshold = 30
  hits = 0
  exploded = false
  hitCooldown = 0
  smokeTimer = 0
  consecutiveRings = 0

  // Flight Physics & Orientation
  state: PlaneState = 'idle'
  stateTimer = 0
  speed = 0
  yaw = 0
  pitch = 0
  roll = 0
  altitude = 0.55
  playerControlled = false

  // Visual meshes for animation
  private readonly leftPropeller: THREE.Group
  private readonly rightPropeller: THREE.Group
  private readonly leftRudder: THREE.Mesh
  private readonly rightElevator: THREE.Mesh
  private readonly leftElevator: THREE.Mesh
  private readonly bodyMaterial: THREE.MeshStandardMaterial
  private readonly wingMaterial: THREE.MeshStandardMaterial
  private readonly glassMaterial: THREE.MeshStandardMaterial
  private readonly engineMaterial: THREE.MeshStandardMaterial
  private readonly propMaterial: THREE.MeshStandardMaterial
  private readonly glowRedMaterial: THREE.MeshStandardMaterial
  private readonly glowGreenMaterial: THREE.MeshStandardMaterial
  private readonly glowWhiteMaterial: THREE.MeshStandardMaterial

  // Dimensions for collision
  readonly wingspan = 6.52 // Reduced wingspan
  readonly length = 8.8
  readonly height = 2.4
  readonly collisionRadius = 2.4

  constructor(scene: THREE.Scene, startX = 168, startZ = -120, startYaw = 0) {
    this.scene = scene

    // Materials
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f7fa,
      roughness: 0.38,
      metalness: 0.22,
    })
    this.wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e56a0,
      roughness: 0.42,
      metalness: 0.18,
    })
    this.engineMaterial = new THREE.MeshStandardMaterial({
      color: 0xd63447,
      roughness: 0.48,
      metalness: 0.32,
    })
    this.propMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f2425,
      roughness: 0.75,
      metalness: 0.4,
    })
    this.glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x88c4d8,
      roughness: 0.12,
      metalness: 0.35,
      transparent: true,
      opacity: 0.45,
    })
    this.glowRedMaterial = new THREE.MeshStandardMaterial({
      color: 0xff1e1e,
      emissive: 0xff1111,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    })
    this.glowGreenMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      emissive: 0x00ee44,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    })
    this.glowWhiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.0,
      roughness: 0.1,
    })

    // Build Fuselage
    const fuselage = new THREE.Group()

    // 1. Main Fuselage Body (Tapered sleek aircraft body)
    const cabinGeo = new THREE.CylinderGeometry(0.85, 0.65, 5.2, 12)
    cabinGeo.rotateX(Math.PI / 2)
    const cabin = new THREE.Mesh(cabinGeo, this.bodyMaterial)
    cabin.position.set(0, 0.95, 0)
    cabin.castShadow = true
    cabin.receiveShadow = true
    fuselage.add(cabin)

    // Nose Cone
    const noseGeo = new THREE.ConeGeometry(0.85, 1.8, 12)
    noseGeo.rotateX(-Math.PI / 2)
    const nose = new THREE.Mesh(noseGeo, this.bodyMaterial)
    nose.position.set(0, 0.95, -3.5)
    nose.castShadow = true
    fuselage.add(nose)

    // Tail Boom
    const tailGeo = new THREE.ConeGeometry(0.65, 3.2, 10)
    tailGeo.rotateX(Math.PI / 2)
    const tailCone = new THREE.Mesh(tailGeo, this.bodyMaterial)
    tailCone.position.set(0, 1.05, 4.2)
    tailCone.castShadow = true
    fuselage.add(tailCone)

    // Cockpit Glass Canopy
    const canopyGeo = new THREE.SphereGeometry(0.72, 12, 10)
    canopyGeo.scale(0.82, 0.65, 1.9)
    const canopy = new THREE.Mesh(canopyGeo, this.glassMaterial)
    canopy.position.set(0, 1.45, -1.2)
    canopy.castShadow = true
    fuselage.add(canopy)

    // Pilot Seat & Stick
    const pilotHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 }),
    )
    pilotHead.position.set(0, 1.45, -1.1)
    fuselage.add(pilotHead)

    // Racing Stripes / Livery on Fuselage
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.72, 0.16, 4.4),
      this.wingMaterial,
    )
    stripe.position.set(0, 0.95, 0.1)
    fuselage.add(stripe)

    // 2. Main Wings (Reduced 20% wingspan: 6.52m)
    const wingGeo = new THREE.BoxGeometry(6.52, 0.14, 1.55)
    const wings = new THREE.Mesh(wingGeo, this.wingMaterial)
    wings.position.set(0, 0.92, -0.4)
    wings.castShadow = true
    wings.receiveShadow = true
    fuselage.add(wings)

    // Wingtips (Ailerons / Winglets)
    const leftWinglet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 1.05), this.wingMaterial)
    leftWinglet.position.set(-3.26, 1.15, -0.4)
    fuselage.add(leftWinglet)

    const rightWinglet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 1.05), this.wingMaterial)
    rightWinglet.position.set(3.26, 1.15, -0.4)
    fuselage.add(rightWinglet)

    // Navigation lights on wingtips
    const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), this.glowRedMaterial)
    navRed.position.set(-3.3, 1.15, -0.85)
    fuselage.add(navRed)

    const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), this.glowGreenMaterial)
    navGreen.position.set(3.3, 1.15, -0.85)
    fuselage.add(navGreen)

    // 3. Twin Engines (Nacelles & Propellers)
    const engineGeo = new THREE.CylinderGeometry(0.44, 0.4, 2.0, 12)
    engineGeo.rotateX(Math.PI / 2)

    // Left Engine Nacelle
    const leftNacelle = new THREE.Mesh(engineGeo, this.engineMaterial)
    leftNacelle.position.set(-1.55, 0.88, -0.6)
    leftNacelle.castShadow = true
    fuselage.add(leftNacelle)

    // Right Engine Nacelle
    const rightNacelle = new THREE.Mesh(engineGeo, this.engineMaterial)
    rightNacelle.position.set(1.55, 0.88, -0.6)
    rightNacelle.castShadow = true
    fuselage.add(rightNacelle)

    // Left Propeller
    this.leftPropeller = new THREE.Group()
    this.leftPropeller.position.set(-1.55, 0.88, -1.65)
    const propHubL = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 10), this.engineMaterial)
    propHubL.rotateX(-Math.PI / 2)
    this.leftPropeller.add(propHubL)
    const propBladeGeo = new THREE.BoxGeometry(1.5, 0.12, 0.035)
    const propBlade1L = new THREE.Mesh(propBladeGeo, this.propMaterial)
    this.leftPropeller.add(propBlade1L)
    const propBlade2L = new THREE.Mesh(propBladeGeo, this.propMaterial)
    propBlade2L.rotation.z = Math.PI / 2
    this.leftPropeller.add(propBlade2L)
    fuselage.add(this.leftPropeller)

    // Right Propeller
    this.rightPropeller = new THREE.Group()
    this.rightPropeller.position.set(1.55, 0.88, -1.65)
    const propHubR = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 10), this.engineMaterial)
    propHubR.rotateX(-Math.PI / 2)
    this.rightPropeller.add(propHubR)
    const propBlade1R = new THREE.Mesh(propBladeGeo, this.propMaterial)
    this.rightPropeller.add(propBlade1R)
    const propBlade2R = new THREE.Mesh(propBladeGeo, this.propMaterial)
    propBlade2R.rotation.z = Math.PI / 2
    this.rightPropeller.add(propBlade2R)
    fuselage.add(this.rightPropeller)

    // 3.5. Wing Machine Gun Barrels (Metralhadoras para a missão do King Kong)
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 })
    const gunGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8)
    gunGeo.rotateX(Math.PI / 2)
    for (const sx of [-2.2, 2.2]) {
      const gunMesh = new THREE.Mesh(gunGeo, gunMat)
      gunMesh.position.set(sx, 0.85, -1.2)
      gunMesh.castShadow = true
      fuselage.add(gunMesh)
    }

    // 4. Tail Assembly (Vertical Fin & Horizontal Stabilizers)
    const finGeo = new THREE.BoxGeometry(0.14, 1.85, 1.5)
    const fin = new THREE.Mesh(finGeo, this.wingMaterial)
    fin.position.set(0, 2.1, 4.8)
    fin.castShadow = true
    fuselage.add(fin)

    this.leftRudder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.4), this.bodyMaterial)
    this.leftRudder.position.set(0, 2.05, 5.5)
    fuselage.add(this.leftRudder)

    const hStabGeo = new THREE.BoxGeometry(3.6, 0.1, 1.1)
    const hStab = new THREE.Mesh(hStabGeo, this.wingMaterial)
    hStab.position.set(0, 1.42, 5.1)
    hStab.castShadow = true
    fuselage.add(hStab)

    this.leftElevator = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.35), this.bodyMaterial)
    this.leftElevator.position.set(-0.9, 1.42, 5.7)
    fuselage.add(this.leftElevator)

    this.rightElevator = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.35), this.bodyMaterial)
    this.rightElevator.position.set(0.9, 1.42, 5.7)
    fuselage.add(this.rightElevator)

    // Tail Strobe Light
    const tailStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), this.glowWhiteMaterial)
    tailStrobe.position.set(0, 3.05, 5.0)
    fuselage.add(tailStrobe)

    // 5. Landing Gear (Tricycle Gear with rubber tires)
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1c1e21, roughness: 0.95 })
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x828a94, roughness: 0.35, metalness: 0.8 })
    const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12)
    wheelGeo.rotateZ(Math.PI / 2)

    // Nose Gear
    const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8), strutMat)
    noseStrut.position.set(0, 0.45, -2.6)
    fuselage.add(noseStrut)
    const noseWheel = new THREE.Mesh(wheelGeo, tireMat)
    noseWheel.position.set(0, 0.22, -2.6)
    fuselage.add(noseWheel)

    // Left Main Gear
    const leftStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8), strutMat)
    leftStrut.position.set(-1.3, 0.45, 0.1)
    fuselage.add(leftStrut)
    const leftWheel = new THREE.Mesh(wheelGeo, tireMat)
    leftWheel.position.set(-1.3, 0.22, 0.1)
    fuselage.add(leftWheel)

    // Right Main Gear
    const rightStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8), strutMat)
    rightStrut.position.set(1.3, 0.45, 0.1)
    fuselage.add(rightStrut)
    const rightWheel = new THREE.Mesh(wheelGeo, tireMat)
    rightWheel.position.set(1.3, 0.22, 0.1)
    fuselage.add(rightWheel)

    this.root.add(fuselage)
    this.setPosition(startX, startZ, startYaw)
    this.scene.add(this.root)
  }

  get energyPercent(): number {
    return Math.max(0, Math.round(((this.maxHits - this.hits) / this.maxHits) * 100))
  }

  get isSmoking(): boolean {
    return this.hits >= this.smokeThreshold && !this.exploded
  }

  setPosition(x: number, z: number, yaw = 0, y = 0): void {
    this.yaw = yaw
    this.altitude = Math.max(0, y)
    this.root.position.set(x, this.altitude, z)
    this.updateTransform()
  }

  private updateTransform(): void {
    this.root.rotation.set(0, 0, 0)
    // Order: Yaw -> Pitch -> Roll
    const euler = new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ')
    this.root.setRotationFromEuler(euler)
  }

  getEnginePositions(): [THREE.Vector3, THREE.Vector3] {
    const left = new THREE.Vector3(-1.55, 0.88, -0.6)
    const right = new THREE.Vector3(1.55, 0.88, -0.6)
    left.applyEuler(this.root.rotation).add(this.root.position)
    right.applyEuler(this.root.rotation).add(this.root.position)
    return [left, right]
  }

  getHoodPosition(): THREE.Vector3 {
    const p = new THREE.Vector3(0, 1.0, -1.8)
    p.applyEuler(this.root.rotation).add(this.root.position)
    return p
  }

  getGunPositions(): [THREE.Vector3, THREE.Vector3] {
    const left = new THREE.Vector3(-2.2, 0.85, -2.0)
    const right = new THREE.Vector3(2.2, 0.85, -2.0)
    left.applyEuler(this.root.rotation).add(this.root.position)
    right.applyEuler(this.root.rotation).add(this.root.position)
    return [left, right]
  }

  getForwardVector(): THREE.Vector3 {
    const fwd = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    )
    return fwd.normalize()
  }

  startBoarding(): void {
    this.state = 'taxi'
    this.stateTimer = 0
    this.speed = 10
    this.playerControlled = true
    this.consecutiveRings = 0
  }

  driveFlight(
    input: DriveInput,
    dt: number,
    checkCollision3D: (x: number, y: number, z: number, radius: number) => boolean,
    resolveCollision3D?: (x: number, y: number, z: number, radius: number) => { x: number; z: number; collided: boolean },
  ): boolean {
    if (this.exploded) return false

    if (this.hitCooldown > 0) {
      this.hitCooldown = Math.max(0, this.hitCooldown - dt)
    }

    // Propeller spinning animation
    const propSpeed = this.state === 'idle' ? 8 : (15 + this.speed * 1.5)
    this.leftPropeller.rotation.z += dt * propSpeed
    this.rightPropeller.rotation.z += dt * propSpeed

    if (this.state === 'taxi') {
      this.stateTimer += dt
      // Accelerate along the runway during 3 seconds
      const taxiProgress = Math.min(1, this.stateTimer / 3.0)
      this.speed = THREE.MathUtils.lerp(12, 42, taxiProgress)

      // Steering while taxiing: D (steer < 0) -> right (yaw decreases), A (steer > 0) -> left (yaw increases)
      this.yaw += input.steer * dt * 0.75
      this.pitch = THREE.MathUtils.lerp(0, 0.06, taxiProgress)
      this.roll = 0
      this.altitude = 0

      // Advance along forward vector
      const forwardX = -Math.sin(this.yaw)
      const forwardZ = -Math.cos(this.yaw)
      this.root.position.x += forwardX * this.speed * dt
      this.root.position.z += forwardZ * this.speed * dt
      this.root.position.y = 0

      if (resolveCollision3D) {
        const res = resolveCollision3D(this.root.position.x, 1.0, this.root.position.z, this.collisionRadius)
        if (res.collided) {
          this.root.position.x = res.x
          this.root.position.z = res.z
          this.speed *= 0.88
        }
      }

      if (this.stateTimer >= 3.0) {
        this.state = 'flying'
      }

      this.updateTransform()

      // Check ground level collision
      return checkCollision3D(this.root.position.x, this.root.position.y + 1.0, this.root.position.z, this.collisionRadius)
    }

    if (this.state === 'flying') {
      // Speed & Boost (Space / Handbrake = Nitro Boost)
      const targetSpeed = input.handbrake ? 74 : 48
      this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, dt * 2.8)

      // Pitch control:
      // When player presses UP (W / ArrowUp, throttle > 0) => nose points UP (pitch > 0), plane goes UP
      // When player presses DOWN (S / ArrowDown, throttle < 0) => nose points DOWN (pitch < 0), plane goes DOWN
      const pitchTarget = input.throttle > 0 ? 0.38 : input.throttle < 0 ? -0.38 : 0.0
      this.pitch = THREE.MathUtils.lerp(this.pitch, pitchTarget, dt * 3.8)

      // Steer / Yaw & Banking Roll:
      // When player presses RIGHT (D / ArrowRight, steer < 0) => yaw decreases (turns right), rolls right (-roll)
      // When player presses LEFT (A / ArrowLeft, steer > 0) => yaw increases (turns left), rolls left (+roll)
      const steerInput = input.steer
      const turnRate = 1.55
      this.yaw += steerInput * turnRate * dt

      // Bank roll into turns
      const targetRoll = steerInput * 0.48
      this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, dt * 4.5)

      // Animate control surfaces
      this.leftRudder.rotation.y = steerInput * 0.35
      this.leftElevator.rotation.x = this.pitch * 0.45
      this.rightElevator.rotation.x = this.pitch * 0.45

      // Altitude change: directly climbs up with UP key and pitch, dives down with DOWN key and pitch
      const climbRate = (input.throttle * 20.0) + (this.pitch * 18.0)
      this.altitude = Math.max(0.4, Math.min(145, this.altitude + climbRate * dt))

      // Movement vector
      const forwardX = -Math.sin(this.yaw) * Math.cos(this.pitch)
      const forwardZ = -Math.cos(this.yaw) * Math.cos(this.pitch)

      this.root.position.x += forwardX * this.speed * dt
      this.root.position.z += forwardZ * this.speed * dt
      this.root.position.y = this.altitude

      if (resolveCollision3D) {
        const res = resolveCollision3D(this.root.position.x, this.altitude + 1.0, this.root.position.z, this.collisionRadius)
        if (res.collided) {
          this.root.position.x = res.x
          this.root.position.z = res.z
          this.speed *= 0.88
        }
      }

      this.updateTransform()

      // Check 3D collision with buildings (scaled with 20% reduced wingspan)
      const hitCenter = checkCollision3D(this.root.position.x, this.altitude + 1.0, this.root.position.z, this.collisionRadius)
      const hitLeftWing = checkCollision3D(this.root.position.x - 2.85 * Math.cos(this.yaw), this.altitude + 1.0, this.root.position.z + 2.85 * Math.sin(this.yaw), 0.95)
      const hitRightWing = checkCollision3D(this.root.position.x + 2.85 * Math.cos(this.yaw), this.altitude + 1.0, this.root.position.z - 2.85 * Math.sin(this.yaw), 0.95)

      return hitCenter || hitLeftWing || hitRightWing
    }

    return false
  }

  registerHit(_type: 'building' | 'vehicle' = 'building', cooldown = 0.35): PlaneHitResult {
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
      this.explode()
      return { hitRegistered: true, isNewExplosion: true, hits: this.hits }
    }

    return { hitRegistered: true, isNewExplosion: false, hits: this.hits }
  }

  explode(): void {
    this.exploded = true
    this.root.visible = false
  }

  reset(x = 144, z = -120, yaw = 0): void {
    this.hits = 0
    this.exploded = false
    this.hitCooldown = 0
    this.smokeTimer = 0
    this.state = 'idle'
    this.stateTimer = 0
    this.speed = 0
    this.consecutiveRings = 0
    this.root.visible = true
    this.setPosition(x, z, yaw, 0)
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
