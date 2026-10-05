import * as THREE from 'three'
import { BusPassengers } from './BusPassengers'
import { Car, type DriveInput } from './Car'
import { City } from './City'
import { Cockpit } from './Cockpit'
import { FloatingRings } from './FloatingRings'
import { Helicopter } from './Helicopter'
import { Input } from './Input'
import { KingKong } from './KingKong'
import { Minimap } from './Minimap'
import { Missions, type MissionEvent, type MissionState } from './Missions'
import { Pedestrians } from './Pedestrians'
import { Plane } from './Plane'
import { Projectiles } from './Projectiles'
import { Pursuit } from './Pursuit'
import { Sparks } from './Sparks'
import { Sound } from './Sound'
import { StickPerson } from './StickPerson'
import { Tank } from './Tank'
import { Traffic } from './Traffic'
import { WantedSystem } from './WantedSystem'
import { usersDB, getXpRequiredForLevel, SHOP_CATALOG, type UserProfile } from '../db/users'

const CASH_KEY = 'smash-city-cash'
const BEST_KEY = 'smash-city-best'
const BEST_TIME_KEY = 'smash-city-best-time'

export class Game {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(61, 1, 0.1, 700)
  private readonly sun = new THREE.DirectionalLight(0xffe6bf, 3.2)
  private readonly renderer: THREE.WebGLRenderer
  private readonly city: City
  private readonly pedestrians: Pedestrians
  private readonly minimap: Minimap
  private readonly plane: Plane
  private readonly floatingRings: FloatingRings
  private readonly tanks: Tank[] = []
  private readonly helicopters: Helicopter[] = []
  private readonly projectiles: Projectiles
  private tankSpawnTimer = 0
  private heliSpawnTimer = 0
  private player: Car
  private readonly abandonedCars: Car[] = []
  private readonly character: StickPerson
  private readonly cockpit: Cockpit
  private readonly input = new Input()
  private readonly wanted = new WantedSystem()
  private readonly pursuit: Pursuit
  private readonly sparks: Sparks
  private readonly traffic: Traffic
  private readonly vehicleButton = document.querySelector<HTMLButtonElement>('#vehicle-button')!
  private readonly pauseButton = document.querySelector<HTMLButtonElement>('#pause-button')
  private readonly pauseOverlay = document.querySelector<HTMLElement>('#pause-overlay')!
  private readonly resumeButton = document.querySelector<HTMLButtonElement>('#resume-button')
  private readonly restartButton = document.querySelector<HTMLButtonElement>('#restart-button')
  private readonly pauseDistance = document.querySelector<HTMLElement>('#pause-distance')
  private readonly pauseTime = document.querySelector<HTMLElement>('#pause-time')
  private readonly pauseWanted = document.querySelector<HTMLElement>('#pause-wanted')
  private readonly missions = new Missions()
  private readonly sound = new Sound()
  private readonly wantedPanel = document.querySelector<HTMLElement>('.wanted-panel')!
  private readonly wantedLabel = document.querySelector<HTMLElement>('#wanted-label')!
  private readonly wantedNote = document.querySelector<HTMLElement>('#wanted-note')!
  private readonly wantedMeter = document.querySelector<HTMLElement>('#wanted-meter')!
  private readonly captureLabel = document.querySelector<HTMLElement>('#capture-label')!
  private readonly captureFill = document.querySelector<HTMLElement>('#capture-fill')!
  private readonly missionList = document.querySelector<HTMLElement>('#mission-list')!
  private readonly speedValue = document.querySelector<HTMLElement>('#speed-value')!
  private readonly speedFill = document.querySelector<HTMLElement>('#speed-fill')!
  private readonly energyVehicleKind = document.querySelector<HTMLElement>('#energy-vehicle-kind')!
  private readonly energyValue = document.querySelector<HTMLElement>('#energy-value')!
  private readonly energyFill = document.querySelector<HTMLElement>('#energy-fill')!
  private readonly energyHits = document.querySelector<HTMLElement>('#energy-hits')!
  private readonly energyStatus = document.querySelector<HTMLElement>('#energy-status')!
  private readonly distanceValue = document.querySelector<HTMLElement>('#distance-value')!
  private readonly timeValue = document.querySelector<HTMLElement>('#time-value')!
  private readonly cashValue = document.querySelector<HTMLElement>('#cash-value')!
  private readonly toastElement = document.querySelector<HTMLElement>('#toast')!
  private readonly tankerMissionPanel = document.querySelector<HTMLElement>('#tanker-mission-panel')!
  private readonly tankerMissionStageEl = document.querySelector<HTMLElement>('#tanker-mission-stage')!
  private readonly tankerTimerLabelEl = document.querySelector<HTMLElement>('#tanker-timer-label')!
  private readonly tankerTimerValEl = document.querySelector<HTMLElement>('#tanker-timer-val')!
  private readonly tankerTimerFillEl = document.querySelector<HTMLElement>('#tanker-timer-fill')!
  private readonly tankerDurabilityEl = document.querySelector<HTMLElement>('#tanker-durability')!
  private readonly tankerInstructionEl = document.querySelector<HTMLElement>('#tanker-instruction')!
  private tankerMissionStage: 'none' | 'survive' | 'deliver' | 'completed' = 'none'
  private tankerMissionTimer = 60.0
  private tankerCompletedBannerTimer = 0
  private readonly busMissionPanel = document.querySelector<HTMLElement>('#bus-mission-panel')!
  private readonly busMissionStageEl = document.querySelector<HTMLElement>('#bus-mission-stage')!
  private readonly busCountValEl = document.querySelector<HTMLElement>('#bus-count-val')!
  private readonly busTimerFillEl = document.querySelector<HTMLElement>('#bus-timer-fill')!
  private readonly busNearestDistEl = document.querySelector<HTMLElement>('#bus-nearest-dist')!
  private readonly busInstructionEl = document.querySelector<HTMLElement>('#bus-instruction')!
  private readonly busPassengers: BusPassengers
  private busMissionStage: 'none' | 'active' | 'completed' = 'none'
  private busCompletedBannerTimer = 0
  private readonly kingKong: KingKong
  private readonly kingKongMissionPanel = document.querySelector<HTMLElement>('#kingkong-mission-panel')!
  private readonly kingKongMissionStageEl = document.querySelector<HTMLElement>('#kingkong-mission-stage')!
  private readonly kingKongHpValEl = document.querySelector<HTMLElement>('#kingkong-hp-val')!
  private readonly kingKongTimerFillEl = document.querySelector<HTMLElement>('#kingkong-timer-fill')!
  private readonly planeRingsValEl = document.querySelector<HTMLElement>('#plane-rings-val')
  private readonly planeRingsFillEl = document.querySelector<HTMLElement>('#plane-rings-fill')
  private readonly kingKongDistInfoEl = document.querySelector<HTMLElement>('#kingkong-dist-info')!
  private readonly kingKongInstructionEl = document.querySelector<HTMLElement>('#kingkong-instruction')!
  private readonly planeShootBtn = document.querySelector<HTMLButtonElement>('#plane-shoot-btn')
  private kingKongMissionStage: 'none' | 'active' | 'completed' = 'none'
  private kingKongCompletedBannerTimer = 0
  private planeShootCooldown = 0
  private planeKingKongHitCooldown = 0

  // Monster Truck Vehicle & Dual Missions
  private readonly monsterTruck: Car
  private readonly monsterMissionPanel = document.querySelector<HTMLElement>('#monster-mission-panel')!
  private readonly monsterModeLabel = document.querySelector<HTMLElement>('#monster-mode-label')!
  private readonly monsterPanelTransformBtn = document.querySelector<HTMLButtonElement>('#monster-panel-transform-btn')
  private readonly monsterCrushValEl = document.querySelector<HTMLElement>('#monster-crush-val')!
  private readonly monsterCrushFillEl = document.querySelector<HTMLElement>('#monster-crush-fill')!
  private readonly monsterKongValEl = document.querySelector<HTMLElement>('#monster-kong-val')!
  private readonly monsterKongFillEl = document.querySelector<HTMLElement>('#monster-kong-fill')!
  private readonly monsterDistInfoEl = document.querySelector<HTMLElement>('#monster-dist-info')!
  private readonly monsterInstructionEl = document.querySelector<HTMLElement>('#monster-instruction')!
  private readonly monsterTransformBtn = document.querySelector<HTMLButtonElement>('#monster-transform-btn')
  private readonly monsterThrustBtn = document.querySelector<HTMLButtonElement>('#monster-thrust-btn')
  private readonly monsterShootBtn = document.querySelector<HTMLButtonElement>('#monster-shoot-btn')
  private monsterCrushCount = 0
  private readonly monsterCrushedCars = new Set<Car>()
  private monsterMissionCrushCompleted = false
  private monsterMissionKongCompleted = false
  private monsterBlasterCooldown = 0
  // Contracts Tabs
  private contractsTab: 'active' | 'completed' = 'active'
  private readonly contractsTabActiveBtn = document.querySelector<HTMLButtonElement>('#contracts-tab-active')
  private readonly contractsTabCompletedBtn = document.querySelector<HTMLButtonElement>('#contracts-tab-completed')
  private readonly activeContractsCountEl = document.querySelector<HTMLElement>('#active-contracts-count')
  private readonly completedContractsCountEl = document.querySelector<HTMLElement>('#completed-contracts-count')

  // Car Hauler Stunt Jump & Slow Motion
  private rampJumpActive = false
  private jumpVerticalVelocity = 0
  private slowMotionActive = false
  private readonly slowMotionBanner = document.querySelector<HTMLElement>('#slow-motion-banner')

  // Car Hauler Truck Collection Mission
  private haulerMissionStage: 'none' | 'active' | 'completed' = 'none'
  private haulerCollectedCount = 0
  private readonly haulerMissionPanel = document.querySelector<HTMLElement>('#hauler-mission-panel')!
  private readonly haulerCollectedValEl = document.querySelector<HTMLElement>('#hauler-collected-val')!
  private readonly haulerCollectedFillEl = document.querySelector<HTMLElement>('#hauler-collected-fill')!
  private readonly haulerDistInfoEl = document.querySelector<HTMLElement>('#hauler-dist-info')!
  private readonly haulerInstructionEl = document.querySelector<HTMLElement>('#hauler-instruction')!
  private readonly strandedCars: { car: Car; marker: THREE.Group; collected: boolean; x: number; z: number }[] = []
  private parkedHauler: Car | null = null

  // 1. Taxi Mission (GTA Vice City / San Andreas)
  private readonly taxiMissionPanel = document.querySelector<HTMLElement>('#taxi-mission-panel')
  private readonly taxiStageLabel = document.querySelector<HTMLElement>('#taxi-stage-label')
  private readonly taxiDestLabel = document.querySelector<HTMLElement>('#taxi-dest-label')
  private readonly taxiTimerVal = document.querySelector<HTMLElement>('#taxi-timer-val')
  private readonly taxiTimerFill = document.querySelector<HTMLElement>('#taxi-timer-fill')
  private readonly taxiTipVal = document.querySelector<HTMLElement>('#taxi-tip-val')
  private readonly taxiDistVal = document.querySelector<HTMLElement>('#taxi-dist-val')
  private readonly taxiInstruction = document.querySelector<HTMLElement>('#taxi-instruction')
  private taxiCar: Car | null = null
  private taxiFareActive = false
  private taxiPassengerOnboard = false
  private taxiCurrentDestination: { name: string; x: number; z: number } | null = null
  private taxiFareTimer = 55.0
  private taxiFareTip = 1000
  private taxiPassengerMesh: THREE.Group | null = null
  private taxiPassengerTargetPos = new THREE.Vector3()
  private taxiWaypointBeacon: THREE.Mesh | null = null
  private taxiFaresCompleted = 0
  private hasFastestCabbieTitle = false
  private tokenMultiplier = 1.0

  // 2. Bomb Car / Speed Mission (GTA III Mike Lips Lunch / Speed)
  private readonly bombMissionPanel = document.querySelector<HTMLElement>('#bomb-mission-panel')
  private readonly bombSpeedVal = document.querySelector<HTMLElement>('#bomb-speed-val')
  private readonly bombSpeedFill = document.querySelector<HTMLElement>('#bomb-speed-fill')
  private readonly bombCountdownVal = document.querySelector<HTMLElement>('#bomb-countdown-val')
  private readonly bombWarningBox = document.querySelector<HTMLElement>('#bomb-warning-box')
  private readonly bombGraceVal = document.querySelector<HTMLElement>('#bomb-grace-val')
  private bombCar: Car | null = null
  private bombMissionActive = false
  private bombMissionSurvived = 0
  private bombGraceTimer = 3.0
  private bombMissionCompleted = false
  private hasExclusiveSpeedPaint = localStorage.getItem('smash_speed_paint') === 'true'

  // 3. Rampage / Modo Furia (GTA 2 / GTA Vice City)
  private readonly rampageMissionPanel = document.querySelector<HTMLElement>('#rampage-mission-panel')
  private readonly rampageTimerVal = document.querySelector<HTMLElement>('#rampage-timer-val')
  private readonly rampageCountVal = document.querySelector<HTMLElement>('#rampage-count-val')
  private readonly rampageFill = document.querySelector<HTMLElement>('#rampage-fill')
  private rampageSkull: THREE.Group | null = null
  private rampageActive = false
  private rampageTimer = 60.0
  private rampagePoliceDestroyed = 0
  private rampageTargetPolice = 15
  private rampageCompleted = false
  private hasUrbanDestroyerTrophy = localStorage.getItem('smash_trophy_urban') === 'true'

  // 4. Auth & Progression (Google & Play Games via users.ts)
  private readonly authButton = document.querySelector<HTMLButtonElement>('#auth-button')
  private readonly authModal = document.querySelector<HTMLElement>('#auth-modal')
  private readonly googleSignInBtn = document.querySelector<HTMLButtonElement>('#google-sign-in-btn')
  private readonly playGamesSignInBtn = document.querySelector<HTMLButtonElement>('#playgames-sign-in-btn')
  private readonly closeAuthModalBtn = document.querySelector<HTMLButtonElement>('#close-auth-modal-btn')
  private readonly authStatusMsg = document.querySelector<HTMLElement>('#auth-status-msg')
  private readonly levelValue = document.querySelector<HTMLElement>('#level-value')
  private readonly xpValue = document.querySelector<HTMLElement>('#xp-value')
  private readonly xpBarFill = document.querySelector<HTMLElement>('#xp-bar-fill')
  private readonly profileUserName = document.querySelector<HTMLElement>('#profile-user-name')
  private readonly profileSyncBadge = document.querySelector<HTMLElement>('#profile-sync-badge')
  private readonly profileLevelVal = document.querySelector<HTMLElement>('#profile-level-val')
  private readonly profileXpVal = document.querySelector<HTMLElement>('#profile-xp-val')
  private readonly profileCashVal = document.querySelector<HTMLElement>('#profile-cash-val')
  private readonly profileHighscoreVal = document.querySelector<HTMLElement>('#profile-highscore-val')
  private readonly guestWarningBanner = document.querySelector<HTMLElement>('#guest-warning-banner')
  private readonly syncNowBtn = document.querySelector<HTMLButtonElement>('#sync-now-btn')
  private readonly signOutBtn = document.querySelector<HTMLButtonElement>('#sign-out-btn')
  private readonly authButtonsList = document.querySelector<HTMLElement>('#auth-buttons-list')
  private currentAuthUser: UserProfile = usersDB.getCurrentUser()
  private distanceXpAccumulator = 0

  // 5. Daily Leaderboard (XP & Dinheiro)
  private readonly leaderboardBtn = document.querySelector<HTMLButtonElement>('#leaderboard-btn')
  private readonly leaderboardModal = document.querySelector<HTMLElement>('#leaderboard-modal')
  private readonly closeLeaderboardBtn = document.querySelector<HTMLButtonElement>('#close-leaderboard-btn')
  private readonly lbTabXp = document.querySelector<HTMLButtonElement>('#lb-tab-xp')
  private readonly lbTabCash = document.querySelector<HTMLButtonElement>('#lb-tab-cash')
  private readonly refreshLeaderboardBtn = document.querySelector<HTMLButtonElement>('#refresh-leaderboard-btn')
  private readonly leaderboardList = document.querySelector<HTMLElement>('#leaderboard-list')
  private readonly leaderboardDateLabel = document.querySelector<HTMLElement>('#leaderboard-date-label')
  private readonly leaderboardMyStatVal = document.querySelector<HTMLElement>('#leaderboard-my-stat-val')
  private readonly lbColScore = document.querySelector<HTMLElement>('#lb-col-score')
  private currentLeaderboardTab: 'xp' | 'cash' = 'xp'

  // 6. Garage & Customization Shop (Loja de Carros e Upgrades)
  private readonly shopBtn = document.querySelector<HTMLButtonElement>('#shop-btn')
  private readonly shopModal = document.querySelector<HTMLElement>('#shop-modal')
  private readonly closeShopBtn = document.querySelector<HTMLButtonElement>('#close-shop-btn')
  private readonly shopUserCash = document.querySelector<HTMLElement>('#shop-user-cash')
  private readonly shopFeedbackMsg = document.querySelector<HTMLElement>('#shop-feedback-msg')
  private readonly shopContentArea = document.querySelector<HTMLElement>('#shop-content-area')
  private readonly shopTabVehicles = document.querySelector<HTMLButtonElement>('#shop-tab-vehicles')
  private readonly shopTabEngine = document.querySelector<HTMLButtonElement>('#shop-tab-engine')
  private readonly shopTabArmor = document.querySelector<HTMLButtonElement>('#shop-tab-armor')
  private readonly shopTabPaints = document.querySelector<HTMLButtonElement>('#shop-tab-paints')
  private readonly shopTabDecals = document.querySelector<HTMLButtonElement>('#shop-tab-decals')
  private readonly shopTabParts = document.querySelector<HTMLButtonElement>('#shop-tab-parts')
  private readonly hydraulicJumpBtn = document.querySelector<HTMLButtonElement>('#hydraulic-jump-btn')
  private currentShopTab: 'vehicles' | 'engine' | 'armor' | 'paints' | 'decals' | 'parts' = 'vehicles'

  private readonly startOverlay = document.querySelector<HTMLElement>('#start-overlay')!
  private readonly endOverlay = document.querySelector<HTMLElement>('#end-overlay')!
  private readonly wantedSegments: HTMLElement[] = []
  private readonly cameraTarget = new THREE.Vector3()
  private readonly cameraOffset = new THREE.Vector3(0, 6.2, 12.5)
  private readonly lookTarget = new THREE.Vector3()
  private readonly occlusionTarget = new THREE.Vector3()
  private readonly verticalAxis = new THREE.Vector3(0, 1, 0)
  private cameraMode: 'chase' | 'quarter' | 'cockpit' = 'chase'
  private inVehicle = true
  private inPlane = false
  private running = false
  private ended = false
  private paused = false
  private lastFrame = 0
  private hudTimer = 0
  private toastTimer = 0
  private elapsed = 0
  private distance = 0
  private cash = Number(localStorage.getItem(CASH_KEY) ?? 0) || 0
  private bestScore = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0
  private bestTime = Number(localStorage.getItem(BEST_TIME_KEY) ?? 0) || 0
  private lastImpact = 0
  private lastPoliceCollision = -999
  private autoApproachCar: Car | null = null
  private autoApproachTimer = 0
  private readonly cancelAutoEnterBtn = document.querySelector<HTMLButtonElement>('#cancel-auto-enter-btn')
  private readonly contractsToggleBtn = document.querySelector<HTMLButtonElement>('#contracts-toggle-btn')
  private readonly missionPanel = document.querySelector<HTMLElement>('#mission-panel')
  private waterTimer = 30.0
  private wantedCalmTimer = 0
  private readonly waterTimerPanel = document.querySelector<HTMLElement>('#water-timer-panel')!
  private readonly waterTimerValEl = document.querySelector<HTMLElement>('#water-timer-val')!
  private readonly waterTimerFillEl = document.querySelector<HTMLElement>('#water-timer-fill')!

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.06
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(this.renderer.domElement)
    this.cockpit = new Cockpit(this.scene)

    this.scene.background = new THREE.Color(0xa6c2a1)
    this.scene.fog = new THREE.Fog(0xa6c2a1, 140, 380)
    this.createLighting()
    this.city = new City(this.scene)
    this.pedestrians = new Pedestrians(this.scene)
    this.plane = new Plane(this.scene, 168, -120, 0)
    this.floatingRings = new FloatingRings(this.scene)
    this.projectiles = new Projectiles(this.scene)
    this.player = this.createPlayerVehicle(0, 0, 0)
    this.character = new StickPerson(this.scene)
    this.pursuit = new Pursuit(this.scene, this.wanted)
    this.sparks = new Sparks(this.scene)
    this.traffic = new Traffic(this.scene)
    this.busPassengers = new BusPassengers(this.scene)
    this.kingKong = new KingKong(this.scene)
    const initialKongLoc = this.city.getKingKongLocation()
    this.kingKong.reset(initialKongLoc.blockX, initialKongLoc.centerZ)

    // Monster Truck parked in Praça Central
    this.monsterTruck = new Car(this.scene, { kind: 'monster_truck', scale: 1.15 })
    const mtLoc = this.city.getMonsterTruckPlazaLocation()
    this.monsterTruck.setPosition(mtLoc.x, mtLoc.z, 0)
    this.abandonedCars.push(this.monsterTruck)

    // Caminhão Cegonha parked on street near starting spawn
    this.parkedHauler = new Car(this.scene, { kind: 'car_hauler', color: 0x2563eb, scale: 0.98 })
    this.parkedHauler.setPosition(48 + 4.2, 18, 0)
    this.abandonedCars.push(this.parkedHauler)

    // 1. Táxi Amarelo da Missão de Táxi / Corrida Maluca
    this.taxiCar = new Car(this.scene, { kind: 'taxi', color: 0xfacc15 })
    this.taxiCar.setPosition(-48 - 4.2, 16, Math.PI)
    this.abandonedCars.push(this.taxiCar)

    // 2. Carro-Bomba Esportivo (Velocidade Máxima)
    this.bombCar = new Car(this.scene, { kind: 'bomb_car', color: 0x18181b })
    this.bombCar.setPosition(0 + 4.2, -48, 0)
    this.abandonedCars.push(this.bombCar)

    // 3. Ícone 3D de Caveira para Modo Fúria / Rampage
    this.initRampageSkull()
    this.initTaxiMission()

    this.initStrandedCars()

