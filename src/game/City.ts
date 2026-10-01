import * as THREE from 'three'

const BLOCK = 48
const ROAD_WIDTH = 15
const CHUNK_DEPTH = 192
const CITY_ROAD_MIN = -7
const CITY_ROAD_MAX = 7
const WORLD_HALF_WIDTH = 345
const RIVER_WIDTH = 62
const RIVER_LEFT_X = -379
const RIVER_RIGHT_X = 379

export const TRAFFIC_LIGHT_INTERSECTIONS = [
  { x: -48, z: 0 },
  { x: 48, z: 0 },
  { x: -48, z: 48 },
  { x: 48, z: 48 }
]

export interface PlazaInfo {
  name: string
  type: 'central' | 'waters' | 'park'
  x: number
  z: number
  width: number
  depth: number
}

export interface LagoonInfo {
  name: string
  x: number
  z: number
  radius: number
}

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number }
type Coin = { mesh: THREE.Mesh; x: number; z: number; alive: boolean }
type BuildingVisual = { matrix: THREE.Matrix4; color: THREE.Color; bounds: Bounds; faded: boolean; roofMatrix?: THREE.Matrix4; roofColor?: THREE.Color }
type CityChunk = {
  group: THREE.Group
  bounds: Bounds[]
  coins: Coin[]
  groundMaterial: THREE.MeshStandardMaterial
  buildingVisuals: BuildingVisual[]
  houseVisuals: BuildingVisual[]
  buildings: THREE.InstancedMesh
  fadedBuildings: THREE.InstancedMesh
  roofInstances: THREE.InstancedMesh
  fadedRoofInstances: THREE.InstancedMesh
  houses: THREE.InstancedMesh
  fadedHouses: THREE.InstancedMesh
  houseRoofs: THREE.InstancedMesh
  fadedHouseRoofs: THREE.InstancedMesh
}

