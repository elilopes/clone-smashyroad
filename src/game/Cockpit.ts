import * as THREE from 'three'

export class Cockpit {
  private readonly root = new THREE.Group()
  private readonly wheelPivot = new THREE.Group()
  private wheelAngle = 0

  constructor(scene: THREE.Scene) {
    const interiorMaterial = new THREE.MeshStandardMaterial({ color: 0x1c2121, roughness: 0.82, metalness: 0.1 })
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x485250, roughness: 0.52, metalness: 0.45 })
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x141718, roughness: 0.72 })
    const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x2e3c42, roughness: 0.85 })
    const handMaterial = new THREE.MeshStandardMaterial({ color: 0xdfaa82, roughness: 0.84 })
    const wiperMaterial = new THREE.MeshStandardMaterial({ color: 0x111314, roughness: 0.9 })
    const mirrorCaseMaterial = new THREE.MeshStandardMaterial({ color: 0x181c1c, roughness: 0.7 })
    const mirrorFaceMaterial = new THREE.MeshStandardMaterial({ color: 0xbacacf, roughness: 0.15, metalness: 0.88 })
    const dialMaterial = new THREE.MeshStandardMaterial({ color: 0xff6238, emissive: 0x8a2910, emissiveIntensity: 0.75 })

    // Transparent windshield glass
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x9edcee,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    })

    // Sunstrip tint at top of windshield
    const sunstripMaterial = new THREE.MeshStandardMaterial({
      color: 0x152229,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })

    this.root.visible = false

    // Dashboard main body
    const dashboard = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.32, 0.56), interiorMaterial)
    dashboard.position.set(0, -0.48, -0.96)
    this.root.add(dashboard)

    // Instrument gauge cluster
    const instrumentCluster = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.13, 0.06), trimMaterial)
    instrumentCluster.position.set(0, -0.29, -0.84)
    this.root.add(instrumentCluster)

    // Glowing speedometer and tachometer dials
    for (const side of [-1, 1]) {
      const dial = new THREE.Mesh(new THREE.CircleGeometry(0.038, 16), dialMaterial)
      dial.position.set(side * 0.12, -0.29, -0.805)
      this.root.add(dial)
    }

    // Steering wheel (lowered 20%+, now at Y = -0.34, keeping the road horizon completely clear)
    this.wheelPivot.position.set(0, -0.34, -0.74)
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.026, 8, 36), wheelMaterial)
    this.wheelPivot.add(wheelRim)

    const centerHub = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.045, 14), trimMaterial)
    centerHub.rotation.x = Math.PI / 2
    this.wheelPivot.add(centerHub)

    const horizontalSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.032, 0.024), trimMaterial)
    this.wheelPivot.add(horizontalSpoke)

    const bottomSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.20, 0.024), trimMaterial)
    bottomSpoke.position.set(0, -0.10, 0)
    this.wheelPivot.add(bottomSpoke)

    // Compact, slender arms & hands placed neatly at 9-and-3 driving position
    for (const side of [-1, 1]) {
      const arm = this.makeSegment(
        new THREE.Vector3(side * 0.42, -0.38, 0.12),
        new THREE.Vector3(side * 0.23, -0.015, 0.015),
        0.028,
        sleeveMaterial,
      )
      this.wheelPivot.add(arm)

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), handMaterial)
      hand.position.set(side * 0.23, -0.015, 0.015)
      this.wheelPivot.add(hand)
    }
    this.root.add(this.wheelPivot)

    // --- WINDSHIELD & CABIN STRUCTURE ---

    // 1. Windshield Glass (tilted realistic automotive angle)
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 1.08), glassMaterial)
    windshield.position.set(0, 0.11, -0.99)
    windshield.rotation.x = -0.22
    this.root.add(windshield)

    // 2. Windshield Sunstrip (faixa superior escura)
    const sunstrip = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.18), sunstripMaterial)
    sunstrip.position.set(0, 0.50, -0.90)
    sunstrip.rotation.x = -0.22
    this.root.add(sunstrip)

    // 3. A-Pillars (Colunas A laterais inclinadas)
    for (const side of [-1, 1]) {
      const pillar = this.makeSegment(
        new THREE.Vector3(side * 1.18, -0.38, -0.95),
        new THREE.Vector3(side * 0.78, 0.58, -0.78),
        0.052,
        interiorMaterial,
      )
      this.root.add(pillar)
    }

    // 4. Roof Header & Folded Sun Visors (Borda superior do teto)
    const roofHeader = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.13, 0.38), interiorMaterial)
    roofHeader.position.set(0, 0.62, -0.80)
    this.root.add(roofHeader)

    for (const side of [-1, 1]) {
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.065, 0.18), interiorMaterial)
      visor.position.set(side * 0.46, 0.56, -0.78)
      this.root.add(visor)
    }

    // 5. Rearview Mirror (Retrovisor Interno Central)
    const mirrorBracket = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.07, 8), trimMaterial)
    mirrorBracket.position.set(0, 0.51, -0.80)
    this.root.add(mirrorBracket)

    const mirrorGroup = new THREE.Group()
    mirrorGroup.position.set(0, 0.45, -0.78)
    mirrorGroup.rotation.y = 0.12
    mirrorGroup.rotation.x = -0.08

    const mirrorCase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.088, 0.03), mirrorCaseMaterial)
    mirrorGroup.add(mirrorCase)

    const mirrorFace = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.072, 0.005), mirrorFaceMaterial)
    mirrorFace.position.set(0, 0, 0.016)
    mirrorGroup.add(mirrorFace)

    this.root.add(mirrorGroup)

    // 6. Windshield Wipers (Limpadores de Parabrisa na base)
    for (const side of [-1, 1]) {
      const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.016, 0.02), wiperMaterial)
      wiper.position.set(side * 0.35, -0.27, -1.06)
      wiper.rotation.z = -0.06
      this.root.add(wiper)
    }

    // 7. Hood visible outside windshield ahead
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.11, 0.95), interiorMaterial)
    hood.position.set(0, -0.47, -1.62)
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

