import * as THREE from 'three'
import type { City, GraphicsDesignMode } from './City'
import type { Sound } from './Sound'
import type { Sparks } from './Sparks'

export interface TimeTrialArch {
  id: number
  name: string
  stageLabel: string
  position: THREE.Vector3
  yaw: number
  group: THREE.Group
  neonMesh: THREE.Mesh
  signMesh: THREE.Mesh
  hologramMesh: THREE.Mesh
  colorHex: number
}

export type TimeTrialStage = 0 | 1 | 2 | 3 // 0 = idle (waiting at start arch), 1 = stage 1, 2 = stage 2, 3 = stage 3, 4 = finished

export class TimeTrial {
  private readonly scene: THREE.Scene
  private readonly sound: Sound
  private readonly sparks: Sparks

  readonly root = new THREE.Group()

  // Configuração das 3 Etapas e dos 4 Arcos
  // Arco 0: Largada (Sempre visível) na rua x = 48, z = 24
  // Arco 1: Checkpoint 1 (Meta Etapa 1) na rua z = 144, x = 120
  // Arco 2: Checkpoint 2 (Meta Etapa 2) na rua z = -48, x = 0
  // Arco 3: Chegada Final (Meta Etapa 3) na rua z = 48, x = 0
  readonly arches: TimeTrialArch[] = []

  // Estágio e Cronômetro
  active = false
  currentStage: 1 | 2 | 3 = 1
  totalStages = 3
  timeRemaining = 0
  stageMaxTime = 35.0
  totalTimeElapsed = 0

  private lastBeepSecond = -1
  private archCooldownTimer = 0

  // Linha de navegação no chão das ruas
  private readonly guideLineGroup = new THREE.Group()
  private guideLineMaterial?: THREE.MeshBasicMaterial
  private guideLineTexture?: THREE.CanvasTexture
  private stageMeshes: THREE.Mesh[] = []

  // Callbacks
  onStageChanged?: (stage: number, totalStages: number, timeRemaining: number) => void
  onTimeTick?: (timeRemaining: number, maxTime: number) => void
  onCheckpointPassed?: (stage: number) => void
  onVictory?: (rewardCash: number, rewardPoints: number, rewardXp: number, finalTime: number) => void
  onGameOver?: (reason: string) => void
  onToast?: (msg: string) => void

  constructor(scene: THREE.Scene, sound: Sound, sparks: Sparks, _city: City) {
    this.scene = scene
    this.sound = sound
    this.sparks = sparks

    this.scene.add(this.root)
    this.root.add(this.guideLineGroup)

    this.buildArches()
    this.buildGuideLines()
    this.setIdleState()
  }

  setGraphicsMode(mode: GraphicsDesignMode): void {
    const isUltra = mode === 'ultra'
    const isHigh = mode === 'high'
    const boost = isUltra ? 3.0 : isHigh ? 2.2 : 1.2

    for (const arch of this.arches) {
      if (arch.neonMesh.material instanceof THREE.MeshStandardMaterial) {
        arch.neonMesh.material.emissiveIntensity = boost
      }
    }
  }

  // Define os dados dos 4 arcos ao longo das ruas da cidade
  private buildArches(): void {
    const archConfigs = [
      {
        id: 0,
        name: '⏱️ LARGADA',
        stageLabel: 'LARGADA',
        pos: new THREE.Vector3(48, 0, 24),
        yaw: 0, // Atravessa a rua x = 48
        colorHex: 0xfacc15, // Dourado neon
      },
      {
        id: 1,
        name: '⚡ ETAPA 1',
        stageLabel: 'CHECKPOINT 1',
        pos: new THREE.Vector3(120, 0, 144),
        yaw: Math.PI / 2, // Atravessa a rua z = 144
        colorHex: 0x06b6d4, // Ciano neon
      },
      {
        id: 2,
        name: '⚡ ETAPA 2',
        stageLabel: 'CHECKPOINT 2',
        pos: new THREE.Vector3(0, 0, -48),
        yaw: Math.PI / 2, // Atravessa a rua z = -48
        colorHex: 0xa855f7, // Púrpura neon
      },
      {
        id: 3,
        name: '🏁 CHEGADA',
        stageLabel: 'CHEGADA FINAL',
        pos: new THREE.Vector3(0, 0, 48),
        yaw: 0, // Atravessa a rua x = 0
        colorHex: 0x22c55e, // Verde neon
      },
    ]

    const streetSpan = 15.6 // Largura entre os pilares (rua tem 15m, folga para passar trânsito)
    const archHeight = 6.8 // Altura do vão livre (passa qualquer caminhão ou ônibus)

    for (const cfg of archConfigs) {
      const group = new THREE.Group()
      group.position.copy(cfg.pos)
      group.rotation.y = cfg.yaw

      // Pilares laterais robustos nas calçadas
      const pillarGeo = new THREE.BoxGeometry(1.2, archHeight, 1.2)
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.8,
        roughness: 0.3,
      })

