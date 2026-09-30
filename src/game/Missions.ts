export type MissionType = 'distance' | 'coins' | 'time' | 'wanted' | 'close'

export type MissionEvent = {
  distance: number
  coins: number
  time: number
  wanted: number
  closeCalls: number
}

type MissionDefinition = {
  id: string
  type: MissionType
  title: string
  target: number
  reward: number
  unit: 'm' | 's' | '$' | 'x' | 'lv'
}

export type MissionState = MissionDefinition & {
  progress: number
  completed: boolean
  completedAt: number
}

const CONTRACTS: MissionDefinition[] = [
  { id: 'stretch', type: 'distance', title: 'Percorra 350 metros', target: 350, reward: 180, unit: 'm' },
  { id: 'cash', type: 'coins', title: 'Recolha 4 fichas', target: 4, reward: 240, unit: 'x' },
  { id: 'survivor', type: 'time', title: 'Sobreviva por 45 segundos', target: 45, reward: 220, unit: 's' },
  { id: 'heat', type: 'wanted', title: 'Alcance o nível 3', target: 3, reward: 300, unit: 'lv' },
  { id: 'close-pass', type: 'close', title: 'Escape de 3 viaturas', target: 3, reward: 260, unit: 'x' },
  { id: 'long-run', type: 'distance', title: 'Percorra 900 metros', target: 900, reward: 420, unit: 'm' },
  { id: 'hot-run', type: 'wanted', title: 'Alcance o nível 6', target: 6, reward: 520, unit: 'lv' },
  { id: 'big-haul', type: 'coins', title: 'Recolha 9 fichas', target: 9, reward: 500, unit: 'x' },
  { id: 'marathon', type: 'time', title: 'Sobreviva por 100 segundos', target: 100, reward: 700, unit: 's' },
]

export class Missions {
  readonly active: MissionState[] = []
  private clock = 0
  private nextContract = 0

  constructor() {
    this.reset()
  }

  reset(): void {
    this.clock = 0
    this.nextContract = 0
    this.active.length = 0
    for (let slot = 0; slot < 3; slot += 1) this.active.push(this.createContract())
  }

  update(dt: number, event: MissionEvent): MissionState[] {
    this.clock += dt
    const completed: MissionState[] = []
    for (let slot = this.active.length - 1; slot >= 0; slot -= 1) {
      const mission = this.active[slot]
      if (mission.completed) {
        if (this.clock - mission.completedAt > 2.7) this.active[slot] = this.createContract()
        continue
      }

      if (mission.type === 'distance') mission.progress += event.distance
      if (mission.type === 'coins') mission.progress += event.coins
      if (mission.type === 'time') mission.progress += event.time
      if (mission.type === 'wanted') mission.progress = Math.max(mission.progress, event.wanted)
      if (mission.type === 'close') mission.progress += event.closeCalls

      if (mission.progress >= mission.target) {
        mission.progress = mission.target
        mission.completed = true
        mission.completedAt = this.clock
        completed.push(mission)
      }
    }
    return completed
  }

  private createContract(): MissionState {
    const definition = CONTRACTS[this.nextContract % CONTRACTS.length]
    this.nextContract += 1
    return { ...definition, progress: 0, completed: false, completedAt: 0 }
  }
}
