import * as THREE from 'three'

type ParticleBurst = {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>
  positions: Float32Array
  velocities: THREE.Vector3[]
  age: number
  lifetime: number
  growthRate?: number
  initialSize?: number
  drag?: number
  gravity?: number
}

export class Sparks {
  private readonly scene: THREE.Scene
  private readonly bursts: ParticleBurst[] = []
  private readonly sparkSprite = this.makeSparkSprite()
  private readonly smokeSprite = this.makeSmokeSprite()
  private readonly fireSprite = this.makeFireSprite()

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
      map: this.sparkSprite,
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
    this.bursts.push({ points, positions, velocities, age: 0, lifetime: 0.58, gravity: 10.5 })
  }

  emitSmoke(position: THREE.Vector3, intensity = 1): void {
    const particleCount = Math.min(10, Math.floor(4 * intensity))
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const velocities: THREE.Vector3[] = []

    for (let index = 0; index < particleCount; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const drift = 0.3 + Math.random() * 0.8
      positions[index * 3] = position.x + (Math.random() - 0.5) * 0.4
      positions[index * 3 + 1] = position.y + (Math.random() - 0.5) * 0.2
      positions[index * 3 + 2] = position.z + (Math.random() - 0.5) * 0.4
      velocities.push(new THREE.Vector3(
        Math.cos(angle) * drift,
        1.8 + Math.random() * 2.2,
        Math.sin(angle) * drift,
      ))

      const shade = 0.16 + Math.random() * 0.22
      colors[index * 3] = shade
      colors[index * 3 + 1] = shade
      colors[index * 3 + 2] = shade
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const initialSize = 1.1 + Math.random() * 0.4
    const material = new THREE.PointsMaterial({
      size: initialSize,
      map: this.smokeSprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    points.renderOrder = 4
    this.scene.add(points)
    this.bursts.push({
      points,
      positions,
      velocities,
      age: 0,
      lifetime: 1.1 + Math.random() * 0.4,
      initialSize,
      growthRate: 2.2,
      gravity: -0.6,
      drag: 0.8,
    })
  }

  emitExplosion(position: THREE.Vector3): void {
    // 1. Bola de fogo expansiva
    const fireCount = 45
    const firePositions = new Float32Array(fireCount * 3)
    const fireColors = new Float32Array(fireCount * 3)
    const fireVelocities: THREE.Vector3[] = []

    for (let index = 0; index < fireCount; index += 1) {
      const theta = Math.random() * Math.PI * 2
      const phi = (Math.random() - 0.3) * Math.PI
      const speed = 4.5 + Math.random() * 11.5
      firePositions[index * 3] = position.x + (Math.random() - 0.5) * 0.6
      firePositions[index * 3 + 1] = position.y + 0.5 + (Math.random() - 0.5) * 0.4
      firePositions[index * 3 + 2] = position.z + (Math.random() - 0.5) * 0.6
      fireVelocities.push(new THREE.Vector3(
        Math.cos(phi) * Math.cos(theta) * speed,
        Math.abs(Math.sin(phi)) * speed + 3.2,
        Math.cos(phi) * Math.sin(theta) * speed,
      ))

      const heat = Math.random()
      fireColors[index * 3] = 1.0
      fireColors[index * 3 + 1] = 0.35 + heat * 0.55
      fireColors[index * 3 + 2] = 0.05 + heat * 0.2
    }

    const fireGeo = new THREE.BufferGeometry()
    fireGeo.setAttribute('position', new THREE.BufferAttribute(firePositions, 3))
    fireGeo.setAttribute('color', new THREE.BufferAttribute(fireColors, 3))
    const fireMat = new THREE.PointsMaterial({
      size: 2.4,
      map: this.fireSprite,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const firePoints = new THREE.Points(fireGeo, fireMat)
    firePoints.frustumCulled = false
    firePoints.renderOrder = 6
    this.scene.add(firePoints)
    this.bursts.push({
      points: firePoints,
      positions: firePositions,
      velocities: fireVelocities,
      age: 0,
      lifetime: 0.72,
      initialSize: 2.4,
      growthRate: 3.5,
      gravity: 5.2,
      drag: 2.8,
    })

    // 2. Coluna densa de fumaça negra pós-explosão
    const smokeCount = 30
    const smokePositions = new Float32Array(smokeCount * 3)
    const smokeColors = new Float32Array(smokeCount * 3)
    const smokeVelocities: THREE.Vector3[] = []

    for (let index = 0; index < smokeCount; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const spread = 1.2 + Math.random() * 3.8
      smokePositions[index * 3] = position.x + (Math.random() - 0.5) * 1.2
      smokePositions[index * 3 + 1] = position.y + 0.8 + (Math.random() - 0.5) * 0.6
      smokePositions[index * 3 + 2] = position.z + (Math.random() - 0.5) * 1.2
      smokeVelocities.push(new THREE.Vector3(
        Math.cos(angle) * spread,
        2.8 + Math.random() * 4.5,
        Math.sin(angle) * spread,
      ))

      const darkness = 0.12 + Math.random() * 0.16
      smokeColors[index * 3] = darkness
      smokeColors[index * 3 + 1] = darkness
      smokeColors[index * 3 + 2] = darkness
    }

    const smokeGeo = new THREE.BufferGeometry()
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3))
    smokeGeo.setAttribute('color', new THREE.BufferAttribute(smokeColors, 3))
    const smokeMat = new THREE.PointsMaterial({
      size: 2.8,
      map: this.smokeSprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const smokePoints = new THREE.Points(smokeGeo, smokeMat)
    smokePoints.frustumCulled = false
    smokePoints.renderOrder = 4
    this.scene.add(smokePoints)
    this.bursts.push({
      points: smokePoints,
      positions: smokePositions,
      velocities: smokeVelocities,
      age: 0,
      lifetime: 1.6,
      initialSize: 2.8,
      growthRate: 4.8,
      gravity: -1.2,
      drag: 1.4,
    })

    // 3. Faíscas e estilhaços voando
    this.emit(position)
    this.emit(position.clone().add(new THREE.Vector3(0, 1.2, 0)))
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

      const gravity = burst.gravity ?? 10.5
      const drag = burst.drag ?? 0
      const progress = burst.age / burst.lifetime

      for (let particle = 0; particle < burst.velocities.length; particle += 1) {
        const offset = particle * 3
        const velocity = burst.velocities[particle]
        burst.positions[offset] += velocity.x * dt
        burst.positions[offset + 1] += velocity.y * dt
        burst.positions[offset + 2] += velocity.z * dt

        velocity.y -= gravity * dt
        if (drag > 0) {
          velocity.x *= Math.max(0, 1 - drag * dt)
          velocity.z *= Math.max(0, 1 - drag * dt)
        }
      }

      const positionAttribute = burst.points.geometry.getAttribute('position') as THREE.BufferAttribute
      positionAttribute.needsUpdate = true

      if (burst.growthRate && burst.initialSize) {
        burst.points.material.size = burst.initialSize + burst.growthRate * burst.age
      }
      burst.points.material.opacity = Math.max(0, (1 - progress) * 0.98)
    }
  }

  dispose(): void {
    for (const burst of this.bursts) {
      this.scene.remove(burst.points)
      burst.points.geometry.dispose()
      burst.points.material.dispose()
    }
    this.bursts.length = 0
    this.sparkSprite.dispose()
    this.smokeSprite.dispose()
    this.fireSprite.dispose()
  }

  private makeSparkSprite(): THREE.CanvasTexture {
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

  private makeSmokeSprite(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext('2d')!
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(230,230,230,0.95)')
    gradient.addColorStop(0.35, 'rgba(160,160,160,0.75)')
    gradient.addColorStop(0.7, 'rgba(80,80,80,0.35)')
    gradient.addColorStop(1, 'rgba(20,20,20,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  private makeFireSprite(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext('2d')!
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,240,1)')
    gradient.addColorStop(0.25, 'rgba(255,210,60,0.95)')
    gradient.addColorStop(0.6, 'rgba(255,80,15,0.7)')
    gradient.addColorStop(0.85, 'rgba(180,30,5,0.3)')
    gradient.addColorStop(1, 'rgba(40,0,0,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
}
