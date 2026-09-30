import * as THREE from 'three'

export interface DriveInput {
  throttle: number
  steer: number
  handbrake: boolean
}

export type VehicleKind = 'sedan' | 'suv' | 'pickup' | 'truck' | 'bicycle'

export interface CarOptions {
  color?: number
  police?: boolean
  playerControlled?: boolean
  kind?: VehicleKind
  scale?: number
  mass?: number
}

const wheelGeometry = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 10)
const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x171a1a, roughness: 0.91 })
const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x91b6bd, roughness: 0.32, metalness: 0.12 })

export class Car {
  readonly scene: THREE.Scene
  readonly root = new THREE.Group()
  readonly wheels: THREE.Mesh[] = []
  speed = 0
  yaw = 0
  readonly mass: number
  readonly kind: VehicleKind
  readonly police: boolean
  readonly playerControlled: boolean
  private readonly bodyMaterial: THREE.MeshStandardMaterial
  private readonly scale: number
  private readonly wheelBase: number
  private readonly halfWidth: number
  private readonly halfLength: number
  private readonly rammingForce: number
  private readonly driftVelocity = new THREE.Vector2()
  private angularVelocity = 0
  private throttleInput = 0
  private disposed = false

  constructor(scene: THREE.Scene, options: CarOptions = {}) {
    this.scene = scene
    this.scale = options.scale ?? 1
    this.kind = options.kind ?? 'sedan'
    this.police = options.police ?? false
    this.playerControlled = options.playerControlled ?? false
    this.rammingForce = this.playerControlled ? 1.05 : 1
    this.mass = options.mass ?? (this.kind === 'bicycle' ? 0.32 : this.kind === 'truck' ? 2.6 : this.kind === 'suv' ? 1.65 : 1.25)
    this.wheelBase = this.kind === 'bicycle' ? 0.78 : this.kind === 'truck' ? 2.1 : this.kind === 'suv' || this.kind === 'pickup' ? 1.45 : 1.25
    this.halfWidth = this.kind === 'bicycle' ? 0.34 : this.kind === 'truck' ? 1.28 : this.kind === 'suv' ? 1.2 : this.kind === 'pickup' ? 1.12 : 1.06
    this.halfLength = this.kind === 'bicycle' ? 0.96 : this.kind === 'truck' ? 3.3 : this.kind === 'suv' ? 2.35 : this.kind === 'pickup' ? 2.45 : 2.075
    this.bodyMaterial = new THREE.MeshStandardMaterial({ color: options.color ?? 0x2789d5, roughness: 0.56, metalness: 0.14 })
    this.root.scale.setScalar(this.scale)
    this.buildBody(this.police)
    this.scene.add(this.root)
  }

  private addBox(size: [number, number, number], y: number, material: THREE.Material, x = 0, z = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.root.add(mesh)
    return mesh
  }

