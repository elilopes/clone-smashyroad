import * as THREE from 'three'

type SparkBurst = {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>
  positions: Float32Array
  velocities: THREE.Vector3[]
  age: number
  lifetime: number
}

export class Sparks {
  private readonly scene: THREE.Scene
  private readonly bursts: SparkBurst[] = []
  private readonly sprite = this.makeSprite()

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  emit(position: THREE.Vector3): void {
    const particleCount = 20
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const velocities: THREE.Vector3[] = []

    for (let index = 0; index < particleCount; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const horizontalSpeed = 1.6 + Math.random() * 4.2
      positions[index * 3] = position.x + (Math.random() - 0.5) * 0.32
      positions[index * 3 + 1] = position.y + (Math.random() - 0.5) * 0.22
      positions[index * 3 + 2] = position.z + (Math.random() - 0.5) * 0.32
      velocities.push(new THREE.Vector3(
        Math.cos(angle) * horizontalSpeed,
        1.4 + Math.random() * 4.6,
        Math.sin(angle) * horizontalSpeed,
      ))

      const tint = Math.random()
      colors[index * 3] = 1
      colors[index * 3 + 1] = 0.52 + tint * 0.43
      colors[index * 3 + 2] = 0.06 + tint * 0.22
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const material = new THREE.PointsMaterial({
      size: 0.62,
      map: this.sprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    points.renderOrder = 5
    this.scene.add(points)
    this.bursts.push({ points, positions, velocities, age: 0, lifetime: 0.58 })
  }

  update(dt: number): void {
    for (let index = this.bursts.length - 1; index >= 0; index -= 1) {
      const burst = this.bursts[index]
      burst.age += dt
      if (burst.age >= burst.lifetime) {
        this.scene.remove(burst.points)
        burst.points.geometry.dispose()
        burst.points.material.dispose()
        this.bursts.splice(index, 1)
        continue
      }

      for (let particle = 0; particle < burst.velocities.length; particle += 1) {
        const offset = particle * 3
        const velocity = burst.velocities[particle]
        burst.positions[offset] += velocity.x * dt
        burst.positions[offset + 1] += velocity.y * dt
        burst.positions[offset + 2] += velocity.z * dt
        velocity.y -= 10.5 * dt
      }
      const positionAttribute = burst.points.geometry.getAttribute('position') as THREE.BufferAttribute
      positionAttribute.needsUpdate = true
      burst.points.material.opacity = 0.98 * (1 - burst.age / burst.lifetime)
    }
  }

  dispose(): void {
    for (const burst of this.bursts) {
      this.scene.remove(burst.points)
      burst.points.geometry.dispose()
      burst.points.material.dispose()
    }
    this.bursts.length = 0
    this.sprite.dispose()
  }

  private makeSprite(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const context = canvas.getContext('2d')!
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(255,255,245,1)')
    gradient.addColorStop(0.22, 'rgba(255,235,120,.95)')
    gradient.addColorStop(0.58, 'rgba(255,145,28,.62)')
    gradient.addColorStop(1, 'rgba(255,82,10,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 32, 32)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
}
