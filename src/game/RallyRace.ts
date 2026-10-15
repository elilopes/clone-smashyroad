import * as THREE from 'three'
import { Car } from './Car'
import { City } from './City'
import { Sound } from './Sound'
import { Sparks } from './Sparks'

export interface RallyArch {
  id: number
  position: THREE.Vector3
  rotationY: number
  mesh: THREE.Group
  neonMesh: THREE.Mesh
  signMesh: THREE.Mesh
  cooldownTimer: number
}

export interface RallyTurboPickup {
  id: number
  position: THREE.Vector3
  mesh: THREE.Group
  active: boolean
  cooldownTimer: number
  spinSpeed: number
}

export interface RallyCompetitor {
  id: number
  car: Car
  name: string
  number: number
  colorHex: number
  distanceAlongTrack: number
  lap: number
  laneOffset: number
  targetLaneOffset: number
  baseSpeed: number
  currentSpeed: number
  driftAngle: number
}

export class RallyRace {
  private readonly scene: THREE.Scene
  private readonly city: City
  private readonly sound: Sound
  private readonly sparks: Sparks
  readonly root = new THREE.Group()

  // Track Dimensions in East Desert Dunes
  readonly centerX = 1100
  readonly centerZ = 0
  readonly straightLength = 150 // Straight runs from Z = -75 to Z = +75
  readonly curveRadius = 45     // Center to lane centerline: East lane at X = 1145, West lane at X = 1055
  readonly trackWidth = 18      // 18m wide two-lane track
  readonly totalTrackLength: number

  // Visuals and Entities
  readonly competitors: RallyCompetitor[] = []
  readonly scoreArches: RallyArch[] = []
  readonly turboPickups: RallyTurboPickup[] = []
  paddockCar?: Car
  private paddockBeacon?: THREE.Mesh

  // Player Race Progress
  playerInTrack = false
  playerDistanceAlongTrack = 0
  playerLap = 1
  playerBestLap = 0
  playerLapTimer = 0
  playerRacePosition = 7
  playerHasWon = false

  // Callbacks
  onScoreCollected?: (points: number, cash: number) => void
  onTurboCollected?: () => void
  onLapCompleted?: (lap: number, position: number) => void
  onRaceWon?: (rewardCash: number, rewardPoints: number) => void

