import * as THREE from 'three'

const STREET = 48
const CHUNK_DEPTH = 192
const SIDEWALK_OFFSET = 8.6

type Pedestrian = {
  mesh: THREE.Group
  x: number
  z: number
  axis: 'x' | 'z'
  direction: number
  min: number
  max: number
  speed: number
  phase: number
  canDodge: boolean
  dodgeCooldown: number
  dodgeTime: number
  targetX: number
  targetZ: number
  dodging: boolean
  knocked: boolean
  knockTime: number
  fallDirection: number
}

type PedestrianChunk = { group: THREE.Group; people: Pedestrian[] }

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

export class Pedestrians {
  private readonly scene: THREE.Scene
  readonly root = new THREE.Group()
  private readonly chunks = new Map<number, PedestrianChunk>()
  private elapsed = 0
  private readonly torsoGeometry = new THREE.BoxGeometry(0.46, 0.66, 0.29)
  private readonly legsGeometry = new THREE.BoxGeometry(0.4, 0.52, 0.25)
  private readonly headGeometry = new THREE.SphereGeometry(0.19, 8, 6)
  private readonly clothes = [0xc34e38, 0x376e93, 0xd1a342, 0x6d8a63, 0x785b88, 0xd1d0c2]
    .map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.92 }))
  private readonly trousers = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.96 })
  private readonly skin = new THREE.MeshStandardMaterial({ color: 0xd8ad8c, roughness: 0.93 })

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.scene.add(this.root)
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

  update(dt: number, car: THREE.Vector3, carYaw: number, carSpeed: number): number {
    this.elapsed += dt
    let collisions = 0
    const forwardX = -Math.sin(carYaw)
    const forwardZ = -Math.cos(carYaw)
    const rightX = Math.cos(carYaw)
    const rightZ = -Math.sin(carYaw)

    for (const chunk of this.chunks.values()) {
      for (const person of chunk.people) {
        const mesh = person.mesh
        if (!mesh.visible) continue

        if (person.knocked) {
          person.knockTime += dt
          mesh.rotation.z = person.fallDirection * Math.min(Math.PI / 2, person.knockTime * 5)
          mesh.position.y = 0
          if (person.knockTime > 1.3) mesh.visible = false
          continue
        }

        person.dodgeCooldown = Math.max(0, person.dodgeCooldown - dt)
        const dx = person.x - car.x
        const dz = person.z - car.z
        const distance = Math.hypot(dx, dz)
        const ahead = dx * forwardX + dz * forwardZ
        if (!person.dodging && person.canDodge && person.dodgeCooldown === 0 && carSpeed > 5 && ahead > 0 && distance < Math.min(22, 8 + carSpeed * 0.38)) {
          const side = dx * rightX + dz * rightZ
          const sign = side === 0 ? (person.phase > 0.5 ? 1 : -1) : Math.sign(side)
          person.targetX = person.x + rightX * sign * (3.3 + person.phase * 0.8)
          person.targetZ = person.z + rightZ * sign * (3.3 + person.phase * 0.8)
          person.dodging = true
          person.dodgeTime = 0.82
        }

        if (person.dodging) {
          const moveX = person.targetX - person.x
          const moveZ = person.targetZ - person.z
          const remaining = Math.hypot(moveX, moveZ)
          const step = Math.min(remaining, dt * 7)
          if (remaining > 0) {
            person.x += (moveX / remaining) * step
            person.z += (moveZ / remaining) * step
          }
          person.dodgeTime -= dt
          if (person.dodgeTime <= 0) {
            person.dodging = false
            person.dodgeCooldown = 1.6
          }
        } else {
          if (person.axis === 'x') {
            person.x += person.direction * person.speed * dt
            if (person.x < person.min || person.x > person.max) person.direction *= -1
          } else {
            person.z += person.direction * person.speed * dt
            if (person.z < person.min || person.z > person.max) person.direction *= -1
          }
        }

        mesh.position.set(person.x, person.dodging ? Math.sin((0.82 - person.dodgeTime) * Math.PI / 0.82) * 0.7 : Math.sin(this.elapsed * 4 + person.phase * 8) * 0.025, person.z)
        if (!person.dodging) {
          mesh.rotation.y = person.axis === 'x' ? (person.direction > 0 ? -Math.PI / 2 : Math.PI / 2) : (person.direction > 0 ? Math.PI : 0)
        }

        const impactRadius = person.dodging ? 0.95 : 2.05
        if (carSpeed > 3.5 && distance < impactRadius) {
          person.knocked = true
          person.knockTime = 0
          person.fallDirection = Math.sign(dx * rightX + dz * rightZ) || 1
          person.dodging = false
          collisions += 1
        }
      }
    }
    return collisions
  }

  clear(): void {
    for (const [index, chunk] of this.chunks) this.removeChunk(index, chunk)
    this.elapsed = 0
  }

  dispose(): void {
    this.clear()
    this.scene.remove(this.root)
    this.torsoGeometry.dispose()
    this.legsGeometry.dispose()
    this.headGeometry.dispose()
    for (const material of this.clothes) material.dispose()
    this.trousers.dispose()
    this.skin.dispose()
  }

  private createChunk(index: number): void {
    const group = new THREE.Group()
    const people: Pedestrian[] = []
    const random = randomFrom((index + 13271) * 94631)
    const zStart = index * CHUNK_DEPTH

    for (let slot = 0; slot < 24; slot += 1) {
      const axis: Pedestrian['axis'] = random() < 0.52 ? 'z' : 'x'
      let x = 0
      let z = 0
      let min = 0
      let max = 0
      if (axis === 'z') {
        const street = Math.floor(random() * 15) - 7
        const side = random() < 0.5 ? -1 : 1
        x = street * STREET + side * SIDEWALK_OFFSET
        z = zStart + 9 + random() * (CHUNK_DEPTH - 18)
        min = zStart + 3
        max = zStart + CHUNK_DEPTH - 3
      } else {
        const street = Math.floor(random() * 15) - 7
        const crossing = Math.floor(random() * 4)
        const side = random() < 0.5 ? -1 : 1
        z = zStart + crossing * STREET + side * SIDEWALK_OFFSET
        min = street * STREET - 10
        max = street * STREET + 10
        x = min + random() * (max - min)
      }

      const mesh = new THREE.Group()
      const shirt = new THREE.Mesh(this.torsoGeometry, this.clothes[Math.floor(random() * this.clothes.length)])
      shirt.position.y = 1.02
      shirt.castShadow = true
      const legs = new THREE.Mesh(this.legsGeometry, this.trousers)
      legs.position.y = 0.27
      legs.castShadow = true
      const head = new THREE.Mesh(this.headGeometry, this.skin)
      head.position.y = 1.5
      head.castShadow = true
      mesh.add(shirt, legs, head)
      const scale = 0.82 + random() * 0.3
      mesh.scale.setScalar(scale)
      mesh.position.set(x, 0, z)
      group.add(mesh)

      const direction = random() < 0.5 ? -1 : 1
      if (axis === 'x') mesh.rotation.y = direction > 0 ? -Math.PI / 2 : Math.PI / 2
      else mesh.rotation.y = direction > 0 ? Math.PI : 0
      people.push({
        mesh, x, z, axis, direction, min, max,
        speed: 0.48 + random() * 0.7,
        phase: random(),
        canDodge: random() < 0.46,
        dodgeCooldown: 0,
        dodgeTime: 0,
        targetX: x,
        targetZ: z,
        dodging: false,
        knocked: false,
        knockTime: 0,
        fallDirection: 1,
      })
    }

    this.root.add(group)
    this.chunks.set(index, { group, people })
  }

  private removeChunk(index: number, chunk: PedestrianChunk): void {
    this.root.remove(chunk.group)
    chunk.group.clear()
    this.chunks.delete(index)
  }
}
