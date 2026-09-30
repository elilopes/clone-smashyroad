import * as THREE from 'three'
import { Car, type VehicleKind } from './Car'

const BLOCK = 48
const LANE_OFFSET = 3.1
const ROAD_LIMIT = 240
const TRAFFIC_COUNT = 20

type TrafficAxis = 'x' | 'z'
type TrafficUnit = {
  car: Car
  axis: TrafficAxis
  direction: -1 | 1
  nextIntersection: number
  cruiseSpeed: number
  acceleration: number
  impactCooldown: number
}

export type TrafficUpdate = {
  playerCollisions: number
  collisionPoints: THREE.Vector3[]
}

const paintColors = [0x3d9b88, 0xe5b93c, 0x6d8fc3, 0xd55f48, 0xd7d3c7, 0x9b668b, 0x63a9b9, 0x5e635f]

export class Traffic {
  private readonly scene: THREE.Scene
  private readonly units: TrafficUnit[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  reset(): void {
    for (const unit of this.units) unit.car.dispose()
    this.units.length = 0
  }

  update(dt: number, player: Car): TrafficUpdate {
    const playerPosition = player.root.position
    for (let index = this.units.length - 1; index >= 0; index -= 1) {
      const unit = this.units[index]
      const dx = unit.car.root.position.x - playerPosition.x
      const dz = unit.car.root.position.z - playerPosition.z
      if (Math.hypot(dx, dz) > 205) {
        unit.car.dispose()
        this.units.splice(index, 1)
      }
    }
    while (this.units.length < TRAFFIC_COUNT) this.spawn(playerPosition)

    for (const unit of this.units) this.move(unit, dt)

    const collisionPoints: THREE.Vector3[] = []
    let playerCollisions = 0
    for (let index = 0; index < this.units.length; index += 1) {
      const unit = this.units[index]
      unit.impactCooldown = Math.max(0, unit.impactCooldown - dt)
      const playerDx = player.root.position.x - unit.car.root.position.x
      const playerDz = player.root.position.z - unit.car.root.position.z
      if (playerDx * playerDx + playerDz * playerDz < 81 && player.collideWith(unit.car, dt)) {
        if (unit.impactCooldown === 0) {
          playerCollisions += 1
          collisionPoints.push(this.contactPoint(player, unit.car))
          unit.impactCooldown = 0.45
        }
      }

      for (let otherIndex = index + 1; otherIndex < this.units.length; otherIndex += 1) {
        const other = this.units[otherIndex]
        const dx = unit.car.root.position.x - other.car.root.position.x
        const dz = unit.car.root.position.z - other.car.root.position.z
        if (dx * dx + dz * dz > 225) continue
        if (!unit.car.collideWith(other.car, dt)) continue
        if (unit.impactCooldown === 0 && other.impactCooldown === 0) {
          collisionPoints.push(this.contactPoint(unit.car, other.car))
          unit.impactCooldown = 0.45
          other.impactCooldown = 0.45
        }
      }
    }

    return { playerCollisions, collisionPoints }
  }

  private spawn(player: THREE.Vector3): void {
    const axis: TrafficAxis = Math.random() < 0.53 ? 'z' : 'x'
    const direction: -1 | 1 = Math.random() < 0.5 ? -1 : 1
    const kind = this.chooseKind()
    let x: number
    let z: number

    if (axis === 'z') {
      const road = THREE.MathUtils.clamp(Math.round(player.x / BLOCK) + Math.floor(Math.random() * 7) - 3, -5, 5) * BLOCK
      z = player.z + (Math.random() * 2 - 1) * 145
      if (Math.abs(z - player.z) < 25 && Math.abs(road - player.x) < 16) z += direction * 38
      x = road - direction * LANE_OFFSET
    } else {
      const road = Math.round((player.z + (Math.random() * 2 - 1) * 140) / BLOCK) * BLOCK
      x = THREE.MathUtils.clamp(player.x + (Math.random() * 2 - 1) * 175, -235, 235)
      if (Math.abs(x - player.x) < 25 && Math.abs(road - player.z) < 16) x += direction * 38
      z = road + direction * LANE_OFFSET
    }

    const cruiseSpeed = kind === 'bicycle'
      ? 3.8 + Math.random() * 3.5
      : kind === 'truck'
        ? 7 + Math.random() * 4.5
        : kind === 'pickup' || kind === 'suv'
          ? 9 + Math.random() * 7
          : 11 + Math.random() * 8
    const colors = paintColors[Math.floor(Math.random() * paintColors.length)]
    const scale = kind === 'bicycle' ? 0.88 : kind === 'truck' ? 0.98 : 1
    const car = new Car(this.scene, { kind, color: colors, scale })
    const yaw = this.heading(axis, direction)
    car.setPosition(x, z, yaw)
    car.speed = cruiseSpeed
    const coordinate = axis === 'z' ? z : x
    this.units.push({
      car,
      axis,
      direction,
      nextIntersection: this.nextGridCoordinate(coordinate, direction),
      cruiseSpeed,
      acceleration: kind === 'truck' ? 2.2 : kind === 'bicycle' ? 2.8 : 3.4,
      impactCooldown: 0,
    })
  }

  private chooseKind(): VehicleKind {
    const roll = Math.random()
    if (roll < 0.31) return 'sedan'
    if (roll < 0.51) return 'suv'
    if (roll < 0.71) return 'pickup'
    if (roll < 0.84) return 'truck'
    return 'bicycle'
  }

  private move(unit: TrafficUnit, dt: number): void {
    const car = unit.car
    const speedDelta = THREE.MathUtils.clamp(unit.cruiseSpeed - car.speed, -unit.acceleration * dt, unit.acceleration * dt)
    car.speed += speedDelta

    const x = car.root.position.x
    if (unit.axis === 'x' && ((x > ROAD_LIMIT - 5 && unit.direction > 0) || (x < -ROAD_LIMIT + 5 && unit.direction < 0))) {
      unit.direction = unit.direction === 1 ? -1 : 1
      this.setLane(unit)
      car.yaw = this.heading(unit.axis, unit.direction)
      car.root.rotation.y = car.yaw
      unit.nextIntersection = this.nextGridCoordinate(car.root.position.x, unit.direction)
    }

    const coordinate = unit.axis === 'z' ? car.root.position.z : car.root.position.x
    const distanceToJunction = (unit.nextIntersection - coordinate) * unit.direction
    if (distanceToJunction <= Math.max(0.2, Math.abs(car.speed) * dt)) {
      if (Math.random() < 0.17) this.turnAtIntersection(unit)
      else unit.nextIntersection += unit.direction * BLOCK
    }

    car.yaw = this.heading(unit.axis, unit.direction)
    car.root.rotation.y = car.yaw
    car.integrateMovement(dt)
  }

  private turnAtIntersection(unit: TrafficUnit): void {
    const car = unit.car
    const intersection = unit.nextIntersection
    const newDirection: -1 | 1 = Math.random() < 0.5 ? -1 : 1
    if (unit.axis === 'z') {
      const roadX = Math.round(car.root.position.x / BLOCK) * BLOCK
      car.root.position.set(roadX, 0, intersection + newDirection * LANE_OFFSET)
      unit.axis = 'x'
      unit.direction = newDirection
    } else {
      const roadZ = Math.round(car.root.position.z / BLOCK) * BLOCK
      car.root.position.set(intersection - newDirection * LANE_OFFSET, 0, roadZ)
      unit.axis = 'z'
      unit.direction = newDirection
    }
    car.yaw = this.heading(unit.axis, unit.direction)
    car.root.rotation.y = car.yaw
    const coordinate = unit.axis === 'z' ? car.root.position.z : car.root.position.x
    unit.nextIntersection = this.nextGridCoordinate(coordinate, unit.direction)
  }

  private setLane(unit: TrafficUnit): void {
    const position = unit.car.root.position
    if (unit.axis === 'z') {
      const roadX = Math.round(position.x / BLOCK) * BLOCK
      position.x = roadX - unit.direction * LANE_OFFSET
    } else {
      const roadZ = Math.round(position.z / BLOCK) * BLOCK
      position.z = roadZ + unit.direction * LANE_OFFSET
    }
  }

  private nextGridCoordinate(coordinate: number, direction: -1 | 1): number {
    const grid = coordinate / BLOCK
    return (direction > 0 ? Math.floor(grid) + 1 : Math.ceil(grid) - 1) * BLOCK
  }

  private heading(axis: TrafficAxis, direction: -1 | 1): number {
    if (axis === 'z') return direction > 0 ? Math.PI : 0
    return direction > 0 ? -Math.PI / 2 : Math.PI / 2
  }

  private contactPoint(first: Car, second: Car): THREE.Vector3 {
    return new THREE.Vector3(
      (first.root.position.x + second.root.position.x) / 2,
      0.92,
      (first.root.position.z + second.root.position.z) / 2,
    )
  }
}
