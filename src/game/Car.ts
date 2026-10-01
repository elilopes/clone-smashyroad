import * as THREE from 'three'

export interface DriveInput {
  throttle: number
  steer: number
  handbrake: boolean
  shoot?: boolean
  thrust?: boolean
}

export type VehicleKind = 'sedan' | 'suv' | 'pickup' | 'truck' | 'bus' | 'bicycle' | 'fuel_tanker' | 'monster_truck'

export function getMaxHits(kind: VehicleKind): number {
  if (kind === 'monster_truck') return 100 // Monster truck ultra reforçado: suporta 100 colisões
  if (kind === 'fuel_tanker') return 4 // Caminhão tanque suporta 4 colisões antes de explodir
  if (kind === 'truck' || kind === 'bus') return 30
  if (kind === 'suv' || kind === 'pickup') return 20
  if (kind === 'bicycle') return 8
  return 15 // carro normal (sedan / default)
}

export function getSmokeThresholdHits(kind: VehicleKind): number {
  if (kind === 'monster_truck') return 80
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
  readonly truckGroup = new THREE.Group()
  readonly robotGroup = new THREE.Group()
  readonly wheels: THREE.Mesh[] = []
  isRobotMode = false
  isThrusting = false
  private robotThrusters: THREE.Object3D[] = []
  private rocketFlameL?: THREE.Mesh
  private rocketFlameR?: THREE.Mesh
  private robotLeftLeg?: THREE.Group
  private robotRightLeg?: THREE.Group
  private robotLeftArm?: THREE.Group
  private robotRightArm?: THREE.Group
  private robotBlasterMuzzle?: THREE.Object3D
  private robotWalkTimer = 0
  speed = 0
  yaw = 0
  climbLift = 0
  climbPitch = 0
  isCrushed = false
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
    this.rammingForce = this.playerControlled ? (this.kind === 'monster_truck' ? 2.6 : 1.05) : 1
    this.maxHits = getMaxHits(this.kind)
    this.smokeThreshold = getSmokeThresholdHits(this.kind)
    this.mass = options.mass ?? (this.kind === 'monster_truck' ? 6.5 : this.kind === 'bicycle' ? 0.32 : this.kind === 'fuel_tanker' ? 3.2 : this.kind === 'bus' ? 3.1 : this.kind === 'truck' ? 2.6 : this.kind === 'suv' ? 1.65 : 1.25)
    this.wheelBase = this.kind === 'monster_truck' ? 1.95 : this.kind === 'bicycle' ? 0.78 : this.kind === 'fuel_tanker' ? 2.4 : this.kind === 'bus' ? 2.8 : this.kind === 'truck' ? 2.1 : this.kind === 'suv' || this.kind === 'pickup' ? 1.45 : 1.25
    this.halfWidth = this.kind === 'monster_truck' ? 2.05 : this.kind === 'bicycle' ? 0.34 : this.kind === 'fuel_tanker' ? 1.32 : this.kind === 'bus' ? 1.32 : this.kind === 'truck' ? 1.28 : this.kind === 'suv' ? 1.2 : this.kind === 'pickup' ? 1.12 : 1.06
    this.halfLength = this.kind === 'monster_truck' ? 2.8 : this.kind === 'bicycle' ? 0.96 : this.kind === 'fuel_tanker' ? 3.95 : this.kind === 'bus' ? 4.1 : this.kind === 'truck' ? 3.3 : this.kind === 'suv' ? 2.35 : this.kind === 'pickup' ? 2.45 : 2.075
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: options.color ?? (this.kind === 'monster_truck' ? 0x0ea5e9 : this.kind === 'fuel_tanker' ? 0xf0f3f6 : 0x2789d5),
      roughness: 0.45,
      metalness: 0.2,
    })
    this.root.scale.setScalar(this.scale)
    this.root.add(this.truckGroup)
    this.root.add(this.robotGroup)
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
    if (this.kind === 'monster_truck') {
      this.buildMonsterTruck()
      this.buildTransformersRobot()
      return
    }

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
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e2329, roughness: 0.8, metalness: 0.3 })
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 })
      const cargoMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.72, metalness: 0.08 })

      // 1. Heavy Box Chassis Frame & Mudflaps
      this.addBox([2.45, 0.52, 6.7], 0.62, trimMat, 0, 0.1)
      this.addBox([2.48, 0.44, 0.28], 0.68, trimMat, 0, -3.32) // Front heavy push bumper
      this.addBox([2.48, 0.44, 0.28], 0.68, trimMat, 0, 3.42) // Rear bumper

      // 2. Cab with Tiberian Sun Voxel Chamfer & Aerodynamic Roof Deflector
      this.addBox([2.34, 1.48, 2.05], 1.52, this.bodyMaterial, 0, -2.18) // Main cab
      this.addBox([2.38, 0.28, 1.65], 2.38, this.bodyMaterial, 0, -2.18) // Cab upper taper
      this.addBox([2.26, 0.45, 1.4], 2.74, this.bodyMaterial, 0, -2.05) // Aero roof deflector
      this.addBox([0.08, 0.45, 1.2], 2.74, this.bodyMaterial, -1.14, -2.05) // Side air wing L
      this.addBox([0.08, 0.45, 1.2], 2.74, this.bodyMaterial, 1.14, -2.05) // Side air wing R

      // Windshield & Side Windows
      const windshield = this.addBox([1.92, 0.72, 0.09], 1.76, glassMaterial, 0, -3.22)
      windshield.rotation.x = -0.16
      this.addBox([0.08, 0.58, 1.02], 1.76, glassMaterial, -1.18, -2.15)
      this.addBox([0.08, 0.58, 1.02], 1.76, glassMaterial, 1.18, -2.15)

      // Heavy Front Grille with Horizontal Louvers & Headlight Bezels
      this.addBox([2.15, 0.52, 0.12], 1.12, trimMat, 0, -3.22)
      this.addBox([1.65, 0.42, 0.06], 1.12, chromeMat, 0, -3.24)
      for (let g = -1; g <= 1; g += 1) {
        this.addBox([1.55, 0.04, 0.08], 1.12 + g * 0.12, trimMat, 0, -3.25)
      }

      // Side Mirrors on Angled Mounts
      for (const sm of [-1.24, 1.24]) {
        this.addBox([0.16, 0.38, 0.18], 1.82, trimMat, sm, -2.7)
        this.addBox([0.04, 0.32, 0.12], 1.82, glassMaterial, sm + (sm > 0 ? 0.08 : -0.08), -2.7)
      }

      // Dual Side Diesel Cylindrical Tanks & Underbody Toolboxes
      for (const side of [-1, 1]) {
        const tankGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.6, 12)
        tankGeo.rotateX(Math.PI / 2)
        const dTank = new THREE.Mesh(tankGeo, chromeMat)
        dTank.position.set(side * 1.22, 0.68, -0.7)
        this.root.add(dTank)
        this.addBox([0.38, 0.45, 1.1], 0.68, trimMat, side * 1.2, 0.95) // Utility toolbox
      }

      // Dual Vertical Chrome Exhaust Stacks with Perforated Heat Guards
      for (const ex of [-1.15, 1.15]) {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 10), chromeMat)
        stack.position.set(ex, 2.35, -1.1)
        this.root.add(stack)
      }

      // 3. Corrugated Heavy Cargo Container with Structural Rib Greebles
      this.addBox([2.42, 2.32, 4.3], 1.98, cargoMat, 0, 1.25)
      // Top corner reinforcement caps
      this.addBox([2.46, 0.14, 4.34], 3.16, trimMat, 0, 1.25)
      // Vertical corrugation rib greebles along sides
      for (let r = -1.8; r <= 1.8; r += 0.45) {
        this.addBox([0.06, 2.2, 0.14], 1.98, trimMat, -1.22, 1.25 + r)
        this.addBox([0.06, 2.2, 0.14], 1.98, trimMat, 1.22, 1.25 + r)
      }
      // Rear Cargo Double Doors with Locking Cam Bars & Handles
      this.addBox([2.36, 2.2, 0.08], 1.98, trimMat, 0, 3.41)
      this.addBox([0.08, 2.1, 0.12], 1.98, chromeMat, -0.4, 3.42) // Lock bar L
      this.addBox([0.08, 2.1, 0.12], 1.98, chromeMat, 0.4, 3.42) // Lock bar R
      this.addBox([0.18, 0.08, 0.14], 1.6, chromeMat, -0.4, 3.43) // Handle L
      this.addBox([0.18, 0.08, 0.14], 1.6, chromeMat, 0.4, 3.43) // Handle R
    } else if (this.kind === 'bus') {
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x1b2025, roughness: 0.85 })
      const busRoofMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 })
      const marqueeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0xf59e0b, emissiveIntensity: 1.4 })

      // 1. Bus Monocoque Hull with Tiberian Sun Aerodynamic Chamfer
      this.addBox([2.54, 2.05, 8.0], 1.48, this.bodyMaterial, 0, 0)
      this.addBox([2.48, 0.22, 7.8], 2.58, busRoofMat, 0, 0) // Roof cap
      this.addBox([2.58, 0.12, 7.9], 0.88, trimMat, 0, 0) // Side impact rub rails

      // Front Beveled Aerodynamic Nose & Lower Bumper
      this.addBox([2.56, 0.48, 0.32], 0.72, trimMat, 0, -4.02)
      this.addBox([2.5, 0.52, 0.24], 1.15, this.bodyMaterial, 0, -4.0)

      // Electronic LED Destination Marquee Display ("LINHA 101 // CENTRO")
      this.addBox([1.65, 0.24, 0.08], 2.24, marqueeMat, 0, -4.02)

      // Panoramic Windshield with Center Wiper Bar
      const windshield = this.addBox([2.38, 0.88, 0.09], 1.68, glassMaterial, 0, -4.01)
      windshield.rotation.x = -0.1
      this.addBox([0.06, 0.65, 0.12], 1.68, trimMat, 0, -4.02) // Wiper arm

      // Side Continuous Tinted Window Band with Structural Pillars
      this.addBox([0.08, 0.78, 6.8], 1.76, glassMaterial, -1.28, 0.2)
      this.addBox([0.08, 0.78, 6.8], 1.76, glassMaterial, 1.28, 0.2)
      for (let p = -2.8; p <= 3.2; p += 1.4) {
        this.addBox([0.1, 0.82, 0.14], 1.76, trimMat, -1.28, p)
        this.addBox([0.1, 0.82, 0.14], 1.76, trimMat, 1.28, p)
      }

      // Passenger Door Indents (Front & Middle Dual Folding Doors)
      this.addBox([0.12, 1.62, 0.85], 1.35, trimMat, 1.28, -2.6)
      this.addBox([0.12, 1.62, 0.85], 1.35, trimMat, 1.28, 0.5)

      // Rear Tinted Window & Engine Vent Louvers
      this.addBox([2.2, 0.72, 0.09], 1.76, glassMaterial, 0, 4.01)
      this.addBox([2.1, 0.45, 0.08], 1.05, trimMat, 0, 4.01) // Rear engine grill
      for (let el = -1; el <= 1; el += 1) {
        this.addBox([1.8, 0.05, 0.1], 1.05 + el * 0.12, new THREE.MeshStandardMaterial({ color: 0x090b0d }), 0, 4.02)
      }

      // Dual Roof HVAC Air Conditioning Units with Fan Intake Vents
      for (const acZ of [-1.5, 1.8]) {
        this.addBox([1.65, 0.32, 1.5], 2.82, trimMat, 0, acZ)
        const fanMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 14), new THREE.MeshStandardMaterial({ color: 0x0f172a }))
        fanMesh.position.set(0, 2.99, acZ)
        this.root.add(fanMesh)
      }
    } else if (this.kind === 'pickup') {
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x1f2429, roughness: 0.8, metalness: 0.35 })
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 })
      const bedLinerMat = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.95 })

      // 1. Lower Chassis, Stepped Front Bumper with Chin Bash Plate
      this.addBox([2.24, 0.52, 5.0], 0.68, this.bodyMaterial, 0, 0)
      this.addBox([2.32, 0.38, 0.28], 0.66, trimMat, 0, -2.52) // Front bumper
      this.addBox([1.4, 0.18, 0.32], 0.48, chromeMat, 0, -2.54) // Bash plate

      // 2. Beveled Cowl-Induction Hood Scoop & Grille
      this.addBox([2.18, 0.48, 1.65], 1.15, this.bodyMaterial, 0, -1.65)
      this.addBox([1.0, 0.16, 0.9], 1.42, this.bodyMaterial, 0, -1.65) // Cowl induction scoop
      this.addBox([0.92, 0.1, 0.06], 1.42, trimMat, 0, -2.12) // Scoop intake vent

      // Flared Voxel Wheel Arches (Fender Flares)
      for (const side of [-1, 1]) {
        this.addBox([0.16, 0.42, 1.1], 0.88, trimMat, side * 1.14, -1.45)
        this.addBox([0.16, 0.42, 1.1], 0.88, trimMat, side * 1.14, 1.45)
      }

      // Heavy Front Billet Grille
      this.addBox([1.75, 0.44, 0.08], 1.08, chromeMat, 0, -2.5)

      // 3. Extended Cab with Sun Visor
      this.addBox([1.94, 0.88, 2.15], 1.42, this.bodyMaterial, 0, -0.45)
      this.addBox([1.98, 0.14, 2.1], 1.88, this.bodyMaterial, 0, -0.45) // Roof cap
      this.addBox([1.92, 0.12, 0.25], 1.88, trimMat, 0, -1.55) // Front sun visor

      // Windshield & Glass
      const windshield = this.addBox([1.66, 0.62, 0.09], 1.46, glassMaterial, 0, -1.48)
      windshield.rotation.x = -0.22
      this.addBox([0.08, 0.52, 1.25], 1.46, glassMaterial, -0.98, -0.45)
      this.addBox([0.08, 0.52, 1.25], 1.46, glassMaterial, 0.98, -0.45)
      const rearGlass = this.addBox([1.58, 0.48, 0.09], 1.48, glassMaterial, 0, 0.58)
      rearGlass.rotation.x = 0.12

      // Side Tubular Utility Running Boards
      for (const side of [-1, 1]) {
        this.addBox([0.16, 0.08, 1.8], 0.45, chromeMat, side * 1.12, -0.3)
      }

      // 4. Heavy-Gauge Roll Bar / Headache Rack with LED Light Pod Bar
      this.addBox([1.88, 0.08, 0.08], 2.05, trimMat, 0, 0.72)
      this.addBox([0.08, 0.85, 0.08], 1.62, trimMat, -0.88, 0.72)
      this.addBox([0.08, 0.85, 0.08], 1.62, trimMat, 0.88, 0.72)
      this.addBox([0.08, 0.08, 1.1], 1.62, trimMat, -0.88, 1.25) // Diagonal strut L
      this.addBox([0.08, 0.08, 1.1], 1.62, trimMat, 0.88, 1.25) // Diagonal strut R

      // LED Light Pod Bar on Roll Bar
      const ledPodMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfacc15, emissiveIntensity: 1.8 })
      for (const lpx of [-0.6, -0.2, 0.2, 0.6]) {
        this.addBox([0.22, 0.14, 0.12], 2.14, ledPodMat, lpx, 0.72)
      }

      // 5. Cargo Bed & Tailgate
      this.addBox([0.22, 0.62, 1.85], 1.22, this.bodyMaterial, -0.98, 1.55)
      this.addBox([0.22, 0.62, 1.85], 1.22, this.bodyMaterial, 0.98, 1.55)
      this.addBox([1.82, 0.15, 1.8], 0.95, bedLinerMat, 0, 1.55) // Diamond-plate bed floor
      this.addBox([2.18, 0.62, 0.16], 1.22, this.bodyMaterial, 0, 2.48) // Tailgate
      this.addBox([2.26, 0.35, 0.24], 0.66, trimMat, 0, 2.54) // Rear bumper
    } else if (this.kind === 'suv') {
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e242a, roughness: 0.8, metalness: 0.35 })
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 })
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.5 })

      // 1. Heavy SUV Body with Tiberian Sun Stepped Voxel Bevels
      this.addBox([2.38, 0.58, 4.8], 0.72, this.bodyMaterial, 0, 0)
      this.addBox([2.44, 0.42, 0.28], 0.68, trimMat, 0, -2.42) // Front rugged bumper
      this.addBox([1.6, 0.22, 0.32], 0.5, chromeMat, 0, -2.44) // Front bash plate
      this.addBox([2.44, 0.42, 0.28], 0.68, trimMat, 0, 2.42) // Rear bumper

      // 2. Beveled Hood Scoop & Front Grille
      this.addBox([2.26, 0.45, 1.7], 1.18, this.bodyMaterial, 0, -1.45)
      this.addBox([0.85, 0.14, 0.85], 1.42, this.bodyMaterial, 0, -1.45) // Hood scoop
      this.addBox([0.78, 0.08, 0.06], 1.42, trimMat, 0, -1.88) // Scoop intake mesh

      // Flared Voxel Wheel Arches
      for (const side of [-1, 1]) {
        this.addBox([0.16, 0.44, 1.15], 0.9, trimMat, side * 1.21, -1.45)
        this.addBox([0.16, 0.44, 1.15], 0.9, trimMat, side * 1.21, 1.45)
      }

      // Chrome Multi-Slot Grille & Bull Bar
      this.addBox([1.8, 0.46, 0.08], 1.1, chromeMat, 0, -2.4)
      this.addBox([1.4, 0.5, 0.08], 0.88, trimMat, 0, -2.52) // Center bull bar

      // 3. SUV Cabin Greenhouse
      this.addBox([2.08, 0.98, 2.95], 1.48, this.bodyMaterial, 0, 0.12)
      this.addBox([2.12, 0.14, 2.9], 1.98, this.bodyMaterial, 0, 0.12) // Roof cap

      // Windshield & Windows
      const windshield = this.addBox([1.82, 0.62, 0.09], 1.52, glassMaterial, 0, -1.35)
      windshield.rotation.x = -0.24
      this.addBox([0.08, 0.54, 2.4], 1.52, glassMaterial, -1.05, 0.15)
      this.addBox([0.08, 0.54, 2.4], 1.52, glassMaterial, 1.05, 0.15)
      const rearGlass = this.addBox([1.78, 0.56, 0.09], 1.52, glassMaterial, 0, 1.58)
      rearGlass.rotation.x = 0.2

      // Side Tubular Rock Sliders / Steps
      for (const side of [-1, 1]) {
        this.addBox([0.18, 0.08, 2.4], 0.48, trimMat, side * 1.18, 0.1)
      }

      // 4. Rugged Safari Roof Rack with Auxiliary Spotlights
      this.addBox([1.75, 0.12, 2.2], 2.12, rackMat, 0, 0.18)
      for (let cb = -0.8; cb <= 0.8; cb += 0.4) {
        this.addBox([1.65, 0.06, 0.06], 2.15, rackMat, 0, 0.18 + cb)
      }
      // 4 Roof Spotlights
      const spotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfacc15, emissiveIntensity: 2.0 })
      for (const sx of [-0.6, -0.2, 0.2, 0.6]) {
        const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), spotMat)
        spot.rotation.x = Math.PI / 2
        spot.position.set(sx, 2.22, -0.95)
        this.root.add(spot)
      }

      // 5. Exterior-Mounted Heavy Rear Spare Tire
      const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14), tireMaterial)
      spareTire.rotation.x = Math.PI / 2
      spareTire.position.set(0.35, 1.35, 2.58)
      spareTire.castShadow = true
      this.root.add(spareTire)
      const spareRim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 10), chromeMat)
      spareRim.rotation.x = Math.PI / 2
      spareRim.position.set(0.35, 1.35, 2.58)
      this.root.add(spareRim)
      this.addBox([0.14, 0.95, 0.08], 1.45, rackMat, -0.75, 2.48) // Rear access ladder
    } else {
      // SEDAN (Civilian & Police) with Tiberian Sun Greeble Voxel Aesthetic
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x1b2025, roughness: 0.75, metalness: 0.4 })
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 })

      // 1. Sleek Stepped Voxel Body with Front Chin Splitter
      this.addBox([2.18, 0.52, 4.35], 0.68, this.bodyMaterial, 0, 0)
      this.addBox([2.24, 0.28, 0.25], 0.58, trimMat, 0, -2.18) // Front bumper chin splitter
      this.addBox([2.24, 0.28, 0.25], 0.58, trimMat, 0, 2.18) // Rear bumper diffuser

      // 2. Beveled Hood with Center Power Bulge & Twin Louvers
      this.addBox([2.04, 0.38, 1.45], 1.05, this.bodyMaterial, 0, -1.25)
      this.addBox([0.75, 0.12, 0.95], 1.25, this.bodyMaterial, 0, -1.25) // Power bulge
      this.addBox([0.22, 0.04, 0.45], 1.26, trimMat, -0.55, -1.25) // Louver L
      this.addBox([0.22, 0.04, 0.45], 1.26, trimMat, 0.55, -1.25) // Louver R

      // Flared Voxel Wheel Arches
      for (const side of [-1, 1]) {
        this.addBox([0.14, 0.38, 0.95], 0.82, this.bodyMaterial, side * 1.11, -1.25)
        this.addBox([0.14, 0.38, 0.95], 0.82, this.bodyMaterial, side * 1.11, 1.25)
      }

      // Radiator Grille & Lower Air Intake Mesh
      this.addBox([1.5, 0.36, 0.08], 0.95, chromeMat, 0, -2.18)
      this.addBox([1.3, 0.18, 0.08], 0.62, trimMat, 0, -2.19) // Lower intake

      // 3. Fastback Cabin Greenhouse & Roof Strakes
      this.addBox([1.82, 0.72, 2.18], 1.28, this.bodyMaterial, 0, 0.12)
      this.addBox([1.84, 0.12, 2.15], 1.66, this.bodyMaterial, 0, 0.12) // Roof cap
      this.addBox([0.06, 0.06, 1.8], 1.74, trimMat, -0.45, 0.12) // Aero roof strake L
      this.addBox([0.06, 0.06, 1.8], 1.74, trimMat, 0.45, 0.12) // Aero roof strake R

      // Windshield & Windows
      const windshield = this.addBox([1.62, 0.58, 0.09], 1.32, glassMaterial, 0, -0.62)
      windshield.rotation.x = -0.3
      this.addBox([0.08, 0.48, 1.6], 1.32, glassMaterial, -0.92, 0.12)
      this.addBox([0.08, 0.48, 1.6], 1.32, glassMaterial, 0.92, 0.12)
      const rearGlass = this.addBox([1.58, 0.52, 0.09], 1.32, glassMaterial, 0, 0.88)
      rearGlass.rotation.x = 0.32

      // Side Aerodynamic Rocker Skirts & Door Handles
      for (const side of [-1, 1]) {
        this.addBox([0.14, 0.12, 1.95], 0.48, trimMat, side * 1.08, 0)
        this.addBox([0.06, 0.08, 0.18], 0.95, trimMat, side * 1.1, -0.15)
        this.addBox([0.06, 0.08, 0.18], 0.95, trimMat, side * 1.1, 0.35)
        // Side Mirrors on Angled Mounts
        this.addBox([0.18, 0.12, 0.14], 1.18, this.bodyMaterial, side * 1.05, -0.72)
        this.addBox([0.04, 0.09, 0.11], 1.18, glassMaterial, side * 1.15, -0.72)
      }

      // 4. Rear Trunk Deck with Integrated Lip Spoiler & Twin Chrome Exhausts
      this.addBox([1.95, 0.38, 1.05], 0.98, this.bodyMaterial, 0, 1.55)
      this.addBox([1.98, 0.12, 0.28], 1.22, trimMat, 0, 2.05) // Rear lip spoiler
      // Dual Chrome Exhaust Tips
      for (const ex of [-0.62, 0.62]) {
        const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.25, 10), chromeMat)
        exhaust.rotation.x = Math.PI / 2
        exhaust.position.set(ex, 0.48, 2.22)
        this.root.add(exhaust)
      }
    }

    const wheelPositions: [number, number][] = (this.kind === 'fuel_tanker')
      ? [[-1.22, -2.45], [1.22, -2.45], [-1.22, 0.45], [1.22, 0.45], [-1.22, 1.75], [1.22, 1.75], [-1.22, 3.05], [1.22, 3.05]]
      : (this.kind === 'truck' || this.kind === 'bus')
        ? [[-1.22, -2.13], [1.22, -2.13], [-1.22, 0.6], [1.22, 0.6], [-1.22, 2.28], [1.22, 2.28]]
        : [[-1.08, -this.wheelBase], [1.08, -this.wheelBase], [-1.08, this.wheelBase], [1.08, this.wheelBase]]
    const alloyMat = new THREE.MeshStandardMaterial({ color: 0xdde3ea, roughness: 0.25, metalness: 0.8 })
    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.26, 10)
    for (const [x, z] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeometry, tireMaterial)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.47, z)
      wheel.castShadow = true
      const rim = new THREE.Mesh(rimGeo, alloyMat)
      wheel.add(rim)
      this.root.add(wheel)
      this.wheels.push(wheel)
    }

    const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xfff4d5, emissive: 0xf8d9a3, emissiveIntensity: 0.5 })
    const tailMaterial = new THREE.MeshStandardMaterial({ color: 0xe34e40, emissive: 0x6a130e, emissiveIntensity: 0.6 })
    const frontZ = this.kind === 'fuel_tanker' ? -3.62 : this.kind === 'truck' ? -3.25 : this.kind === 'pickup' ? -2.5 : this.kind === 'suv' ? -2.42 : -2.18
    const rearZ = this.kind === 'fuel_tanker' ? 3.75 : this.kind === 'truck' ? 3.3 : this.kind === 'pickup' ? 2.48 : this.kind === 'suv' ? 2.42 : 2.18
    const lampX = (this.kind === 'truck' || this.kind === 'fuel_tanker') ? 0.86 : (this.kind === 'suv' ? 0.78 : 0.68)
    this.addBox([0.42, 0.14, 0.05], 0.82, lampMaterial, -lampX, frontZ)
    this.addBox([0.42, 0.14, 0.05], 0.82, lampMaterial, lampX, frontZ)
    this.addBox([0.38, 0.13, 0.05], 0.82, tailMaterial, -lampX, rearZ)
    this.addBox([0.38, 0.13, 0.05], 0.82, tailMaterial, lampX, rearZ)

    if (police) {
      const bar = new THREE.MeshStandardMaterial({ color: 0x161a1e, roughness: 0.6 })
      this.addBox([1.15, 0.1, 0.32], 1.76, bar)
      const red = new THREE.MeshStandardMaterial({ color: 0xff3d45, emissive: 0xff1a24, emissiveIntensity: 1.5 })
      const blue = new THREE.MeshStandardMaterial({ color: 0x42b9ff, emissive: 0x168bff, emissiveIntensity: 1.5 })
      const white = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5 })
      this.addBox([0.42, 0.15, 0.28], 1.84, red, -0.32)
      this.addBox([0.16, 0.15, 0.28], 1.84, white, 0)
      this.addBox([0.42, 0.15, 0.28], 1.84, blue, 0.32)
      // Front push-bumper / PIT bumper
      this.addBox([1.4, 0.42, 0.1], 0.68, bar, 0, -2.25)
      this.addBox([0.08, 0.52, 0.12], 0.72, bar, -0.45, -2.26)
      this.addBox([0.08, 0.52, 0.12], 0.72, bar, 0.45, -2.26)
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
    if (this.kind === 'monster_truck') {
      this.riderGroup.visible = !this.isRobotMode && visible
      return
    }
    this.riderGroup.visible = visible
  }

  toggleRobotMode(force?: boolean): boolean {
    if (this.kind !== 'monster_truck') return false
    this.isRobotMode = force !== undefined ? force : !this.isRobotMode
    this.truckGroup.visible = !this.isRobotMode
    this.robotGroup.visible = this.isRobotMode
    return this.isRobotMode
  }

  getBlasterMuzzleWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3()
    if (this.robotBlasterMuzzle) {
      this.robotBlasterMuzzle.getWorldPosition(pos)
      return pos
    }
    pos.set(this.root.position.x, this.root.position.y + 3.8, this.root.position.z)
    return pos
  }

  getThrusterWorldPositions(): THREE.Vector3[] {
    return this.robotThrusters.map((th) => {
      const pos = new THREE.Vector3()
      th.getWorldPosition(pos)
      return pos
    })
  }

  updateRobotAnimation(dt: number): void {
    if (this.kind !== 'monster_truck' || !this.isRobotMode) return

    // Update rocket propulsion flame visuals
    if (this.rocketFlameL && this.rocketFlameR) {
      if (this.isThrusting) {
        this.rocketFlameL.visible = true
        this.rocketFlameR.visible = true
        const flamePulse = 0.9 + Math.sin(this.robotWalkTimer * 28) * 0.28
        this.rocketFlameL.scale.set(1.1, flamePulse, 1.1)
        this.rocketFlameR.scale.set(1.1, flamePulse, 1.1)
      } else {
        this.rocketFlameL.visible = false
        this.rocketFlameR.visible = false
      }
    }

    const moving = Math.abs(this.speed) > 0.4
    if (moving) {
      this.robotWalkTimer += dt * (Math.abs(this.speed) * 0.4 + 2.5)
      const legAngle = Math.sin(this.robotWalkTimer) * 0.45
      if (this.robotLeftLeg) this.robotLeftLeg.rotation.x = legAngle
      if (this.robotRightLeg) this.robotRightLeg.rotation.x = -legAngle
      if (this.robotLeftArm) this.robotLeftArm.rotation.x = -legAngle * 0.8
      if (this.robotRightArm) this.robotRightArm.rotation.x = -0.25 + Math.sin(this.robotWalkTimer * 0.5) * 0.06
    } else {
      this.robotWalkTimer += dt
      if (this.robotLeftLeg) this.robotLeftLeg.rotation.x *= Math.max(0, 1 - dt * 8)
      if (this.robotRightLeg) this.robotRightLeg.rotation.x *= Math.max(0, 1 - dt * 8)
      if (this.robotLeftArm) this.robotLeftArm.rotation.x = Math.sin(this.robotWalkTimer * 2.0) * 0.05
      if (this.robotRightArm) this.robotRightArm.rotation.x = -0.25 + Math.sin(this.robotWalkTimer * 2.0) * 0.04
    }
  }

  private addTruckBox(size: [number, number, number], y: number, material: THREE.Material, x = 0, z = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.truckGroup.add(mesh)
    return mesh
  }

  private addRobotBox(group: THREE.Group, size: [number, number, number], pos: [number, number, number], material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
    mesh.position.set(...pos)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  private buildMonsterTruck(): void {
    const cyanMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.35, metalness: 0.18 })
    const darkBlueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
    const redGraphicMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.6, roughness: 0.4 })
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e2428, roughness: 0.7, metalness: 0.6 })
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.15, metalness: 0.9 })
    const springRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 })
    const springYellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.45 })
    const tireMonsterMat = new THREE.MeshStandardMaterial({ color: 0x121517, roughness: 0.96 })
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2 })
    const amberMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 1.5 })
    const roofLightMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 2.2 })
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.75 })

    // 1. Heavy-duty elevated tubular trophy chassis & high-lift subframe (y: 1.65 - 2.15)
    this.addTruckBox([1.8, 0.45, 4.6], 1.85, chassisMat, 0, 0)
    this.addTruckBox([1.4, 0.55, 2.4], 1.55, chassisMat, 0, 0)
    this.addTruckBox([0.5, 0.4, 0.6], 1.45, darkMetalMat, 0, 0) // Transfer case

    // Massive Front & Rear Axles with Differential Pumpkins
    const axleGeo = new THREE.CylinderGeometry(0.18, 0.18, 4.1, 12)
    const diffGeo = new THREE.SphereGeometry(0.42, 12, 10)

    const axleFront = new THREE.Mesh(axleGeo, chassisMat)
    axleFront.rotation.z = Math.PI / 2
    axleFront.position.set(0, 1.45, -1.95)
    this.truckGroup.add(axleFront)
    const diffFront = new THREE.Mesh(diffGeo, darkMetalMat)
    diffFront.position.set(0, 1.45, -1.95)
    this.truckGroup.add(diffFront)

    const axleRear = new THREE.Mesh(axleGeo, chassisMat)
    axleRear.rotation.z = Math.PI / 2
    axleRear.position.set(0, 1.45, 1.95)
    this.truckGroup.add(axleRear)
    const diffRear = new THREE.Mesh(diffGeo, darkMetalMat)
    diffRear.position.set(0, 1.45, 1.95)
    this.truckGroup.add(diffRear)

    // 4 Triangulated 4-Link Suspension Control Arms
    for (const side of [-1, 1]) {
      this.addTruckBox([0.1, 0.1, 1.9], 1.65, chassisMat, side * 0.7, -0.95)
      this.addTruckBox([0.1, 0.1, 1.9], 1.65, chassisMat, side * 0.7, 0.95)
    }

    // 4 Giant Heavy-Duty High-Travel Nitrogen Coilovers with Dual Springs
    for (const sx of [-1.35, 1.35]) {
      for (const sz of [-1.95, 1.95]) {
        // Upper shock body & red main spring
        const shockTop = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.55, 12), springRedMat)
        shockTop.position.set(sx, 2.05, sz)
        this.truckGroup.add(shockTop)
        // Lower yellow helper spring & chrome shaft
        const shockBot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 12), springYellowMat)
        shockBot.position.set(sx, 1.55, sz)
        this.truckGroup.add(shockBot)
        // Nitrogen piggyback reservoir canister
        const resCan = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 10), chromeMat)
        resCan.position.set(sx + (sx > 0 ? 0.14 : -0.14), 2.0, sz)
        this.truckGroup.add(resCan)
      }
    }

    // Front aggressive stinger bull bar & winch
    this.addTruckBox([2.4, 0.4, 0.35], 1.75, springRedMat, 0, -2.85)
    this.addTruckBox([0.6, 0.3, 0.3], 1.85, darkMetalMat, 0, -2.95) // Winch box
    const winchCable = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 10), chromeMat)
    winchCable.rotation.z = Math.PI / 2
    winchCable.position.set(0, 1.85, -3.02)
    this.truckGroup.add(winchCable)

    // 2. 4 ULTRA-MASSIVE Monster Tires (Radius: 1.45m, Width: 0.98m)
    const tireGeo = new THREE.CylinderGeometry(1.45, 1.45, 0.98, 24)
    const rimGeo = new THREE.CylinderGeometry(0.88, 0.88, 1.0, 20)
    const hubGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.04, 16)
    const beadlockGeo = new THREE.RingGeometry(0.82, 0.94, 20)
    const lugGeo = new THREE.BoxGeometry(0.24, 0.96, 0.38)

    const wheelOffsets: [number, number][] = [
      [-2.05, -1.95],
      [2.05, -1.95],
      [-2.05, 1.95],
      [2.05, 1.95],
    ]

    for (const [wx, wz] of wheelOffsets) {
      const wheelGroup = new THREE.Mesh(tireGeo, tireMonsterMat)
      wheelGroup.rotation.z = Math.PI / 2
      wheelGroup.position.set(wx, 1.45, wz)
      wheelGroup.castShadow = true

      // Chrome Deep-Dish Rim
      const rim = new THREE.Mesh(rimGeo, chromeMat)
      wheelGroup.add(rim)

      // Center Hub with Lug Studs
      const hub = new THREE.Mesh(hubGeo, cyanMat)
      wheelGroup.add(hub)

      // Outer Cyan Beadlock Ring
      const beadlock = new THREE.Mesh(beadlockGeo, redGraphicMat)
      beadlock.position.set(0, 0, wx > 0 ? 0.51 : -0.51)
      wheelGroup.add(beadlock)

      // 16 Aggressive Tractor Chevron / Monster Cleat Lugs
      for (let i = 0; i < 16; i += 1) {
        const angle = (i / 16) * Math.PI * 2
        const lug = new THREE.Mesh(lugGeo, tireMonsterMat)
        lug.position.set(Math.cos(angle) * 1.47, 0, Math.sin(angle) * 1.47)
        lug.rotation.y = -angle + (wx > 0 ? 0.12 : -0.12)
        wheelGroup.add(lug)
      }

      this.truckGroup.add(wheelGroup)
      this.wheels.push(wheelGroup)
    }

    // 3. High-Riser Pickup Body (Cyan & Blue with Red Lightning Greeble Graphics)
    // Hood and high flared monster fenders
    this.addTruckBox([2.4, 0.58, 2.0], 2.45, cyanMat, 0, -1.8)
    this.addTruckBox([2.55, 0.22, 1.9], 2.32, cyanMat, 0, -1.8) // Wide flared fenders

    // Supercharger Blower Scoop on Hood
    this.addTruckBox([0.75, 0.35, 1.0], 2.92, darkMetalMat, 0, -1.6)
    this.addTruckBox([0.85, 0.22, 0.15], 3.02, chromeMat, 0, -2.12) // Dual intake butterflies
    for (const bx of [-0.22, 0.22]) {
      const flap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12), redGraphicMat)
      flap.rotation.x = Math.PI / 2
      flap.position.set(bx, 3.02, -2.18)
      this.truckGroup.add(flap)
    }

    // Chrome front heavy billet grille
    this.addTruckBox([1.5, 0.5, 0.1], 2.45, chromeMat, 0, -2.82)
    // Front quad headlights
    this.addTruckBox([0.38, 0.24, 0.08], 2.52, headlightMat, -0.92, -2.82)
    this.addTruckBox([0.38, 0.24, 0.08], 2.52, headlightMat, 0.92, -2.82)
    // Amber signals below
    this.addTruckBox([0.32, 0.14, 0.08], 2.28, amberMat, -0.92, -2.82)
    this.addTruckBox([0.32, 0.14, 0.08], 2.28, amberMat, 0.92, -2.82)

    // Main Cab
    this.addTruckBox([2.3, 1.15, 2.0], 3.05, cyanMat, 0, -0.25)
    this.addTruckBox([2.36, 0.16, 2.05], 3.68, darkBlueMat, 0, -0.25) // Roof cap
    // Windshield
    const windshield = this.addTruckBox([2.05, 0.74, 0.09], 3.08, glassMaterial, 0, -1.28)
    windshield.rotation.x = -0.24
    // Side windows
    this.addTruckBox([0.08, 0.58, 1.25], 3.08, glassMaterial, -1.16, -0.22)
    this.addTruckBox([0.08, 0.58, 1.25], 3.08, glassMaterial, 1.16, -0.22)
    // Rear window
    this.addTruckBox([1.65, 0.5, 0.08], 3.18, glassMaterial, 0, 0.76)

    // Red Zigzag / Lightning Bolt Greeble Graphics on doors & sides
    for (const side of [-1, 1]) {
      const z1 = this.addTruckBox([0.06, 0.22, 0.9], 2.65, redGraphicMat, side * 1.18, -0.9)
      z1.rotation.y = side * 0.15
      const z2 = this.addTruckBox([0.06, 0.26, 0.9], 2.78, redGraphicMat, side * 1.18, -0.15)
      z2.rotation.y = -side * 0.2
      const z3 = this.addTruckBox([0.06, 0.22, 1.3], 2.72, redGraphicMat, side * 1.18, 0.9)
      z3.rotation.y = side * 0.1
    }

    // Pickup Cargo Bed
    this.addTruckBox([0.22, 0.75, 1.9], 2.55, cyanMat, -1.08, 1.6)
    this.addTruckBox([0.22, 0.75, 1.9], 2.55, cyanMat, 1.08, 1.6)
    this.addTruckBox([2.0, 0.14, 1.9], 2.25, chassisMat, 0, 1.6)
    this.addTruckBox([2.3, 0.75, 0.14], 2.55, cyanMat, 0, 2.56) // Tailgate
    this.addTruckBox([0.34, 0.22, 0.08], 2.65, redGraphicMat, -0.96, 2.62) // Tail lights
    this.addTruckBox([0.34, 0.22, 0.08], 2.65, redGraphicMat, 0.96, 2.62)

    // Heavy Chrome Roll Cage & Off-Road Floodlights
    this.addTruckBox([2.1, 0.12, 0.12], 3.98, chromeMat, 0, 0.88)
    this.addTruckBox([0.12, 1.1, 0.12], 3.45, chromeMat, -1.0, 0.88)
    this.addTruckBox([0.12, 1.1, 0.12], 3.45, chromeMat, 1.0, 0.88)
    this.addTruckBox([0.12, 0.12, 1.4], 3.45, chromeMat, -1.0, 1.5)
    this.addTruckBox([0.12, 0.12, 1.4], 3.45, chromeMat, 1.0, 1.5)

    // 4 Giant Roof Floodlights with Protective Yellow Covers
    for (const lx of [-0.8, -0.27, 0.27, 0.8]) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 14), roofLightMat)
      lamp.rotation.x = Math.PI / 2
      lamp.position.set(lx, 4.18, 0.88)
      this.truckGroup.add(lamp)
    }

    // Dual vertical chrome smokestacks with perforated heat shields
    for (const sx of [-1.02, 1.02]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 12), chromeMat)
      stack.position.set(sx, 3.65, 0.78)
      this.truckGroup.add(stack)
    }
  }

  private buildTransformersRobot(): void {
    this.robotGroup.visible = false

    const botBlue = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4, metalness: 0.2 })
    const botRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.2 })
    const botYellow = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35, metalness: 0.3 })
    const botSilver = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.75 })
    const botCyanVisor = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00d2ff, emissiveIntensity: 3.5, roughness: 0.1 })
    const botDarkMetal = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.8 })
    const botGlass = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.2, roughness: 0.2 })
    const tireMonsterMat = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.95 })

    // 1. Torso / Chest / Abdomen (Optimus Prime Voxel - Image 2)
    const torsoGroup = new THREE.Group()
    this.addRobotBox(torsoGroup, [1.45, 0.62, 0.95], [0, 2.92, 0], botSilver) // Abdomen grille
    this.addRobotBox(torsoGroup, [2.35, 1.15, 1.25], [0, 3.82, 0], botRed) // Red chest
    this.addRobotBox(torsoGroup, [0.82, 0.55, 0.08], [-0.5, 3.85, -0.64], botGlass) // Left chest windshield
    this.addRobotBox(torsoGroup, [0.82, 0.55, 0.08], [0.5, 3.85, -0.64], botGlass) // Right chest windshield
    this.addRobotBox(torsoGroup, [0.12, 0.6, 0.1], [0, 3.85, -0.65], botSilver) // Windshield wiper/divider

    // Dual silver smokestacks behind shoulders
    for (const sx of [-1.15, 1.15]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 10), botSilver)
      stack.position.set(sx, 4.4, 0.65)
      torsoGroup.add(stack)
    }

    // Yellow waist belt & buckle
    this.addRobotBox(torsoGroup, [1.55, 0.36, 1.02], [0, 2.42, 0], botYellow)
    this.addRobotBox(torsoGroup, [0.45, 0.45, 0.12], [0, 2.38, -0.52], botYellow)
    this.addRobotBox(torsoGroup, [1.4, 0.5, 0.9], [0, 2.15, 0], botDarkMetal)

    // Rocket Propulsion Jetpack Engine on Back
    const jetpackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.8 })
    const jetNozzleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.9 })
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 4.0,
      transparent: true,
      opacity: 0.92,
    })

    this.addRobotBox(torsoGroup, [1.65, 1.35, 0.45], [0, 3.65, 0.85], jetpackMat) // Jetpack main frame
    this.addRobotBox(torsoGroup, [0.4, 0.4, 0.15], [0, 3.8, 1.1], botSilver) // Center reactor core

    this.robotThrusters = []
    for (const jx of [-0.55, 0.55]) {
      // Main thruster turbine cylinder
      const turbine = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.25, 12), jetpackMat)
      turbine.position.set(jx, 3.65, 1.05)
      torsoGroup.add(turbine)

      // Downward Rocket Exhaust Nozzle
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.38, 12), jetNozzleMat)
      nozzle.position.set(jx, 2.85, 1.05)
      torsoGroup.add(nozzle)

      const flameGeo = new THREE.ConeGeometry(0.26, 0.95, 10)
      flameGeo.rotateX(Math.PI)
      const flame = new THREE.Mesh(flameGeo, flameMat)
      flame.position.set(jx, 2.3, 1.05)
      flame.visible = false
      torsoGroup.add(flame)

      if (jx < 0) this.rocketFlameL = flame
      else this.rocketFlameR = flame

      const thrustPoint = new THREE.Object3D()
      thrustPoint.position.set(jx, 2.5, 1.05)
      torsoGroup.add(thrustPoint)
      this.robotThrusters.push(thrustPoint)
    }

    // Head with crest and ear antennae (Image 2)
    this.addRobotBox(torsoGroup, [0.85, 0.85, 0.85], [0, 4.82, 0], botBlue) // Helmet
    this.addRobotBox(torsoGroup, [0.18, 0.45, 0.75], [0, 5.28, 0], botBlue) // Center crest fin
    this.addRobotBox(torsoGroup, [0.12, 0.85, 0.18], [-0.48, 5.3, 0], botBlue) // Left ear antenna
    this.addRobotBox(torsoGroup, [0.12, 0.85, 0.18], [0.48, 5.3, 0], botBlue) // Right ear antenna
    this.addRobotBox(torsoGroup, [0.6, 0.38, 0.12], [0, 4.65, -0.45], botSilver) // Mouthplate
    this.addRobotBox(torsoGroup, [0.55, 0.14, 0.08], [0, 4.94, -0.44], botCyanVisor) // Cyan visor optics

    this.robotGroup.add(torsoGroup)

    // 2. Left Arm
    this.robotLeftArm = new THREE.Group()
    this.robotLeftArm.position.set(-1.65, 4.0, 0)
    this.addRobotBox(this.robotLeftArm, [0.75, 0.75, 0.85], [0, 0, 0], botRed) // Shoulder pauldron
    this.addRobotBox(this.robotLeftArm, [0.5, 0.65, 0.5], [0, -0.65, 0], botRed) // Bicep
    this.addRobotBox(this.robotLeftArm, [0.58, 0.85, 0.58], [0, -1.35, 0], botBlue) // Forearm
    this.addRobotBox(this.robotLeftArm, [0.45, 0.45, 0.45], [0, -1.9, 0], botDarkMetal) // Fist
    this.robotGroup.add(this.robotLeftArm)

    // 3. Right Arm holding Blaster Cannon
    this.robotRightArm = new THREE.Group()
    this.robotRightArm.position.set(1.65, 4.0, 0)
    this.addRobotBox(this.robotRightArm, [0.75, 0.75, 0.85], [0, 0, 0], botRed) // Shoulder pauldron
    this.addRobotBox(this.robotRightArm, [0.5, 0.65, 0.5], [0, -0.65, 0], botRed) // Bicep
    this.addRobotBox(this.robotRightArm, [0.58, 0.85, 0.58], [0, -1.35, 0], botBlue) // Forearm
    this.addRobotBox(this.robotRightArm, [0.45, 0.45, 0.45], [0, -1.9, 0], botDarkMetal) // Hand

    // Blaster Rifle / Ion Cannon in hand
    this.addRobotBox(this.robotRightArm, [0.38, 0.52, 1.5], [0, -1.85, -0.6], botDarkMetal) // Receiver
    this.addRobotBox(this.robotRightArm, [0.25, 0.45, 0.5], [0, -1.95, 0.35], botDarkMetal) // Stock
    this.addRobotBox(this.robotRightArm, [0.18, 0.22, 0.75], [0, -1.5, -0.6], botDarkMetal) // Top scope

    // Long Cannon barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 12), botDarkMetal)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, -1.85, -1.85)
    this.robotRightArm.add(barrel)

    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.35, 12), botDarkMetal)
    muzzleBrake.rotation.x = Math.PI / 2
    muzzleBrake.position.set(0, -1.85, -2.65)
    this.robotRightArm.add(muzzleBrake)

    this.robotBlasterMuzzle = new THREE.Object3D()
    this.robotBlasterMuzzle.position.set(0, -1.85, -2.9)
    this.robotRightArm.add(this.robotBlasterMuzzle)

    this.robotGroup.add(this.robotRightArm)

    // 4. Left & Right Legs with outer monster truck wheels (Image 2)
    const legWheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.38, 14)

    // Left Leg
    this.robotLeftLeg = new THREE.Group()
    this.robotLeftLeg.position.set(-0.65, 2.1, 0)
    this.addRobotBox(this.robotLeftLeg, [0.65, 0.95, 0.75], [0, -0.5, 0], botBlue) // Thigh
    this.addRobotBox(this.robotLeftLeg, [0.75, 1.25, 0.85], [0, -1.45, 0], botBlue) // Shin
    this.addRobotBox(this.robotLeftLeg, [0.55, 0.95, 0.1], [0, -1.45, -0.45], botSilver) // Front grille plate
    this.addRobotBox(this.robotLeftLeg, [0.82, 0.42, 1.35], [0, -2.1, -0.15], botBlue) // Foot
    this.addRobotBox(this.robotLeftLeg, [0.84, 0.1, 1.37], [0, -2.3, -0.15], botSilver) // Sole

    // Outer leg wheels
    const wheelL1 = new THREE.Mesh(legWheelGeo, tireMonsterMat)
    wheelL1.rotation.z = Math.PI / 2
    wheelL1.position.set(-0.52, -0.8, 0)
    this.robotLeftLeg.add(wheelL1)

    const wheelL2 = new THREE.Mesh(legWheelGeo, tireMonsterMat)
    wheelL2.rotation.z = Math.PI / 2
    wheelL2.position.set(-0.52, -1.6, 0)
    this.robotLeftLeg.add(wheelL2)

    this.robotGroup.add(this.robotLeftLeg)

    // Right Leg
    this.robotRightLeg = new THREE.Group()
    this.robotRightLeg.position.set(0.65, 2.1, 0)
    this.addRobotBox(this.robotRightLeg, [0.65, 0.95, 0.75], [0, -0.5, 0], botBlue) // Thigh
    this.addRobotBox(this.robotRightLeg, [0.75, 1.25, 0.85], [0, -1.45, 0], botBlue) // Shin
    this.addRobotBox(this.robotRightLeg, [0.55, 0.95, 0.1], [0, -1.45, -0.45], botSilver) // Front grille plate
    this.addRobotBox(this.robotRightLeg, [0.82, 0.42, 1.35], [0, -2.1, -0.15], botBlue) // Foot
    this.addRobotBox(this.robotRightLeg, [0.84, 0.1, 1.37], [0, -2.3, -0.15], botSilver) // Sole

    // Outer leg wheels
    const wheelR1 = new THREE.Mesh(legWheelGeo, tireMonsterMat)
    wheelR1.rotation.z = Math.PI / 2
    wheelR1.position.set(0.52, -0.8, 0)
    this.robotRightLeg.add(wheelR1)

    const wheelR2 = new THREE.Mesh(legWheelGeo, tireMonsterMat)
    wheelR2.rotation.z = Math.PI / 2
    wheelR2.position.set(0.52, -1.6, 0)
    this.robotRightLeg.add(wheelR2)

    this.robotGroup.add(this.robotRightLeg)
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

    // Rocket Propulsion Jetpack Thrust in Robot Mode
    if (this.kind === 'monster_truck' && this.isRobotMode) {
      if (input.thrust) {
        this.isThrusting = true
        this.climbLift = Math.min(26.0, this.climbLift + 6.8 * dt)
      } else {
        this.isThrusting = false
        if (this.climbLift > 0) {
          this.climbLift = Math.max(0, this.climbLift - 6.8 * dt)
        }
      }
    }

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

    if (this.inWater) {
      this.speed = 0
      this.driftVelocity.set(0, 0)
      this.angularVelocity = 0
      this.waterBobTimer += dt
      this.root.position.y = -0.32 + Math.sin(this.waterBobTimer * 3.2) * 0.12
      this.root.rotation.z = Math.sin(this.waterBobTimer * 2.2) * 0.06
      return
    }

    this.waterBobTimer = 0
    if (this.kind !== 'monster_truck' || !this.isRobotMode) {
      if (this.climbLift > 0) {
        this.climbLift = Math.max(0, this.climbLift - dt * 2.5)
      }
    }
    if (Math.abs(this.climbPitch) > 0.001) {
      this.climbPitch *= Math.max(0, 1 - dt * 4.5)
    }

    this.root.position.y = this.climbLift
    this.root.rotation.x = this.climbPitch
    this.root.rotation.z = 0
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

  crush(): void {
    if (this.kind === 'monster_truck' || this.kind === 'fuel_tanker' || this.kind === 'truck' || this.kind === 'bus') return
    this.isCrushed = true
    this.exploded = true
    this.hits = this.maxHits
    this.speed *= 0.05
    this.driftVelocity.multiplyScalar(0.05)
    this.root.scale.y = 0.20 * this.scale
    this.root.scale.x = 1.25 * this.scale
    this.root.scale.z = 1.15 * this.scale
    this.bodyMaterial.color.setHex(0x1a1d20)
    this.bodyMaterial.roughness = 0.95
    this.bodyMaterial.needsUpdate = true
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

    // Special Monster Truck Over-Ride & Crush Physics:
    // If a monster truck collides with a small car (sedan, suv, pickup, bicycle), the monster truck rides UP and over it!
    const isMonsterA = this.kind === 'monster_truck' && !this.isRobotMode
    const isMonsterB = other.kind === 'monster_truck' && !other.isRobotMode
    const isSmallA = this.kind !== 'monster_truck' && this.kind !== 'fuel_tanker' && this.kind !== 'truck' && this.kind !== 'bus'
    const isSmallB = other.kind !== 'monster_truck' && other.kind !== 'fuel_tanker' && other.kind !== 'truck' && other.kind !== 'bus'

    if (isMonsterA && isSmallB) {
      this.climbLift = Math.min(1.15, this.climbLift + 0.72)
      this.climbPitch = -0.22 * Math.sign(this.speed || 1)
      this.speed *= 0.94 // Maintains powerful forward momentum over the crushed car
      other.crush()
    } else if (isMonsterB && isSmallA) {
      other.climbLift = Math.min(1.15, other.climbLift + 0.72)
      other.climbPitch = -0.22 * Math.sign(other.speed || 1)
      other.speed *= 0.94
      this.crush()
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
