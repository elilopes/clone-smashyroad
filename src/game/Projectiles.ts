import * as THREE from 'three'

export interface Projectile {
  mesh: THREE.Mesh
  position: THREE.Vector3
  velocity: THREE.Vector3
  radius: number
  source: 'tank' | 'helicopter'
  alive: boolean
  age: number
  maxAge: number
}

export interface ProjectileHitEvent {
  hitType: 'player_car' | 'player_plane' | 'player_character' | 'building'
  position: THREE.Vector3
  source: 'tank' | 'helicopter'
}

export class Projectiles {
  private readonly scene: THREE.Scene
  readonly root = new THREE.Group()
  readonly active: Projectile[] = []

  private readonly shellGeometry = new THREE.SphereGeometry(0.35, 8, 8)
  private readonly rocketGeometry = new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8)

  private readonly tankShellMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3b00,
    emissive: 0xff4500,
    emissiveIntensity: 2.8,
    roughness: 0.2,
  })

  private readonly heliBulletMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffaa00,
    emissiveIntensity: 2.5,
    roughness: 0.2,
  })

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.scene.add(this.root)
  }

  fire(
    origin: THREE.Vector3,
    target: THREE.Vector3,
    source: 'tank' | 'helicopter',
    speed = source === 'tank' ? 42 : 48,
  ): void {
    const direction = new THREE.Vector3().subVectors(target, origin).normalize()

    // Add slight natural spread so player can dodge with skill
    direction.x += (Math.random() - 0.5) * 0.06
    direction.y += (Math.random() - 0.5) * 0.04
    direction.z += (Math.random() - 0.5) * 0.06
    direction.normalize()

    const velocity = direction.clone().multiplyScalar(speed)

    const geo = source === 'tank' ? this.shellGeometry : this.rocketGeometry
    const mat = source === 'tank' ? this.tankShellMaterial : this.heliBulletMaterial
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(origin)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)

    this.root.add(mesh)
    this.active.push({
      mesh,
      position: origin.clone(),
      velocity,
      radius: source === 'tank' ? 0.75 : 0.5,
      source,
      alive: true,
      age: 0,
      maxAge: 4.5,
    })
  }

  update(
    dt: number,
    checkBuildingCollision: (x: number, y: number, z: number, radius: number) => boolean,
    playerCarPos: THREE.Vector3 | null,
    playerPlanePos: THREE.Vector3 | null,
    playerCharPos: THREE.Vector3 | null,
  ): ProjectileHitEvent[] {
    const hits: ProjectileHitEvent[] = []

    for (let index = this.active.length - 1; index >= 0; index -= 1) {
      const proj = this.active[index]
      proj.age += dt

      if (!proj.alive || proj.age >= proj.maxAge) {
        this.root.remove(proj.mesh)
        this.active.splice(index, 1)
        continue
      }

      // Move projectile
      proj.position.addScaledVector(proj.velocity, dt)
      proj.mesh.position.copy(proj.position)

      // 1. Check Building Collision
      if (checkBuildingCollision(proj.position.x, proj.position.y, proj.position.z, proj.radius)) {
        proj.alive = false
        hits.push({
          hitType: 'building',
          position: proj.position.clone(),
          source: proj.source,
        })
        this.root.remove(proj.mesh)
        this.active.splice(index, 1)
        continue
      }

      // 2. Check Hit on Player Car
      if (playerCarPos) {
        const dist = proj.position.distanceTo(playerCarPos)
        if (dist <= 2.2) {
          proj.alive = false
          hits.push({
            hitType: 'player_car',
            position: proj.position.clone(),
            source: proj.source,
          })
          this.root.remove(proj.mesh)
          this.active.splice(index, 1)
          continue
        }
      }

      // 3. Check Hit on Player Plane
      if (playerPlanePos) {
        const dist = proj.position.distanceTo(playerPlanePos)
        if (dist <= 3.2) {
          proj.alive = false
          hits.push({
            hitType: 'player_plane',
            position: proj.position.clone(),
            source: proj.source,
          })
          this.root.remove(proj.mesh)
          this.active.splice(index, 1)
          continue
        }
      }

      // 4. Check Hit on Player Character on foot
      if (playerCharPos) {
        const dist = proj.position.distanceTo(playerCharPos)
        if (dist <= 1.4) {
          proj.alive = false
          hits.push({
            hitType: 'player_character',
            position: proj.position.clone(),
            source: proj.source,
          })
          this.root.remove(proj.mesh)
          this.active.splice(index, 1)
          continue
        }
      }
    }

    return hits
  }

  reset(): void {
    for (const proj of this.active) {
      this.root.remove(proj.mesh)
    }
    this.active.length = 0
  }

  dispose(): void {
    this.reset()
    this.scene.remove(this.root)
    this.shellGeometry.dispose()
    this.rocketGeometry.dispose()
    this.tankShellMaterial.dispose()
    this.heliBulletMaterial.dispose()
  }
}
