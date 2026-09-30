import * as THREE from 'three'
import { Car } from './Car'
import { WantedSystem } from './WantedSystem'

type PoliceUnit = { car: Car; stunned: number; hitCooldown: number; sparkCooldown: number; countedPass: boolean }

export type PursuitResult = {
  busted: boolean
  closeCalls: number
  vehicleCollisions: number
  caught: boolean
  collisionPoints: THREE.Vector3[]
  isColliding: boolean
  explosions: THREE.Vector3[]
  smokingPositions: THREE.Vector3[]
  destroyedPoliceCount: number
}

export class Pursuit {
  private readonly scene: THREE.Scene
  private readonly wanted: WantedSystem
  private readonly units: PoliceUnit[] = []
  private spawnTimer = 0
  private bust = 0

  constructor(scene: THREE.Scene, wanted: WantedSystem) {
    this.scene = scene
    this.wanted = wanted
  }

  get bustProgress(): number {
    return this.bust
  }

  reset(): void {
    this.removeAll()
    this.spawnTimer = 0
    this.bust = 0
  }

  getCars(): Car[] {
    return this.units.map((unit) => unit.car)
  }

  findNearbyCar(position: THREE.Vector3, maxDistance: number): { car: Car; distance: number } | null {
    let nearest: { car: Car; distance: number } | null = null
    let minDistance = maxDistance

    for (const unit of this.units) {
      const dist = unit.car.root.position.distanceTo(position)
      if (dist <= minDistance) {
        minDistance = dist
        nearest = { car: unit.car, distance: dist }
      }
    }

    return nearest
  }

  removeCar(car: Car): boolean {
    const index = this.units.findIndex((unit) => unit.car === car)
    if (index !== -1) {
      this.units.splice(index, 1)
      return true
    }
    return false
  }

