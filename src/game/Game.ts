import * as THREE from 'three'
import { Car } from './Car'
import { City } from './City'
import { Cockpit } from './Cockpit'
import { Input } from './Input'
import { Missions, type MissionEvent, type MissionState } from './Missions'
import { Pedestrians } from './Pedestrians'
import { Pursuit } from './Pursuit'
import { Sparks } from './Sparks'
import { Sound } from './Sound'
import { StickPerson } from './StickPerson'
import { Traffic } from './Traffic'
import { WantedSystem } from './WantedSystem'

const CASH_KEY = 'smash-city-cash'
const BEST_KEY = 'smash-city-best'

export class Game {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(61, 1, 0.1, 700)
  private readonly sun = new THREE.DirectionalLight(0xffe6bf, 3.2)
  private readonly renderer: THREE.WebGLRenderer
  private readonly city: City
  private readonly pedestrians: Pedestrians
  private readonly player: Car
  private readonly character: StickPerson
  private readonly cockpit: Cockpit
  private readonly input = new Input()
  private readonly wanted = new WantedSystem()
  private readonly pursuit: Pursuit
  private readonly sparks: Sparks
  private readonly traffic: Traffic
  private readonly vehicleButton = document.querySelector<HTMLButtonElement>('#vehicle-button')!
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
  private readonly distanceValue = document.querySelector<HTMLElement>('#distance-value')!
  private readonly timeValue = document.querySelector<HTMLElement>('#time-value')!
  private readonly cashValue = document.querySelector<HTMLElement>('#cash-value')!
  private readonly toastElement = document.querySelector<HTMLElement>('#toast')!
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
  private running = false
  private ended = false
  private lastFrame = 0
  private hudTimer = 0
  private toastTimer = 0
  private elapsed = 0
  private distance = 0
  private cash = Number(localStorage.getItem(CASH_KEY) ?? 0) || 0
  private bestScore = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0
  private lastImpact = 0

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
    this.player = new Car(this.scene, { color: 0xe94f30, playerControlled: true })
    this.player.setPosition(0, 0)
    this.character = new StickPerson(this.scene)
    this.pursuit = new Pursuit(this.scene, this.wanted)
    this.sparks = new Sparks(this.scene)
    this.traffic = new Traffic(this.scene)
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
    this.vehicleButton.addEventListener('click', () => this.toggleVehicle())
    document.querySelector<HTMLButtonElement>('#sound-button')!.addEventListener('click', (event) => {
      const button = event.currentTarget as HTMLButtonElement
      const enabled = this.sound.toggle()
      button.classList.toggle('muted', !enabled)
      button.setAttribute('aria-label', enabled ? 'Desativar som' : 'Ativar som')
      button.textContent = enabled ? '♪' : '×'
    })
  }

  private bindControls(): void {
    document.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'c' && !event.repeat) this.toggleCamera()
      if (event.key.toLowerCase() === 'e' && !event.repeat) this.toggleVehicle()
      if (event.key === 'Enter' && !this.running && !this.ended) this.start()
    })
  }

  private start(): void {
    this.input.clear()
    this.pursuit.reset()
    this.wanted.reset()
    this.missions.reset()
    this.city.clear()
    this.pedestrians.clear()
    this.traffic.reset()
    this.player.setPosition(0, 0)
    this.character.setPosition(-1.8, 0, 0)
    this.character.root.visible = false
    this.inVehicle = true
    this.city.ensureAround(0)
    this.pedestrians.ensureAround(0)
    this.elapsed = 0
    this.distance = 0
    this.hudTimer = 0
    this.lastImpact = 0
    this.running = true
    this.ended = false
    this.updateVehicleButton()
    this.startOverlay.classList.add('hidden')
    this.endOverlay.classList.add('hidden')
    void this.sound.start()
    this.updateMissionCards()
    this.updateHud()
    this.showToast('PERSEGUIÇÃO INICIADA')
  }

  private readonly frame = (timestamp: number): void => {
    const dt = this.lastFrame === 0 ? 0 : Math.min((timestamp - this.lastFrame) / 1000, 0.05)
    this.lastFrame = timestamp
    if (this.running) this.update(dt)
    this.updateCamera(Math.min(1, dt * (this.cameraMode === 'cockpit' ? 12 : 5)))
    const actorPosition = this.inVehicle ? this.player.root.position : this.character.root.position
    this.occlusionTarget.set(actorPosition.x, actorPosition.y + (this.inVehicle ? 1.15 : 1.1), actorPosition.z)
    this.city.updateOcclusion(this.camera.position, this.occlusionTarget)
    this.sparks.update(dt)
    this.renderer.render(this.scene, this.camera)
    requestAnimationFrame(this.frame)
  }

  private update(dt: number): void {
    this.elapsed += dt
    const controls = this.input.read()
    let collided = false
    if (this.inVehicle) {
      collided = this.player.drive(controls, dt, (x, z, radius) => this.city.collides(x, z, radius))
      this.cockpit.update(controls.steer, dt)
    } else {
      this.character.update(dt, controls, (x, z, radius) => this.city.collides(x, z, radius))
      this.cockpit.update(0, dt)
    }
    const actorPosition = this.inVehicle ? this.player.root.position : this.character.root.position
    const actorYaw = this.inVehicle ? this.player.yaw : this.character.yaw
    const actorSpeed = this.inVehicle ? this.player.speed : this.character.speed
    const speed = Math.abs(actorSpeed)
    this.sun.position.set(actorPosition.x - 36, 62, actorPosition.z - 28)
    this.sun.target.position.set(actorPosition.x, 0, actorPosition.z)
    const distanceDelta = speed * dt
    this.distance += distanceDelta
    this.city.ensureAround(actorPosition.z)
    this.pedestrians.ensureAround(actorPosition.z)
    this.city.update(dt)
    const traffic = this.traffic.update(dt, this.player)
    const pedestrianHits = this.pedestrians.update(dt, actorPosition, actorYaw, this.inVehicle ? speed : 0)

    for (const point of traffic.collisionPoints) this.sparks.emit(point)
    if (traffic.playerCollisions > 0) {
      this.addHeat(3 * traffic.playerCollisions)
      this.sound.effect('crash')
      this.showToast('COLISÃO NO TRÂNSITO // POLÍCIA ALERTADA')
    }

    if (collided && this.elapsed - this.lastImpact > 0.8) {
      this.lastImpact = this.elapsed
      this.addHeat(8)
      this.sound.effect('crash')
      this.showToast('COLISÃO // A POLÍCIA FOI ALERTADA')
    }

    if (pedestrianHits > 0) {
      this.addHeat(6 * pedestrianHits)
      this.sound.effect('crash')
      this.showToast(pedestrianHits > 1 ? 'PEDESTRES ATINGIDOS // POLÍCIA ALERTADA' : 'PEDESTRE ATINGIDO // POLÍCIA ALERTADA')
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

    const pursuit = this.pursuit.update(dt, this.player, actorPosition, !this.inVehicle, actorSpeed)
    for (const point of pursuit.collisionPoints) this.sparks.emit(point)
    if (this.wanted.level > oldLevel) this.onLevelUp()
    if (pursuit.vehicleCollisions > 0) {
      this.sound.effect('crash')
      this.showToast(pursuit.vehicleCollisions > 1 ? 'BATIDA EM VIATURAS // ALERTA ELEVADO' : 'BATIDA COM VIATURA // ALERTA ELEVADO')
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
    }
    const completed = this.missions.update(dt, event)
    for (const mission of completed) this.completeMission(mission)
    this.sound.update(this.inVehicle ? this.player.speed : 0, this.wanted.level)

    if (pursuit.busted) this.endRun()
    this.hudTimer += dt
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0
      this.updateHud()
      this.updateMissionCards()
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
    this.showToast(`NÍVEL ${level} // ${level >= 7 ? 'RESPOSTA TÁTICA' : 'POLÍCIA ALERTADA'}`)
    this.updateHud()
  }

  private completeMission(mission: MissionState): void {
    this.cash += mission.reward
    localStorage.setItem(CASH_KEY, String(this.cash))
    this.sound.effect('mission')
    this.showToast(`CONTRATO CUMPRIDO  +$${mission.reward}`)
    this.updateHud()
  }

  private endRun(): void {
    this.running = false
    this.ended = true
    this.input.clear()
    this.updateVehicleButton()
    const score = Math.floor(this.distance + this.elapsed * 11 + this.wanted.level * 50)
    this.bestScore = Math.max(this.bestScore, score)
    localStorage.setItem(BEST_KEY, String(this.bestScore))
    document.querySelector<HTMLElement>('#final-score')!.textContent = score.toLocaleString('pt-BR')
    document.querySelector<HTMLElement>('#best-score')!.textContent = this.bestScore.toLocaleString('pt-BR')
    document.querySelector<HTMLElement>('#end-summary')!.textContent = `Você percorreu ${Math.floor(this.distance)} m, resistiu por ${this.formatTime(this.elapsed)} e chegou ao nível ${this.wanted.level} de procurado.`
    document.querySelector<HTMLElement>('#end-title')!.innerHTML = this.wanted.level >= 8 ? 'CAOS<br><em>NA CIDADE.</em>' : 'VOCÊ FOI<br><em>ALCANÇADO.</em>'
    this.endOverlay.classList.remove('hidden')
    this.updateHud()
  }

  private toggleVehicle(): void {
    if (!this.running) return
    if (this.inVehicle) this.exitVehicle()
    else this.enterVehicle()
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
    this.character.setPosition(exitPosition.x, exitPosition.z, carYaw)
    this.character.root.visible = true
    this.player.setPosition(carX, carZ, carYaw)
    this.player.root.visible = true
    this.inVehicle = false
    if (this.cameraMode === 'cockpit') this.cameraMode = 'chase'
    this.input.clear()
    this.updateVehicleButton()
    this.updateCameraButton()
    this.updateCamera(1)
    this.showToast('A PÉ // WASD PARA CAMINHAR · E PARA VOLTAR')
  }

  private enterVehicle(): void {
    if (this.character.root.position.distanceTo(this.player.root.position) > 3.2) {
      this.showToast('CHEGUE PERTO DO CARRO PARA ENTRAR')
      return
    }
    const position = this.character.root.position
    this.character.setPosition(position.x, position.z, this.player.yaw)
    this.character.root.visible = false
    this.player.setPosition(this.player.root.position.x, this.player.root.position.z, this.player.yaw)
    this.inVehicle = true
    this.input.clear()
    this.updateVehicleButton()
    this.updateCameraButton()
    this.updateCamera(1)
    this.showToast('AO VOLANTE // E PARA SAIR')
  }

  private updateVehicleButton(): void {
    this.vehicleButton.classList.toggle('hidden', !this.running)
    this.vehicleButton.textContent = this.inVehicle ? 'SAIR DO CARRO · E' : 'ENTRAR NO CARRO · E'
    this.vehicleButton.setAttribute('aria-label', this.inVehicle ? 'Sair do carro (E)' : 'Entrar no carro (E)')
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
    const position = this.inVehicle ? this.player.root.position : this.character.root.position
    const yaw = this.inVehicle ? this.player.yaw : this.character.yaw
    if (this.cameraMode === 'quarter') {
      this.cameraOffset.set(27, 66, 34).applyAxisAngle(this.verticalAxis, yaw)
      if (this.camera.fov !== 56) {
        this.camera.fov = 56
        this.camera.updateProjectionMatrix()
      }
    } else if (this.cameraMode === 'cockpit' && this.inVehicle) {
      this.cameraOffset.set(0, 1.56, -0.18).applyAxisAngle(this.verticalAxis, yaw)
      if (this.camera.fov !== 76) {
        this.camera.fov = 76
        this.camera.updateProjectionMatrix()
      }
    } else {
      this.cameraOffset.set(0, 6.1, 12.2).applyAxisAngle(this.verticalAxis, yaw)
      if (this.camera.fov !== 61) {
        this.camera.fov = 61
        this.camera.updateProjectionMatrix()
      }
    }
    this.cameraTarget.set(position.x + this.cameraOffset.x, position.y + this.cameraOffset.y, position.z + this.cameraOffset.z)
    this.camera.position.lerp(this.cameraTarget, alpha)
    const lookAhead = this.cameraMode === 'quarter' ? 11 : this.cameraMode === 'cockpit' && this.inVehicle ? 12 : 5.2
    const lookHeight = this.cameraMode === 'cockpit' && this.inVehicle ? 1.56 : this.cameraMode === 'quarter' ? 1.1 : 1.3
    this.lookTarget.set(position.x - Math.sin(yaw) * lookAhead, position.y + lookHeight, position.z - Math.cos(yaw) * lookAhead)
    this.camera.lookAt(this.lookTarget)
    this.cockpit.setVisible(this.inVehicle && this.cameraMode === 'cockpit')
    this.cockpit.syncCamera(this.camera)
    this.player.root.visible = !(this.inVehicle && this.cameraMode === 'cockpit')
  }

  private toggleCamera(): void {
    if (this.inVehicle) {
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
        ? 'VISÃO INTERNA // VOLANTE ATIVO'
        : 'CÂMERA TRASEIRA // 3D'
    this.showToast(message)
  }

  private updateHud(): void {
    const kmh = Math.floor(Math.abs(this.inVehicle ? this.player.speed : this.character.speed) * 3.6)
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
    if (document.hidden) this.input.clear()
  }
}
