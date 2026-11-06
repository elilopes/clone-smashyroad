import * as THREE from 'three'
import type { Sound } from './Sound'
import type { Sparks } from './Sparks'
import type { StickPerson } from './StickPerson'

export type ArenaWeaponType = 'revolver' | 'shotgun' | 'smg' | 'plasma_rifle'

export interface UpgradeCard {
  id: string
  title: string
  type: 'weapon' | 'booster'
  icon: string
  tag: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  description: string
  badgeColor: string
}

export interface ZombieEnemy {
  group: THREE.Group
  type: 'zombie' | 'runner' | 'brute' | 'spitter'
  hp: number
  maxHp: number
  speed: number
  damage: number
  attackCooldown: number
  walkPhase: number
  isDead: boolean
  deathTimer: number
  armL?: THREE.Mesh
  armR?: THREE.Mesh
  head?: THREE.Mesh
  bodyMesh?: THREE.Mesh
  originalColors: Map<THREE.Mesh, THREE.Color>
  hitFlashTimer: number
}

export interface ArenaBullet {
  mesh: THREE.Mesh
  position: THREE.Vector3
  velocity: THREE.Vector3
  damage: number
  radius: number
  isPlasma: boolean
  isLightning?: boolean
  life: number
  maxLife: number
}

export interface LightningVisual {
  group: THREE.Group
  timer: number
  duration: number
}

export interface FloatingText {
  element: HTMLElement
  x: number
  y: number
  z: number
  life: number
  maxLife: number
}

export class ZombieArena {
  private readonly scene: THREE.Scene
  private readonly sound: Sound
  private readonly sparks: Sparks
  readonly root = new THREE.Group()

  readonly arenaBounds = {
    centerX: -1100,
    centerZ: 0,
    width: 68,
    depth: 68,
    minX: -1100 - 32.5,
    maxX: -1100 + 32.5,
    minZ: 0 - 32.5,
    maxZ: 0 + 32.5,
    entranceX: -1100,
    entranceZ: 0 + 33.6,
    northEntranceX: -1100,
    northEntranceZ: 0 - 33.6,
    eastEntranceX: -1100 + 33.6,
    eastEntranceZ: 0,
    westEntranceX: -1100 - 33.6,
    westEntranceZ: 0,
  }

  // State
  active = false
  isPausedForCards = false
  currentWave = 1
  totalWaves = 4
  waveTimer = 0
  missionElapsedTime = 0
  kills = 0
  killsThisLevel = 0
  killsNeededForLevel = 5
  level = 1
  playerHp = 100
  playerMaxHp = 100
  playerLives = 3
  maxLives = 3
  playerInvulnerableTimer = 0

  // Weapons & Boosters
  currentWeapon: ArenaWeaponType = 'revolver'
  fireCooldown = 0
  fireRateMultiplier = 1.0
  speedBonus = 0.0
  detectionRadius = 10.5
  hasLightningAfter3Shots = false
  shotCounter = 0
  hasVShot = false
  hasShield = false
  shieldTimer = 0
  shieldAngle = 0

  // Enemies & Combat
  readonly enemies: ZombieEnemy[] = []
  readonly bullets: ArenaBullet[] = []
  readonly lightnings: LightningVisual[] = []
  private spawnCooldown = 0
  private enemiesRemainingToSpawn = 0

  // Visuals
  private readonly detectionRing: THREE.Mesh
  private readonly detectionRingMat: THREE.MeshBasicMaterial
  private readonly orbitalShieldGroup = new THREE.Group()
  private readonly shieldBlades: THREE.Mesh[] = []