function randomFrom(seed: number): () => number {
  let value = seed | 0
  return () => {
    value = (value + 0x6d2b79f5) | 0
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class City {
  private readonly scene: THREE.Scene
  readonly root = new THREE.Group()
  readonly coins: Coin[] = []
  private readonly chunks = new Map<number, CityChunk>()
  private readonly colliders: Bounds[] = []
  private readonly ground: THREE.Mesh
  private readonly buildingMaterials: THREE.MeshStandardMaterial[]
  private readonly buildingBatchMaterial: THREE.MeshStandardMaterial
  private readonly fadedBuildingMaterial: THREE.MeshStandardMaterial
  private readonly roofBatchMaterial: THREE.MeshStandardMaterial
  private readonly fadedRoofMaterial: THREE.MeshStandardMaterial
  private readonly houseBatchMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.91 })
  private readonly fadedHouseMaterial: THREE.MeshStandardMaterial
  private readonly houseRoofMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 })
  private readonly fadedHouseRoofMaterial: THREE.MeshStandardMaterial
  private readonly houseWindowMaterial = new THREE.MeshStandardMaterial({ color: 0x9ed1d4, emissive: 0x24484b, emissiveIntensity: 0.16, roughness: 0.48 })
  private readonly houseDoorMaterial = new THREE.MeshStandardMaterial({ color: 0x68452f, roughness: 0.92 })
  private readonly houseColors = [0xe6c28f, 0xd78d72, 0x9cba9a, 0x8faec1, 0xe8dfbd, 0xc9a4bd]
  private readonly houseRoofColors = [0x9b5140, 0x46545a, 0x6e4938, 0x7f4639, 0x66754f]
  private readonly asphalt = new THREE.MeshStandardMaterial({ color: 0x303638, roughness: 0.98 })
  private readonly lanePaint = new THREE.MeshStandardMaterial({ color: 0xe6c978, roughness: 0.82 })
  private readonly sidewalk = new THREE.MeshStandardMaterial({ color: 0xb3ad97, roughness: 1 })
  private readonly greens = [0x6d986e, 0x789b75, 0x648766, 0x83a37a]
  private readonly coinMaterial = new THREE.MeshStandardMaterial({ color: 0xf5bf48, metalness: 0.42, roughness: 0.34, emissive: 0x6c3b0a, emissiveIntensity: 0.24 })
  private readonly coinGeometry = new THREE.CylinderGeometry(0.48, 0.48, 0.13, 10)

  // Plaza and Park Materials
  private readonly parkLawnMaterial = new THREE.MeshStandardMaterial({ color: 0x478c43, roughness: 0.95 })
  private readonly plazaPathMaterial = new THREE.MeshStandardMaterial({ color: 0xd6d0be, roughness: 0.9 })
  private readonly plazaStoneMaterial = new THREE.MeshStandardMaterial({ color: 0xbdb7a6, roughness: 0.72, metalness: 0.12 })
  private readonly plazaWaterMaterial = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.08, metalness: 0.42, emissive: 0x0c4a6e, emissiveIntensity: 0.2 })
  private readonly benchWoodMaterial = new THREE.MeshStandardMaterial({ color: 0x784a2c, roughness: 0.88 })
  private readonly plazaIronMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2425, roughness: 0.76, metalness: 0.35 })
  private readonly plazaLampMaterial = new THREE.MeshStandardMaterial({ color: 0xfff0c2, emissive: 0xfcb844, emissiveIntensity: 1.1, roughness: 0.3 })
  private readonly treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 0.92 })
  private readonly treeFoliageMaterial = new THREE.MeshStandardMaterial({ color: 0x3f8a3d, roughness: 0.84 })

  // River and Embankment Materials
  private readonly riverWaterMaterial = new THREE.MeshStandardMaterial({ color: 0x217d9e, roughness: 0.1, metalness: 0.36, transparent: true, opacity: 0.88 })
  private readonly lagoonWaterMaterial = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.08, metalness: 0.45, transparent: false, opacity: 1.0 })
  private readonly riverBedMaterial = new THREE.MeshStandardMaterial({ color: 0x16262e, roughness: 0.98 })
  private readonly embankmentMaterial = new THREE.MeshStandardMaterial({ color: 0x8a9291, roughness: 0.92 })
  private readonly outerBankMaterial = new THREE.MeshStandardMaterial({ color: 0x55734e, roughness: 0.98 })
  private readonly bridgeRailMaterial = new THREE.MeshStandardMaterial({ color: 0xd95945, roughness: 0.65, metalness: 0.25 })

  // Traffic Light Materials
  private readonly lightOffRed = new THREE.MeshStandardMaterial({ color: 0x4a0505, roughness: 0.9 })
  private readonly lightOffYellow = new THREE.MeshStandardMaterial({ color: 0x4a4a05, roughness: 0.9 })
  private readonly lightOffGreen = new THREE.MeshStandardMaterial({ color: 0x054a05, roughness: 0.9 })

  private readonly lightOnRed = new THREE.MeshStandardMaterial({ color: 0xff1e1e, emissive: 0xff0505, emissiveIntensity: 3.5, roughness: 0.15 })
  private readonly lightOnYellow = new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffcc00, emissiveIntensity: 3.0, roughness: 0.15 })
  private readonly lightOnGreen = new THREE.MeshStandardMaterial({ color: 0x1eff1e, emissive: 0x05ff05, emissiveIntensity: 3.5, roughness: 0.15 })

  private readonly trafficLightVisuals: {
    axis: 'x' | 'z'
    red: THREE.Mesh
    yellow: THREE.Mesh
    green: THREE.Mesh
  }[] = []

  private trafficLightTimer = 0

  private kingKongLocation: { blockX: number; centerZ: number; centerX: number } = {
    blockX: -4,
    centerZ: 144,
    centerX: -4 * BLOCK + BLOCK / 2,
  }

  // Airport Runway Materials
  private readonly runwayAsphalt = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.92 })
  private readonly runwayPaintWhite = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.7 })
  private readonly runwayPaintYellow = new THREE.MeshStandardMaterial({ color: 0xf5b700, roughness: 0.7 })
  private readonly runwayLightGreen = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ee66, emissiveIntensity: 2.2, roughness: 0.2 })
  private readonly runwayLightWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0, roughness: 0.2 })
  private readonly runwayLightRed = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff1111, emissiveIntensity: 2.2, roughness: 0.2 })
  private readonly airportBuildingMat = new THREE.MeshStandardMaterial({ color: 0x7b8894, roughness: 0.75, metalness: 0.3 })
  private readonly airportRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 })

  // Garage Materials
  private readonly garageConcreteMat = new THREE.MeshStandardMaterial({ color: 0x353a3e, roughness: 0.9 })
  private readonly garageWallMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75, metalness: 0.25 })
  private readonly garageDoorMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.65, metalness: 0.35 })
  private readonly garageTrimYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
  private readonly garageBeaconMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 2.5, roughness: 0.2 })
  private readonly garageSignMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.8, roughness: 0.2 })

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(5000, 5000),
      new THREE.MeshStandardMaterial({ color: 0x78946b, roughness: 1 }),
    )
    this.ground.rotation.x = -Math.PI / 2
    this.ground.position.y = -0.18
    this.ground.receiveShadow = true
    this.scene.add(this.ground)
    this.scene.add(this.root)
    this.buildingMaterials = this.makeBuildingMaterials()
    this.buildingBatchMaterial = new THREE.MeshStandardMaterial({ map: this.buildingMaterials[0].map, color: 0xffffff, roughness: 0.9 })
    this.fadedBuildingMaterial = this.makeFadedMaterial(this.buildingBatchMaterial)
    this.roofBatchMaterial = new THREE.MeshStandardMaterial({ map: this.buildingMaterials[0].map, color: 0xffffff, roughness: 0.9 })
    this.fadedRoofMaterial = this.makeFadedMaterial(this.roofBatchMaterial)
    this.fadedHouseMaterial = this.makeFadedMaterial(this.houseBatchMaterial)
    this.fadedHouseRoofMaterial = this.makeFadedMaterial(this.houseRoofMaterial)
    this.selectRandomKingKongLocation()
  }

  private makeFadedMaterial(material: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    const faded = material.clone()
    faded.transparent = true
    faded.opacity = 0.22
    faded.depthWrite = false
    faded.polygonOffset = true
    faded.polygonOffsetFactor = -1
    return faded
  }

  private makeBuildingMaterials(): THREE.MeshStandardMaterial[] {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')!
    context.fillStyle = '#7f9294'
    context.fillRect(0, 0, 128, 128)
    for (let y = 7; y < 128; y += 22) {
      for (let x = 8; x < 128; x += 22) {
        context.fillStyle = (x + y) % 3 === 0 ? '#ead5a3' : '#a6d0d0'
        context.fillRect(x, y, 9, 11)
        context.fillStyle = '#40545b'
        context.fillRect(x + 2, y + 2, 2, 7)
      }
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    const tints = [0xd3c7aa, 0xb8c9c7, 0xd1ad92, 0xbacaaa, 0xa8c5d0, 0xd8bd91]
    return tints.map((color) => new THREE.MeshStandardMaterial({ map: texture, color, roughness: 0.9 }))
  }

  ensureAround(z: number): void {
    const center = Math.floor(z / CHUNK_DEPTH)
    for (let index = center - 2; index <= center + 2; index += 1) {
      if (!this.chunks.has(index)) this.createChunk(index)
    }
    for (const [index, chunk] of this.chunks) {
      if (Math.abs(index - center) > 3) this.removeChunk(index, chunk)
    }
  }

  private createChunk(index: number): void {
    const group = new THREE.Group()
    const bounds: Bounds[] = []
    const chunkCoins: Coin[] = []
    const random = randomFrom((index + 10091) * 785839)
    const zStart = index * CHUNK_DEPTH
    const zMiddle = zStart + CHUNK_DEPTH / 2

    const green = new THREE.MeshStandardMaterial({ color: this.greens[Math.floor(random() * this.greens.length)], roughness: 1 })
    const blockGround = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF_WIDTH * 2, CHUNK_DEPTH), green)
    blockGround.rotation.x = -Math.PI / 2
    blockGround.position.set(0, -0.115, zMiddle)
    blockGround.receiveShadow = true
    group.add(blockGround)

    const laneMarkCount = (CITY_ROAD_MAX - CITY_ROAD_MIN + 1) * 16 + 5 * 50
    const laneMarks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.025, 3.5), this.lanePaint, laneMarkCount)
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    let markIndex = 0

    // 1. Longitudinal Avenues (15 major avenues from -7 to +7)
    for (let road = CITY_ROAD_MIN; road <= CITY_ROAD_MAX; road += 1) {
      const roadX = road * BLOCK
      this.addRoad(group, new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_DEPTH), roadX, zMiddle)
      for (let dash = 0; dash < 16; dash += 1) {
        position.set(roadX, 0.03, zStart + dash * 12 + 4)
        scale.set(0.13, 1, 1)
        matrix.compose(position, rotation, scale)
        laneMarks.setMatrixAt(markIndex++, matrix)
      }
    }

    // 2. Latitudinal Cross Streets across the city
    for (let road = 0; road <= CHUNK_DEPTH / BLOCK; road += 1) {
      const roadZ = zStart + road * BLOCK
      this.addRoad(group, new THREE.PlaneGeometry(WORLD_HALF_WIDTH * 2, ROAD_WIDTH), 0, roadZ)
      
      // Adicionar semáforos se for um dos 4 cruzamentos escolhidos
      if (roadZ === 0 || roadZ === 48) {
        for (const blockX of [-1, 1]) {
          const roadX = blockX * BLOCK // -48 ou 48
          this.buildTrafficLightMeshes(group, roadX, roadZ)
        }
      }

      for (let dash = 0; dash < 50; dash += 1) {
        position.set(-WORLD_HALF_WIDTH + dash * 14 + 5, 0.03, roadZ)
        scale.set(3.3, 1, 0.13 / 3.5)
        matrix.compose(position, rotation, scale)
        laneMarks.setMatrixAt(markIndex++, matrix)
      }
    }
    laneMarks.instanceMatrix.needsUpdate = true
    group.add(laneMarks)

    // 3. Rivers & Bridges at City Limits (West and East boundaries)
    this.addRiver(group, RIVER_LEFT_X, zMiddle, RIVER_WIDTH, CHUNK_DEPTH, 'west', bounds)
    this.addRiver(group, RIVER_RIGHT_X, zMiddle, RIVER_WIDTH, CHUNK_DEPTH, 'east', bounds)

    for (let road = 0; road <= CHUNK_DEPTH / BLOCK; road += 1) {
      const roadZ = zStart + road * BLOCK
      this.addBridge(group, RIVER_LEFT_X, roadZ, RIVER_WIDTH, ROAD_WIDTH, bounds)
      this.addBridge(group, RIVER_RIGHT_X, roadZ, RIVER_WIDTH, ROAD_WIDTH, bounds)
    }

    const buildingCapacity = 75
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
    const buildings = new THREE.InstancedMesh(boxGeometry, this.buildingBatchMaterial, buildingCapacity)
    const fadedBuildings = new THREE.InstancedMesh(boxGeometry, this.fadedBuildingMaterial, buildingCapacity)
    const houses = new THREE.InstancedMesh(boxGeometry, this.houseBatchMaterial, buildingCapacity)
    const fadedHouses = new THREE.InstancedMesh(boxGeometry, this.fadedHouseMaterial, buildingCapacity)
    const roofInstances = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.roofBatchMaterial, buildingCapacity)
    const fadedRoofInstances = new THREE.InstancedMesh(roofInstances.geometry, this.fadedRoofMaterial, buildingCapacity)
    const houseRoofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.72, 1, 4), this.houseRoofMaterial, buildingCapacity)
    const fadedHouseRoofs = new THREE.InstancedMesh(houseRoofs.geometry, this.fadedHouseRoofMaterial, buildingCapacity)
    const houseDetails = new THREE.InstancedMesh(boxGeometry, this.houseWindowMaterial, buildingCapacity * 2)
    const houseDoors = new THREE.InstancedMesh(boxGeometry, this.houseDoorMaterial, buildingCapacity)
    const sidewalks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.sidewalk, buildingCapacity)
    buildings.castShadow = true
    buildings.receiveShadow = true
    houses.castShadow = true
    houses.receiveShadow = true
    fadedBuildings.renderOrder = 2
    fadedHouses.renderOrder = 2
    fadedRoofInstances.renderOrder = 2
    fadedHouseRoofs.renderOrder = 2
    fadedBuildings.count = 0
    fadedHouses.count = 0
    fadedRoofInstances.count = 0
    fadedHouseRoofs.count = 0
    fadedBuildings.castShadow = false
    fadedBuildings.receiveShadow = false
    fadedHouses.castShadow = false
    fadedHouses.receiveShadow = false
    roofInstances.castShadow = true
    roofInstances.receiveShadow = true
    houseRoofs.castShadow = true
    houseRoofs.receiveShadow = true
    sidewalks.receiveShadow = true
    houseDetails.castShadow = false
    houseDoors.castShadow = true
    const buildingVisuals: BuildingVisual[] = []
    const houseVisuals: BuildingVisual[] = []
    let buildingIndex = 0
    let houseIndex = 0
    let roofIndex = 0
    let houseRoofIndex = 0
    let detailIndex = 0
    let doorIndex = 0
    let sidewalkIndex = 0

    for (let blockX = CITY_ROAD_MIN; blockX < CITY_ROAD_MAX; blockX += 1) {
      for (let row = 0; row < 4; row += 1) {
        const centerX = blockX * BLOCK + BLOCK / 2
        const centerZ = zStart + row * BLOCK + BLOCK / 2

        // Check if this block is the airport runway
        if (this.isRunwayAt(blockX, centerZ)) {
          this.buildAirportRunway(group, centerX, centerZ, bounds, chunkCoins)
          continue
        }

        // Check if this block is the Fuel Service Garage
        if (this.isGarageAt(blockX, centerZ)) {
          this.buildFuelGarage(group, centerX, centerZ, bounds, chunkCoins)
          continue
        }

        // Check if this block is one of the city plazas
        const plaza = this.getPlazaAt(blockX, centerZ)
        if (plaza) {
          this.buildPlaza(group, plaza, centerX, centerZ, bounds, chunkCoins)
          continue
        }

        // Check if this block is a city lagoon
        const lagoon = this.getLagoonAt(blockX, centerZ)
        if (lagoon) {
          this.buildLagoon(group, lagoon, centerX, centerZ, bounds, chunkCoins)
          continue
        }

        // Check if this block is King Kong's Skyscraper
        if (this.isKingKongAt(blockX, centerZ)) {
          this.buildKingKongPlaza(group, centerX, centerZ, bounds, chunkCoins)
          continue
        }

        if (random() < 0.12) continue
        const isHouse = random() < 0.39
        const width = isHouse ? 14 + random() * 5 : 15 + random() * 15
        const depth = isHouse ? 14 + random() * 5 : 15 + random() * 15
        const height = isHouse ? 4.8 + random() * 2.5 : 8 + Math.pow(random(), 0.7) * 44
        const x = centerX + (random() - 0.5) * 3.2
        const z = centerZ + (random() - 0.5) * 3.2

        position.set(centerX, 0, centerZ)
        scale.set(34, 0.22, 34)
        matrix.compose(position, rotation, scale)
        sidewalks.setMatrixAt(sidewalkIndex++, matrix)

        const buildingBounds: Bounds = {
          minX: x - width / 2 - 0.8,
          maxX: x + width / 2 + 0.8,
          minZ: z - depth / 2 - 0.8,
          maxZ: z + depth / 2 + 0.8,
          minY: 0,
          maxY: height + (isHouse ? 3 : 2.5),
        }
        position.set(x, height / 2 + 0.12, z)
        scale.set(width, height, depth)
        matrix.compose(position, rotation, scale)
        if (isHouse) {
          const color = new THREE.Color(this.houseColors[Math.floor(random() * this.houseColors.length)])
          const visual: BuildingVisual = { matrix: matrix.clone(), color, bounds: buildingBounds, faded: false }
          houseVisuals.push(visual)
          houses.setMatrixAt(houseIndex, visual.matrix)
          houses.setColorAt(houseIndex++, color)

          const roofColor = this.houseRoofColors[Math.floor(random() * this.houseRoofColors.length)]
          const roofRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4)
          position.set(x, height + 1.15, z)
          scale.set(width * 0.79, 3.4, depth * 0.79)
          matrix.compose(position, roofRotation, scale)
          houseRoofs.setMatrixAt(houseRoofIndex, matrix)
          const roofInstanceColor = new THREE.Color(roofColor)
          houseRoofs.setColorAt(houseRoofIndex++, roofInstanceColor)
          visual.roofMatrix = matrix.clone()
          visual.roofColor = roofInstanceColor

          position.set(x - width * 0.25, 2.8, z + depth / 2 + 0.11)
          scale.set(2.15, 1.6, 0.16)
          matrix.compose(position, rotation, scale)
          houseDetails.setMatrixAt(detailIndex++, matrix)
          position.set(x + width * 0.25, 2.8, z + depth / 2 + 0.11)
          matrix.compose(position, rotation, scale)
          houseDetails.setMatrixAt(detailIndex++, matrix)
          position.set(x, 1.35, z + depth / 2 + 0.12)
          scale.set(1.55, 2.6, 0.19)
          matrix.compose(position, rotation, scale)
          houseDoors.setMatrixAt(doorIndex++, matrix)
        } else {
          const paletteIndex = Math.floor(random() * this.buildingMaterials.length)
          const color = this.buildingMaterials[paletteIndex].color.clone()
          const visual: BuildingVisual = { matrix: matrix.clone(), color, bounds: buildingBounds, faded: false }
          buildingVisuals.push(visual)
          buildings.setMatrixAt(buildingIndex, visual.matrix)
          buildings.setColorAt(buildingIndex++, color)
          if (random() > 0.62) {
            position.set(x + width * 0.12, height + 0.8, z - depth * 0.1)
            scale.set(width * 0.36, 1 + random() * 2, depth * 0.4)
            matrix.compose(position, rotation, scale)
            roofInstances.setMatrixAt(roofIndex, matrix)
            const roofColor = this.buildingMaterials[Math.floor(random() * this.buildingMaterials.length)].color.clone()
            roofInstances.setColorAt(roofIndex++, roofColor)
            visual.roofMatrix = matrix.clone()
            visual.roofColor = roofColor
          }
        }
        bounds.push(buildingBounds)
      }
    }
    buildings.count = buildingIndex
    houses.count = houseIndex
    roofInstances.count = roofIndex
    fadedRoofInstances.count = 0
    houseRoofs.count = houseRoofIndex
    fadedHouseRoofs.count = 0
    houseDetails.count = detailIndex
    houseDoors.count = doorIndex
    sidewalks.count = sidewalkIndex
    buildings.visible = buildingIndex > 0
    houses.visible = houseIndex > 0
    roofInstances.visible = roofIndex > 0
    houseRoofs.visible = houseRoofIndex > 0
    houseDetails.visible = detailIndex > 0
    houseDoors.visible = doorIndex > 0
    buildings.instanceMatrix.needsUpdate = true
    houses.instanceMatrix.needsUpdate = true
    roofInstances.instanceMatrix.needsUpdate = true
    fadedRoofInstances.instanceMatrix.needsUpdate = true
    houseRoofs.instanceMatrix.needsUpdate = true
    fadedHouseRoofs.instanceMatrix.needsUpdate = true
    houseDetails.instanceMatrix.needsUpdate = true
    houseDoors.instanceMatrix.needsUpdate = true
    sidewalks.instanceMatrix.needsUpdate = true
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true
    if (houses.instanceColor) houses.instanceColor.needsUpdate = true
    if (roofInstances.instanceColor) roofInstances.instanceColor.needsUpdate = true
    if (fadedRoofInstances.instanceColor) fadedRoofInstances.instanceColor.needsUpdate = true
    if (houseRoofs.instanceColor) houseRoofs.instanceColor.needsUpdate = true
    if (fadedHouseRoofs.instanceColor) fadedHouseRoofs.instanceColor.needsUpdate = true
    group.add(sidewalks, buildings, fadedBuildings, houses, fadedHouses, roofInstances, fadedRoofInstances, houseRoofs, fadedHouseRoofs, houseDetails, houseDoors)

    for (let coinIndex = 0; coinIndex < 5; coinIndex += 1) {
      const road = Math.floor(random() * 7) - 3
      const coinX = road * BLOCK + (random() - 0.5) * 7
      const coinZ = zStart + 12 + random() * (CHUNK_DEPTH - 24)
      const mesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial)
      mesh.rotation.x = Math.PI / 2
      mesh.position.set(coinX, 1.05, coinZ)
      mesh.castShadow = true
      group.add(mesh)
      chunkCoins.push({ mesh, x: coinX, z: coinZ, alive: true })
    }

    this.root.add(group)
    this.colliders.push(...bounds)
    this.coins.push(...chunkCoins)
    this.chunks.set(index, { group, bounds, coins: chunkCoins, groundMaterial: green, buildingVisuals, houseVisuals, buildings, fadedBuildings, roofInstances, fadedRoofInstances, houses, fadedHouses, houseRoofs, fadedHouseRoofs })
  }

  private addRoad(group: THREE.Group, geometry: THREE.PlaneGeometry, x: number, z: number): void {
    const road = new THREE.Mesh(geometry, this.asphalt)
    road.rotation.x = -Math.PI / 2
    road.position.set(x, 0.015, z)
    road.receiveShadow = true
    group.add(road)
  }

  get blockSize(): number { return BLOCK }
  get roadMin(): number { return CITY_ROAD_MIN }
  get roadMax(): number { return CITY_ROAD_MAX }
  get riverLeftX(): number { return RIVER_LEFT_X }
  get riverRightX(): number { return RIVER_RIGHT_X }
  get riverWidth(): number { return RIVER_WIDTH }
  get worldHalfWidth(): number { return WORLD_HALF_WIDTH }

  isRunwayAt(blockX: number, centerZ: number): boolean {
    return blockX === 3 && centerZ >= -170 && centerZ <= 260
  }

  isGarageAt(blockX: number, centerZ: number): boolean {
    return blockX === -2 && Math.abs(centerZ - (-72)) < 22
  }

  getFuelGarageInfo(): { x: number; z: number; width: number; depth: number; deliveryX: number; deliveryZ: number; deliveryRadius: number } {
    return {
      x: -2 * BLOCK + BLOCK / 2, // -72
      z: -72,
      width: 36,
      depth: 36,
      deliveryX: -2 * BLOCK + BLOCK / 2, // -72
      deliveryZ: -72 + 6, // -66
      deliveryRadius: 9.5,
    }
  }

  isInsideGarageDelivery(x: number, z: number): boolean {
    const garage = this.getFuelGarageInfo()
    return Math.hypot(x - garage.deliveryX, z - garage.deliveryZ) <= garage.deliveryRadius
  }

  getRunwayInfo(): { x: number; zStart: number; zEnd: number; width: number } {
    return {
      x: 3 * BLOCK + BLOCK / 2, // 168
      zStart: -160,
      zEnd: 240,
      width: 36,
    }
  }

  getPlazas(): readonly PlazaInfo[] {
    return [
      { name: 'Praça Central', type: 'central', x: -24, z: 72, width: 36, depth: 36 },
      { name: 'Praça das Águas', type: 'waters', x: 120, z: -72, width: 36, depth: 36 },
    ]
  }

  getMonsterTruckPlazaLocation(): { x: number; z: number } {
    return { x: -12.5, z: 72 }
  }

  getPlazaAt(blockX: number, centerZ: number): PlazaInfo | null {
    // 1. Praça Central (North-West from player start)
    if (blockX === -1 && Math.abs(centerZ - 72) < 22) {
      return { name: 'Praça Central', type: 'central', x: -24, z: 72, width: 36, depth: 36 }
    }
    // 2. Praça das Águas (South-East from player start)
    if (blockX === 2 && Math.abs(centerZ - (-72)) < 22) {
      return { name: 'Praça das Águas', type: 'waters', x: 120, z: -72, width: 36, depth: 36 }
    }
    // Repeating procedural plazas along Z for infinite exploration (avoiding runway strip)
    const cycleZ = THREE.MathUtils.euclideanModulo(centerZ + 384, 768) - 384
    if (blockX === 3 && (centerZ < -170 || centerZ > 260) && Math.abs(cycleZ - 216) < 22) {
      return { name: 'Praça do Sol', type: 'park', x: 3 * BLOCK + BLOCK / 2, z: centerZ, width: 36, depth: 36 }
    }
    if (blockX === -3 && Math.abs(cycleZ - (-216)) < 22) {
      return { name: 'Praça das Palmeiras', type: 'park', x: -3 * BLOCK + BLOCK / 2, z: centerZ, width: 36, depth: 36 }
    }
    return null
  }

  getLagoonAt(blockX: number, centerZ: number): LagoonInfo | null {
    if (blockX === -3 && Math.abs(centerZ - (-120)) < 22) {
      return { name: 'Lagoa Azul', x: -3 * BLOCK + BLOCK / 2, z: centerZ, radius: 14 }
    }
    if (blockX === 3 && Math.abs(centerZ - 120) < 22) {
      return { name: 'Lagoa do Parque', x: 3 * BLOCK + BLOCK / 2, z: centerZ, radius: 14 }
    }
    if (blockX === -5 && Math.abs(centerZ - 240) < 22) {
      return { name: 'Lagoa Sunset', x: -5 * BLOCK + BLOCK / 2, z: centerZ, radius: 15 }
    }
    if (blockX === 5 && Math.abs(centerZ - (-240)) < 22) {
      return { name: 'Lagoa Cristal', x: 5 * BLOCK + BLOCK / 2, z: centerZ, radius: 15 }
    }
    const cycleZ = THREE.MathUtils.euclideanModulo(centerZ + 384, 768) - 384
    if (blockX === -4 && (centerZ < -300 || centerZ > 300) && Math.abs(cycleZ - 168) < 22) {
      return { name: 'Lagoa do Vale', x: -4 * BLOCK + BLOCK / 2, z: centerZ, radius: 14 }
    }
    if (blockX === 4 && (centerZ < -300 || centerZ > 300) && Math.abs(cycleZ - (-168)) < 22) {
      return { name: 'Lagoa Espelhada', x: 4 * BLOCK + BLOCK / 2, z: centerZ, radius: 14 }
    }
    return null
  }

  getLagoonsForMinimap(playerZ: number): LagoonInfo[] {
    const lagoons: LagoonInfo[] = []
    const centerBlockZ = Math.round((playerZ - BLOCK / 2) / BLOCK) * BLOCK + BLOCK / 2
    for (let blockX = CITY_ROAD_MIN; blockX < CITY_ROAD_MAX; blockX += 1) {
      for (let offset = -BLOCK * 6; offset <= BLOCK * 6; offset += BLOCK) {
        const bz = centerBlockZ + offset
        const lagoon = this.getLagoonAt(blockX, bz)
        if (lagoon) lagoons.push(lagoon)
      }
    }
    return lagoons
  }

  isKingKongAt(blockX: number, centerZ: number): boolean {
    return blockX === this.kingKongLocation.blockX && Math.abs(centerZ - this.kingKongLocation.centerZ) < 22
  }

  getKingKongLocation(): { blockX: number; centerZ: number; centerX: number } {
    return this.kingKongLocation
  }

  setKingKongLocation(loc: { blockX: number; centerZ: number; centerX: number }): void {
    this.kingKongLocation = loc
  }

  selectRandomKingKongLocation(): { blockX: number; centerZ: number; centerX: number } {
    const candidateBlocks: { blockX: number; centerZ: number }[] = []
    const blockXOptions = [-5, -4, -1, 1, 2, 4, 5]
    const centerZOptions = [-216, -168, -120, -72, 72, 120, 168, 216, 264]

    for (const bx of blockXOptions) {
      for (const cz of centerZOptions) {
        if (this.isRunwayAt(bx, cz)) continue
        if (this.isGarageAt(bx, cz)) continue
        if (this.getPlazaAt(bx, cz) !== null) continue
        if (this.getLagoonAt(bx, cz) !== null) continue
        candidateBlocks.push({ blockX: bx, centerZ: cz })
      }
    }

    if (candidateBlocks.length > 0) {
      const chosen = candidateBlocks[Math.floor(Math.random() * candidateBlocks.length)]
      this.kingKongLocation = {
        blockX: chosen.blockX,
        centerZ: chosen.centerZ,
        centerX: chosen.blockX * BLOCK + BLOCK / 2,
      }
    }
    return this.kingKongLocation
  }

  private buildAirportRunway(
    group: THREE.Group,
    centerX: number,
    centerZ: number,
    bounds: Bounds[],
    chunkCoins: Coin[],
  ): void {
    // 1. Wide Asphalt Runway Deck (36m wide, 48m per block)
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(36, 48), this.runwayAsphalt)
    deck.rotation.x = -Math.PI / 2
    deck.position.set(centerX, 0.024, centerZ)
    deck.receiveShadow = true
    group.add(deck)

    // 2. Lateral Solid Yellow Border Lines
    for (const side of [-1, 1]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 48), this.runwayPaintYellow)
      line.rotation.x = -Math.PI / 2
      line.position.set(centerX + side * 17.2, 0.026, centerZ)
      group.add(line)
    }

    // 3. Centerline White Dashes (Linha tracejada de decolagem)
    for (let d = 0; d < 4; d += 1) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 6.0), this.runwayPaintWhite)
      dash.rotation.x = -Math.PI / 2
      dash.position.set(centerX, 0.026, centerZ - 18 + d * 12)
      group.add(dash)
    }

    // 4. Threshold Markings (Faixas de cabeceira de pista tipo piano)
    const isStart = centerZ <= -120 && centerZ >= -160
    const isEnd = centerZ >= 200 && centerZ <= 240
    if (isStart || isEnd) {
      for (let s = -6; s <= 6; s += 1) {
        if (s === 0) continue
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 9.0), this.runwayPaintWhite)
        stripe.rotation.x = -Math.PI / 2
        stripe.position.set(centerX + s * 2.4, 0.027, centerZ + (isStart ? -14 : 14))
        group.add(stripe)
      }

      // Green threshold entry lights
      for (let s = -7; s <= 7; s += 1) {
        const light = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.45, 8), isStart ? this.runwayLightGreen : this.runwayLightRed)
        light.position.set(centerX + s * 2.3, 0.24, centerZ + (isStart ? -22 : 22))
        group.add(light)
      }
    }

    // 5. Runway Edge Marker Lights (Balizamento noturno)
    for (let side of [-1, 1]) {
      for (let p = -2; p <= 2; p += 1) {
        const light = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.4, 8), this.runwayLightWhite)
        light.position.set(centerX + side * 18.2, 0.2, centerZ + p * 11)
        group.add(light)
      }
    }

    // 6. Airport Facilities (Hangares e Torre de Controle fora da faixa da pista)
    if (Math.abs(centerZ) < 30) {
      // Airport Control Tower (East side, completely clear of runway)
      const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.6, 18, 12), this.airportBuildingMat)
      towerBase.position.set(centerX + 32, 9, centerZ)
      towerBase.castShadow = true
      towerBase.receiveShadow = true
      group.add(towerBase)

      const towerDeck = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 3.2, 12), this.houseWindowMaterial)
      towerDeck.position.set(centerX + 32, 19.5, centerZ)
      towerDeck.castShadow = true
      group.add(towerDeck)

      const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 1.8, 12), this.airportRoofMat)
      towerRoof.position.set(centerX + 32, 21.9, centerZ)
      group.add(towerRoof)

      bounds.push({
        minX: centerX + 32 - 4.5,
        maxX: centerX + 32 + 4.5,
        minZ: centerZ - 4.5,
        maxZ: centerZ + 4.5,
        minY: 0,
        maxY: 23,
      })
    } else if (Math.abs(centerZ - 96) < 30 || Math.abs(centerZ - (-96)) < 30) {
      // Airport Hangar on the side
      const hangar = new THREE.Mesh(new THREE.BoxGeometry(16, 8.5, 28), this.airportBuildingMat)
      hangar.position.set(centerX + 34, 4.25, centerZ)
      hangar.castShadow = true
      hangar.receiveShadow = true
      group.add(hangar)

      const hangarRoof = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.2, 28, 14, 1, false, 0, Math.PI), this.airportRoofMat)
      hangarRoof.rotation.z = Math.PI / 2
      hangarRoof.position.set(centerX + 34, 8.5, centerZ)
      hangarRoof.castShadow = true
      group.add(hangarRoof)

      bounds.push({
        minX: centerX + 34 - 8.5,
        maxX: centerX + 34 + 8.5,
        minZ: centerZ - 14.5,
        maxZ: centerZ + 14.5,
        minY: 0,
        maxY: 17,
      })
    }

    // Collectible Coin near runway
    const coinMesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial)
    coinMesh.rotation.x = Math.PI / 2
    coinMesh.position.set(centerX, 1.2, centerZ)
    coinMesh.castShadow = true
    group.add(coinMesh)
    chunkCoins.push({ mesh: coinMesh, x: centerX, z: centerZ, alive: true })
  }

  private buildFuelGarage(
    group: THREE.Group,
    centerX: number,
    centerZ: number,
    bounds: Bounds[],
    chunkCoins: Coin[],
  ): void {
    // 1. Concrete Apron (Pátio de concreto industrial 36x36m)
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), this.garageConcreteMat)
    apron.rotation.x = -Math.PI / 2
    apron.position.set(centerX, 0.024, centerZ)
    apron.receiveShadow = true
    group.add(apron)

    // 2. Main Garage Building (Oficina e Garagem Industrial)
    const garageMain = new THREE.Mesh(new THREE.BoxGeometry(24, 7.8, 16), this.garageWallMat)
    garageMain.position.set(centerX, 3.9, centerZ - 8)
    garageMain.castShadow = true
    garageMain.receiveShadow = true
    group.add(garageMain)

    // Garage Flat Industrial Roof with Parapet
    const garageRoof = new THREE.Mesh(new THREE.BoxGeometry(24.6, 0.6, 16.6), this.airportRoofMat)
    garageRoof.position.set(centerX, 8.1, centerZ - 8)
    garageRoof.castShadow = true
    group.add(garageRoof)

    // 3. Roll-up Shutter Garage Doors (Portões de garagem para caminhões)
    for (const d of [-5.5, 5.5]) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 5.4), this.garageDoorMat)
      door.position.set(centerX + d, 2.7, centerZ + 0.05)
      group.add(door)

      // Yellow/Black Hazard Border Trim
      const trimTop = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.35, 0.2), this.garageTrimYellowMat)
      trimTop.position.set(centerX + d, 5.5, centerZ + 0.1)
      group.add(trimTop)

      const trimL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.4, 0.2), this.garageTrimYellowMat)
      trimL.position.set(centerX + d - 3.8, 2.7, centerZ + 0.1)
      group.add(trimL)

      const trimR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.4, 0.2), this.garageTrimYellowMat)
      trimR.position.set(centerX + d + 3.8, 2.7, centerZ + 0.1)
      group.add(trimR)
    }

    // 4. Large Illuminated Garage Sign
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(16, 1.4, 0.4), this.airportRoofMat)
    signBoard.position.set(centerX, 6.8, centerZ + 0.2)
    group.add(signBoard)

    const signNeon = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.8, 0.1), this.garageSignMat)
    signNeon.position.set(centerX, 6.8, centerZ + 0.42)
    group.add(signNeon)

    // 5. Fuel Storage Silos / Tanks on side
    for (let s = -1; s <= 1; s += 1) {
      const tankSilo = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 7.2, 16), this.airportBuildingMat)
      tankSilo.position.set(centerX + 14.5, 3.6, centerZ - 8 + s * 4.4)
      tankSilo.castShadow = true
      tankSilo.receiveShadow = true
      group.add(tankSilo)

      const tankCap = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.airportRoofMat)
      tankCap.position.set(centerX + 14.5, 7.2, centerZ - 8 + s * 4.4)
      group.add(tankCap)
    }

    // 6. Delivery Bay Floor Target (Baia de Estacionamento / Entrega do Caminhão)
    const deliveryZoneZ = centerZ + 6
    const bayPad = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), this.asphalt)
    bayPad.rotation.x = -Math.PI / 2
    bayPad.position.set(centerX, 0.026, deliveryZoneZ)
    group.add(bayPad)

    // Yellow Hazard Perimeter lines
    for (const side of [-1, 1]) {
      const lineSide = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 12), this.runwayPaintYellow)
      lineSide.rotation.x = -Math.PI / 2
      lineSide.position.set(centerX + side * 7.8, 0.028, deliveryZoneZ)
      group.add(lineSide)
    }
    const lineBack = new THREE.Mesh(new THREE.PlaneGeometry(16, 0.4), this.runwayPaintYellow)
    lineBack.rotation.x = -Math.PI / 2
    lineBack.position.set(centerX, 0.028, deliveryZoneZ + 5.8)
    group.add(lineBack)

    // Glowing Delivery Target Circle (Ponto de entrega iluminado)
    const beaconRing = new THREE.Mesh(new THREE.RingGeometry(2.8, 4.4, 24), this.garageBeaconMat)
    beaconRing.rotation.x = -Math.PI / 2
    beaconRing.position.set(centerX, 0.03, deliveryZoneZ)
    group.add(beaconRing)

    const beaconCore = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), this.garageBeaconMat)
    beaconCore.rotation.x = -Math.PI / 2
    beaconCore.position.set(centerX, 0.029, deliveryZoneZ)
    group.add(beaconCore)

    // Vertical Waypoint Beacon Beam (Feixe de luz para localização à distância)
    const beamGeo = new THREE.CylinderGeometry(2.6, 2.6, 32, 16, 1, true)
    const beamMesh = new THREE.Mesh(beamGeo, this.garageBeaconMat)
    beamMesh.position.set(centerX, 16, deliveryZoneZ)
    group.add(beamMesh)

    // Hovering Target Indicator Ring
    const targetRing = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.38, 10, 24), this.garageTrimYellowMat)
    targetRing.rotation.x = Math.PI / 2
    targetRing.position.set(centerX, 6.5, deliveryZoneZ)
    group.add(targetRing)

    // Corner Safety Bollards with Lights
    for (const bx of [-7.6, 7.6]) {
      for (const bz of [deliveryZoneZ - 5.6, deliveryZoneZ + 5.6]) {
        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.1, 8), this.garageTrimYellowMat)
        bollard.position.set(centerX + bx, 0.55, bz)
        group.add(bollard)

        const bLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), this.garageBeaconMat)
        bLight.position.set(centerX + bx, 1.15, bz)
        group.add(bLight)
      }
    }

    // Add Colliders for Garage Building & Tanks
    bounds.push({
      minX: centerX - 12.5,
      maxX: centerX + 12.5,
      minZ: centerZ - 16.5,
      maxZ: centerZ + 0.2,
      minY: 0,
      maxY: 8.5,
    })
    bounds.push({
      minX: centerX + 12.2,
      maxX: centerX + 16.8,
      minZ: centerZ - 14.5,
      maxZ: centerZ - 1.5,
      minY: 0,
      maxY: 8.5,
    })

    // Collectible Coin near garage
    const coinMesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial)
    coinMesh.rotation.x = Math.PI / 2
    coinMesh.position.set(centerX - 10, 1.2, centerZ + 6)
    coinMesh.castShadow = true
    group.add(coinMesh)
    chunkCoins.push({ mesh: coinMesh, x: centerX - 10, z: centerZ + 6, alive: true })
  }

  private buildPlaza(
    group: THREE.Group,
    _plaza: PlazaInfo,
    centerX: number,
    centerZ: number,
    bounds: Bounds[],
    chunkCoins: Coin[],
  ): void {
    // 1. Lush Green Plaza Lawn
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), this.parkLawnMaterial)
    lawn.rotation.x = -Math.PI / 2
    lawn.position.set(centerX, 0.02, centerZ)
    lawn.receiveShadow = true
    group.add(lawn)

    // 2. Stone Walkways (Cross paths & Circular Promenade)
    const walkH = new THREE.Mesh(new THREE.PlaneGeometry(36, 4.6), this.plazaPathMaterial)
    walkH.rotation.x = -Math.PI / 2
    walkH.position.set(centerX, 0.025, centerZ)
    walkH.receiveShadow = true
    group.add(walkH)

    const walkV = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 36), this.plazaPathMaterial)
    walkV.rotation.x = -Math.PI / 2
    walkV.position.set(centerX, 0.025, centerZ)
    walkV.receiveShadow = true
    group.add(walkV)

    const walkCircle = new THREE.Mesh(new THREE.RingGeometry(4.8, 9.2, 24), this.plazaPathMaterial)
    walkCircle.rotation.x = -Math.PI / 2
    walkCircle.position.set(centerX, 0.026, centerZ)
    walkCircle.receiveShadow = true
    group.add(walkCircle)

    // 2.5 Monster Truck Designated Parking Stall in Praça Central
    if (Math.abs(centerX - (-24)) < 2 && Math.abs(centerZ - 72) < 2) {
      const stallPad = new THREE.Mesh(
        new THREE.PlaneGeometry(5.2, 7.8),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
      )
      stallPad.rotation.x = -Math.PI / 2
      stallPad.position.set(-12.5, 0.03, 72)
      stallPad.receiveShadow = true
      group.add(stallPad)

      // Yellow chevron / boundary stripes for monster truck stall
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.4 })
      const lineLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 7.8), stripeMat)
      lineLeft.rotation.x = -Math.PI / 2
      lineLeft.position.set(-12.5 - 2.5, 0.035, 72)
      group.add(lineLeft)

      const lineRight = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 7.8), stripeMat)
      lineRight.rotation.x = -Math.PI / 2
      lineRight.position.set(-12.5 + 2.5, 0.035, 72)
      group.add(lineRight)

      const lineFront = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.2), stripeMat)
      lineFront.rotation.x = -Math.PI / 2
      lineFront.position.set(-12.5, 0.035, 72 - 3.8)
      group.add(lineFront)
    }

    // 3. Central Fountain (Fonte de Praça)
    const fountainBasin = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.8, 0.75, 18), this.plazaStoneMaterial)
    fountainBasin.position.set(centerX, 0.38, centerZ)
    fountainBasin.castShadow = true
    fountainBasin.receiveShadow = true
    group.add(fountainBasin)

    const fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.12, 18), this.plazaWaterMaterial)
    fountainWater.position.set(centerX, 0.68, centerZ)
    group.add(fountainWater)

    const fountainPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.1, 2.2, 12), this.plazaStoneMaterial)
    fountainPillar.position.set(centerX, 1.35, centerZ)
    fountainPillar.castShadow = true
    group.add(fountainPillar)

    const fountainBowl = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.6, 0.45, 16), this.plazaStoneMaterial)
    fountainBowl.position.set(centerX, 2.35, centerZ)
    fountainBowl.castShadow = true
    group.add(fountainBowl)

    const waterPlume = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 10), this.plazaWaterMaterial)
    waterPlume.position.set(centerX, 3.1, centerZ)
    group.add(waterPlume)

    // Collider for the fountain
    bounds.push({
      minX: centerX - 4.7,
      maxX: centerX + 4.7,
      minZ: centerZ - 4.7,
      maxZ: centerZ + 4.7,
      minY: 0,
      maxY: 3.5,
    })

    // 4. Park Benches (Bancos de madeira voltados para a fonte)
    const benchOffsets: [number, number, number][] = [
      [0, -7.2, 0],
      [0, 7.2, Math.PI],
      [-7.2, 0, Math.PI / 2],
      [7.2, 0, -Math.PI / 2],
    ]
    for (const [bx, bz, rot] of benchOffsets) {
      const bench = new THREE.Group()
      bench.position.set(centerX + bx, 0, centerZ + bz)
      bench.rotation.y = rot

      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.55), this.benchWoodMaterial)
      seat.position.set(0, 0.45, 0)
      seat.castShadow = true
      bench.add(seat)

      const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 0.08), this.benchWoodMaterial)
      back.position.set(0, 0.72, -0.24)
      back.castShadow = true
      bench.add(back)

      for (const lx of [-0.85, 0.85]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.52), this.plazaIronMaterial)
        leg.position.set(lx, 0.22, 0)
        leg.castShadow = true
        bench.add(leg)
      }
      group.add(bench)
    }

    // 5. Colonial Streetlamps (Postes de Iluminação)
    const lampOffsets: [number, number][] = [
      [-6.5, -6.5],
      [6.5, -6.5],
      [-6.5, 6.5],
      [6.5, 6.5],
    ]
    for (const [lx, lz] of lampOffsets) {
      const lamp = new THREE.Group()
      lamp.position.set(centerX + lx, 0, centerZ + lz)

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 8), this.plazaIronMaterial)
      pole.position.set(0, 1.7, 0)
      pole.castShadow = true
      lamp.add(pole)

      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.38), this.plazaLampMaterial)
      lantern.position.set(0, 3.5, 0)
      lamp.add(lantern)
      group.add(lamp)
    }

    // 6. Perimeter Trees (Árvores da Praça)
    const treeOffsets: [number, number][] = [
      [-14, -14], [0, -14.5], [14, -14],
      [-14.5, 0], [14.5, 0],
      [-14, 14], [0, 14.5], [14, 14],
    ]
    for (const [tx, tz] of treeOffsets) {
      const tree = new THREE.Group()
      tree.position.set(centerX + tx, 0, centerZ + tz)

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 2.6, 6), this.treeTrunkMaterial)
      trunk.position.set(0, 1.3, 0)
      trunk.castShadow = true
      tree.add(trunk)

      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6), this.treeFoliageMaterial)
      crown.position.set(0, 3.2, 0)
      crown.castShadow = true
      crown.receiveShadow = true
      tree.add(crown)
      group.add(tree)

      bounds.push({
        minX: centerX + tx - 0.5,
        maxX: centerX + tx + 0.5,
        minZ: centerZ + tz - 0.5,
        maxZ: centerZ + tz + 0.5,
        minY: 0,
        maxY: 4.5,
      })
    }

    // 7. Gold Collectible Coin above fountain
    const coinMesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial)
    coinMesh.rotation.x = Math.PI / 2
    coinMesh.position.set(centerX, 4.3, centerZ)
    coinMesh.castShadow = true
    group.add(coinMesh)
    chunkCoins.push({ mesh: coinMesh, x: centerX, z: centerZ, alive: true })
  }

  private buildLagoon(
    group: THREE.Group,
    lagoon: LagoonInfo,
    centerX: number,
    centerZ: number,
    bounds: Bounds[],
    chunkCoins: Coin[],
  ): void {
    // 1. Lush Green Lawn Base (36x36)
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), this.parkLawnMaterial)
    lawn.rotation.x = -Math.PI / 2
    lawn.position.set(centerX, 0.01, centerZ)
    lawn.receiveShadow = true
    group.add(lawn)

    // 2. Lagoon Shoreline Ring (Stone/Sandy Border)
    const shore = new THREE.Mesh(new THREE.RingGeometry(lagoon.radius, lagoon.radius + 2.5, 24), this.plazaStoneMaterial)
    shore.rotation.x = -Math.PI / 2
    shore.position.set(centerX, 0.025, centerZ)
    group.add(shore)

    // 3. Lagoon Water Disk (Vibrant pure blue visible on top of lawn)
    const water = new THREE.Mesh(new THREE.CircleGeometry(lagoon.radius, 24), this.lagoonWaterMaterial)
    water.rotation.x = -Math.PI / 2
    water.position.set(centerX, 0.022, centerZ)
    group.add(water)

    // Lagoon Water Bed
    const bed = new THREE.Mesh(new THREE.CircleGeometry(lagoon.radius + 1, 24), this.riverBedMaterial)
    bed.rotation.x = -Math.PI / 2
    bed.position.set(centerX, -1.8, centerZ)
    group.add(bed)

    // 4. Wooden Dock (Trapiche da lagoa)
    const dock = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 10), this.benchWoodMaterial)
    dock.position.set(centerX, 0.08, centerZ - lagoon.radius + 4)
    dock.castShadow = true
    dock.receiveShadow = true
    group.add(dock)

    // Dock posts
    for (const dx of [-1.3, 1.3]) {
      for (const dz of [-3, 2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8), this.treeTrunkMaterial)
        post.position.set(centerX + dx, -0.6, centerZ - lagoon.radius + 4 + dz)
        group.add(post)
      }
    }

    // 5. Water Lilies / Lotus Pads floating on the lagoon
    const lilyMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.6 })
    const lilyFlowerMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0x9d174d, emissiveIntensity: 0.3 })
    const lilyPositions: [number, number][] = [
      [-4, 3], [5, -2], [-2, -5], [4, 4], [0, 6], [-6, -3]
    ]
    for (const [lx, lz] of lilyPositions) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.9, 12), lilyMat)
      pad.rotation.x = -Math.PI / 2
      pad.position.set(centerX + lx, 0.03, centerZ + lz)
      group.add(pad)

      if ((lx + lz) % 2 === 0) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), lilyFlowerMat)
        flower.position.set(centerX + lx, 0.12, centerZ + lz)
        group.add(flower)
      }
    }

    // 6. Park Trees around the lagoon
    const treeOffsets: [number, number][] = [
      [-14, -14], [14, -14], [-14, 14], [14, 14],
      [0, 15], [-15, 0], [15, 0]
    ]
    for (const [tx, tz] of treeOffsets) {
      const tree = new THREE.Group()
      tree.position.set(centerX + tx, 0, centerZ + tz)

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 2.6, 6), this.treeTrunkMaterial)
      trunk.position.set(0, 1.3, 0)
      trunk.castShadow = true
      tree.add(trunk)

      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6), this.treeFoliageMaterial)
      crown.position.set(0, 3.2, 0)
      crown.castShadow = true
      crown.receiveShadow = true
      tree.add(crown)
      group.add(tree)

      bounds.push({
        minX: centerX + tx - 0.5,
        maxX: centerX + tx + 0.5,
        minZ: centerZ + tz - 0.5,
        maxZ: centerZ + tz + 0.5,
        minY: 0,
        maxY: 4.5,
      })
    }

    // Gold Collectible Coin on the dock
    const coinMesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial)
    coinMesh.rotation.x = Math.PI / 2
    coinMesh.position.set(centerX, 1.1, centerZ - lagoon.radius + 7)
    coinMesh.castShadow = true
    group.add(coinMesh)
    chunkCoins.push({ mesh: coinMesh, x: centerX, z: centerZ - lagoon.radius + 7, alive: true })
  }

  private buildKingKongPlaza(
    group: THREE.Group,
    centerX: number,
    centerZ: number,
    bounds: Bounds[],
    chunkCoins: Coin[],
  ): void {
    // 1. Concrete Plaza Pavement (36x36)
    const pavement = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), this.plazaPathMaterial)
    pavement.rotation.x = -Math.PI / 2
    pavement.position.set(centerX, 0.02, centerZ)
    pavement.receiveShadow = true
    group.add(pavement)

    // 2. Corner Street Lamps
    for (const lx of [-15, 15]) {
      for (const lz of [-15, 15]) {
        const lamp = new THREE.Group()
        lamp.position.set(centerX + lx, 0, centerZ + lz)
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.8, 8), this.plazaIronMaterial)
        pole.position.y = 1.9
        pole.castShadow = true
        lamp.add(pole)
        const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), this.plazaLampMaterial)
        lantern.position.y = 3.8
        lamp.add(lantern)
        group.add(lamp)
      }
    }

    // 3. Perimeter Trees
    for (const tx of [-14, 14]) {
      const tree = new THREE.Group()
      tree.position.set(centerX + tx, 0, centerZ)
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 2.8, 6), this.treeTrunkMaterial)
      trunk.position.y = 1.4
      trunk.castShadow = true
      tree.add(trunk)
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8), this.treeFoliageMaterial)
      crown.position.y = 3.6
      crown.castShadow = true
      tree.add(crown)
      group.add(tree)
    }

    // 4. Solid Bounds for ground and air safety (reaches 110m high!)
    bounds.push({
      minX: centerX - 15.5,
      maxX: centerX + 15.5,
      minZ: centerZ - 15.5,
      maxZ: centerZ + 15.5,
      minY: 0,
      maxY: 110,
    })

    // 5. Gold Collectible Coin in front of King Kong Skyscraper
    const coinMesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial)
    coinMesh.rotation.x = Math.PI / 2
    coinMesh.position.set(centerX, 1.2, centerZ + 12)
    coinMesh.castShadow = true
    group.add(coinMesh)
    chunkCoins.push({ mesh: coinMesh, x: centerX, z: centerZ + 12, alive: true })
  }

  private addRiver(
    group: THREE.Group,
    centerX: number,
    centerZ: number,
    width: number,
    depth: number,
    side: 'west' | 'east',
    bounds: Bounds[],
  ): void {
    // 1. River Water Plane
    const water = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), this.riverWaterMaterial)
    water.rotation.x = -Math.PI / 2
    water.position.set(centerX, -0.75, centerZ)
    group.add(water)

    // 2. Riverbed
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(width + 4, depth), this.riverBedMaterial)
    bed.rotation.x = -Math.PI / 2
    bed.position.set(centerX, -2.6, centerZ)
    group.add(bed)

    // 3. Inner Embankment Wall (Cais da Cidade)
    const cityEdgeX = side === 'west' ? centerX + width / 2 : centerX - width / 2
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, depth), this.embankmentMaterial)
    wall.position.set(cityEdgeX, -0.5, centerZ)
    wall.receiveShadow = true
    group.add(wall)

    // Safety parapet wall with openings for bridges
    for (let row = 0; row < 4; row += 1) {
      const roadZ = centerZ - depth / 2 + row * BLOCK
      const nextRoadZ = roadZ + BLOCK
      const wallCenterZ = (roadZ + nextRoadZ) / 2
      const wallLength = BLOCK - ROAD_WIDTH - 2

      const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, wallLength), this.embankmentMaterial)
      parapet.position.set(cityEdgeX, 0.45, wallCenterZ)
      parapet.castShadow = true
      group.add(parapet)

      bounds.push({
        minX: cityEdgeX - 0.7,
        maxX: cityEdgeX + 0.7,
        minZ: wallCenterZ - wallLength / 2,
        maxZ: wallCenterZ + wallLength / 2,
        minY: 0,
        maxY: 1.5,
      })
    }

    // 4. Outer Natural Riverbank
    const outerEdgeX = side === 'west' ? centerX - width / 2 - 2 : centerX + width / 2 + 2
    const outerBank = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, depth), this.outerBankMaterial)
    outerBank.position.set(outerEdgeX, -0.2, centerZ)
    group.add(outerBank)

    bounds.push({
      minX: side === 'west' ? outerEdgeX - 5 : outerEdgeX - 1,
      maxX: side === 'west' ? outerEdgeX + 1 : outerEdgeX + 5,
      minZ: centerZ - depth / 2,
      maxZ: centerZ + depth / 2,
      minY: -2,
      maxY: 10,
    })
  }

  private addBridge(
    group: THREE.Group,
    centerX: number,
    centerZ: number,
    width: number,
    roadWidth: number,
    bounds: Bounds[],
  ): void {
    // 1. Asphalt Roadway Deck
    const bridgeRoad = new THREE.Mesh(new THREE.PlaneGeometry(width, roadWidth), this.asphalt)
    bridgeRoad.rotation.x = -Math.PI / 2
    bridgeRoad.position.set(centerX, 0.02, centerZ)
    bridgeRoad.receiveShadow = true
    group.add(bridgeRoad)

    // 2. Concrete Bridge Deck Structure
    const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.85, roadWidth + 0.8), this.embankmentMaterial)
    bridgeDeck.position.set(centerX, -0.42, centerZ)
    bridgeDeck.receiveShadow = true
    group.add(bridgeDeck)

    // 3. Support Piers in the river
    for (const offset of [-width * 0.28, width * 0.28]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.5, roadWidth - 2), this.embankmentMaterial)
      pier.position.set(centerX + offset, -1.3, centerZ)
      pier.castShadow = true
      group.add(pier)
    }

    // 4. Bridge Railings (Guard-rails Norte e Sul)
    for (const side of [-1, 1]) {
      const railZ = centerZ + side * (roadWidth / 2 + 0.3)
      const railing = new THREE.Mesh(new THREE.BoxGeometry(width, 0.85, 0.32), this.bridgeRailMaterial)
      railing.position.set(centerX, 0.45, railZ)
      railing.castShadow = true
      group.add(railing)

      bounds.push({
        minX: centerX - width / 2,
        maxX: centerX + width / 2,
        minZ: railZ - 0.3,
        maxZ: railZ + 0.3,
        minY: 0,
        maxY: 1.6,
      })
    }
  }

  isRiver(x: number, z: number): boolean {
    const inWest = x <= -348 && x >= -410
    const inEast = x >= 348 && x <= 410
    if (!inWest && !inEast) return false
    const roadZ = Math.round(z / BLOCK) * BLOCK
    if (Math.abs(z - roadZ) <= ROAD_WIDTH / 2 + 0.6) return false
    return true
  }

  updateOcclusion(camera: THREE.Vector3, vehicle: THREE.Vector3): void {
    for (const chunk of this.chunks.values()) {
      let changed = false
      for (const visual of [...chunk.buildingVisuals, ...chunk.houseVisuals]) {
        const faded = this.segmentHitsBounds(camera, vehicle, visual.bounds)
        if (visual.faded !== faded) {
          visual.faded = faded
          changed = true
        }
      }
      if (changed) this.refreshInstances(chunk)
    }
  }

  private segmentHitsBounds(start: THREE.Vector3, end: THREE.Vector3, bounds: Bounds): boolean {
    const directionX = end.x - start.x
    const directionY = end.y - start.y
    const directionZ = end.z - start.z
    let near = 0
    let far = 1

    const clipAxis = (origin: number, direction: number, minimum: number, maximum: number): boolean => {
      if (Math.abs(direction) < 1e-6) return origin >= minimum && origin <= maximum
      const inverse = 1 / direction
      let first = (minimum - origin) * inverse
      let second = (maximum - origin) * inverse
      if (first > second) [first, second] = [second, first]
      near = Math.max(near, first)
      far = Math.min(far, second)
      return near <= far
    }

    return clipAxis(start.x, directionX, bounds.minX, bounds.maxX)
      && clipAxis(start.y, directionY, bounds.minY, bounds.maxY)
      && clipAxis(start.z, directionZ, bounds.minZ, bounds.maxZ)
      && far >= 0 && near <= 1
  }

  private refreshInstances(chunk: CityChunk): void {
    this.writeVisuals(chunk.buildings, chunk.fadedBuildings, chunk.buildingVisuals)
    this.writeVisuals(chunk.roofInstances, chunk.fadedRoofInstances, chunk.buildingVisuals, true)
    this.writeVisuals(chunk.houses, chunk.fadedHouses, chunk.houseVisuals)
    this.writeVisuals(chunk.houseRoofs, chunk.fadedHouseRoofs, chunk.houseVisuals, true)
  }

  private writeVisuals(opaque: THREE.InstancedMesh, translucent: THREE.InstancedMesh, visuals: BuildingVisual[], roof = false): void {
    let opaqueIndex = 0
    let translucentIndex = 0
    for (const visual of visuals) {
      if (roof && !visual.roofMatrix) continue
      const target = visual.faded ? translucent : opaque
      const index = visual.faded ? translucentIndex++ : opaqueIndex++
      target.setMatrixAt(index, roof ? visual.roofMatrix! : visual.matrix)
      target.setColorAt(index, roof ? visual.roofColor! : visual.color)
    }
    opaque.count = opaqueIndex
    translucent.count = translucentIndex
    opaque.visible = opaqueIndex > 0
    translucent.visible = translucentIndex > 0
    for (const mesh of [opaque, translucent]) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }

  collectAt(x: number, z: number): number {
    let collected = 0
    for (const coin of this.coins) {
      if (!coin.alive || Math.hypot(coin.x - x, coin.z - z) > 2.25) continue
      coin.alive = false
      coin.mesh.visible = false
      collected += 1
    }
    return collected
  }

  collides(x: number, z: number, radius: number): boolean {
    for (const box of this.colliders) {
      const nearestX = THREE.MathUtils.clamp(x, box.minX, box.maxX)
      const nearestZ = THREE.MathUtils.clamp(z, box.minZ, box.maxZ)
      const dx = x - nearestX
      const dz = z - nearestZ
      if (dx * dx + dz * dz < radius * radius) return true
    }
    return false
  }

  resolveCollision(x: number, z: number, radius: number): { x: number; z: number; collided: boolean; normalX: number; normalZ: number } {
    let resolvedX = x
    let resolvedZ = z
    let anyCollision = false
    let normalX = 0
    let normalZ = 0

    // 2 passes to handle corners where two buildings meet
    for (let iter = 0; iter < 2; iter += 1) {
      for (const box of this.colliders) {
        const clampedX = THREE.MathUtils.clamp(resolvedX, box.minX, box.maxX)
        const clampedZ = THREE.MathUtils.clamp(resolvedZ, box.minZ, box.maxZ)
        const dx = resolvedX - clampedX
        const dz = resolvedZ - clampedZ
        const distSq = dx * dx + dz * dz

        if (distSq < radius * radius) {
          anyCollision = true
          const dist = Math.sqrt(distSq)
          if (dist > 0.0001) {
            const overlap = radius - dist
            const nx = dx / dist
            const nz = dz / dist
            resolvedX += nx * overlap
            resolvedZ += nz * overlap
            normalX = nx
            normalZ = nz
          } else {
            // Inside the collider: push outward to closest boundary
            const leftDist = resolvedX - box.minX + radius
            const rightDist = box.maxX - resolvedX + radius
            const topDist = resolvedZ - box.minZ + radius
            const bottomDist = box.maxZ - resolvedZ + radius
            const minDist = Math.min(leftDist, rightDist, topDist, bottomDist)

            if (minDist === leftDist) {
              resolvedX = box.minX - radius
              normalX = -1
              normalZ = 0
            } else if (minDist === rightDist) {
              resolvedX = box.maxX + radius
              normalX = 1
              normalZ = 0
            } else if (minDist === topDist) {
              resolvedZ = box.minZ - radius
              normalX = 0
              normalZ = -1
            } else {
              resolvedZ = box.maxZ + radius
              normalX = 0
              normalZ = 1
            }
          }
        }
      }
    }

    return { x: resolvedX, z: resolvedZ, collided: anyCollision, normalX, normalZ }
  }

  collides3D(x: number, y: number, z: number, radius: number): boolean {
    if (y < radius) return true
    for (const box of this.colliders) {
      if (y - radius > box.maxY || y + radius < box.minY) continue
      const nearestX = THREE.MathUtils.clamp(x, box.minX, box.maxX)
      const nearestZ = THREE.MathUtils.clamp(z, box.minZ, box.maxZ)
      const dx = x - nearestX
      const dz = z - nearestZ
      if (dx * dx + dz * dz < radius * radius) return true
    }
    return false
  }

  get3DColliders(): readonly Bounds[] {
    return this.colliders
  }

  isInWater(x: number, z: number): boolean {
    const absX = Math.abs(x)
    if (absX >= 348 && absX <= 410) {
      const bridgeZ = Math.abs(THREE.MathUtils.euclideanModulo(z + 7.5, BLOCK) - 7.5)
      if (bridgeZ < 8.0) {
        return false
      }
      return true
    }

    const currentBlockX = Math.round((x - BLOCK / 2) / BLOCK)
    const currentBlockZ = Math.round((z - BLOCK / 2) / BLOCK) * BLOCK + BLOCK / 2
    for (let bx = currentBlockX - 1; bx <= currentBlockX + 1; bx += 1) {
      for (let bzOffset = -BLOCK; bzOffset <= BLOCK; bzOffset += BLOCK) {
        const bz = currentBlockZ + bzOffset
        const lagoon = this.getLagoonAt(bx, bz)
        if (lagoon) {
          const dx = x - lagoon.x
          const dz = z - lagoon.z
          if (dx * dx + dz * dz <= lagoon.radius * lagoon.radius) {
            return true
          }
        }
      }
    }

    return false
  }

  clear(): void {
    for (const [index, chunk] of this.chunks) this.removeChunk(index, chunk)
  }

  private removeChunk(index: number, chunk: CityChunk): void {
    this.root.remove(chunk.group)
    chunk.group.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry !== this.coinGeometry) object.geometry.dispose()
    })
    chunk.groundMaterial.dispose()
    this.colliders.splice(0, this.colliders.length, ...this.colliders.filter((bound) => !chunk.bounds.includes(bound)))
    this.coins.splice(0, this.coins.length, ...this.coins.filter((coin) => !chunk.coins.includes(coin)))
    this.chunks.delete(index)
    if (index === 0) {
      this.trafficLightVisuals.length = 0
    }
  }

  private buildTrafficLightMeshes(group: THREE.Group, rx: number, rz: number): void {
    const postHeight = 3.6
    const postGeometry = new THREE.CylinderGeometry(0.09, 0.11, postHeight, 8)
    const postMaterial = new THREE.MeshStandardMaterial({ color: 0x272b2e, roughness: 0.8, metalness: 0.3 })
    const boxGeometry = new THREE.BoxGeometry(0.32, 0.88, 0.32)
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x111314, roughness: 0.9 })
    const bulbGeometry = new THREE.SphereGeometry(0.08, 8, 8)

    // Colocamos postes nos cantos opostos da esquina da calçada: Nordeste e Sudoeste
    const offsets = [
      { dx: 8.5, dz: -8.5, rotY: 0 },
      { dx: -8.5, dz: 8.5, rotY: Math.PI }
    ]

    for (const offset of offsets) {
      const px = rx + offset.dx
      const pz = rz + offset.dz

      const poleGroup = new THREE.Group()
      poleGroup.position.set(px, 0, pz)

      // 1. O poste vertical de ferro
      const pole = new THREE.Mesh(postGeometry, postMaterial)
      pole.position.y = postHeight / 2
      pole.castShadow = true
      pole.receiveShadow = true
      poleGroup.add(pole)

      // 2. Caixa de luz para Avenida Z (apontando Norte/Sul)
      const boxZ = new THREE.Mesh(boxGeometry, boxMaterial)
      boxZ.position.set(0, postHeight + 0.3, -0.2)
      poleGroup.add(boxZ)

      // Lâmpadas da Avenida Z (Vermelha, Amarela, Verde)
      const redZ = new THREE.Mesh(bulbGeometry, this.lightOffRed)
      redZ.position.set(0, postHeight + 0.6, -0.34)
      poleGroup.add(redZ)

      const yellowZ = new THREE.Mesh(bulbGeometry, this.lightOffYellow)
      yellowZ.position.set(0, postHeight + 0.3, -0.34)
      poleGroup.add(yellowZ)

      const greenZ = new THREE.Mesh(bulbGeometry, this.lightOffGreen)
      greenZ.position.set(0, postHeight, -0.34)
      poleGroup.add(greenZ)

      this.trafficLightVisuals.push({ axis: 'z', red: redZ, yellow: yellowZ, green: greenZ })

      // 3. Caixa de luz para Rua transversal X (apontando Leste/Oeste, ou seja, rotacionada 90 graus)
      const boxX = new THREE.Mesh(boxGeometry, boxMaterial)
      boxX.position.set(-0.2, postHeight + 0.3, 0)
      poleGroup.add(boxX)

      // Lâmpadas da Rua transversal X (Vermelha, Amarela, Verde)
      const redX = new THREE.Mesh(bulbGeometry, this.lightOffRed)
      redX.position.set(-0.34, postHeight + 0.6, 0)
      poleGroup.add(redX)

      const yellowX = new THREE.Mesh(bulbGeometry, this.lightOffYellow)
      yellowX.position.set(-0.34, postHeight + 0.3, 0)
      poleGroup.add(yellowX)

      const greenX = new THREE.Mesh(bulbGeometry, this.lightOffGreen)
      greenX.position.set(-0.34, postHeight, 0)
      poleGroup.add(greenX)

      this.trafficLightVisuals.push({ axis: 'x', red: redX, yellow: yellowX, green: greenX })

      // Rotaciona o grupo de acordo com o canto da rua
      poleGroup.rotation.y = offset.rotY
      group.add(poleGroup)
    }
  }

  private updateTrafficLightVisuals(): void {
    const timer = this.trafficLightTimer
    const isZRed = timer >= 6.0
    const isZYellow = timer >= 5.2 && timer < 6.0
    const isZGreen = timer < 5.2

    const isXRed = timer < 6.0
    const isXYellow = timer >= 11.2 && timer < 12.0
    const isXGreen = timer >= 6.0 && timer < 11.2

    for (const visual of this.trafficLightVisuals) {
      if (visual.axis === 'z') {
        visual.red.material = isZRed ? this.lightOnRed : this.lightOffRed
        visual.yellow.material = isZYellow ? this.lightOnYellow : this.lightOffYellow
        visual.green.material = isZGreen ? this.lightOnGreen : this.lightOffGreen
      } else {
        visual.red.material = isXRed ? this.lightOnRed : this.lightOffRed
        visual.yellow.material = isXYellow ? this.lightOnYellow : this.lightOffYellow
        visual.green.material = isXGreen ? this.lightOnGreen : this.lightOffGreen
      }
    }
  }

  isTrafficLightAt(x: number, z: number): boolean {
    return TRAFFIC_LIGHT_INTERSECTIONS.some(corner => Math.abs(x - corner.x) < 4.0 && Math.abs(z - corner.z) < 4.0)
  }

  isTrafficLightRedFor(x: number, z: number, axis: 'x' | 'z'): boolean {
    if (!this.isTrafficLightAt(x, z)) return false
    const timer = this.trafficLightTimer
    if (axis === 'z') {
      // Avenida (Z) fica parada no Vermelho (timer >= 6.0) ou Amarelo (timer >= 5.2)
      return timer >= 5.2 && timer < 12.0
    } else {
      // Rua lateral (X) fica parada no Vermelho (timer < 6.0) ou Amarelo (timer >= 11.2)
      return (timer >= 0 && timer < 6.0) || timer >= 11.2
    }
  }

  update(dt: number): void {
    for (const coin of this.coins) {
      if (coin.alive) coin.mesh.rotation.z += dt * 1.8
    }

    // Atualizar temporizador global do semáforo
    this.trafficLightTimer += dt
    if (this.trafficLightTimer >= 12.0) {
      this.trafficLightTimer = 0
    }

    this.updateTrafficLightVisuals()
  }

  dispose(): void {
    this.clear()
    this.scene.remove(this.root, this.ground)
    this.ground.geometry.dispose()
    const groundMaterial = this.ground.material
    if (groundMaterial instanceof THREE.Material) groundMaterial.dispose()
    this.coinGeometry.dispose()
    this.coinMaterial.dispose()
    this.asphalt.dispose()
    this.lanePaint.dispose()
    this.sidewalk.dispose()
    this.buildingBatchMaterial.dispose()
    this.fadedBuildingMaterial.dispose()
    this.roofBatchMaterial.dispose()
    this.fadedRoofMaterial.dispose()
    this.houseBatchMaterial.dispose()
    this.fadedHouseMaterial.dispose()
    this.houseRoofMaterial.dispose()
    this.fadedHouseRoofMaterial.dispose()
    this.houseWindowMaterial.dispose()
    this.houseDoorMaterial.dispose()
    this.parkLawnMaterial.dispose()
    this.plazaPathMaterial.dispose()
    this.plazaStoneMaterial.dispose()
    this.plazaWaterMaterial.dispose()
    this.benchWoodMaterial.dispose()
    this.plazaIronMaterial.dispose()
    this.plazaLampMaterial.dispose()
    this.treeTrunkMaterial.dispose()
    this.treeFoliageMaterial.dispose()
    this.riverWaterMaterial.dispose()
    this.lagoonWaterMaterial.dispose()
    this.riverBedMaterial.dispose()
    this.embankmentMaterial.dispose()
    this.outerBankMaterial.dispose()
    this.bridgeRailMaterial.dispose()
    this.runwayAsphalt.dispose()
    this.runwayPaintWhite.dispose()
    this.runwayPaintYellow.dispose()
    this.runwayLightGreen.dispose()
    this.runwayLightWhite.dispose()
    this.runwayLightRed.dispose()
    this.airportBuildingMat.dispose()
    this.airportRoofMat.dispose()
    this.buildingMaterials[0].map?.dispose()
    for (const material of this.buildingMaterials) material.dispose()
  }
}
