import * as THREE from 'three'
import { Car, type VehicleKind } from './Car'
import type { City } from './City'

const BLOCK = 48
const LANE_OFFSET = 3.1
const ROAD_LIMIT = 336
const TRAFFIC_COUNT = 28

type TrafficAxis = 'x' | 'z'

type TrafficTurn = {
  p0: THREE.Vector2
  c0: THREE.Vector2
  c1: THREE.Vector2
  p1: THREE.Vector2
  targetAxis: TrafficAxis
  targetDirection: -1 | 1
  progress: number
  duration: number
  speed: number
}

type TrafficUnit = {
  car: Car
  axis: TrafficAxis
  direction: -1 | 1
  nextIntersection: number
  cruiseSpeed: number
  acceleration: number
  impactCooldown: number
  turn: TrafficTurn | null
  decisionIntersection: number | null
}

export type TrafficUpdate = {
  playerCollisions: number
  collisionPoints: THREE.Vector3[]
  explosions: THREE.Vector3[]
  smokingPositions: THREE.Vector3[]
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

  update(dt: number, player: Car, city: City): TrafficUpdate {
    const playerPosition = player.root.position
    const explosions: THREE.Vector3[] = []
    const smokingPositions: THREE.Vector3[] = []

    for (let index = this.units.length - 1; index >= 0; index -= 1) {
      const unit = this.units[index]
      const dx = unit.car.root.position.x - playerPosition.x
      const dz = unit.car.root.position.z - playerPosition.z
      if (Math.hypot(dx, dz) > 205 || (unit.car.exploded && unit.car.hitCooldown <= 0)) {
        unit.car.dispose()
        this.units.splice(index, 1)
      }
    }
    while (this.units.length < TRAFFIC_COUNT) this.spawn(playerPosition)

    for (const unit of this.units) {
      if (!unit.car.exploded) {
        this.move(unit, dt, player, city)
      }
      if (unit.car.isSmoking) {
        unit.car.smokeTimer += dt
        if (unit.car.smokeTimer >= 0.09) {
          unit.car.smokeTimer = 0
          smokingPositions.push(unit.car.getHoodPosition())
        }
      }
    }

    const collisionPoints: THREE.Vector3[] = []
    let playerCollisions = 0
    for (let index = 0; index < this.units.length; index += 1) {
      const unit = this.units[index]
      unit.impactCooldown = Math.max(0, unit.impactCooldown - dt)
      if (unit.car.exploded) continue

      const playerDx = player.root.position.x - unit.car.root.position.x
      const playerDz = player.root.position.z - unit.car.root.position.z
      if (playerDx * playerDx + playerDz * playerDz < 81 && player.collideWith(unit.car, dt)) {
        if (unit.impactCooldown === 0) {
          playerCollisions += 1
          collisionPoints.push(this.contactPoint(player, unit.car))
          unit.impactCooldown = 0.45
          const hitRes = unit.car.registerHit('vehicle', 0.45)
          if (hitRes.isNewExplosion) {
            explosions.push(unit.car.root.position.clone())
          }
          if (unit.turn) unit.turn = null
        }
      }

      for (let otherIndex = index + 1; otherIndex < this.units.length; otherIndex += 1) {
        const other = this.units[otherIndex]
        if (other.car.exploded) continue
        const dx = unit.car.root.position.x - other.car.root.position.x
        const dz = unit.car.root.position.z - other.car.root.position.z
        if (dx * dx + dz * dz > 225) continue
        if (!unit.car.collideWith(other.car, dt)) continue
        if (unit.impactCooldown === 0 && other.impactCooldown === 0) {
          collisionPoints.push(this.contactPoint(unit.car, other.car))
          unit.impactCooldown = 0.45
          other.impactCooldown = 0.45
          const hitA = unit.car.registerHit('vehicle', 0.45)
          const hitB = other.car.registerHit('vehicle', 0.45)
          if (hitA.isNewExplosion) explosions.push(unit.car.root.position.clone())
          if (hitB.isNewExplosion) explosions.push(other.car.root.position.clone())
          if (unit.turn) unit.turn = null
          if (other.turn) other.turn = null
        }
      }
    }

    return { playerCollisions, collisionPoints, explosions, smokingPositions }
  }

  private spawn(player: THREE.Vector3): void {
    const axis: TrafficAxis = Math.random() < 0.53 ? 'z' : 'x'
    const direction: -1 | 1 = Math.random() < 0.5 ? -1 : 1
    const kind = this.chooseKind()
    let x: number
    let z: number

    if (axis === 'z') {
      const road = THREE.MathUtils.clamp(Math.round(player.x / BLOCK) + Math.floor(Math.random() * 9) - 4, -7, 7) * BLOCK
      z = player.z + (Math.random() * 2 - 1) * 145
      if (Math.abs(z - player.z) < 25 && Math.abs(road - player.x) < 16) z += direction * 38
      x = road - direction * LANE_OFFSET
    } else {
      const road = Math.round((player.z + (Math.random() * 2 - 1) * 140) / BLOCK) * BLOCK
      x = THREE.MathUtils.clamp(player.x + (Math.random() * 2 - 1) * 175, -330, 330)
      if (Math.abs(x - player.x) < 25 && Math.abs(road - player.z) < 16) x += direction * 38
      z = road + direction * LANE_OFFSET
    }

    const cruiseSpeed = kind === 'bicycle'
      ? 3.8 + Math.random() * 3.5
      : kind === 'fuel_tanker'
        ? 7.2 + Math.random() * 4.0
        : kind === 'truck' || kind === 'bus'
          ? 6.5 + Math.random() * 4.5
          : kind === 'pickup' || kind === 'suv'
            ? 9 + Math.random() * 7
            : 11 + Math.random() * 8
    const colors = kind === 'bus' ? 0xe0a824 : kind === 'fuel_tanker' ? 0xf0f3f6 : paintColors[Math.floor(Math.random() * paintColors.length)]
    const scale = kind === 'bicycle' ? 0.88 : (kind === 'truck' || kind === 'bus' || kind === 'fuel_tanker') ? 0.98 : 1
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
      acceleration: (kind === 'truck' || kind === 'bus' || kind === 'fuel_tanker') ? 2.0 : kind === 'bicycle' ? 2.8 : 3.4,
      impactCooldown: 0,
      turn: null,
      decisionIntersection: null,
    })
  }

  private chooseKind(): VehicleKind {
    const roll = Math.random()
    if (roll < 0.22) return 'sedan'
    if (roll < 0.38) return 'suv'
    if (roll < 0.52) return 'pickup'
    if (roll < 0.65) return 'truck'
    if (roll < 0.78) return 'fuel_tanker' // Caminhão tanque de combustível inflamável com carroceria redonda
    if (roll < 0.89) return 'bus'
    return 'bicycle'
  }

  private move(unit: TrafficUnit, dt: number, player: Car, city: City): void {
    if (unit.turn) {
      this.advanceTurn(unit, dt)
      return
    }

    const car = unit.car

    // Car-following / traffic collision prevention ahead in same lane
    let targetSpeed = unit.cruiseSpeed

    // Traffic Light Check
    const pos = car.root.position
    const coordinate = unit.axis === 'z' ? pos.z : pos.x
    const distanceToIntersection = (unit.nextIntersection - coordinate) * unit.direction

    if (distanceToIntersection > 1.0 && distanceToIntersection <= 18.0) {
      const esquinaX = unit.axis === 'z' ? Math.round(pos.x / BLOCK) * BLOCK : unit.nextIntersection
      const esquinaZ = unit.axis === 'z' ? unit.nextIntersection : Math.round(pos.z / BLOCK) * BLOCK
      
      if (city.isTrafficLightRedFor(esquinaX, esquinaZ, unit.axis)) {
        targetSpeed = 0
      }
    }
    for (const other of this.units) {
      if (other === unit) continue
      if (other.axis === unit.axis && other.direction === unit.direction) {
        const dx = other.car.root.position.x - car.root.position.x
        const dz = other.car.root.position.z - car.root.position.z
        const forwardDist = unit.axis === 'z' ? dz * unit.direction : dx * unit.direction
        const lateralDist = unit.axis === 'z' ? Math.abs(dx) : Math.abs(dz)
        if (lateralDist < 2.5 && forwardDist > 0 && forwardDist < 10) {
          targetSpeed = Math.min(targetSpeed, Math.max(0, other.car.speed * 0.85))
          break
        }
      }
    }

    // ==========================================
    // EVASÃO DO CAMINHÃO TANQUE (Risco de Explosão Inflamável)
    // ==========================================
    if (unit.car.kind !== 'fuel_tanker') {
      const activeTankers: Car[] = []
      if (player.kind === 'fuel_tanker' && !player.exploded) {
        activeTankers.push(player)
      }
      for (const u of this.units) {
        if (u.car.kind === 'fuel_tanker' && !u.car.exploded && u !== unit) {
          activeTankers.push(u.car)
        }
      }

      for (const tanker of activeTankers) {
        const dx = tanker.root.position.x - car.root.position.x
        const dz = tanker.root.position.z - car.root.position.z
        const distSq = dx * dx + dz * dz

        if (distSq < 26 * 26) {
          const dist = Math.sqrt(distSq)
          if (dist > 0.1) {
            // Veículo do trânsito tenta desviar do caminhão com carroceria redonda
            const evadeStrength = Math.min(1, (26 - dist) / 18)
            
            if (unit.axis === 'z') {
              const sideSign = car.root.position.x >= tanker.root.position.x ? 1 : -1
              car.root.position.x += sideSign * 9.5 * evadeStrength * dt
            } else {
              const sideSign = car.root.position.z >= tanker.root.position.z ? 1 : -1
              car.root.position.z += sideSign * 9.5 * evadeStrength * dt
            }

            const forwardDist = unit.axis === 'z' ? dz * unit.direction : dx * unit.direction
            if (forwardDist > 0 && forwardDist < 16) {
              targetSpeed = Math.min(targetSpeed, -2.0)
            }
          }
        }
      }
    }

    const speedDelta = THREE.MathUtils.clamp(targetSpeed - car.speed, -unit.acceleration * dt * 1.5, unit.acceleration * dt)
    car.speed += speedDelta

    // Lane centering
    if (unit.axis === 'z') {
      const roadX = Math.round(pos.x / BLOCK) * BLOCK
      const targetX = roadX - unit.direction * LANE_OFFSET
      pos.x += (targetX - pos.x) * Math.min(1, dt * 5)
    } else {
      const roadZ = Math.round(pos.z / BLOCK) * BLOCK
      const targetZ = roadZ + unit.direction * LANE_OFFSET
      pos.z += (targetZ - pos.z) * Math.min(1, dt * 5)
    }

    // Check intersection approach

    // Turn initiation window: approx 7.5 meters before intersection center
    if (distanceToIntersection <= 7.8 && distanceToIntersection > 1.0 && unit.decisionIntersection !== unit.nextIntersection) {
      unit.decisionIntersection = unit.nextIntersection
      const turning = this.tryInitiateTurn(unit)
      if (turning) {
        this.advanceTurn(unit, dt)
        return
      }
    }

    // If passed intersection without turning, advance to next block
    if (distanceToIntersection <= -0.5) {
      unit.nextIntersection += unit.direction * BLOCK
      unit.decisionIntersection = null
    }

    // Road limits check (near city boundary rivers at X = ±336)
    const x = car.root.position.x
    if (unit.axis === 'x' && ((x > ROAD_LIMIT - 6 && unit.direction > 0) || (x < -ROAD_LIMIT + 6 && unit.direction < 0))) {
      // Must turn into a Z-street
      unit.axis = 'z'
      unit.direction = Math.random() < 0.5 ? 1 : -1
      this.setLane(unit)
      car.yaw = this.heading(unit.axis, unit.direction)
      car.root.rotation.set(0, car.yaw, 0)
      unit.nextIntersection = this.nextGridCoordinate(car.root.position.z, unit.direction)
      unit.decisionIntersection = null
      return
    }

    car.yaw = this.heading(unit.axis, unit.direction)
    car.root.rotation.set(0, car.yaw, 0)
    car.integrateMovement(dt)
  }

  private tryInitiateTurn(unit: TrafficUnit): boolean {
    const car = unit.car
    const currentAxis = unit.axis
    const currentDir = unit.direction
    let targetAxis: TrafficAxis
    let targetDir: -1 | 1
    let Ix: number
    let Iz: number

    if (currentAxis === 'z') {
      Ix = Math.round(car.root.position.x / BLOCK) * BLOCK
      Iz = unit.nextIntersection
      targetAxis = 'x'

      const canGoEast = Ix < ROAD_LIMIT - 10
      const canGoWest = Ix > -ROAD_LIMIT + 10
      if (!canGoEast && !canGoWest) return false

      // Turn probability at standard intersections
      if (Math.random() > 0.32) return false

      if (canGoEast && canGoWest) {
        targetDir = Math.random() < 0.5 ? 1 : -1
      } else {
        targetDir = canGoEast ? 1 : -1
      }
    } else {
      Ix = unit.nextIntersection
      Iz = Math.round(car.root.position.z / BLOCK) * BLOCK
      targetAxis = 'z'

      const isAtEastEdge = Ix >= ROAD_LIMIT - 15 && currentDir > 0
      const isAtWestEdge = Ix <= -ROAD_LIMIT + 15 && currentDir < 0

      if (isAtEastEdge || isAtWestEdge) {
        // Must turn onto north/south avenue to respect city boundary
        targetDir = Math.random() < 0.5 ? 1 : -1
      } else {
        if (Math.random() > 0.32) return false
        targetDir = Math.random() < 0.5 ? 1 : -1
      }
    }

    // Determine if it is a right or left turn
    let isRightTurn = false
    if (currentAxis === 'z') {
      isRightTurn = (currentDir === 1 && targetDir === -1) || (currentDir === -1 && targetDir === 1)
    } else {
      isRightTurn = (currentDir === 1 && targetDir === 1) || (currentDir === -1 && targetDir === -1)
    }

    const Din = isRightTurn ? 6.2 : 7.6
    const Dout = isRightTurn ? 6.2 : 7.6

    let p0: THREE.Vector2
    let t0: THREE.Vector2
    if (currentAxis === 'z') {
      p0 = new THREE.Vector2(car.root.position.x, Iz - currentDir * Din)
      t0 = new THREE.Vector2(0, currentDir)
    } else {
      p0 = new THREE.Vector2(Ix - currentDir * Din, car.root.position.z)
      t0 = new THREE.Vector2(currentDir, 0)
    }

    let p1: THREE.Vector2
    let t1: THREE.Vector2
    if (targetAxis === 'x') {
      p1 = new THREE.Vector2(Ix + targetDir * Dout, Iz + targetDir * LANE_OFFSET)
      t1 = new THREE.Vector2(targetDir, 0)
    } else {
      p1 = new THREE.Vector2(Ix - targetDir * LANE_OFFSET, Iz + targetDir * Dout)
      t1 = new THREE.Vector2(0, targetDir)
    }

    const dist = p0.distanceTo(p1)
    const L = dist * 0.44
    const c0 = new THREE.Vector2(p0.x + t0.x * L, p0.y + t0.y * L)
    const c1 = new THREE.Vector2(p1.x - t1.x * L, p1.y - t1.y * L)

    const arcLength = this.bezierLength(p0, c0, c1, p1)
    const turnSpeed = Math.max(4.8, unit.cruiseSpeed * 0.78)
    const duration = Math.max(0.65, arcLength / turnSpeed)

    unit.turn = {
      p0,
      c0,
      c1,
      p1,
      targetAxis,
      targetDirection: targetDir,
      progress: 0,
      duration,
      speed: turnSpeed,
    }

    return true
  }

  private advanceTurn(unit: TrafficUnit, dt: number): void {
    const turn = unit.turn!
    const car = unit.car
    turn.progress += dt / turn.duration
    const t = Math.min(1, turn.progress)

    const pos = new THREE.Vector2()
    this.bezierPoint(turn.p0, turn.c0, turn.c1, turn.p1, t, pos)
    car.root.position.set(pos.x, 0, pos.y)

    const tangent = new THREE.Vector2()
    this.bezierDerivative(turn.p0, turn.c0, turn.c1, turn.p1, t, tangent)
    if (tangent.lengthSq() > 0.0001) {
      const yaw = Math.atan2(-tangent.x, -tangent.y)
      car.yaw = yaw
      car.root.rotation.set(0, yaw, 0)
    }

    car.speed = turn.speed
    const wheelSpin = -car.speed * dt / 0.38
    for (const wheel of car.wheels) wheel.rotation.x += wheelSpin

    if (t >= 1) {
      unit.axis = turn.targetAxis
      unit.direction = turn.targetDirection
      unit.turn = null
      car.yaw = this.heading(unit.axis, unit.direction)
      car.root.rotation.set(0, car.yaw, 0)
      const currentCoord = unit.axis === 'z' ? car.root.position.z : car.root.position.x
      unit.nextIntersection = this.nextGridCoordinate(currentCoord, unit.direction)
      unit.decisionIntersection = null
      this.setLane(unit)
    }
  }

  private bezierPoint(p0: THREE.Vector2, c0: THREE.Vector2, c1: THREE.Vector2, p1: THREE.Vector2, t: number, out: THREE.Vector2): void {
    const u = 1 - t
    const tt = t * t
    const uu = u * u
    const uuu = uu * u
    const ttt = tt * t
    out.x = uuu * p0.x + 3 * uu * t * c0.x + 3 * u * tt * c1.x + ttt * p1.x
    out.y = uuu * p0.y + 3 * uu * t * c0.y + 3 * u * tt * c1.y + ttt * p1.y
  }

  private bezierDerivative(p0: THREE.Vector2, c0: THREE.Vector2, c1: THREE.Vector2, p1: THREE.Vector2, t: number, out: THREE.Vector2): void {
    const u = 1 - t
    const a = 3 * u * u
    const b = 6 * u * t
    const c = 3 * t * t
    out.x = a * (c0.x - p0.x) + b * (c1.x - c0.x) + c * (p1.x - c1.x)
    out.y = a * (c0.y - p0.y) + b * (c1.y - c0.y) + c * (p1.y - c1.y)
  }

  private bezierLength(p0: THREE.Vector2, c0: THREE.Vector2, c1: THREE.Vector2, p1: THREE.Vector2, samples = 8): number {
    let length = 0
    let prevX = p0.x
    let prevY = p0.y
    const temp = new THREE.Vector2()
    for (let i = 1; i <= samples; i++) {
      const t = i / samples
      this.bezierPoint(p0, c0, c1, p1, t, temp)
      length += Math.hypot(temp.x - prevX, temp.y - prevY)
      prevX = temp.x
      prevY = temp.y
    }
    return length
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

  dispose(): void {
    this.reset()
  }
}
