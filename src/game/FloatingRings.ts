import * as THREE from 'three'

export interface RingData {
  id: number
  position: THREE.Vector3
  radius: number
  rotationY: number
  mesh: THREE.Group
  torusMesh: THREE.Mesh
  coreMesh: THREE.Mesh
  collected: boolean
  cooldownTimer: number
}

export interface RingCollectResult {
  collected: boolean
  ringId: number
  consecutiveCount: number
  missionCompleted: boolean
  position: THREE.Vector3
  rewardPoints: number
  rewardCash: number
}

export class FloatingRings {
  private readonly scene: THREE.Scene
  readonly root = new THREE.Group()
  readonly rings: RingData[] = []
  private readonly torusGeometry = new THREE.TorusGeometry(4.8, 0.42, 14, 32)
  private readonly coreGeometry = new THREE.TorusGeometry(3.6, 0.16, 8, 24)
  private readonly ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00d2ff,
    emissiveIntensity: 1.8,
    roughness: 0.15,
    metalness: 0.2,
  })
  private readonly goldRingMaterial = new THREE.MeshStandardMaterial({
    color: 0xffb703,
    emissive: 0xfb8500,
    emissiveIntensity: 2.2,
    roughness: 0.15,
    metalness: 0.3,
  })
  private readonly collectedMaterial = new THREE.MeshStandardMaterial({
    color: 0x475569,
    emissive: 0x1e293b,
    emissiveIntensity: 0.2,
    roughness: 0.8,
    transparent: true,
    opacity: 0.35,
  })

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.scene.add(this.root)
    this.generateRings()
  }

  private generateRings(): void {
    // Waypoints forming a thrilling city aerial course
    const waypoints: { x: number; y: number; z: number; rotY?: number; gold?: boolean }[] = [
      // 1. Runway departure climb
      { x: 144, y: 16, z: -40, rotY: 0 },
      { x: 144, y: 26, z: 30, rotY: 0 },
      { x: 144, y: 34, z: 100, rotY: 0 },

      // 2. Turn over East Plaza & River
      { x: 96, y: 38, z: 160, rotY: Math.PI / 4 },
      { x: 24, y: 42, z: 180, rotY: Math.PI / 2 },
      { x: -48, y: 40, z: 160, rotY: (3 * Math.PI) / 4 },

      // 3. Central Avenue Fly-through (between skyscrapers)
      { x: -96, y: 36, z: 90, rotY: Math.PI },
      { x: -96, y: 30, z: 0, rotY: Math.PI },
      { x: -96, y: 24, z: -80, rotY: Math.PI },

      // 4. Low bridge buzz & West River
      { x: -144, y: 18, z: -140, rotY: -Math.PI / 4 },
      { x: -48, y: 22, z: -180, rotY: 0 },
      { x: 48, y: 30, z: -180, rotY: Math.PI / 2 },

      // 5. High altitude skyline pass
      { x: 0, y: 48, z: -100, rotY: Math.PI / 3, gold: true },
      { x: 0, y: 52, z: 0, rotY: 0, gold: true },
      { x: 0, y: 46, z: 100, rotY: -Math.PI / 3, gold: true },

      // 6. Extended city tour loops
      { x: 192, y: 28, z: 0, rotY: Math.PI / 2 },
      { x: 192, y: 32, z: 120, rotY: Math.PI / 4 },
      { x: -192, y: 30, z: 40, rotY: -Math.PI / 3 },
      { x: -192, y: 25, z: -60, rotY: 0 },
      { x: 48, y: 35, z: 48, rotY: Math.PI / 6 },
    ]

    waypoints.forEach((wp, index) => {
      const group = new THREE.Group()
      group.position.set(wp.x, wp.y, wp.z)
      group.rotation.y = wp.rotY ?? 0

      const torusMat = wp.gold ? this.goldRingMaterial : this.ringMaterial
      const torusMesh = new THREE.Mesh(this.torusGeometry, torusMat)
      torusMesh.castShadow = false
      torusMesh.receiveShadow = false
      group.add(torusMesh)

      const coreMesh = new THREE.Mesh(this.coreGeometry, torusMat)
      group.add(coreMesh)

      // Light beacon at top & bottom of ring
      const beaconGeo = new THREE.SphereGeometry(0.3, 8, 8)
      const beaconMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x00ffff,
        emissiveIntensity: 2.5,
      })
      const topBeacon = new THREE.Mesh(beaconGeo, beaconMat)
      topBeacon.position.set(0, 4.8, 0)
      group.add(topBeacon)

      const bottomBeacon = new THREE.Mesh(beaconGeo, beaconMat)
      bottomBeacon.position.set(0, -4.8, 0)
      group.add(bottomBeacon)

      this.root.add(group)

      this.rings.push({
        id: index + 1,
        position: new THREE.Vector3(wp.x, wp.y, wp.z),
        radius: 5.2,
        rotationY: wp.rotY ?? 0,
        mesh: group,
        torusMesh,
        coreMesh,
        collected: false,
        cooldownTimer: 0,
      })
    })
  }

  update(dt: number, planePosition: THREE.Vector3, isPlaneActive: boolean, consecutiveCount: number): RingCollectResult | null {
    let result: RingCollectResult | null = null

    for (const ring of this.rings) {
      // Gentle floating spin animation
      ring.mesh.rotation.z += dt * 0.8
      ring.coreMesh.rotation.z -= dt * 1.4

      if (ring.collected) {
        ring.cooldownTimer -= dt
        if (ring.cooldownTimer <= 0) {
          ring.collected = false
          ring.torusMesh.material = this.ringMaterial
          ring.coreMesh.material = this.ringMaterial
          ring.mesh.scale.set(1, 1, 1)
        }
        continue
      }

      // Check plane passing through ring
      if (isPlaneActive) {
        const dist = planePosition.distanceTo(ring.position)
        if (dist <= ring.radius) {
          ring.collected = true
          ring.cooldownTimer = 18.0 // respawn after 18 seconds
          ring.torusMesh.material = this.collectedMaterial
          ring.coreMesh.material = this.collectedMaterial
          ring.mesh.scale.set(1.35, 1.35, 1.35)

          const newCount = consecutiveCount + 1
          const missionCompleted = newCount === 7

          result = {
            collected: true,
            ringId: ring.id,
            consecutiveCount: newCount,
            missionCompleted,
            position: ring.position.clone(),
            rewardPoints: 200,
            rewardCash: 150,
          }
        }
      }
    }

    return result
  }

  reset(): void {
    for (const ring of this.rings) {
      ring.collected = false
      ring.cooldownTimer = 0
      ring.torusMesh.material = this.ringMaterial
      ring.coreMesh.material = this.ringMaterial
      ring.mesh.scale.set(1, 1, 1)
    }
  }

  dispose(): void {
    this.scene.remove(this.root)
    this.torusGeometry.dispose()
    this.coreGeometry.dispose()
    this.ringMaterial.dispose()
    this.goldRingMaterial.dispose()
    this.collectedMaterial.dispose()
  }
}
