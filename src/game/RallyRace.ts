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

  // Dimensões do Circuito nas Dunas a Leste (Circuito de 4.000 metros)
  readonly centerX = 1100
  readonly centerZ = 0
  readonly straightLength = 1215 // Retas de 1.215 metros
  readonly curveRadius = 250     // Curvas de 250 metros de raio (Total = 2*1215 + 2*PI*250 = 4.000,8m)
  readonly trackWidth = 18       // Pista de duas faixas com 18m de largura
  readonly totalTrackLength: number
  readonly finishLineDist: number

  // Entidades e Concorrentes
  readonly competitors: RallyCompetitor[] = []
  readonly scoreArches: RallyArch[] = []
  readonly turboPickups: RallyTurboPickup[] = []
  private rockBlocksMesh?: THREE.InstancedMesh

  // Estado da Missão e Corrida
  raceStarted = false
  raceEnded = false
  missionActive = false
  playerInTrack = false
  playerRallyCar: Car | null = null
  playerDistanceAlongTrack = 0
  playerLap = 1
  playerBestLap = 0
  playerLapTimer = 0
  playerRacePosition = 6
  playerHasWon = false
  hasPassedHalfway = false
  private lastRestrictedWarning = 0

  // Contador Regressivo (3, 2, 1, LARGADA!)
  isCountingDown = false
  countdownTimer = 0
  private lastCountdownNumber = -1
  currentArchIndex = 0
  prevPlayerZ = 10

  // Callbacks de Eventos
  onScoreCollected?: (points: number, cash: number) => void
  onTurboCollected?: () => void
  onLapCompleted?: (lap: number, position: number) => void
  onRaceWon?: (rewardCash: number, rewardPoints: number) => void
  onRaceLost?: (position: number) => void
  onRaceStarted?: () => void
  onRestrictedAccess?: () => void
  onCountdownTick?: (count: number) => void
  onCountdownGo?: () => void
  onMessage?: (msg: string) => void

  // Materiais da pista e elementos
  private readonly trackAsphaltMat = new THREE.MeshStandardMaterial({
    color: 0x221f1e, // Asfalto escuro de cascalho do deserto
    roughness: 0.92,
    metalness: 0.1,
  })
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
    emissiveIntensity: 3.2,
    roughness: 0.15,
  })
  private readonly turboEnergyMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xfbbf24,
    emissiveIntensity: 3.2,
    roughness: 0.12,
  })
  private readonly rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x78716c,
    roughness: 0.95,
    metalness: 0.05,
  })

  constructor(scene: THREE.Scene, city: City, sound: Sound, sparks: Sparks) {
    this.scene = scene
    this.city = city
    this.sound = sound
    this.sparks = sparks
    this.totalTrackLength = 2 * this.straightLength + 2 * Math.PI * this.curveRadius

    // Linha de chegada na reta Oeste (Z = 0, X = 850), bem em frente à via da ponte
    const halfStraight = this.straightLength / 2
    const curveLen = Math.PI * this.curveRadius
    this.finishLineDist = this.straightLength + curveLen + halfStraight

    this.scene.add(this.root)
    this.buildTrackEnvironment()
    this.buildRockBlocks()
    this.buildScoreArches()
    this.buildTurboPickups()
    this.spawnGridCompetitors()
  }

  isMissionActive(): boolean {
    return this.missionActive
  }

  // Converte distância ao longo do circuito (0 a totalTrackLength) em posição Vector3 e yaw
  getTrackTransform(distance: number, lateralOffset = 0): { position: THREE.Vector3; tangent: THREE.Vector3; yaw: number } {
    let s = ((distance % this.totalTrackLength) + this.totalTrackLength) % this.totalTrackLength
    const halfStraight = this.straightLength / 2
    const curveLen = Math.PI * this.curveRadius

    // Seção 1: Reta Leste (Z: -halfStraight -> +halfStraight, sentido Norte)
    if (s <= this.straightLength) {
      const z = -halfStraight + s
      const x = this.centerX + this.curveRadius + lateralOffset
      const duneY = this.city.getDuneHeightAt(x, z)
      return {
        position: new THREE.Vector3(x, Math.max(0.08, duneY + 0.08), z),
        tangent: new THREE.Vector3(0, 0, 1),
        yaw: Math.PI,
      }
    }
    s -= this.straightLength

    // Seção 2: Curva Norte (do Leste para o Oeste)
    if (s <= curveLen) {
      const angle = (s / curveLen) * Math.PI
      const r = this.curveRadius + lateralOffset
      const x = this.centerX + r * Math.cos(angle)
      const z = halfStraight + r * Math.sin(angle)
      const tanX = -Math.sin(angle)
      const tanZ = Math.cos(angle)
      const yaw = Math.atan2(-tanX, -tanZ)
      const duneY = this.city.getDuneHeightAt(x, z)
      return {
        position: new THREE.Vector3(x, Math.max(0.08, duneY + 0.08), z),
        tangent: new THREE.Vector3(tanX, 0, tanZ),
        yaw,
      }
    }
    s -= curveLen

    // Seção 3: Reta Oeste (Z: +halfStraight -> -halfStraight, sentido Sul)
    if (s <= this.straightLength) {
      const z = halfStraight - s
      const x = this.centerX - this.curveRadius - lateralOffset
      const duneY = this.city.getDuneHeightAt(x, z)
      return {
        position: new THREE.Vector3(x, Math.max(0.08, duneY + 0.08), z),
        tangent: new THREE.Vector3(0, 0, -1),
        yaw: 0,
      }
    }
    s -= this.straightLength

    // Seção 4: Curva Sul (do Oeste para o Leste)
    const angle = Math.PI + (s / curveLen) * Math.PI
    const r = this.curveRadius + lateralOffset
    const x = this.centerX + r * Math.cos(angle)
    const z = -halfStraight + r * Math.sin(angle)
    const tanX = -Math.sin(angle)
    const tanZ = Math.cos(angle)
    const yaw = Math.atan2(-tanX, -tanZ)
    const duneY = this.city.getDuneHeightAt(x, z)
    return {
      position: new THREE.Vector3(x, Math.max(0.08, duneY + 0.08), z),
      tangent: new THREE.Vector3(tanX, 0, tanZ),
      yaw,
    }
  }

  // Calcula a distância acumulada de qualquer coordenada mundial até o circuito
  getDistanceAlongTrack(worldPos: THREE.Vector3): number {
    const halfStraight = this.straightLength / 2
    const curveLen = Math.PI * this.curveRadius
    const dx = worldPos.x - this.centerX
    const z = worldPos.z

    if (z >= -halfStraight && z <= halfStraight) {
      if (dx >= 0) {
        return z + halfStraight
      } else {
        return this.straightLength + curveLen + (halfStraight - z)
      }
    }

    if (z > halfStraight) {
      const angle = Math.atan2(z - halfStraight, dx)
      const clampedAngle = THREE.MathUtils.clamp(angle, 0, Math.PI)
      return this.straightLength + (clampedAngle / Math.PI) * curveLen
    }

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
    const westTrackX = this.centerX - this.curveRadius

    // 1. Asfalto das retas
    // Reta Leste
    const eastTrack = new THREE.Mesh(new THREE.PlaneGeometry(this.trackWidth, this.straightLength), this.trackAsphaltMat)
    eastTrack.rotation.x = -Math.PI / 2
    eastTrack.position.set(this.centerX + this.curveRadius, 0.04, 0)
    eastTrack.receiveShadow = true
    this.root.add(eastTrack)

    // Reta Oeste
    const westTrack = new THREE.Mesh(new THREE.PlaneGeometry(this.trackWidth, this.straightLength), this.trackAsphaltMat)
    westTrack.rotation.x = -Math.PI / 2
    westTrack.position.set(westTrackX, 0.04, 0)
    westTrack.receiveShadow = true
    this.root.add(westTrack)

    // Curvas Norte e Sul
    const curveSegments = 36
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

    // 2. Via de acesso que conecta a ponte da cidade (X=720, Z=0) à Linha de Chegada na Reta Oeste
    const accessRoad = new THREE.Mesh(new THREE.PlaneGeometry(westTrackX - 720 + 2, 16), this.trackAsphaltMat)
    accessRoad.rotation.x = -Math.PI / 2
    accessRoad.position.set((720 + westTrackX) / 2, 0.035, 0)
    accessRoad.receiveShadow = true
    this.root.add(accessRoad)

    // 3. GRADE ENTRE AS PISTAS (Divisória central com tela de aço e defensas)
    const fenceGroup = new THREE.Group()
    const fenceHeight = 3.2
    const postGeo = new THREE.CylinderGeometry(0.14, 0.14, fenceHeight, 8)
    const railGeo = new THREE.BoxGeometry(0.12, 0.22, 6.0)
    const meshPanelGeo = new THREE.BoxGeometry(0.08, fenceHeight - 0.4, 5.8)

    for (let z = -halfStraight - 4; z <= halfStraight + 4; z += 6) {
      const post = new THREE.Mesh(postGeo, this.fenceSteelMat)
      post.position.set(this.centerX, fenceHeight / 2, z)
      post.castShadow = true
      fenceGroup.add(post)

      if (z <= halfStraight) {
        const topRail = new THREE.Mesh(railGeo, this.fenceSteelMat)
        topRail.position.set(this.centerX, fenceHeight - 0.2, z + 3)
        fenceGroup.add(topRail)

        const wireMesh = new THREE.Mesh(meshPanelGeo, this.wireMeshMat)
        wireMesh.position.set(this.centerX, fenceHeight / 2, z + 3)
        fenceGroup.add(wireMesh)
      }
    }

    const medianBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, this.straightLength + 12), this.barrierConcreteMat)
    medianBase.position.set(this.centerX, 0.22, 0)
    medianBase.castShadow = true
    fenceGroup.add(medianBase)
    this.root.add(fenceGroup)

    colliders.push({
      minX: this.centerX - 1.2,
      maxX: this.centerX + 1.2,
      minZ: -halfStraight - 8,
      maxZ: halfStraight + 8,
      minY: 0,
      maxY: fenceHeight + 1.5,
    })

    // 4. Barreiras externas nas retas
    const outerWallHeight = 1.8
    // Barreira da Reta Leste
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

    // Barreira da Reta Oeste (com abertura suave em Z=0 para conexão da ponte)
    for (const zSide of [-1, 1]) {
      const partLen = (this.straightLength - 28) / 2
      const wz = zSide * (14 + partLen / 2)
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

    // 5. LINHA DE CHEGADA E PÓRTICO (Start/Finish Line Checkered Strip & Overhead Gantry)
    // Posicionada na RETA OESTE (Z = 0, X = westTrackX), bem em frente à via da ponte!
    const startFinishLine = new THREE.Mesh(new THREE.PlaneGeometry(this.trackWidth, 4.0), this.curbWhiteMat)
    startFinishLine.rotation.x = -Math.PI / 2
    startFinishLine.position.set(westTrackX, 0.05, 0)
    this.root.add(startFinishLine)

    // Linhas quadriculadas pretas na faixa de chegada
    for (let c = -this.trackWidth / 2 + 1; c < this.trackWidth / 2; c += 2) {
      const checkBlock = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 4.0), this.trackAsphaltMat)
      checkBlock.rotation.x = -Math.PI / 2
      checkBlock.position.set(westTrackX + c, 0.052, 0)
      this.root.add(checkBlock)
    }

    // Pórtico aéreo monumental sobre a linha de chegada
    const gantry = new THREE.Group()
    const towerGeo = new THREE.BoxGeometry(0.8, 12.0, 0.8)
    const beamGeo = new THREE.BoxGeometry(this.trackWidth + 6, 1.6, 1.2)

    const towerLeft = new THREE.Mesh(towerGeo, this.fenceSteelMat)
    towerLeft.position.set(westTrackX - this.trackWidth / 2 - 1.2, 6.0, 0)
    gantry.add(towerLeft)

    const towerRight = new THREE.Mesh(towerGeo, this.fenceSteelMat)
    towerRight.position.set(westTrackX + this.trackWidth / 2 + 1.2, 6.0, 0)
    gantry.add(towerRight)

    const crossBeam = new THREE.Mesh(beamGeo, this.fenceSteelMat)
    crossBeam.position.set(westTrackX, 11.2, 0)
    gantry.add(crossBeam)

    // Painel digital luminoso no pórtico
    const signGeo = new THREE.BoxGeometry(this.trackWidth - 1, 2.0, 0.3)
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0xfacc15,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    })
    const gantrySign = new THREE.Mesh(signGeo, signMat)
    gantrySign.position.set(westTrackX, 11.2, 0.7)
    gantry.add(gantrySign)

    this.root.add(gantry)

    // 6. Torres de Iluminação Stadium Floodlights
    const floodlightPositions = [
      { x: this.centerX + outerR + 8, z: halfStraight + 15 },
      { x: this.centerX - outerR - 8, z: halfStraight + 15 },
      { x: this.centerX + outerR + 8, z: -halfStraight - 15 },
      { x: this.centerX - outerR - 8, z: -halfStraight - 15 },
    ]
    const lightTowerGeo = new THREE.CylinderGeometry(0.35, 0.6, 26, 8)
    const lightHeadGeo = new THREE.BoxGeometry(5.0, 1.8, 1.2)
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c2, emissiveIntensity: 3.5 })

    for (const lp of floodlightPositions) {
      const pole = new THREE.Mesh(lightTowerGeo, this.fenceSteelMat)
      pole.position.set(lp.x, 13, lp.z)
      this.root.add(pole)

      const head = new THREE.Mesh(lightHeadGeo, this.fenceSteelMat)
      head.position.set(lp.x, 25.5, lp.z)
      head.lookAt(this.centerX, 0, lp.z > 0 ? halfStraight : -halfStraight)
      this.root.add(head)

      const bulb = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 0.1), bulbMat)
      bulb.position.set(lp.x, 25.5, lp.z + (lp.z > 0 ? -0.65 : 0.65))
      this.root.add(bulb)
    }

    this.city.addColliders(colliders)
  }

  // Adiciona blocos de pedra nas laterais dos dois quilômetros de pista e no topo das dunas
  private buildRockBlocks(): void {
    const halfStraight = this.straightLength / 2
    const outerR = this.curveRadius + this.trackWidth / 2
    const innerR = this.curveRadius - this.trackWidth / 2

    // InstancedMesh de blocos de rocha natural (alta performance: 1 draw call para todas as pedras!)
    const rockCount = 520
    const rockGeo = new THREE.DodecahedronGeometry(1.6, 0)
    this.rockBlocksMesh = new THREE.InstancedMesh(rockGeo, this.rockMaterial, rockCount)
    this.rockBlocksMesh.castShadow = true
    this.rockBlocksMesh.receiveShadow = true

    const dummy = new THREE.Object3D()
    let instanceIndex = 0

    // 1. Pedras ao longo das laterais esquerda e direita das retas (mais de 2 quilômetros totais de pista)
    for (let z = -halfStraight; z <= halfStraight; z += 24) {
      if (instanceIndex >= rockCount - 160) break

      // Lateral Direita da Reta Leste
      dummy.position.set(this.centerX + outerR + 4.2 + (Math.sin(z * 0.1) * 2.2), 0.8, z)
      const scaleA = 0.9 + Math.abs(Math.sin(z * 0.35)) * 1.5
      dummy.scale.set(scaleA, scaleA * 0.85, scaleA)
      dummy.rotation.set(z * 0.2, z * 0.5, 0)
      dummy.updateMatrix()
      this.rockBlocksMesh.setMatrixAt(instanceIndex++, dummy.matrix)

      // Lateral Esquerda da Reta Leste
      dummy.position.set(this.centerX + innerR - 3.8 + (Math.cos(z * 0.15) * 1.8), 0.7, z)
      const scaleB = 0.8 + Math.abs(Math.cos(z * 0.25)) * 1.3
      dummy.scale.set(scaleB, scaleB * 0.9, scaleB)
      dummy.rotation.set(z * 0.1, z * 0.3, 0)
      dummy.updateMatrix()
      this.rockBlocksMesh.setMatrixAt(instanceIndex++, dummy.matrix)

      // Lateral Externa da Reta Oeste (exceto na abertura da ponte em Z=0)
      if (Math.abs(z) > 16) {
        dummy.position.set(this.centerX - outerR - 4.5 + (Math.sin(z * 0.2) * 2.0), 0.8, z)
        const scaleC = 1.0 + Math.abs(Math.sin(z * 0.4)) * 1.4
        dummy.scale.set(scaleC, scaleC * 0.85, scaleC)
        dummy.rotation.set(z * 0.3, z * 0.2, 0)
        dummy.updateMatrix()
        this.rockBlocksMesh.setMatrixAt(instanceIndex++, dummy.matrix)
      }

      // Lateral Interna da Reta Oeste
      dummy.position.set(this.centerX - innerR + 3.8 + (Math.cos(z * 0.3) * 1.6), 0.7, z)
      const scaleD = 0.85 + Math.abs(Math.sin(z * 0.25)) * 1.2
      dummy.scale.set(scaleD, scaleD * 0.8, scaleD)
      dummy.rotation.set(z * 0.15, z * 0.4, 0)
      dummy.updateMatrix()
      this.rockBlocksMesh.setMatrixAt(instanceIndex++, dummy.matrix)
    }

    // 1b. Pedras nas Curvas Norte e Sul (Lado direito e esquerdo ao longo das curvas)
    const curveSteps = 24
    for (let c = 0; c < curveSteps; c++) {
      if (instanceIndex >= rockCount - 60) break
      const angle = (c / curveSteps) * Math.PI

      // Curva Norte (Z positivo)
      for (const sideSign of [-1, 1]) {
        const rad = this.curveRadius + sideSign * (this.trackWidth / 2 + 3.5)
        const cx = this.centerX + rad * Math.cos(angle)
        const cz = halfStraight + rad * Math.sin(angle)
        const duneY = this.city.getDuneHeightAt(cx, cz)
        dummy.position.set(cx, Math.max(0.8, duneY + 0.8), cz)
        const sc = 1.0 + (c % 3) * 0.4
        dummy.scale.set(sc, sc * 0.85, sc)
        dummy.rotation.set(c * 0.4, angle, 0)
        dummy.updateMatrix()
        this.rockBlocksMesh.setMatrixAt(instanceIndex++, dummy.matrix)
      }

      // Curva Sul (Z negativo)
      const angleSouth = Math.PI + (c / curveSteps) * Math.PI
      for (const sideSign of [-1, 1]) {
        const rad = this.curveRadius + sideSign * (this.trackWidth / 2 + 3.5)
        const cx = this.centerX + rad * Math.cos(angleSouth)
        const cz = -halfStraight + rad * Math.sin(angleSouth)
        const duneY = this.city.getDuneHeightAt(cx, cz)
        dummy.position.set(cx, Math.max(0.8, duneY + 0.8), cz)
        const sc = 1.0 + (c % 3) * 0.4
        dummy.scale.set(sc, sc * 0.85, sc)
        dummy.rotation.set(c * 0.4, angleSouth, 0)
        dummy.updateMatrix()
        this.rockBlocksMesh.setMatrixAt(instanceIndex++, dummy.matrix)
      }
    }

    // 2. Pedras em cima das dunas de areia centrais e periféricas, incluindo o lado direito da pista
    const dunePoints = [
      { x: this.centerX - 120, z: -250, y: 5.5 },
      { x: this.centerX - 80, z: 180, y: 6.2 },
      { x: this.centerX + 110, z: -320, y: 7.0 },
      { x: this.centerX + 90, z: 280, y: 5.8 },
      { x: this.centerX, z: 0, y: 4.8 },
      { x: this.centerX - 60, z: -480, y: 6.5 },
      { x: this.centerX + 70, z: 450, y: 6.0 },
      { x: this.centerX - 140, z: 40, y: 5.2 },
      { x: this.centerX + 130, z: -80, y: 5.5 },
      // Dunas adicionais específicas no lado direito da pista (East side)
      { x: this.centerX + outerR + 25, z: -600, y: 8.5 },
      { x: this.centerX + outerR + 30, z: -300, y: 9.0 },
      { x: this.centerX + outerR + 28, z: 0, y: 8.0 },
      { x: this.centerX + outerR + 32, z: 300, y: 9.2 },
      { x: this.centerX + outerR + 26, z: 600, y: 8.8 },
    ]

    for (const dp of dunePoints) {
      for (let r = 0; r < 14; r++) {
        if (instanceIndex >= rockCount) break
        const angle = (r / 14) * Math.PI * 2
        const rad = 6 + (r % 4) * 5
        const rx = dp.x + Math.cos(angle) * rad
        const rz = dp.z + Math.sin(angle) * rad
        const duneY = this.city.getDuneHeightAt(rx, rz)
        const ry = Math.max(dp.y + (Math.sin(r * 2.1) * 1.8), duneY + 0.8)

        dummy.position.set(rx, ry, rz)
        const s = 1.2 + Math.abs(Math.sin(r * 1.7)) * 2.2
        dummy.scale.set(s, s * 0.9, s * 1.1)
        dummy.rotation.set(r * 0.5, angle, r * 0.3)
        dummy.updateMatrix()
        this.rockBlocksMesh.setMatrixAt(instanceIndex++, dummy.matrix)
      }
    }

    this.rockBlocksMesh.instanceMatrix.needsUpdate = true
    this.root.add(this.rockBlocksMesh)
  }

  // Arcos do circuito em ordem obrigatória ao longo da pista (Sentido horário / setindo da pista)
  private buildScoreArches(): void {
    const curveLen = Math.PI * this.curveRadius

    const archConfigs = [
      { id: 0, dist: this.finishLineDist, rotY: 0 },                                                           // 1. Linha de Chegada / Reta Oeste (Z=0)
      { id: 1, dist: this.straightLength + (curveLen * 0.05), rotY: Math.PI * 0.5 },                            // 2. Início da Curva Norte
      { id: 2, dist: this.straightLength + (curveLen * 0.95), rotY: Math.PI },                                  // 3. Fim da Curva Norte
      { id: 3, dist: this.straightLength + curveLen + (this.straightLength * 0.5), rotY: Math.PI },             // 4. Reta Leste
      { id: 4, dist: this.straightLength * 2 + curveLen + (curveLen * 0.5), rotY: -Math.PI * 0.5 },             // 5. Curva Sul
    ]

    const archRadius = 14.0 // Raio monumental aumentado cobrindo toda a pista de 18m com folga

    for (const cfg of archConfigs) {
      const transform = this.getTrackTransform(cfg.dist, 0)
      const group = new THREE.Group()
      group.position.copy(transform.position)
      group.rotation.y = transform.yaw

      // Estrutura de treliça de aço aumentada
      const archTruss = new THREE.Mesh(new THREE.TorusGeometry(archRadius, 0.55, 8, 28, Math.PI), this.fenceSteelMat)
      archTruss.position.set(0, 0, 0)
      group.add(archTruss)

      // Arco Neon iluminado aumentado
      const neonRing = new THREE.Mesh(new THREE.TorusGeometry(archRadius - 0.35, 0.32, 8, 32, Math.PI), this.archNeonMat)
      neonRing.position.set(0, 0, 0.15)
      group.add(neonRing)

      // Bases de sustentação reforçadas nos pilares
      const baseGeo = new THREE.BoxGeometry(2.4, 2.0, 2.4)
      for (const sideX of [-archRadius, archRadius]) {
        const pillarBase = new THREE.Mesh(baseGeo, this.barrierConcreteMat)
        pillarBase.position.set(sideX, 1.0, 0)
        group.add(pillarBase)
      }

      // Emblema e Placa Superior Flutuante Aumentada: RALLY DUEL +500 PTS
      const signGroup = new THREE.Group()
      signGroup.position.set(0, archRadius - 0.8, 0)

      const badgeGeo = new THREE.BoxGeometry(6.8, 1.8, 0.35)
      const badgeMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x38bdf8,
        emissiveIntensity: 2.4,
        roughness: 0.15,
      })
      const badge = new THREE.Mesh(badgeGeo, badgeMat)
      signGroup.add(badge)

      // Anel dourado gigante central
      const starCore = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.18, 8, 20), new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 3.2,
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

  // 4 Coletas de Turbo Boost em formato de foguete
  private buildTurboPickups(): void {
    const turboDists = [
      this.straightLength * 0.3,
      this.straightLength + Math.PI * this.curveRadius * 0.5,
      this.straightLength + Math.PI * this.curveRadius + this.straightLength * 0.7,
      this.straightLength * 2 + Math.PI * this.curveRadius * 1.5,
    ]

    turboDists.forEach((dist, idx) => {
      const transform = this.getTrackTransform(dist, (idx % 2 === 0 ? -3.5 : 3.5))
      const group = new THREE.Group()
      group.position.set(transform.position.x, 1.2, transform.position.z)

      // Foguete 3D com bico cônico e aletas
      const rocketBodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 })
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.4, 12), rocketBodyMat)
      group.add(body)

      const coneMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2, metalness: 0.4 })
      const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.75, 12), coneMat)
      noseCone.position.set(0, 1.05, 0)
      group.add(noseCone)

      // Aletas traseiras do foguete
      const finGeo = new THREE.BoxGeometry(0.08, 0.5, 0.35)
      for (let f = 0; f < 4; f++) {
        const fin = new THREE.Mesh(finGeo, coneMat)
        fin.rotation.y = (f * Math.PI) / 2
        fin.position.set(Math.cos((f * Math.PI) / 2) * 0.35, -0.45, Math.sin((f * Math.PI) / 2) * 0.35)
        group.add(fin)
      }

      // Anel de plasma de propulsão
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 8, 20), this.turboEnergyMat)
      ring.rotation.x = Math.PI / 2
      ring.position.set(0, -0.65, 0)
      group.add(ring)

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

  // Posiciona todos os 6 carros de rally elétrico perfilados na linha de chegada:
  // Sendo duas filas de 3 carros parados em cada fila!
  private spawnGridCompetitors(): void {
    const competitorConfigs = [
      // Fila 1 (Esquerda / Interior, lane = -3.5)
      { id: 1, name: 'Red Apex EV', number: 1, color: 0xef4444, baseSpeed: 34.5, row: 0, lane: -3.5, distOffset: -4 },
      { id: 3, name: 'Green Viper EV', number: 23, color: 0x22c55e, baseSpeed: 34.0, row: 1, lane: -3.5, distOffset: -18 },
      { id: 5, name: 'Desert Gold EV', number: 88, color: 0xfacc15, baseSpeed: 33.2, row: 2, lane: -3.5, distOffset: -32 },

      // Fila 2 (Direita / Exterior, lane = +3.5)
      { id: 2, name: 'Blue Thunder EV', number: 7, color: 0x2563eb, baseSpeed: 34.0, row: 0, lane: 3.5, distOffset: -10 },
      { id: 4, name: 'Orange Blaze EV', number: 44, color: 0xf97316, baseSpeed: 33.6, row: 1, lane: 3.5, distOffset: -24 },
      { id: 6, name: 'Cyber Violet EV', number: 99, color: 0xa855f7, baseSpeed: 34.4, row: 2, lane: 3.5, distOffset: -38 },
    ]

    for (const cfg of competitorConfigs) {
      const car = new Car(this.scene, {
        kind: 'rally_car',
        color: cfg.color,
        playerControlled: false,
        police: false,
        scale: 1,
      })

      // Posicionados antes da linha de chegada na reta Oeste (próximo à via da ponte)
      const dist = (this.finishLineDist + cfg.distOffset + this.totalTrackLength) % this.totalTrackLength
      const transform = this.getTrackTransform(dist, cfg.lane)
      car.root.position.copy(transform.position)
      car.yaw = transform.yaw
      car.speed = 0 // Todos os carros começam 100% PARADOS na linha de chegada

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
        currentSpeed: 0, // Parados esperando o início da corrida
        driftAngle: 0,
      })
    }
  }

  // Inicia o contador regressivo (3, 2, 1, LARGADA!) quando o jogador entra no carro de rally nas dunas
  startCountdownWithPlayerCar(selectedCar: Car): void {
    if (this.raceStarted || this.isCountingDown || this.raceEnded) return

    this.playerRallyCar = selectedCar
    this.isCountingDown = true
    this.countdownTimer = 3.6
    this.lastCountdownNumber = 3
    this.playerLap = 1
    this.playerHasWon = false
    this.raceStarted = false
    this.raceEnded = false
    this.hasPassedHalfway = false

    selectedCar.speed = 0

    // Identifica e remove o carro assumido da lista de concorrentes IA (restando 5 concorrentes IA rivais)
    const takenIndex = this.competitors.findIndex(c => c.car === selectedCar)
    if (takenIndex !== -1) {
      this.competitors.splice(takenIndex, 1)
    }

    // Todos os carros ficam 100% parados esperando o contador regressivo terminar
    for (const comp of this.competitors) {
      comp.currentSpeed = 0
      comp.car.speed = 0
    }

    this.sound.effect('jump')
    this.onCountdownTick?.(3)
  }

  // Alias para compatibilidade
  startRaceWithPlayerCar(selectedCar: Car): void {
    this.startCountdownWithPlayerCar(selectedCar)
  }

  update(dt: number, playerCar: Car, playerPos: THREE.Vector3): void {
    const time = performance.now() * 0.001

    // Verifica se o jogador está na arena do Rally (cobre todo o circuito oval, retas e curvas)
    const inTrackX = Math.abs(playerPos.x - this.centerX) < (this.curveRadius + 150)
    const inTrackZ = Math.abs(playerPos.z - this.centerZ) < (this.straightLength / 2 + this.curveRadius + 150)
    this.playerInTrack = inTrackX && inTrackZ

    // Se o jogador estiver na pista mas NÃO estiver em um carro de rally elétrico
    if (this.playerInTrack && playerCar.kind !== 'rally_car') {
      if (time - this.lastRestrictedWarning > 4.5) {
        this.lastRestrictedWarning = time
        this.onRestrictedAccess?.()
      }
    }

    // Se o jogador estiver em um carro de rally e a corrida ainda não iniciou e não está contando, inicia o contador regressivo!
    if (playerCar.kind === 'rally_car' && !this.raceStarted && !this.isCountingDown && !this.raceEnded && this.playerInTrack) {
      this.startCountdownWithPlayerCar(playerCar)
    }

    // Se a corrida já foi finalizada, garante que todos os carros permaneçam 100% parados
    if (this.raceEnded) {
      if (playerCar.kind === 'rally_car') {
        playerCar.speed = 0
      }
      for (const comp of this.competitors) {
        comp.baseSpeed = 0
        comp.currentSpeed = 0
        comp.car.speed = 0
      }
      return
    }

    // Contador Regressivo (3, 2, 1, LARGADA!): carros de rally NÃO se movimentam enquanto o contador não acabar
    if (this.isCountingDown) {
      this.countdownTimer -= dt
      if (playerCar.kind === 'rally_car') {
        playerCar.speed = 0
      }
      for (const comp of this.competitors) {
        comp.currentSpeed = 0
        comp.car.speed = 0
      }

      let currentCount = 1
      if (this.countdownTimer > 2.4) {
        currentCount = 3
      } else if (this.countdownTimer > 1.2) {
        currentCount = 2
      } else if (this.countdownTimer > 0) {
        currentCount = 1
      } else {
        currentCount = 0 // LARGADA!
      }

      if (currentCount !== this.lastCountdownNumber) {
        this.lastCountdownNumber = currentCount
        if (currentCount > 0) {
          this.sound.effect('jump')
          this.onCountdownTick?.(currentCount)
        } else {
          // Contador regressivo acabou! Todos os carros de rally começam a se movimentar!
          this.isCountingDown = false
          this.raceStarted = true
          this.missionActive = true
          this.sound.effect('upgrade')
          this.onCountdownGo?.()
          this.onRaceStarted?.()
          for (const comp of this.competitors) {
            comp.currentSpeed = comp.baseSpeed * 0.85
          }
        }
      }
      return
    }

    // 1. Atualização dos Arcos de Pontuação
    for (const arch of this.scoreArches) {
      if (arch.cooldownTimer > 0) {
        arch.cooldownTimer = Math.max(0, arch.cooldownTimer - dt)
        if (arch.cooldownTimer === 0) {
          ;(arch.neonMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x22d3ee)
        }
      }

      const intensity = 2.4 + Math.sin(time * 4 + arch.id) * 0.6
      ;(arch.neonMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity

      if (arch.cooldownTimer <= 0 && playerCar.kind === 'rally_car') {
        const distToPlayer = playerPos.distanceTo(arch.position)
        if (distToPlayer < 12.0) {
          if (arch.id === this.currentArchIndex) {
            arch.cooldownTimer = 2.0
            ;(arch.neonMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xfacc15)
            this.sound.effect('coin')
            this.sparks.emit(new THREE.Vector3(arch.position.x, 4.2, arch.position.z))
            this.onScoreCollected?.(500, 200)
            this.currentArchIndex = (this.currentArchIndex + 1) % this.scoreArches.length
            this.onMessage?.(`✅ ARCO ${arch.id + 1} PASSED!`)
          } else {
            this.onMessage?.(`❌ WRONG ARCH! Pass through Arch ${this.currentArchIndex + 1} first.`)
          }
        }
      }
    }

    // 2. Coletas de Turbo Boost
    for (const turbo of this.turboPickups) {
      if (!turbo.active) {
        turbo.cooldownTimer = Math.max(0, turbo.cooldownTimer - dt)
        if (turbo.cooldownTimer <= 0) {
          turbo.active = true
          turbo.mesh.visible = true
        }
        continue
      }

      turbo.mesh.rotation.y += turbo.spinSpeed * dt
      turbo.mesh.position.y = 1.2 + Math.sin(time * 3 + turbo.id) * 0.25

      if (playerCar.kind === 'rally_car') {
        const distToPlayer = playerPos.distanceTo(turbo.position)
        if (distToPlayer < 4.2) {
          turbo.active = false
          turbo.cooldownTimer = 5.0
          turbo.mesh.visible = false

          playerCar.applyTurbo(3.5, 20)
          this.sound.effect('upgrade')
          this.sparks.emit(new THREE.Vector3(playerPos.x, 0.4, playerPos.z))
          this.onTurboCollected?.()
        }
      }

      if (this.raceStarted) {
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
    }

    // 3. Atualização dos Concorrentes de Rally (Física precisa de subida e descida nas dunas)
    if (this.raceStarted && !this.raceEnded) {
      for (let i = 0; i < this.competitors.length; i++) {
        const comp = this.competitors[i]
        const car = comp.car

        if (car.turboTimer > 0) {
          comp.currentSpeed = Math.min(comp.baseSpeed * 1.45, comp.currentSpeed + 24 * dt)
        } else {
          comp.currentSpeed = THREE.MathUtils.lerp(comp.currentSpeed, comp.baseSpeed, dt * 2.2)
        }

        // Ultrapassagens dinâmicas entre competidores
        for (let j = 0; j < this.competitors.length; j++) {
          if (i === j) continue
          const other = this.competitors[j]
          let deltaDist = other.distanceAlongTrack - comp.distanceAlongTrack
          if (deltaDist < 0) deltaDist += this.totalTrackLength

          if (deltaDist > 0 && deltaDist < 18 && Math.abs(comp.laneOffset - other.laneOffset) < 2.5) {
            comp.targetLaneOffset = comp.laneOffset > 0 ? -3.5 : 3.5
          }
        }

        comp.laneOffset = THREE.MathUtils.lerp(comp.laneOffset, comp.targetLaneOffset, dt * 2.0)

        const prevDist = comp.distanceAlongTrack
        comp.distanceAlongTrack = (comp.distanceAlongTrack + comp.currentSpeed * dt) % this.totalTrackLength
        if (prevDist < this.finishLineDist && comp.distanceAlongTrack >= this.finishLineDist) {
          comp.lap += 1
        }

        const transform = this.getTrackTransform(comp.distanceAlongTrack, comp.laneOffset)
        car.root.position.x = transform.position.x
        car.root.position.z = transform.position.z

        // Física de elevação e subida nas dunas de areia:
        // Amostra múltiplos pontos em volta do carro (frente, centro, traseira, lados)
        // para garantir que o carro NUNCA entre ou afunde na duna, mas suba suavemente por cima
        const forwardX = -Math.sin(transform.yaw)
        const forwardZ = -Math.cos(transform.yaw)
        const rightX = Math.cos(transform.yaw)
        const rightZ = -Math.sin(transform.yaw)

        const centerDuneY = this.city.getDuneHeightAt(transform.position.x, transform.position.z)
        const frontDuneY = this.city.getDuneHeightAt(transform.position.x + forwardX * 2.2, transform.position.z + forwardZ * 2.2)
        const backDuneY = this.city.getDuneHeightAt(transform.position.x - forwardX * 2.2, transform.position.z - forwardZ * 2.2)
        const leftDuneY = this.city.getDuneHeightAt(transform.position.x - rightX * 1.1, transform.position.z - rightZ * 1.1)
        const rightDuneY = this.city.getDuneHeightAt(transform.position.x + rightX * 1.1, transform.position.z + rightZ * 1.1)

        const maxDuneHeight = Math.max(centerDuneY, frontDuneY, backDuneY, leftDuneY, rightDuneY)
        car.groundElevation = maxDuneHeight
        // Mantém as rodas e chassi firmemente sobre o topo das dunas de areia
        car.root.position.y = Math.max(0.18, maxDuneHeight + 0.18 + car.climbLift)
        car.speed = comp.currentSpeed

        // Inclinação realista (pitch e roll) nas dunas
        car.root.rotation.order = 'YXZ'
        const dunePitch = Math.atan2(frontDuneY - backDuneY, 4.4)
        const duneRoll = Math.atan2(leftDuneY - rightDuneY, 2.2)
        car.dunePitch = dunePitch
        car.root.rotation.x = THREE.MathUtils.lerp(car.root.rotation.x, dunePitch, Math.min(1, dt * 10))

        const isCurving = Math.abs(transform.position.z) > this.straightLength / 2
        if (isCurving) {
          const driftDirection = transform.position.z > 0 ? 0.28 : -0.28
          comp.driftAngle = THREE.MathUtils.lerp(comp.driftAngle, driftDirection, dt * 4.5)
          if (Math.random() < 0.2) {
            this.sparks.emit(new THREE.Vector3(car.root.position.x, car.root.position.y + 0.1, car.root.position.z))
          }
        } else {
          comp.driftAngle = THREE.MathUtils.lerp(comp.driftAngle, 0, dt * 6)
        }

        car.yaw = transform.yaw + comp.driftAngle
        car.root.rotation.y = car.yaw
        car.root.rotation.z = THREE.MathUtils.lerp(car.root.rotation.z, Math.sin(comp.driftAngle) * 0.15 + duneRoll * 0.6, Math.min(1, dt * 10))

        const wheelSpin = -comp.currentSpeed * dt / 0.38
        for (const wheel of car.wheels) {
          wheel.rotation.x += wheelSpin
        }

        const distToPlayerCar = car.root.position.distanceTo(playerCar.root.position)
        if (distToPlayerCar < 3.2) {
          car.collideWith(playerCar, dt)
          this.sound.effect('crash')
          this.sparks.emit(new THREE.Vector3((car.root.position.x + playerCar.root.position.x) / 2, car.root.position.y + 0.4, (car.root.position.z + playerCar.root.position.z) / 2))
        }
      }
    }

    // 4. Progresso de Corrida e Ranking do Jogador (Apenas com carro de rally elétrico!)
    if (this.playerInTrack && playerCar.kind === 'rally_car') {
      const prevPlayerDist = this.playerDistanceAlongTrack
      this.playerDistanceAlongTrack = this.getDistanceAlongTrack(playerPos)

      // Jogador deve passar pela metade oposta da pista (Reta Leste, X > centerX) antes de poder fechar uma volta
      if (playerPos.x > this.centerX + 40 || (this.playerDistanceAlongTrack > 400 && this.playerDistanceAlongTrack < (this.finishLineDist - 200))) {
        this.hasPassedHalfway = true
      }

      // Linha de Chegada e Pórtico / Arco Final na Reta Oeste (Z=0, X=westTrackX)
      // O jogador ultrapassa por dentro do arco final (largura da pista 18m, X por volta de westTrackX, Z cruzando 0)
      const westTrackX = this.centerX - this.curveRadius
      const insideArchX = Math.abs(playerPos.x - westTrackX) <= (this.trackWidth / 2 + 2.5)
      const prevZ = this.prevPlayerZ
      const currZ = playerPos.z
      const crossedZPlane = (prevZ >= -0.5 && currZ <= 0.5 && prevZ > currZ) || (Math.abs(currZ) <= 4.0 && prevPlayerDist < this.finishLineDist && this.playerDistanceAlongTrack >= this.finishLineDist)
      const crossedArch = insideArchX && crossedZPlane
      const crossedLine = (crossedArch || (prevPlayerDist < this.finishLineDist && this.playerDistanceAlongTrack >= this.finishLineDist)) && this.hasPassedHalfway

      if (crossedLine && this.raceStarted && !this.raceEnded) {
        this.hasPassedHalfway = false
        this.sound.effect('jump')

        // Ao completar a 3ª volta cruzando por dentro do arco final da pista
        if (this.playerLap >= 3) {
          this.raceEnded = true
          this.raceStarted = false
          this.missionActive = false

          // Todos os carros de rally (jogador e rivais) param de andar imediatamente
          playerCar.speed = 0
          for (const comp of this.competitors) {
            comp.baseSpeed = 0
            comp.currentSpeed = 0
            comp.car.speed = 0
          }

          // Se o jogador chegar na primeira ou segunda posição: vitória e missão concluída
          // Se o jogador chegar na terceira posição ou maior: derrota e missão fracassada
          if (this.playerRacePosition === 1 || this.playerRacePosition === 2) {
            this.playerHasWon = true
            this.onRaceWon?.(6000, 10000)
          } else {
            this.playerHasWon = false
            this.onRaceLost?.(this.playerRacePosition)
          }
        } else {
          this.onLapCompleted?.(this.playerLap, this.playerRacePosition)
          this.playerLap += 1
        }
      }

      this.prevPlayerZ = playerPos.z

      // Cálculo da posição no ranking (1º ao 6º lugar)
      let rank = 1
      for (const comp of this.competitors) {
        if (comp.lap > this.playerLap) {
          rank++
        } else if (comp.lap === this.playerLap && comp.distanceAlongTrack > this.playerDistanceAlongTrack) {
          rank++
        }
      }
      this.playerRacePosition = Math.min(6, rank)
    }
  }

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
    this.playerRallyCar = null
    this.scene.remove(this.root)
  }
}
