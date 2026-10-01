import * as THREE from 'three'
import type { Car } from './Car'
import type { City, PlazaInfo, LagoonInfo } from './City'

export class Minimap {
  private readonly shell: HTMLElement
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly toggleButton: HTMLButtonElement | null
  private radarSweep = 0
  private expanded = false

  constructor(shell: HTMLElement) {
    this.shell = shell
    this.canvas = shell.querySelector<HTMLCanvasElement>('#minimap-canvas')!
    this.ctx = this.canvas.getContext('2d', { alpha: true })!
    this.toggleButton = shell.querySelector<HTMLButtonElement>('#minimap-toggle')

    this.toggleButton?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.toggleExpand()
    })

    this.shell.addEventListener('click', (e) => {
      if (!this.expanded) {
        this.toggleExpand(true)
      } else if (e.target === this.shell) {
        this.toggleExpand(false)
      }
    })
  }

  get isExpanded(): boolean {
    return this.expanded
  }

  toggleExpand(force?: boolean): void {
    this.expanded = force !== undefined ? force : !this.expanded
    this.shell.classList.toggle('expanded', this.expanded)
    if (this.expanded) {
      this.canvas.width = 600
      this.canvas.height = 600
      if (this.toggleButton) {
        this.toggleButton.textContent = '✕'
        this.toggleButton.setAttribute('aria-label', 'Fechar mapa')
        this.toggleButton.setAttribute('title', 'Fechar mapa (M ou Esc)')
      }
    } else {
      this.canvas.width = 296
      this.canvas.height = 296
      if (this.toggleButton) {
        this.toggleButton.textContent = '⤢'
        this.toggleButton.setAttribute('aria-label', 'Expandir mapa')
        this.toggleButton.setAttribute('title', 'Expandir mapa (M)')
      }
    }
  }

  update(
    dt: number,
    playerPosition: THREE.Vector3,
    playerYaw: number,
    inVehicle: boolean,
    policeCars: Car[],
    trafficCars: Car[],
    city: City,
    planeInfo?: { position: THREE.Vector3; yaw: number; inPlane: boolean; state: string },
    floatingRings?: { position: THREE.Vector3; collected: boolean }[],
    tanks?: { root: THREE.Group; yaw: number; exploded: boolean }[],
    helicopters?: { root: THREE.Group; yaw: number; exploded: boolean }[],
    tankerMissionStage?: 'none' | 'survive' | 'deliver' | 'completed',
    busPassengers?: { x: number; z: number; collected: boolean }[],
    monsterTruckInfo?: { position: THREE.Vector3; inMonsterTruck: boolean },
  ): void {
    this.radarSweep = (this.radarSweep + dt * 2.2) % (Math.PI * 2)

    const ctx = this.ctx
    const width = this.canvas.width
    const height = this.canvas.height
    const cx = width / 2
    const cy = height / 2
    const isExpanded = this.expanded
    const radius = isExpanded ? Math.min(width, height) / 2 - 8 : cx - 4
    const scale = isExpanded ? 0.28 : 0.54 // Na visão normal expandida mostra ~300m de raio
    const viewRange = radius / scale

    ctx.clearRect(0, 0, width, height)

    // Save and clip to circular radar or borderless modal rect
    ctx.save()
    ctx.beginPath()
    if (isExpanded) {
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(0, 0, width, height, 22)
      } else {
        ctx.rect(0, 0, width, height)
      }
    } else {
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    }
    ctx.clip()

    // 1. Radar background
    ctx.fillStyle = isExpanded ? '#0c100e' : '#0f1412'
    ctx.fillRect(0, 0, width, height)

    // 2. City limits & Rivers
    const riverLeftX = city.riverLeftX
    const riverRightX = city.riverRightX
    const riverWidth = city.riverWidth

    // West River
    this.drawRiver(ctx, cx, cy, playerPosition, riverLeftX, riverWidth, scale, height, 'OESTE')
    // East River
    this.drawRiver(ctx, cx, cy, playerPosition, riverRightX, riverWidth, scale, height, 'LESTE')

    // 3. Street Grid (Roads & Bridges)
    this.drawRoadGrid(ctx, cx, cy, playerPosition, scale, viewRange, city)

    // 4. Airport Runway
    this.drawRunway(ctx, cx, cy, playerPosition, scale, city.getRunwayInfo())

    // 5. Plazas (Praças da cidade)
    this.drawPlazas(ctx, cx, cy, playerPosition, scale, city.getPlazas())

    // 5.2. Lagoons (Lagoas da cidade)
    this.drawLagoons(ctx, cx, cy, playerPosition, scale, city.getLagoonsForMinimap(playerPosition.z))

    // 5.5. Fuel Service Garage (Garagem de Combustível indicada no minimapa e mapa)
    this.drawGarage(ctx, cx, cy, playerPosition, scale, radius, city.getFuelGarageInfo(), tankerMissionStage ?? 'none')

    // 5.6. King Kong Building (Arranha-céu com o King Kong no topo)
    this.drawKingKong(ctx, cx, cy, playerPosition, scale, radius, city.getKingKongLocation())

    // 5.8. Bus Passengers (Pessoas marcadas para o ônibus)
    if (busPassengers) {
      this.drawBusPassengers(ctx, cx, cy, playerPosition, scale, radius, busPassengers)
    }

    // 6. Floating Rings (Círculos Flutuantes)
    if (floatingRings) {
      for (const ring of floatingRings) {
        if (ring.collected) continue
        const dx = (ring.position.x - playerPosition.x) * scale
        const dz = (ring.position.z - playerPosition.z) * scale
        if (dx * dx + dz * dz < radius * radius) {
          ctx.strokeStyle = '#00f0ff'
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.arc(cx + dx, cy + dz, 4.2, 0, Math.PI * 2)
          ctx.stroke()
          ctx.fillStyle = 'rgba(0, 240, 255, 0.25)'
          ctx.fill()
        }
      }
    }

    // 7. Uncollected Cash Coins
    ctx.fillStyle = '#f7bf4a'
    for (const coin of city.coins) {
      if (!coin.alive) continue
      const dx = (coin.x - playerPosition.x) * scale
      const dz = (coin.z - playerPosition.z) * scale
      if (dx * dx + dz * dz < radius * radius) {
        ctx.beginPath()
        ctx.arc(cx + dx, cy + dz, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // 8. Civilian Traffic
    ctx.fillStyle = '#b3bcbb'
    for (const car of trafficCars) {
      const pos = car.root.position
      const dx = (pos.x - playerPosition.x) * scale
      const dz = (pos.z - playerPosition.z) * scale
      if (dx * dx + dz * dz < (radius - 4) * (radius - 4)) {
        ctx.beginPath()
        ctx.arc(cx + dx, cy + dz, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // 9. Twin-Engine Airplane (Avião Bimotor) on ground / waiting
    if (planeInfo && !planeInfo.inPlane) {
      const dx = (planeInfo.position.x - playerPosition.x) * scale
      const dz = (planeInfo.position.z - playerPosition.z) * scale
      if (dx * dx + dz * dz < (radius - 4) * (radius - 4)) {
        ctx.save()
        ctx.translate(cx + dx, cy + dz)
        ctx.fillStyle = '#38bdf8'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.2
        ctx.font = '900 12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('✈', 0, 0)
        ctx.fillStyle = '#38bdf8'
        ctx.font = '700 7px monospace'
        ctx.fillText('AVIÃO', 0, 9)
        ctx.restore()
      }
    }

    // 9.5. Monster Truck in Plaza (when not player driving it)
    if (monsterTruckInfo && !monsterTruckInfo.inMonsterTruck) {
      this.drawMonsterTruck(ctx, cx, cy, playerPosition, scale, radius, monsterTruckInfo)
    }

    // 7. Police Units (Veículos Policiais Próximos)
    const now = performance.now()
    const flashPhase = Math.floor(now / 220) % 2 === 0
    const alertColor = flashPhase ? '#ff3844' : '#288eff'
    const pulseRadius = 5 + Math.sin(now * 0.012) * 2.5

    for (const cop of policeCars) {
      const pos = cop.root.position
      const dx = (pos.x - playerPosition.x) * scale
      const dz = (pos.z - playerPosition.z) * scale
      const dist = Math.hypot(dx, dz)

      if (dist < radius - 6) {
        // Police inside radar area
        ctx.strokeStyle = flashPhase ? 'rgba(255, 56, 68, 0.45)' : 'rgba(40, 142, 255, 0.45)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(cx + dx, cy + dz, pulseRadius, 0, Math.PI * 2)
        ctx.stroke()

        ctx.fillStyle = alertColor
        ctx.beginPath()
        ctx.arc(cx + dx, cy + dz, 4.2, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(cx + dx, cy + dz, 1.8, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Police outside radar: draw clamped warning chevron on rim
        const angle = Math.atan2(dz, dx)
        const edgeX = cx + Math.cos(angle) * (radius - 8)
        const edgeY = cy + Math.sin(angle) * (radius - 8)

        ctx.save()
        ctx.translate(edgeX, edgeY)
        ctx.rotate(angle)

        ctx.fillStyle = alertColor
        ctx.beginPath()
        ctx.moveTo(4, 0)
        ctx.lineTo(-5, -4)
        ctx.lineTo(-3, 0)
        ctx.lineTo(-5, 4)
        ctx.closePath()
        ctx.fill()

        ctx.restore()
      }
    }

    // 8. Military Tanks
    if (tanks) {
      for (const tank of tanks) {
        if (tank.exploded) continue
        const pos = tank.root.position
        const dx = (pos.x - playerPosition.x) * scale
        const dz = (pos.z - playerPosition.z) * scale
        const dist = Math.hypot(dx, dz)

        if (dist < radius - 6) {
          ctx.save()
          ctx.translate(cx + dx, cy + dz)
          ctx.rotate(tank.yaw)

          // Heavy chassis box
          ctx.fillStyle = '#4d6342'
          ctx.strokeStyle = '#a3e635'
          ctx.lineWidth = 1.4
          ctx.fillRect(-4.5, -6, 9, 12)
          ctx.strokeRect(-4.5, -6, 9, 12)

          // Cannon barrel pointing forward
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(0, -11)
          ctx.stroke()

          ctx.restore()

          // Text label
          ctx.fillStyle = '#a3e635'
          ctx.font = '700 7px monospace'
          ctx.textAlign = 'center'
          ctx.fillText('TANQUE', cx + dx, cy + dz + 10)
        }
      }
    }

    // 9. Military Helicopters
    if (helicopters) {
      for (const heli of helicopters) {
        if (heli.exploded) continue
        const pos = heli.root.position
        const dx = (pos.x - playerPosition.x) * scale
        const dz = (pos.z - playerPosition.z) * scale
        const dist = Math.hypot(dx, dz)

        if (dist < radius - 6) {
          ctx.save()
          ctx.translate(cx + dx, cy + dz)

          // Rotating rotor cross
          const rotorAngle = (now * 0.02) % (Math.PI * 2)
          ctx.rotate(rotorAngle)
          ctx.strokeStyle = '#f59e0b'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(-7, 0)
          ctx.lineTo(7, 0)
          ctx.moveTo(0, -7)
          ctx.lineTo(0, 7)
          ctx.stroke()

          // Heli core
          ctx.fillStyle = '#ef4444'
          ctx.beginPath()
          ctx.arc(0, 0, 3.2, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()

          // Text label
          ctx.fillStyle = '#f59e0b'
          ctx.font = '700 7px monospace'
          ctx.textAlign = 'center'
          ctx.fillText('HELI', cx + dx, cy + dz + 11)
        }
      }
    }

    // 10. Distance rings and crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, 48 * scale, 0, Math.PI * 2) // ~48m (1 block)
    ctx.arc(cx, cy, 96 * scale, 0, Math.PI * 2) // ~96m (2 blocks)
    if (isExpanded) {
      ctx.arc(cx, cy, 144 * scale, 0, Math.PI * 2)
      ctx.arc(cx, cy, 192 * scale, 0, Math.PI * 2)
      ctx.arc(cx, cy, 240 * scale, 0, Math.PI * 2)
    }
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx - radius, cy)
    ctx.lineTo(cx + radius, cy)
    ctx.moveTo(cx, cy - radius)
    ctx.lineTo(cx, cy + radius)
    ctx.stroke()

    // 9. Radar sweep effect
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(this.radarSweep)
    const sweepGradient = ctx.createLinearGradient(0, 0, radius, 0)
    sweepGradient.addColorStop(0, 'rgba(255, 93, 49, 0.22)')
    sweepGradient.addColorStop(0.7, 'rgba(255, 93, 49, 0.08)')
    sweepGradient.addColorStop(1, 'rgba(255, 93, 49, 0)')
    ctx.fillStyle = sweepGradient
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, radius, 0, 0.45)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // 10. The Player at center
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-playerYaw)

    if (planeInfo?.inPlane) {
      // Airplane flight silhouette
      ctx.fillStyle = '#38bdf8'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(0, -11)
      ctx.lineTo(3, -4)
      ctx.lineTo(13, 0)
      ctx.lineTo(13, 3)
      ctx.lineTo(3, 2)
      ctx.lineTo(3, 7)
      ctx.lineTo(7, 10)
      ctx.lineTo(7, 12)
      ctx.lineTo(0, 10)
      ctx.lineTo(-7, 12)
      ctx.lineTo(-7, 10)
      ctx.lineTo(-3, 7)
      ctx.lineTo(-3, 2)
      ctx.lineTo(-13, 3)
      ctx.lineTo(-13, 0)
      ctx.lineTo(-3, -4)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    } else if (inVehicle) {
      // Forward headlight beam
      const beamGrad = ctx.createLinearGradient(0, 0, 0, -28)
      beamGrad.addColorStop(0, 'rgba(255, 240, 180, 0.35)')
      beamGrad.addColorStop(1, 'rgba(255, 240, 180, 0)')
      ctx.fillStyle = beamGrad
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-14, -28)
      ctx.lineTo(14, -28)
      ctx.closePath()
      ctx.fill()

      // Vehicle triangle arrow
      ctx.fillStyle = '#ff5d31'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(0, -9)
      ctx.lineTo(6.5, 7)
      ctx.lineTo(0, 4)
      ctx.lineTo(-6.5, 7)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    } else {
      // Pedestrian on foot
      ctx.fillStyle = '#ff7849'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Direction notch
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(0, -6)
      ctx.lineTo(2.5, -2)
      ctx.lineTo(-2.5, -2)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()

    // End circle clipping
    ctx.restore()
  }

  private drawRiver(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    player: THREE.Vector3,
    riverCenterX: number,
    riverWidth: number,
    scale: number,
    canvasHeight: number,
    label: string,
  ): void {
    const rx = cx + (riverCenterX - player.x) * scale
    const rw = riverWidth * scale
    const xMin = rx - rw / 2
    const xMax = rx + rw / 2

    // If river is within/near canvas bounds
    if (xMax > 0 && xMin < this.canvas.width) {
      // Water body
      ctx.fillStyle = '#207ca8'
      ctx.fillRect(xMin, 0, rw, canvasHeight)

      // Embankment shoreline border lines
      ctx.strokeStyle = '#5cb8df'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(xMin, 0)
      ctx.lineTo(xMin, canvasHeight)
      ctx.moveTo(xMax, 0)
      ctx.lineTo(xMax, canvasHeight)
      ctx.stroke()

      // River label
      ctx.save()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
      ctx.font = '700 8px monospace'
      ctx.textAlign = 'center'
      ctx.translate(rx, cy)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(`RIO // LIMITE ${label}`, 0, 3)
      ctx.restore()
    }
  }

  private drawRoadGrid(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    player: THREE.Vector3,
    scale: number,
    viewRange: number,
    city: City,
  ): void {
    const block = city.blockSize
    const roadWidth = 15 * scale

    ctx.fillStyle = '#2a3431'

    // Longitudinal Avenues (X = road * block)
    for (let road = city.roadMin; road <= city.roadMax; road += 1) {
      const roadWorldX = road * block
      if (Math.abs(roadWorldX - player.x) <= viewRange + 20) {
        const rx = cx + (roadWorldX - player.x) * scale - roadWidth / 2
        ctx.fillRect(rx, 0, roadWidth, this.canvas.height)

        // Center dash line
        ctx.strokeStyle = 'rgba(230, 201, 120, 0.4)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 6])
        ctx.beginPath()
        ctx.moveTo(rx + roadWidth / 2, 0)
        ctx.lineTo(rx + roadWidth / 2, this.canvas.height)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Cross Streets (Z = road * block)
    const minZBlock = Math.floor((player.z - viewRange) / block)
    const maxZBlock = Math.ceil((player.z + viewRange) / block)

    for (let roadZIndex = minZBlock; roadZIndex <= maxZBlock; roadZIndex += 1) {
      const roadWorldZ = roadZIndex * block
      const rz = cy + (roadWorldZ - player.z) * scale - roadWidth / 2
      ctx.fillRect(0, rz, this.canvas.width, roadWidth)

      // Center dash line
      ctx.strokeStyle = 'rgba(230, 201, 120, 0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.moveTo(0, rz + roadWidth / 2)
      ctx.lineTo(this.canvas.width, rz + roadWidth / 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  private drawPlazas(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    player: THREE.Vector3,
    scale: number,
    plazas: readonly PlazaInfo[],
  ): void {
    for (const plaza of plazas) {
      const px = cx + (plaza.x - player.x) * scale
      const py = cy + (plaza.z - player.z) * scale
      const pw = plaza.width * scale
      const pd = plaza.depth * scale

      // If near canvas
      if (px + pw > 0 && px - pw < this.canvas.width && py + pd > 0 && py - pd < this.canvas.height) {
        // Park grass fill
        ctx.fillStyle = '#347a38'
        ctx.strokeStyle = '#5bb862'
        ctx.lineWidth = 1.5
        ctx.fillRect(px - pw / 2, py - pd / 2, pw, pd)
        ctx.strokeRect(px - pw / 2, py - pd / 2, pw, pd)

        // Center fountain circle
        ctx.fillStyle = '#38bdf8'
        ctx.beginPath()
        ctx.arc(px, py, 3.8, 0, Math.PI * 2)
        ctx.fill()

        // Fountain outer ring
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()

        // Plaza text name
        ctx.fillStyle = '#ffffff'
        ctx.font = '700 7px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(plaza.name.toUpperCase(), px, py - pd / 2 - 3)
      }
    }
  }

  private drawLagoons(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    player: THREE.Vector3,
    scale: number,
    lagoons: LagoonInfo[],
  ): void {
    for (const lagoon of lagoons) {
      const lx = cx + (lagoon.x - player.x) * scale
      const ly = cy + (lagoon.z - player.z) * scale
      const lr = lagoon.radius * scale

      if (lx + lr > 0 && lx - lr < this.canvas.width && ly + lr > 0 && ly - lr < this.canvas.height) {
        const boxSize = 36 * scale
        ctx.fillStyle = '#347a38'
        ctx.fillRect(lx - boxSize / 2, ly - boxSize / 2, boxSize, boxSize)

        ctx.fillStyle = '#2563eb'
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(lx, ly, lr, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#ffffff'
        ctx.font = '700 7px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(lagoon.name.toUpperCase(), lx, ly - lr - 3)
      }
    }
  }

  private drawRunway(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    player: THREE.Vector3,
    scale: number,
    runway: { x: number; zStart: number; zEnd: number; width: number },
  ): void {
    const rx = cx + (runway.x - player.x) * scale
    const rzStart = cy + (runway.zStart - player.z) * scale
    const rzEnd = cy + (runway.zEnd - player.z) * scale
    const rw = runway.width * scale
    const rz = Math.min(rzStart, rzEnd)
    const rh = Math.abs(rzEnd - rzStart)

    if (rx + rw > 0 && rx - rw < this.canvas.width && rz + rh > 0 && rz < this.canvas.height) {
      // Runway asphalt deck
      ctx.fillStyle = '#111518'
      ctx.strokeStyle = '#f5b700'
      ctx.lineWidth = 1.4
      ctx.fillRect(rx - rw / 2, rz, rw, rh)
      ctx.strokeRect(rx - rw / 2, rz, rw, rh)

      // Centerline
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.6
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.moveTo(rx, rz)
      ctx.lineTo(rx, rz + rh)
      ctx.stroke()
      ctx.setLineDash([])

      // Runway text label
      ctx.fillStyle = '#38bdf8'
      ctx.font = '700 8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('AEROPORTO', rx, rz - 4)
    }
  }

  private drawGarage(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    player: THREE.Vector3,
    scale: number,
    radius: number,
    garage: { x: number; z: number; width: number; depth: number; deliveryX: number; deliveryZ: number; deliveryRadius: number },
    missionStage: 'none' | 'survive' | 'deliver' | 'completed',
  ): void {
    const isDeliver = missionStage === 'deliver'
    const gx = cx + (garage.x - player.x) * scale
    const gz = cy + (garage.z - player.z) * scale
    const gw = garage.width * scale
    const gd = garage.depth * scale

    const dx = cx + (garage.deliveryX - player.x) * scale
    const dz = cy + (garage.deliveryZ - player.z) * scale
    const dist = Math.hypot(garage.deliveryX - player.x, garage.deliveryZ - player.z)

    // 1. Garage Apron & Building footprint on the map
    if (gx + gw > 0 && gx - gw < this.canvas.width && gz + gd > 0 && gz - gd < this.canvas.height) {
      // Apron ground
      ctx.fillStyle = isDeliver ? '#3d2f16' : '#222927'
      ctx.strokeStyle = isDeliver ? '#ffb703' : '#e6a122'
      ctx.lineWidth = isDeliver ? 2 : 1.4
      ctx.fillRect(gx - gw / 2, gz - gd / 2, gw, gd)
      ctx.strokeRect(gx - gw / 2, gz - gd / 2, gw, gd)

      // Delivery Bay Circle
      const dRad = garage.deliveryRadius * scale
      ctx.fillStyle = isDeliver ? 'rgba(255, 183, 3, 0.4)' : 'rgba(230, 161, 34, 0.25)'
      ctx.beginPath()
      ctx.arc(dx, dz, dRad, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = isDeliver ? '#ffb703' : '#f59e0b'
      ctx.lineWidth = 1.6
      ctx.stroke()

      // Garage Label
      ctx.fillStyle = isDeliver ? '#ffb703' : '#f7bf4a'
      ctx.font = '700 8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(isDeliver ? '🎯 GARAGEM' : 'GARAGEM', gx, gz - gd / 2 - 4)
    }

    // 2. High-Visibility Mission 2 Waypoint Indicator
    if (isDeliver) {
      const pulseTime = Date.now() / 160
      const pulse = 1 + 0.35 * Math.sin(pulseTime)

      // Check if delivery point is within the radar boundary
      const distFromCenterSq = (dx - cx) * (dx - cx) + (dz - cy) * (dz - cy)
      const maxRad = radius - 14

      if (distFromCenterSq <= maxRad * maxRad) {
        // Delivery bay is inside radar view! Draw pulsating waypoint beacon
        ctx.strokeStyle = '#ffb703'
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.arc(dx, dz, 8 * pulse, 0, Math.PI * 2)
        ctx.stroke()

        ctx.fillStyle = '#ff5d31'
        ctx.beginPath()
        ctx.arc(dx, dz, 4.5, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.font = '800 9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`ENTREGA [${Math.round(dist)}m]`, dx, dz - 12)
      } else {
        // Garage is off-screen on the circular radar: Draw Edge Waypoint Arrow!
        const angle = Math.atan2(dz - cy, dx - cx)
        const edgeX = cx + Math.cos(angle) * (radius - 16)
        const edgeY = cy + Math.sin(angle) * (radius - 16)

        ctx.save()
        ctx.translate(edgeX, edgeY)
        ctx.rotate(angle)

        // Pulsing Chevron Arrow
        ctx.fillStyle = '#ffb703'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(10, 0)
        ctx.lineTo(-6, -7)
        ctx.lineTo(-2, 0)
        ctx.lineTo(-6, 7)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        ctx.restore()

        // Distance text near edge
        ctx.save()
        const textDistX = cx + Math.cos(angle) * (radius - 32)
        const textDistY = cy + Math.sin(angle) * (radius - 32)
        ctx.fillStyle = '#ffb703'
        ctx.font = '800 8px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`GARAGEM ${Math.round(dist)}m`, textDistX, textDistY + 3)
        ctx.restore()
      }
    }
  }

  private drawKingKong(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    player: THREE.Vector3,
    scale: number,
    radius: number,
    location: { blockX: number; centerZ: number; centerX: number },
  ): void {
    const kx = cx + (location.centerX - player.x) * scale
    const kz = cy + (location.centerZ - player.z) * scale
    const dist = Math.hypot(kx - cx, kz - cy)

    if (dist < radius - 8) {
      ctx.save()
      ctx.translate(kx, kz)

      // Base Skyscraper footprint
      ctx.fillStyle = '#64748b'
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 1.6
      ctx.fillRect(-7, -7, 14, 14)
      ctx.strokeRect(-7, -7, 14, 14)

      // Gorilla Emoji / Icon
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🦍', 0, -1)

      // Label
      ctx.fillStyle = '#f59e0b'
      ctx.font = '800 7px monospace'
      ctx.fillText('KING KONG', 0, 11)
      ctx.restore()
    } else {
      // Clamped indicator chevron on radar rim
      const angle = Math.atan2(kz - cy, kx - cx)
      const edgeX = cx + Math.cos(angle) * (radius - 12)
      const edgeY = cy + Math.sin(angle) * (radius - 12)

      ctx.save()
      ctx.translate(edgeX, edgeY)
      ctx.rotate(angle)

      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.moveTo(6, 0)
      ctx.lineTo(-4, -4)
      ctx.lineTo(-2, 0)
      ctx.lineTo(-4, 4)
      ctx.closePath()
      ctx.fill()

      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('🦍', -9, 3)
      ctx.restore()
    }
  }

  private drawBusPassengers(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    player: THREE.Vector3,
    scale: number,
    radius: number,
    passengers: { x: number; z: number; collected: boolean }[],
  ): void {
    const pulseTime = Date.now() / 150
    const pulse = 1 + 0.3 * Math.sin(pulseTime)

    for (const p of passengers) {
      if (p.collected) continue

      const px = cx + (p.x - player.x) * scale
      const py = cy + (p.z - player.z) * scale
      const dist = Math.hypot(p.x - player.x, p.z - player.z)

      const distFromCenterSq = (px - cx) * (px - cx) + (py - cy) * (py - cy)
      const maxRad = radius - 12

      if (distFromCenterSq <= maxRad * maxRad) {
        // Marked passenger is inside radar view!
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(px, py, 6 * pulse, 0, Math.PI * 2)
        ctx.stroke()

        ctx.fillStyle = '#f7bf4a'
        ctx.beginPath()
        ctx.arc(px, py, 3.8, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.font = '800 8px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`🧍 PASSAGEIRO`, px, py - 9)
      } else {
        // Passenger is off-screen on the radar: Draw Edge Indicator Arrow!
        const angle = Math.atan2(py - cy, px - cx)
        const edgeX = cx + Math.cos(angle) * (radius - 14)
        const edgeY = cy + Math.sin(angle) * (radius - 14)

        ctx.save()
        ctx.translate(edgeX, edgeY)
        ctx.rotate(angle)

        ctx.fillStyle = '#38bdf8'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(8, 0)
        ctx.lineTo(-5, -5)
        ctx.lineTo(-2, 0)
        ctx.lineTo(-5, 5)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        ctx.restore()

        // Badge text near edge
        ctx.save()
        const textDistX = cx + Math.cos(angle) * (radius - 28)
        const textDistY = cy + Math.sin(angle) * (radius - 28)
        ctx.fillStyle = '#38bdf8'
        ctx.font = '700 8px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`🧍 ${Math.round(dist)}m`, textDistX, textDistY + 3)
        ctx.restore()
      }
    }
  }

  private drawMonsterTruck(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    playerPosition: THREE.Vector3,
    scale: number,
    radius: number,
    monsterTruckInfo: { position: THREE.Vector3; inMonsterTruck: boolean },
  ): void {
    const dx = (monsterTruckInfo.position.x - playerPosition.x) * scale
    const dz = (monsterTruckInfo.position.z - playerPosition.z) * scale
    const distSq = dx * dx + dz * dz
    const maxRad = radius - 8

    if (distSq < maxRad * maxRad) {
      // Inside radar
      const now = performance.now()
      const pulse = 1 + Math.sin(now * 0.008) * 0.25
      ctx.save()
      ctx.translate(cx + dx, cy + dz)

      // Cyan / yellow pulse circle
      ctx.strokeStyle = '#0ea5e9'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(0, 0, 7.5 * pulse, 0, Math.PI * 2)
      ctx.stroke()

      ctx.fillStyle = '#0ea5e9'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.2
      ctx.font = '900 13px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🛻', 0, -1)

      ctx.fillStyle = '#facc15'
      ctx.font = '800 7px monospace'
      ctx.fillText('MONSTER TRUCK', 0, 10)
      ctx.restore()
    } else {
      // Edge pointer arrow to Monster Truck in Praça Central
      const angle = Math.atan2(dz, dx)
      const edgeX = cx + Math.cos(angle) * (radius - 14)
      const edgeY = cy + Math.sin(angle) * (radius - 14)

      ctx.save()
      ctx.translate(edgeX, edgeY)
      ctx.rotate(angle)

      ctx.fillStyle = '#0ea5e9'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(9, 0)
      ctx.lineTo(-5, -6)
      ctx.lineTo(-2, 0)
      ctx.lineTo(-5, 6)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()

      const dist = Math.hypot(
        monsterTruckInfo.position.x - playerPosition.x,
        monsterTruckInfo.position.z - playerPosition.z,
      )
      const textX = cx + Math.cos(angle) * (radius - 28)
      const textY = cy + Math.sin(angle) * (radius - 28)
      ctx.save()
      ctx.fillStyle = '#0ea5e9'
      ctx.font = '800 7.5px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`🛻 ${Math.round(dist)}m`, textX, textY + 3)
      ctx.restore()
    }
  }
}