      const leftPillar = new THREE.Mesh(pillarGeo, pillarMat)
      leftPillar.position.set(-streetSpan / 2, archHeight / 2, 0)
      group.add(leftPillar)

      const rightPillar = new THREE.Mesh(pillarGeo, pillarMat)
      rightPillar.position.set(streetSpan / 2, archHeight / 2, 0)
      group.add(rightPillar)

      // Bases de concreto chanfradas
      const baseGeo = new THREE.BoxGeometry(2.0, 1.2, 2.0)
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 })
      const leftBase = new THREE.Mesh(baseGeo, baseMat)
      leftBase.position.set(-streetSpan / 2, 0.6, 0)
      group.add(leftBase)

      const rightBase = new THREE.Mesh(baseGeo, baseMat)
      rightBase.position.set(streetSpan / 2, 0.6, 0)
      group.add(rightBase)

      // Viga superior horizontal metálica
      const beamGeo = new THREE.BoxGeometry(streetSpan + 1.2, 1.0, 1.4)
      const beam = new THREE.Mesh(beamGeo, pillarMat)
      beam.position.set(0, archHeight + 0.5, 0)
      group.add(beam)

      // Moldura tubular de Neon brilhante
      const neonMat = new THREE.MeshStandardMaterial({
        color: cfg.colorHex,
        emissive: cfg.colorHex,
        emissiveIntensity: 2.2,
        roughness: 0.1,
      })

      // Linha de neon no topo e nas laterais internas
      const topNeonGeo = new THREE.BoxGeometry(streetSpan - 0.2, 0.22, 0.22)
      const topNeon = new THREE.Mesh(topNeonGeo, neonMat)
      topNeon.position.set(0, archHeight - 0.1, 0)
      group.add(topNeon)

      const sideNeonGeo = new THREE.BoxGeometry(0.22, archHeight, 0.22)
      const leftNeon = new THREE.Mesh(sideNeonGeo, neonMat)
      leftNeon.position.set(-(streetSpan / 2 - 0.6), archHeight / 2, 0)
      group.add(leftNeon)

      const rightNeon = new THREE.Mesh(sideNeonGeo, neonMat)
      rightNeon.position.set(streetSpan / 2 - 0.6, archHeight / 2, 0)
      group.add(rightNeon)

      // Placa Digital / Painel do Arco no topo
      const signGeo = new THREE.BoxGeometry(8.5, 1.6, 0.3)
      const signMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: cfg.colorHex,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      })
      const sign = new THREE.Mesh(signGeo, signMat)
      sign.position.set(0, archHeight + 1.8, 0)
      group.add(sign)

      // Placa com texto estilizado canvas
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 128
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#090d16'
      ctx.fillRect(0, 0, 512, 128)
      ctx.strokeStyle = `#${cfg.colorHex.toString(16).padStart(6, '0')}`
      ctx.lineWidth = 8
      ctx.strokeRect(4, 4, 504, 120)

      ctx.fillStyle = `#${cfg.colorHex.toString(16).padStart(6, '0')}`
      ctx.font = '900 40px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(cfg.name, 256, 64)

      const labelTexture = new THREE.CanvasTexture(canvas)
      const labelMat = new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true })
      const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 1.4), labelMat)
      labelMesh.position.set(0, archHeight + 1.8, 0.18)
      group.add(labelMesh)

      // Face traseira da placa também visível
      const labelMeshBack = labelMesh.clone()
      labelMeshBack.rotation.y = Math.PI
      labelMeshBack.position.z = -0.18
      group.add(labelMeshBack)

      // Barreira de Luz Holográfica / Cortina de Checkpoint translúcida
      const holoGeo = new THREE.PlaneGeometry(streetSpan - 1.2, archHeight - 0.5)
      const holoMat = new THREE.MeshBasicMaterial({
        color: cfg.colorHex,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const holo = new THREE.Mesh(holoGeo, holoMat)
      holo.position.set(0, (archHeight - 0.5) / 2, 0)
      group.add(holo)

      this.root.add(group)

      this.arches.push({
        id: cfg.id,
        name: cfg.name,
        stageLabel: cfg.stageLabel,
        position: cfg.pos.clone(),
        yaw: cfg.yaw,
        group,
        neonMesh: topNeon,
        signMesh: sign,
        hologramMesh: holo,
        colorHex: cfg.colorHex,
      })
    }
  }

  // Gera a textura procedural de setas chevrons animadas para o chão
  private createChevronTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!

    ctx.clearRect(0, 0, 256, 64)

    // Fundo semitransparente brilhante
    ctx.fillStyle = 'rgba(6, 182, 212, 0.25)'
    ctx.fillRect(0, 16, 256, 32)

    // Bordas brilhantes
    ctx.strokeStyle = '#22d3ee'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 16)
    ctx.lineTo(256, 16)
    ctx.moveTo(0, 48)
    ctx.lineTo(256, 48)
    ctx.stroke()

    // 4 Setas chevrons apontando para a frente (>>>)
    ctx.fillStyle = '#67e8f9'
    for (let x = 32; x < 256; x += 64) {
      ctx.beginPath()
      ctx.moveTo(x - 14, 20)
      ctx.lineTo(x + 14, 32)
      ctx.lineTo(x - 14, 44)
      ctx.lineTo(x - 4, 32)
      ctx.closePath()
      ctx.fill()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    return texture
  }

  // Constrói a malha da linha no chão das ruas para cada uma das 3 etapas
  private buildGuideLines(): void {
    this.guideLineTexture = this.createChevronTexture()
    this.guideLineMaterial = new THREE.MeshBasicMaterial({
      map: this.guideLineTexture,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })

    // ETAPA 1: Da Largada (48, 24) subindo a rua x = 48 até z = 144, virando à direita até (120, 144)
    const pointsStage1 = [
      new THREE.Vector3(48, 0.05, 24),
      new THREE.Vector3(48, 0.05, 136),
      new THREE.Vector3(56, 0.05, 144),
      new THREE.Vector3(120, 0.05, 144),
    ]
    const mesh1 = this.createRoadRibbon(pointsStage1, 2.2, 14)
    this.guideLineGroup.add(mesh1)
    this.stageMeshes.push(mesh1)

    // ETAPA 2: De (120, 144) até cruzamento (144, 144), descendo avenida x = 144 até z = -48, virando para (0, -48)
    const pointsStage2 = [
      new THREE.Vector3(120, 0.05, 144),
      new THREE.Vector3(138, 0.05, 144),
      new THREE.Vector3(144, 0.05, 136),
      new THREE.Vector3(144, 0.05, -40),
      new THREE.Vector3(136, 0.05, -48),
      new THREE.Vector3(0, 0.05, -48),
    ]
    const mesh2 = this.createRoadRibbon(pointsStage2, 2.2, 24)
    this.guideLineGroup.add(mesh2)
    this.stageMeshes.push(mesh2)

    // ETAPA 3: De (0, -48) virando na rua x = -48, subindo até z = 48 e virando para o arco final em (0, 48)
    const pointsStage3 = [
      new THREE.Vector3(0, 0.05, -48),
      new THREE.Vector3(-40, 0.05, -48),
      new THREE.Vector3(-48, 0.05, -40),
      new THREE.Vector3(-48, 0.05, 40),
      new THREE.Vector3(-40, 0.05, 48),
      new THREE.Vector3(0, 0.05, 48),
    ]
    const mesh3 = this.createRoadRibbon(pointsStage3, 2.2, 16)
    this.guideLineGroup.add(mesh3)
    this.stageMeshes.push(mesh3)
  }

  // Cria uma fita plana contínua no asfalto com cantos suaves
  private createRoadRibbon(waypoints: THREE.Vector3[], width: number, textureRepeat: number): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(waypoints, false, 'catmullrom', 0.15)
    const samples = 80
    const points = curve.getPoints(samples)

    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const up = new THREE.Vector3(0, 1, 0)
    const halfW = width / 2

    for (let i = 0; i <= samples; i++) {
      const p = points[i]
      const t = curve.getTangent(i / samples).normalize()
      const normal = new THREE.Vector3().crossVectors(t, up).normalize()

      // Ponto esquerdo e direito da fita
      positions.push(p.x - normal.x * halfW, p.y, p.z - normal.z * halfW)
      positions.push(p.x + normal.x * halfW, p.y, p.z + normal.z * halfW)

      const u = (i / samples) * textureRepeat
      uvs.push(u, 0)
      uvs.push(u, 1)

      if (i < samples) {
        const base = i * 2
        indices.push(base, base + 1, base + 2)
        indices.push(base + 1, base + 3, base + 2)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return new THREE.Mesh(geometry, this.guideLineMaterial)
  }

  // Estado Inicial / Ocioso:
  // "Exibe somente o primeiro arco, o arco inicial, os outros arcos somente devem ser exibidos quando a missão iniciar."
  setIdleState(): void {
    this.active = false
    this.currentStage = 1
    this.timeRemaining = 0
    this.totalTimeElapsed = 0

    // Oculta a linha no chão
    this.guideLineGroup.visible = false

    // Exibe apenas o arco inicial (id 0)
    for (const arch of this.arches) {
      if (arch.id === 0) {
        arch.group.visible = true
        arch.hologramMesh.visible = true
      } else {
        arch.group.visible = false
      }
    }
  }

  // Inicia a missão quando o jogador cruza o arco inicial com o veículo
  startMission(): void {
    if (this.active) return
    this.active = true
    this.currentStage = 1
    this.stageMaxTime = 35.0
    this.timeRemaining = this.stageMaxTime
    this.totalTimeElapsed = 0
    this.archCooldownTimer = 1.5

    // Exibe todos os arcos da missão conforme especificado pelo usuário:
    // "os outros arcos somente devem ser exibidos quando a missão iniciar"
    for (const arch of this.arches) {
      arch.group.visible = true
      arch.hologramMesh.visible = true
    }

    // Exibe a linha guia no asfalto destacando a etapa 1
    this.guideLineGroup.visible = true
    this.updateActiveStageLine(1)

    this.sound.effect('countdown_go')
    this.sound.effect('mission')
    this.sparks.emit(this.arches[0].position)

    this.onStageChanged?.(1, this.totalStages, this.timeRemaining)
    this.onToast?.('⏱️ CORRIDA CONTRA O TEMPO INICIADA! SIGA A LINHA NO CHÃO ATÉ O ARCO DA ETAPA 1!')
  }

  private updateActiveStageLine(stage: 1 | 2 | 3): void {
    // Ilumina a fita da etapa correspondente
    for (let i = 0; i < this.stageMeshes.length; i++) {
      this.stageMeshes[i].visible = (i + 1) === stage
    }
  }

  // Avança para a próxima etapa ao cruzar o arco
  private advanceStage(targetStage: 2 | 3): void {
    this.currentStage = targetStage
    this.archCooldownTimer = 1.8

    // Definição do tempo para cada etapa
    if (targetStage === 2) {
      this.stageMaxTime = 45.0
      this.timeRemaining = this.stageMaxTime
      this.sound.effect('coin')
      this.sound.effect('upgrade')
      this.sparks.emit(this.arches[1].position)
      this.onCheckpointPassed?.(1)
      this.onToast?.('⚡ ETAPA 1 CONCLUÍDA! CRONÔMETRO REINICIADO (+45s)! SIGA PARA O ARCO DA ETAPA 2!')
    } else if (targetStage === 3) {
      this.stageMaxTime = 35.0
      this.timeRemaining = this.stageMaxTime
      this.sound.effect('coin')
      this.sound.effect('upgrade')
      this.sparks.emit(this.arches[2].position)
      this.onCheckpointPassed?.(2)
      this.onToast?.('⚡ ETAPA 2 CONCLUÍDA! RETA FINAL (+35s)! ACELERE ATÉ A CHEGADA!')
    }

    this.updateActiveStageLine(targetStage)
    this.onStageChanged?.(targetStage, this.totalStages, this.timeRemaining)
  }

  // Conclui a corrida com vitória ao passar pelo arco final (Arco 3)
  private completeVictory(): void {
    this.active = false
    this.sound.effect('upgrade')
    this.sparks.emit(this.arches[3].position)

    const rewardCash = 7500
    const rewardPoints = 15000
    const rewardXp = 350

    this.onVictory?.(rewardCash, rewardPoints, rewardXp, this.totalTimeElapsed)
    this.onToast?.(`🏆 VITÓRIA ÉPICA! CORRIDA CONTRA O TEMPO CONCLUÍDA EM ${this.totalTimeElapsed.toFixed(1)}s! +$7.500`)

    // Retorna ao estado inicial
    this.setIdleState()
  }

  // Falha na missão por tempo esgotado
  private failMission(): void {
    this.active = false
    this.sound.effect('crash')
    this.onGameOver?.('TEMPO ESGOTADO')
    this.onToast?.('💀 TEMPO ESGOTADO! VOCÊ NÃO CRUZOU O ARCO A TEMPO!')

    // Retorna ao estado inicial para poder tentar novamente
    this.setIdleState()
  }

  // Loop de atualização no frame
  update(dt: number, playerPos: THREE.Vector3, inVehicle: boolean, _playerSpeed: number): void {
    if (this.archCooldownTimer > 0) {
      this.archCooldownTimer -= dt
    }

    // Animação contínua da textura de chevrons na rua (efeito de setas correndo para a frente)
    if (this.guideLineTexture && this.active) {
      this.guideLineTexture.offset.x -= dt * 1.8
    }

    // Animação suave de pulsação nos arcos holográficos
    const time = performance.now() * 0.003
    for (const arch of this.arches) {
      if (arch.group.visible && arch.hologramMesh) {
        const mat = arch.hologramMesh.material as THREE.MeshBasicMaterial
        mat.opacity = 0.18 + Math.sin(time * 3 + arch.id) * 0.1
      }
    }

    // Se a missão não está ativa, verifica se o jogador no veículo passa pelo arco inicial
    if (!this.active) {
      const startArch = this.arches[0]
      const distToStart = Math.hypot(playerPos.x - startArch.position.x, playerPos.z - startArch.position.z)

      if (distToStart < 7.5 && playerPos.y < 5.0 && this.archCooldownTimer <= 0) {
        if (inVehicle) {
          this.startMission()
        } else {
          // Mensagem informativa se estiver a pé
          this.onToast?.('🚗 ENTRE EM UM VEÍCULO PARA INICIAR A CORRIDA CONTRA O TEMPO!')
          this.archCooldownTimer = 3.0
        }
      }
      return
    }

    // Missão Ativa: Contagem regressiva do cronômetro
    this.timeRemaining -= dt
    this.totalTimeElapsed += dt

    this.onTimeTick?.(Math.max(0, this.timeRemaining), this.stageMaxTime)

    // Alerta sonoro nos últimos 5 segundos
    const currentSec = Math.ceil(this.timeRemaining)
    if (currentSec <= 5 && currentSec > 0 && currentSec !== this.lastBeepSecond) {
      this.lastBeepSecond = currentSec
      this.sound.effect('countdown_beep')
    }

    // Verifica se o tempo acabou
    if (this.timeRemaining <= 0) {
      this.failMission()
      return
    }

    // Verifica cruzamento do arco alvo da etapa atual
    if (this.archCooldownTimer <= 0 && inVehicle) {
      if (this.currentStage === 1) {
        const targetArch = this.arches[1]
        const dist = Math.hypot(playerPos.x - targetArch.position.x, playerPos.z - targetArch.position.z)
        if (dist < 8.0 && playerPos.y < 5.0) {
          this.advanceStage(2)
        }
      } else if (this.currentStage === 2) {
        const targetArch = this.arches[2]
        const dist = Math.hypot(playerPos.x - targetArch.position.x, playerPos.z - targetArch.position.z)
        if (dist < 8.0 && playerPos.y < 5.0) {
          this.advanceStage(3)
        }
      } else if (this.currentStage === 3) {
        const targetArch = this.arches[3]
        const dist = Math.hypot(playerPos.x - targetArch.position.x, playerPos.z - targetArch.position.z)
        if (dist < 8.0 && playerPos.y < 5.0) {
          this.completeVictory()
        }
      }
    }
  }

  // Posição do próximo arco para bússola / GPS
  getCurrentTargetArch(): TimeTrialArch | null {
    if (!this.active) {
      return this.arches[0]
    }
    return this.arches[this.currentStage] || null
  }

  // Liberação de recursos
  dispose(): void {
    this.scene.remove(this.root)
    this.guideLineTexture?.dispose()
    this.guideLineMaterial?.dispose()
    for (const mesh of this.stageMeshes) {
      mesh.geometry.dispose()
    }
    for (const arch of this.arches) {
      arch.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
    }
  }
}
