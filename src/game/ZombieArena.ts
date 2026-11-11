import * as THREE from 'three'
import type { Sound } from './Sound'
import type { Sparks } from './Sparks'
import type { StickPerson } from './StickPerson'

function createProceduralSparkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
  grad.addColorStop(0.25, 'rgba(255, 200, 80, 0.9)')
  grad.addColorStop(0.65, 'rgba(255, 80, 0, 0.4)')
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createProceduralSmokeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(100, 100, 100, 0.8)')
  grad.addColorStop(0.45, 'rgba(60, 60, 60, 0.45)')
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createCircularShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.95)')
  grad.addColorStop(0.4, 'rgba(15, 8, 4, 0.85)')
  grad.addColorStop(0.75, 'rgba(40, 12, 0, 0.4)')
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

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
  shootsFire?: boolean
  fireballCooldown?: number
  fireCrown?: THREE.Mesh
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

export interface RealisticSparksSystem {
  points: THREE.Points
  positions: Float32Array
  data: {
    vx: number
    vy: number
    vz: number
    life: number
    decay: number
  }[]
  light?: THREE.PointLight
  timer: number
}

export interface ActiveMeteor {
  core: THREE.Mesh
  distortionMesh?: THREE.Mesh
  distortionMat?: THREE.ShaderMaterial
  light?: THREE.PointLight
  burnMark: THREE.Mesh
  burnMat: THREE.MeshBasicMaterial
  fireParticles?: THREE.Points
  firePositions?: Float32Array
  fireDynamics?: { vx: number; vy: number; vz: number; life: number; maxLife: number }[]
  smokeParticles?: THREE.Points
  smokePositions?: Float32Array
  smokeDynamics?: { vx: number; vy: number; vz: number; life: number; maxLife: number; size: number }[]
  targetPos: THREE.Vector3
  velocityY: number
  gravity: number
  exploded: boolean
  explosionTimer: number
  burnTimer: number
}

export interface ZombieFireball {
  mesh: THREE.Mesh
  light?: THREE.PointLight
  burnMark: THREE.Mesh
  burnMat: THREE.MeshBasicMaterial
  startPos: THREE.Vector3
  targetPos: THREE.Vector3
  currentPos: THREE.Vector3
  velocity: THREE.Vector3
  life: number
  maxLife: number
  exploded: boolean
  fadeTimer: number
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

  // Graphics & Difficulty
  private graphicsMode: 'low' | 'medium' | 'high' | 'ultra' =
    (localStorage.getItem('smash_graphics_mode') as 'low' | 'medium' | 'high' | 'ultra') || 'medium'
  difficultyMode: 'easy' | 'hard' = 'easy'

  // State
  active = false
  isPausedForCards = false
  currentWave = 1
  totalWaves = 5
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
  readonly realisticSparks: RealisticSparksSystem[] = []
  readonly meteors: ActiveMeteor[] = []
  readonly fireballs: ZombieFireball[] = []
  private meteorCooldown = 3.5
  private spawnCooldown = 0
  private enemiesRemainingToSpawn = 0

  // Textures cache for realistic effects
  private sparkTexture?: THREE.CanvasTexture
  private smokeTexture?: THREE.CanvasTexture
  private shadowCircleTexture?: THREE.CanvasTexture

  setGraphicsMode(mode: 'low' | 'medium' | 'high' | 'ultra'): void {
    this.graphicsMode = mode
  }

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

  startMission(
    playerXOrStickPerson: number | StickPerson,
    _centerZ?: number | string,
    stickPersonParam?: StickPerson | string,
    difficultyParam: 'easy' | 'hard' = 'easy',
  ): void {
    let difficulty: 'easy' | 'hard' = difficultyParam
    if (typeof _centerZ === 'string') {
      difficulty = _centerZ as 'easy' | 'hard'
    } else if (typeof stickPersonParam === 'string') {
      difficulty = stickPersonParam as 'easy' | 'hard'
    }

    const stickPerson = (typeof playerXOrStickPerson === 'object' ? playerXOrStickPerson : stickPersonParam) as StickPerson
    this.active = true
    this.isPausedForCards = false
    this.difficultyMode = difficulty
    this.totalWaves = difficulty === 'hard' ? 10 : 5
    this.currentWave = 1
    this.waveTimer = 0
    this.meteorCooldown = 3.5
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
    this.clearMeteorsAndFireballs()

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
    const modeName = difficulty === 'hard' ? 'DIFÍCIL (10 ONDAS 🔥)' : 'FÁCIL (5 ONDAS)'
    this.onToast?.(`☣️ MISSÃO SOBREVIVÊNCIA ZUMBI [${modeName}] INICIADA! 3 VIDAS DISPONÍVEIS!`)
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
    this.clearMeteorsAndFireballs()
  }

