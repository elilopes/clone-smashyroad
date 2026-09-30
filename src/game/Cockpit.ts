import * as THREE from 'three'

export class Cockpit {
  private readonly root = new THREE.Group()
  private readonly wheelPivot = new THREE.Group()
  private wheelAngle = 0

  constructor(scene: THREE.Scene) {
    const dashboardMaterial = new THREE.MeshStandardMaterial({ color: 0x222a29, roughness: 0.75, metalness: 0.12 })
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x56615d, roughness: 0.56, metalness: 0.48 })
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x151918, roughness: 0.68 })
    const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x34444b, roughness: 0.84 })
    const handMaterial = new THREE.MeshStandardMaterial({ color: 0xd9a782, roughness: 0.9 })
    this.root.visible = false

    const dashboard = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.34, 0.48), dashboardMaterial)
    dashboard.position.set(0, -0.54, -1.04)
    this.root.add(dashboard)
    const instrumentPanel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 0.08), trimMaterial)
    instrumentPanel.position.set(0, -0.32, -0.84)
    this.root.add(instrumentPanel)

    this.wheelPivot.position.set(0, -0.19, -0.78)
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.036, 8, 36), wheelMaterial)
    this.wheelPivot.add(wheel)
    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.065, 12), trimMaterial)
    center.rotation.x = Math.PI / 2
    this.wheelPivot.add(center)
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.53, 0.045), trimMaterial)
    this.wheelPivot.add(spoke)
    for (const side of [-1, 1]) {
      const arm = this.makeSegment(
        new THREE.Vector3(side * 0.48, -0.39, 0.23),
        new THREE.Vector3(side * 0.205, 0.105, 0.015),
        0.067,
        sleeveMaterial,
      )
      this.wheelPivot.add(arm)
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), handMaterial)
      hand.position.set(side * 0.205, 0.105, 0.015)
      this.wheelPivot.add(hand)
    }
    this.root.add(this.wheelPivot)

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.13, 0.7), dashboardMaterial)
    hood.position.set(0, -0.44, -1.45)
    this.root.add(hood)
    scene.add(this.root)
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible
  }

  syncCamera(camera: THREE.Camera): void {
    this.root.position.copy(camera.position)
    this.root.quaternion.copy(camera.quaternion)
  }

  update(steer: number, dt: number): void {
    const targetAngle = THREE.MathUtils.clamp(steer, -1, 1) * 0.62
    this.wheelAngle += (targetAngle - this.wheelAngle) * Math.min(1, dt * 11)
    this.wheelPivot.rotation.z = this.wheelAngle
  }

  private makeSegment(start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
    const direction = end.clone().sub(start)
    const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius, direction.length(), 8), material)
    segment.position.copy(start).add(end).multiplyScalar(0.5)
    segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    return segment
  }
}