    this.minimap = new Minimap(document.querySelector<HTMLElement>('#minimap-shell')!)
    this.city.ensureAround(this.player.root.position.z)
    this.pedestrians.ensureAround(this.player.root.position.z)
    this.createHud()
    this.bindControls()
    this.resize()
    this.updateCameraButton()
    this.updateCamera(1)
    this.updateHud()
    this.updateMissionCards()
    window.addEventListener('resize', this.resize)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    requestAnimationFrame(this.frame)
  }

  private createLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xe4eedc, 0x334137, 2.15)
    this.scene.add(hemisphere)

    this.sun.position.set(-36, 62, -28)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1536, 1536)
    this.sun.shadow.camera.left = -76
    this.sun.shadow.camera.right = 76
    this.sun.shadow.camera.top = 76
    this.sun.shadow.camera.bottom = -76
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 210
    this.sun.shadow.bias = -0.0002
    this.scene.add(this.sun, this.sun.target)
  }

  private createHud(): void {
    this.wantedMeter.innerHTML = Array.from({ length: 10 }, (_, index) => `<span class="wanted-segment" data-level="${index + 1}"></span>`).join('')
    this.wantedSegments.push(...this.wantedMeter.querySelectorAll<HTMLElement>('.wanted-segment'))
    this.updateMissionCards()

    this.contractsTabActiveBtn?.addEventListener('click', () => {
      this.contractsTab = 'active'
      this.contractsTabActiveBtn?.classList.add('active')
      this.contractsTabCompletedBtn?.classList.remove('active')
      this.updateMissionCards()
    })

    this.contractsTabCompletedBtn?.addEventListener('click', () => {
      this.contractsTab = 'completed'
      this.contractsTabCompletedBtn?.classList.add('active')
      this.contractsTabActiveBtn?.classList.remove('active')
      this.updateMissionCards()
    })

    document.querySelector<HTMLButtonElement>('#start-button')!.addEventListener('click', () => this.start())
    document.querySelector<HTMLButtonElement>('#retry-button')!.addEventListener('click', () => this.start())
    document.querySelector<HTMLButtonElement>('#camera-button')!.addEventListener('click', () => this.toggleCamera())
    this.pauseButton?.addEventListener('click', () => this.togglePause())
    this.resumeButton?.addEventListener('click', () => this.togglePause())
    this.restartButton?.addEventListener('click', () => {
      this.setPaused(false)
      this.start()
    })
    this.vehicleButton.addEventListener('click', () => this.toggleVehicle())
    this.contractsToggleBtn?.addEventListener('click', () => {
      if (this.missionPanel) {
        const isCollapsed = this.missionPanel.classList.toggle('collapsed')
        if (this.contractsToggleBtn) {
          this.contractsToggleBtn.textContent = isCollapsed ? '▼' : '▲'
          this.contractsToggleBtn.setAttribute('aria-label', isCollapsed ? 'Expandir contratos' : 'Ocultar contratos')
        }
      }
    })
    this.cancelAutoEnterBtn?.addEventListener('click', () => {
      this.cancelAutoApproach('ENTRADA AUTOMÁTICA CANCELADA')
    })
    document.querySelector<HTMLButtonElement>('#sound-button')!.addEventListener('click', (event) => {
      const button = event.currentTarget as HTMLButtonElement
      const enabled = this.sound.toggle()
      button.classList.toggle('muted', !enabled)
      button.setAttribute('aria-label', enabled ? 'Desativar som' : 'Ativar som')
      button.textContent = enabled ? '♪' : '×'
    })
    this.planeShootBtn?.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      if (this.inPlane && this.kingKongMissionStage === 'active') {
        this.firePlaneCannons()
      }
    })
    this.monsterTransformBtn?.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      if (this.inVehicle && this.player.kind === 'monster_truck') {
        this.toggleMonsterTransformation()
      }
    })
    this.monsterPanelTransformBtn?.addEventListener('click', (e) => {
      e.preventDefault()
      if (this.inVehicle && this.player.kind === 'monster_truck') {
        this.toggleMonsterTransformation()
      }
    })
    this.monsterShootBtn?.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      if (this.inVehicle && this.player.kind === 'monster_truck' && this.player.isRobotMode) {
        this.fireMonsterBlaster()
      }
    })

    // Auth Button & Modal Events
    this.authButton?.addEventListener('click', () => {
      this.updateProfileModalUI()
      this.authModal?.classList.remove('hidden')
    })
    this.closeAuthModalBtn?.addEventListener('click', () => {
      this.authModal?.classList.add('hidden')
    })
    this.googleSignInBtn?.addEventListener('click', () => {
      void this.handleSignIn('Google')
    })
    this.playGamesSignInBtn?.addEventListener('click', () => {
      void this.handleSignIn('Google Play Games')
    })
    this.syncNowBtn?.addEventListener('click', () => {
      void this.handleManualSync()
    })
    this.signOutBtn?.addEventListener('click', () => {
      void this.handleSignOut()
    })

    // Daily Leaderboard Events
    this.leaderboardBtn?.addEventListener('click', () => {
      this.openDailyLeaderboard()
    })
    this.closeLeaderboardBtn?.addEventListener('click', () => {
      this.leaderboardModal?.classList.add('hidden')
    })
    this.lbTabXp?.addEventListener('click', () => {
      this.switchLeaderboardTab('xp')
    })
    this.lbTabCash?.addEventListener('click', () => {
      this.switchLeaderboardTab('cash')
    })
    this.refreshLeaderboardBtn?.addEventListener('click', () => {
      void this.loadDailyLeaderboardData()
    })

    // Garage & Customization Shop Events
    this.shopBtn?.addEventListener('click', () => {
      this.openShop()
    })
    this.closeShopBtn?.addEventListener('click', () => {
      this.closeShop()
    })
    this.shopTabVehicles?.addEventListener('click', () => this.switchShopTab('vehicles'))
    this.shopTabEngine?.addEventListener('click', () => this.switchShopTab('engine'))
    this.shopTabArmor?.addEventListener('click', () => this.switchShopTab('armor'))
    this.shopTabPaints?.addEventListener('click', () => this.switchShopTab('paints'))
    this.shopTabDecals?.addEventListener('click', () => this.switchShopTab('decals'))
    this.shopTabParts?.addEventListener('click', () => this.switchShopTab('parts'))

    // Hydraulic Jump Mobile Button
    this.hydraulicJumpBtn?.addEventListener('click', () => {
      this.triggerHydraulicJump()
    })

    // Listen to usersDB updates in real time
    usersDB.onUserStateChanged((user) => {
      this.onUserDataUpdated(user)
    })
  }

  private triggerHydraulicJump(): void {
    if (this.inVehicle && !this.inPlane && this.player.hasHydraulicJump) {
      if (this.player.hydraulicJump()) {
        this.sound.effect('jump')
        this.sparks.emit(new THREE.Vector3(this.player.root.position.x, 0.1, this.player.root.position.z))
        this.showToast('🦘 SALTO HIDRÁULICO!')
      }
    }
  }

  private bindControls(): void {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.minimap.isExpanded && !event.repeat) {
        this.minimap.toggleExpand(false)
        return
      }
      if ((event.key.toLowerCase() === 'p' || event.key === 'Escape') && !event.repeat) {
        this.togglePause()
        return
      }
      if (event.key.toLowerCase() === 'm' && !event.repeat) {
        this.minimap.toggleExpand()
        return
      }
      if (event.key.toLowerCase() === 'c' && !event.repeat && !this.paused) this.toggleCamera()
      if (event.key.toLowerCase() === 'e' && !event.repeat && !this.paused) this.toggleVehicle()
      if (event.code === 'Space' && !event.repeat && !this.paused) {
        if (this.inVehicle && !this.inPlane && this.player.hasHydraulicJump) {
          this.triggerHydraulicJump()
        }
      }
      if (event.key.toLowerCase() === 't' && !event.repeat && !this.paused) {
        if (this.inVehicle && this.player.kind === 'monster_truck') {
          this.toggleMonsterTransformation()
        }
      }
      if (event.key === 'Enter') {
        if (!this.running && !this.ended) this.start()
        else if (this.running && this.paused) this.togglePause()
      }
    })
  }

  private start(): void {
    this.setPaused(false)
    this.input.clear()
    this.pursuit.reset()
    this.wanted.reset()
    this.missions.reset()
    this.city.clear()
    this.pedestrians.clear()
    this.traffic.reset()
    this.plane.reset(168, -120, 0)
    this.floatingRings.reset()
    this.projectiles.reset()
    for (const tank of this.tanks) tank.dispose()
    this.tanks.length = 0
    for (const heli of this.helicopters) heli.dispose()
    this.helicopters.length = 0
    this.tankSpawnTimer = 0
    this.heliSpawnTimer = 0
    for (const car of this.abandonedCars) {
      if (car !== this.monsterTruck && car !== this.parkedHauler) car.dispose()
    }
    this.abandonedCars.length = 0
    const mtLoc = this.city.getMonsterTruckPlazaLocation()
    this.monsterTruck.setPosition(mtLoc.x, mtLoc.z, 0)
    this.monsterTruck.resetDamage()
    this.monsterTruck.toggleRobotMode(false)
    this.abandonedCars.push(this.monsterTruck)
    if (this.parkedHauler) {
      this.parkedHauler.setPosition(48 + 4.2, 18, 0)
      this.parkedHauler.resetDamage()
      this.parkedHauler.setHaulerCollectedCount(0)
      this.abandonedCars.push(this.parkedHauler)
    }
    if (this.taxiCar) {
      this.taxiCar.setPosition(-48 - 4.2, 16, Math.PI)
      this.taxiCar.resetDamage()
      this.abandonedCars.push(this.taxiCar)
    }
    if (this.bombCar) {
      this.bombCar.setPosition(0 + 4.2, -48, 0)
      this.bombCar.resetDamage()
      this.abandonedCars.push(this.bombCar)
    }
    this.initRampageSkull()
    this.initTaxiMission()
    this.bombMissionActive = false
    this.bombMissionSurvived = 0
    this.bombGraceTimer = 3.0
    this.bombMissionCompleted = false
    this.updateBombMissionUI()
    this.rampageActive = false
    this.rampageTimer = 60.0
    this.rampagePoliceDestroyed = 0
    this.rampageCompleted = false
    this.updateRampageMissionUI()
    this.rampJumpActive = false
    this.jumpVerticalVelocity = 0
    this.slowMotionActive = false
    this.haulerMissionStage = 'none'
    this.haulerCollectedCount = 0
    this.initStrandedCars()
    this.updateHaulerMissionUI()
    this.monsterCrushCount = 0
    this.monsterCrushedCars.clear()
    this.monsterMissionCrushCompleted = false
    this.monsterMissionKongCompleted = false
    this.monsterBlasterCooldown = 0
    this.planeKingKongHitCooldown = 0
    this.player.dispose()
    this.player = this.createPlayerVehicle(0, 0, 0)
    this.character.setPosition(-1.8, 0, 0)
    this.character.root.visible = false
    this.inVehicle = true
    this.inPlane = false
    this.city.ensureAround(0)
    this.pedestrians.ensureAround(0)
    this.elapsed = 0
    this.distance = 0
    this.hudTimer = 0
    this.lastImpact = 0
    this.lastPoliceCollision = -999
    this.running = true
    this.ended = false
    this.cancelAutoApproach(null)
    this.waterTimer = 30.0
    this.wantedCalmTimer = 0
    this.updateWaterTimerUI(false)
    this.tankerMissionStage = 'none'
    this.tankerMissionTimer = 60.0
    this.tankerCompletedBannerTimer = 0
    this.updateTankerMissionUI()
    this.busPassengers.clear()
    this.busMissionStage = 'none'
    this.busCompletedBannerTimer = 0
    this.updateBusMissionUI()
    const kongLoc = this.city.selectRandomKingKongLocation()
    this.kingKong.reset(kongLoc.blockX, kongLoc.centerZ)
    this.kingKongMissionStage = 'none'
    this.kingKongCompletedBannerTimer = 0
    this.planeShootCooldown = 0
    this.updateKingKongMissionUI()
    this.updateMonsterMissionUI()
    this.updateVehicleButton()
    this.startOverlay.classList.add('hidden')
    this.endOverlay.classList.add('hidden')
    this.pauseOverlay.classList.add('hidden')
    if (this.pauseButton) {
      this.pauseButton.textContent = '❚❚'
      this.pauseButton.setAttribute('aria-label', 'Pausar jogo')
    }
    void this.sound.start()
    this.updateMissionCards()
    this.updateHud()
    this.showToast('PERSEGUIÇÃO INICIADA')
  }

  private readonly frame = (timestamp: number): void => {
    const rawDt = this.lastFrame === 0 ? 0 : Math.min((timestamp - this.lastFrame) / 1000, 0.05)
    this.lastFrame = timestamp
    const dt = this.slowMotionActive ? rawDt * 0.30 : rawDt

    if (this.slowMotionBanner) {
      this.slowMotionBanner.classList.toggle('hidden', !this.slowMotionActive)
    }

    if (this.running && !this.paused) this.update(dt)
    this.updateCamera(Math.min(1, (this.paused ? 0.016 : dt) * (this.cameraMode === 'cockpit' ? 12 : 5)))
    const actorPosition = this.inPlane
      ? this.plane.root.position
      : this.inVehicle
        ? this.player.root.position
        : this.character.root.position
    const actorYaw = this.inPlane
      ? this.plane.yaw
      : this.inVehicle
        ? this.player.yaw
        : this.character.yaw
    this.occlusionTarget.set(actorPosition.x, actorPosition.y + (this.inPlane ? 1.5 : this.inVehicle ? 1.15 : 1.1), actorPosition.z)
    this.city.updateOcclusion(this.camera.position, this.occlusionTarget)
    if (!this.paused) this.sparks.update(dt)
    this.minimap.update(
      dt,
      actorPosition,
      actorYaw,
      this.inVehicle,
      this.pursuit.getCars(),
      this.traffic.getCars(),
      this.city,
      {
        position: this.plane.root.position,
        yaw: this.plane.yaw,
        inPlane: this.inPlane,
        state: this.plane.state,
      },
      this.floatingRings.rings,
      this.tanks,
      this.helicopters,
      this.tankerMissionStage,
      this.busPassengers.getPassengerLocations(),
      {
        position: this.monsterTruck.root.position,
        inMonsterTruck: this.inVehicle && this.player === this.monsterTruck,
      },
      this.getStationaryCarLocations(),
    )
    this.renderer.render(this.scene, this.camera)
    requestAnimationFrame(this.frame)
  }

  private update(dt: number): void {
    this.elapsed += dt
    const controls = this.input.read()
    let collided = false

    if (this.inPlane) {
      const prevAltitude = this.plane.altitude
      collided = this.plane.driveFlight(controls, dt, (x, y, z, radius) => this.city.collides3D(x, y, z, radius))
      if (this.plane.state === 'flying' && prevAltitude <= 0.6 && this.plane.altitude > 0.6) {
        this.sound.effect('takeoff')
        this.showToast('DECOLAGEM! // USE W/S/A/D PARA PILOTAR NO AR')
      }
      this.cockpit.update(controls.steer, dt)
    } else if (this.inVehicle) {
      collided = this.player.drive(controls, dt, (x, z, radius) => this.resolveFullCollision(x, z, radius, this.player.root.position.y + this.player.climbLift))
      this.cockpit.update(controls.steer, dt)

      // Car Hauler Ramp Stunt Jump & Slow Motion Physics
      if (this.rampJumpActive) {
        this.jumpVerticalVelocity -= 17.0 * dt
        this.player.climbLift += this.jumpVerticalVelocity * dt
        this.player.climbPitch = -this.jumpVerticalVelocity * 0.009

        // Check landing on the street
        if (this.player.climbLift <= 0) {
          this.player.climbLift = 0
          this.player.climbPitch = 0
          this.rampJumpActive = false
          this.slowMotionActive = false
          this.sound.effect('jump')
          this.sound.effect('crash')
          this.sparks.emit(this.player.root.position)
          const justCompleted = this.missions.recordRampJump(1)
          for (const m of justCompleted) this.completeMission(m)
          this.cash += Math.round(500 * this.tokenMultiplier)
          localStorage.setItem(CASH_KEY, String(this.cash))
          this.rewardXp(75)
          this.showToast('🚀 MEGA SALTO PERFEITO! +$500 (+75 XP)')
          this.updateHud()
          this.updateMissionCards()
        }
      } else if (this.player.kind !== 'car_hauler') {
        const haulers = [
          ...this.traffic.getCars().filter(c => c.kind === 'car_hauler' && !c.exploded),
          ...this.abandonedCars.filter(c => c.kind === 'car_hauler' && !c.exploded),
        ]
        for (const hauler of haulers) {
          if (hauler === this.player) continue
          const check = this.player.checkRampClimb(hauler)
          if (check.onRamp) {
            this.player.climbLift = Math.max(this.player.climbLift, check.rampHeight)
            this.player.climbPitch = -0.22
            if (check.atLaunchLip) {
              this.rampJumpActive = true
              this.jumpVerticalVelocity = 56.0 + Math.min(42, Math.abs(this.player.speed) * 1.35)
              this.player.speed = Math.max(40, this.player.speed * 1.9)
              this.slowMotionActive = true
              this.sound.effect('jump')
              this.showToast('⚡ MEGA SALTO ACROBÁTICO ULTRA ALTO! CÂMERA LENTA ⚡')
              if (this.inVehicle && this.player.kind === 'taxi' && this.taxiFareActive) {
                this.taxiFareTip += 500
                this.showToast('🚕 SALTO RADICAL NA CEGONHA! +$500 GORJETA!')
              }
              break
            }
          }
        }
      }
    } else {
      if (this.autoApproachCar) {
        if (this.autoApproachCar.exploded) {
          this.cancelAutoApproach('VEÍCULO DESTRUÍDO // ENTRADA CANCELADA')
        } else if (controls.throttle !== 0 || controls.steer !== 0) {
          this.cancelAutoApproach('ENTRADA AUTOMÁTICA CANCELADA')
        } else {
          this.autoApproachTimer -= dt
          if (this.cancelAutoEnterBtn) {
            this.cancelAutoEnterBtn.textContent = `CANCELAR ENTRADA (${Math.ceil(this.autoApproachTimer)}s)`
          }
          if (this.autoApproachTimer <= 0) {
            this.cancelAutoApproach('ENTRADA CANCELADA // VEÍCULO NÃO ALCANÇADO EM 10s')
          } else {
            const targetPos = this.autoApproachCar.root.position
            const stepRes = this.character.stepTowards(
              targetPos.x,
              targetPos.z,
              dt,
              8.0,
              (x, z, r) => this.resolveFullCollision(x, z, r, this.character.root.position.y).collided,
            )
            if (stepRes.arrived || stepRes.distance <= 2.2) {
              const chosenCar = this.autoApproachCar
              this.cancelAutoApproach(null)
              this.boardVehicle(chosenCar)
            }
          }
        }
      } else {
        const charInWater = !this.inVehicle && !this.inPlane && this.city.isInWater(this.character.root.position.x, this.character.root.position.z)
        this.character.update(dt, controls, (x, z, radius) => this.resolveFullCollision(x, z, radius, this.character.root.position.y).collided, charInWater)
      }
      this.cockpit.update(0, dt)
    }

    const actorPosition = this.inPlane
      ? this.plane.root.position
      : this.inVehicle
        ? this.player.root.position
        : this.character.root.position
    const actorYaw = this.inPlane
      ? this.plane.yaw
      : this.inVehicle
        ? this.player.yaw
        : this.character.yaw
    const actorSpeed = this.inPlane
      ? this.plane.speed
      : this.inVehicle
        ? this.player.speed
        : this.character.speed
    const speed = Math.abs(actorSpeed)
    this.sun.position.set(actorPosition.x - 36, 62, actorPosition.z - 28)
    this.sun.target.position.set(actorPosition.x, 0, actorPosition.z)
    const distanceDelta = speed * dt
    this.distance += distanceDelta
    this.distanceXpAccumulator += distanceDelta
    if (this.distanceXpAccumulator >= 60) {
      this.distanceXpAccumulator = 0
      this.rewardXp(8)
    }
    this.city.ensureAround(actorPosition.z)
    this.pedestrians.ensureAround(actorPosition.z)
    this.city.update(dt)
    this.kingKong.update(dt, this.inPlane ? this.plane.root.position : null)

    // Floating Rings update & check
    const ringResult = this.floatingRings.update(dt, this.plane.root.position, this.inPlane, this.plane.consecutiveRings)
    if (ringResult && this.inPlane) {
      this.plane.consecutiveRings = ringResult.consecutiveCount
      this.cash += ringResult.rewardCash
      localStorage.setItem(CASH_KEY, String(this.cash))
      this.sound.effect('ring')
      this.sparks.emit(ringResult.position)
      this.showToast(`CÍRCULO FLUTUANTE ATRAVESSADO! [${this.plane.consecutiveRings}/7] +$${ringResult.rewardCash}`)

      if (ringResult.missionCompleted || this.plane.consecutiveRings === 7) {
        this.cash += 1000
        localStorage.setItem(CASH_KEY, String(this.cash))
        this.sound.effect('mission')
        this.showToast('MISSÃO CUMPRIDA: AS DOS ARES! 7 CÍRCULOS SEGUIDOS! +$1.000')
      }
    }

    // Airplane damage & explosion physics
    if (this.inPlane) {
      if (collided) {
        const hit = this.plane.registerHit('building', 0.4)
        if (hit.hitRegistered) {
          this.sound.effect('crash')
          this.sparks.emit(this.plane.getHoodPosition())
          if (hit.isNewExplosion) {
            this.sparks.emitExplosion(this.plane.root.position)
            this.sound.effect('explosion')
            this.endRun('plane_explosion')
            return
          } else if (this.plane.isSmoking && hit.hits === this.plane.smokeThreshold) {
            this.showToast('MOTORES FUMEGANDO // DANOS CRÍTICOS (30+ BATIDAS)')
          }
        }
      }

      if (this.plane.isSmoking) {
        this.plane.smokeTimer += dt
        if (this.plane.smokeTimer >= 0.08) {
          this.plane.smokeTimer = 0
          const [leftEng, rightEng] = this.plane.getEnginePositions()
          this.sparks.emitSmoke(leftEng, 1.4)
          this.sparks.emitSmoke(rightEng, 1.4)
        }
      }

      // Colisão direta do avião bimotor contra o King Kong
      if (this.planeKingKongHitCooldown > 0) {
        this.planeKingKongHitCooldown = Math.max(0, this.planeKingKongHitCooldown - dt)
      }
      if (this.kingKongMissionStage === 'active' && this.kingKong.checkHit(this.plane.root.position, 3.2)) {
        if (this.planeKingKongHitCooldown <= 0) {
          this.planeKingKongHitCooldown = 0.6
          const hitRes = this.kingKong.registerHit()
          this.sparks.emitExplosion(this.plane.root.position)
          this.sound.effect('roar')
          this.sound.effect('explosion')
          const awayX = this.plane.root.position.x - this.kingKong.centerX
          const awayZ = this.plane.root.position.z - this.kingKong.centerZ
          const distAway = Math.hypot(awayX, awayZ) || 1
          this.plane.root.position.x += (awayX / distAway) * 5
          this.plane.root.position.z += (awayZ / distAway) * 5
          if (hitRes.defeated) {
            this.sparks.emitExplosion(hitRes.position)
            this.sound.effect('explosion')
            this.sound.effect('mission')
            this.kingKongMissionStage = 'completed'
            this.kingKongCompletedBannerTimer = 8.0
            this.cash += 5000
            this.distance += 2500
            localStorage.setItem(CASH_KEY, String(this.cash))
            this.showToast('🏆 VITÓRIA ÉPICA! KING KONG DERRUBADO DO ARRANHA-CÉU! +$5.000 (+15.000 PTS)')
          } else {
            this.showToast(`💥 COLISÃO AÉREA NO KING KONG! [${hitRes.remainingHp} / 50 HP]`)
          }
          this.updateKingKongMissionUI()
        }
      }
    }

    if (this.inVehicle && this.player.kind === 'monster_truck' && this.player.isRobotMode) {
      this.player.updateRobotAnimation(dt)
    }

    const traffic = this.traffic.update(dt, this.player, this.city)
    const pedestrianHits = !this.inPlane ? this.pedestrians.update(dt, actorPosition, actorYaw, this.inVehicle ? speed : 0) : 0

    if (!this.inPlane && this.city.isRiver(actorPosition.x, actorPosition.z)) {
      if (this.inVehicle) {
        this.player.speed *= Math.max(0, 1 - 3.8 * dt)
      } else {
        this.character.speed *= Math.max(0, 1 - 3.8 * dt)
      }
      this.sparks.emit(actorPosition)
      if (this.elapsed - this.lastImpact > 1.2) {
        this.lastImpact = this.elapsed
        this.sound.effect('crash')
        this.showToast('NO RIO // CUIDADO COM A CORRENTEZA')
      }
    }

    for (const point of traffic.collisionPoints) this.sparks.emit(point)
    for (const pt of traffic.explosions) {
      this.sparks.emitExplosion(pt)
      this.sound.effect('explosion')
    }
    for (const pt of traffic.smokingPositions) {
      this.sparks.emitSmoke(pt, 0.85)
    }

    if (!this.inPlane && traffic.playerCollisions > 0) {
      if (this.elapsed - this.lastPoliceCollision > 2.0) {
        this.addHeat(3 * traffic.playerCollisions)
        this.showToast('COLISÃO NO TRÂNSITO // POLÍCIA ALERTADA')
      }
      this.sound.effect('crash')

      if (this.inVehicle) {
        const hit = this.player.registerHit('vehicle', 0.38)
        if (hit.hitRegistered) {
          if (hit.isNewExplosion) {
            this.sparks.emitExplosion(this.player.root.position)
            this.sound.effect('explosion')
            this.endRun('explosion')
            return
          } else if (this.player.isSmoking && hit.hits === this.player.smokeThreshold) {
            this.showToast('MOTOR FUMEGANDO // DANIFICADO')
          }
        }
      }
    }

    for (let index = this.abandonedCars.length - 1; index >= 0; index -= 1) {
      const abandoned = this.abandonedCars[index]
      const dist = abandoned.root.position.distanceTo(actorPosition)
      if (dist > 220 && abandoned !== this.monsterTruck) {
        abandoned.dispose()
        this.abandonedCars.splice(index, 1)
      } else {
        if (abandoned.isSmoking) {
          abandoned.smokeTimer += dt
          if (abandoned.smokeTimer >= 0.1) {
            abandoned.smokeTimer = 0
            this.sparks.emitSmoke(abandoned.getHoodPosition(), 0.8)
          }
        }
        if (Math.abs(abandoned.speed) > 0.05) {
          abandoned.speed *= Math.max(0, 1 - 2.5 * dt)
          abandoned.integrateMovement(dt)
        }
        if (this.inVehicle && this.player.collideWith(abandoned, dt)) {
          this.sparks.emit(this.player.root.position)
          this.sound.effect('crash')
          const hit = this.player.registerHit('vehicle', 0.38)
          const aHit = abandoned.registerHit('vehicle', 0.38)
          if (hit.isNewExplosion) {
            this.sparks.emitExplosion(this.player.root.position)
            this.sound.effect('explosion')
            this.endRun('explosion')
            return
          }
          if (aHit.isNewExplosion) {
            this.sparks.emitExplosion(abandoned.root.position)
            this.sound.effect('explosion')
          }
        }
      }
    }

    if (!this.inPlane && collided && this.elapsed - this.lastImpact > 0.8) {
      this.lastImpact = this.elapsed
      if (this.elapsed - this.lastPoliceCollision > 2.0 && this.wanted.level === 0) {
        this.addHeat(8)
        this.showToast('COLISÃO // A POLÍCIA FOI ALERTADA')
      }
      this.sound.effect('crash')
    }

    if (!this.inPlane && collided && this.inVehicle) {
      const hit = this.player.registerHit('building', 0.35)
      if (hit.hitRegistered) {
        if (hit.isNewExplosion) {
          this.sparks.emitExplosion(this.player.root.position)
          this.sound.effect('explosion')
          this.endRun('explosion')
          return
        } else if (this.player.isSmoking && hit.hits === this.player.smokeThreshold) {
          this.showToast('MOTOR FUMEGANDO // DANIFICADO')
        }
      }
    }

    if (this.inVehicle && this.player.isSmoking) {
      this.player.smokeTimer += dt
      if (this.player.smokeTimer >= 0.08) {
        this.player.smokeTimer = 0
        this.sparks.emitSmoke(this.player.getHoodPosition(), 1.3)
      }
    }

    if (pedestrianHits > 0) {
      if (this.inVehicle) {
        const oldLvl = this.wanted.level
        this.wanted.addLevels(pedestrianHits)
        if (this.wanted.level > oldLvl) {
          this.onLevelUp()
        }
      } else {
        this.addHeat(6 * pedestrianHits)
      }
      this.rewardXp(15 * pedestrianHits)
      this.sound.effect('crash')
      this.showToast(pedestrianHits > 1 ? `PEDESTRES ATROPELADOS // PROCURADO +${pedestrianHits} NÍVEIS! (+${15 * pedestrianHits} XP)` : 'PEDESTRE ATROPELADO // PROCURADO +1 NÍVEL! (+15 XP)')
    }

    const coins = this.city.collectAt(actorPosition.x, actorPosition.z)
    if (coins > 0) {
      const earned = Math.round(coins * 25 * this.tokenMultiplier)
      this.cash += earned
      localStorage.setItem(CASH_KEY, String(this.cash))
      this.rewardXp(12 * coins)
      this.sound.effect('coin')
      this.showToast(`FICHA RECOLHIDA +$${earned}${this.tokenMultiplier > 1 ? ' (FICHAS 2X)' : ''} (+${12 * coins} XP)`)
    }

    const oldLevel = this.wanted.level
    this.wanted.update(dt, actorSpeed)

    const pursuit = this.pursuit.update(dt, this.player, actorPosition, !this.inVehicle && !this.inPlane, actorSpeed)
    for (const point of pursuit.collisionPoints) this.sparks.emit(point)
    for (const pt of pursuit.explosions) {
      this.sparks.emitExplosion(pt)
      this.sound.effect('explosion')
      this.cash += Math.round(200 * this.tokenMultiplier)
      localStorage.setItem(CASH_KEY, String(this.cash))
      this.rewardXp(40)
      this.showToast('VIATURA DESTRUÍDA! +$200 (+40 XP)')

      // Rampage / Modo Fúria Progress
      if (this.rampageActive) {
        this.rampagePoliceDestroyed++
        this.rewardXp(25)
        this.updateRampageMissionUI()
        if (this.rampagePoliceDestroyed >= this.rampageTargetPolice && !this.rampageCompleted) {
          this.rampageCompleted = true
          this.rampageActive = false
          this.hasUrbanDestroyerTrophy = true
          localStorage.setItem('smash_trophy_urban', 'true')
          this.cash += 4000
          localStorage.setItem(CASH_KEY, String(this.cash))
          this.rewardXp(750)
          this.sound.effect('upgrade')
          this.showToast('🏆 RAMPAGE CONCLUÍDO! TROFÉU "DESTRUIDOR URBANO" +$4.000 +10.000 PTS (+750 XP)!')
          const justCompleted = this.missions.recordRampagePolice(15)
          for (const m of justCompleted) this.completeMission(m)
          this.updateHud()
          this.updateMissionCards()
        }
      }
    }
    for (const pt of pursuit.smokingPositions) {
      this.sparks.emitSmoke(pt, 0.9)
    }

    // ==========================================
    // RIO, BOIAR, NADAR & CRONÔMETRO DE FÔLEGO (30s)
    // ==========================================
    const playerCarInWater = this.inVehicle && this.city.isInWater(this.player.root.position.x, this.player.root.position.z)
    this.player.inWater = playerCarInWater

    if (playerCarInWater && this.inVehicle) {
      // Eject player palito to the side of the vehicle!
      const carPosition = this.player.root.position
      const rightX = Math.cos(this.player.yaw)
      const rightZ = -Math.sin(this.player.yaw)
      const exitOffset = 2.4 // Thrown slightly further out to the side
      const side = Math.random() < 0.5 ? -1 : 1
      const exitX = carPosition.x + rightX * exitOffset * side
      const exitZ = carPosition.z + rightZ * exitOffset * side

      this.player.setRiderVisible(false)
      this.character.setPosition(exitX, exitZ, this.player.yaw)
      this.character.root.visible = true
      this.inVehicle = false
      this.inPlane = false
      if (this.cameraMode === 'cockpit') this.cameraMode = 'chase'
      this.input.clear()
      this.updateVehicleButton()
      this.updateCameraButton()
      this.updateCamera(1)
      this.updateHud()

      this.sound.effect('crash') // sound cue for ejection
      this.showToast('EJEÇÃO AUTOMÁTICA // O VEÍCULO CAIU NA ÁGUA!')

      if (this.player.kind === 'fuel_tanker' && (this.tankerMissionStage === 'survive' || this.tankerMissionStage === 'deliver')) {
        this.tankerMissionStage = 'none'
        this.tankerMissionTimer = 60.0
        this.updateTankerMissionUI()
        this.showToast('MISSÃO FALHOU // CAMINHÃO CAIU NA ÁGUA!')
      }
    }

    const charInWater = !this.inVehicle && !this.inPlane && this.city.isInWater(this.character.root.position.x, this.character.root.position.z)
    const inWater = playerCarInWater || charInWater

    for (const car of this.traffic.getCars()) car.inWater = this.city.isInWater(car.root.position.x, car.root.position.z)
    for (const cop of this.pursuit.getCars()) cop.inWater = this.city.isInWater(cop.root.position.x, cop.root.position.z)

    if (inWater) {
      this.waterTimer = Math.max(0, this.waterTimer - dt)
      this.updateWaterTimerUI(true)
      if (this.waterTimer <= 0) {
        this.endRun('drowned')
        return
      }
    } else {
      if (this.waterTimer < 30.0) {
        this.waterTimer = 30.0
        this.updateWaterTimerUI(false)
      }
    }

    // ==========================================
    // DIMINUIR NÍVEL PROCURADO SEM ATROPELAR / SEM COLIDIR
    // ==========================================
    const hitPedestrian = pedestrianHits > 0
    const hitVehicle = (this.inVehicle && (pursuit.vehicleCollisions > 0 || traffic.playerCollisions > 0)) || pursuit.isColliding
    if (hitPedestrian || hitVehicle) {
      this.wantedCalmTimer = 0
    } else if (this.wanted.level > 0) {
      this.wantedCalmTimer += dt
      if (this.wantedCalmTimer >= 10.0) {
        this.wantedCalmTimer = 0
        const dropped = this.wanted.removeLevels(1)
        if (dropped) {
          this.sound.effect('coin')
          this.showToast('CALMARIA // STATUS PROCURADO DIMINUIU 1 NÍVEL!')
          this.updateHud()
        }
      }
    }

    // Previne que o carro do jogador ou viaturas penetrem dentro dos prédios
    if (this.inVehicle) {
      const wallRes = this.city.resolveCollision(this.player.root.position.x, this.player.root.position.z, 1.4)
      if (wallRes.collided) {
        this.player.root.position.x = wallRes.x
        this.player.root.position.z = wallRes.z
      }
    }
    for (const cop of this.pursuit.getCars()) {
      const copWall = this.city.resolveCollision(cop.root.position.x, cop.root.position.z, 1.3)
      if (copWall.collided) {
        cop.root.position.x = copWall.x
        cop.root.position.z = copWall.z
        cop.speed *= -0.2
      }
    }

    if (pursuit.vehicleCollisions > 0 || pursuit.isColliding) {
      this.lastPoliceCollision = this.elapsed
    }

    // ==========================================
    // NÍVEL 9 E 10: TANQUES E HELICÓPTEROS MILITARES
    // ==========================================
    const level = this.wanted.level

    if (level >= 9) {
      // 1. Spawning Tanques Militares (Nível 9 e 10)
      this.tankSpawnTimer -= dt
      const targetTanks = level >= 10 ? 3 : 2
      if (this.tanks.length < targetTanks && this.tankSpawnTimer <= 0) {
        const side = (Math.random() - 0.5) * 64
        const streetX = Math.round((actorPosition.x + side) / 48) * 48
        const tank = new Tank(this.scene, streetX, actorPosition.z + 75 + Math.random() * 35, 0)
        this.tanks.push(tank)
        this.tankSpawnTimer = 3.8
        this.showToast('ALERTA MÁXIMO // TANQUE DE GUERRA MOBILIZADO!')
      }

      // 2. Spawning Helicópteros de Ataque (Nível 9 e 10)
      this.heliSpawnTimer -= dt
      const targetHelis = level >= 10 ? 2 : 1
      if (this.helicopters.length < targetHelis && this.heliSpawnTimer <= 0) {
        const side = (Math.random() - 0.5) * 80
        const startAlt = this.inPlane ? this.plane.altitude + 15 : 22
        const heli = new Helicopter(this.scene, actorPosition.x + side, actorPosition.z + 85 + Math.random() * 40, startAlt)
        this.helicopters.push(heli)
        this.heliSpawnTimer = 4.2
        this.showToast('ALERTA AÉREO // HELICÓPTERO MILITAR NO ESPAÇO AÉREO!')
      }
    }

    // 3. Atualização e Combate dos Tanques
    for (let index = this.tanks.length - 1; index >= 0; index -= 1) {
      const tank = this.tanks[index]
      const dist = tank.root.position.distanceTo(actorPosition)

      if (dist > 280 || (tank.exploded && tank.hitCooldown <= 0)) {
        tank.dispose()
        this.tanks.splice(index, 1)
        continue
      }

      if (tank.isSmoking) {
        tank.smokeTimer += dt
        if (tank.smokeTimer >= 0.08) {
          tank.smokeTimer = 0
          this.sparks.emitSmoke(tank.getHoodPosition(), 1.6)
        }
      }

      if (!tank.exploded) {
        const tankFire = tank.update(dt, actorPosition, (x, z, r) => this.city.resolveCollision(x, z, r))
        if (tankFire.readyToFire) {
          this.projectiles.fire(tankFire.fireOrigin, tankFire.fireTarget, 'tank', 44)
          this.sound.effect('explosion')
          this.sparks.emitExplosion(tankFire.fireOrigin)
        }

        // Colisão com Carro do Jogador (Tanque tem 80 colisões de resistência)
        if (this.inVehicle && tank.collideWithCar(this.player)) {
          this.sound.effect('crash')
          this.sparks.emit(this.player.root.position)
          const hitTank = tank.registerHit('vehicle', 0.28)
          const hitPlayer = this.player.registerHit('vehicle', 0.38)

          if (hitTank.isNewExplosion) {
            this.sparks.emitExplosion(tank.root.position)
            this.sound.effect('explosion')
            this.cash += 1500
            localStorage.setItem(CASH_KEY, String(this.cash))
            this.showToast('TANQUE MILITAR DESTRUÍDO (80/80 IMPACTOS)! +$1.500')
          } else {
            this.showToast(`BLINDAGEM DO TANQUE: ${tank.maxHits - tank.hits}/${tank.maxHits} RESTANTES`)
          }

          if (hitPlayer.isNewExplosion) {
            this.sparks.emitExplosion(this.player.root.position)
            this.sound.effect('explosion')
            this.endRun('explosion')
            return
          }
        }

        // Colisão com Avião Bimotor
        if (this.inPlane) {
          const distToTank = this.plane.root.position.distanceTo(tank.root.position)
          if (distToTank < 3.8) {
            const hitTank = tank.registerHit('vehicle', 0.3)
            const hitPlane = this.plane.registerHit('vehicle', 0.4)
            this.sound.effect('crash')
            this.sparks.emit(this.plane.root.position)

            if (hitTank.isNewExplosion) {
              this.sparks.emitExplosion(tank.root.position)
              this.sound.effect('explosion')
              this.cash += 1500
              localStorage.setItem(CASH_KEY, String(this.cash))
              this.showToast('TANQUE DESTRUÍDO POR IMPACTO AÉREO! +$1.500')
            }

            if (hitPlane.isNewExplosion) {
              this.sparks.emitExplosion(this.plane.root.position)
              this.sound.effect('explosion')
              this.endRun('plane_explosion')
              return
            }
          }
        }
      }
    }

    // 4. Atualização e Combate dos Helicópteros
    for (let index = this.helicopters.length - 1; index >= 0; index -= 1) {
      const heli = this.helicopters[index]
      const dist = heli.root.position.distanceTo(actorPosition)

      if (dist > 300 || (heli.exploded && heli.hitCooldown <= 0)) {
        heli.dispose()
        this.helicopters.splice(index, 1)
        continue
      }

      if (heli.isSmoking) {
        heli.smokeTimer += dt
        if (heli.smokeTimer >= 0.08) {
          heli.smokeTimer = 0
          this.sparks.emitSmoke(heli.getEnginePosition(), 1.4)
        }
      }

      if (!heli.exploded) {
        const heliFire = heli.update(dt, actorPosition)
        if (heliFire.readyToFire) {
          this.projectiles.fire(heliFire.fireOrigin, heliFire.fireTarget, 'helicopter', 48)
          this.sound.effect('crash')
          this.sparks.emit(heliFire.fireOrigin)
        }

        // Colisão aérea com Avião
        if (this.inPlane) {
          const distToHeli = this.plane.root.position.distanceTo(heli.root.position)
          if (distToHeli < 4.6) {
            const hitHeli = heli.registerHit('collision', 0.35)
            const hitPlane = this.plane.registerHit('vehicle', 0.4)
            this.sound.effect('crash')
            this.sparks.emit(this.plane.root.position)

            if (hitHeli.isNewExplosion) {
              this.sparks.emitExplosion(heli.root.position)
              this.sound.effect('explosion')
              this.cash += 1000
              localStorage.setItem(CASH_KEY, String(this.cash))
              this.showToast('HELICÓPTERO MILITAR DESTRUÍDO NO AR! +$1.000')
            }

            if (hitPlane.isNewExplosion) {
              this.sparks.emitExplosion(this.plane.root.position)
              this.sound.effect('explosion')
              this.endRun('plane_explosion')
              return
            }
          }
        }
      }
    }

    // 5. Atualização de Projéteis Militares, Avião & King Kong
    const projHits = this.projectiles.update(
      dt,
      (x, y, z, r) => this.city.collides3D(x, y, z, r),
      this.inVehicle ? this.player.root.position : null,
      this.inPlane ? this.plane.root.position : null,
      !this.inVehicle && !this.inPlane ? this.character.root.position : null,
      (pos, radius) => this.kingKong.checkHit(pos, radius),
    )

    for (const pHit of projHits) {
      if (pHit.hitType === 'king_kong') {
        const hitRes = this.kingKong.registerHit()
        this.sparks.emitExplosion(pHit.position)
        this.sound.effect('roar')
        if (hitRes.defeated) {
          this.sparks.emitExplosion(hitRes.position)
          this.sound.effect('explosion')
          this.sound.effect('mission')
          this.kingKongMissionStage = 'completed'
          this.kingKongCompletedBannerTimer = 8.0
          if (pHit.source === 'blaster' || (this.inVehicle && this.player.kind === 'monster_truck')) {
            this.monsterMissionKongCompleted = true
            this.cash += 6000
            this.distance += 3500
            localStorage.setItem(CASH_KEY, String(this.cash))
            this.showToast('🏆 VITÓRIA ÉPICA! ROBÔ TRANSFORMERS DERRUBOU O KING KONG DO ARRANHA-CÉU! +$6.000 (+25.000 PTS)')
          } else {
            this.cash += 5000
            this.distance += 2500
            localStorage.setItem(CASH_KEY, String(this.cash))
            this.showToast('🏆 VITÓRIA ÉPICA! KING KONG DERRUBADO DO ARRANHA-CÉU! +$5.000 (+15.000 PTS)')
          }
        } else {
          if (pHit.source === 'blaster') {
            this.showToast(`💥 CANHÃO DO ROBÔ TRANSFORMERS ATINGIU O KING KONG! [${hitRes.remainingHp} / 50 HP]`)
          } else {
            this.showToast(`🎯 DISPARO AÉREO NO KING KONG! [${hitRes.remainingHp} / 50 HP]`)
          }
        }
        this.updateKingKongMissionUI()
        this.updateMonsterMissionUI()
      } else if (pHit.hitType === 'building') {
        this.sparks.emitExplosion(pHit.position)
        this.sound.effect('crash')
      } else if (pHit.hitType === 'player_car' && this.inVehicle) {
        this.sparks.emitExplosion(pHit.position)
        this.sound.effect('explosion')
        const carHit = this.player.registerHit('vehicle', 0.35)
        this.showToast('CARRO ATINGIDO POR DISPARO MILITAR!')
        if (carHit.isNewExplosion) {
          this.endRun('explosion')
          return
        }
      } else if (pHit.hitType === 'player_plane' && this.inPlane) {
        this.sparks.emitExplosion(pHit.position)
        this.sound.effect('explosion')
        const planeHit = this.plane.registerHit('vehicle', 0.35)
        this.showToast('AVIÃO BIMOTOR ATINGIDO POR DISPARO AÉREO!')
        if (planeHit.isNewExplosion) {
          this.endRun('plane_explosion')
          return
        }
      } else if (pHit.hitType === 'player_character' && !this.inVehicle && !this.inPlane) {
        this.sparks.emitExplosion(pHit.position)
        this.sound.effect('explosion')
        this.showToast('ATINGIDO POR DISPARO MILITAR!')
        this.endRun('explosion')
        return
      }
    }

    if (this.wanted.level > oldLevel) this.onLevelUp()
    if (!this.inPlane && pursuit.vehicleCollisions > 0) {
      this.sound.effect('crash')
      this.showToast(pursuit.vehicleCollisions > 1 ? 'BATIDA EM VIATURAS' : 'BATIDA COM VIATURA')

      if (this.inVehicle) {
        const hit = this.player.registerHit('vehicle', 0.38)
        if (hit.hitRegistered) {
          if (hit.isNewExplosion) {
            this.sparks.emitExplosion(this.player.root.position)
            this.sound.effect('explosion')
            this.endRun('explosion')
            return
          } else if (this.player.isSmoking && hit.hits === this.player.smokeThreshold) {
            this.showToast('MOTOR FUMEGANDO // DANIFICADO')
          }
        }
      }
    }
    if (pursuit.closeCalls > 0) {
      this.cash += pursuit.closeCalls * 12
      localStorage.setItem(CASH_KEY, String(this.cash))
      this.sound.effect('coin')
      this.showToast('QUASE // VIATURA ESCAPADA')
    }
    const event: MissionEvent = {
      distance: distanceDelta,
      coins,
      time: dt,
      wanted: this.wanted.level,
      closeCalls: pursuit.closeCalls,
      rings: this.inPlane ? this.plane.consecutiveRings : undefined,
    }
    const completed = this.missions.update(dt, event)
    for (const mission of completed) this.completeMission(mission)
    this.sound.update(this.inPlane ? this.plane.speed : this.inVehicle ? this.player.speed : 0, this.wanted.level)

    // Atualização das Missões do Caminhão Tanque
    this.updateTankerMission(dt)
    // Atualização da Missão do Ônibus (Transporte de Passageiros)
    this.updateBusMission(dt)
    // Atualização da Missão do King Kong & Avião Bimotor
    this.updateKingKongMission(dt, controls)
    // Atualização das Missões do Monster Truck Cyber & Robô Transformers
    this.updateMonsterMission(dt, controls)
    // Atualização da Missão do Caminhão Cegonha (Recolher Carros)
    this.updateHaulerMission(dt)
    // 1. Missão de Táxi / Corrida Maluca (GTA Vice City / San Andreas)
    this.updateTaxiMission(dt)
    // 2. Missão Carro-Bomba / Velocidade Máxima (GTA III Mike Lips Lunch)
    this.updateBombMission(dt)
    // 3. Modo Fúria / Rampage (GTA 2 / GTA Vice City)
    this.updateRampageMission(dt)

    if (!this.inPlane && pursuit.busted) this.endRun('busted')
    this.hudTimer += dt
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0
      this.updateHud()
      this.updateMissionCards()
      if (!this.inVehicle && !this.inPlane) this.updateVehicleButton()
    }
  }

  private addHeat(amount: number): void {
    const oldLevel = this.wanted.level
    this.wanted.addHeat(amount)
    if (this.wanted.level > oldLevel) this.onLevelUp()
  }

  private onLevelUp(): void {
    this.sound.effect('wanted')
    const level = this.wanted.level
    if (level === 10) {
      this.showToast('NÍVEL 10 // ALERTA MÁXIMO MILITAR! TANQUES E HELICÓPTEROS!')
    } else if (level === 9) {
      this.showToast('NÍVEL 9 // TANQUES E HELICÓPTEROS DE GUERRA ENTRARAM EM COMBATE!')
    } else if (level >= 7) {
      this.showToast(`NÍVEL ${level} // FORÇA TÁTICA AVANÇADA`)
    } else {
      this.showToast(`NÍVEL ${level} // POLÍCIA EM ALERTA`)
    }
    this.updateHud()
  }

  private completeMission(mission: MissionState): void {
    this.cash += mission.reward
    localStorage.setItem(CASH_KEY, String(this.cash))
    this.rewardXp(250)
    this.sound.effect('mission')
    this.showToast(`CONTRATO CUMPRIDO  +$${mission.reward} (+250 XP)`)
    this.updateHud()
  }

  private updateTankerMission(dt: number): void {
    if (this.tankerMissionStage === 'survive') {
      // Se o caminhão explodiu, a missão falha
      if (this.player.exploded) {
        this.tankerMissionStage = 'none'
        this.sound.effect('explosion')
        this.showToast('MISSÃO FALHOU // O CAMINHÃO TANQUE EXPLODIU!')
        this.updateTankerMissionUI()
        return
      }

      // O cronômetro conta de 60s até 0s enquanto o jogador estiver dirigindo o caminhão
      if (this.inVehicle && this.player.kind === 'fuel_tanker') {
        const prevSec = Math.ceil(this.tankerMissionTimer)
        this.tankerMissionTimer = Math.max(0, this.tankerMissionTimer - dt)
        const currSec = Math.ceil(this.tankerMissionTimer)

        if (currSec < prevSec && currSec <= 5 && currSec > 0) {
          this.sound.effect('coin')
        }

        if (this.tankerMissionTimer <= 0) {
          // Quando sobreviver aos 60s sem explodir, inicia a segunda missão!
          this.tankerMissionStage = 'deliver'
          this.cash += 500
          localStorage.setItem(CASH_KEY, String(this.cash))
          this.sound.effect('mission')
          this.sparks.emitExplosion(this.player.root.position)
          this.showToast('MISSÃO 1 CUMPRIDA! (+$500) // INICIANDO MISSÃO 2: LEVE O CAMINHÃO À GARAGEM!')
        }
      }
      this.updateTankerMissionUI()
    } else if (this.tankerMissionStage === 'deliver') {
      if (this.player.exploded) {
        this.tankerMissionStage = 'none'
        this.sound.effect('explosion')
        this.showToast('MISSÃO FALHOU // O CAMINHÃO TANQUE EXPLODIU ANTES DA ENTREGA!')
        this.updateTankerMissionUI()
        return
      }

      // Verifica se o caminhão tanque chegou à garagem indicada no mapa
      if (this.inVehicle && this.player.kind === 'fuel_tanker') {
        const garage = this.city.getFuelGarageInfo()
        const distToGarage = Math.hypot(
          this.player.root.position.x - garage.deliveryX,
          this.player.root.position.z - garage.deliveryZ,
        )

        if (distToGarage <= garage.deliveryRadius) {
          // Segunda missão termina e o jogador ganha pontuação e dinheiro!
          this.tankerMissionStage = 'completed'
          this.tankerCompletedBannerTimer = 7.0
          this.cash += 2500
          this.distance += 500
          localStorage.setItem(CASH_KEY, String(this.cash))
          this.sound.effect('mission')
          this.sparks.emitExplosion(this.player.root.position)
          this.showToast('MISSÃO 2 CUMPRIDA! CAMINHÃO ENTREGUE NA GARAGEM! +$2.500 (+5.000 PTS)')
          
          // Ejetar automaticamente o personagem palito de dentro do caminhão e posicioná-lo ao lado do caminhão
          this.player.speed = 0
          const carPos = this.player.root.position
          const rightX = Math.cos(this.player.yaw)
          const rightZ = -Math.sin(this.player.yaw)
          const exitOffset = 2.8
          const exitX = carPos.x + rightX * exitOffset
          const exitZ = carPos.z + rightZ * exitOffset
          this.player.setRiderVisible(false)
          this.character.setPosition(exitX, exitZ, this.player.yaw)
          this.character.root.visible = true
          this.inVehicle = false
          this.inPlane = false
          if (this.cameraMode === 'cockpit') this.cameraMode = 'chase'
          this.input.clear()
          this.updateVehicleButton()
          this.updateCameraButton()
          this.updateCamera(1)
          this.updateHud()
        }
      }
      this.updateTankerMissionUI()
    } else if (this.tankerMissionStage === 'completed') {
      if (this.tankerCompletedBannerTimer > 0) {
        this.tankerCompletedBannerTimer -= dt
        if (this.tankerCompletedBannerTimer <= 0) {
          this.tankerMissionStage = 'none'
        }
      }
      this.updateTankerMissionUI()
    } else {
      this.updateTankerMissionUI()
    }
  }

  private updateTankerMissionUI(): void {
    if (!this.tankerMissionPanel) return

    if (this.tankerMissionStage === 'survive') {
      this.tankerMissionPanel.classList.remove('hidden', 'stage-deliver', 'stage-completed')
      this.tankerMissionStageEl.textContent = 'MISSÃO 1 // 60s'
      this.tankerTimerLabelEl.textContent = 'CRONÔMETRO:'
      this.tankerTimerValEl.textContent = `${this.tankerMissionTimer.toFixed(1)}s`
      const percent = Math.max(0, Math.min(100, (this.tankerMissionTimer / 60.0) * 100))
      this.tankerTimerFillEl.style.width = `${percent}%`

      const remainingHits = Math.max(0, 4 - this.player.hits)
      this.tankerDurabilityEl.textContent = `RESISTÊNCIA: ${remainingHits} / 4 COLISÕES`

      if (!this.inVehicle || this.player.kind !== 'fuel_tanker') {
        this.tankerInstructionEl.textContent = '⚠ RETORNE AO CAMINHÃO TANQUE!'
        this.tankerInstructionEl.style.color = '#ff4438'
      } else {
        this.tankerInstructionEl.textContent = 'NÃO EXPLODA O CAMINHÃO!'
        this.tankerInstructionEl.style.color = '#ffb703'
      }
    } else if (this.tankerMissionStage === 'deliver') {
      this.tankerMissionPanel.classList.remove('hidden', 'stage-completed')
      this.tankerMissionPanel.classList.add('stage-deliver')
      this.tankerMissionStageEl.textContent = 'MISSÃO 2 // LEVE À GARAGEM'
      this.tankerTimerLabelEl.textContent = 'DISTÂNCIA ATÉ A GARAGEM:'

      const garage = this.city.getFuelGarageInfo()
      const carPos = this.inVehicle ? this.player.root.position : this.character.root.position
      const dist = Math.hypot(carPos.x - garage.deliveryX, carPos.z - garage.deliveryZ)
      this.tankerTimerValEl.textContent = `${Math.round(dist)} m`

      const distProgress = Math.max(0, Math.min(100, 100 - (dist / 350) * 100))
      this.tankerTimerFillEl.style.width = `${distProgress}%`

      const remainingHits = Math.max(0, 4 - this.player.hits)
      this.tankerDurabilityEl.textContent = `RESISTÊNCIA: ${remainingHits} / 4 COLISÕES`

      if (!this.inVehicle || this.player.kind !== 'fuel_tanker') {
        this.tankerInstructionEl.textContent = '⚠ RETORNE AO CAMINHÃO TANQUE!'
        this.tankerInstructionEl.style.color = '#ff4438'
      } else {
        this.tankerInstructionEl.textContent = 'SIGA O MARCADOR 🎯 NO MAPA / RADAR!'
        this.tankerInstructionEl.style.color = '#38bdf8'
      }
    } else if (this.tankerMissionStage === 'completed') {
      this.tankerMissionPanel.classList.remove('hidden', 'stage-deliver')
      this.tankerMissionPanel.classList.add('stage-completed')
      this.tankerMissionStageEl.textContent = '✓ MISSÃO CONCLUÍDA!'
      this.tankerTimerLabelEl.textContent = 'RECOMPENSA GANHA:'
      this.tankerTimerValEl.textContent = '+$2.500 (+5.000 PTS)'
      this.tankerTimerFillEl.style.width = '100%'
      this.tankerDurabilityEl.textContent = 'CAMINHÃO ENTREGUE INTACTO'
      this.tankerInstructionEl.textContent = 'GARAGEM DE COMBUSTÍVEL ABASTECIDA!'
      this.tankerInstructionEl.style.color = '#3ddc84'
    } else {
      this.tankerMissionPanel.classList.add('hidden')
    }
  }

  private updateBusMission(dt: number): void {
    const isPlayerInBus = this.inVehicle && this.player.kind === 'bus' && !this.player.exploded
    const busRes = this.busPassengers.update(dt, this.player.root.position, isPlayerInBus)

    if (busRes.collected) {
      this.sound.effect('coin')
      if (busRes.pos) this.sparks.emit(busRes.pos)
      this.cash += 200
      localStorage.setItem(CASH_KEY, String(this.cash))
      this.showToast(`PASSAGEIRO EMBARCADO! [${this.busPassengers.count}/${this.busPassengers.target}] +$200`)

      if (this.busPassengers.isCompleted && this.busMissionStage === 'active') {
        this.busMissionStage = 'completed'
        this.busCompletedBannerTimer = 7.0
        this.cash += 2000
        this.distance += 400
        localStorage.setItem(CASH_KEY, String(this.cash))
        this.sound.effect('mission')
        this.sparks.emitExplosion(this.player.root.position)
        this.showToast('MISSÃO DO ÔNIBUS CONCLUÍDA! 6 PASSAGEIROS EMBARCADOS! +$2.000 (+4.000 PTS)')
      }
    }

    if (this.busMissionStage === 'completed') {
      if (this.busCompletedBannerTimer > 0) {
        this.busCompletedBannerTimer -= dt
        if (this.busCompletedBannerTimer <= 0) {
          this.busMissionStage = 'none'
          this.busPassengers.clear()
        }
      }
    }

    this.updateBusMissionUI()
  }

  private updateBusMissionUI(): void {
    if (!this.busMissionPanel) return

    if (this.busMissionStage === 'active') {
      this.busMissionPanel.classList.remove('hidden', 'completed')
      this.busMissionStageEl.textContent = 'TRANSPORTE DE PASSAGEIROS'
      const count = this.busPassengers.count
      const target = this.busPassengers.target
      this.busCountValEl.textContent = `${count} / ${target}`

      const fillPercent = Math.min(100, (count / target) * 100)
      this.busTimerFillEl.style.width = `${fillPercent}%`

      const carPos = this.inVehicle ? this.player.root.position : this.character.root.position
      const nearestDist = this.busPassengers.getNearestPassengerDistance(carPos)

      if (nearestDist !== null) {
        this.busNearestDistEl.textContent = `PRÓXIMO PASSAGEIRO: ${Math.round(nearestDist)} m`
      } else {
        this.busNearestDistEl.textContent = 'TODOS EMBARCADOS!'
      }

      if (!this.inVehicle || this.player.kind !== 'bus') {
        this.busInstructionEl.textContent = '⚠ RETORNE AO ÔNIBUS!'
        this.busInstructionEl.style.color = '#ff4438'
      } else {
        this.busInstructionEl.textContent = 'PASSE POR CIMA DA PESSOA PARA EMBARCAR!'
        this.busInstructionEl.style.color = '#f7bf4a'
      }
    } else if (this.busMissionStage === 'completed') {
      this.busMissionPanel.classList.remove('hidden')
      this.busMissionPanel.classList.add('completed')
      this.busMissionStageEl.textContent = '✓ MISSÃO CONCLUÍDA!'
      this.busCountValEl.textContent = '6 / 6 EMBARCADOS'
      this.busTimerFillEl.style.width = '100%'
      this.busNearestDistEl.textContent = 'LINHA CONCLUÍDA'
      this.busInstructionEl.textContent = '+$2.000 E +4.000 PONTOS GANHOS!'
      this.busInstructionEl.style.color = '#3ddc84'
    } else {
      this.busMissionPanel.classList.add('hidden')
    }
  }

  private updateKingKongMission(dt: number, controls: DriveInput): void {
    if (this.inPlane) {
      const planePos = this.plane.root.position
      const distToKong = Math.hypot(
        planePos.x - this.kingKong.centerX,
        planePos.z - this.kingKong.centerZ,
      )

      // A missão inicia apenas quando o avião bimotor está a menos de 95 metros do prédio!
      if (this.kingKongMissionStage === 'none' && this.kingKong.alive) {
        if (distToKong <= 95) {
          this.kingKongMissionStage = 'active'
          this.sound.effect('mission')
          this.showToast('🚨 MISSÃO ATIVADA: DERRUBE O KING KONG NO TOPO DO ARRANHA-CÉU! [DISPARE: ESPAÇO / F / BOTÃO]')
        }
      }

      // A missão continua ativa mesmo que o avião bimotor se afaste do prédio.
      if (this.kingKongMissionStage === 'active') {
        if (this.planeShootCooldown > 0) {
          this.planeShootCooldown = Math.max(0, this.planeShootCooldown - dt)
        }
        if (controls.shoot && this.planeShootCooldown <= 0) {
          this.planeShootCooldown = 0.12
          this.firePlaneCannons()
        }
      }
    } else {
      // A missão do King Kong termina se o jogador sair do avião bimotor!
      if (this.kingKongMissionStage === 'active') {
        this.kingKongMissionStage = 'none'
        this.showToast('MISSÃO TERMINADA // VOCÊ SAIU DO AVIÃO BIMOTOR')
      }
      if (this.planeShootBtn && !this.planeShootBtn.classList.contains('hidden')) {
        this.planeShootBtn.classList.add('hidden')
      }
    }

    if (this.kingKongMissionStage === 'completed') {
      if (this.kingKongCompletedBannerTimer > 0) {
        this.kingKongCompletedBannerTimer -= dt
        if (this.kingKongCompletedBannerTimer <= 0) {
          this.kingKongMissionStage = 'none'
        }
      }
    }

    this.updateKingKongMissionUI()
  }

  private firePlaneCannons(): void {
    if (!this.inPlane) return

    const planePos = this.plane.root.position
    const yaw = this.plane.yaw
    const forwardX = -Math.sin(yaw)
    const forwardZ = -Math.cos(yaw)
    const forward = new THREE.Vector3(forwardX, Math.sin(this.plane.pitch || 0) * 0.4, forwardZ).normalize()
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize()

    // Canhões duplos montados nas asas do avião bimotor
    const leftWing = planePos.clone().addScaledVector(forward, 2.2).addScaledVector(right, -2.5)
    const rightWing = planePos.clone().addScaledVector(forward, 2.2).addScaledVector(right, 2.5)
    leftWing.y = this.plane.altitude + 0.85
    rightWing.y = this.plane.altitude + 0.85

    const targetLeft = leftWing.clone().addScaledVector(forward, 150)
    const targetRight = rightWing.clone().addScaledVector(forward, 150)

    this.projectiles.fire(leftWing, targetLeft, 'plane', 145)
    this.projectiles.fire(rightWing, targetRight, 'plane', 145)
    this.sparks.emit(leftWing)
    this.sparks.emit(rightWing)
    this.sound.effect('shoot')
  }

  private resolveFullCollision(x: number, z: number, radius: number, currentY = 0): { x: number; z: number; collided: boolean; normalX: number; normalZ: number } {
    const cityRes = this.city.resolveCollision(x, z, radius)
    let resolvedX = cityRes.x
    let resolvedZ = cityRes.z
    let collided = cityRes.collided
    let normalX = cityRes.normalX
    let normalZ = cityRes.normalZ

    const kongBounds = this.kingKong.getBounds()
    for (const box of kongBounds) {
      if (currentY + 1.2 < box.minY || currentY > box.maxY + 1.0) continue

      const clampedX = THREE.MathUtils.clamp(resolvedX, box.minX, box.maxX)
      const clampedZ = THREE.MathUtils.clamp(resolvedZ, box.minZ, box.maxZ)
      const dx = resolvedX - clampedX
      const dz = resolvedZ - clampedZ
      const distSq = dx * dx + dz * dz

      if (distSq < radius * radius) {
        collided = true
        const dist = Math.sqrt(distSq)
        if (dist > 0.0001) {
          const overlap = radius - dist
          const nx = dx / dist
          const nz = dz / dist
          resolvedX += nx * overlap
          resolvedZ += nz * overlap
          normalX = nx
          normalZ = nz
        } else {
          const leftDist = resolvedX - box.minX + radius
          const rightDist = box.maxX - resolvedX + radius
          const topDist = resolvedZ - box.minZ + radius
          const bottomDist = box.maxZ - resolvedZ + radius
          const minDist = Math.min(leftDist, rightDist, topDist, bottomDist)

          if (minDist === leftDist) {
            resolvedX = box.minX - radius
            normalX = -1
            normalZ = 0
          } else if (minDist === rightDist) {
            resolvedX = box.maxX + radius
            normalX = 1
            normalZ = 0
          } else if (minDist === topDist) {
            resolvedZ = box.minZ - radius
            normalX = 0
            normalZ = -1
          } else {
            resolvedZ = box.maxZ + radius
            normalX = 0
            normalZ = 1
          }
        }
      }
    }

    return { x: resolvedX, z: resolvedZ, collided, normalX, normalZ }
  }

  private updateKingKongMissionUI(): void {
    if (!this.kingKongMissionPanel) return

    if (this.kingKongMissionStage === 'active' || this.inPlane) {
      this.kingKongMissionPanel.classList.remove('hidden')
      if (this.inPlane) {
        this.planeShootBtn?.classList.remove('hidden')
      } else {
        this.planeShootBtn?.classList.add('hidden')
      }

      // Update Floating Rings Mission Progress in Airplane Panel
      const ringsPassed = Math.min(7, this.plane.consecutiveRings || 0)
      if (this.planeRingsValEl) {
        this.planeRingsValEl.textContent = `${ringsPassed} / 7`
      }
      if (this.planeRingsFillEl) {
        this.planeRingsFillEl.style.width = `${(ringsPassed / 7) * 100}%`
      }

      this.kingKongHpValEl.textContent = `${this.kingKong.hp} / ${this.kingKong.maxHp} HP`
      const percent = Math.max(0, Math.min(100, (this.kingKong.hp / this.kingKong.maxHp) * 100))
      this.kingKongTimerFillEl.style.width = `${percent}%`

      const planePos = this.inPlane ? this.plane.root.position : this.character.root.position
      const dist = Math.round(Math.hypot(planePos.x - this.kingKong.centerX, planePos.z - this.kingKong.centerZ))
      this.kingKongDistInfoEl.textContent = `DISTÂNCIA KONG: ${dist} m`

      if (this.inPlane) {
        this.kingKongInstructionEl.textContent = 'PASSE PELOS CÍRCULOS OU ATIRE NO KONG! [F]'
        this.kingKongInstructionEl.style.color = '#f59e0b'
      } else {
        this.kingKongInstructionEl.textContent = '⚠ RETORNE AO AVIÃO BIMOTOR!'
        this.kingKongInstructionEl.style.color = '#ff4438'
      }
    } else if (this.kingKongMissionStage === 'completed') {
      this.kingKongMissionPanel.classList.remove('hidden')
      this.planeShootBtn?.classList.add('hidden')
      this.kingKongMissionStageEl.textContent = '✓ MISSÃO CUMPRIDA!'
      this.kingKongHpValEl.textContent = '0 / 50 (DERROTADO)'
      this.kingKongTimerFillEl.style.width = '0%'
      this.kingKongDistInfoEl.textContent = 'RECOMPENSA: +$5.000'
      this.kingKongInstructionEl.textContent = 'KING KONG DERRUBADO DO PRÉDIO!'
      this.kingKongInstructionEl.style.color = '#3ddc84'
    } else {
      this.kingKongMissionPanel.classList.add('hidden')
      this.planeShootBtn?.classList.add('hidden')
    }
  }

  private checkMonsterCrushOnCars(): void {
    if (!this.inVehicle || this.player.kind !== 'monster_truck' || this.player.isRobotMode) return
    const mtPos = this.player.root.position
    const mtSpeed = Math.abs(this.player.speed)

    const checkCar = (car: Car) => {
      if (car === this.player || car.kind === 'monster_truck' || this.monsterCrushedCars.has(car)) return
      const dist = mtPos.distanceTo(car.root.position)
      if (dist < 4.9 && (mtSpeed > 0.8 || Math.abs(car.speed) > 0.8)) {
        this.monsterCrushedCars.add(car)
        this.monsterCrushCount += 1
        car.crush()
        this.sparks.emitExplosion(car.root.position)
        this.sound.effect('explosion')
        this.sound.effect('crash')
        this.player.climbLift = 0.88
        this.player.climbPitch = -0.24 * Math.sign(this.player.speed || 1)
        this.showToast(`💥 CARRO ESMAGADO PELO MONSTER TRUCK! [${Math.min(10, this.monsterCrushCount)} / 10]`)
        if (this.monsterCrushCount >= 10 && !this.monsterMissionCrushCompleted) {
          this.monsterMissionCrushCompleted = true
          this.sound.effect('mission')
          this.cash += 3500
          this.distance += 2000
          localStorage.setItem(CASH_KEY, String(this.cash))
          this.showToast('🏆 MISSÃO 1 CUMPRIDA: 10 CARROS ESMAGADOS PELO MONSTER TRUCK! +$3.500 (+12.000 PTS)')
        }
      }
    }

    for (const car of this.traffic.getCars()) checkCar(car)
    for (const car of this.pursuit.getCars()) checkCar(car)
    for (const car of this.abandonedCars) checkCar(car)
  }

  private updateMonsterMission(dt: number, controls: DriveInput): void {
    if (this.inVehicle && this.player.kind === 'monster_truck') {
      this.checkMonsterCrushOnCars()

      if (this.monsterBlasterCooldown > 0) {
        this.monsterBlasterCooldown = Math.max(0, this.monsterBlasterCooldown - dt)
      }

      if (this.player.isRobotMode) {
        // Thruster exhaust particles when rocket propulsion is active
        if (this.player.isThrusting) {
          for (const pos of this.player.getThrusterWorldPositions()) {
            this.sparks.emit(pos)
          }
        }

        // Manual firing and sword attack when player triggers shoot control (F, Enter, or Shoot Button)
        if (controls.shoot && this.monsterBlasterCooldown <= 0) {
          this.fireMonsterBlaster()
          this.checkSwordSlashOnCars()
        }
      }
    }
    this.updateMonsterMissionUI()
  }

  private checkSwordSlashOnCars(): void {
    if (!this.inVehicle || this.player.kind !== 'monster_truck' || !this.player.isRobotMode) return
    const slashed = this.player.performSwordSlash()
    if (!slashed) return

    this.sound.effect('crash')
    const robotPos = this.player.root.position
    const forwardX = -Math.sin(this.player.yaw)
    const forwardZ = -Math.cos(this.player.yaw)

    const checkCar = (car: Car) => {
      if (car === this.player || car.kind === 'monster_truck' || this.monsterCrushedCars.has(car)) return
      const carPos = car.root.position
      const dx = carPos.x - robotPos.x
      const dz = carPos.z - robotPos.z
      const dist = Math.hypot(dx, dz)

      if (dist < 10.5) {
        const dot = (dx * forwardX + dz * forwardZ) / (dist || 1)
        if (dot > -0.3) {
          this.monsterCrushedCars.add(car)
          this.monsterCrushCount += 1
          car.crush()
          this.sparks.emitExplosion(car.root.position)
          for (let i = 0; i < 4; i++) {
            this.sparks.emit(car.root.position)
          }
          this.sound.effect('explosion')
          this.sound.effect('crash')

          this.rewardXp(35)
          this.cash += 150
          localStorage.setItem(CASH_KEY, String(this.cash))
          this.updateHud()
          this.updateShopCashDisplay()

          this.showToast('⚔️ CARRO CORTADO COM A ESPADA TRANSFORMERS! (+35 XP / +$150)')
          if (this.monsterCrushCount >= 10 && !this.monsterMissionCrushCompleted) {
            this.monsterMissionCrushCompleted = true
            this.sound.effect('mission')
            this.cash += 3500
            this.distance += 2000
            localStorage.setItem(CASH_KEY, String(this.cash))
            this.showToast('🏆 MISSÃO 1 CUMPRIDA: 10 CARROS DESTRUÍDOS COM A ESPADA/ESMAGADOS! +$3.500 (+12.000 PTS)')
          }
        }
      }
    }

    for (const car of this.traffic.getCars()) checkCar(car)
    for (const car of this.pursuit.getCars()) checkCar(car)
    for (const car of this.abandonedCars) checkCar(car)
  }

  private toggleMonsterTransformation(): void {
    if (!this.inVehicle || this.player.kind !== 'monster_truck') return
    const isRobot = this.player.toggleRobotMode()
    this.sound.effect('transform')
    this.sparks.emitExplosion(this.player.root.position)
    if (isRobot) {
      this.showToast('🤖 TRANSFORMAÇÃO CONCLUÍDA: ROBÔ TRANSFORMERS! USE A ESPADA REGENERATIVA (F) PARA DESTRUIR CARROS E O CANHÃO NO KING KONG!')
    } else {
      this.showToast('🛻 MODO MONSTER TRUCK ATIVADO! ACELERE E ESMAGUE 10 CARROS COM AS RODAS GIGANTES!')
    }
    this.updateVehicleButton()
    this.updateMonsterMissionUI()
  }

  private fireMonsterBlaster(): void {
    if (!this.inVehicle || this.player.kind !== 'monster_truck' || !this.player.isRobotMode) return
    if (this.monsterBlasterCooldown > 0) return
    this.monsterBlasterCooldown = 0.22

    const muzzlePos = this.player.getBlasterMuzzleWorldPosition()
    const kongHitPos = this.kingKong.kongHitCenter.clone()

    const dx = kongHitPos.x - muzzlePos.x
    const dz = kongHitPos.z - muzzlePos.z
    const distToKong = Math.hypot(dx, dz)

    const forwardX = -Math.sin(this.player.yaw)
    const forwardZ = -Math.cos(this.player.yaw)

    const toKongX = dx / (distToKong || 1)
    const toKongZ = dz / (distToKong || 1)
    const dotFacing = forwardX * toKongX + forwardZ * toKongZ

    let target: THREE.Vector3
    if (this.kingKong.alive && distToKong < 230 && dotFacing > 0.25) {
      target = kongHitPos
    } else {
      target = new THREE.Vector3(
        muzzlePos.x + forwardX * 120,
        muzzlePos.y,
        muzzlePos.z + forwardZ * 120,
      )
    }

    this.projectiles.fire(muzzlePos, target, 'blaster', 185)
    this.sparks.emit(muzzlePos)
    this.sound.effect('laser')
  }

  private updateMonsterMissionUI(): void {
    if (!this.monsterMissionPanel) return

    const inMonsterTruck = this.inVehicle && this.player.kind === 'monster_truck'

    if (inMonsterTruck) {
      this.monsterMissionPanel.classList.remove('hidden')
      this.monsterTransformBtn?.classList.remove('hidden')

      if (this.player.isRobotMode) {
        this.monsterShootBtn?.classList.remove('hidden')
        this.monsterThrustBtn?.classList.remove('hidden')
        if (this.monsterTransformBtn) this.monsterTransformBtn.textContent = '🚚 MODO MONSTER · T'
        if (this.monsterPanelTransformBtn) this.monsterPanelTransformBtn.textContent = '🚚 CAMINHÃO [T]'
        this.monsterModeLabel.textContent = 'ROBÔ TRANSFORMERS'
        this.monsterModeLabel.classList.add('robot')
        this.monsterInstructionEl.textContent = '🚀 PROPULSÃO [ESPAÇO] | 💥 ATIRAR [F / BOTÃO]'
        this.monsterInstructionEl.style.color = '#38bdf8'
      } else {
        this.monsterShootBtn?.classList.add('hidden')
        this.monsterThrustBtn?.classList.add('hidden')
        if (this.monsterTransformBtn) this.monsterTransformBtn.textContent = '🤖 TRANSFORMAR · T'
        if (this.monsterPanelTransformBtn) this.monsterPanelTransformBtn.textContent = '🤖 TRANSFORMAR [T]'
        this.monsterModeLabel.textContent = 'MODO 4X4 (RODAS GIGANTES)'
        this.monsterModeLabel.classList.remove('robot')
        this.monsterInstructionEl.textContent = 'PASSE POR CIMA DOS CARROS! [T] TRANSFORME EM ROBÔ'
        this.monsterInstructionEl.style.color = '#facc15'
      }

      const crushCount = Math.min(10, this.monsterCrushCount)
      this.monsterCrushValEl.textContent = this.monsterMissionCrushCompleted
        ? '✓ 10 / 10 (CUMPRIDA!)'
        : `${crushCount} / 10`
      this.monsterCrushFillEl.style.width = `${(crushCount / 10) * 100}%`

      const kongHp = this.kingKong.hp
      this.monsterKongValEl.textContent = this.monsterMissionKongCompleted || this.kingKong.hp <= 0
        ? '✓ DERROTADO! (CUMPRIDA!)'
        : `${kongHp} / ${this.kingKong.maxHp} HP`
      this.monsterKongFillEl.style.width = `${Math.max(0, (kongHp / this.kingKong.maxHp) * 100)}%`

      const mtPos = this.player.root.position
      const distToKong = Math.round(Math.hypot(mtPos.x - this.kingKong.centerX, mtPos.z - this.kingKong.centerZ))
      this.monsterDistInfoEl.textContent = `DISTÂNCIA DO KONG: ${distToKong} m`
    } else {
      this.monsterMissionPanel.classList.add('hidden')
      this.monsterTransformBtn?.classList.add('hidden')
      this.monsterThrustBtn?.classList.add('hidden')
      this.monsterShootBtn?.classList.add('hidden')
    }
  }

  private updateWaterTimerUI(visible: boolean): void {
    if (!this.waterTimerPanel) return
    if (!visible) {
      this.waterTimerPanel.classList.add('hidden')
      return
    }
    this.waterTimerPanel.classList.remove('hidden')
    this.waterTimerValEl.textContent = `${this.waterTimer.toFixed(1)}s`
    const percent = Math.max(0, Math.min(100, (this.waterTimer / 30.0) * 100))
    this.waterTimerFillEl.style.width = `${percent}%`
    if (percent <= 25) {
      this.waterTimerFillEl.className = 'water-timer-fill critical'
    } else if (percent <= 50) {
      this.waterTimerFillEl.className = 'water-timer-fill warning'
    } else {
      this.waterTimerFillEl.className = 'water-timer-fill'
    }
  }

  private endRun(reason: 'busted' | 'explosion' | 'plane_explosion' | 'drowned' = 'busted'): void {
    this.running = false
    this.ended = true
    this.paused = false
    this.cancelAutoApproach(null)
    this.updateWaterTimerUI(false)
    this.pauseOverlay.classList.add('hidden')
    if (this.pauseButton) {
      this.pauseButton.textContent = '❚❚'
    }
    this.input.clear()
    this.updateVehicleButton()
    const score = Math.floor(this.distance + this.elapsed * 11 + this.wanted.level * 50)
    this.bestScore = Math.max(this.bestScore, score)
    localStorage.setItem(BEST_KEY, String(this.bestScore))

    const currentRunTime = this.elapsed
    this.bestTime = Math.max(this.bestTime, currentRunTime)
    localStorage.setItem(BEST_TIME_KEY, String(this.bestTime))

    const finalScoreEl = document.querySelector<HTMLElement>('#final-score')
    if (finalScoreEl) finalScoreEl.textContent = score.toLocaleString('pt-BR')
    const bestScoreEl = document.querySelector<HTMLElement>('#best-score')
    if (bestScoreEl) bestScoreEl.textContent = this.bestScore.toLocaleString('pt-BR')

    const finalTimeEl = document.querySelector<HTMLElement>('#final-time')
    if (finalTimeEl) finalTimeEl.textContent = this.formatTime(currentRunTime)
    const bestTimeEl = document.querySelector<HTMLElement>('#best-time')
    if (bestTimeEl) bestTimeEl.textContent = this.formatTime(this.bestTime)

    // Save progression via users.ts if authenticated
    const currentUser = usersDB.getCurrentUser()
    if (!currentUser.isGuest) {
      usersDB.updateStats({
        cash: this.cash,
        highScore: Math.max(currentUser.highScore, score),
        totalPlayTime: currentUser.totalPlayTime + Math.floor(currentRunTime),
        completedMissions: this.missions.completed.map((m) => m.id),
      })
      void usersDB.syncPendingChanges()
    }

    if (reason === 'drowned') {
      document.querySelector<HTMLElement>('#end-summary')!.textContent = 'Você permaneceu mais de 30 segundos dentro da água no rio sem retornar à terra firme.'
      document.querySelector<HTMLElement>('#end-title')!.innerHTML = 'AFOGADO<br><em>NO RIO.</em>'
    } else if (reason === 'plane_explosion') {
      document.querySelector<HTMLElement>('#end-summary')!.textContent = `Seu avião bimotor sofreu danos catastróficos e explodiu após ${this.plane.maxHits} batidas com prédios. Círculos atravessados: ${this.plane.consecutiveRings}/7.`
      document.querySelector<HTMLElement>('#end-title')!.innerHTML = 'AVIÃO<br><em>EXPLODIU.</em>'
    } else if (reason === 'explosion') {
      const isTanker = this.player.kind === 'fuel_tanker'
      document.querySelector<HTMLElement>('#end-summary')!.textContent = isTanker
        ? `O caminhão tanque de combustível explodiu após 4 colisões com veículos ou prédios. Você percorreu ${Math.floor(this.distance)} m.`
        : `Seu veículo atingiu danos críticos e explodiu após ${this.player.maxHits} batidas. Você percorreu ${Math.floor(this.distance)} m e resistiu por ${this.formatTime(this.elapsed)}.`
      document.querySelector<HTMLElement>('#end-title')!.innerHTML = isTanker ? 'CAMINHÃO TANQUE<br><em>EXPLODIU!</em>' : 'VEÍCULO<br><em>EXPLODIU.</em>'
    } else {
      document.querySelector<HTMLElement>('#end-summary')!.textContent = `Você percorreu ${Math.floor(this.distance)} m, resistiu por ${this.formatTime(this.elapsed)} e chegou ao nível ${this.wanted.level} de procurado.`
      document.querySelector<HTMLElement>('#end-title')!.innerHTML = this.wanted.level >= 8 ? 'CAOS<br><em>NA CIDADE.</em>' : 'VOCÊ FOI<br><em>ALCANÇADO.</em>'
    }
    this.tankerMissionPanel.classList.add('hidden')
    this.endOverlay.classList.remove('hidden')
    this.updateHud()
  }

  private togglePause(): void {
    if (!this.running || this.ended) return
    this.setPaused(!this.paused)
  }

  private setPaused(paused: boolean): void {
    if (!this.running || this.ended || this.paused === paused) return
    this.paused = paused
    this.input.clear()
    if (this.pauseButton) {
      this.pauseButton.textContent = this.paused ? '▶' : '❚❚'
      this.pauseButton.setAttribute('aria-label', this.paused ? 'Continuar corrida' : 'Pausar corrida')
    }

    if (this.paused) {
      if (this.pauseDistance) this.pauseDistance.textContent = `${Math.floor(this.distance).toLocaleString('pt-BR')} m`
      if (this.pauseTime) this.pauseTime.textContent = this.formatTime(this.elapsed)
      if (this.pauseWanted) this.pauseWanted.textContent = `NÍVEL ${this.wanted.level}`
      this.pauseOverlay.classList.remove('hidden')
      this.sound.update(0, 0)
    } else {
      this.pauseOverlay.classList.add('hidden')
      this.lastFrame = performance.now()
    }
  }

  private toggleVehicle(): void {
    if (!this.running || this.paused) return
    if (this.inPlane) {
      this.exitPlane()
    } else if (this.inVehicle) {
      this.exitVehicle()
    } else {
      const charPos = this.character.root.position
      const distToPlane = charPos.distanceTo(this.plane.root.position)
      if (distToPlane <= 6.5 && !this.plane.exploded) {
        this.enterPlane()
      } else {
        this.enterVehicle()
      }
    }
  }

  private enterPlane(): void {
    if (this.plane.exploded) {
      this.showToast('AVIÃO DESTRUÍDO // IMPOSSÍVEL PILOTAR')
      return
    }

    this.character.root.visible = false
    this.inVehicle = false
    this.inPlane = true
    this.plane.startBoarding()
    this.sound.effect('takeoff')
    this.input.clear()
    this.updateVehicleButton()
    this.updateCameraButton()
    this.updateCamera(1)
    this.updateHud()
    this.showToast('A BORDO DO BIMOTOR // TAXIANDO NA PISTA... DECOLAGEM EM 3s!')
  }

  private exitPlane(): void {
    if (this.plane.altitude > 4.2 && !this.plane.exploded) {
      this.showToast('MUITO ALTO PARA SAIR // APROXIME-SE DO SOLO')
      return
    }

    const pos = this.plane.root.position
    const rightX = Math.cos(this.plane.yaw)
    const rightZ = -Math.sin(this.plane.yaw)
    const exitX = pos.x + rightX * 3.6
    const exitZ = pos.z + rightZ * 3.6

    this.character.setPosition(exitX, exitZ, this.plane.yaw)
    this.character.root.visible = true
    this.inPlane = false
    this.inVehicle = false
    this.plane.state = 'idle'
    this.plane.speed = 0
    this.input.clear()
    this.updateVehicleButton()
    this.updateCameraButton()
    this.updateCamera(1)
    this.updateHud()
    this.showToast('A PÉ // VOCÊ SAIU DO AVIÃO BIMOTOR')
  }

  private exitVehicle(): void {
    const carPosition = this.player.root.position
    const rightX = Math.cos(this.player.yaw)
    const rightZ = -Math.sin(this.player.yaw)
    const exitOffset = 1.8
    const candidates = [-1, 1].map((side) => ({
      x: carPosition.x + rightX * exitOffset * side,
      z: carPosition.z + rightZ * exitOffset * side,
    }))
    const exitPosition = candidates.find((candidate) => !this.city.collides(candidate.x, candidate.z, 0.34))
    if (!exitPosition) {
      this.showToast('SEM ESPAÇO PARA SAIR DO VEÍCULO')
      return
    }

    const carX = carPosition.x
    const carZ = carPosition.z
    const carYaw = this.player.yaw
    this.player.setRiderVisible(false)
    this.character.setPosition(exitPosition.x, exitPosition.z, carYaw)
    this.character.root.visible = true
    this.player.setPosition(carX, carZ, carYaw)
    this.player.root.visible = true
    this.inVehicle = false
    this.inPlane = false
    if (this.cameraMode === 'cockpit') this.cameraMode = 'chase'
    this.input.clear()
    this.updateVehicleButton()
    this.updateCameraButton()
    this.updateCamera(1)
    if (this.player.kind === 'fuel_tanker' && (this.tankerMissionStage === 'survive' || this.tankerMissionStage === 'deliver')) {
      this.tankerMissionStage = 'none'
      this.tankerMissionTimer = 60.0
      this.updateTankerMissionUI()
      this.showToast('MISSÃO TERMINADA // VOCÊ SAIU DO CAMINHÃO COM CARGA INFLAMÁVEL!')
    } else if (this.busMissionStage === 'active') {
      this.showToast('A PÉ // RETORNE AO ÔNIBUS PARA CONTINUAR A EMBARCAR OS PASSAGEIROS!')
      this.updateBusMissionUI()
    } else if (this.player.kind === 'monster_truck') {
      this.updateMonsterMissionUI()
      this.showToast('A PÉ // VOCÊ SAIU DO MONSTER TRUCK')
    } else if (this.player.kind === 'car_hauler') {
      this.showToast('A PÉ // RETORNE AO CAMINHÃO CEGONHA PARA RECOLHER OS CARROS!')
      this.updateHaulerMissionUI()
    } else if (this.player.kind === 'taxi') {
      this.showToast('A PÉ // VOCÊ SAIU DO TÁXI')
      this.updateTaxiMissionUI()
    } else if (this.player.kind === 'bomb_car') {
      if (this.bombMissionActive) {
        this.player.explode()
        this.showToast('💥 BOOM! VOCÊ ABANDONOU O CARRO-BOMBA COM A BOMBA ARMADA!')
        this.endRun('explosion')
      }
      this.updateBombMissionUI()
    } else {
      this.showToast('A PÉ // ENTRE EM QUALQUER CARRO OU NO AVIÃO · E')
    }
  }

  private findAnyNearbyCar(maxDistance = 4.2): { car: Car; distance: number; source: 'current' | 'abandoned' | 'traffic' | 'police' } | null {
    const charPos = this.character.root.position
    const candidates: { car: Car; distance: number; source: 'current' | 'abandoned' | 'traffic' | 'police' }[] = []

    candidates.push({
      car: this.player,
      distance: charPos.distanceTo(this.player.root.position),
      source: 'current',
    })

    for (const car of this.abandonedCars) {
      candidates.push({
        car,
        distance: charPos.distanceTo(car.root.position),
        source: 'abandoned',
      })
    }

    for (const car of this.traffic.getCars()) {
      candidates.push({
        car,
        distance: charPos.distanceTo(car.root.position),
        source: 'traffic',
      })
    }

    for (const car of this.pursuit.getCars()) {
      candidates.push({
        car,
        distance: charPos.distanceTo(car.root.position),
        source: 'police',
      })
    }

    candidates.sort((a, b) => a.distance - b.distance)
    if (candidates.length > 0 && candidates[0].distance <= maxDistance) {
      return candidates[0]
    }
    return null
  }

  private cancelAutoApproach(message: string | null = 'ENTRADA AUTOMÁTICA CANCELADA'): void {
    this.autoApproachCar = null
    this.autoApproachTimer = 0
    if (this.cancelAutoEnterBtn) {
      this.cancelAutoEnterBtn.classList.add('hidden')
    }
    if (this.character) {
      this.character.speed = 0
    }
    if (message) {
      this.showToast(message)
    }
  }

  private enterVehicle(): void {
    if (this.autoApproachCar) {
      this.cancelAutoApproach('ENTRADA AUTOMÁTICA CANCELADA')
      return
    }

    const immediateTarget = this.findAnyNearbyCar(2.4)
    if (immediateTarget && !immediateTarget.car.exploded) {
      this.boardVehicle(immediateTarget.car, immediateTarget.source)
      return
    }

    const actionTarget = this.findAnyNearbyCar(18.0)
    if (!actionTarget) {
      this.showToast('NENHUM VEÍCULO NO RAIO DE AÇÃO PARA ENTRAR')
      return
    }

    if (actionTarget.car.exploded) {
      this.showToast('VEÍCULO DESTRUÍDO // IMPOSSÍVEL DIRIGIR')
      return
    }

    this.autoApproachCar = actionTarget.car
    this.autoApproachTimer = 10.0
    if (this.cancelAutoEnterBtn) {
      this.cancelAutoEnterBtn.classList.remove('hidden')
      this.cancelAutoEnterBtn.textContent = 'CANCELAR ENTRADA (10s)'
    }
    this.showToast('ANDANDO ATÉ O VEÍCULO... (CLIQUE EM CANCELAR SE DESEJAR)')
  }

  private boardVehicle(chosenCar: Car, source?: 'current' | 'abandoned' | 'traffic' | 'police'): void {
    if (chosenCar.exploded) {
      this.showToast('VEÍCULO DESTRUÍDO // IMPOSSÍVEL DIRIGIR')
      return
    }

    const isNewCar = chosenCar !== this.player

    if (isNewCar) {
      if (source === 'traffic') {
        this.traffic.removeCar(chosenCar)
      } else if (source === 'police') {
        this.pursuit.removeCar(chosenCar)
      } else if (source === 'abandoned') {
        const idx = this.abandonedCars.indexOf(chosenCar)
        if (idx !== -1) this.abandonedCars.splice(idx, 1)
      } else {
        this.traffic.removeCar(chosenCar)
        this.pursuit.removeCar(chosenCar)
        const idx = this.abandonedCars.indexOf(chosenCar)
        if (idx !== -1) this.abandonedCars.splice(idx, 1)
      }

      this.player.setRiderVisible(false)
      this.player.setPlayerControlled(false)
      this.player.speed = 0
      this.abandonedCars.push(this.player)

      this.player = chosenCar
      this.player.setPlayerControlled(true)
    }

    this.player.setRiderVisible(true)
    const position = this.character.root.position
    this.character.setPosition(position.x, position.z, this.player.yaw)
    this.character.root.visible = false
    this.player.setPosition(this.player.root.position.x, this.player.root.position.z, this.player.yaw)
    this.inVehicle = true
    this.inPlane = false
    this.input.clear()
    this.updateVehicleButton()
    this.updateCameraButton()
    this.updateCamera(1)
    this.updateHud()

    const vehicleName = this.player.police
      ? 'VIATURA POLICIAL'
      : this.player.kind === 'fuel_tanker'
        ? 'CAMINHÃO TANQUE DE COMBUSTÍVEL'
        : this.player.kind === 'car_hauler'
          ? 'CAMINHÃO CEGONHA COM RAMPA'
        : this.player.kind === 'taxi'
          ? 'TÁXI AMARELO'
        : this.player.kind === 'bomb_car'
          ? 'ESPORTIVO COM CARRO-BOMBA'
        : this.player.kind === 'monster_truck'
          ? 'MONSTER TRUCK CYBER 4X4'
          : this.player.kind === 'truck'
            ? 'CAMINHÃO'
            : this.player.kind === 'bus'
              ? 'ÔNIBUS'
              : this.player.kind === 'pickup'
                ? 'PICAPE'
                : this.player.kind === 'suv'
                  ? 'SUV'
                  : this.player.kind === 'bicycle'
                    ? 'BICICLETA'
                    : 'VEÍCULO'

    this.showToast(`AO VOLANTE // ${vehicleName} ASSUMIDO · E PARA SAIR`)

    if (this.player.kind === 'taxi') {
      this.initTaxiMission()
      this.updateTaxiMissionUI()
      this.showToast('🚕 TÁXI AMARELO // PARE NA CALÇADA PARA EMBARCAR PASSAGEIROS E FAÇA MANOBRAS RADICAIS!')
    }

    if (this.player.kind === 'bomb_car') {
      if (!this.bombMissionCompleted) {
        this.bombMissionActive = true
        this.bombMissionSurvived = 0
        this.bombGraceTimer = 3.0
        this.sound.effect('takeoff')
        this.showToast('💣 ALERTA: CARRO-BOMBA ATIVADO! MANTENHA A VELOCIDADE ACIMA DE 75 KM/H!')
      }
      this.updateBombMissionUI()
    }

    if (this.player.kind === 'monster_truck') {
      this.updateMonsterMissionUI()
      this.showToast('🛻 MONSTER TRUCK ASSUMIDO! MISSÕES: 1. ESMAGUE 10 CARROS | 2. TRANSFORME EM ROBÔ [T] E ATIRE NO KING KONG!')
    }

    if (this.player.kind === 'fuel_tanker') {
      if (this.tankerMissionStage === 'none') {
        this.tankerMissionStage = 'survive'
        this.tankerMissionTimer = 60.0
        this.sound.effect('mission')
        this.showToast('MISSÃO 1 INICIADA: TRANSPORTE INFLAMÁVEL // SOBREVIVA 60s SEM EXPLODIR O CAMINHÃO!')
      } else if (this.tankerMissionStage === 'survive') {
        this.showToast(`MISSÃO 1 RETOMADA // SOBREVIVA MAIS ${Math.ceil(this.tankerMissionTimer)}s!`)
      } else if (this.tankerMissionStage === 'deliver') {
        this.showToast('MISSÃO 2 EM ANDAMENTO // LEVE O CAMINHÃO ATÉ A GARAGEM INDICADA NO MAPA!')
      }
      this.updateTankerMissionUI()
    }

    if (this.player.kind === 'bus') {
      if (this.busMissionStage === 'none') {
        this.busMissionStage = 'active'
        this.busPassengers.spawnPassengersAround(this.player.root.position)
        this.sound.effect('mission')
        this.showToast('MISSÃO DO ÔNIBUS INICIADA: EMBARQUE 6 PASSAGEIROS PELA CIDADE!')
      } else if (this.busMissionStage === 'active') {
        this.showToast(`MISSÃO DO ÔNIBUS EM ANDAMENTO // EMBARQUE OS PASSAGEIROS RESTANTES [${this.busPassengers.count}/6]!`)
      }
      this.updateBusMissionUI()
    }

    if (this.player.kind === 'car_hauler') {
      if (this.haulerMissionStage === 'none') {
        this.haulerMissionStage = 'active'
        this.haulerCollectedCount = 0
        this.sound.effect('mission')
        this.showToast('🚚 MISSÃO DA CEGONHA INICIADA: RECOLHA 5 CARROS PARADOS PELA CIDADE!')
      } else if (this.haulerMissionStage === 'active') {
        this.showToast(`MISSÃO DA CEGONHA EM ANDAMENTO // RECOLHA OS CARROS RESTANTES [${this.haulerCollectedCount}/5]!`)
      }
      this.updateHaulerMissionUI()
    }
  }

  private updateVehicleButton(): void {
    this.vehicleButton.classList.toggle('hidden', !this.running)
    if (this.inPlane) {
      this.vehicleButton.textContent = this.plane.altitude > 4.2 ? 'PILOTANDO BIMOTOR ✈' : 'SAIR DO AVIÃO · E'
      this.vehicleButton.setAttribute('aria-label', 'Sair do avião (E)')
    } else if (this.inVehicle) {
      if (this.player.kind === 'monster_truck') {
        this.vehicleButton.textContent = this.player.isRobotMode ? 'SAIR DO ROBÔ · E' : 'SAIR DO MONSTER TRUCK · E'
        this.vehicleButton.setAttribute('aria-label', 'Sair do monster truck (E)')
      } else {
        this.vehicleButton.textContent = 'SAIR DO CARRO · E'
        this.vehicleButton.setAttribute('aria-label', 'Sair do carro (E)')
      }
    } else {
      const distToPlane = this.character.root.position.distanceTo(this.plane.root.position)
      if (distToPlane <= 6.5 && !this.plane.exploded) {
        this.vehicleButton.textContent = 'PILOTAR AVIÃO BIMOTOR · E'
        this.vehicleButton.setAttribute('aria-label', 'Pilotar avião bimotor (E)')
        return
      }
      const nearby = this.findAnyNearbyCar(18.0)
      if (nearby && !nearby.car.exploded) {
        const vehicleName = nearby.car.police
          ? 'VIATURA'
          : nearby.car.kind === 'monster_truck'
            ? 'MONSTER TRUCK'
            : nearby.car.kind === 'truck'
              ? 'CAMINHÃO'
              : nearby.car.kind === 'bus'
                ? 'ÔNIBUS'
                : nearby.car.kind === 'pickup'
                  ? 'PICAPE'
                  : nearby.car.kind === 'suv'
                    ? 'SUV'
                    : nearby.car.kind === 'bicycle'
                      ? 'BICICLETA'
                      : 'CARRO'
        this.vehicleButton.textContent = `ENTRAR NO ${vehicleName} · E`
        this.vehicleButton.setAttribute('aria-label', `Entrar no ${vehicleName} (E)`)
      } else {
        this.vehicleButton.textContent = 'ENTRAR NO CARRO · E'
        this.vehicleButton.setAttribute('aria-label', 'Entrar no carro (E)')
      }
    }
  }

  private updateCameraButton(): void {
    const button = document.querySelector<HTMLButtonElement>('#camera-button')!
    const label = this.cameraMode === 'quarter' ? '2,5D' : this.cameraMode === 'cockpit' ? 'INT' : '3D'
    button.textContent = label
    button.setAttribute('aria-pressed', String(this.cameraMode !== 'chase'))
    const description = this.cameraMode === 'chase'
      ? 'Câmera traseira; alternar visão'
      : this.cameraMode === 'quarter'
        ? 'Visão três quartos; alternar visão'
        : 'Visão interna; alternar visão'
    button.setAttribute('aria-label', description)
  }

  private updateCamera(alpha: number): void {
    const playerElevatedPos = this.inVehicle
      ? new THREE.Vector3(this.player.root.position.x, this.player.root.position.y + this.player.climbLift, this.player.root.position.z)
      : this.character.root.position
    const position = this.inPlane
      ? this.plane.root.position
      : playerElevatedPos
    const yaw = this.inPlane
      ? this.plane.yaw
      : this.inVehicle
        ? this.player.yaw
        : this.character.yaw

    if (this.inPlane) {
      if (this.cameraMode === 'quarter') {
        this.cameraOffset.set(30, 52 + this.plane.altitude * 0.25, 38).applyAxisAngle(this.verticalAxis, yaw)
        if (this.camera.fov !== 56) {
          this.camera.fov = 56
          this.camera.updateProjectionMatrix()
        }
      } else if (this.cameraMode === 'cockpit') {
        this.cameraOffset.set(0, 1.48, -1.05).applyAxisAngle(this.verticalAxis, yaw)
        if (this.camera.fov !== 76) {
          this.camera.fov = 76
          this.camera.updateProjectionMatrix()
        }
      } else {
        this.cameraOffset.set(0, 5.2, 14.8).applyAxisAngle(this.verticalAxis, yaw)
        if (this.camera.fov !== 61) {
          this.camera.fov = 61
          this.camera.updateProjectionMatrix()
        }
      }
      this.cameraTarget.set(position.x + this.cameraOffset.x, position.y + this.cameraOffset.y, position.z + this.cameraOffset.z)
      this.camera.position.lerp(this.cameraTarget, alpha)
      const lookAhead = 16.0
      this.lookTarget.set(
        position.x - Math.sin(yaw) * lookAhead,
        position.y + (this.cameraMode === 'cockpit' ? 1.48 : 2.2),
        position.z - Math.cos(yaw) * lookAhead,
      )
      this.camera.lookAt(this.lookTarget)
      this.cockpit.setVisible(false)
      this.plane.root.visible = true
      return
    }

    const isRobot = this.inVehicle && this.player.kind === 'monster_truck' && this.player.isRobotMode

    if (this.cameraMode === 'quarter') {
      this.cameraOffset.set(27, isRobot ? 72 : 66, 34).applyAxisAngle(this.verticalAxis, yaw)
      if (this.camera.fov !== 56) {
        this.camera.fov = 56
        this.camera.updateProjectionMatrix()
      }
    } else if (this.cameraMode === 'cockpit' && this.inVehicle) {
      this.cameraOffset.set(0, isRobot ? 4.8 : 1.56, isRobot ? -0.4 : -0.18).applyAxisAngle(this.verticalAxis, yaw)
      if (this.camera.fov !== 76) {
        this.camera.fov = 76
        this.camera.updateProjectionMatrix()
      }
    } else {
      this.cameraOffset.set(0, isRobot ? 8.4 : 6.1, isRobot ? 16.8 : 12.2).applyAxisAngle(this.verticalAxis, yaw)
      if (this.camera.fov !== 61) {
        this.camera.fov = 61
        this.camera.updateProjectionMatrix()
      }
    }
    this.cameraTarget.set(position.x + this.cameraOffset.x, position.y + this.cameraOffset.y, position.z + this.cameraOffset.z)
    this.camera.position.lerp(this.cameraTarget, alpha)
    const lookAhead = this.cameraMode === 'quarter' ? 11 : this.cameraMode === 'cockpit' && this.inVehicle ? (isRobot ? 14 : 12) : (isRobot ? 8.5 : 5.2)
    const lookHeight = this.cameraMode === 'cockpit' && this.inVehicle ? (isRobot ? 4.8 : 1.56) : this.cameraMode === 'quarter' ? (isRobot ? 3.0 : 1.1) : (isRobot ? 3.6 : 1.3)
    this.lookTarget.set(position.x - Math.sin(yaw) * lookAhead, position.y + lookHeight, position.z - Math.cos(yaw) * lookAhead)
    this.camera.lookAt(this.lookTarget)
    this.cockpit.setVisible(this.inVehicle && this.cameraMode === 'cockpit')
    this.cockpit.syncCamera(this.camera)
    this.player.root.visible = !(this.inVehicle && this.cameraMode === 'cockpit')
  }

  private toggleCamera(): void {
    if (this.inVehicle || this.inPlane) {
      this.cameraMode = this.cameraMode === 'chase'
        ? 'quarter'
        : this.cameraMode === 'quarter'
          ? 'cockpit'
          : 'chase'
    } else {
      this.cameraMode = this.cameraMode === 'chase' ? 'quarter' : 'chase'
    }
    this.updateCameraButton()
    const message = this.cameraMode === 'quarter'
      ? 'VISÃO TRÊS QUARTOS // 2,5D'
      : this.cameraMode === 'cockpit'
        ? 'VISÃO INTERNA // PILOTO ATIVO'
        : 'CÂMERA TRASEIRA // 3D'
    this.showToast(message)
  }

  private updateHud(): void {
    const user = usersDB.getCurrentUser()
    this.currentAuthUser = user
    if (this.levelValue) {
      this.levelValue.textContent = `NV ${user.level}`
    }
    if (this.xpValue && this.xpBarFill) {
      const requiredXp = getXpRequiredForLevel(user.level)
      this.xpValue.textContent = `${user.xp} / ${requiredXp} XP`
      this.xpBarFill.style.width = `${Math.min(100, (user.xp / requiredXp) * 100)}%`
    }
    this.cash = user.cash

    if (this.authButton) {
      if (user.isGuest) {
        this.authButton.textContent = '👤 ANÔNIMO'
        this.authButton.classList.remove('connected')
        this.authButton.title = 'Modo Anônimo (Sem salvamento). Clique para entrar com Google ou Play Games.'
      } else {
        this.authButton.textContent = `👤 ${user.displayName.substring(0, 14)} [NV ${user.level}]`
        this.authButton.classList.add('connected')
        this.authButton.title = `Conectado como ${user.displayName} (${user.provider}). Clique para ver perfil e sincronização.`
      }
    }

    const kmh = Math.floor(Math.abs(this.inPlane ? this.plane.speed : this.inVehicle ? this.player.speed : this.character.speed) * 3.6)
    this.speedValue.textContent = String(kmh).padStart(3, '0')
    this.speedFill.style.width = `${Math.min(100, (kmh / 240) * 100)}%`
    this.distanceValue.textContent = `${Math.floor(this.distance).toLocaleString('pt-BR')} m`
    this.timeValue.textContent = this.formatTime(this.elapsed)
    this.cashValue.textContent = `$ ${this.cash.toLocaleString('pt-BR')}`
    this.wantedLabel.textContent = `NÍVEL ${this.wanted.level} / 10`
    this.wantedPanel.classList.toggle('active', this.wanted.level > 0)
    this.wantedPanel.classList.toggle('captured', this.pursuit.bustProgress > 0.02)
    const capturePercent = Math.round(this.pursuit.bustProgress * 100)
    this.captureLabel.textContent = `${capturePercent}%`
    this.captureFill.style.width = `${capturePercent}%`
    this.wantedNote.textContent = this.wanted.level === 0
      ? 'Mantenha a cidade em alerta.'
      : this.wanted.level >= 8
        ? 'Todas as unidades estão atrás de você.'
        : this.wanted.level >= 5
          ? 'Resposta tática a caminho.'
          : 'Patrulhas locais foram alertadas.'
    this.wantedSegments.forEach((segment, index) => {
      segment.classList.toggle('filled', index < this.wanted.level)
      segment.classList.toggle('current', index === this.wanted.level && this.wanted.level < 10 && this.wanted.progress > 0.02)
      if (index === this.wanted.level && this.wanted.level < 10) {
        const fill = `${Math.round(this.wanted.progress * 100)}%`
        segment.style.background = `linear-gradient(90deg, var(--orange) ${fill}, rgba(245,242,233,.15) ${fill})`
      } else {
        segment.style.background = ''
      }
    })

    if (this.inPlane) {
      const energy = this.plane.energyPercent
      const hits = this.plane.hits
      const maxHits = this.plane.maxHits
      const isSmoking = this.plane.isSmoking
      const rings = this.plane.consecutiveRings

      this.energyVehicleKind.textContent = 'AVIÃO BIMOTOR ✈'
      this.energyValue.textContent = `${energy}%`
      this.energyFill.style.width = `${energy}%`
      this.energyHits.textContent = `${hits} / ${maxHits} BATIDAS · ${rings}/7 CÍRCULOS`

      this.energyFill.classList.toggle('warning', energy <= 60 && energy > 25)
      this.energyFill.classList.toggle('critical', energy <= 25 || isSmoking)

      if (this.plane.exploded) {
        this.energyStatus.textContent = 'EXPLODIU'
        this.energyStatus.className = 'energy-status-critical'
        this.energyValue.style.color = '#ff4438'
      } else if (isSmoking) {
        this.energyStatus.textContent = 'FUMAÇA (30+ BATIDAS)'
        this.energyStatus.className = 'energy-status-critical'
        this.energyValue.style.color = '#ff4438'
      } else if (this.plane.state === 'taxi') {
        const remaining = Math.max(0, 3.0 - this.plane.stateTimer).toFixed(1)
        this.energyStatus.textContent = `DECOLANDO (${remaining}s)`
        this.energyStatus.className = 'energy-status-warning'
        this.energyValue.style.color = '#38bdf8'
      } else {
        this.energyStatus.textContent = `ALT ${Math.round(this.plane.altitude)}m · ${rings}/7 CÍRCULOS`
        this.energyStatus.className = 'energy-status-safe'
        this.energyValue.style.color = '#38bdf8'
      }
    } else if (this.inVehicle) {
      const kindName = this.player.police
        ? 'VIATURA'
        : this.player.kind === 'fuel_tanker'
          ? 'CAMINHÃO TANQUE'
          : this.player.kind === 'car_hauler'
            ? 'CEGONHA'
        : this.player.kind === 'taxi'
          ? 'TÁXI'
        : this.player.kind === 'bomb_car'
          ? 'CARRO-BOMBA'
          : this.player.kind === 'truck'
            ? 'CAMINHÃO'
            : this.player.kind === 'bus'
              ? 'ÔNIBUS'
              : this.player.kind === 'pickup'
                ? 'PICAPE'
                : this.player.kind === 'suv'
                  ? 'SUV'
                  : this.player.kind === 'bicycle'
                    ? 'BICICLETA'
                    : 'SEDAN'

      const energy = this.player.energyPercent
      const hits = this.player.hits
      const maxHits = this.player.maxHits
      const isSmoking = this.player.isSmoking

      this.energyVehicleKind.textContent = kindName
      this.energyValue.textContent = `${energy}%`
      this.energyFill.style.width = `${energy}%`
      this.energyHits.textContent = `${hits} / ${maxHits} BATIDAS`

      this.energyFill.classList.toggle('warning', energy <= 60 && energy > 25)
      this.energyFill.classList.toggle('critical', energy <= 25 || isSmoking)

      if (this.player.exploded) {
        this.energyStatus.textContent = 'EXPLODIU'
        this.energyStatus.className = 'energy-status-critical'
        this.energyValue.style.color = '#ff4438'
      } else if (isSmoking) {
        this.energyStatus.textContent = 'FUMAÇA'
        this.energyStatus.className = 'energy-status-critical'
        this.energyValue.style.color = '#ff4438'
      } else if (energy <= 60) {
        this.energyStatus.textContent = `${energy}%`
        this.energyStatus.className = 'energy-status-warning'
        this.energyValue.style.color = '#f7bf4a'
      } else {
        this.energyStatus.textContent = `${energy}%`
        this.energyStatus.className = 'energy-status-safe'
        this.energyValue.style.color = '#3ddc84'
      }
    } else {
      this.energyVehicleKind.textContent = 'A PÉ'
      this.energyValue.textContent = '--'
      this.energyFill.style.width = '0%'
      this.energyHits.textContent = 'SEM VEÍCULO'
      this.energyStatus.textContent = '--'
      this.energyStatus.className = 'energy-status-safe'
      this.energyValue.style.color = 'var(--muted)'
    }
  }

  private updateMissionCards(): void {
    if (this.activeContractsCountEl) {
      this.activeContractsCountEl.textContent = this.missions.active.length.toString()
    }
    if (this.completedContractsCountEl) {
      this.completedContractsCountEl.textContent = this.missions.completed.length.toString()
    }

    this.missionList.innerHTML = ''

    if (this.contractsTab === 'active') {
      const activeMissions = this.missions.active
      if (activeMissions.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'mission-empty'
        empty.textContent = 'TODAS AS MISSÕES FORAM CONCLUÍDAS! PARABÉNS!'
        this.missionList.appendChild(empty)
        return
      }

      for (const mission of activeMissions) {
        const card = document.createElement('div')
        card.className = 'mission'
        const progress = Math.floor(mission.progress)
        const percent = Math.min(100, (mission.progress / mission.target) * 100)
        card.innerHTML = `
          <div class="mission-title">${mission.title}</div>
          <div class="mission-reward">+$${mission.reward}</div>
          <div class="mission-progress">
            <div class="mission-track"><div class="mission-fill" style="width:${percent}%"></div></div>
            <span class="mission-count">${progress}/${mission.target}${mission.unit === 'm' ? 'm' : ''}</span>
          </div>
        `
        this.missionList.appendChild(card)
      }
    } else {
      const completedMissions = this.missions.completed
      if (completedMissions.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'mission-empty'
        empty.textContent = 'NENHUMA MISSÃO CONCLUÍDA AINDA.\nCUMPRA OS CONTRATOS ATIVOS PELA CIDADE!'
        this.missionList.appendChild(empty)
        return
      }

      for (const mission of completedMissions) {
        const card = document.createElement('div')
        card.className = 'mission completed'
        card.innerHTML = `
          <div class="mission-title"><span style="color:#4ade80;font-weight:bold;margin-right:5px;">✓</span>${mission.title}</div>
          <div class="mission-reward" style="color:#4ade80;">+$${mission.reward}</div>
          <div class="mission-progress">
            <div class="mission-track"><div class="mission-fill" style="width:100%;background:#4ade80;"></div></div>
            <span class="mission-count" style="color:#4ade80;font-weight:bold;">CONCLUÍDO</span>
          </div>
        `
        this.missionList.appendChild(card)
      }
    }
  }

  private initStrandedCars(): void {
    for (const sc of this.strandedCars) {
      sc.car.dispose()
      this.scene.remove(sc.marker)
    }
    this.strandedCars.length = 0

    const strandedConfigs = [
      { x: 48 + 4.2, z: 96, color: 0x3b82f6, yaw: 0 },              // Blue sedan
      { x: -96 - 4.2, z: -48, color: 0xf59e0b, yaw: Math.PI },      // Amber SUV
      { x: 144 + 4.2, z: -144, color: 0x10b981, yaw: Math.PI / 2 }, // Emerald compact
      { x: -48 - 4.2, z: 192, color: 0x8b5cf6, yaw: -Math.PI / 2 }, // Purple sports
      { x: 0 + 4.2, z: 240, color: 0xec4899, yaw: 0 },              // Pink coupe
    ]

    for (const cfg of strandedConfigs) {
      const car = new Car(this.scene, { color: cfg.color, scale: 0.96 })
      car.setPosition(cfg.x, cfg.z, cfg.yaw)
      car.speed = 0
      car.hits = car.smokeThreshold

      const marker = new THREE.Group()
      marker.position.set(cfg.x, 3.2, cfg.z)

      const ringGeo = new THREE.TorusGeometry(0.72, 0.08, 8, 20)
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = Math.PI / 2
      marker.add(ring)

      const coneGeo = new THREE.ConeGeometry(0.35, 0.75, 8)
      const coneMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      const cone = new THREE.Mesh(coneGeo, coneMat)
      cone.rotation.x = Math.PI
      cone.position.y = -0.45
      marker.add(cone)

      this.scene.add(marker)

      this.strandedCars.push({
        car,
        marker,
        collected: false,
        x: cfg.x,
        z: cfg.z,
      })
    }
  }

  private getStationaryCarLocations(): { x: number; z: number; collected: boolean }[] {
    return this.strandedCars.map(sc => ({ x: sc.x, z: sc.z, collected: sc.collected }))
  }

  private updateHaulerMission(dt: number): void {
    // Animate 3D holographic beacon markers above uncollected stranded cars
    for (const sc of this.strandedCars) {
      if (sc.collected) continue
      sc.marker.rotation.y += 2.2 * dt
      sc.marker.position.y = 3.2 + Math.sin(this.elapsed * 4.0 + sc.x * 0.1) * 0.28
    }

    if (this.haulerMissionStage !== 'active') return

    // If player is driving the car hauler, check pickup proximity
    if (this.inVehicle && this.player.kind === 'car_hauler') {
      const playerPos = this.player.root.position
      for (const sc of this.strandedCars) {
        if (sc.collected) continue
        const dist = Math.hypot(playerPos.x - sc.x, playerPos.z - sc.z)
        if (dist <= 8.5) {
          sc.collected = true
          sc.car.root.visible = false
          sc.marker.visible = false
          this.haulerCollectedCount = Math.min(5, this.haulerCollectedCount + 1)
          this.player.setHaulerCollectedCount(this.haulerCollectedCount)

          this.sound.effect('mission')
          this.sparks.emit(sc.car.root.position)
          this.showToast(`🚗 CARRO RECOLHIDO! (${this.haulerCollectedCount}/5) · CARREGADO NA CEGONHA`)

          const justCompleted = this.missions.recordCarHaul(this.haulerCollectedCount)
          for (const m of justCompleted) this.completeMission(m)

          if (this.haulerCollectedCount >= 5) {
            this.haulerMissionStage = 'completed'
            this.cash += 4000
            localStorage.setItem(CASH_KEY, String(this.cash))
            this.sound.effect('mission')
            this.showToast('🎉 MISSÃO DA CEGONHA CONCLUÍDA! TODOS OS 5 CARROS FORAM RECOLHIDOS! +$4000')
            this.updateHud()
          }
          this.updateHaulerMissionUI()
          this.updateMissionCards()
          break
        }
      }
      this.updateHaulerMissionUI()
    }
  }

  private updateHaulerMissionUI(): void {
    if (!this.haulerMissionPanel) return

    if (this.haulerMissionStage === 'active') {
      this.haulerMissionPanel.classList.remove('hidden')
      this.haulerCollectedValEl.textContent = `${this.haulerCollectedCount} / 5`
      this.haulerCollectedFillEl.style.width = `${(this.haulerCollectedCount / 5) * 100}%`

      if (this.inVehicle && this.player.kind === 'car_hauler') {
        let nearestDist = Infinity
        const pos = this.player.root.position
        for (const sc of this.strandedCars) {
          if (sc.collected) continue
          const d = Math.hypot(pos.x - sc.x, pos.z - sc.z)
          if (d < nearestDist) nearestDist = d
        }
        if (nearestDist < Infinity) {
          this.haulerDistInfoEl.textContent = `PRÓXIMO CARRO: ${Math.round(nearestDist)} m`
          this.haulerInstructionEl.textContent = 'APROXIME-SE DO CARRO COM A RAMPA!'
          this.haulerInstructionEl.style.color = '#38bdf8'
        } else {
          this.haulerDistInfoEl.textContent = 'TODOS OS CARROS RECOLHIDOS!'
          this.haulerInstructionEl.textContent = 'PARABÉNS! MISSÃO CONCLUÍDA!'
          this.haulerInstructionEl.style.color = '#4ade80'
        }
      } else {
        this.haulerInstructionEl.textContent = '⚠ RETORNE AO CAMINHÃO CEGONHA!'
        this.haulerInstructionEl.style.color = '#ff4438'
      }
    } else if (this.haulerMissionStage === 'completed') {
      this.haulerMissionPanel.classList.remove('hidden')
      this.haulerCollectedValEl.textContent = '✓ 5 / 5 (CUMPRIDA!)'
      this.haulerCollectedFillEl.style.width = '100%'
      this.haulerDistInfoEl.textContent = 'RECOLHIMENTO COMPLETO'
      this.haulerInstructionEl.textContent = 'TODOS OS VEÍCULOS FORAM RESGATADOS! +$4000'
      this.haulerInstructionEl.style.color = '#4ade80'
    } else {
      this.haulerMissionPanel.classList.add('hidden')
    }
  }

  // ==========================================
  // 1. MISSÃO DE TÁXI // CORRIDA MALUCA (GTA VICE CITY / SAN ANDREAS)
  // ==========================================
  private initTaxiMission(): void {
    if (this.taxiPassengerMesh) {
      this.scene.remove(this.taxiPassengerMesh)
      this.taxiPassengerMesh = null
    }
    if (this.taxiWaypointBeacon) {
      this.scene.remove(this.taxiWaypointBeacon)
      this.taxiWaypointBeacon = null
    }
    this.taxiFareActive = false
    this.taxiPassengerOnboard = false
    this.taxiCurrentDestination = null
    this.spawnTaxiPassenger()
  }

  private spawnTaxiPassenger(): void {
    if (this.taxiPassengerMesh) {
      this.scene.remove(this.taxiPassengerMesh)
      this.taxiPassengerMesh = null
    }
    const charPos = this.inVehicle ? this.player.root.position : this.character.root.position
    const px = Math.round(charPos.x / 48) * 48 + (Math.random() < 0.5 ? 24 : -24)
    const pz = Math.round(charPos.z / 48) * 48 + (Math.random() * 40 - 20)
    this.taxiPassengerTargetPos.set(px, 0, pz)

    const group = new THREE.Group()
    group.position.set(px, 0, pz)

    const skin = new THREE.MeshStandardMaterial({ color: 0xf5d0b0 })
    const clothes = new THREE.MeshStandardMaterial({ color: 0x3b82f6 })
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), skin)
    head.position.y = 1.62
    group.add(head)

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), clothes)
    body.position.y = 1.05
    group.add(body)

    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, wireframe: true })
    const beacon = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 6, 16), beaconMat)
    beacon.position.y = 2.4
    beacon.rotation.x = Math.PI / 2
    group.add(beacon)

    this.scene.add(group)
    this.taxiPassengerMesh = group
  }

  private updateTaxiMission(dt: number): void {
    if (this.taxiPassengerMesh && !this.taxiPassengerOnboard) {
      this.taxiPassengerMesh.rotation.y += 2.0 * dt
      this.taxiPassengerMesh.children[2].position.y = 2.4 + Math.sin(this.elapsed * 4.0) * 0.25
    }

    if (this.taxiWaypointBeacon) {
      this.taxiWaypointBeacon.rotation.y += 1.5 * dt
    }

    if (!this.inVehicle || this.player.kind !== 'taxi') {
      if (this.taxiMissionPanel) this.taxiMissionPanel.classList.add('hidden')
      return
    }

    if (this.taxiMissionPanel) this.taxiMissionPanel.classList.remove('hidden')

    const playerPos = this.player.root.position

    if (!this.taxiPassengerOnboard) {
      if (this.taxiStageLabel) this.taxiStageLabel.textContent = 'PROCURANDO PASSAGEIRO'
      if (this.taxiDestLabel) this.taxiDestLabel.textContent = '📍 AGUARDANDO EMBARQUE'
      if (this.taxiInstruction) this.taxiInstruction.textContent = 'PARE JUNTO AO PASSAGEIRO NA CALÇADA!'

      if (this.taxiPassengerMesh) {
        const dist = playerPos.distanceTo(this.taxiPassengerTargetPos)
        if (this.taxiDistVal) this.taxiDistVal.textContent = `DISTÂNCIA: ${Math.round(dist)} m`
        if (dist <= 7.0 && Math.abs(this.player.speed) <= 3.0) {
          this.taxiPassengerOnboard = true
          this.taxiFareActive = true
          this.taxiFareTimer = 55.0
          this.taxiFareTip = 1000
          if (this.taxiPassengerMesh) {
            this.scene.remove(this.taxiPassengerMesh)
            this.taxiPassengerMesh = null
          }

          const landmarks = [
            { name: 'PRAÇA CENTRAL', x: 0, z: 0 },
            { name: 'AEROPORTO INTERNACIONAL', x: 168, z: -120 },
            { name: 'BANCO CENTRAL', x: 96, z: -96 },
            { name: 'HOSPITAL GERAL', x: -144, z: -96 },
            { name: 'MARINA SUL', x: 144, z: 144 },
            { name: 'DISTRITO FINANCEIRO', x: -96, z: 96 },
          ]
          const valid = landmarks.filter(l => Math.hypot(l.x - playerPos.x, l.z - playerPos.z) > 90)
          this.taxiCurrentDestination = valid[Math.floor(Math.random() * valid.length)] || landmarks[0]

          if (this.taxiWaypointBeacon) this.scene.remove(this.taxiWaypointBeacon)
          const beaconGeo = new THREE.CylinderGeometry(1.4, 1.4, 40, 16)
          const beaconMat = new THREE.MeshBasicMaterial({
            color: 0xfacc15,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
          })
          this.taxiWaypointBeacon = new THREE.Mesh(beaconGeo, beaconMat)
          this.taxiWaypointBeacon.position.set(this.taxiCurrentDestination.x, 20, this.taxiCurrentDestination.z)
          this.scene.add(this.taxiWaypointBeacon)

          this.sound.effect('mission')
          this.showToast(`🚕 PASSAGEIRO EMBARCOU! DESTINO: ${this.taxiCurrentDestination.name}`)
        }
      } else {
        this.spawnTaxiPassenger()
      }
    } else {
      this.taxiFareTimer -= dt
      const speedKmh = Math.abs(this.player.speed) * 3.6
      if (speedKmh > 75) {
        this.taxiFareTip += 50 * dt
      }

      if (this.taxiStageLabel) this.taxiStageLabel.textContent = 'EM VIAGEM'
      if (this.taxiDestLabel && this.taxiCurrentDestination) {
        this.taxiDestLabel.textContent = `📍 ${this.taxiCurrentDestination.name}`
      }
      if (this.taxiTimerVal) this.taxiTimerVal.textContent = `${Math.max(0, this.taxiFareTimer).toFixed(1)}s`
      if (this.taxiTimerFill) this.taxiTimerFill.style.width = `${Math.min(100, (this.taxiFareTimer / 55.0) * 100)}%`
      if (this.taxiTipVal) this.taxiTipVal.textContent = `💰 GORJETA: $ ${Math.round(this.taxiFareTip * this.tokenMultiplier)}`
      if (this.taxiInstruction) this.taxiInstruction.textContent = 'ACELERE E FAÇA MANOBRAS RADICAIS!'

      if (this.taxiCurrentDestination) {
        const dist = Math.hypot(playerPos.x - this.taxiCurrentDestination.x, playerPos.z - this.taxiCurrentDestination.z)
        if (this.taxiDistVal) this.taxiDistVal.textContent = `DISTÂNCIA: ${Math.round(dist)} m`

        if (dist <= 9.0 && Math.abs(this.player.speed) <= 4.5) {
          const baseFare = 600
          const tip = Math.round(this.taxiFareTip)
          const totalEarned = Math.round((baseFare + tip) * this.tokenMultiplier)
          this.cash += totalEarned
          localStorage.setItem(CASH_KEY, String(this.cash))
          this.taxiFaresCompleted++

          if (this.taxiWaypointBeacon) {
            this.scene.remove(this.taxiWaypointBeacon)
            this.taxiWaypointBeacon = null
          }

          this.sound.effect('upgrade')
          this.showToast(`🚕 CORRIDA CONCLUÍDA! +$${totalEarned} ($600 TARIFA + $${tip} GORJETA)`)

          const justCompleted = this.missions.recordTaxiFare(1)
          for (const m of justCompleted) this.completeMission(m)

          if (this.taxiFaresCompleted >= 3 && !this.hasFastestCabbieTitle) {
            this.hasFastestCabbieTitle = true
            this.tokenMultiplier = 2.0
            this.showToast('🏆 TÍTULO DESBLOQUEADO: "TAXISTA MAIS RÁPIDO DA CIDADE"! FICHAS 2X!')
          }

          this.taxiPassengerOnboard = false
          this.taxiFareActive = false
          this.taxiCurrentDestination = null
          this.updateHud()
          this.updateMissionCards()
          setTimeout(() => this.spawnTaxiPassenger(), 3000)
        }
      }

      if (this.taxiFareTimer <= 0) {
        this.showToast('❌ TEMPO ESGOTADO! O PASSAGEIRO CANCELOU A CORRIDA.')
        if (this.taxiWaypointBeacon) {
          this.scene.remove(this.taxiWaypointBeacon)
          this.taxiWaypointBeacon = null
        }
        this.taxiPassengerOnboard = false
        this.taxiFareActive = false
        this.taxiCurrentDestination = null
        setTimeout(() => this.spawnTaxiPassenger(), 3000)
      }
    }
  }

  private updateTaxiMissionUI(): void {
    if (!this.taxiMissionPanel) return
    if (this.inVehicle && this.player.kind === 'taxi') {
      this.taxiMissionPanel.classList.remove('hidden')
    } else {
      this.taxiMissionPanel.classList.add('hidden')
    }
  }

  // ==========================================
  // 2. MISSÃO CARRO-BOMBA (GTA III - SPEED)
  // ==========================================
  private updateBombMission(dt: number): void {
    if (!this.inVehicle || this.player.kind !== 'bomb_car') {
      if (this.bombMissionPanel) this.bombMissionPanel.classList.add('hidden')
      return
    }

    if (this.bombMissionCompleted) {
      if (this.bombMissionPanel) this.bombMissionPanel.classList.add('hidden')
      return
    }

    if (this.bombMissionPanel) this.bombMissionPanel.classList.remove('hidden')

    const speedKmh = Math.abs(this.player.speed) * 3.6
    if (this.bombSpeedVal) {
      this.bombSpeedVal.textContent = `${Math.round(speedKmh)} KM/H`
      this.bombSpeedVal.classList.toggle('danger', speedKmh < 75)
    }
    if (this.bombSpeedFill) {
      const fillPercent = Math.min(100, (speedKmh / 140) * 100)
      this.bombSpeedFill.style.width = `${fillPercent}%`
    }

    if (this.bombMissionActive) {
      if (speedKmh >= 75) {
        this.bombMissionSurvived += dt
        this.bombGraceTimer = 3.0
        if (this.bombWarningBox) this.bombWarningBox.classList.add('hidden')
      } else {
        this.bombGraceTimer -= dt
        if (this.bombWarningBox) {
          this.bombWarningBox.classList.remove('hidden')
          if (this.bombGraceVal) this.bombGraceVal.textContent = `${Math.max(0, this.bombGraceTimer).toFixed(1)}s`
        }

        if (this.bombGraceTimer <= 0) {
          this.sparks.emitExplosion(this.player.root.position)
          this.sound.effect('explosion')
          this.player.explode()
          this.bombMissionActive = false
          this.showToast('💥 BOOM! A VELOCIDADE CAIU ABAIXO DE 75 KM/H POR MAIS DE 3s!')
          this.endRun('explosion')
          return
        }
      }

      if (this.bombCountdownVal) {
        const remaining = Math.max(0, 45.0 - this.bombMissionSurvived)
        this.bombCountdownVal.textContent = `${remaining.toFixed(1)}s`
      }

      if (this.bombMissionSurvived >= 45.0) {
        this.bombMissionCompleted = true
        this.bombMissionActive = false
        this.hasExclusiveSpeedPaint = true
        localStorage.setItem('smash_speed_paint', 'true')
        this.cash += 5000
        localStorage.setItem(CASH_KEY, String(this.cash))
        this.sound.effect('upgrade')
        this.showToast('💣 BOMBA DESARMADA COM SUCESSO! +$5.000 & PINTURA SPEEDSTER DESBLOQUEADA!')
        const justCompleted = this.missions.recordSpeedBomb(45)
        for (const m of justCompleted) this.completeMission(m)
        this.updateHud()
        this.updateMissionCards()
        this.updateBombMissionUI()
      }
    }
  }

  private updateBombMissionUI(): void {
    if (!this.bombMissionPanel) return
    if (this.inVehicle && this.player.kind === 'bomb_car' && !this.bombMissionCompleted) {
      this.bombMissionPanel.classList.remove('hidden')
    } else {
      this.bombMissionPanel.classList.add('hidden')
    }
  }

  // ==========================================
  // 3. MODO FÚRIA / RAMPAGE (GTA 2 / GTA VICE CITY)
  // ==========================================
  private initRampageSkull(): void {
    if (this.rampageSkull) {
      this.scene.remove(this.rampageSkull)
    }
    const group = new THREE.Group()
    group.position.set(48, 1.6, -48)

    const skullMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 2.5,
      roughness: 0.3,
    })
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), skullMat)
    cranium.scale.set(1, 1.1, 0.9)
    group.add(cranium)

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.42), skullMat)
    jaw.position.set(0, -0.42, 0.1)
    group.add(jaw)

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
    for (const ex of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeMat)
      eye.position.set(ex, 0.04, 0.45)
      group.add(eye)
    }

    const haloMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 8, 24), haloMat)
    halo.rotation.x = Math.PI / 2
    group.add(halo)

    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xdc2626,
      transparent: true,
      opacity: 0.35,
    })
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.85, 28, 12), beaconMat)
    beacon.position.set(0, 14, 0)
    group.add(beacon)

    this.scene.add(group)
    this.rampageSkull = group
  }

  private triggerRampage(): void {
    if (this.rampageActive) return
    this.rampageActive = true
    this.rampageTimer = 60.0
    this.rampagePoliceDestroyed = 0
    if (this.rampageSkull) this.rampageSkull.visible = false
    this.wanted.setLevel(4)
    this.sound.effect('upgrade')
    this.showToast('💀 MODO FÚRIA ATIVADO! DESTRUA 15 VIATURAS POLICIAIS EM 60s!')
    this.updateRampageMissionUI()
  }

  private updateRampageMission(dt: number): void {
    if (this.rampageSkull && !this.rampageActive && !this.rampageCompleted) {
      this.rampageSkull.rotation.y += 2.0 * dt
      this.rampageSkull.position.y = 1.6 + Math.sin(this.elapsed * 3.5) * 0.25

      const actorPos = this.inVehicle ? this.player.root.position : this.character.root.position
      const dist = actorPos.distanceTo(this.rampageSkull.position)
      if (dist <= 3.8) {
        this.triggerRampage()
      }
    }

    if (!this.rampageActive) {
      if (this.rampageMissionPanel) this.rampageMissionPanel.classList.add('hidden')
      return
    }

    if (this.rampageMissionPanel) this.rampageMissionPanel.classList.remove('hidden')

    this.rampageTimer -= dt
    if (this.rampageTimerVal) this.rampageTimerVal.textContent = `${Math.ceil(this.rampageTimer)}s`
    if (this.rampageCountVal) this.rampageCountVal.textContent = `${this.rampagePoliceDestroyed} / 15`
    if (this.rampageFill) this.rampageFill.style.width = `${Math.min(100, (this.rampagePoliceDestroyed / 15) * 100)}%`

    if (this.rampageTimer <= 0) {
      this.rampageActive = false
      this.showToast('❌ MODO FÚRIA FALHOU // TEMPO ESGOTADO (60s)')
      if (this.rampageSkull) this.rampageSkull.visible = true
      this.updateRampageMissionUI()
    }
  }

  private updateRampageMissionUI(): void {
    if (!this.rampageMissionPanel) return
    if (this.rampageActive) {
      this.rampageMissionPanel.classList.remove('hidden')
    } else {
      this.rampageMissionPanel.classList.add('hidden')
    }
  }

  private rewardXp(amount: number): void {
    const res = usersDB.addXp(amount)
    if (res.leveledUp) {
      this.sound.effect('upgrade')
      this.showToast(`⭐ SUBIU DE NÍVEL! NÍVEL ${res.newLevel} ALCANÇADO (+R$ ${res.bonusCash.toLocaleString('pt-BR')})!`)
      this.cash = usersDB.getCurrentUser().cash
    }
    this.updateHud()
  }

  private onUserDataUpdated(user: UserProfile): void {
    this.currentAuthUser = user
    this.cash = user.cash
    this.bestScore = user.highScore
    this.updateHud()
    this.updateProfileModalUI()
  }

  private updateProfileModalUI(): void {
    const user = usersDB.getCurrentUser()
    if (this.profileUserName) {
      this.profileUserName.textContent = user.displayName
    }
    if (this.profileSyncBadge) {
      if (user.isGuest) {
        this.profileSyncBadge.className = 'sync-badge sync-badge-guest'
        this.profileSyncBadge.textContent = '⚪ Anônimo (Sem Nuvem)'
      } else if (user.pendingSync) {
        this.profileSyncBadge.className = 'sync-badge sync-badge-offline'
        this.profileSyncBadge.textContent = '🟡 Salvo Offline (users.ts)'
      } else {
        this.profileSyncBadge.className = 'sync-badge sync-badge-online'
        this.profileSyncBadge.textContent = '🟢 Nuvem Sincronizada (Firestore)'
      }
    }
    if (this.profileLevelVal) {
      this.profileLevelVal.textContent = `Nível ${user.level}`
    }
    if (this.profileXpVal) {
      const req = getXpRequiredForLevel(user.level)
      this.profileXpVal.textContent = `${user.xp} / ${req} XP (Total: ${user.totalXp.toLocaleString('pt-BR')})`
    }
    if (this.profileCashVal) {
      this.profileCashVal.textContent = `$ ${user.cash.toLocaleString('pt-BR')}`
    }
    if (this.profileHighscoreVal) {
      this.profileHighscoreVal.textContent = `${user.highScore.toLocaleString('pt-BR')} m`
    }

    if (this.guestWarningBanner) {
      this.guestWarningBanner.classList.toggle('hidden', !user.isGuest)
    }
    if (this.authButtonsList) {
      this.authButtonsList.classList.toggle('hidden', !user.isGuest)
    }
    if (this.signOutBtn) {
      this.signOutBtn.classList.toggle('hidden', user.isGuest)
    }
    if (this.syncNowBtn) {
      this.syncNowBtn.classList.toggle('hidden', user.isGuest)
    }
    if (this.authStatusMsg) {
      if (user.isGuest) {
        this.authStatusMsg.textContent = 'Modo Anônimo ativo: dados locais não sincronizados entre dispositivos.'
      } else if (user.pendingSync) {
        this.authStatusMsg.textContent = 'Alterações salvas no banco local users.ts. Sincronização automática com Firestore assim que a internet estiver disponível.'
      } else {
        this.authStatusMsg.textContent = `Conectado como ${user.displayName} via ${user.provider.toUpperCase()}. Firestore ativo.`
      }
    }
  }

  private async handleSignIn(provider: 'Google' | 'Google Play Games'): Promise<void> {
    if (this.authStatusMsg) {
      this.authStatusMsg.textContent = `Autenticando com ${provider}...`
    }
    try {
      if (provider === 'Google') {
        await usersDB.signInWithGoogle()
      } else {
        await usersDB.signInWithPlayGames()
      }
      this.sound.effect('upgrade')
      this.showToast(`CONECTADO VIA ${provider.toUpperCase()} // DADOS SINCRONIZADOS NO FIRESTORE!`)
      this.updateProfileModalUI()
      this.updateHud()
      setTimeout(() => {
        this.authModal?.classList.add('hidden')
      }, 1000)
    } catch (err) {
      console.error('Sign in error:', err)
      this.showToast(`ERRO AO CONECTAR COM ${provider.toUpperCase()}`)
    }
  }

  private async handleSignOut(): Promise<void> {
    await usersDB.signOut()
    this.sound.effect('wanted')
    this.showToast('DESCONECTADO // JOGANDO COMO ANÔNIMO')
    this.updateProfileModalUI()
    this.updateHud()
  }

  private async handleManualSync(): Promise<void> {
    if (this.authStatusMsg) {
      this.authStatusMsg.textContent = 'Sincronizando com Firebase Firestore...'
    }
    const success = await usersDB.syncPendingChanges()
    if (success) {
      this.sound.effect('upgrade')
      this.showToast('✅ DADOS SINCRONIZADOS COM SUCESSO NO FIRESTORE!')
    } else {
      this.showToast('⚠️ OFFLINE: DADOS PROTEGIDOS NO BANCO USERS.TS')
    }
    this.updateProfileModalUI()
  }

  private createPlayerVehicle(x = 0, z = 0, yaw = 0): Car {
    const user = this.currentAuthUser
    const kind = (user.selectedVehicle || 'sedan') as any
    const car = new Car(this.scene, {
      kind,
      playerControlled: true,
      engineLevel: user.engineUpgradeLevel || 0,
      armorLevel: user.armorUpgradeLevel || 0,
      paintStyle: user.selectedPaint || 'default',
      decalStyle: user.selectedDecal || 'none',
      equippedParts: user.equippedParts || [],
    })
    car.setPosition(x, z, yaw)
    return car
  }

  private rebuildPlayerVehicle(): void {
    const oldPos = this.player.root.position.clone()
    const oldYaw = this.player.yaw
    const oldSpeed = this.player.speed
    const wasRobot = this.player.isRobotMode
    this.player.dispose()
    this.player = this.createPlayerVehicle(oldPos.x, oldPos.z, oldYaw)
    this.player.speed = oldSpeed
    if (wasRobot && this.player.kind === 'monster_truck') {
      this.player.toggleRobotMode(true)
    }
  }

  // ================= GARAGE & SHOP METHODS =================

  private openShop(): void {
    if (!this.shopModal) return
    this.shopModal.classList.remove('hidden')
    this.updateShopCashDisplay()
    this.renderShop()
  }

  private closeShop(): void {
    this.shopModal?.classList.add('hidden')
    this.rebuildPlayerVehicle()
  }

  private switchShopTab(tab: 'vehicles' | 'engine' | 'armor' | 'paints' | 'decals' | 'parts'): void {
    this.currentShopTab = tab
    this.shopTabVehicles?.classList.toggle('active', tab === 'vehicles')
    this.shopTabEngine?.classList.toggle('active', tab === 'engine')
    this.shopTabArmor?.classList.toggle('active', tab === 'armor')
    this.shopTabPaints?.classList.toggle('active', tab === 'paints')
    this.shopTabDecals?.classList.toggle('active', tab === 'decals')
    this.shopTabParts?.classList.toggle('active', tab === 'parts')
    this.renderShop()
  }

  private updateShopCashDisplay(): void {
    const user = usersDB.getCurrentUser()
    this.currentAuthUser = user
    if (this.shopUserCash) {
      this.shopUserCash.textContent = `$ ${user.cash.toLocaleString('pt-BR')}`
    }
    if (this.shopFeedbackMsg) {
      if (user.isGuest) {
        this.shopFeedbackMsg.textContent = '👤 Modo Anônimo: Você pode comprar e usar tudo nesta sessão! Conecte-se com Google ou Play Games para salvar permanentemente na nuvem.'
      } else {
        this.shopFeedbackMsg.textContent = `☁️ Conectado como ${user.displayName}: Suas compras e garagem são salvas no Firestore.`
      }
    }
  }

  private renderShop(): void {
    if (!this.shopContentArea) return
    this.updateShopCashDisplay()
    const user = this.currentAuthUser
    const tab = this.currentShopTab

    if (tab === 'vehicles') {
      this.shopContentArea.innerHTML = `
        <div class="shop-grid">
          ${SHOP_CATALOG.vehicles
            .map((v) => {
              const isUnlocked = user.unlockedVehicles.includes(v.id)
              const isSelected = user.selectedVehicle === v.id
              const canAfford = user.cash >= v.price

              return `
                <div class="shop-item-card ${isUnlocked ? 'unlocked' : ''} ${isSelected ? 'equipped' : ''}">
                  <div class="shop-item-top">
                    <div class="shop-item-icon">${v.icon}</div>
                    <div class="shop-item-info">
                      <div class="shop-item-title">${v.name}</div>
                      <div class="shop-item-desc">${v.description}</div>
                    </div>
                  </div>
                  <div class="shop-stat-bars">
                    <div class="shop-stat-row">
                      <span>VELOCIDADE</span>
                      <div class="shop-stat-track"><div class="shop-stat-fill speed-fill-bar" style="width: ${v.stats.speed * 10}%"></div></div>
                      <span>${v.stats.speed}/10</span>
                    </div>
                    <div class="shop-stat-row">
                      <span>BLINDAGEM</span>
                      <div class="shop-stat-track"><div class="shop-stat-fill armor-fill-bar" style="width: ${v.stats.armor * 10}%"></div></div>
                      <span>${v.stats.armor}/10</span>
                    </div>
                    <div class="shop-stat-row">
                      <span>ESPECIAL:</span>
                      <span style="color: #facc15; font-size: 7.5px;">${v.stats.special}</span>
                    </div>
                  </div>
                  <div class="shop-item-action">
                    <div class="shop-item-price ${v.price === 0 ? 'free' : ''}">${v.price === 0 ? 'PADRÃO' : `$ ${v.price.toLocaleString('pt-BR')}`}</div>
                    ${
                      isSelected
                        ? `<button class="shop-select-btn is-selected" type="button" disabled>✓ SELECIONADO</button>`
                        : isUnlocked
                          ? `<button class="shop-select-btn" type="button" data-action="select-vehicle" data-id="${v.id}">DIRIGIR ESTE</button>`
                          : `<button class="shop-buy-btn" type="button" data-action="buy-vehicle" data-id="${v.id}" ${canAfford ? '' : 'disabled'}>COMPRAR ↗</button>`
                    }
                  </div>
                </div>
              `
            })
            .join('')}
        </div>
      `
    } else if (tab === 'engine') {
      const currentLevel = user.engineUpgradeLevel || 0
      this.shopContentArea.innerHTML = `
        <div class="shop-grid">
          ${SHOP_CATALOG.engineUpgrades
            .map((u) => {
              const isUnlocked = currentLevel >= u.level
              const isNext = u.level === currentLevel + 1
              const canAfford = user.cash >= u.price

              return `
                <div class="shop-item-card ${isUnlocked ? 'equipped' : ''}">
                  <div class="shop-item-top">
                    <div class="shop-item-icon">⚡</div>
                    <div class="shop-item-info">
                      <div class="shop-item-title">${u.name}</div>
                      <div class="shop-item-desc" style="color: #38bdf8;">${u.bonusText}</div>
                    </div>
                  </div>
                  <div class="shop-stat-bars">
                    <div class="shop-stat-row">
                      <span>POTÊNCIA DO MOTOR</span>
                      <div class="shop-stat-track"><div class="shop-stat-fill speed-fill-bar" style="width: ${(u.level / 5) * 100}%"></div></div>
                      <span>NÍVEL ${u.level}</span>
                    </div>
                  </div>
                  <div class="shop-item-action">
                    <div class="shop-item-price">$ ${u.price.toLocaleString('pt-BR')}</div>
                    ${
                      isUnlocked
                        ? `<button class="shop-select-btn is-selected" type="button" disabled>✓ INSTALADO</button>`
                        : isNext
                          ? `<button class="shop-buy-btn" type="button" data-action="buy-engine" ${canAfford ? '' : 'disabled'}>TURBINAR ↗</button>`
                          : `<button class="shop-buy-btn" type="button" disabled>BLOQUEADO</button>`
                    }
                  </div>
                </div>
              `
            })
            .join('')}
        </div>
      `
    } else if (tab === 'armor') {
      const currentLevel = user.armorUpgradeLevel || 0
      this.shopContentArea.innerHTML = `
        <div class="shop-grid">
          ${SHOP_CATALOG.armorUpgrades
            .map((u) => {
              const isUnlocked = currentLevel >= u.level
              const isNext = u.level === currentLevel + 1
              const canAfford = user.cash >= u.price

              return `
                <div class="shop-item-card ${isUnlocked ? 'equipped' : ''}">
                  <div class="shop-item-top">
                    <div class="shop-item-icon">🛡️</div>
                    <div class="shop-item-info">
                      <div class="shop-item-title">${u.name}</div>
                      <div class="shop-item-desc" style="color: #34d399;">${u.bonusText}</div>
                    </div>
                  </div>
                  <div class="shop-stat-bars">
                    <div class="shop-stat-row">
                      <span>RESISTÊNCIA DO CHASSI</span>
                      <div class="shop-stat-track"><div class="shop-stat-fill armor-fill-bar" style="width: ${(u.level / 5) * 100}%"></div></div>
                      <span>NÍVEL ${u.level}</span>
                    </div>
                  </div>
                  <div class="shop-item-action">
                    <div class="shop-item-price">$ ${u.price.toLocaleString('pt-BR')}</div>
                    ${
                      isUnlocked
                        ? `<button class="shop-select-btn is-selected" type="button" disabled>✓ BLINDADO</button>`
                        : isNext
                          ? `<button class="shop-buy-btn" type="button" data-action="buy-armor" ${canAfford ? '' : 'disabled'}>REFORÇAR ↗</button>`
                          : `<button class="shop-buy-btn" type="button" disabled>BLOQUEADO</button>`
                    }
                  </div>
                </div>
              `
            })
            .join('')}
        </div>
      `
    } else if (tab === 'paints') {
      this.shopContentArea.innerHTML = `
        <div class="shop-grid">
          ${SHOP_CATALOG.paints
            .map((p) => {
              const isUnlocked = user.unlockedPaints.includes(p.id)
              const isSelected = user.selectedPaint === p.id
              const canAfford = user.cash >= p.price

              return `
                <div class="shop-item-card ${isUnlocked ? 'unlocked' : ''} ${isSelected ? 'equipped' : ''}">
                  <div class="shop-item-top">
                    <div class="shop-item-icon" style="background: ${p.colorHex}; box-shadow: 0 0 12px ${p.colorHex}66;">🎨</div>
                    <div class="shop-item-info">
                      <div class="shop-item-title">${p.name}</div>
                      <div class="shop-item-desc">${p.description}</div>
                    </div>
                  </div>
                  <div class="shop-item-action">
                    <div class="shop-item-price ${p.price === 0 ? 'free' : ''}">${p.price === 0 ? 'GRÁTIS' : `$ ${p.price.toLocaleString('pt-BR')}`}</div>
                    ${
                      isSelected
                        ? `<button class="shop-select-btn is-selected" type="button" disabled>✓ APLICADA</button>`
                        : isUnlocked
                          ? `<button class="shop-select-btn" type="button" data-action="select-paint" data-id="${p.id}">APLICAR</button>`
                          : `<button class="shop-buy-btn" type="button" data-action="buy-paint" data-id="${p.id}" ${canAfford ? '' : 'disabled'}>COMPRAR ↗</button>`
                    }
                  </div>
                </div>
              `
            })
            .join('')}
        </div>
      `
    } else if (tab === 'decals') {
      this.shopContentArea.innerHTML = `
        <div class="shop-grid">
          ${SHOP_CATALOG.decals
            .map((d) => {
              const isUnlocked = user.unlockedDecals.includes(d.id)
              const isSelected = user.selectedDecal === d.id
              const canAfford = user.cash >= d.price

              return `
                <div class="shop-item-card ${isUnlocked ? 'unlocked' : ''} ${isSelected ? 'equipped' : ''}">
                  <div class="shop-item-top">
                    <div class="shop-item-icon">${d.icon}</div>
                    <div class="shop-item-info">
                      <div class="shop-item-title">${d.name}</div>
                      <div class="shop-item-desc">${d.description}</div>
                    </div>
                  </div>
                  <div class="shop-item-action">
                    <div class="shop-item-price ${d.price === 0 ? 'free' : ''}">${d.price === 0 ? 'PADRÃO' : `$ ${d.price.toLocaleString('pt-BR')}`}</div>
                    ${
                      isSelected
                        ? `<button class="shop-select-btn is-selected" type="button" disabled>✓ EQUIPADO</button>`
                        : isUnlocked
                          ? `<button class="shop-select-btn" type="button" data-action="select-decal" data-id="${d.id}">EQUIPAR</button>`
                          : `<button class="shop-buy-btn" type="button" data-action="buy-decal" data-id="${d.id}" ${canAfford ? '' : 'disabled'}>COMPRAR ↗</button>`
                    }
                  </div>
                </div>
              `
            })
            .join('')}
        </div>
      `
    } else if (tab === 'parts') {
      this.shopContentArea.innerHTML = `
        <div class="shop-grid">
          ${SHOP_CATALOG.parts
            .map((pt) => {
              const isUnlocked = user.unlockedParts.includes(pt.id)
              const isEquipped = user.equippedParts.includes(pt.id)
              const canAfford = user.cash >= pt.price

              return `
                <div class="shop-item-card ${isUnlocked ? 'unlocked' : ''} ${isEquipped ? 'equipped' : ''}">
                  <div class="shop-item-top">
                    <div class="shop-item-icon">${pt.icon}</div>
                    <div class="shop-item-info">
                      <div class="shop-item-title">${pt.name}</div>
                      <div class="shop-item-desc">${pt.description}</div>
                    </div>
                  </div>
                  <div class="shop-stat-bars">
                    <div class="shop-stat-row">
                      <span>EFEITO ESPECIAL:</span>
                      <span style="color: #38bdf8; font-size: 7.5px;">${pt.effect}</span>
                    </div>
                  </div>
                  <div class="shop-item-action">
                    <div class="shop-item-price">$ ${pt.price.toLocaleString('pt-BR')}</div>
                    ${
                      isEquipped
                        ? `<button class="shop-select-btn is-selected" type="button" data-action="toggle-part" data-id="${pt.id}">✓ EQUIPADO (DESEQUIPAR)</button>`
                        : isUnlocked
                          ? `<button class="shop-select-btn" type="button" data-action="toggle-part" data-id="${pt.id}">INSTALAR NO CARRO</button>`
                          : `<button class="shop-buy-btn" type="button" data-action="buy-part" data-id="${pt.id}" ${canAfford ? '' : 'disabled'}>COMPRAR ↗</button>`
                    }
                  </div>
                </div>
              `
            })
            .join('')}
        </div>
      `
    }

    // Attach click handlers to buy/select buttons inside shop
    const buttons = this.shopContentArea.querySelectorAll<HTMLButtonElement>('button[data-action]')
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action
        const id = btn.dataset.id

        if (action === 'buy-vehicle' && id) {
          const res = usersDB.buyVehicle(id)
          if (res.success) {
            this.sound.effect('upgrade')
            this.showToast(`🏎️ VEÍCULO ADQUIRIDO COM SUCESSO!`)
            if (this.shopFeedbackMsg) this.shopFeedbackMsg.textContent = res.message
            this.rebuildPlayerVehicle()
          } else {
            this.showToast(res.message)
          }
        } else if (action === 'select-vehicle' && id) {
          const res = usersDB.selectVehicle(id)
          if (res.success) {
            this.sound.effect('upgrade')
            this.showToast(`🏎️ VEÍCULO EQUIPADO!`)
            this.rebuildPlayerVehicle()
          }
        } else if (action === 'buy-engine') {
          const res = usersDB.buyEngineUpgrade()
          if (res.success) {
            this.sound.effect('upgrade')
            this.showToast(`⚡ MOTOR TURBINADO PARA O ESTÁGIO ${res.newLevel}!`)
            if (this.shopFeedbackMsg) this.shopFeedbackMsg.textContent = res.message
            this.rebuildPlayerVehicle()
          } else {
            this.showToast(res.message)
          }
        } else if (action === 'buy-armor') {
          const res = usersDB.buyArmorUpgrade()
          if (res.success) {
            this.sound.effect('upgrade')
            this.showToast(`🛡️ BLINDAGEM REFORÇADA PARA O NÍVEL ${res.newLevel}!`)
            if (this.shopFeedbackMsg) this.shopFeedbackMsg.textContent = res.message
            this.rebuildPlayerVehicle()
          } else {
            this.showToast(res.message)
          }
        } else if (action === 'buy-paint' && id) {
          const res = usersDB.buyPaint(id)
          if (res.success) {
            this.sound.effect('upgrade')
            this.showToast(`🎨 NOVA PINTURA ADQUIRIDA E APLICADA!`)
            if (this.shopFeedbackMsg) this.shopFeedbackMsg.textContent = res.message
            this.rebuildPlayerVehicle()
          } else {
            this.showToast(res.message)
          }
        } else if (action === 'select-paint' && id) {
          const res = usersDB.selectPaint(id)
          if (res.success) {
            this.sound.effect('upgrade')
            this.showToast(`🎨 PINTURA ALTERADA COM SUCESSO!`)
            this.rebuildPlayerVehicle()
          }
        } else if (action === 'buy-decal' && id) {
          const res = usersDB.buyDecal(id)
          if (res.success) {
            this.sound.effect('upgrade')
            this.showToast(`🏷️ ADESIVO EXCLUSIVO ADQUIRIDO!`)
            if (this.shopFeedbackMsg) this.shopFeedbackMsg.textContent = res.message
            this.rebuildPlayerVehicle()
          } else {
            this.showToast(res.message)
          }
        } else if (action === 'select-decal' && id) {
          const res = usersDB.selectDecal(id)
          if (res.success) {
            this.sound.effect('upgrade')
            this.showToast(`🏷️ ADESIVO APLICADO AO CARRO!`)
            this.rebuildPlayerVehicle()
          }
        } else if (action === 'buy-part' && id) {
          const res = usersDB.buyPart(id)
          if (res.success) {
            this.sound.effect('upgrade')
            this.showToast(`🔧 PEÇA EXCLUSIVA INSTALADA!`)
            if (this.shopFeedbackMsg) this.shopFeedbackMsg.textContent = res.message
            this.rebuildPlayerVehicle()
          } else {
            this.showToast(res.message)
          }
        } else if (action === 'toggle-part' && id) {
          const res = usersDB.toggleEquipPart(id)
          if (res.success) {
            this.sound.effect('upgrade')
            this.showToast(res.equipped ? `🔧 PEÇA EQUIPADA NO VEÍCULO!` : `🔧 PEÇA DESEQUIPADA.`)
            this.rebuildPlayerVehicle()
          }
        }

        this.renderShop()
        this.updateHud()
      })
    })
  }

  private openDailyLeaderboard(): void {
    if (!this.leaderboardModal) return
    this.leaderboardModal.classList.remove('hidden')
    void this.loadDailyLeaderboardData()
  }

  private switchLeaderboardTab(tab: 'xp' | 'cash'): void {
    this.currentLeaderboardTab = tab
    this.lbTabXp?.classList.toggle('active', tab === 'xp')
    this.lbTabCash?.classList.toggle('active', tab === 'cash')
    if (this.lbColScore) {
      this.lbColScore.textContent = tab === 'xp' ? 'XP HOJE' : 'DINHEIRO HOJE'
    }
    void this.loadDailyLeaderboardData()
  }

  private async loadDailyLeaderboardData(): Promise<void> {
    if (!this.leaderboardList) return
    const user = usersDB.getCurrentUser()

    if (this.leaderboardDateLabel) {
      const today = new Date()
      this.leaderboardDateLabel.textContent = `Temporada de Hoje: ${today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`
    }

    if (this.leaderboardMyStatVal) {
      if (this.currentLeaderboardTab === 'xp') {
        this.leaderboardMyStatVal.textContent = `${(user.dailyXp || 0).toLocaleString('pt-BR')} XP ganhos hoje`
      } else {
        this.leaderboardMyStatVal.textContent = `$ ${(user.dailyCash || 0).toLocaleString('pt-BR')} ganhos hoje`
      }
    }

    this.leaderboardList.innerHTML = '<div class="leaderboard-loading">Carregando classificação do Firestore...</div>'

    try {
      const data = await usersDB.getDailyLeaderboard(this.currentLeaderboardTab)
      if (!data || data.length === 0) {
        this.leaderboardList.innerHTML = '<div class="leaderboard-loading">Nenhum registro ainda hoje. Seja o primeiro a pontuar!</div>'
        return
      }

      this.leaderboardList.innerHTML = data
        .map((entry, index) => {
          const rank = index + 1
          const rankClass = rank === 1 ? 'lb-rank lb-rank-1' : rank === 2 ? 'lb-rank lb-rank-2' : rank === 3 ? 'lb-rank lb-rank-3' : 'lb-rank'
          const medal = rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : `#${rank}`
          const score = this.currentLeaderboardTab === 'xp'
            ? `${(entry.dailyXp || 0).toLocaleString('pt-BR')} XP`
            : `$ ${(entry.dailyCash || 0).toLocaleString('pt-BR')}`
          const providerIcon = entry.provider === 'google' ? '🇬' : entry.provider === 'playgames' ? '🎮' : '👤'

          return `
            <div class="leaderboard-row ${entry.isCurrentPlayer ? 'player-row' : ''}">
              <span class="${rankClass}">${medal}</span>
              <span class="lb-name" title="${entry.displayName}">${providerIcon} ${entry.displayName}</span>
              <span class="lb-lvl">NV ${entry.level}</span>
              <span class="lb-score">${score}</span>
            </div>
          `
        })
        .join('')
    } catch (err) {
      console.error('Error loading leaderboard:', err)
      this.leaderboardList.innerHTML = '<div class="leaderboard-loading">Erro ao carregar dados online. Exibindo dados locais.</div>'
    }
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
    const remainder = Math.floor(seconds % 60).toString().padStart(2, '0')
    return `${minutes}:${remainder}`
  }

  private showToast(message: string): void {
    this.toastElement.textContent = message
    this.toastElement.classList.add('visible')
    window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => this.toastElement.classList.remove('visible'), 1900)
  }

  private readonly resize = (): void => {
    const width = window.innerWidth
    const height = window.innerHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.input.clear()
      if (this.running && !this.ended && !this.paused) {
        this.setPaused(true)
      }
    }
  }

  get isFastestCabbie(): boolean {
    return this.hasFastestCabbieTitle
  }

  get isUrbanDestroyer(): boolean {
    return this.hasUrbanDestroyerTrophy
  }

  get isSpeedPaintUnlocked(): boolean {
    return this.hasExclusiveSpeedPaint
  }

  get userProfile(): UserProfile {
    return this.currentAuthUser
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.input.dispose()
    this.city.dispose()
    this.pedestrians.dispose()
    this.plane.dispose()
    this.floatingRings.dispose()
    this.projectiles.dispose()
    for (const tank of this.tanks) tank.dispose()
    for (const heli of this.helicopters) heli.dispose()
    for (const car of this.abandonedCars) car.dispose()
    for (const sc of this.strandedCars) {
      sc.car.dispose()
      this.scene.remove(sc.marker)
    }
    this.strandedCars.length = 0
    this.player.dispose()
    this.character.dispose()
    this.pursuit.dispose()
    this.traffic.dispose()
    this.busPassengers.dispose()
    this.sound.dispose()
    this.renderer.dispose()
  }
}
