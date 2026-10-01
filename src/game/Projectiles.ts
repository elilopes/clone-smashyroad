import * as THREE from 'three'

export interface Projectile {
  mesh: THREE.Mesh
  position: THREE.Vector3
  velocity: THREE.Vector3
  radius: number
  source: 'tank' | 'helicopter' | 'plane' | 'blaster'
  alive: boolean
  age: number
  maxAge: number
}

export interface ProjectileHitEvent {
  hitType: 'player_car' | 'player_plane' | 'player_character' | 'building' | 'king_kong'
  position: THREE.Vector3
  source: 'tank' | 'helicopter' | 'plane' | 'blaster'
}

export class Projectiles {
  private readonly scene: THREE.Scene
  readonly root = new THREE.Group()
  readonly active: Projectile[] = []

  private readonly shellGeometry = new THREE.SphereGeometry(0.35, 8, 8)
  private readonly rocketGeometry = new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8)
  private readonly planeBulletGeometry = new THREE.CylinderGeometry(0.14, 0.14, 1.6, 6)
  private readonly blasterGeometry = new THREE.CylinderGeometry(0.24, 0.24, 2.2, 8)

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

  private readonly planeBulletMaterial = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 3.5,
    roughness: 0.1,
  })

  private readonly blasterMaterial = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00d2ff,
    emissiveIntensity: 4.5,
    roughness: 0.1,
  })

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.scene.add(this.root)
  }

  fire(
    origin: THREE.Vector3,
    target: THREE.Vector3,
    source: 'tank' | 'helicopter' | 'plane' | 'blaster',
    speed = source === 'tank' ? 42 : source === 'helicopter' ? 48 : source === 'blaster' ? 175 : 135,
  ): void {
    const direction = new THREE.Vector3().subVectors(target, origin).normalize()

    // Add slight spread (blaster has pinpoint precision)
    const spread = source === 'blaster' ? 0.008 : source === 'plane' ? 0.015 : 0.06
    direction.x += (Math.random() - 0.5) * spread
    direction.y += (Math.random() - 0.5) * spread * 0.7
    direction.z += (Math.random() - 0.5) * spread
    direction.normalize()

    const velocity = direction.clone().multiplyScalar(speed)

    const geo = source === 'tank' ? this.shellGeometry : source === 'helicopter' ? this.rocketGeometry : source === 'blaster' ? this.blasterGeometry : this.planeBulletGeometry
    const mat = source === 'tank' ? this.tankShellMaterial : source === 'helicopter' ? this.heliBulletMaterial : source === 'blaster' ? this.blasterMaterial : this.planeBulletMaterial
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(origin)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)

    this.root.add(mesh)
    this.active.push({
      mesh,
      position: origin.clone(),
      velocity,
      radius: source === 'tank' ? 0.75 : source === 'helicopter' ? 0.5 : source === 'blaster' ? 1.3 : 0.65,
      source,
      alive: true,
      age: 0,
      maxAge: source === 'plane' || source === 'blaster' ? 3.0 : 4.5,
    })
  }

  update(
    dt: number,
    checkBuildingCollision: (x: number, y: number, z: number, radius: number) => boolean,
    playerCarPos: THREE.Vector3 | null,
    playerPlanePos: THREE.Vector3 | null,
    playerCharPos: THREE.Vector3 | null,
    checkKingKongCollision?: (pos: THREE.Vector3, radius: number) => boolean,
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

      // 1. King Kong check (for plane bullets or military projectiles)
      if (checkKingKongCollision && checkKingKongCollision(proj.position, proj.radius)) {
        proj.alive = false
        hits.push({
          hitType: 'king_kong',
          position: proj.position.clone(),
          source: proj.source,
        })
        this.root.remove(proj.mesh)
        this.active.splice(index, 1)
        continue
      }

      // 2. Check Building Collision
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

      // Plane bullets don't damage the player plane or player car
      if (proj.source === 'plane') {
        continue
      }

      // 3. Check Hit on Player Car
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

      // 4. Check Hit on Player Plane
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

      // 5. Check Hit on Player Character on foot
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
    this.planeBulletGeometry.dispose()
    this.tankShellMaterial.dispose()
    this.heliBulletMaterial.dispose()
    this.planeBulletMaterial.dispose()
  }
}
