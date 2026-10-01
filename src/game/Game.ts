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
  private readonly startOverlay = document.querySelector<HTMLElement>('#start-overlay')!
  private readonly endOverlay = document.querySelector<HTMLElement>('#end-overlay')!
  private readonly missionCards: HTMLElement[] = []
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
    this.player = new Car(this.scene, { color: 0xe94f30, playerControlled: true })
    this.player.setPosition(0, 0)
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
    this.missionList.innerHTML = ''
    for (let slot = 0; slot < 3; slot += 1) {
      const card = document.createElement('div')
      card.className = 'mission'
      this.missionList.appendChild(card)
      this.missionCards.push(card)
    }

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
      if (car !== this.monsterTruck) car.dispose()
    }
    this.abandonedCars.length = 0
    const mtLoc = this.city.getMonsterTruckPlazaLocation()
    this.monsterTruck.setPosition(mtLoc.x, mtLoc.z, 0)
    this.monsterTruck.resetDamage()
    this.monsterTruck.toggleRobotMode(false)
    this.abandonedCars.push(this.monsterTruck)
    this.monsterCrushCount = 0
    this.monsterCrushedCars.clear()
    this.monsterMissionCrushCompleted = false
    this.monsterMissionKongCompleted = false
    this.monsterBlasterCooldown = 0
    this.planeKingKongHitCooldown = 0
    this.player.dispose()
    this.player = new Car(this.scene, { color: 0xe94f30, playerControlled: true })
    this.player.setPosition(0, 0)
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
    const dt = this.lastFrame === 0 ? 0 : Math.min((timestamp - this.lastFrame) / 1000, 0.05)
    this.lastFrame = timestamp
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
      this.sound.effect('crash')
      this.showToast(pedestrianHits > 1 ? `PEDESTRES ATROPELADOS // PROCURADO +${pedestrianHits} NÍVEIS!` : 'PEDESTRE ATROPELADO // PROCURADO +1 NÍVEL!')
    }

    const coins = this.city.collectAt(actorPosition.x, actorPosition.z)
    if (coins > 0) {
      this.cash += coins * 25
      localStorage.setItem(CASH_KEY, String(this.cash))
      this.sound.effect('coin')
      this.showToast(`FICHA RECOLHIDA  +$${coins * 25}`)
    }

    const oldLevel = this.wanted.level
    this.wanted.update(dt, actorSpeed)

    const pursuit = this.pursuit.update(dt, this.player, actorPosition, !this.inVehicle && !this.inPlane, actorSpeed)
    for (const point of pursuit.collisionPoints) this.sparks.emit(point)
    for (const pt of pursuit.explosions) {
      this.sparks.emitExplosion(pt)
      this.sound.effect('explosion')
      this.cash += 200
      localStorage.setItem(CASH_KEY, String(this.cash))
      this.showToast('VIATURA DESTRUÍDA! +$200')
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
    this.sound.effect('mission')
    this.showToast(`CONTRATO CUMPRIDO  +$${mission.reward}`)
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

        // Manual firing only when player explicitly triggers shoot control (F, Enter, or Shoot Button)
        if (controls.shoot && this.monsterBlasterCooldown <= 0) {
          this.fireMonsterBlaster()
        }
      }
    }
    this.updateMonsterMissionUI()
  }

  private toggleMonsterTransformation(): void {
    if (!this.inVehicle || this.player.kind !== 'monster_truck') return
    const isRobot = this.player.toggleRobotMode()
    this.sound.effect('transform')
    this.sparks.emitExplosion(this.player.root.position)
    if (isRobot) {
      this.showToast('🤖 TRANSFORMAÇÃO CONCLUÍDA: ROBÔ TRANSFORMERS! DISPARE O CANHÃO NO KING KONG!')
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
    const position = this.inPlane
      ? this.plane.root.position
      : this.inVehicle
        ? this.player.root.position
        : this.character.root.position
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
    this.missions.active.forEach((mission, index) => {
      const card = this.missionCards[index]
      if (!card) return
      const progress = Math.floor(mission.progress)
      const percent = Math.min(100, (mission.progress / mission.target) * 100)
      card.classList.toggle('completed', mission.completed)
      card.innerHTML = `
        <div class="mission-title">${mission.completed ? '✓ ' : ''}${mission.title}</div>
        <div class="mission-reward">+$${mission.reward}</div>
        <div class="mission-progress"><div class="mission-track"><div class="mission-fill" style="width:${percent}%"></div></div><span class="mission-count">${progress}/${mission.target}${mission.unit === 'm' ? 'm' : ''}</span></div>
      `
    })
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
    this.player.dispose()
    this.character.dispose()
    this.pursuit.dispose()
    this.traffic.dispose()
    this.busPassengers.dispose()
    this.sound.dispose()
    this.renderer.dispose()
  }
}