  private startWave(wave: number): void {
    this.currentWave = wave
    this.waveTimer = 0
    const isHard = this.difficultyMode === 'hard'
    const total = this.totalWaves

    if (wave >= total) {
      this.enemiesRemainingToSpawn = isHard ? 65 : 35
      this.spawnCooldown = 0.4
      this.sound.effect('roar')
      this.onWaveChanged?.(this.currentWave, this.totalWaves)
      if (isHard) {
        this.onToast?.(`🔥 ONDA 10 FINAL: TEMPESTADE DE METEOROS E HORDA MONSTRUOSA!`)
      } else {
        this.onToast?.(`☠️ ONDA 5 FINAL: HORDAS DE MONSTROS GIGANTES SE APROXIMAM!`)
      }
    } else {
      this.enemiesRemainingToSpawn = 12 + wave * 5 + Math.floor(this.missionElapsedTime / 10)
      this.spawnCooldown = 0.4
      this.sound.effect('roar')
      this.onWaveChanged?.(this.currentWave, this.totalWaves)

      if (isHard && wave === 6) {
        this.onToast?.(`⚠️ ONDA 6/10: ALERTA! ALGUNS ZUMBIS COMEÇARAM A ATIRAR FOGO!`)
      } else if (isHard && wave === 9) {
        this.onToast?.(`☄️ ONDA 9/10: METEOROS DE FOGO CAINDO DO CÉU! DESVIE DAS SOMBRAS!`)
      } else {
        this.onToast?.(`⚠️ ONDA ${this.currentWave}/${this.totalWaves} APROXIMANDO-SE! DEFENDA A ÁREA!`)
      }
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

    // 6. Update Zombie Fireballs (Ondas 6 a 10 no modo difícil)
    this.updateFireballs(dt, playerPos)

    // 7. Chuva de Meteoros de fogo (Ondas 9 e 10 no modo difícil)
    if (this.difficultyMode === 'hard' && this.currentWave >= 9) {
      this.meteorCooldown -= dt
      if (this.meteorCooldown <= 0) {
        this.meteorCooldown = this.currentWave >= 10 ? Math.random() * 1.5 + 2.0 : Math.random() * 1.8 + 3.2
        const halfW = this.arenaBounds.width / 2 - 4.5
        const halfD = this.arenaBounds.depth / 2 - 4.5
        const targetX = THREE.MathUtils.clamp(
          playerPos.x + (Math.random() - 0.5) * 22,
          this.arenaBounds.centerX - halfW,
          this.arenaBounds.centerX + halfW,
        )
        const targetZ = THREE.MathUtils.clamp(
          playerPos.z + (Math.random() - 0.5) * 22,
          this.arenaBounds.centerZ - halfD,
          this.arenaBounds.centerZ + halfD,
        )
        this.spawnMeteor(targetX, targetZ)
      }
    }

    // 8. Update Meteors (Trajetória, sombra no chão, partículas de fogo e fumaça, impacto)
    this.updateMeteors(dt, playerPos, stickPerson)

    // 9. Update Enemies (AI, walk towards player, attack)
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

  private gerarPontosRaio(inicio: THREE.Vector3, fim: THREE.Vector3, segmentos: number, desvio: number): THREE.Vector3[] {
    const pontos: THREE.Vector3[] = []
    pontos.push(inicio.clone())
    for (let i = 1; i < segmentos; i++) {
      const t = i / segmentos
      const x = THREE.MathUtils.lerp(inicio.x, fim.x, t)
      const y = THREE.MathUtils.lerp(inicio.y, fim.y, t)
      const z = THREE.MathUtils.lerp(inicio.z, fim.z, t)
      const dx = (Math.random() - 0.5) * desvio
      const dz = (Math.random() - 0.5) * desvio
      pontos.push(new THREE.Vector3(x + dx, y, z + dz))
    }
    pontos.push(fim.clone())
    return pontos
  }

  private criarMalhaRaio(pontos: THREE.Vector3[], espessura: number): THREE.Mesh {
    const caminho = new THREE.CatmullRomCurve3(pontos)
    const geometria = new THREE.TubeGeometry(caminho, Math.max(12, pontos.length * 2), espessura, 4, false)
    const material = new THREE.MeshBasicMaterial({ color: 0x99ffff })
    return new THREE.Mesh(geometria, material)
  }

  private criarFaiscasNoImpacto(posicaoImpacto: THREE.Vector3): void {
    const numFaiscas = 40
    const posicoes = new Float32Array(numFaiscas * 3)
    const dados: { vx: number; vy: number; vz: number; life: number; decay: number }[] = []

    for (let i = 0; i < numFaiscas; i++) {
      posicoes[i * 3] = posicaoImpacto.x
      posicoes[i * 3 + 1] = Math.max(0.05, posicaoImpacto.y)
      posicoes[i * 3 + 2] = posicaoImpacto.z

      dados.push({
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 8 + 2.5,
        vz: (Math.random() - 0.5) * 8,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02,
      })
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(posicoes, 3))
    const mat = new THREE.PointsMaterial({
      color: 0x00ffff,
      size: 0.22,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const points = new THREE.Points(geo, mat)
    this.root.add(points)

    const light = new THREE.PointLight(0x00ffff, 45, 18)
    light.position.set(posicaoImpacto.x, 0.6, posicaoImpacto.z)
    this.root.add(light)

    this.realisticSparks.push({
      points,
      positions: posicoes,
      data: dados,
      light,
      timer: 0,
    })
  }

  private triggerLightningStrike(targetEnemy: ZombieEnemy): void {
    const targetPos = targetEnemy.group.position.clone()
    const group = new THREE.Group()
    const isUltraOrHigh = this.graphicsMode === 'high' || this.graphicsMode === 'ultra'

    if (isUltraOrHigh) {
      // Modo Alto e Ultra: Efeito de raio mais realista com CatmullRomCurve3, TubeGeometry e galhos
      const topo = new THREE.Vector3(
        targetPos.x + (Math.random() - 0.5) * 5,
        36,
        targetPos.z + (Math.random() - 0.5) * 5,
      )
      const chao = new THREE.Vector3(targetPos.x, 0.05, targetPos.z)
      const pontosPrincipais = this.gerarPontosRaio(topo, chao, 16, 1.25)
      group.add(this.criarMalhaRaio(pontosPrincipais, 0.12))

      // Galhos secundários
      pontosPrincipais.forEach((pontoSemente, index) => {
        if (index > 1 && index < pontosPrincipais.length - 2 && Math.random() < 0.32) {
          const direcaoGalho = new THREE.Vector3(
            (Math.random() - 0.5) * 4.5,
            -(Math.random() * 3.5 + 1.5),
            (Math.random() - 0.5) * 4.5,
          )
          const fimGalho = pontoSemente.clone().add(direcaoGalho)
          if (fimGalho.y < 0.2) fimGalho.y = 0.2
          const pontosGalho = this.gerarPontosRaio(pontoSemente, fimGalho, 6, 0.5)
          group.add(this.criarMalhaRaio(pontosGalho, 0.045))
        }
      })

      this.root.add(group)
      this.lightnings.push({ group, timer: 0, duration: 0.14 })

      // Sistema físico de faíscas no ponto de impacto com gravidade e rebote
      this.criarFaiscasNoImpacto(chao)
    } else {
      // Modo baixo / médio: cilindros leves
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
      this.sparks.emit(targetPos)
    }

    this.sound.effect('laser')
    this.sound.effect('explosion')

    this.damageEnemy(targetEnemy, 9999, true)

    for (const enemy of this.enemies) {
      if (enemy === targetEnemy || enemy.isDead) continue
      const dist = Math.hypot(enemy.group.position.x - targetPos.x, enemy.group.position.z - targetPos.z)
      if (dist <= 3.4) {
        this.damageEnemy(enemy, 160, true)
      }
    }

    this.onToast?.('⚡ RAIO FULMINANTE DESTRUIU O MONSTRO!')
  }

  private updateLightnings(dt: number): void {
    for (let i = this.lightnings.length - 1; i >= 0; i--) {
      const l = this.lightnings[i]
      l.timer += dt
      if (l.timer >= l.duration) {
        this.root.remove(l.group)
        l.group.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            c.geometry.dispose()
            if (Array.isArray(c.material)) {
              c.material.forEach((m) => m.dispose())
            } else {
              c.material.dispose()
            }
          }
        })
        this.lightnings.splice(i, 1)
      }
    }

    // Atualizar sistema de faíscas realistas do impacto
    const gravidade = -9.8
    for (let s = this.realisticSparks.length - 1; s >= 0; s--) {
      const sp = this.realisticSparks[s]
      sp.timer += dt
      const pos = sp.positions
      let anyAlive = false
      let maxLife = 0

      for (let i = 0; i < sp.data.length; i++) {
        const d = sp.data[i]
        if (d.life > 0) {
          anyAlive = true
          d.vy += gravidade * dt
          pos[i * 3] += d.vx * dt
          pos[i * 3 + 1] += d.vy * dt
          pos[i * 3 + 2] += d.vz * dt

          if (pos[i * 3 + 1] < 0.02) {
            pos[i * 3 + 1] = 0.02
            d.vy *= -0.35
            d.vx *= 0.65
            d.vz *= 0.65
          }

          d.life -= d.decay * (dt * 60)
          if (d.life > maxLife) maxLife = d.life
        }
      }

      sp.points.geometry.attributes.position.needsUpdate = true
      const pMat = sp.points.material as THREE.PointsMaterial
      pMat.opacity = Math.max(0, maxLife)

      if (sp.light) {
        sp.light.intensity = Math.max(0, sp.light.intensity - 240 * dt)
        if (sp.light.intensity <= 0.1) {
          this.root.remove(sp.light)
          sp.light.dispose()
          sp.light = undefined
        }
      }

      if (!anyAlive || sp.timer >= 1.5) {
        this.root.remove(sp.points)
        sp.points.geometry.dispose()
        pMat.dispose()
        if (sp.light) {
          this.root.remove(sp.light)
          sp.light.dispose()
        }
        this.realisticSparks.splice(s, 1)
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

      // Zumbis que atiram fogo (ondas 6 a 10 no modo difícil)
      if (enemy.shootsFire && dist >= 3.8 && dist <= 22.0) {
        enemy.fireballCooldown = (enemy.fireballCooldown ?? 2.0) - dt
        if (enemy.fireballCooldown <= 0) {
          enemy.fireballCooldown = Math.random() * 2.2 + 2.5
          this.spawnZombieFireball(enemy.group.position, playerPos)
        }
      }

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
    this.onToast?.(`🏆 VITÓRIA ÉPICA! TODAS AS ${this.totalWaves} ONDAS CONCLUÍDAS COM SUCESSO!`)
    this.onVictory?.(this.kills, this.currentWave)
  }

  // --- SISTEMA DE METEOROS FLAMEJANTES REALISTAS ---
  private spawnMeteor(targetX: number, targetZ: number): void {
    if (!this.shadowCircleTexture) this.shadowCircleTexture = createCircularShadowTexture()
    if (!this.sparkTexture) this.sparkTexture = createProceduralSparkTexture()
    if (!this.smokeTexture) this.smokeTexture = createProceduralSmokeTexture()

    const isUltraOrHigh = this.graphicsMode === 'high' || this.graphicsMode === 'ultra'

    // Sombra circular escura no chão indicando o local de impacto da bola de fogo
    const burnGeo = new THREE.PlaneGeometry(8.0, 8.0)
    const burnMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      map: this.shadowCircleTexture,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    })
    const burnMark = new THREE.Mesh(burnGeo, burnMat)
    burnMark.rotation.x = -Math.PI / 2
    burnMark.position.set(targetX, 0.02, targetZ)
    this.root.add(burnMark)

    // Núcleo do meteoro
    const coreGeo = new THREE.SphereGeometry(1.2, isUltraOrHigh ? 24 : 12, isUltraOrHigh ? 24 : 12)
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff1100,
      emissive: 0xff6600,
      emissiveIntensity: isUltraOrHigh ? 6.0 : 3.0,
      roughness: 0.3,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    const startY = 52.0
    core.position.set(targetX + (Math.random() - 0.5) * 4, startY, targetZ + (Math.random() - 0.5) * 4)
    this.root.add(core)

    let distortionMesh: THREE.Mesh | undefined
    let distortionMat: THREE.ShaderMaterial | undefined
    let light: THREE.PointLight | undefined
    let fireParticles: THREE.Points | undefined
    let firePositions: Float32Array | undefined
    let fireDynamics: { vx: number; vy: number; vz: number; life: number; maxLife: number }[] | undefined
    let smokeParticles: THREE.Points | undefined
    let smokePositions: Float32Array | undefined
    let smokeDynamics: { vx: number; vy: number; vz: number; life: number; maxLife: number; size: number }[] | undefined

    if (isUltraOrHigh) {
      // Luz pontual de fogo acompanhando o meteoro
      light = new THREE.PointLight(0xff4500, 35, 30)
      light.position.copy(core.position)
      this.root.add(light)

      // Malha de distorção de calor (Heat Haze)
      const distGeo = new THREE.SphereGeometry(3.2, 16, 16)
      distortionMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            float edgeMask = 1.0 - smoothstep(0.3, 0.5, distance(vUv, vec2(0.5)));
            if (edgeMask <= 0.0) discard;
            gl_FragColor = vec4(1.0, 0.4, 0.0, edgeMask * 0.12);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      distortionMesh = new THREE.Mesh(distGeo, distortionMat)
      distortionMesh.position.copy(core.position)
      this.root.add(distortionMesh)

      // Sistema de partículas de fogo da cauda
      const fireCount = 120
      firePositions = new Float32Array(fireCount * 3)
      fireDynamics = []
      for (let i = 0; i < fireCount; i++) {
        firePositions[i * 3] = core.position.x
        firePositions[i * 3 + 1] = core.position.y
        firePositions[i * 3 + 2] = core.position.z
        fireDynamics.push({
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * 4 + 4,
          vz: (Math.random() - 0.5) * 2,
          life: 0,
          maxLife: Math.random() * 0.4 + 0.1,
        })
      }
      const fireGeo = new THREE.BufferGeometry()
      fireGeo.setAttribute('position', new THREE.BufferAttribute(firePositions, 3))
      const fMat = new THREE.PointsMaterial({
        size: 3.2,
        map: this.sparkTexture,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        color: 0xff4400,
      })
      fireParticles = new THREE.Points(fireGeo, fMat)
      this.root.add(fireParticles)

      // Sistema de partículas de fumaça volumétrica da cauda
      const smokeCount = 80
      smokePositions = new Float32Array(smokeCount * 3)
      smokeDynamics = []
      for (let i = 0; i < smokeCount; i++) {
        smokePositions[i * 3] = core.position.x
        smokePositions[i * 3 + 1] = core.position.y
        smokePositions[i * 3 + 2] = core.position.z
        smokeDynamics.push({
          vx: (Math.random() - 0.5) * 1.5,
          vy: Math.random() * 2 + 1,
          vz: (Math.random() - 0.5) * 1.5,
          life: 0,
          maxLife: Math.random() * 1.4 + 0.8,
          size: Math.random() * 5 + 3,
        })
      }
      const smokeGeo = new THREE.BufferGeometry()
      smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3))
      const sMat = new THREE.PointsMaterial({
        size: 4.5,
        map: this.smokeTexture,
        transparent: true,
        depthWrite: false,
        color: 0x333333,
        blending: THREE.NormalBlending,
        opacity: 0.48,
      })
      smokeParticles = new THREE.Points(smokeGeo, sMat)
      this.root.add(smokeParticles)
    }

