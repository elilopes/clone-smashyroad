import * as THREE from 'three'
import type { DriveInput } from './Car'

type Segment = THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>

export class StickPerson {
  readonly scene: THREE.Scene
  readonly root = new THREE.Group()
  yaw = 0
  speed = 0
  groundElevation = 0
  private walkPhase = 0
  private readonly torso: Segment
  private readonly limbs: Segment[]

  constructor(scene: THREE.Scene) {
    this.scene = scene
    const stickMaterial = new THREE.MeshStandardMaterial({ color: 0x293432, roughness: 1.0, metalness: 0.0 })
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xff7849, roughness: 0.85, metalness: 0.0 })
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xe4b28c, roughness: 0.9, metalness: 0.0 })
    this.torso = this.makeSegment(stickMaterial, 0.095)
    this.root.add(this.torso)

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skinMaterial)
    head.position.set(0, 1.76, 0)
    head.castShadow = true
    this.root.add(head)

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), accentMaterial)
    chest.position.set(0, 1.38, 0)
    chest.castShadow = true
    this.root.add(chest)

    this.limbs = Array.from({ length: 8 }, (_, index) => {
      const material = index < 4 ? (index < 2 ? accentMaterial : stickMaterial) : stickMaterial
      const thickness = index === 4 || index === 5 ? 0.075 : 0.052
      const segment = this.makeSegment(material, thickness)
      this.root.add(segment)
      return segment
    })
    this.root.visible = false
    scene.add(this.root)
    this.animateLimbs(0)
  }

  isSwimming = false
  speedMultiplier = 1.0

  setPosition(x: number, z: number, yaw = 0): void {
    this.root.position.set(x, this.isSwimming ? -0.52 : 0, z)
    this.yaw = yaw
    this.root.rotation.y = yaw
    this.root.rotation.x = this.isSwimming ? 0.42 : 0
    this.speed = 0
    this.walkPhase = 0
    this.animateLimbs(0)
  }

  update(
    dt: number,
    input: DriveInput,
    collides: (x: number, z: number, radius: number) => boolean,
    isSwimming = false,
    cameraYaw = 0,
  ): boolean {
    this.isSwimming = isSwimming
    const targetMaxSpeed = (this.isSwimming ? 5.2 : 7.8) * this.speedMultiplier

    // Omnidirectional movement support (WASD / Arrows / Joystick / Touch)
    // Screen-space coordinates:
    // screenRight: +1 for D/right, -1 for A/left
    // screenForward: +1 for W/up, -1 for S/down
    const screenRight = -input.steer
    const screenForward = input.throttle
    const rawMagnitude = Math.hypot(screenRight, screenForward)

    if (rawMagnitude > 0.04) {
      const inputMagnitude = Math.min(1, rawMagnitude)

      // Transform screen movement by camera yaw so W is always UP on screen,
      // S is always DOWN on screen, A is always LEFT on screen, D is always RIGHT on screen
      const cosY = Math.cos(cameraYaw)
      const sinY = Math.sin(cameraYaw)
      const worldDirX = screenRight * cosY - screenForward * sinY
      const worldDirZ = -screenRight * sinY - screenForward * cosY

      const targetYaw = Math.atan2(-worldDirX, -worldDirZ)
      let diff = targetYaw - this.yaw
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      if (this.speed < 0.2) {
        this.yaw = targetYaw
      } else {
        this.yaw += diff * Math.min(1, dt * 18)
      }
      this.root.rotation.y = this.yaw

      const targetSpeed = targetMaxSpeed * (inputMagnitude * 0.85 + 0.15 * inputMagnitude * inputMagnitude)
      this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 12)
    } else {
      this.speed *= Math.max(0, 1 - dt * 12)
      if (Math.abs(this.speed) < 0.05) this.speed = 0
    }

    this.root.rotation.x = this.isSwimming ? 0.42 : 0

    const oldX = this.root.position.x
    const oldZ = this.root.position.z
    const step = this.speed * dt
    let collided = false

    if (step > 0.001) {
      const stepX = -Math.sin(this.yaw) * step
      const stepZ = -Math.cos(this.yaw) * step

      this.root.position.x += stepX
      this.root.position.z += stepZ

      if (collides(this.root.position.x, this.root.position.z, 0.34)) {
        collided = true
        // Wall sliding: try X only
        this.root.position.z = oldZ
        if (collides(this.root.position.x, this.root.position.z, 0.34)) {
          // Try Z only
          this.root.position.x = oldX
          this.root.position.z = oldZ + stepZ
          if (collides(this.root.position.x, this.root.position.z, 0.34)) {
            // Blocked in both
            this.root.position.x = oldX
            this.root.position.z = oldZ
            this.speed *= 0.2
          }
        }
      }
    }

    this.root.position.y = this.isSwimming ? -0.52 + Math.sin(this.walkPhase * 1.8) * 0.08 : (this.groundElevation || 0)

    if (Math.abs(this.speed) > 0.35) this.walkPhase += dt * (5 + Math.abs(this.speed) * 0.72)
    else this.walkPhase *= Math.max(0, 1 - dt * 7)
    this.animateLimbs(Math.sin(this.walkPhase) * Math.min(1, Math.abs(this.speed) / 2.2))
    return collided
  }

  stepTowards(
    targetX: number,
    targetZ: number,
    dt: number,
    targetSpeed = 7.5,
    collides: (x: number, z: number, radius: number) => boolean,
  ): { distance: number; arrived: boolean } {
    const dx = targetX - this.root.position.x
    const dz = targetZ - this.root.position.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.1) {
      this.speed = 0
      this.walkPhase = 0
      this.animateLimbs(0)
      return { distance: dist, arrived: true }
    }

    this.yaw = Math.atan2(-dx, -dz)
    this.root.rotation.y = this.yaw
    this.root.rotation.x = this.isSwimming ? 0.42 : 0
    this.speed = targetSpeed

    const oldX = this.root.position.x
    const oldZ = this.root.position.z
    const step = Math.min(dist, targetSpeed * dt)
    this.root.position.x += -Math.sin(this.yaw) * step
    this.root.position.z += -Math.cos(this.yaw) * step

    const collided = collides(this.root.position.x, this.root.position.z, 0.34)
    if (collided) {
      this.root.position.x = oldX
      this.root.position.z = oldZ
    }

    this.root.position.y = this.isSwimming ? -0.52 + Math.sin(this.walkPhase * 1.8) * 0.08 : (this.groundElevation || 0)

    this.walkPhase += dt * (5 + Math.abs(this.speed) * 0.72)
    this.animateLimbs(Math.sin(this.walkPhase) * Math.min(1, Math.abs(this.speed) / 2.2))

    const newDist = Math.hypot(targetX - this.root.position.x, targetZ - this.root.position.z)
    return { distance: newDist, arrived: newDist <= 2.2 }
  }

  private animateLimbs(stride: number): void {
    this.setSegment(this.torso, new THREE.Vector3(0, 0.75, 0), new THREE.Vector3(0, 1.48, 0))
    const legSwing = stride * 0.34
    const armSwing = stride * 0.27
    const leftHip = new THREE.Vector3(-0.1, 0.76, 0)
    const rightHip = new THREE.Vector3(0.1, 0.76, 0)
    const leftKnee = new THREE.Vector3(-0.13, 0.39, -legSwing)
    const rightKnee = new THREE.Vector3(0.13, 0.39, legSwing)
    const leftFoot = new THREE.Vector3(-0.15, 0.08, -legSwing * 1.55)
    const rightFoot = new THREE.Vector3(0.15, 0.08, legSwing * 1.55)
    const leftShoulder = new THREE.Vector3(-0.13, 1.42, 0)
    const rightShoulder = new THREE.Vector3(0.13, 1.42, 0)
    const leftElbow = new THREE.Vector3(-0.34, 1.13, armSwing)
    const rightElbow = new THREE.Vector3(0.34, 1.13, -armSwing)
    const leftHand = new THREE.Vector3(-0.34, 0.91, armSwing * 1.4)
    const rightHand = new THREE.Vector3(0.34, 0.91, -armSwing * 1.4)

    const endpoints: [THREE.Vector3, THREE.Vector3][] = [
      [leftShoulder, leftElbow], [rightShoulder, rightElbow],
      [leftElbow, leftHand], [rightElbow, rightHand],
      [leftHip, leftKnee], [rightHip, rightKnee],
      [leftKnee, leftFoot], [rightKnee, rightFoot],
    ]
    endpoints.forEach(([start, end], index) => this.setSegment(this.limbs[index], start, end))
  }

  private makeSegment(material: THREE.MeshStandardMaterial, radius: number): Segment {
    const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius, 1, 7), material)
    segment.castShadow = true
    return segment
  }

  private setSegment(segment: Segment, start: THREE.Vector3, end: THREE.Vector3): void {
    const direction = end.clone().sub(start)
    segment.position.copy(start).add(end).multiplyScalar(0.5)
    segment.scale.y = direction.length()
    segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  }

  dispose(): void {
    this.scene.remove(this.root)
  }
}
