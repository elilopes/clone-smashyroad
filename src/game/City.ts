import * as THREE from 'three'

const BLOCK = 48
const ROAD_WIDTH = 15
const CHUNK_DEPTH = 192
const WORLD_HALF_WIDTH = 244

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

    const laneMarkCount = 11 * 16 + 5 * 35
    const laneMarks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.025, 3.5), this.lanePaint, laneMarkCount)
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    let markIndex = 0

    for (let road = -5; road <= 5; road += 1) {
      const roadX = road * BLOCK
      this.addRoad(group, new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_DEPTH), roadX, zMiddle)
      for (let dash = 0; dash < 16; dash += 1) {
        position.set(roadX, 0.03, zStart + dash * 12 + 4)
        scale.set(0.13, 1, 1)
        matrix.compose(position, rotation, scale)
        laneMarks.setMatrixAt(markIndex++, matrix)
      }
    }

    for (let road = 0; road <= CHUNK_DEPTH / BLOCK; road += 1) {
      const roadZ = zStart + road * BLOCK
      this.addRoad(group, new THREE.PlaneGeometry(WORLD_HALF_WIDTH * 2, ROAD_WIDTH), 0, roadZ)
      for (let dash = 0; dash < 35; dash += 1) {
        position.set(-WORLD_HALF_WIDTH + dash * 14 + 5, 0.03, roadZ)
        scale.set(3.3, 1, 0.13 / 3.5)
        matrix.compose(position, rotation, scale)
        laneMarks.setMatrixAt(markIndex++, matrix)
      }
    }
    laneMarks.instanceMatrix.needsUpdate = true
    group.add(laneMarks)

    const buildingCapacity = 40
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

    for (let blockX = -5; blockX <= 4; blockX += 1) {
      for (let row = 0; row < 4; row += 1) {
        if (random() < 0.11) continue
        const centerX = blockX * BLOCK + BLOCK / 2
        const centerZ = zStart + row * BLOCK + BLOCK / 2
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

  update(dt: number): void {
    for (const coin of this.coins) {
      if (coin.alive) coin.mesh.rotation.z += dt * 1.8
    }
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
    this.buildingMaterials[0].map?.dispose()
    for (const material of this.buildingMaterials) material.dispose()
  }
}
