import * as THREE from 'three'

export interface KingKongHitResult {
  hit: boolean
  remainingHp: number
  defeated: boolean
  position: THREE.Vector3
}

export type Bounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  minY: number
  maxY: number
}

export class KingKong {
  readonly scene: THREE.Scene
  readonly root = new THREE.Group()
  readonly buildingGroup = new THREE.Group()
  readonly kongGroup = new THREE.Group()

  // Location in city
  centerX = 0
  centerZ = 0
  blockX = 0

  // Kong Health & State (50 colisões de resistência)
  readonly maxHp = 50
  hp = 50
  alive = true
  falling = false
  fallVelocity = 0
  fallY = 0
  fallRotX = 0
  fallRotZ = 0

  // Animation Timers
  private hitFlashTimer = 0
  private shakeTimer = 0
  private kongAnimTimer = 0
  private rightArmGroup = new THREE.Group()
  private headGroup = new THREE.Group()
  private beaconLightMesh!: THREE.Mesh

  // Kong World Position & Hitbox
  readonly kongHitCenter = new THREE.Vector3()
  readonly kongHitRadius = 5.2

  // Materials
  private readonly stoneMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.82,
    metalness: 0.15,
  })
  private readonly stoneDarkMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.85,
    metalness: 0.2,
  })
  private readonly windowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 0.85,
    roughness: 0.35,
  })
  private readonly spireMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.85,
  })
  private readonly beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 3.5,
    roughness: 0.2,
  })

  // Kong Materials
  private readonly furMat = new THREE.MeshStandardMaterial({
    color: 0x42220f,
    roughness: 0.92,
    metalness: 0.05,
  })
  private readonly faceChestMat = new THREE.MeshStandardMaterial({
    color: 0xdb936c,
    roughness: 0.78,
  })
  private readonly teethMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
  })
  private readonly mouthMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.6,
  })
  private readonly eyeMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
  })
  private readonly hitFlashMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xff2222,
    emissiveIntensity: 3.5,
    roughness: 0.1,
  })

  private readonly kongMeshes: THREE.Mesh[] = []
  private readonly buildingBounds: Bounds[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.root.add(this.buildingGroup)
    this.root.add(this.kongGroup)
    this.scene.add(this.root)
  }

  get isDefeated(): boolean {
    return !this.alive
  }

  get hitPercent(): number {
    return Math.max(0, Math.min(100, Math.round((this.hp / this.maxHp) * 100)))
  }

  reset(blockX: number, centerZ: number): void {
    this.blockX = blockX
    this.centerZ = centerZ
    this.centerX = blockX * 48 + 24
    this.hp = this.maxHp
    this.alive = true
    this.falling = false
    this.fallVelocity = 0
    this.fallY = 0
    this.fallRotX = 0
    this.fallRotZ = 0
    this.hitFlashTimer = 0
    this.kongAnimTimer = 0

    // Clear previous models
    this.clearGroup(this.buildingGroup)
    this.clearGroup(this.kongGroup)
    this.kongMeshes.length = 0
    this.buildingBounds.length = 0

    // Build the Art-Deco Empire State Skyscraper and King Kong
    this.buildSkyscraper()
    this.buildKingKong()
    this.updateKongHitCenter()
  }

  private clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0]
      group.remove(child)
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose()
      } else if (child instanceof THREE.Group) {
        this.clearGroup(child)
      }
    }
  }

  getBounds(): Bounds[] {
    return this.buildingBounds
  }

  private buildSkyscraper(): void {
    const cx = this.centerX
    const cz = this.centerZ

    // 1. Plaza Pavement / Sidewalk Base
    const basePave = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 38),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.95 }),
    )
    basePave.rotation.x = -Math.PI / 2
    basePave.position.set(cx, 0.02, cz)
    basePave.receiveShadow = true
    this.buildingGroup.add(basePave)

    // 2. Skyscraper Block 1 (Podium Base: 28x28m, height 16m)
    const b1Height = 16
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(28, b1Height, 28), this.stoneMat)
    b1.position.set(cx, b1Height / 2, cz)
    b1.castShadow = true
    b1.receiveShadow = true
    this.buildingGroup.add(b1)
    this.buildingBounds.push({
      minX: cx - 14,
      maxX: cx + 14,
      minZ: cz - 14,
      maxZ: cz + 14,
      minY: 0,
      maxY: b1Height,
    })

    // Window Rows for Block 1
    this.addWindowRows(cx, cz, 28.2, 28.2, 3.5, b1Height - 2, 3.8)

    // 3. Skyscraper Block 2 (Upper Tower: 18x18m, height 16m, from Y=16 to 32m)
    const b2Height = 16
    const b2Y = b1Height + b2Height / 2
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(18, b2Height, 18), this.stoneDarkMat)
    b2.position.set(cx, b2Y, cz)
    b2.castShadow = true
    b2.receiveShadow = true
    this.buildingGroup.add(b2)
    this.buildingBounds.push({
      minX: cx - 9,
      maxX: cx + 9,
      minZ: cz - 9,
      maxZ: cz + 9,
      minY: b1Height,
      maxY: b1Height + b2Height,
    })

    this.addWindowRows(cx, cz, 18.2, 18.2, b1Height + 2.5, b1Height + b2Height - 2, 3.4)

    // Corner Deco Columns on Block 2
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, b2Height + 0.8, 1.2), this.stoneMat)
        pillar.position.set(cx + sx * 8.8, b2Y, cz + sz * 8.8)
        pillar.castShadow = true
        this.buildingGroup.add(pillar)
      }
    }

    // Parapet roof border at Y=32m
    const railingMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.5 })
    const rail = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.8, 18.6), railingMat)
    rail.position.set(cx, 32.4, cz)
    this.buildingGroup.add(rail)

    // 4. Steel Antenna Mast / Spire (reaches Y=47.5m)
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.2, 11, 10), this.spireMat)
    spire.position.set(cx, 37.5, cz)
    spire.castShadow = true
    this.buildingGroup.add(spire)

    // Needle Tip
    const needleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 5, 8), this.spireMat)
    needleTip.position.set(cx, 45, cz)
    this.buildingGroup.add(needleTip)

    // Blinking Aircraft Warning Beacon Light at Top (Y=47.8m)
    this.beaconLightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), this.beaconMat)
    this.beaconLightMesh.position.set(cx, 47.8, cz)
    this.buildingGroup.add(this.beaconLightMesh)
  }

  private addWindowRows(cx: number, cz: number, widthX: number, depthZ: number, minY: number, maxY: number, stepY: number): void {
    for (let y = minY; y <= maxY; y += stepY) {
      // North & South sides
      for (const sideZ of [-1, 1]) {
        for (let col = -widthX / 2 + 3.2; col <= widthX / 2 - 3.2; col += 3.2) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), this.windowMat)
          win.position.set(cx + col, y, cz + sideZ * (depthZ / 2 + 0.05))
          if (sideZ < 0) win.rotation.y = Math.PI
          this.buildingGroup.add(win)
        }
      }
      // East & West sides
      for (const sideX of [-1, 1]) {
        for (let col = -depthZ / 2 + 3.2; col <= depthZ / 2 - 3.2; col += 3.2) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), this.windowMat)
          win.position.set(cx + sideX * (widthX / 2 + 0.05), y, cz + col)
          win.rotation.y = sideX > 0 ? Math.PI / 2 : -Math.PI / 2
          this.buildingGroup.add(win)
        }
      }
    }
  }

  private buildKingKong(): void {
    // King Kong clings on the South-East corner of Block 2 (around Y=24.5m)
    // Modeled faithfully after the uploaded pixel art image (king kong pixel.jpeg)
    const kx = this.centerX + 8.5
    const ky = 24.5
    const kz = this.centerZ + 5.5

    this.kongGroup.position.set(kx, ky, kz)
    // Rotate to face outwards towards city sky (+X / +Z angle)
    this.kongGroup.rotation.y = Math.PI * 0.28

    const registerMesh = (mesh: THREE.Mesh) => {
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.kongMeshes.push(mesh)
      return mesh
    }

    // 1. Massive Ape Torso / Chest
    const torsoGeo = new THREE.BoxGeometry(4.8, 6.2, 3.8)
    const torso = registerMesh(new THREE.Mesh(torsoGeo, this.furMat))
    torso.position.set(0, 0, 0)
    this.kongGroup.add(torso)

    // Tan Pectoral Muscles (2 muscle plates matching the pixel art)
    for (const sx of [-1.1, 1.1]) {
      const pec = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 0.4), this.faceChestMat))
      pec.position.set(sx, 0.9, 2.0)
      this.kongGroup.add(pec)
    }
    // Abdomen tan plate
    const absPlate = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.35), this.faceChestMat))
    absPlate.position.set(0, -1.2, 1.95)
    this.kongGroup.add(absPlate)

    // 2. Head Group
    this.headGroup = new THREE.Group()
    this.headGroup.position.set(0, 4.4, 0.5)

    // Fur Skull with sagittal crest
    const skull = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.2, 3.4), this.furMat))
    this.headGroup.add(skull)

    // Tan Face Plate (Face Mask)
    const face = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.2, 0.5), this.faceChestMat))
    face.position.set(0, -0.3, 1.8)
    this.headGroup.add(face)

    // Pixel Eyes
    for (const sx of [-0.75, 0.75]) {
      const eye = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.15), this.eyeMat))
      eye.position.set(sx, 0.25, 2.05)
      this.headGroup.add(eye)
    }

    // Brow Ridge
    const brow = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.55, 0.6), this.furMat))
    brow.position.set(0, 0.65, 1.85)
    this.headGroup.add(brow)

    // Big White Pixel Toothy Grin & Mouth (just like in the image!)
    const mouthBack = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.15), this.mouthMat))
    mouthBack.position.set(0, -0.65, 2.02)
    this.headGroup.add(mouthBack)

    // White Teeth Blocks
    const teethTop = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.16), this.teethMat))
    teethTop.position.set(0, -0.5, 2.05)
    this.headGroup.add(teethTop)

    const teethBottom = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.32, 0.16), this.teethMat))
    teethBottom.position.set(0, -0.85, 2.05)
    this.headGroup.add(teethBottom)

    // Gorilla Ears
    for (const sx of [-2.0, 2.0]) {
      const ear = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.7), this.faceChestMat))
      ear.position.set(sx, 0, 0.5)
      this.headGroup.add(ear)
    }

    this.kongGroup.add(this.headGroup)

    // 3. Left Arm (Clinging & Gripping the Building Spire/Wall)
    const leftArmGroup = new THREE.Group()
    leftArmGroup.position.set(-2.8, 1.8, 0)

    const lShoulder = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), this.furMat))
    leftArmGroup.add(lShoulder)

    const lArm = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(1.8, 4.2, 1.8), this.furMat))
    lArm.position.set(-1.2, -2.4, -1.0)
    lArm.rotation.x = -Math.PI / 4
    leftArmGroup.add(lArm)

    // Massive Hand clutching building
    const lHand = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 2.4), this.faceChestMat))
    lHand.position.set(-2.4, -4.2, -2.4)
    leftArmGroup.add(lHand)
    this.kongGroup.add(leftArmGroup)

    // 4. Right Arm Group (Animated Swatting Arm!)
    this.rightArmGroup = new THREE.Group()
    this.rightArmGroup.position.set(2.8, 1.8, 0)

    const rShoulder = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), this.furMat))
    this.rightArmGroup.add(rShoulder)

    const rUpperArm = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.8, 1.8), this.furMat))
    rUpperArm.position.set(1.4, 1.5, 0.6)
    rUpperArm.rotation.z = -Math.PI / 6
    this.rightArmGroup.add(rUpperArm)

    // Giant Flexed Forearm
    const rForeArm = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.6, 2.0), this.furMat))
    rForeArm.position.set(2.8, 3.8, 1.4)
    rForeArm.rotation.x = Math.PI / 5
    this.rightArmGroup.add(rForeArm)

    // Clenched Giant Fist Raised to Swat Aircraft
    const rFist = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 2.4), this.faceChestMat))
    rFist.position.set(3.2, 5.8, 2.2)
    this.rightArmGroup.add(rFist)
    this.kongGroup.add(this.rightArmGroup)

    // 5. Powerful Crouched Legs Gripping Building Facade
    // Left Leg
    const leftLeg = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.2, 3.0), this.furMat))
    leftLeg.position.set(-1.8, -4.2, -0.8)
    leftLeg.rotation.x = -Math.PI / 6
    this.kongGroup.add(leftLeg)

    const leftFoot = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 3.2), this.faceChestMat))
    leftFoot.position.set(-2.0, -6.0, -1.8)
    this.kongGroup.add(leftFoot)

    // Right Leg
    const rightLeg = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.4, 3.0), this.furMat))
    rightLeg.position.set(1.8, -4.0, -0.2)
    rightLeg.rotation.x = -Math.PI / 8
    this.kongGroup.add(rightLeg)

    const rightFoot = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 3.2), this.faceChestMat))
    rightFoot.position.set(2.0, -5.8, -1.2)
    this.kongGroup.add(rightFoot)
  }

  private updateKongHitCenter(): void {
    // World coordinates of King Kong
    this.kongHitCenter.set(this.centerX + 7.5, 58 + this.fallY, this.centerZ + 4.5)
  }

  checkHit(projPos: THREE.Vector3, projRadius: number): boolean {
    if (!this.alive && !this.falling) return false
    this.updateKongHitCenter()
    const dist = projPos.distanceTo(this.kongHitCenter)
    return dist <= this.kongHitRadius + projRadius
  }

  registerHit(): KingKongHitResult {
    if (!this.alive) {
      return { hit: false, remainingHp: 0, defeated: true, position: this.kongHitCenter.clone() }
    }

    this.hp = Math.max(0, this.hp - 1)
    this.hitFlashTimer = 0.14
    this.shakeTimer = 0.22

    const defeated = this.hp === 0
    if (defeated) {
      this.alive = false
      this.falling = true
      this.fallVelocity = 0
    }

    return {
      hit: true,
      remainingHp: this.hp,
      defeated,
      position: this.kongHitCenter.clone(),
    }
  }

  update(dt: number, planePosition: THREE.Vector3 | null): void {
    this.kongAnimTimer += dt

    // 1. Spire Beacon Light Blinking (aviation beacon at Y=112m)
    if (this.beaconLightMesh) {
      const beaconOn = Math.floor(this.kongAnimTimer * 2.8) % 2 === 0
      this.beaconLightMesh.visible = beaconOn
    }

    // 2. King Kong Hit Flash Effect (Mesh turns bright red/white momentarily)
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt)
      const flashActive = this.hitFlashTimer > 0
      for (const m of this.kongMeshes) {
        if (flashActive) {
          m.material = this.hitFlashMat
        } else {
          // Restore original materials
          m.material = m.geometry.type.includes('Box') && m.scale.x > 2 ? this.furMat : this.furMat
        }
      }
      if (!flashActive) {
        // Full material reset
        this.resetKongMaterials()
      }
    }

    // 3. Falling / Defeat Physics Animation
    if (this.falling) {
      this.fallVelocity += 38 * dt
      this.fallY -= this.fallVelocity * dt
      this.fallRotX += 1.8 * dt
      this.fallRotZ += 1.2 * dt

      this.kongGroup.position.y = 58 + this.fallY
      this.kongGroup.position.x += 4.5 * dt // moves slightly away from building as he plummets
      this.kongGroup.rotation.x = this.fallRotX
      this.kongGroup.rotation.z = this.fallRotZ

      // Hit Ground!
      if (this.kongGroup.position.y <= 1.2) {
        this.kongGroup.position.y = 1.2
        this.falling = false
      }
      this.updateKongHitCenter()
      return
    }

    // 4. Idle Swatting & Breathing Animation while on building
    if (this.alive) {
      // Breathing & Chest expansion
      const breath = Math.sin(this.kongAnimTimer * 2.2) * 0.04
      this.headGroup.position.y = 4.4 + breath * 0.8

      // Swatting Right Arm (swings arm aggressively when plane is nearby!)
      let swatSpeed = 3.5
      let swatAmplitude = 0.45
      if (planePosition) {
        const dist = planePosition.distanceTo(this.kongHitCenter)
        if (dist < 100) {
          swatSpeed = 6.8
          swatAmplitude = 0.85
        }
      }
      this.rightArmGroup.rotation.x = Math.sin(this.kongAnimTimer * swatSpeed) * swatAmplitude
      this.rightArmGroup.rotation.z = Math.cos(this.kongAnimTimer * swatSpeed * 0.8) * 0.35

      // Shake animation on hit
      if (this.shakeTimer > 0) {
        this.shakeTimer = Math.max(0, this.shakeTimer - dt)
        this.kongGroup.position.x = this.centerX + 7.5 + (Math.random() - 0.5) * 0.7
        this.kongGroup.position.z = this.centerZ + 4.5 + (Math.random() - 0.5) * 0.7
      } else {
        this.kongGroup.position.x = this.centerX + 7.5
        this.kongGroup.position.z = this.centerZ + 4.5
      }
    }

    this.updateKongHitCenter()
  }

  private resetKongMaterials(): void {
    // Restore proper materials to meshes
    for (const m of this.kongMeshes) {
      if (m.material === this.hitFlashMat) {
        m.material = this.furMat
      }
    }
  }

  dispose(): void {
    this.clearGroup(this.buildingGroup)
    this.clearGroup(this.kongGroup)
    this.scene.remove(this.root)
  }
}