  private buildBody(police: boolean): void {
    if (this.kind === 'bicycle') {
      this.buildBicycle()
      return
    }

    if (this.kind === 'truck') {
      this.addBox([2.45, 0.68, 6.55], 0.65, this.bodyMaterial)
      this.addBox([2.25, 1.56, 2.05], 1.45, this.bodyMaterial, 0, -2.12)
      const cargo = new THREE.MeshStandardMaterial({ color: 0xe5e3d8, roughness: 0.78, metalness: 0.06 })
      this.addBox([2.34, 2.34, 3.8], 1.93, cargo, 0, 1.08)
      this.addBox([2.38, 0.12, 0.14], 3.12, cargo, 0, 1.08)
      const windshield = this.addBox([1.86, 0.68, 0.09], 1.65, glassMaterial, 0, -3.16)
      windshield.rotation.x = -0.16
      this.addBox([2.5, 0.15, 0.15], 0.98, this.bodyMaterial, 0, -3.08)
    } else if (this.kind === 'pickup') {
      this.addBox([2.2, 0.61, 4.9], 0.66, this.bodyMaterial)
      this.addBox([1.84, 0.84, 2.02], 1.28, this.bodyMaterial, 0, -0.67)
      this.addBox([1.82, 0.13, 1.75], 0.97, this.bodyMaterial, 0, 1.47)
      this.addBox([0.13, 0.48, 1.86], 1.2, this.bodyMaterial, -0.96, 1.43)
      this.addBox([0.13, 0.48, 1.86], 1.2, this.bodyMaterial, 0.96, 1.43)
      this.addBox([2.02, 0.48, 0.13], 1.2, this.bodyMaterial, 0, 2.34)
      const windshield = this.addBox([1.56, 0.56, 0.09], 1.34, glassMaterial, 0, -1.65)
      windshield.rotation.x = -0.22
      const rearGlass = this.addBox([1.55, 0.44, 0.09], 1.32, glassMaterial, 0, 0.28)
      rearGlass.rotation.x = 0.12
    } else if (this.kind === 'suv') {
      this.addBox([2.36, 0.64, 4.65], 0.68, this.bodyMaterial)
      this.addBox([1.98, 0.98, 2.82], 1.43, this.bodyMaterial, 0, 0.06)
      this.addBox([1.82, 0.1, 2.2], 1.98, this.bodyMaterial, 0, 0.05)
      const windshield = this.addBox([1.72, 0.55, 0.09], 1.46, glassMaterial, 0, -1.2)
      windshield.rotation.x = -0.24
      const rearGlass = this.addBox([1.7, 0.52, 0.09], 1.46, glassMaterial, 0, 1.31)
      rearGlass.rotation.x = 0.2
    } else {
      this.addBox([2.12, 0.58, 4.15], 0.67, this.bodyMaterial)
      this.addBox([1.72, 0.72, 2.06], 1.23, this.bodyMaterial, 0, 0.1)
      const windshield = this.addBox([1.52, 0.51, 0.09], 1.25, glassMaterial, 0, -0.48)
      windshield.rotation.x = -0.28
      const rearGlass = this.addBox([1.5, 0.46, 0.09], 1.25, glassMaterial, 0, 0.72)
      rearGlass.rotation.x = 0.3
    }

    const wheelPositions: [number, number][] = this.kind === 'truck'
      ? [[-1.22, -2.13], [1.22, -2.13], [-1.22, 0.6], [1.22, 0.6], [-1.22, 2.28], [1.22, 2.28]]
      : [[-1.08, -this.wheelBase], [1.08, -this.wheelBase], [-1.08, this.wheelBase], [1.08, this.wheelBase]]
    for (const [x, z] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeometry, tireMaterial)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.47, z)
      wheel.castShadow = true
      this.root.add(wheel)
      this.wheels.push(wheel)
    }

    const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xfff4d5, emissive: 0xf8d9a3, emissiveIntensity: 0.5 })
    const tailMaterial = new THREE.MeshStandardMaterial({ color: 0xe34e40, emissive: 0x6a130e, emissiveIntensity: 0.6 })
    const frontZ = this.kind === 'truck' ? -3.25 : this.kind === 'pickup' ? -2.5 : this.kind === 'suv' ? -2.32 : -2.1
    const rearZ = this.kind === 'truck' ? 3.3 : this.kind === 'pickup' ? 2.48 : this.kind === 'suv' ? 2.34 : 2.1
    const lampX = this.kind === 'truck' ? 0.84 : 0.65
    this.addBox([0.42, 0.14, 0.05], 0.82, lampMaterial, -lampX, frontZ)
    this.addBox([0.42, 0.14, 0.05], 0.82, lampMaterial, lampX, frontZ)
    this.addBox([0.38, 0.13, 0.05], 0.82, tailMaterial, -lampX, rearZ)
    this.addBox([0.38, 0.13, 0.05], 0.82, tailMaterial, lampX, rearZ)

    if (police) {
      const bar = new THREE.MeshStandardMaterial({ color: 0x161a1e, roughness: 0.6 })
      this.addBox([1.05, 0.12, 0.3], 1.68, bar)
      const red = new THREE.MeshStandardMaterial({ color: 0xff3d45, emissive: 0xff1a24, emissiveIntensity: 1.2 })
      const blue = new THREE.MeshStandardMaterial({ color: 0x42b9ff, emissive: 0x168bff, emissiveIntensity: 1.2 })
      this.addBox([0.4, 0.16, 0.27], 1.78, red, -0.3)
      this.addBox([0.4, 0.16, 0.27], 1.78, blue, 0.3)
      this.addBox([0.06, 0.84, 0.06], 1.36, bar, -0.86, -0.2)
      this.addBox([0.06, 0.84, 0.06], 1.36, bar, 0.86, -0.2)
    }
  }

  private buildBicycle(): void {
    const tire = new THREE.MeshStandardMaterial({ color: 0x202628, roughness: 0.94 })
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8c4bf, metalness: 0.64, roughness: 0.38 })
    const front = new THREE.Vector3(0, 0.46, -0.78)
    const rear = new THREE.Vector3(0, 0.46, 0.78)
    const crank = new THREE.Vector3(0, 0.54, 0)
    const seat = new THREE.Vector3(0, 1.02, 0.32)
    const handle = new THREE.Vector3(0, 1.04, -0.58)

    for (const wheelPosition of [front, rear]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.055, 6, 18), tire)
      wheel.rotation.y = Math.PI / 2
      wheel.position.copy(wheelPosition)
      wheel.castShadow = true
      this.root.add(wheel)
      this.wheels.push(wheel)
      this.addBar(wheelPosition.clone().add(new THREE.Vector3(-0.03, 0, 0)), wheelPosition.clone().add(new THREE.Vector3(0.03, 0, 0)), 0.045, metal)
    }

    this.addBar(rear, crank, 0.052, this.bodyMaterial)
    this.addBar(crank, seat, 0.052, this.bodyMaterial)
    this.addBar(seat, rear, 0.052, this.bodyMaterial)
    this.addBar(front, crank, 0.052, this.bodyMaterial)
    this.addBar(handle, crank, 0.052, this.bodyMaterial)
    this.addBar(front, handle, 0.052, metal)
    this.addBox([0.42, 0.1, 0.18], 1.04, tire, 0, 0.37)
    this.addBox([0.72, 0.07, 0.09], 1.08, metal, 0, -0.62)
    this.addBox([0.22, 0.12, 0.12], 0.58, metal, 0, 0)
  }

  private addBar(start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material): void {
    const direction = end.clone().sub(start)
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius, direction.length(), 6), material)
    bar.position.copy(start).add(end).multiplyScalar(0.5)
    bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    bar.castShadow = true
    this.root.add(bar)
  }

  drive(input: DriveInput, dt: number, cityCollision: (x: number, z: number, radius: number) => boolean): boolean {
    const throttle = THREE.MathUtils.clamp(input.throttle, -1, 1)
    this.throttleInput = throttle
    if (throttle > 0) this.speed += 17.5 * throttle * dt
    else if (throttle < 0) this.speed += 12 * throttle * dt
    else this.speed *= Math.max(0, 1 - (input.handbrake ? 3.3 : 0.7) * dt)

    if (input.handbrake) this.speed *= Math.max(0, 1 - 2.4 * dt)
    this.speed = THREE.MathUtils.clamp(this.speed, -8, 37)
    const grip = input.handbrake ? 1.65 : 1
    this.yaw += input.steer * dt * (0.45 + Math.min(Math.abs(this.speed) * 0.044, 1.5)) * Math.sign(this.speed || 1) * grip

    const oldX = this.root.position.x
    const oldZ = this.root.position.z
    this.integrateMovement(dt)

    const collided = cityCollision(this.root.position.x, this.root.position.z, 1.4 * this.scale)
    if (collided) {
      this.root.position.x = oldX
      this.root.position.z = oldZ
      this.speed *= -0.2
      this.driftVelocity.multiplyScalar(-0.2)
      this.yaw += input.steer * 0.045
      this.root.rotation.y = this.yaw
    }

    return collided
  }

  integrateMovement(dt: number): void {
    this.yaw += this.angularVelocity * dt
    this.angularVelocity *= Math.exp(-4 * dt)
    const forwardX = -Math.sin(this.yaw)
    const forwardZ = -Math.cos(this.yaw)
    this.root.position.x += (forwardX * this.speed + this.driftVelocity.x) * dt
    this.root.position.z += (forwardZ * this.speed + this.driftVelocity.y) * dt
    this.driftVelocity.multiplyScalar(Math.exp(-3.2 * dt))
    this.root.rotation.y = this.yaw
    const wheelSpin = -this.speed * dt / 0.38
    for (const wheel of this.wheels) wheel.rotation.x += wheelSpin
  }

  collideWith(other: Car, dt = 1 / 60): boolean {
    const rightA = new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw))
    const forwardA = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw))
    const rightB = new THREE.Vector2(Math.cos(other.yaw), -Math.sin(other.yaw))
    const forwardB = new THREE.Vector2(-Math.sin(other.yaw), -Math.cos(other.yaw))
    const halfWidthA = this.halfWidth * this.scale
    const halfLengthA = this.halfLength * this.scale
    const halfWidthB = other.halfWidth * other.scale
    const halfLengthB = other.halfLength * other.scale
    const dx = other.root.position.x - this.root.position.x
    const dz = other.root.position.z - this.root.position.z
    const axes = [rightA, forwardA, rightB, forwardB]
    let minimumOverlap = Infinity
    let normalX = 0
    let normalZ = 0

    for (const axis of axes) {
      const radiusA = halfWidthA * Math.abs(rightA.dot(axis)) + halfLengthA * Math.abs(forwardA.dot(axis))
      const radiusB = halfWidthB * Math.abs(rightB.dot(axis)) + halfLengthB * Math.abs(forwardB.dot(axis))
      const centerDistance = dx * axis.x + dz * axis.y
      const overlap = radiusA + radiusB - Math.abs(centerDistance)
      if (overlap <= 0) return false
      if (overlap < minimumOverlap) {
        minimumOverlap = overlap
        const direction = centerDistance < 0 ? -1 : 1
        normalX = axis.x * direction
        normalZ = axis.y * direction
      }
    }

    const inverseMassA = 1 / this.mass
    const inverseMassB = 1 / other.mass
    const inverseMassTotal = inverseMassA + inverseMassB
    const separation = minimumOverlap + 0.015
    this.root.position.x -= normalX * separation * inverseMassA / inverseMassTotal
    this.root.position.z -= normalZ * separation * inverseMassA / inverseMassTotal
    other.root.position.x += normalX * separation * inverseMassB / inverseMassTotal
    other.root.position.z += normalZ * separation * inverseMassB / inverseMassTotal

    const velocityA = new THREE.Vector2(-Math.sin(this.yaw) * this.speed + this.driftVelocity.x, -Math.cos(this.yaw) * this.speed + this.driftVelocity.y)
    const velocityB = new THREE.Vector2(-Math.sin(other.yaw) * other.speed + other.driftVelocity.x, -Math.cos(other.yaw) * other.speed + other.driftVelocity.y)
    const closingSpeed = (velocityB.x - velocityA.x) * normalX + (velocityB.y - velocityA.y) * normalZ
    let impulse = 0
    if (closingSpeed < 0) {
      const restitution = 0.32
      const playerRamBonus = this.playerControlled && other.police
        ? this.rammingForce
        : other.playerControlled && this.police
          ? other.rammingForce
          : 1
      impulse = -(1 + restitution) * closingSpeed / inverseMassTotal * playerRamBonus
      velocityA.x -= impulse * inverseMassA * normalX
      velocityA.y -= impulse * inverseMassA * normalZ
      velocityB.x += impulse * inverseMassB * normalX
      velocityB.y += impulse * inverseMassB * normalZ
      this.angularVelocity -= normalX * impulse * 0.018
      other.angularVelocity += normalX * impulse * 0.018
    }

    if (this.playerControlled && other.police && this.throttleInput > 0.1) {
      const shove = 2.8 * this.rammingForce * this.throttleInput * dt
      velocityB.x += normalX * shove
      velocityB.y += normalZ * shove
    } else if (other.playerControlled && this.police && other.throttleInput > 0.1) {
      const shove = 2.8 * other.rammingForce * other.throttleInput * dt
      velocityA.x -= normalX * shove
      velocityA.y -= normalZ * shove
    }
    this.storeVelocity(velocityA)
    other.storeVelocity(velocityB)

    return true
  }

  private storeVelocity(velocity: THREE.Vector2): void {
    const forwardX = -Math.sin(this.yaw)
    const forwardZ = -Math.cos(this.yaw)
    this.speed = velocity.x * forwardX + velocity.y * forwardZ
    this.driftVelocity.set(velocity.x - forwardX * this.speed, velocity.y - forwardZ * this.speed)
  }

  setPosition(x: number, z: number, yaw = 0): void {
    this.root.position.set(x, 0, z)
    this.yaw = yaw
    this.root.rotation.set(0, yaw, 0)
    this.speed = 0
    this.driftVelocity.set(0, 0)
    this.angularVelocity = 0
    this.throttleInput = 0
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.scene.remove(this.root)
    const materials = new Set<THREE.Material>()
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry !== wheelGeometry) object.geometry.dispose()
        const assigned = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of assigned) materials.add(material)
      }
    })
    for (const material of materials) {
      if (material !== tireMaterial && material !== glassMaterial) material.dispose()
    }
  }
}