  // Materials for track and elements
  private readonly trackAsphaltMat = new THREE.MeshStandardMaterial({
    color: 0x221f1e, // Dark desert gravel asphalt
    roughness: 0.92,
    metalness: 0.1,
  })
  private readonly curbRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 })
  private readonly curbWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
  private readonly barrierConcreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 })
  private readonly fenceSteelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.35 })
  private readonly wireMeshMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.7,
    roughness: 0.4,
    transparent: true,
    opacity: 0.78,
  })
  private readonly archNeonMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x22d3ee,
    emissiveIntensity: 2.8,
    roughness: 0.15,
  })
  private readonly turboEnergyMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xfbbf24,
    emissiveIntensity: 3.2,
    roughness: 0.12,
  })

  constructor(scene: THREE.Scene, city: City, sound: Sound, sparks: Sparks) {
    this.scene = scene
    this.city = city
    this.sound = sound
    this.sparks = sparks
    this.totalTrackLength = 2 * this.straightLength + 2 * Math.PI * this.curveRadius

    this.scene.add(this.root)
    this.buildTrackEnvironment()
    this.buildScoreArches()
    this.buildTurboPickups()
    this.spawnCompetitors()
    this.spawnPaddockCar()
  }

  // Convert distance along the track loop (0 to totalTrackLength) to world Vector3 & tangent
  getTrackTransform(distance: number, lateralOffset = 0): { position: THREE.Vector3; tangent: THREE.Vector3; yaw: number } {
    let s = ((distance % this.totalTrackLength) + this.totalTrackLength) % this.totalTrackLength
    const halfStraight = this.straightLength / 2
    const curveLen = Math.PI * this.curveRadius

    // Section 1: East Straight (Front Straight, heading North Z -> +Z)
    // s in [0, straightLength]
    if (s <= this.straightLength) {
      const z = -halfStraight + s
      const x = this.centerX + this.curveRadius + lateralOffset
      return {
        position: new THREE.Vector3(x, 0.08, z),
        tangent: new THREE.Vector3(0, 0, 1),
        yaw: Math.PI,
      }
    }
    s -= this.straightLength

    // Section 2: North Hairpin Curve (sweeps from East to West)
    // s in [0, curveLen]
    if (s <= curveLen) {
      const angle = (s / curveLen) * Math.PI // 0 to PI
      const r = this.curveRadius + lateralOffset
      const x = this.centerX + r * Math.cos(angle)
      const z = halfStraight + r * Math.sin(angle)
      const tanX = -Math.sin(angle)
      const tanZ = Math.cos(angle)
      const yaw = Math.atan2(-tanX, -tanZ)
      return {
        position: new THREE.Vector3(x, 0.08, z),
        tangent: new THREE.Vector3(tanX, 0, tanZ),
        yaw,
      }
    }
    s -= curveLen

    // Section 3: West Straight (Back Straight, heading South Z -> -Z)
    // s in [0, straightLength]
    if (s <= this.straightLength) {
      const z = halfStraight - s
      const x = this.centerX - this.curveRadius - lateralOffset
      return {
        position: new THREE.Vector3(x, 0.08, z),
        tangent: new THREE.Vector3(0, 0, -1),
        yaw: 0,
      }
    }
    s -= this.straightLength

    // Section 4: South Hairpin Curve (sweeps from West to East)
    // s in [0, curveLen]
    const angle = Math.PI + (s / curveLen) * Math.PI // PI to 2*PI
    const r = this.curveRadius + lateralOffset
    const x = this.centerX + r * Math.cos(angle)
    const z = -halfStraight + r * Math.sin(angle)
    const tanX = -Math.sin(angle)
    const tanZ = Math.cos(angle)
    const yaw = Math.atan2(-tanX, -tanZ)
    return {
      position: new THREE.Vector3(x, 0.08, z),
      tangent: new THREE.Vector3(tanX, 0, tanZ),
      yaw,
    }
  }

  // Calculate approximate distance along track for any arbitrary world point
  getDistanceAlongTrack(worldPos: THREE.Vector3): number {
    const halfStraight = this.straightLength / 2
    const curveLen = Math.PI * this.curveRadius
    const dx = worldPos.x - this.centerX
    const z = worldPos.z

    // If within the straight Z interval
    if (z >= -halfStraight && z <= halfStraight) {
      if (dx >= 0) {
        // East straight (heading North)
        return z + halfStraight
      } else {
        // West straight (heading South)
        return this.straightLength + curveLen + (halfStraight - z)
      }
    }

    // In the North curve (z > halfStraight)
    if (z > halfStraight) {
      const angle = Math.atan2(z - halfStraight, dx)
      const clampedAngle = THREE.MathUtils.clamp(angle, 0, Math.PI)
      return this.straightLength + (clampedAngle / Math.PI) * curveLen
    }

    // In the South curve (z < -halfStraight)
    let angle = Math.atan2(z + halfStraight, dx)
    if (angle < 0) angle += 2 * Math.PI
    const clampedAngle = THREE.MathUtils.clamp(angle, Math.PI, 2 * Math.PI)
    return this.straightLength * 2 + curveLen + ((clampedAngle - Math.PI) / Math.PI) * curveLen
  }

  private buildTrackEnvironment(): void {
    const colliders: { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number }[] = []
    const halfStraight = this.straightLength / 2
    const innerR = this.curveRadius - this.trackWidth / 2
    const outerR = this.curveRadius + this.trackWidth / 2

    // 1. Asphalt Ground Surface for Straights
    // East Straight
    const eastTrack = new THREE.Mesh(new THREE.PlaneGeometry(this.trackWidth, this.straightLength), this.trackAsphaltMat)
    eastTrack.rotation.x = -Math.PI / 2
    eastTrack.position.set(this.centerX + this.curveRadius, 0.04, 0)
    eastTrack.receiveShadow = true
    this.root.add(eastTrack)

    // West Straight
    const westTrack = new THREE.Mesh(new THREE.PlaneGeometry(this.trackWidth, this.straightLength), this.trackAsphaltMat)
    westTrack.rotation.x = -Math.PI / 2
    westTrack.position.set(this.centerX - this.curveRadius, 0.04, 0)
    westTrack.receiveShadow = true
    this.root.add(westTrack)

    // North & South Curved Turns (Ring Geometry)
    const curveSegments = 24
    const northCurve = new THREE.Mesh(new THREE.RingGeometry(innerR, outerR, curveSegments, 1, 0, Math.PI), this.trackAsphaltMat)
    northCurve.rotation.x = -Math.PI / 2
    northCurve.position.set(this.centerX, 0.04, halfStraight)
    northCurve.receiveShadow = true
    this.root.add(northCurve)

    const southCurve = new THREE.Mesh(new THREE.RingGeometry(innerR, outerR, curveSegments, 1, Math.PI, Math.PI), this.trackAsphaltMat)
    southCurve.rotation.x = -Math.PI / 2
    southCurve.position.set(this.centerX, 0.04, -halfStraight)
    southCurve.receiveShadow = true
    this.root.add(southCurve)

    // 2. Access Road connecting from City Bridge Road (at X=720, Z=0) to the Rally Paddock
    const accessRoad = new THREE.Mesh(new THREE.PlaneGeometry(330, 16), this.trackAsphaltMat)
    accessRoad.rotation.x = -Math.PI / 2
    accessRoad.position.set(885, 0.03, 0)
    accessRoad.receiveShadow = true
    this.root.add(accessRoad)

    // 3. GRADE ENTRE AS PISTAS (Central Divider Fence & Guard-Rail)
    // "uma pista oval grande com grade entre as pistas para os carros não mudarem o sentido"
    // Center divider along X = 1100 from Z = -halfStraight to Z = halfStraight, plus end curves!
    const fenceGroup = new THREE.Group()
    const fenceHeight = 3.2
    const postGeo = new THREE.CylinderGeometry(0.14, 0.14, fenceHeight, 8)
    const railGeo = new THREE.BoxGeometry(0.12, 0.22, 4.2)
    const meshPanelGeo = new THREE.BoxGeometry(0.08, fenceHeight - 0.4, 4.0)

    for (let z = -halfStraight - 4; z <= halfStraight + 4; z += 4) {
      // Steel vertical support post
      const post = new THREE.Mesh(postGeo, this.fenceSteelMat)
      post.position.set(this.centerX, fenceHeight / 2, z)
      post.castShadow = true
      fenceGroup.add(post)

      // Horizontal security beams & wire mesh panel
      if (z <= halfStraight) {
        const topRail = new THREE.Mesh(railGeo, this.fenceSteelMat)
        topRail.position.set(this.centerX, fenceHeight - 0.2, z + 2)
        fenceGroup.add(topRail)

        const midRail = new THREE.Mesh(railGeo, this.fenceSteelMat)
        midRail.position.set(this.centerX, fenceHeight / 2, z + 2)
        fenceGroup.add(midRail)

        const botRail = new THREE.Mesh(railGeo, this.fenceSteelMat)
        botRail.position.set(this.centerX, 0.25, z + 2)
        fenceGroup.add(botRail)

        const wireMesh = new THREE.Mesh(meshPanelGeo, this.wireMeshMat)
        wireMesh.position.set(this.centerX, fenceHeight / 2, z + 2)
        fenceGroup.add(wireMesh)
      }
    }

    // Concrete median base curb under central fence
    const medianBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, this.straightLength + 12), this.barrierConcreteMat)
    medianBase.position.set(this.centerX, 0.22, 0)
    medianBase.castShadow = true
    fenceGroup.add(medianBase)

    this.root.add(fenceGroup)

    // Register Solid 3D Collider for the Central Fence so no car can cross lanes!
    colliders.push({
      minX: this.centerX - 1.2,
      maxX: this.centerX + 1.2,
      minZ: -halfStraight - 8,
      maxZ: halfStraight + 8,
      minY: 0,
      maxY: fenceHeight + 1.5,
    })

    // 4. Outer Boundary Safety Barriers & Tire Stacks
    const outerWallHeight = 1.8
    // Outer East barrier wall
    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(1.2, outerWallHeight, this.straightLength), this.barrierConcreteMat)
    eastWall.position.set(this.centerX + outerR + 0.6, outerWallHeight / 2, 0)
    eastWall.castShadow = true
    this.root.add(eastWall)
    colliders.push({
      minX: this.centerX + outerR,
      maxX: this.centerX + outerR + 1.8,
      minZ: -halfStraight,
      maxZ: halfStraight,
      minY: 0,
      maxY: outerWallHeight,
    })

    // Outer West barrier wall (leaves gap at Z=0 for access road entrance)
    for (const zSide of [-1, 1]) {
      const partLen = (this.straightLength - 24) / 2
      const wz = zSide * (12 + partLen / 2)
      const westWallPart = new THREE.Mesh(new THREE.BoxGeometry(1.2, outerWallHeight, partLen), this.barrierConcreteMat)
      westWallPart.position.set(this.centerX - outerR - 0.6, outerWallHeight / 2, wz)
      westWallPart.castShadow = true
      this.root.add(westWallPart)

      colliders.push({
        minX: this.centerX - outerR - 1.8,
        maxX: this.centerX - outerR,
        minZ: wz - partLen / 2,
        maxZ: wz + partLen / 2,
        minY: 0,
        maxY: outerWallHeight,
      })
    }

    // Outer curve barriers (segmented around North and South bends)
    const curveBarriersCount = 14
    for (let i = 0; i <= curveBarriersCount; i++) {
      const angle = (i / curveBarriersCount) * Math.PI
      // North bend outer wall post
      const nx = this.centerX + (outerR + 0.6) * Math.cos(angle)
      const nz = halfStraight + (outerR + 0.6) * Math.sin(angle)
      const nBarrier = new THREE.Mesh(new THREE.BoxGeometry(2.4, outerWallHeight, 3.8), this.barrierConcreteMat)
      nBarrier.position.set(nx, outerWallHeight / 2, nz)
      nBarrier.rotation.y = -angle
      this.root.add(nBarrier)
      colliders.push({
        minX: nx - 1.6,
        maxX: nx + 1.6,
        minZ: nz - 1.6,
        maxZ: nz + 1.6,
        minY: 0,
        maxY: outerWallHeight,
      })

      // South bend outer wall post
      const sAngle = Math.PI + angle
      const sx = this.centerX + (outerR + 0.6) * Math.cos(sAngle)
      const sz = -halfStraight + (outerR + 0.6) * Math.sin(sAngle)
      const sBarrier = new THREE.Mesh(new THREE.BoxGeometry(2.4, outerWallHeight, 3.8), this.barrierConcreteMat)
      sBarrier.position.set(sx, outerWallHeight / 2, sz)
      sBarrier.rotation.y = -sAngle
      this.root.add(sBarrier)
      colliders.push({
        minX: sx - 1.6,
        maxX: sx + 1.6,
        minZ: sz - 1.6,
        maxZ: sz + 1.6,
        minY: 0,
        maxY: outerWallHeight,
      })
    }

    // 5. Red & White Curbs (Zebras de Pista)
    for (let z = -halfStraight; z <= halfStraight; z += 4) {
      const isRed = Math.floor(z / 4) % 2 === 0
      const curbMat = isRed ? this.curbRedMat : this.curbWhiteMat
      // Inner East Curb
      const curbA = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 3.8), curbMat)
      curbA.position.set(this.centerX + innerR + 0.4, 0.06, z)
      this.root.add(curbA)
      // Inner West Curb
      const curbB = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 3.8), curbMat)
      curbB.position.set(this.centerX - innerR - 0.4, 0.06, z)
      this.root.add(curbB)
    }

    // 6. Start / Finish Line Checkered Strip & Overhead Gantry
    const startFinishLine = new THREE.Mesh(new THREE.PlaneGeometry(this.trackWidth, 3.2), this.curbWhiteMat)
    startFinishLine.rotation.x = -Math.PI / 2
    startFinishLine.position.set(this.centerX + this.curveRadius, 0.05, 0)
    this.root.add(startFinishLine)

    // Overhead Gantry across East Straight
    const gantry = new THREE.Group()
    const towerGeo = new THREE.BoxGeometry(0.6, 9.5, 0.6)
    const beamGeo = new THREE.BoxGeometry(this.trackWidth + 4, 1.2, 0.8)

    const towerLeft = new THREE.Mesh(towerGeo, this.fenceSteelMat)
    towerLeft.position.set(this.centerX + innerR - 0.5, 4.75, 0)
    gantry.add(towerLeft)

    const towerRight = new THREE.Mesh(towerGeo, this.fenceSteelMat)
    towerRight.position.set(this.centerX + outerR + 0.5, 4.75, 0)
    gantry.add(towerRight)

    const crossBeam = new THREE.Mesh(beamGeo, this.fenceSteelMat)
    crossBeam.position.set(this.centerX + this.curveRadius, 8.8, 0)
    gantry.add(crossBeam)

    // Overhead Digital Banner Sign
    const signGeo = new THREE.BoxGeometry(this.trackWidth - 2, 1.4, 0.2)
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0xfacc15,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    })
    const gantrySign = new THREE.Mesh(signGeo, signMat)
    gantrySign.position.set(this.centerX + this.curveRadius, 8.8, 0.5)
    gantry.add(gantrySign)

    this.root.add(gantry)

    // 7. Stadium Floodlight Towers (4 corners)
    const floodlightPositions = [
      { x: this.centerX + outerR + 6, z: halfStraight + 10 },
      { x: this.centerX - outerR - 6, z: halfStraight + 10 },
      { x: this.centerX + outerR + 6, z: -halfStraight - 10 },
      { x: this.centerX - outerR - 6, z: -halfStraight - 10 },
    ]
    const lightTowerGeo = new THREE.CylinderGeometry(0.35, 0.6, 22, 8)
    const lightHeadGeo = new THREE.BoxGeometry(4.5, 1.6, 1.2)
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c2, emissiveIntensity: 3.5 })

    for (const lp of floodlightPositions) {
      const pole = new THREE.Mesh(lightTowerGeo, this.fenceSteelMat)
      pole.position.set(lp.x, 11, lp.z)
      this.root.add(pole)

      const head = new THREE.Mesh(lightHeadGeo, this.fenceSteelMat)
      head.position.set(lp.x, 21.5, lp.z)
      head.lookAt(this.centerX, 0, lp.z > 0 ? halfStraight : -halfStraight)
      this.root.add(head)

      const bulb = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 0.1), bulbMat)
      bulb.position.set(lp.x, 21.5, lp.z + (lp.z > 0 ? -0.65 : 0.65))
      bulb.rotation.x = lp.z > 0 ? 0.3 : -0.3
      this.root.add(bulb)
    }

    // Register all barriers into City colliders
    this.city.addColliders(colliders)
  }

  // 4 Glowing Score Arches
  private buildScoreArches(): void {
    const archConfigs = [
      { id: 0, dist: 0, rotY: 0 },                                        // Start/Finish Straight (Z=0, heading North)
      { id: 1, dist: this.straightLength + (Math.PI * this.curveRadius * 0.75), rotY: Math.PI * 0.75 }, // North turn exit
      { id: 2, dist: this.straightLength + Math.PI * this.curveRadius + this.straightLength * 0.5, rotY: Math.PI }, // Back straight
      { id: 3, dist: this.straightLength * 2 + Math.PI * this.curveRadius + (Math.PI * this.curveRadius * 0.75), rotY: -Math.PI * 0.25 }, // South turn exit
    ]

    for (const cfg of archConfigs) {
      const transform = this.getTrackTransform(cfg.dist, 0)
      const group = new THREE.Group()
      group.position.copy(transform.position)
      group.rotation.y = transform.yaw

      // Arch Structure
      const archTruss = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.35, 8, 20, Math.PI), this.fenceSteelMat)
      archTruss.position.set(0, 0, 0)
      group.add(archTruss)

      // Glowing Neon Ring Arch
      const neonRing = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.22, 8, 24, Math.PI), this.archNeonMat)
      neonRing.position.set(0, 0, 0.1)
      group.add(neonRing)

      // Floating Score Emblem Sign: +500 PTS
      const signGroup = new THREE.Group()
      signGroup.position.set(0, 7.8, 0)

      const badgeGeo = new THREE.BoxGeometry(4.2, 1.2, 0.25)
      const badgeMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x38bdf8,
        emissiveIntensity: 2.2,
        roughness: 0.15,
      })
      const badge = new THREE.Mesh(badgeGeo, badgeMat)
      signGroup.add(badge)

      // Golden Ring Core in badge
      const starCore = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.12, 8, 16), new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 3.0,
      }))
      signGroup.add(starCore)
      group.add(signGroup)

      this.root.add(group)
      this.scoreArches.push({
        id: cfg.id,
        position: transform.position.clone(),
        rotationY: transform.yaw,
        mesh: group,
        neonMesh: neonRing,
        signMesh: badge,
        cooldownTimer: 0,
      })
    }
  }

  // 4 Glowing 3D Turbo Boost Pickups
  private buildTurboPickups(): void {
    const turboDists = [
      this.straightLength * 0.3,                                              // Front straight
      this.straightLength + Math.PI * this.curveRadius * 0.5,                  // North curve apex
      this.straightLength + Math.PI * this.curveRadius + this.straightLength * 0.7, // Back straight
      this.straightLength * 2 + Math.PI * this.curveRadius * 1.5,             // South curve apex
    ]

    turboDists.forEach((dist, idx) => {
      const transform = this.getTrackTransform(dist, (idx % 2 === 0 ? -3.5 : 3.5))
      const group = new THREE.Group()
      group.position.set(transform.position.x, 1.1, transform.position.z)

      // Turbo Canister Body
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 })
      const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 14), bodyMat)
      canister.rotation.z = Math.PI / 4
      group.add(canister)

      // Dual Jet Nozzles
      const nozzleMat = new THREE.MeshStandardMaterial({ color: 0xd97706, emissive: 0xf59e0b, emissiveIntensity: 2.5 })
      for (const nz of [-0.22, 0.22]) {
        const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 10), nozzleMat)
        nozzle.rotation.x = Math.PI
        nozzle.position.set(nz, -0.65, 0)
        group.add(nozzle)
      }

      // Spinning Glowing Lightning / Energy Ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 8, 20), this.turboEnergyMat)
      ring.rotation.x = Math.PI / 2
      group.add(ring)

      // Floating 3D Lightning Bolt Symbol
      const boltMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 3.5,
      })
      const boltTop = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.12), boltMat)
      boltTop.position.set(0.1, 0.25, 0)
      boltTop.rotation.z = -0.35
      group.add(boltTop)

      const boltBot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.12), boltMat)
      boltBot.position.set(-0.1, -0.15, 0)
      boltBot.rotation.z = -0.35
      group.add(boltBot)

      this.root.add(group)
      this.turboPickups.push({
        id: idx,
        position: transform.position.clone(),
        mesh: group,
        active: true,
        cooldownTimer: 0,
        spinSpeed: 2.8 + idx * 0.4,
      })
    })
  }

  // Spawn the 6 Distinct Rally Cars
  private spawnCompetitors(): void {
    const competitorConfigs = [
      { id: 1, name: 'Red Apex', number: 1, color: 0xef4444, baseSpeed: 34.5, startOffset: 0, lane: -3.5 },
      { id: 2, name: 'Blue Thunder', number: 7, color: 0x2563eb, baseSpeed: 33.8, startOffset: 25, lane: 3.5 },
      { id: 3, name: 'Green Viper', number: 23, color: 0x22c55e, baseSpeed: 34.0, startOffset: 50, lane: -2.0 },
      { id: 4, name: 'Orange Blaze', number: 44, color: 0xf97316, baseSpeed: 33.5, startOffset: 75, lane: 2.0 },
      { id: 5, name: 'Desert Gold', number: 88, color: 0xfacc15, baseSpeed: 33.0, startOffset: 100, lane: -3.8 },
      { id: 6, name: 'Cyber Violet', number: 99, color: 0xa855f7, baseSpeed: 34.2, startOffset: 125, lane: 3.8 },
    ]

    for (const cfg of competitorConfigs) {
      const car = new Car(this.scene, {
        kind: 'rally_car',
        color: cfg.color,
        playerControlled: false,
        police: false,
        scale: 1,
      })

      const dist = (this.straightLength * 0.2 + cfg.startOffset) % this.totalTrackLength
      const transform = this.getTrackTransform(dist, cfg.lane)
      car.root.position.copy(transform.position)
      car.yaw = transform.yaw
      car.speed = cfg.baseSpeed * 0.8

      this.competitors.push({
        id: cfg.id,
        car,
        name: cfg.name,
        number: cfg.number,
        colorHex: cfg.color,
        distanceAlongTrack: dist,
        lap: 1,
        laneOffset: cfg.lane,
        targetLaneOffset: cfg.lane,
        baseSpeed: cfg.baseSpeed,
        currentSpeed: cfg.baseSpeed,
        driftAngle: 0,
      })
    }
  }

  // Spawn a 7th Rally Car parked in the Paddock for the Player to take and drive
  private spawnPaddockCar(): void {
    this.paddockCar = new Car(this.scene, {
      kind: 'rally_car',
      color: 0x38bdf8, // Brilliant Cyan / Electric Blue WRC
      playerControlled: false,
      police: false,
      scale: 1,
    })
    this.paddockCar.root.position.set(this.centerX - 75, 0.08, 0)
    this.paddockCar.yaw = -Math.PI / 2 // Facing towards the track entrance

    // Floating entry beacon
    const beaconGeo = new THREE.RingGeometry(1.6, 2.2, 24)
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.2,
      side: THREE.DoubleSide,
    })
    this.paddockBeacon = new THREE.Mesh(beaconGeo, beaconMat)
    this.paddockBeacon.rotation.x = -Math.PI / 2
    this.paddockBeacon.position.set(this.centerX - 75, 0.12, 0)
    this.root.add(this.paddockBeacon)
  }

  update(dt: number, playerCar: Car, playerPos: THREE.Vector3): void {
    const time = performance.now() * 0.001

    // Check if player is inside the Rally Arena
    const distToCenter = Math.hypot(playerPos.x - this.centerX, playerPos.z - this.centerZ)
    this.playerInTrack = distToCenter < 165

    // 1. Update Arches (Pulsing Glow & Collision with Player)
    for (const arch of this.scoreArches) {
      if (arch.cooldownTimer > 0) {
        arch.cooldownTimer = Math.max(0, arch.cooldownTimer - dt)
        if (arch.cooldownTimer === 0) {
          ;(arch.neonMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x22d3ee)
        }
      }

      // Sine pulse on neon arch
      const intensity = 2.4 + Math.sin(time * 4 + arch.id) * 0.6
      ;(arch.neonMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity

      // Check collision with player
      if (arch.cooldownTimer <= 0) {
        const distToPlayer = playerPos.distanceTo(arch.position)
        if (distToPlayer < 9.5) {
          // Player collected score arch!
          arch.cooldownTimer = 1.8
          ;(arch.neonMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xfacc15)
          this.sound.effect('coin')
          this.sparks.emit(new THREE.Vector3(arch.position.x, 3.5, arch.position.z))
          this.onScoreCollected?.(500, 150)
        }
      }
    }

    // 2. Update Turbo Pickups (Spinning, Hovering, & Triggering Boost)
    for (const turbo of this.turboPickups) {
      if (!turbo.active) {
        turbo.cooldownTimer = Math.max(0, turbo.cooldownTimer - dt)
        if (turbo.cooldownTimer <= 0) {
          turbo.active = true
          turbo.mesh.visible = true
          turbo.mesh.scale.set(1, 1, 1)
        }
        continue
      }

      // Animation: spin and sinusoidal float
      turbo.mesh.rotation.y += turbo.spinSpeed * dt
      turbo.mesh.position.y = 1.1 + Math.sin(time * 3 + turbo.id) * 0.22

      // Check pickup by Player Car
      const distToPlayer = playerPos.distanceTo(turbo.position)
      if (distToPlayer < 4.2) {
        turbo.active = false
        turbo.cooldownTimer = 5.0
        turbo.mesh.visible = false

        playerCar.applyTurbo(3.2, 18)
        this.sound.effect('upgrade')
        this.sparks.emit(new THREE.Vector3(playerPos.x, 0.4, playerPos.z))
        this.onTurboCollected?.()
      }

      // Check pickup by AI Rally Cars
      for (const comp of this.competitors) {
        const distToComp = comp.car.root.position.distanceTo(turbo.position)
        if (distToComp < 4.0 && turbo.active) {
          turbo.active = false
          turbo.cooldownTimer = 5.0
          turbo.mesh.visible = false
          comp.car.applyTurbo(2.8, 16)
          comp.currentSpeed += 12
          this.sparks.emit(new THREE.Vector3(comp.car.root.position.x, 0.4, comp.car.root.position.z))
        }
      }
    }

    // 3. Update the 6 Rally Competitors (Racing AI, Dynamic Overtaking & Drifting)
    for (let i = 0; i < this.competitors.length; i++) {
      const comp = this.competitors[i]
      const car = comp.car

      // Speed modulation & Turbo
      if (car.turboTimer > 0) {
        comp.currentSpeed = Math.min(comp.baseSpeed * 1.45, comp.currentSpeed + 24 * dt)
      } else {
        comp.currentSpeed = THREE.MathUtils.lerp(comp.currentSpeed, comp.baseSpeed, dt * 2.2)
      }

      // Check distance to car ahead to perform lane overtake
      for (let j = 0; j < this.competitors.length; j++) {
        if (i === j) continue
        const other = this.competitors[j]
        let deltaDist = other.distanceAlongTrack - comp.distanceAlongTrack
        if (deltaDist < 0) deltaDist += this.totalTrackLength

        // If another car is 6-18 meters directly ahead, switch lane to overtake!
        if (deltaDist > 0 && deltaDist < 16 && Math.abs(comp.laneOffset - other.laneOffset) < 2.5) {
          comp.targetLaneOffset = comp.laneOffset > 0 ? -3.5 : 3.5
        }
      }

      // Smoothly steer between inner and outer racing line
      comp.laneOffset = THREE.MathUtils.lerp(comp.laneOffset, comp.targetLaneOffset, dt * 2.0)

      // Advance distance along track
      const prevDist = comp.distanceAlongTrack
      comp.distanceAlongTrack = (comp.distanceAlongTrack + comp.currentSpeed * dt) % this.totalTrackLength
      if (comp.distanceAlongTrack < prevDist) {
        comp.lap += 1
      }

      // Calculate new position and tangent along the track
      const transform = this.getTrackTransform(comp.distanceAlongTrack, comp.laneOffset)
      car.root.position.x = transform.position.x
      car.root.position.z = transform.position.z
      car.root.position.y = 0.08
      car.speed = comp.currentSpeed

      // Dynamic drift slide angle on curves
      const isCurving = Math.abs(transform.position.z) > this.straightLength / 2
      if (isCurving) {
        const driftDirection = transform.position.z > 0 ? 0.28 : -0.28
        comp.driftAngle = THREE.MathUtils.lerp(comp.driftAngle, driftDirection, dt * 4.5)
        // Emit tire drift sparks/dust
        if (Math.random() < 0.25) {
          this.sparks.emit(new THREE.Vector3(car.root.position.x, 0.1, car.root.position.z))
        }
      } else {
        comp.driftAngle = THREE.MathUtils.lerp(comp.driftAngle, 0, dt * 6)
      }

      car.yaw = transform.yaw + comp.driftAngle
      car.root.rotation.y = car.yaw

      // Spin wheels
      const wheelSpin = -comp.currentSpeed * dt / 0.38
      for (const wheel of car.wheels) {
        wheel.rotation.x += wheelSpin
      }

      // Check collision between this rally car and the Player Car
      const distToPlayerCar = car.root.position.distanceTo(playerCar.root.position)
      if (distToPlayerCar < 3.2) {
        car.collideWith(playerCar, dt)
        this.sound.effect('crash')
        this.sparks.emit(new THREE.Vector3((car.root.position.x + playerCar.root.position.x) / 2, 0.4, (car.root.position.z + playerCar.root.position.z) / 2))
      }
    }

    // 4. Update Player Race Progress & Leaderboard Position
    if (this.playerInTrack) {
      const prevPlayerDist = this.playerDistanceAlongTrack
      this.playerDistanceAlongTrack = this.getDistanceAlongTrack(playerPos)

      // Crossed Start/Finish Line (heading North at Z=0 on East lane)
      if (playerPos.x > this.centerX && prevPlayerDist > this.totalTrackLength - 40 && this.playerDistanceAlongTrack < 40) {
        this.playerLap += 1
        this.sound.effect('jump')
        this.onLapCompleted?.(this.playerLap, this.playerRacePosition)

        // Check if player won the 3-lap rally!
        if (this.playerLap > 3 && this.playerRacePosition === 1 && !this.playerHasWon) {
          this.playerHasWon = true
          this.onRaceWon?.(5000, 10000)
        }
      }

      // Calculate Player Race Ranking (1st to 7th place)
      let rank = 1
      for (const comp of this.competitors) {
        if (comp.lap > this.playerLap) {
          rank++
        } else if (comp.lap === this.playerLap && comp.distanceAlongTrack > this.playerDistanceAlongTrack) {
          rank++
        }
      }
      this.playerRacePosition = rank
    }

    // 5. Paddock Beacon Animation
    if (this.paddockBeacon) {
      this.paddockBeacon.rotation.z += dt * 1.5
      const s = 1 + Math.sin(time * 3) * 0.12
      this.paddockBeacon.scale.set(s, s, 1)
    }
  }

  // Returns competitor cars for Minimap drawing
  getCompetitors(): readonly RallyCompetitor[] {
    return this.competitors
  }

  getArches(): readonly RallyArch[] {
    return this.scoreArches
  }

  getTurbos(): readonly RallyTurboPickup[] {
    return this.turboPickups
  }

  dispose(): void {
    for (const comp of this.competitors) {
      comp.car.dispose()
    }
    this.competitors.length = 0
    this.paddockCar?.dispose()
    this.scene.remove(this.root)
  }
}