    this.meteors.push({
      core,
      distortionMesh,
      distortionMat,
      light,
      burnMark,
      burnMat,
      fireParticles,
      firePositions,
      fireDynamics,
      smokeParticles,
      smokePositions,
      smokeDynamics,
      targetPos: new THREE.Vector3(targetX, 0, targetZ),
      velocityY: 14.0,
      gravity: 0.35,
      exploded: false,
      explosionTimer: 0,
      burnTimer: 0,
    })
  }

  private updateMeteors(dt: number, playerPos: THREE.Vector3, _stickPerson: StickPerson): void {
    for (let m = this.meteors.length - 1; m >= 0; m--) {
      const met = this.meteors[m]

      if (!met.exploded) {
        met.velocityY += met.gravity * dt * 60
        met.core.position.y -= met.velocityY * dt

        // Deslocamento horizontal suave em direção ao ponto de impacto
        met.core.position.x = THREE.MathUtils.lerp(met.core.position.x, met.targetPos.x, dt * 2.5)
        met.core.position.z = THREE.MathUtils.lerp(met.core.position.z, met.targetPos.z, dt * 2.5)

        if (met.distortionMesh && met.distortionMat) {
          met.distortionMesh.position.copy(met.core.position)
          met.distortionMat.uniforms.uTime.value = this.missionElapsedTime
        }
        if (met.light) {
          met.light.position.copy(met.core.position)
        }

        // Sombra circular escura no chão: escurece e expande à medida que o meteoro desce
        const distFromFloor = met.core.position.y
        met.burnMat.opacity = Math.max(0.12, Math.min(0.88, 0.95 - (distFromFloor / 52)))
        const shadowScale = Math.min(1.1, 0.45 + (1 - distFromFloor / 52) * 0.65)
        met.burnMark.scale.set(shadowScale, shadowScale, 1)

        // Partículas de cauda de fogo
        if (met.fireParticles && met.firePositions && met.fireDynamics) {
          const fPos = met.firePositions
          for (let i = 0; i < met.fireDynamics.length; i++) {
            const fd = met.fireDynamics[i]
            fd.life += dt
            if (fd.life >= fd.maxLife) {
              fPos[i * 3] = met.core.position.x + (Math.random() - 0.5) * 1.2
              fPos[i * 3 + 1] = met.core.position.y
              fPos[i * 3 + 2] = met.core.position.z + (Math.random() - 0.5) * 1.2
              fd.life = 0
              fd.vx = (Math.random() - 0.5) * 2
              fd.vy = Math.random() * 4 + 4
              fd.vz = (Math.random() - 0.5) * 2
            } else {
              fPos[i * 3] += fd.vx * dt
              fPos[i * 3 + 1] += fd.vy * dt
              fPos[i * 3 + 2] += fd.vz * dt
            }
          }
          met.fireParticles.geometry.attributes.position.needsUpdate = true
        }

        // Partículas de fumaça volumétrica
        if (met.smokeParticles && met.smokePositions && met.smokeDynamics) {
          const sPos = met.smokePositions
          for (let i = 0; i < met.smokeDynamics.length; i++) {
            const sd = met.smokeDynamics[i]
            sd.life += dt
            if (sd.life >= sd.maxLife) {
              sPos[i * 3] = met.core.position.x + (Math.random() - 0.5) * 2.2
              sPos[i * 3 + 1] = met.core.position.y - 0.8
              sPos[i * 3 + 2] = met.core.position.z + (Math.random() - 0.5) * 2.2
              sd.life = 0
              sd.vx = (Math.random() - 0.5) * 1.2
              sd.vy = Math.random() * 2 + 1
              sd.vz = (Math.random() - 0.5) * 1.2
            } else {
              sPos[i * 3] += sd.vx * dt
              sPos[i * 3 + 1] += sd.vy * dt
              sPos[i * 3 + 2] += sd.vz * dt
            }
          }
          met.smokeParticles.geometry.attributes.position.needsUpdate = true
        }

        // Detecção de impacto no chão
        if (met.core.position.y <= 1.2) {
          met.exploded = true
          this.root.remove(met.core)
          met.core.geometry.dispose()
          if (met.distortionMesh) {
            this.root.remove(met.distortionMesh)
            met.distortionMesh.geometry.dispose()
            met.distortionMat?.dispose()
          }

          // Fixa a marca permanente de queimado no chão
          met.burnMat.opacity = 0.95
          met.burnMark.scale.set(1.25, 1.25, 1)

          // Efeitos de impacto
          this.sound.effect('explosion')
          this.sparks.emit(met.targetPos)

          // Inicializar fagulhas radiais da explosão
          if (met.firePositions && met.fireDynamics) {
            for (let i = 0; i < met.fireDynamics.length; i++) {
              met.firePositions[i * 3] = met.targetPos.x
              met.firePositions[i * 3 + 1] = 0.4
              met.firePositions[i * 3 + 2] = met.targetPos.z
              met.fireDynamics[i].vx = (Math.random() - 0.5) * 14
              met.fireDynamics[i].vy = Math.random() * 9 + 4
              met.fireDynamics[i].vz = (Math.random() - 0.5) * 14
            }
          }

          // Dano ao personagem palito se estiver no raio de impacto do meteoro
          const distToPlayer = Math.hypot(playerPos.x - met.targetPos.x, playerPos.z - met.targetPos.z)
          if (distToPlayer <= 3.8 && this.playerInvulnerableTimer <= 0) {
            this.playerInvulnerableTimer = 1.5
            this.playerLives = Math.max(0, this.playerLives - 1)
            this.playerHp = Math.round((this.playerLives / this.maxLives) * 100)
            this.onLivesChanged?.(this.playerLives, this.maxLives)
            this.onHpChanged?.(this.playerHp, this.playerMaxHp)
            this.sound.effect('crash')
            this.onToast?.('💥 METEORO DE FOGO ATINGIU O PALITO! -1 VIDA!')
            if (this.playerLives <= 0) {
              this.handlePlayerDefeated()
              return
            }
          }

          // Dano em área a monstros próximos
          for (const enemy of this.enemies) {
            if (enemy.isDead) continue
            const distEnemy = Math.hypot(enemy.group.position.x - met.targetPos.x, enemy.group.position.z - met.targetPos.z)
            if (distEnemy <= 4.8) {
              this.damageEnemy(enemy, 350, true)
            }
          }
        }
      } else {
        // Animação pós-impacto: explosão radial e fumaça em dissipação
        met.explosionTimer += dt
        met.burnTimer += dt

        if (met.fireParticles && met.firePositions && met.fireDynamics) {
          const fPos = met.firePositions
          for (let i = 0; i < met.fireDynamics.length; i++) {
            const fd = met.fireDynamics[i]
            fPos[i * 3] += fd.vx * dt
            fPos[i * 3 + 1] += fd.vy * dt
            fPos[i * 3 + 2] += fd.vz * dt
            fd.vy -= 9.8 * dt // Gravidade puxa as fagulhas
            if (fPos[i * 3 + 1] < 0.05) {
              fPos[i * 3 + 1] = 0.05
              fd.vy *= -0.3
            }
          }
          met.fireParticles.geometry.attributes.position.needsUpdate = true
          const fMat = met.fireParticles.material as THREE.PointsMaterial
          fMat.opacity = Math.max(0, 1.0 - met.explosionTimer * 0.9)
        }

        if (met.smokeParticles && met.smokePositions && met.smokeDynamics) {
          const sPos = met.smokePositions
          for (let i = 0; i < met.smokeDynamics.length; i++) {
            const sd = met.smokeDynamics[i]
            sPos[i * 3] += sd.vx * dt
            sPos[i * 3 + 1] += sd.vy * dt
            sPos[i * 3 + 2] += sd.vz * dt
            sd.vx *= 0.97
            sd.vz *= 0.97
          }
          met.smokeParticles.geometry.attributes.position.needsUpdate = true
          const sMat = met.smokeParticles.material as THREE.PointsMaterial
          sMat.opacity = Math.max(0, 0.48 - met.explosionTimer * 0.28)
        }

        if (met.light) {
          met.light.intensity = Math.max(0, met.light.intensity - 45 * dt)
          if (met.light.intensity <= 0.1) {
            this.root.remove(met.light)
            met.light.dispose()
            met.light = undefined
          }
        }

        // Dissipação gradual da marca de queimado no chão
        if (met.burnTimer > 2.0) {
          met.burnMat.opacity = Math.max(0, 0.95 - (met.burnTimer - 2.0) * 0.18)
        }

        if (met.burnTimer >= 6.5) {
          this.root.remove(met.burnMark)
          met.burnMark.geometry.dispose()
          met.burnMat.dispose()
          if (met.fireParticles) {
            this.root.remove(met.fireParticles)
            met.fireParticles.geometry.dispose()
            ;(met.fireParticles.material as THREE.Material).dispose()
          }
          if (met.smokeParticles) {
            this.root.remove(met.smokeParticles)
            met.smokeParticles.geometry.dispose()
            ;(met.smokeParticles.material as THREE.Material).dispose()
          }
          this.meteors.splice(m, 1)
        }
      }
    }
  }

  // --- SISTEMA DE BOLAS DE FOGO DISPARADAS POR ZUMBIS ---
  private spawnZombieFireball(startPos: THREE.Vector3, targetPos: THREE.Vector3): void {
    if (!this.shadowCircleTexture) this.shadowCircleTexture = createCircularShadowTexture()

    // Sombra circular no chão avisando com clareza o local exato onde a bola de fogo atingirá
    const burnGeo = new THREE.PlaneGeometry(2.6, 2.6)
    const burnMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      map: this.shadowCircleTexture,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    })
    const burnMark = new THREE.Mesh(burnGeo, burnMat)
    burnMark.rotation.x = -Math.PI / 2
    burnMark.position.set(targetPos.x, 0.02, targetPos.z)
    this.root.add(burnMark)

    // Esfera da bola de fogo
    const geo = new THREE.SphereGeometry(0.35, 12, 12)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff3300,
      emissive: 0xff6600,
      emissiveIntensity: 4.5,
      roughness: 0.2,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(startPos.x, startPos.y + 1.2, startPos.z)
    this.root.add(mesh)

    let light: THREE.PointLight | undefined
    if (this.graphicsMode === 'high' || this.graphicsMode === 'ultra') {
      light = new THREE.PointLight(0xff5500, 8, 8)
      light.position.copy(mesh.position)
      this.root.add(light)
    }

    const dir = new THREE.Vector3(targetPos.x - startPos.x, 0, targetPos.z - startPos.z)
    const dist = dir.length() || 1
    dir.normalize()
    const speed = 14.0
    const timeToTarget = Math.max(0.65, dist / speed)

    this.fireballs.push({
      mesh,
      light,
      burnMark,
      burnMat,
      startPos: mesh.position.clone(),
      targetPos: new THREE.Vector3(targetPos.x, 0.2, targetPos.z),
      currentPos: mesh.position.clone(),
      velocity: new THREE.Vector3(dir.x * speed, 0, dir.z * speed),
      life: 0,
      maxLife: timeToTarget,
      exploded: false,
      fadeTimer: 0,
    })
  }

  private updateFireballs(dt: number, playerPos: THREE.Vector3): void {
    for (let f = this.fireballs.length - 1; f >= 0; f--) {
      const fb = this.fireballs[f]

      if (!fb.exploded) {
        fb.life += dt
        const progress = Math.min(1.0, fb.life / fb.maxLife)

        // Trajetória em arco parabólico em direção ao chão/jogador
        fb.currentPos.x = THREE.MathUtils.lerp(fb.startPos.x, fb.targetPos.x, progress)
        fb.currentPos.z = THREE.MathUtils.lerp(fb.startPos.z, fb.targetPos.z, progress)
        const peakHeight = Math.max(2.2, fb.startPos.y) + 1.2
        fb.currentPos.y = (1 - progress) * fb.startPos.y + progress * fb.targetPos.y + Math.sin(progress * Math.PI) * peakHeight * 0.4
        fb.mesh.position.copy(fb.currentPos)

        if (fb.light) {
          fb.light.position.copy(fb.currentPos)
        }

        // A sombra circular escurece e aumenta no chão avisando onde o fogo vai cair!
        fb.burnMat.opacity = Math.min(0.85, 0.18 + progress * 0.65)
        const sc = 0.5 + progress * 0.55
        fb.burnMark.scale.set(sc, sc, 1)

        // Colisão com o personagem palito
        const distToPlayer = Math.hypot(playerPos.x - fb.currentPos.x, playerPos.z - fb.currentPos.z)
        if (distToPlayer <= 1.1) {
          fb.exploded = true
          if (this.playerInvulnerableTimer <= 0) {
            this.playerInvulnerableTimer = 1.3
            this.playerLives = Math.max(0, this.playerLives - 1)
            this.playerHp = Math.round((this.playerLives / this.maxLives) * 100)
            this.onLivesChanged?.(this.playerLives, this.maxLives)
            this.onHpChanged?.(this.playerHp, this.playerMaxHp)
            this.sound.effect('crash')
            this.onToast?.('🔥 BOLA DE FOGO DO ZUMBI ATINGIU O PALITO! -1 VIDA!')
            if (this.playerLives <= 0) {
              this.handlePlayerDefeated()
              return
            }
          }
        }

        if (progress >= 1.0 || fb.currentPos.y <= 0.25) {
          fb.exploded = true
        }

        if (fb.exploded) {
          this.root.remove(fb.mesh)
          fb.mesh.geometry.dispose()
          ;(fb.mesh.material as THREE.Material).dispose()
          if (fb.light) {
            this.root.remove(fb.light)
            fb.light.dispose()
          }
          this.sparks.emit(fb.targetPos)
          this.sound.effect('explosion')
        }
      } else {
        fb.fadeTimer += dt
        fb.burnMat.opacity = Math.max(0, 0.85 - fb.fadeTimer * 0.8)
        if (fb.fadeTimer >= 1.2) {
          this.root.remove(fb.burnMark)
          fb.burnMark.geometry.dispose()
          fb.burnMat.dispose()
          this.fireballs.splice(f, 1)
        }
      }
    }
  }

  private clearMeteorsAndFireballs(): void {
    for (const m of this.meteors) {
      if (!m.exploded) {
        this.root.remove(m.core)
        m.core.geometry.dispose()
        ;(m.core.material as THREE.Material).dispose()
      }
      if (m.distortionMesh) {
        this.root.remove(m.distortionMesh)
        m.distortionMesh.geometry.dispose()
        m.distortionMat?.dispose()
      }
      if (m.light) {
        this.root.remove(m.light)
        m.light.dispose()
      }
      this.root.remove(m.burnMark)
      m.burnMark.geometry.dispose()
      m.burnMat.dispose()
      if (m.fireParticles) {
        this.root.remove(m.fireParticles)
        m.fireParticles.geometry.dispose()
        ;(m.fireParticles.material as THREE.Material).dispose()
      }
      if (m.smokeParticles) {
        this.root.remove(m.smokeParticles)
        m.smokeParticles.geometry.dispose()
        ;(m.smokeParticles.material as THREE.Material).dispose()
      }
    }
    this.meteors.length = 0

    for (const f of this.fireballs) {
      if (!f.exploded) {
        this.root.remove(f.mesh)
        f.mesh.geometry.dispose()
        ;(f.mesh.material as THREE.Material).dispose()
      }
      if (f.light) {
        this.root.remove(f.light)
        f.light.dispose()
      }
      this.root.remove(f.burnMark)
      f.burnMark.geometry.dispose()
      f.burnMat.dispose()
    }
    this.fireballs.length = 0

    for (const sp of this.realisticSparks) {
      this.root.remove(sp.points)
      sp.points.geometry.dispose()
      ;(sp.points.material as THREE.Material).dispose()
      if (sp.light) {
        this.root.remove(sp.light)
        sp.light.dispose()
      }
    }
    this.realisticSparks.length = 0
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

    const isHard = this.difficultyMode === 'hard'
    let shootsFire = false
    if (isHard && wave >= 6 && Math.random() < 0.42) {
      shootsFire = true
    }

    const enemy = this.createEnemyVoxel(type, sx, sz, wave, shootsFire)
    this.root.add(enemy.group)
    this.enemies.push(enemy)
  }

  private createEnemyVoxel(
    type: 'zombie' | 'runner' | 'brute' | 'spitter',
    x: number,
    z: number,
    wave: number,
    shootsFire = false,
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
    const headMat = shootsFire
      ? new THREE.MeshStandardMaterial({
          color: 0xff3300,
          emissive: 0xff4500,
          emissiveIntensity: 3.5,
          roughness: 0.4,
        })
      : skinMat
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 0.38 * scale, 0.38 * scale), headMat)
    head.position.y = 1.38 * scale
    head.castShadow = true
    group.add(head)
    originalColors.set(head, headMat.color.clone())

    let fireCrown: THREE.Mesh | undefined
    if (shootsFire) {
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xff7700,
        emissive: 0xff5500,
        emissiveIntensity: 4.5,
      })
      fireCrown = new THREE.Mesh(new THREE.ConeGeometry(0.14 * scale, 0.38 * scale, 6), crownMat)
      fireCrown.position.set(0, 1.72 * scale, 0)
      group.add(fireCrown)
    }

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
      shootsFire,
      fireballCooldown: Math.random() * 2.0 + 1.5,
      fireCrown,
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
    if (this.sparkTexture) this.sparkTexture.dispose()
    if (this.smokeTexture) this.smokeTexture.dispose()
    if (this.shadowCircleTexture) this.shadowCircleTexture.dispose()
  }
}