  // Shared Geometries & Materials
  private readonly bulletGeo = new THREE.SphereGeometry(0.16, 8, 8)
  private readonly bulletMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  private readonly plasmaGeo = new THREE.SphereGeometry(0.35, 12, 12)
  private readonly plasmaMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 })
  private readonly vBulletMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e })

  // Callbacks
  onLevelUp?: (cards: UpgradeCard[], level: number) => void
  onWaveChanged?: (wave: number, totalWaves: number) => void
  onHpChanged?: (hp: number, maxHp: number) => void
  onLivesChanged?: (lives: number, maxLives: number) => void
  onXpChanged?: (current: number, needed: number, level: number) => void
  onWeaponChanged?: (weaponName: string, icon: string, weapon: ArenaWeaponType) => void
  onKillsChanged?: (kills: number) => void
  onGameOver?: (survivedWaves: number, kills: number) => void
  onVictory?: (kills: number, waves: number) => void
  onToast?: (msg: string) => void

  private getWeaponDisplay(w: ArenaWeaponType): { name: string; icon: string } {
    switch (w) {
      case 'shotgun': return { name: 'Escopeta de Combate', icon: '💥' }
      case 'smg': return { name: 'Submetralhadora Uzi', icon: '⚡' }
      case 'plasma_rifle': return { name: 'Rifle de Plasma', icon: '🌌' }
      case 'revolver':
      default:
        return { name: 'Revólver Simples', icon: '🔫' }
    }
  }

  constructor(scene: THREE.Scene, sound: Sound, sparks: Sparks) {
    this.scene = scene
    this.sound = sound
    this.sparks = sparks

    // Action Circle (Círculo de Ação auto-aim ao redor do personagem palito)
    const ringGeo = new THREE.RingGeometry(this.detectionRadius - 0.22, this.detectionRadius, 64)
    this.detectionRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    })
    this.detectionRing = new THREE.Mesh(ringGeo, this.detectionRingMat)
    this.detectionRing.rotation.x = -Math.PI / 2
    this.detectionRing.position.y = 0.05
    this.detectionRing.visible = false
    this.root.add(this.detectionRing)

    // Orbital Energy Shield (Círculo protetor temporário)
    this.buildOrbitalShieldVisuals()
    this.root.add(this.orbitalShieldGroup)
    this.orbitalShieldGroup.visible = false

    this.scene.add(this.root)
  }

  private buildOrbitalShieldVisuals(): void {
    const shieldBladeGeo = new THREE.BoxGeometry(0.65, 0.45, 0.12)
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.5,
      roughness: 0.2,
      metalness: 0.8,
    })

    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(shieldBladeGeo, shieldMat)
      blade.castShadow = true
      this.orbitalShieldGroup.add(blade)
      this.shieldBlades.push(blade)
    }
  }

  startMission(playerXOrStickPerson: number | StickPerson, _centerZ?: number, stickPersonParam?: StickPerson): void {
    const stickPerson = (typeof playerXOrStickPerson === 'object' ? playerXOrStickPerson : stickPersonParam) as StickPerson
    this.active = true
    this.isPausedForCards = false
    this.currentWave = 1
    this.waveTimer = 0
    this.missionElapsedTime = 0
    this.kills = 0
    this.killsThisLevel = 0
    this.killsNeededForLevel = 5
    this.level = 1
    this.playerLives = 3
    this.maxLives = 3
    this.playerInvulnerableTimer = 0
    this.playerHp = 100
    this.playerMaxHp = 100

    // Reset equipment to simple revolver
    this.currentWeapon = 'revolver'
    this.fireRateMultiplier = 1.0
    this.speedBonus = 0.0
    this.detectionRadius = 10.5
    this.hasLightningAfter3Shots = false
    this.shotCounter = 0
    this.hasVShot = false
    this.hasShield = false
    this.shieldTimer = 0

    this.clearEnemies()
    this.clearBullets()

    // Position Stick Person inside the arena
    if (stickPerson) {
      stickPerson.root.visible = true
      stickPerson.setPosition(this.arenaBounds.centerX, this.arenaBounds.centerZ, 0)
      stickPerson.speedMultiplier = 1.0 + this.speedBonus
    }

    this.detectionRing.visible = true
    this.detectionRing.position.set(this.arenaBounds.centerX, 0.05, this.arenaBounds.centerZ)
    this.updateDetectionRingGeometry()

    this.startWave(1)

    this.onLivesChanged?.(this.playerLives, this.maxLives)
    this.onHpChanged?.(this.playerHp, this.playerMaxHp)
    this.onXpChanged?.(this.killsThisLevel, this.killsNeededForLevel, this.level)
    const disp = this.getWeaponDisplay(this.currentWeapon)
    this.onWeaponChanged?.(disp.name, disp.icon, this.currentWeapon)
    this.onWaveChanged?.(this.currentWave, this.totalWaves)
    this.onKillsChanged?.(this.kills)
    this.sound.effect('mission')
    this.onToast?.('☣️ MISSÃO SOBREVIVÊNCIA ZUMBI INICIADA! 3 VIDAS DISPONÍVEIS!')
  }

  stopMission(stickPerson?: StickPerson): void {
    if (stickPerson) {
      stickPerson.speedMultiplier = 1.0
      stickPerson.root.visible = true
    }
    this.active = false
    this.isPausedForCards = false
    this.detectionRing.visible = false
    this.orbitalShieldGroup.visible = false
    this.clearEnemies()
    this.clearBullets()
  }

  private startWave(wave: number): void {
    this.currentWave = wave
    this.waveTimer = 0
    if (wave >= this.totalWaves) {
      // Onda 4: Onda final de monstros gigantes
      this.enemiesRemainingToSpawn = 22
      this.spawnCooldown = 0.5
      this.sound.effect('roar')
      this.onWaveChanged?.(this.currentWave, this.totalWaves)
      this.onToast?.(`☠️ ONDA 4 FINAL: HORDAS DE MONSTROS GIGANTES SE APROXIMAM!`)
    } else {
      this.enemiesRemainingToSpawn = 10 + wave * 5 + Math.floor(this.missionElapsedTime / 10)
      this.spawnCooldown = 0.4
      this.sound.effect('roar')
      this.onWaveChanged?.(this.currentWave, this.totalWaves)
      this.onToast?.(`⚠️ ONDA ${this.currentWave}/${this.totalWaves} APROXIMANDO-SE! DEFENDA A ÁREA!`)
    }
  }

  private updateDetectionRingGeometry(): void {
    this.detectionRing.geometry.dispose()
    this.detectionRing.geometry = new THREE.RingGeometry(this.detectionRadius - 0.22, this.detectionRadius, 64)
  }

  update(dt: number, playerPos: THREE.Vector3, stickPerson: StickPerson): void {
    if (!this.active) return

    this.missionElapsedTime += dt

    // Feedback visual de invulnerabilidade temporária (pisca suavemente)
    if (this.playerInvulnerableTimer > 0) {
      this.playerInvulnerableTimer -= dt
      stickPerson.root.visible = Math.floor(this.playerInvulnerableTimer * 12) % 2 === 0
    } else {
      stickPerson.root.visible = true
    }

    // Position detection ring around stick person
    this.detectionRing.position.set(playerPos.x, 0.05, playerPos.z)

    // Constrain stick person within enlarged arena walls during mission
    const halfW = this.arenaBounds.width / 2 - 1.4
    const halfD = this.arenaBounds.depth / 2 - 1.4
    stickPerson.root.position.x = THREE.MathUtils.clamp(
      stickPerson.root.position.x,
      this.arenaBounds.centerX - halfW,
      this.arenaBounds.centerX + halfW,
    )
    stickPerson.root.position.z = THREE.MathUtils.clamp(
      stickPerson.root.position.z,
      this.arenaBounds.centerZ - halfD,
      this.arenaBounds.centerZ + halfD,
    )
    stickPerson.speedMultiplier = 1.0 + this.speedBonus

    // If game paused for card selection, do not update combat
    if (this.isPausedForCards) return

    // 1. Spawning enemies with progressive multi-spawn batch size over time
    // A quantidade de zumbis e monstros surgindo simultaneamente aumenta gradativamente!
    const timeBatch = Math.min(6, 1 + Math.floor(this.missionElapsedTime / 20) + Math.floor((this.currentWave - 1) / 2))
    const maxAliveCap = Math.min(48, 10 + Math.floor(this.missionElapsedTime / 7) + this.currentWave * 3)
    const aliveCount = this.enemies.filter((e) => !e.isDead).length

    if (this.enemiesRemainingToSpawn > 0 && aliveCount < maxAliveCap) {
      this.spawnCooldown -= dt
      if (this.spawnCooldown <= 0) {
        const toSpawn = Math.min(timeBatch, this.enemiesRemainingToSpawn, maxAliveCap - aliveCount)
        for (let s = 0; s < toSpawn; s++) {
          this.spawnEnemyForWave(this.currentWave)
          this.enemiesRemainingToSpawn--
        }
        this.spawnCooldown = Math.max(0.38, 1.7 - (this.missionElapsedTime * 0.007) - (this.currentWave * 0.07))
      }
    } else if (this.enemiesRemainingToSpawn <= 0 && aliveCount === 0) {
      // Wave completed!
      if (this.currentWave >= this.totalWaves) {
        this.handleVictory()
        return
      }
      this.waveTimer += dt
      if (this.waveTimer >= 2.5) {
        this.startWave(this.currentWave + 1)
      }
    }

    // 2. Orbital Shield Logic (Círculo protetor temporário)
    if (this.hasShield) {
      this.shieldTimer -= dt
      if (this.shieldTimer <= 0) {
        this.hasShield = false
        this.orbitalShieldGroup.visible = false
        this.onToast?.('🛡️ ESCUDO PROTETOR DESATIVADO')
      } else {
        this.orbitalShieldGroup.visible = true
        this.orbitalShieldGroup.position.set(playerPos.x, playerPos.y + 1.1, playerPos.z)
        this.shieldAngle += dt * 4.5
        const shieldRadius = 2.4

        for (let i = 0; i < this.shieldBlades.length; i++) {
          const angle = this.shieldAngle + (i / this.shieldBlades.length) * Math.PI * 2
          const bx = Math.cos(angle) * shieldRadius
          const bz = Math.sin(angle) * shieldRadius
          this.shieldBlades[i].position.set(bx, Math.sin(this.shieldAngle * 2 + i) * 0.25, bz)
          this.shieldBlades[i].rotation.y = -angle + Math.PI / 2
        }

        // Shield impact against nearby enemies
        for (const enemy of this.enemies) {
          if (enemy.isDead) continue
          const distToPlayer = Math.hypot(enemy.group.position.x - playerPos.x, enemy.group.position.z - playerPos.z)
          if (distToPlayer <= shieldRadius + 0.9) {
            this.damageEnemy(enemy, 55 * dt * 2.5, true)
            // Knockback
            const kx = (enemy.group.position.x - playerPos.x) / (distToPlayer || 1)
            const kz = (enemy.group.position.z - playerPos.z) / (distToPlayer || 1)
            enemy.group.position.x += kx * 4.0 * dt
            enemy.group.position.z += kz * 4.0 * dt
            this.sparks.emit(enemy.group.position)
          }
        }
      }
    }

    // 3. Directional Auto-Fire
    // O personagem palito atira automaticamente quando estiver na direção de um monstro,
    // sem o jogo mudar forçadamente a direção do palito!
    const facingX = -Math.sin(stickPerson.yaw)
    const facingZ = -Math.cos(stickPerson.yaw)

    const enemiesInFrontInCircle: { enemy: ZombieEnemy; dist: number; dot: number }[] = []
    let anyEnemyInCircle = false

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue
      const dist = Math.hypot(enemy.group.position.x - playerPos.x, enemy.group.position.z - playerPos.z)
      if (dist <= this.detectionRadius) {
        anyEnemyInCircle = true
        const toX = (enemy.group.position.x - playerPos.x) / (dist || 1)
        const toZ = (enemy.group.position.z - playerPos.z) / (dist || 1)
        const dot = facingX * toX + facingZ * toZ
        // Inimigo no cone frontal do palito (~90° de visão frontal, dot >= 0.38)
        if (dot >= 0.38) {
          enemiesInFrontInCircle.push({ enemy, dist, dot })
        }
      }
    }

    if (enemiesInFrontInCircle.length > 0) {
      // Inimigo alinhado na mira dentro do círculo: anel acende em vermelho e atira
      this.detectionRingMat.color.setHex(0xff3333)
      this.detectionRingMat.opacity = 0.9

      // Prioriza pelo mais próximo na mira frontal
      enemiesInFrontInCircle.sort((a, b) => a.dist - b.dist)
      const target = enemiesInFrontInCircle[0].enemy

      // Disparo automático na direção em que o jogador está apontando
      this.fireCooldown -= dt
      if (this.fireCooldown <= 0) {
        this.fireCurrentWeapon(playerPos, target)
      }
    } else {
      if (anyEnemyInCircle) {
        // Inimigos dentro do círculo mas ainda não na mira do palito: anel amarelo de alerta
        this.detectionRingMat.color.setHex(0xfacc15)
        this.detectionRingMat.opacity = 0.65
      } else {
        // Sem monstros por perto: anel ciano suave
        this.detectionRingMat.color.setHex(0x00f0ff)
        this.detectionRingMat.opacity = 0.5
      }
      this.fireCooldown = Math.max(0, this.fireCooldown - dt)
    }

    // 4. Update Bullets & Projectiles
    this.updateBullets(dt)

    // 5. Update Lightning Visuals
    this.updateLightnings(dt)

    // 6. Update Enemies (AI, walk towards player, attack)
    this.updateEnemies(dt, playerPos)
  }

  private fireCurrentWeapon(playerPos: THREE.Vector3, target: ZombieEnemy): void {
    const targetPos = target.group.position
    const muzzlePos = new THREE.Vector3(playerPos.x, playerPos.y + 1.25, playerPos.z)
    const aimDir = new THREE.Vector3(targetPos.x - playerPos.x, 0, targetPos.z - playerPos.z).normalize()

    this.shotCounter++
    const is3rdShotLightning = this.hasLightningAfter3Shots && this.shotCounter % 3 === 0

    if (this.currentWeapon === 'revolver') {
      // Revólver: Tiro preciso e potente
      this.fireCooldown = 0.44 / this.fireRateMultiplier
      this.spawnBullet(muzzlePos, aimDir, 35, false)
      this.sound.effect('shoot')
      if (this.hasVShot) {
        this.spawnVBullets(muzzlePos, aimDir, 28, false)
      }
    } else if (this.currentWeapon === 'shotgun') {
      // Escopeta: 5 projéteis em leque de alto impacto
      this.fireCooldown = 0.78 / this.fireRateMultiplier
      const baseAngle = Math.atan2(aimDir.x, aimDir.z)
      for (const spread of [-0.28, -0.14, 0, 0.14, 0.28]) {
        const spreadDir = new THREE.Vector3(Math.sin(baseAngle + spread), 0, Math.cos(baseAngle + spread))
        this.spawnBullet(muzzlePos, spreadDir, 24, false)
      }
      this.sound.effect('explosion')
      if (this.hasVShot) {
        this.spawnVBullets(muzzlePos, aimDir, 24, false)
      }
    } else if (this.currentWeapon === 'smg') {
      // UZI Submetralhadora: Disparos ultra rápidos
      this.fireCooldown = 0.12 / this.fireRateMultiplier
      const spread = (Math.random() - 0.5) * 0.14
      const baseAngle = Math.atan2(aimDir.x, aimDir.z)
      const spreadDir = new THREE.Vector3(Math.sin(baseAngle + spread), 0, Math.cos(baseAngle + spread))
      this.spawnBullet(muzzlePos, spreadDir, 18, false)
      this.sound.effect('shoot')
      if (this.hasVShot && this.shotCounter % 2 === 0) {
        this.spawnVBullets(muzzlePos, aimDir, 16, false)
      }
    } else if (this.currentWeapon === 'plasma_rifle') {
      // Rifle de Plasma: Esferas de energia explosivas
      this.fireCooldown = 0.52 / this.fireRateMultiplier
      this.spawnBullet(muzzlePos, aimDir, 75, true)
      this.sound.effect('laser')
      if (this.hasVShot) {
        this.spawnVBullets(muzzlePos, aimDir, 60, true)
      }
    }

    // "raio que cai no zumbi ou monstros após o personagem palito efetuar 3 tiros"
    if (is3rdShotLightning) {
      this.triggerLightningStrike(target)
    }
  }

  private spawnVBullets(muzzlePos: THREE.Vector3, baseDir: THREE.Vector3, damage: number, isPlasma: boolean): void {
    const baseAngle = Math.atan2(baseDir.x, baseDir.z)
    const angleV = 0.28 // Ângulo angular do V
    const dirLeft = new THREE.Vector3(Math.sin(baseAngle - angleV), 0, Math.cos(baseAngle - angleV))
    const dirRight = new THREE.Vector3(Math.sin(baseAngle + angleV), 0, Math.cos(baseAngle + angleV))
    this.spawnBullet(muzzlePos, dirLeft, damage, isPlasma)
    this.spawnBullet(muzzlePos, dirRight, damage, isPlasma)
  }

  private spawnBullet(startPos: THREE.Vector3, dir: THREE.Vector3, damage: number, isPlasma: boolean): void {
    const bulletMesh = new THREE.Mesh(isPlasma ? this.plasmaGeo : this.bulletGeo, isPlasma ? this.plasmaMat : this.bulletMat)
    bulletMesh.position.copy(startPos)
    this.root.add(bulletMesh)

    const speed = isPlasma ? 34.0 : 48.0
    this.bullets.push({
      mesh: bulletMesh,
      position: bulletMesh.position,
      velocity: dir.clone().multiplyScalar(speed),
      damage,
      radius: isPlasma ? 0.85 : 0.45,
      isPlasma,
      life: 0,
      maxLife: 1.2,
    })
  }

  private triggerLightningStrike(targetEnemy: ZombieEnemy): void {
    const targetPos = targetEnemy.group.position.clone()
    const group = new THREE.Group()

    // Raio elétrico vertical caindo do céu diretamente em cima do monstro (sem andar pelo cenário)
    const coreGeo = new THREE.CylinderGeometry(0.2, 0.45, 34, 8)
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
    const beam = new THREE.Mesh(coreGeo, coreMat)
    beam.position.set(targetPos.x, 17, targetPos.z)
    group.add(beam)

    for (let r = 0; r < 3; r++) {
      const branchGeo = new THREE.CylinderGeometry(0.08, 0.12, 10, 6)
      const branchMat = new THREE.MeshBasicMaterial({ color: 0xa5f3fc })
      const branch = new THREE.Mesh(branchGeo, branchMat)
      branch.position.set(targetPos.x + (Math.random() - 0.5) * 1.2, 5 + r * 6, targetPos.z + (Math.random() - 0.5) * 1.2)
      group.add(branch)
    }

    this.root.add(group)
    this.lightnings.push({ group, timer: 0, duration: 0.22 })

    // Efeitos sonoros e faíscas
    this.sound.effect('laser')
    this.sound.effect('explosion')
    this.sparks.emit(targetPos)

    // O raio cai em cima do zumbi ou monstro e desaparece junto com o zumbi ou monstro atingido!
    this.damageEnemy(targetEnemy, 9999, true)

    // Danifica monstros imediatamente adjacentes em um raio curto
    for (const enemy of this.enemies) {
      if (enemy === targetEnemy || enemy.isDead) continue
      const dist = Math.hypot(enemy.group.position.x - targetPos.x, enemy.group.position.z - targetPos.z)
      if (dist <= 3.2) {
        this.damageEnemy(enemy, 150, true)
      }
    }

    this.onToast?.('⚡ RAIO FULMINANTE DESTRUIU O MONSTRO!')
  }

  private updateLightnings(dt: number): void {
    for (let i = this.lightnings.length - 1; i >= 0; i--) {
      const l = this.lightnings[i]
      l.timer += dt
      // O raio NÃO anda pelo cenário nem cresce; fica perfeitamente imóvel e desaparece
      if (l.timer >= l.duration) {
        this.root.remove(l.group)
        l.group.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            c.geometry.dispose()
          }
        })
        this.lightnings.splice(i, 1)
      }
    }
  }

  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      b.life += dt
      b.position.x += b.velocity.x * dt
      b.position.z += b.velocity.z * dt

      let hitEnemy: ZombieEnemy | null = null
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue
        const dist = Math.hypot(enemy.group.position.x - b.position.x, enemy.group.position.z - b.position.z)
        const hitRadius = enemy.type === 'brute' ? 1.6 : 0.8
        if (dist <= b.radius + hitRadius) {
          hitEnemy = enemy
          break
        }
      }

      if (hitEnemy) {
        if (b.isPlasma) {
          // Explosão de plasma em área (3.2m)
          this.sound.effect('explosion')
          this.sparks.emit(b.position)
          for (const e of this.enemies) {
            if (e.isDead) continue
            const pDist = Math.hypot(e.group.position.x - b.position.x, e.group.position.z - b.position.z)
            if (pDist <= 3.2) {
              this.damageEnemy(e, b.damage, true)
            }
          }
        } else {
          this.damageEnemy(hitEnemy, b.damage)
        }

        this.root.remove(b.mesh)
        this.bullets.splice(i, 1)
        continue
      }

      if (b.life >= b.maxLife) {
        this.root.remove(b.mesh)
        this.bullets.splice(i, 1)
      }
    }
  }

  private damageEnemy(enemy: ZombieEnemy, dmg: number, isCritical = false): void {
    if (enemy.isDead) return
    enemy.hp -= dmg
    enemy.hitFlashTimer = 0.12

    // Flash de dano
    enemy.group.traverse((c) => {
      if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshStandardMaterial) {
        c.material.color.setHex(isCritical ? 0x38bdf8 : 0xffffff)
      }
    })

    if (enemy.hp <= 0) {
      enemy.isDead = true
      this.kills++
      this.killsThisLevel++
      this.sparks.emit(enemy.group.position)

      this.onKillsChanged?.(this.kills)
      this.onXpChanged?.(this.killsThisLevel, this.killsNeededForLevel, this.level)

      // Checa Level-Up para os 3 Cards de Escolha
      if (this.killsThisLevel >= this.killsNeededForLevel) {
        this.killsThisLevel = 0
        this.killsNeededForLevel = Math.floor(this.killsNeededForLevel * 1.45)
        this.level++
        this.triggerCardSelection()
      }
    }
  }

  private updateEnemies(dt: number, playerPos: THREE.Vector3): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]

      // Restaura cor original após flash de dano
      if (enemy.hitFlashTimer > 0) {
        enemy.hitFlashTimer -= dt
        if (enemy.hitFlashTimer <= 0) {
          enemy.group.traverse((c) => {
            if (c instanceof THREE.Mesh && enemy.originalColors.has(c) && c.material instanceof THREE.MeshStandardMaterial) {
              c.material.color.copy(enemy.originalColors.get(c)!)
            }
          })
        }
      }

      // Inimigo morto: animação de queda e remoção
      if (enemy.isDead) {
        enemy.deathTimer += dt
        enemy.group.position.y = Math.max(0, 0.4 - enemy.deathTimer * 0.8)
        enemy.group.rotation.x = Math.min(Math.PI / 2, enemy.deathTimer * 4.2)
        if (enemy.deathTimer >= 1.2) {
          this.root.remove(enemy.group)
          this.enemies.splice(i, 1)
        }
        continue
      }

      // Caminhada em direção ao jogador
      const dx = playerPos.x - enemy.group.position.x
      const dz = playerPos.z - enemy.group.position.z
      const dist = Math.hypot(dx, dz)

      const targetAngle = Math.atan2(dx, dz)
      enemy.group.rotation.y = targetAngle

      enemy.walkPhase += dt * enemy.speed * 2.2
      if (enemy.armL) enemy.armL.rotation.x = Math.PI / 2 + Math.sin(enemy.walkPhase) * 0.35
      if (enemy.armR) enemy.armR.rotation.x = Math.PI / 2 - Math.sin(enemy.walkPhase) * 0.35

      const attackDist = enemy.type === 'brute' ? 1.7 : 0.95
      if (dist > attackDist) {
        const step = enemy.speed * dt
        enemy.group.position.x += (dx / (dist || 1)) * step
        enemy.group.position.z += (dz / (dist || 1)) * step
      } else {
        // Colisão dos zumbis e monstros com o personagem palito (até 3 colisões na missão)
        if (this.playerInvulnerableTimer <= 0) {
          this.playerInvulnerableTimer = 1.3 // 1.3s de imunidade com piscamento
          this.playerLives = Math.max(0, this.playerLives - 1)
          this.playerHp = Math.round((this.playerLives / this.maxLives) * 100)
          this.sound.effect('crash')
          this.sparks.emit(playerPos)
          this.onLivesChanged?.(this.playerLives, this.maxLives)
          this.onHpChanged?.(this.playerHp, this.playerMaxHp)
          this.onToast?.(`💔 COLISÃO COM CRIATURA! Vidas restantes: ${'❤️'.repeat(this.playerLives)}${'🖤'.repeat(this.maxLives - this.playerLives)}`)

          if (this.playerLives <= 0) {
            this.handlePlayerDefeated()
            return
          }
        }
      }
    }
  }

  private handlePlayerDefeated(): void {
    this.active = false
    this.sound.effect('explosion')
    this.onToast?.('💀 MISSÃO FRACASSADA! 3 COLISÕES SOFRIDAS NA ARENA!')
    this.onGameOver?.(this.currentWave, this.kills)
  }

  private handleVictory(): void {
    this.active = false
    this.sound.effect('upgrade')
    this.onToast?.('🏆 VITÓRIA ÉPICA! ONDA 4 CONCLUÍDA COM SUCESSO!')
    this.onVictory?.(this.kills, this.currentWave)
  }

  private triggerCardSelection(): void {
    this.isPausedForCards = true
    this.sound.effect('upgrade')

    const cards = this.generateUpgradeCards()
    this.onLevelUp?.(cards, this.level)
  }

  private generateUpgradeCards(): UpgradeCard[] {
    const cardPool: UpgradeCard[] = []

    // 1. Armas Melhores
    if (this.currentWeapon !== 'shotgun') {
      cardPool.push({
        id: 'weapon_shotgun',
        title: 'ESCOPETA DE COMBATE',
        type: 'weapon',
        icon: '💥',
        tag: 'NOVA ARMA',
        rarity: 'rare',
        description: 'Dispara 5 balotes pesados em cone largo com alto poder de derrubada.',
        badgeColor: '#3b82f6',
      })
    }
    if (this.currentWeapon !== 'smg') {
      cardPool.push({
        id: 'weapon_smg',
        title: 'SUBMETRALHADORA UZI',
        type: 'weapon',
        icon: '⚡',
        tag: 'NOVA ARMA',
        rarity: 'epic',
        description: 'Disparos contínuos em rajadas ultra-rápidas para dizimar hordas densas.',
        badgeColor: '#8b5cf6',
      })
    }
    if (this.currentWeapon !== 'plasma_rifle') {
      cardPool.push({
        id: 'weapon_plasma',
        title: 'RIFLE DE PLASMA',
        type: 'weapon',
        icon: '🌌',
        tag: 'ARMA LENDÁRIA',
        rarity: 'legendary',
        description: 'Esferas de antimatéria que detonam ao contato, eliminando inimigos em área.',
        badgeColor: '#f59e0b',
      })
    }

    // 2. Boosters solicitados pelo usuário
    cardPool.push({
      id: 'booster_fire_rate',
      title: 'CADÊNCIA INSANA',
      type: 'booster',
      icon: '🔥',
      tag: 'BOOSTER DE TIRO',
      rarity: 'common',
      description: '+35% de velocidade de disparo para qualquer arma equipada.',
      badgeColor: '#10b981',
    })

    cardPool.push({
      id: 'booster_move_speed',
      title: 'PASSOS ÁGEIS',
      type: 'booster',
      icon: '🏃',
      tag: 'MOBILIDADE',
      rarity: 'common',
      description: '+25% de velocidade de movimento para o personagem palito esquivar melhor.',
      badgeColor: '#10b981',
    })

    cardPool.push({
      id: 'booster_shield',
      title: 'CÍRCULO PROTETOR',
      type: 'booster',
      icon: '🛡️',
      tag: 'ESCUDO ORBITAL',
      rarity: 'rare',
      description: 'Lâminas de energia orbitam o palito por 25s, causando dano e repelindo zumbis.',
      badgeColor: '#3b82f6',
    })

    if (!this.hasLightningAfter3Shots) {
      cardPool.push({
        id: 'booster_lightning',
        title: 'TROVÃO FULMINANTE',
        type: 'booster',
        icon: '⚡',
        tag: 'HABILIDADE ESPECIAL',
        rarity: 'epic',
        description: 'A cada 3 tiros disparados, um raio cai do céu no monstro causando dano em área.',
        badgeColor: '#8b5cf6',
      })
    }

    if (!this.hasVShot) {
      cardPool.push({
        id: 'booster_v_shot',
        title: 'TIRO DUPLO EM V',
        type: 'booster',
        icon: '✌️',
        tag: 'EXPANSÃO DE TIRO',
        rarity: 'rare',
        description: 'Dispara dois projéteis adicionais em formato V angular dobrando a área atingida.',
        badgeColor: '#3b82f6',
      })
    }

    cardPool.push({
      id: 'booster_radar',
      title: 'CÍRCULO EXPANDIDO',
      type: 'booster',
      icon: '🎯',
      tag: 'ALCANCE AUTO-TIRO',
      rarity: 'common',
      description: '+30% no raio de detecção do círculo de ação do palito.',
      badgeColor: '#10b981',
    })

    if (this.playerLives < this.maxLives) {
      cardPool.push({
        id: 'booster_medkit',
        title: 'CORAÇÃO EXTRA',
        type: 'booster',
        icon: '❤️',
        tag: 'RECUPERAÇÃO',
        rarity: 'common',
        description: 'Restaura +1 coração de vida para o personagem palito.',
        badgeColor: '#ef4444',
      })
    }

    // Embaralha e escolhe 3
    const shuffled = cardPool.sort(() => 0.5 - Math.random())
    return shuffled.slice(0, 3)
  }

  applyUpgrade(cardId: string, stickPerson?: StickPerson): void {
    if (cardId === 'weapon_shotgun') {
      this.currentWeapon = 'shotgun'
      const disp = this.getWeaponDisplay(this.currentWeapon)
      this.onWeaponChanged?.(disp.name, disp.icon, this.currentWeapon)
      this.onToast?.('💥 ESCOPETA DE COMBATE EQUIPADA!')
    } else if (cardId === 'weapon_smg') {
      this.currentWeapon = 'smg'
      const disp = this.getWeaponDisplay(this.currentWeapon)
      this.onWeaponChanged?.(disp.name, disp.icon, this.currentWeapon)
      this.onToast?.('⚡ SUBMETRALHADORA UZI EQUIPADA!')
    } else if (cardId === 'weapon_plasma') {
      this.currentWeapon = 'plasma_rifle'
      const disp = this.getWeaponDisplay(this.currentWeapon)
      this.onWeaponChanged?.(disp.name, disp.icon, this.currentWeapon)
      this.onToast?.('🌌 RIFLE DE PLASMA EQUIPADO!')
    } else if (cardId === 'booster_fire_rate') {
      this.fireRateMultiplier += 0.35
      this.onToast?.('🔥 CADÊNCIA DE TIRO +35%!')
    } else if (cardId === 'booster_move_speed') {
      this.speedBonus += 0.25
      if (stickPerson) {
        stickPerson.speedMultiplier = 1.0 + this.speedBonus
      }
      this.onToast?.('🏃 VELOCIDADE DO PALITO +25%!')
    } else if (cardId === 'booster_shield') {
      this.hasShield = true
      this.shieldTimer = 25.0
      this.onToast?.('🛡️ CÍRCULO PROTETOR ATIVADO POR 25 SEGUNDOS!')
    } else if (cardId === 'booster_lightning') {
      this.hasLightningAfter3Shots = true
      this.shotCounter = 0
      this.onToast?.('⚡ TROVÃO FULMINANTE ATIVADO! RAIO A CADA 3 TIROS!')
    } else if (cardId === 'booster_v_shot') {
      this.hasVShot = true
      this.onToast?.('✌️ TIRO DUPLO EM V ATIVADO!')
    } else if (cardId === 'booster_radar') {
      this.detectionRadius *= 1.3
      this.updateDetectionRingGeometry()
      this.onToast?.('🎯 CÍRCULO DE AÇÃO EXPANDIDO +30%!')
    } else if (cardId === 'booster_medkit') {
      this.playerLives = Math.min(this.maxLives, this.playerLives + 1)
      this.playerHp = Math.round((this.playerLives / this.maxLives) * 100)
      this.onLivesChanged?.(this.playerLives, this.maxLives)
      this.onHpChanged?.(this.playerHp, this.playerMaxHp)
      this.onToast?.('❤️ +1 CORAÇÃO DE VIDA RESTAURADO!')
    }

    this.isPausedForCards = false
    this.sound.effect('upgrade')
  }

  private spawnEnemyForWave(wave: number): void {
    // Escolhe ponto de surgimento nas bordas da arena ampliada de 68m x 68m
    const edge = Math.floor(Math.random() * 4)
    let sx = this.arenaBounds.centerX
    let sz = this.arenaBounds.centerZ
    const offset = 32.0
    const spread = 58.0

    if (edge === 0) {
      // Norte
      sx = this.arenaBounds.centerX + (Math.random() - 0.5) * spread
      sz = this.arenaBounds.centerZ - offset
    } else if (edge === 1) {
      // Sul
      sx = this.arenaBounds.centerX + (Math.random() - 0.5) * spread
      sz = this.arenaBounds.centerZ + offset
    } else if (edge === 2) {
      // Leste
      sx = this.arenaBounds.centerX + offset
      sz = this.arenaBounds.centerZ + (Math.random() - 0.5) * spread
    } else {
      // Oeste
      sx = this.arenaBounds.centerX - offset
      sz = this.arenaBounds.centerZ + (Math.random() - 0.5) * spread
    }

    // Variedade de inimigos por onda e tempo decorrido
    let type: 'zombie' | 'runner' | 'brute' | 'spitter' = 'zombie'
    const roll = Math.random()

    const bruteChance = wave >= 4 ? 0.38 : Math.min(0.35, (wave >= 3 ? 0.2 : 0) + (this.missionElapsedTime > 55 ? 0.15 : 0))
    const spitterChance = Math.min(0.35, (wave >= 2 ? 0.15 : 0) + (this.missionElapsedTime > 40 ? 0.15 : 0))
    const runnerChance = Math.min(0.55, 0.25 + (this.missionElapsedTime > 25 ? 0.2 : 0) + wave * 0.05)

    if (roll < bruteChance) {
      type = 'brute'
    } else if (roll < bruteChance + runnerChance) {
      type = 'runner'
    } else if (roll < bruteChance + runnerChance + spitterChance) {
      type = 'spitter'
    }

    const enemy = this.createEnemyVoxel(type, sx, sz, wave)
    this.root.add(enemy.group)
    this.enemies.push(enemy)
  }

  private createEnemyVoxel(
    type: 'zombie' | 'runner' | 'brute' | 'spitter',
    x: number,
    z: number,
    wave: number,
  ): ZombieEnemy {
    const group = new THREE.Group()
    group.position.set(x, 0, z)

    const originalColors = new Map<THREE.Mesh, THREE.Color>()

    let hp = 40 + wave * 8
    let speed = 2.8
    let damage = 10
    const scale = type === 'brute' ? 2.2 : 1.0

    if (type === 'runner') {
      hp = 25 + wave * 5
      speed = 4.8
      damage = 7
    } else if (type === 'brute') {
      hp = 180 + wave * 35
      speed = 2.1
      damage = 25
    } else if (type === 'spitter') {
      hp = 55 + wave * 10
      speed = 2.5
      damage = 14
    }

    // Voxel geometries
    const skinColor = type === 'brute' ? 0x581c87 : type === 'runner' ? 0x991b1b : 0x15803d
    const clothesColor = type === 'brute' ? 0x1e1b4b : type === 'runner' ? 0x450a0a : 0x1e3a8a

    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 })
    const clothesMat = new THREE.MeshStandardMaterial({ color: clothesColor, roughness: 0.85 })
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: type === 'runner' ? 0xff0000 : 0xfacc15,
      emissiveIntensity: 3.0,
    })

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.65 * scale, 0.32 * scale), clothesMat)
    torso.position.y = 0.85 * scale
    torso.castShadow = true
    group.add(torso)
    originalColors.set(torso, clothesMat.color.clone())

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 0.38 * scale, 0.38 * scale), skinMat)
    head.position.y = 1.38 * scale
    head.castShadow = true
    group.add(head)
    originalColors.set(head, skinMat.color.clone())

    // Glowing Eyes
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.08 * scale, 0.04 * scale), eyeMat)
    eyeL.position.set(-0.1 * scale, 1.4 * scale, 0.2 * scale)
    group.add(eyeL)
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.08 * scale, 0.04 * scale), eyeMat)
    eyeR.position.set(0.1 * scale, 1.4 * scale, 0.2 * scale)
    group.add(eyeR)

    // Horns for Brute Monster
    if (type === 'brute') {
      const hornMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.12 * scale, 0.45 * scale, 6), hornMat)
      hornL.position.set(-0.24 * scale, 1.68 * scale, 0)
      hornL.rotation.z = 0.45
      group.add(hornL)
      const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.12 * scale, 0.45 * scale, 6), hornMat)
      hornR.position.set(0.24 * scale, 1.68 * scale, 0)
      hornR.rotation.z = -0.45
      group.add(hornR)
    }

    // Arms outstretched (classic zombie pose)
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14 * scale, 0.58 * scale, 0.14 * scale), skinMat)
    armL.position.set(-0.35 * scale, 0.88 * scale, 0.28 * scale)
    armL.rotation.x = Math.PI / 2
    armL.castShadow = true
    group.add(armL)
    originalColors.set(armL, skinMat.color.clone())

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14 * scale, 0.58 * scale, 0.14 * scale), skinMat)
    armR.position.set(0.35 * scale, 0.88 * scale, 0.28 * scale)
    armR.rotation.x = Math.PI / 2
    armR.castShadow = true
    group.add(armR)
    originalColors.set(armR, skinMat.color.clone())

    // Legs
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 0.55 * scale, 0.18 * scale), clothesMat)
    legL.position.set(-0.16 * scale, 0.28 * scale, 0)
    legL.castShadow = true
    group.add(legL)
    originalColors.set(legL, clothesMat.color.clone())

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 0.55 * scale, 0.18 * scale), clothesMat)
    legR.position.set(0.16 * scale, 0.28 * scale, 0)
    legR.castShadow = true
    group.add(legR)
    originalColors.set(legR, clothesMat.color.clone())

    return {
      group,
      type,
      hp,
      maxHp: hp,
      speed,
      damage,
      attackCooldown: 0,
      walkPhase: Math.random() * 10,
      isDead: false,
      deathTimer: 0,
      armL,
      armR,
      head,
      bodyMesh: torso,
      originalColors,
      hitFlashTimer: 0,
    }
  }

  private clearEnemies(): void {
    for (const enemy of this.enemies) {
      this.root.remove(enemy.group)
      enemy.group.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose()
        }
      })
    }
    this.enemies.length = 0
  }

  private clearBullets(): void {
    for (const b of this.bullets) {
      this.root.remove(b.mesh)
    }
    this.bullets.length = 0
  }

  dispose(): void {
    this.stopMission()
    this.scene.remove(this.root)
    this.detectionRing.geometry.dispose()
    this.detectionRingMat.dispose()
    this.bulletGeo.dispose()
    this.bulletMat.dispose()
    this.plasmaGeo.dispose()
    this.plasmaMat.dispose()
    this.vBulletMat.dispose()
  }
}
