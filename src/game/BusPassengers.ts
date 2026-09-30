import * as THREE from 'three'

export interface BusPassenger {
  id: number
  position: THREE.Vector3
  root: THREE.Group
  collected: boolean
  beaconRing: THREE.Mesh
  targetMarker: THREE.Group
}

export class BusPassengers {
  private readonly scene: THREE.Scene
  readonly passengers: BusPassenger[] = []
  private active = false
  private collectedCount = 0
  private readonly totalTarget = 6
  private animTimer = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  get isCompleted(): boolean {
    return this.collectedCount >= this.totalTarget
  }

  get count(): number {
    return this.collectedCount
  }

  get target(): number {
    return this.totalTarget
  }

  get isActive(): boolean {
    return this.active
  }

  spawnPassengersAround(busPosition: THREE.Vector3): void {
    this.clear()
    this.active = true
    this.collectedCount = 0

    const BLOCK = 48
    const baseBlockX = Math.round(busPosition.x / BLOCK)
    const baseBlockZ = Math.round(busPosition.z / BLOCK)

    // Specific safe asphalt road grid positions (using avenue X multiples of BLOCK or street Z multiples of BLOCK)
    const roadOffsets = [
      { rx: baseBlockX + 1, rz: baseBlockZ, offsetX: 0, offsetZ: 14 },
      { rx: baseBlockX - 1, rz: baseBlockZ + 1, offsetX: 0, offsetZ: -14 },
      { rx: baseBlockX + 2, rz: baseBlockZ - 1, offsetX: 0, offsetZ: 8 },
      { rx: baseBlockX, rz: baseBlockZ + 1, offsetX: 14, offsetZ: 0 },
      { rx: baseBlockX - 1, rz: baseBlockZ + 2, offsetX: -14, offsetZ: 0 },
      { rx: baseBlockX + 1, rz: baseBlockZ - 2, offsetX: 8, offsetZ: 0 },
    ]

    roadOffsets.forEach((off, idx) => {
      let px = off.rx * BLOCK + off.offsetX
      let pz = off.rz * BLOCK + off.offsetZ

      // Ensure passengers are inside the main city boundaries (-300 to 300) away from river limits
      px = THREE.MathUtils.clamp(px, -300, 300)
      const pos = new THREE.Vector3(px, 0, pz)

      const group = new THREE.Group()

      // 1. Pedestrian NPC Mesh (Passageiro)
      const torsoGeo = new THREE.BoxGeometry(0.48, 0.72, 0.3)
      const headGeo = new THREE.SphereGeometry(0.22, 10, 8)
      const clothesMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.65,
        roughness: 0.3,
      })
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd1a4, roughness: 0.8 })

      const torso = new THREE.Mesh(torsoGeo, clothesMat)
      torso.position.set(0, 0.9, 0)
      torso.castShadow = true
      group.add(torso)

      const head = new THREE.Mesh(headGeo, skinMat)
      head.position.set(0, 1.48, 0)
      head.castShadow = true
      group.add(head)

      // 2. Glowing Ground Target Ring
      const ringGeo = new THREE.RingGeometry(1.6, 2.6, 24)
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
      const beaconRing = new THREE.Mesh(ringGeo, ringMat)
      beaconRing.rotation.x = -Math.PI / 2
      beaconRing.position.set(0, 0.03, 0)
      group.add(beaconRing)

      // 3. Hovering Target Marker Ring & Light Beam above head
      const markerGroup = new THREE.Group()
      markerGroup.position.set(0, 2.6, 0)

      const torusGeo = new THREE.TorusGeometry(0.55, 0.12, 10, 20)
      const torusMat = new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0xffaa00,
        emissiveIntensity: 1.2,
      })
      const torusMesh = new THREE.Mesh(torusGeo, torusMat)
      torusMesh.rotation.x = Math.PI / 2
      markerGroup.add(torusMesh)

      // Vertical Light Beam
      const beamGeo = new THREE.CylinderGeometry(0.8, 0.8, 12, 12, 1, true)
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
      })
      const beamMesh = new THREE.Mesh(beamGeo, beamMat)
      beamMesh.position.set(0, 6, 0)
      markerGroup.add(beamMesh)

      group.add(markerGroup)
      group.position.copy(pos)

      this.scene.add(group)

      this.passengers.push({
        id: idx + 1,
        position: pos,
        root: group,
        collected: false,
        beaconRing,
        targetMarker: markerGroup,
      })
    })
  }

  update(dt: number, busPosition: THREE.Vector3, inBus: boolean): { collected: boolean; remaining: number; total: number; pos?: THREE.Vector3 } {
    if (!this.active) return { collected: false, remaining: this.totalTarget - this.collectedCount, total: this.totalTarget }

    this.animTimer += dt
    const pulse = 1 + 0.25 * Math.sin(this.animTimer * 6)

    let newlyCollected = false
    let collectedPos: THREE.Vector3 | undefined

    for (const passenger of this.passengers) {
      if (passenger.collected) continue

      // Animate ground ring and hovering marker
      passenger.targetMarker.rotation.y += dt * 2.5
      passenger.beaconRing.scale.setScalar(pulse)

      if (inBus) {
        // "o onibus deve passar por cima da pessoa, como se estivesse pegando um passageiro"
        const dx = passenger.position.x - busPosition.x
        const dz = passenger.position.z - busPosition.z
        const distSq = dx * dx + dz * dz

        if (distSq < 4.2 * 4.2) {
          passenger.collected = true
          passenger.root.visible = false
          this.collectedCount += 1
          newlyCollected = true
          collectedPos = passenger.position.clone()
        }
      }
    }

    return {
      collected: newlyCollected,
      remaining: this.totalTarget - this.collectedCount,
      total: this.totalTarget,
      pos: collectedPos,
    }
  }

  getNearestPassengerDistance(fromPos: THREE.Vector3): number | null {
    let minDist = Infinity
    for (const p of this.passengers) {
      if (p.collected) continue
      const dist = p.position.distanceTo(fromPos)
      if (dist < minDist) minDist = dist
    }
    return minDist === Infinity ? null : minDist
  }

  getPassengerLocations(): { x: number; z: number; collected: boolean }[] {
    return this.passengers.map((p) => ({ x: p.position.x, z: p.position.z, collected: p.collected }))
  }

  clear(): void {
    for (const p of this.passengers) {
      this.scene.remove(p.root)
      p.root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose()
      })
    }
    this.passengers.length = 0
    this.active = false
    this.collectedCount = 0
  }

  dispose(): void {
    this.clear()
  }
}
