import * as THREE from 'three'

export interface DriveInput {
  throttle: number
  steer: number
  handbrake: boolean
}

export type VehicleKind = 'sedan' | 'suv' | 'pickup' | 'truck' | 'bus' | 'bicycle' | 'fuel_tanker'

export function getMaxHits(kind: VehicleKind): number {
  if (kind === 'fuel_tanker') return 4 // Caminhão tanque suporta 4 colisões antes de explodir
  if (kind === 'truck' || kind === 'bus') return 30
  if (kind === 'suv' || kind === 'pickup') return 20
  if (kind === 'bicycle') return 8
  return 15 // carro normal (sedan / default)
}

export function getSmokeThresholdHits(kind: VehicleKind): number {
  if (kind === 'fuel_tanker') return 2
  if (kind === 'truck' || kind === 'bus') return 25
  if (kind === 'suv' || kind === 'pickup') return 15
  if (kind === 'bicycle') return 5
  return 10 // carro normal (sedan / default)
}

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
  readonly riderGroup = new THREE.Group()
  readonly wheels: THREE.Mesh[] = []
  speed = 0
  yaw = 0
  readonly mass: number
  readonly kind: VehicleKind
  readonly police: boolean
  playerControlled: boolean
  hits = 0
  readonly maxHits: number
  readonly smokeThreshold: number
  exploded = false
  inWater = false
  private waterBobTimer = 0
  hitCooldown = 0
  smokeTimer = 0
  private readonly bodyMaterial: THREE.MeshStandardMaterial
  private readonly scale: number
  private readonly wheelBase: number
  private readonly halfWidth: number
  private readonly halfLength: number
  private rammingForce: number
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
    this.maxHits = getMaxHits(this.kind)
    this.smokeThreshold = getSmokeThresholdHits(this.kind)
    this.mass = options.mass ?? (this.kind === 'bicycle' ? 0.32 : this.kind === 'fuel_tanker' ? 3.2 : this.kind === 'bus' ? 3.1 : this.kind === 'truck' ? 2.6 : this.kind === 'suv' ? 1.65 : 1.25)
    this.wheelBase = this.kind === 'bicycle' ? 0.78 : this.kind === 'fuel_tanker' ? 2.4 : this.kind === 'bus' ? 2.8 : this.kind === 'truck' ? 2.1 : this.kind === 'suv' || this.kind === 'pickup' ? 1.45 : 1.25
    this.halfWidth = this.kind === 'bicycle' ? 0.34 : this.kind === 'fuel_tanker' ? 1.32 : this.kind === 'bus' ? 1.32 : this.kind === 'truck' ? 1.28 : this.kind === 'suv' ? 1.2 : this.kind === 'pickup' ? 1.12 : 1.06
    this.halfLength = this.kind === 'bicycle' ? 0.96 : this.kind === 'fuel_tanker' ? 3.95 : this.kind === 'bus' ? 4.1 : this.kind === 'truck' ? 3.3 : this.kind === 'suv' ? 2.35 : this.kind === 'pickup' ? 2.45 : 2.075
    this.bodyMaterial = new THREE.MeshStandardMaterial({ color: options.color ?? (this.kind === 'fuel_tanker' ? 0xf0f3f6 : 0x2789d5), roughness: 0.45, metalness: 0.2 })
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

    if (this.kind === 'fuel_tanker') {
      // 1. Chassis Frame (Estrutura de aço do caminhão)
      const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.85, metalness: 0.3 })
      this.addBox([2.4, 0.48, 7.8], 0.62, chassisMat, 0, 0.1)

      // 2. Cab (Cabine moderna branca/prata do caminhão similar à imagem)
      this.addBox([2.4, 1.76, 2.15], 1.58, this.bodyMaterial, 0, -2.5)
      this.addBox([2.32, 0.46, 1.85], 2.65, this.bodyMaterial, 0, -2.4) // Defletor aerodinâmico de teto
      const windshield = this.addBox([1.96, 0.74, 0.09], 1.82, glassMaterial, 0, -3.58)
      windshield.rotation.x = -0.14
      this.addBox([0.08, 0.58, 0.98], 1.82, glassMaterial, -1.21, -2.45)
      this.addBox([0.08, 0.58, 0.98], 1.82, glassMaterial, 1.21, -2.45)
      this.addBox([2.46, 0.44, 0.24], 0.68, chassisMat, 0, -3.56) // Para-choque frontal
      this.addBox([2.34, 0.38, 0.12], 1.05, new THREE.MeshStandardMaterial({ color: 0x111416, roughness: 0.9 }), 0, -3.58) // Grade frontal

      // 3. Round Fuel Tank Body (Carroceria Redonda / Tanque Cilíndrico de Combustível Inflamável)
      const tankSilverMat = new THREE.MeshStandardMaterial({
        color: 0xdee4ea,
        roughness: 0.24,
        metalness: 0.72,
      })
      const tankGeo = new THREE.CylinderGeometry(1.22, 1.22, 5.2, 24)
      tankGeo.rotateX(Math.PI / 2)
      const mainTank = new THREE.Mesh(tankGeo, tankSilverMat)
      mainTank.position.set(0, 1.78, 1.05)
      mainTank.castShadow = true
      mainTank.receiveShadow = true
      this.root.add(mainTank)

      // Rounded End Domes (Abóbadas esféricas nas extremidades do tanque)
      const frontCapGeo = new THREE.SphereGeometry(1.22, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2)
      frontCapGeo.rotateX(-Math.PI / 2)
      const frontCap = new THREE.Mesh(frontCapGeo, tankSilverMat)
      frontCap.position.set(0, 1.78, -1.55)
      frontCap.castShadow = true
      this.root.add(frontCap)

      const rearCapGeo = new THREE.SphereGeometry(1.22, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2)
      rearCapGeo.rotateX(Math.PI / 2)
      const rearCap = new THREE.Mesh(rearCapGeo, tankSilverMat)
      rearCap.position.set(0, 1.78, 3.65)
      rearCap.castShadow = true
      this.root.add(rearCap)

      // 4. Distinctive Livery Stripes (Faixas verde e laranja de risco igual à foto de referência)
      const stripeOrangeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.38 })
      const stripeGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.38 })
      this.addBox([2.48, 0.14, 5.0], 2.15, stripeOrangeMat, 0, 1.05)
      this.addBox([2.48, 0.34, 5.0], 1.9, stripeGreenMat, 0, 1.05)

      // 5. Catwalk and Manhole Hatches on Top (Passadiço superior e bocas de visita)
      const walkwayMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7, metalness: 0.4 })
      this.addBox([0.76, 0.08, 4.8], 3.04, walkwayMat, 0, 1.05)
      for (let h = -1; h <= 1; h += 1) {
        const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 12), walkwayMat)
        hatch.position.set(0, 3.12, 1.05 + h * 1.5)
        hatch.castShadow = true
        this.root.add(hatch)
      }

      // 6. Lateral Hose Tubes & Side Piping (Tubulação de descarga lateral)
      const pipeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.6 })
      for (const side of [-1, 1]) {
        const pipeGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.8, 10)
        pipeGeo.rotateX(Math.PI / 2)
        const pipeMesh = new THREE.Mesh(pipeGeo, pipeMat)
        pipeMesh.position.set(side * 1.28, 0.96, 1.05)
        pipeMesh.castShadow = true
        this.root.add(pipeMesh)
      }

      // 7. Hazard Diamond Placard (Placa de Risco de Combustível Inflamável 33 / 1203)
      const hazardPlacardMat = new THREE.MeshStandardMaterial({ color: 0xff4d00, emissive: 0xcc2200, emissiveIntensity: 0.45 })
      for (const side of [-1, 1]) {
        const placard = this.addBox([0.06, 0.38, 0.38], 1.52, hazardPlacardMat, side * 1.26, 2.7)
        placard.rotation.x = Math.PI / 4
      }
      const rearPlacard = this.addBox([0.38, 0.38, 0.06], 1.52, hazardPlacardMat, 0.6, 3.7)
      rearPlacard.rotation.z = Math.PI / 4
    } else if (this.kind === 'truck') {
      this.addBox([2.45, 0.68, 6.55], 0.65, this.bodyMaterial)
      this.addBox([2.25, 1.56, 2.05], 1.45, this.bodyMaterial, 0, -2.12)
      const cargo = new THREE.MeshStandardMaterial({ color: 0xe5e3d8, roughness: 0.78, metalness: 0.06 })
      this.addBox([2.34, 2.34, 3.8], 1.93, cargo, 0, 1.08)
      this.addBox([2.38, 0.12, 0.14], 3.12, cargo, 0, 1.08)
      const windshield = this.addBox([1.86, 0.68, 0.09], 1.65, glassMaterial, 0, -3.16)
      windshield.rotation.x = -0.16
      this.addBox([2.5, 0.15, 0.15], 0.98, this.bodyMaterial, 0, -3.08)
    } else if (this.kind === 'bus') {
      this.addBox([2.52, 2.1, 7.8], 1.45, this.bodyMaterial)
      const busRoof = new THREE.MeshStandardMaterial({ color: 0xf5f3ea, roughness: 0.82 })
      this.addBox([2.46, 0.18, 7.6], 2.56, busRoof)
      const windshield = this.addBox([2.34, 0.88, 0.09], 1.62, glassMaterial, 0, -3.92)
      windshield.rotation.x = -0.08
      this.addBox([0.08, 0.68, 6.6], 1.72, glassMaterial, -1.27, 0.2)
      this.addBox([0.08, 0.68, 6.6], 1.72, glassMaterial, 1.27, 0.2)
      this.addBox([2.18, 0.68, 0.09], 1.72, glassMaterial, 0, 3.92)
      this.addBox([2.54, 0.16, 0.16], 0.84, this.bodyMaterial, 0, -3.88)
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

    const wheelPositions: [number, number][] = (this.kind === 'fuel_tanker')
      ? [[-1.22, -2.45], [1.22, -2.45], [-1.22, 0.45], [1.22, 0.45], [-1.22, 1.75], [1.22, 1.75], [-1.22, 3.05], [1.22, 3.05]]
      : (this.kind === 'truck' || this.kind === 'bus')
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
    const frontZ = this.kind === 'fuel_tanker' ? -3.62 : this.kind === 'truck' ? -3.25 : this.kind === 'pickup' ? -2.5 : this.kind === 'suv' ? -2.32 : -2.1
    const rearZ = this.kind === 'fuel_tanker' ? 3.75 : this.kind === 'truck' ? 3.3 : this.kind === 'pickup' ? 2.48 : this.kind === 'suv' ? 2.34 : 2.1
    const lampX = (this.kind === 'truck' || this.kind === 'fuel_tanker') ? 0.86 : 0.65
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

    // Add Stick Figure Rider (Condutor) to riderGroup
    this.root.add(this.riderGroup)

    const skin = new THREE.MeshStandardMaterial({ color: 0xe4b28c, roughness: 0.8 })
    const shirt = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.7 }) // Red shirt
    const pants = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.75 }) // Blue pants

    // 1. Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skin)
    head.position.set(0, 1.62, -0.1)
    head.castShadow = true
    this.riderGroup.add(head)

    // 2. Torso (seat to neck)
    const seatPos = new THREE.Vector3(0, 1.02, 0.22)
    const neckPos = new THREE.Vector3(0, 1.48, -0.1)
    this.addRiderBar(seatPos, neckPos, 0.088, shirt)

    // 3. Arms holding handle
    const leftShoulder = new THREE.Vector3(0.18, 1.42, -0.1)
    const rightShoulder = new THREE.Vector3(-0.18, 1.42, -0.1)
    const leftGrip = new THREE.Vector3(0.36, 1.04, -0.58)
    const rightGrip = new THREE.Vector3(-0.36, 1.04, -0.58)
    this.addRiderBar(leftShoulder, leftGrip, 0.045, shirt)
    this.addRiderBar(rightShoulder, rightGrip, 0.045, shirt)

    // 4. Legs sitting/pedaling
    const leftHip = new THREE.Vector3(0.14, 0.96, 0.2)
    const rightHip = new THREE.Vector3(-0.14, 0.96, 0.2)
    const leftPedal = new THREE.Vector3(0.24, 0.44, 0.1)
    const rightPedal = new THREE.Vector3(-0.24, 0.64, -0.1)
    this.addRiderBar(leftHip, leftPedal, 0.052, pants)
    this.addRiderBar(rightHip, rightPedal, 0.052, pants)
  }

  setRiderVisible(visible: boolean): void {
    this.riderGroup.visible = visible
  }

  private addRiderBar(start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material): void {
    const direction = end.clone().sub(start)
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius, direction.length(), 6), material)
    bar.position.copy(start).add(end).multiplyScalar(0.5)
    bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    bar.castShadow = true
    this.riderGroup.add(bar)
  }

  private addBar(start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material): void {
    const direction = end.clone().sub(start)
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius, direction.length(), 6), material)
    bar.position.copy(start).add(end).multiplyScalar(0.5)
    bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    bar.castShadow = true
    this.root.add(bar)
  }

  drive(
    input: DriveInput,
    dt: number,
    cityCollision: (x: number, z: number, radius: number) => { x: number; z: number; collided: boolean; normalX: number; normalZ: number } | boolean,
  ): boolean {
    if (this.inWater) {
      this.speed = 0
      this.driftVelocity.set(0, 0)
      this.angularVelocity = 0
      this.integrateMovement(dt)
      return false
    }

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

    const resolution = cityCollision(this.root.position.x, this.root.position.z, 1.4 * this.scale)
    const collided = typeof resolution === 'object' ? resolution.collided : resolution
    if (collided) {
      if (typeof resolution === 'object') {
        this.root.position.x = resolution.x
        this.root.position.z = resolution.z

        // Slide along wall surface by canceling velocity normal to the wall
        const forwardX = -Math.sin(this.yaw)
        const forwardZ = -Math.cos(this.yaw)
        const currentVelX = forwardX * this.speed + this.driftVelocity.x
        const currentVelZ = forwardZ * this.speed + this.driftVelocity.y
        const dot = currentVelX * resolution.normalX + currentVelZ * resolution.normalZ
        if (dot < 0) {
          const slideX = currentVelX - dot * resolution.normalX
          const slideZ = currentVelZ - dot * resolution.normalZ
          this.speed = THREE.MathUtils.clamp(slideX * forwardX + slideZ * forwardZ, -8, 37)
          this.driftVelocity.set(slideX - forwardX * this.speed, slideZ - forwardZ * this.speed)
        }
      } else {
        this.root.position.x = oldX
        this.root.position.z = oldZ
        this.speed *= -0.2
        this.driftVelocity.multiplyScalar(-0.2)
      }
      this.yaw += input.steer * 0.045
      this.root.rotation.y = this.yaw
    }

    return collided
  }

  integrateMovement(dt: number): void {
    if (this.hitCooldown > 0) this.hitCooldown = Math.max(0, this.hitCooldown - dt)
    this.yaw += this.angularVelocity * dt
    this.angularVelocity *= Math.exp(-4 * dt)
    const forwardX = -Math.sin(this.yaw)
    const forwardZ = -Math.cos(this.yaw)
    this.root.position.x += (forwardX * this.speed + this.driftVelocity.x) * dt
    this.root.position.z += (forwardZ * this.speed + this.driftVelocity.y) * dt
    this.driftVelocity.multiplyScalar(Math.exp(-3.2 * dt))
    this.root.rotation.y = this.yaw

    if (this.inWater) {
      this.waterBobTimer += dt
      this.root.position.y = -0.32 + Math.sin(this.waterBobTimer * 3.2) * 0.12
      this.root.rotation.z = Math.sin(this.waterBobTimer * 2.2) * 0.06
      this.speed *= Math.max(0, 1 - dt * 1.5)
    } else {
      this.waterBobTimer = 0
      this.root.position.y = 0
      this.root.rotation.z = 0
    }

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

  get energyPercent(): number {
    return Math.max(0, Math.min(100, Math.round(((this.maxHits - this.hits) / this.maxHits) * 100)))
  }

  get isSmoking(): boolean {
    return this.hits >= this.smokeThreshold && !this.exploded
  }

  getHoodPosition(target = new THREE.Vector3()): THREE.Vector3 {
    const forwardX = -Math.sin(this.yaw)
    const forwardZ = -Math.cos(this.yaw)
    const hoodOffset = (this.halfLength * 0.65) * this.scale
    target.set(
      this.root.position.x + forwardX * hoodOffset,
      this.root.position.y + 0.95 * this.scale,
      this.root.position.z + forwardZ * hoodOffset,
    )
    return target
  }

  registerHit(_source: 'building' | 'vehicle' = 'building', cooldown = 0.35): {
    hitRegistered: boolean
    exploded: boolean
    hits: number
    energy: number
    isNewExplosion: boolean
  } {
    if (this.exploded) {
      return { hitRegistered: false, exploded: true, hits: this.hits, energy: 0, isNewExplosion: false }
    }
    if (this.hitCooldown > 0) {
      return { hitRegistered: false, exploded: false, hits: this.hits, energy: this.energyPercent, isNewExplosion: false }
    }

    this.hitCooldown = cooldown
    this.hits += 1
    const energy = this.energyPercent
    let isNewExplosion = false

    if (this.hits >= this.maxHits && !this.exploded) {
      this.explode()
      isNewExplosion = true
    }

    return {
      hitRegistered: true,
      exploded: this.exploded,
      hits: this.hits,
      energy,
      isNewExplosion,
    }
  }

  explode(): void {
    if (this.exploded) return
    this.exploded = true
    this.hits = this.maxHits
    this.speed = 0
    this.driftVelocity.set(0, 0)
    this.angularVelocity = 0

    // Efeito visual de carcaça queimada / chamuscada
    this.bodyMaterial.color.setHex(0x18191a)
    this.bodyMaterial.roughness = 0.95
    this.bodyMaterial.metalness = 0.05
    this.bodyMaterial.needsUpdate = true
  }

  resetDamage(): void {
    this.hits = 0
    this.exploded = false
    this.hitCooldown = 0
    this.smokeTimer = 0
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

  setPlayerControlled(controlled: boolean): void {
    this.playerControlled = controlled
    this.rammingForce = controlled ? 1.05 : 1
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