  update(
    dt: number,
    player: Car,
    targetPosition: THREE.Vector3 = player.root.position,
    onFoot = false,
    targetSpeed = player.speed,
  ): PursuitResult {
    const level = this.wanted.level
    if (level === 0) {
      this.removeAll()
      this.bust = Math.max(0, this.bust - dt * 0.42)
      return { busted: false, closeCalls: 0, vehicleCollisions: 0, caught: false, collisionPoints: [], isColliding: false, explosions: [], smokingPositions: [], destroyedPoliceCount: 0 }
    }

    const playerPosition = targetPosition
    const wantedCars = Math.min(7, 1 + Math.floor((level - 1) * 0.72))
    this.spawnTimer -= dt
    if (this.units.length < wantedCars && this.spawnTimer <= 0) {
      this.spawnPolice(playerPosition, level)
      this.spawnTimer = Math.max(0.65, 3.3 - level * 0.25)
    }
    let closeCalls = 0
    let vehicleCollisions = 0
    let isColliding = false
    let destroyedPoliceCount = 0
    const collisionPoints: THREE.Vector3[] = []
    const explosions: THREE.Vector3[] = []
    const smokingPositions: THREE.Vector3[] = []

    for (let index = this.units.length - 1; index >= 0; index -= 1) {
      const unit = this.units[index]
      const car = unit.car
      const dx = playerPosition.x - car.root.position.x
      const dz = playerPosition.z - car.root.position.z
      const distance = Math.hypot(dx, dz)

      if (distance > 235 || car.root.position.z > playerPosition.z + 225 || (car.exploded && car.hitCooldown <= 0)) {
        car.dispose()
        this.units.splice(index, 1)
        continue
      }

      if (car.isSmoking) {
        car.smokeTimer += dt
        if (car.smokeTimer >= 0.09) {
          car.smokeTimer = 0
          smokingPositions.push(car.getHoodPosition())
        }
      }

      if (car.exploded) {
        continue
      }

      if (unit.stunned > 0) {
        unit.stunned = Math.max(0, unit.stunned - dt)
        car.speed *= Math.max(0, 1 - dt * 1.8)
        car.integrateMovement(dt)
      } else {
        const targetYaw = Math.atan2(-dx, -dz)
        const yawDifference = THREE.MathUtils.euclideanModulo(targetYaw - car.yaw + Math.PI, Math.PI * 2) - Math.PI
        car.yaw += THREE.MathUtils.clamp(yawDifference, -dt * (1.25 + level * 0.035), dt * (1.25 + level * 0.035))
        const chaseSpeed = 24 + level * 1.65
        car.speed += (chaseSpeed - car.speed) * Math.min(1, dt * 0.8)
        car.integrateMovement(dt)
      }

      const vehicleCollision = player.collideWith(car, dt)
      if (vehicleCollision) isColliding = true
      unit.sparkCooldown = Math.max(0, unit.sparkCooldown - dt)
      if (vehicleCollision && unit.sparkCooldown === 0) {
        collisionPoints.push(new THREE.Vector3(
          (playerPosition.x + car.root.position.x) / 2,
          1.05,
          (playerPosition.z + car.root.position.z) / 2,
        ))
        unit.sparkCooldown = 0.14
      }
      const currentDx = playerPosition.x - car.root.position.x
      const currentDz = playerPosition.z - car.root.position.z
      const currentDistance = Math.hypot(currentDx, currentDz)

      unit.hitCooldown = Math.max(0, unit.hitCooldown - dt)
      if (vehicleCollision && unit.hitCooldown === 0) {
        if (!onFoot) vehicleCollisions += 1
        unit.stunned = Math.max(unit.stunned, 0.55)
        unit.hitCooldown = 1.3
        const hitRes = car.registerHit('vehicle', 0.45)
        if (hitRes.isNewExplosion) {
          explosions.push(car.root.position.clone())
          destroyedPoliceCount += 1
        }
      } else if (!onFoot && currentDistance < 3.1 && unit.hitCooldown === 0 && Math.abs(targetSpeed) > 8) {
        unit.stunned = 1.3
        unit.hitCooldown = 2.3
      }

      if (!onFoot && currentDistance < 5.5 && currentDistance > 2.8 && Math.abs(targetSpeed) > 17 && !unit.countedPass) {
        unit.countedPass = true
        closeCalls += 1
      } else if (currentDistance > 11) {
        unit.countedPass = false
      }
    }

    let collidingPoliceCount = 0
    for (const unit of this.units) {
      const d = unit.car.root.position.distanceTo(playerPosition)
      if (d < 4.4) collidingPoliceCount += 1
    }

    // Se houver apenas 1 carro de policia colidindo com o jogador em veiculo:
    // Ele nao deve conseguir prender o carro do jogador na parede.
    if (collidingPoliceCount === 1 && !onFoot) {
      for (const unit of this.units) {
        const d = unit.car.root.position.distanceTo(playerPosition)
        if (d < 4.4) {
          unit.stunned = Math.max(unit.stunned, 0.45)
          unit.car.speed = Math.min(unit.car.speed, 6)
          const pushX = unit.car.root.position.x - playerPosition.x
          const pushZ = unit.car.root.position.z - playerPosition.z
          const pushDist = Math.hypot(pushX, pushZ)
          if (pushDist > 0.01) {
            unit.car.root.position.x += (pushX / pushDist) * 0.18
            unit.car.root.position.z += (pushZ / pushDist) * 0.18
          }
        }
      }
    }

    const nearest = this.units.reduce((best, unit) => Math.min(best, unit.car.root.position.distanceTo(playerPosition)), Infinity)
    const captureDistance = onFoot ? 1.5 : 4.2
    // O carro do jogador somente deve ser imprensado quando tiver dois ou mais carros da policia batendo no carro
    const isImprensado = onFoot ? (nearest < captureDistance) : (collidingPoliceCount >= 2 && nearest < captureDistance)
    if (isImprensado) this.bust = Math.min(1, this.bust + dt * (0.08 + level * 0.014))
    else this.bust = Math.max(0, this.bust - dt * 0.14)

    return {
      busted: this.bust >= 1,
      closeCalls,
      vehicleCollisions,
      caught: isImprensado,
      collisionPoints,
      isColliding,
      explosions,
      smokingPositions,
      destroyedPoliceCount,
    }
  }

  private spawnPolice(player: THREE.Vector3, level: number): void {
    const car = new Car(this.scene, { color: level > 6 ? 0x252a30 : 0xf0ede3, police: true, scale: 0.96, mass: 1.19 })
    const side = (Math.random() - 0.5) * 52
    const streetX = Math.round((player.x + side) / 48) * 48 + (Math.random() - 0.5) * 2
    car.setPosition(streetX, player.z + 75 + Math.random() * 40, 0)
    this.units.push({ car, stunned: 0, hitCooldown: 0, sparkCooldown: 0, countedPass: false })
  }

  private removeAll(): void {
    for (const unit of this.units) unit.car.dispose()
    this.units.length = 0
  }

  dispose(): void {
    this.removeAll()
  }
}
