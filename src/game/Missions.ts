export type MissionType =
  | 'distance'
  | 'coins'
  | 'time'
  | 'wanted'
  | 'close'
  | 'rings'
  | 'ramp_jumps'
  | 'car_haul'
  | 'tanker_deliver'
  | 'bus_passengers'
  | 'monster_crush'
  | 'king_kong'
  | 'taxi_fares'
  | 'speed_bomb'
  | 'rampage_police'

export type MissionEvent = {
  distance: number
  coins: number
  time: number
  wanted: number
  closeCalls: number
  rings?: number
  rampJumps?: number
  carHaul?: number
  tankerDeliver?: number
  busPassengers?: number
  monsterCrush?: number
  kingKongDamage?: number
  taxiFares?: number
  speedBomb?: number
  rampagePolice?: number
}

type MissionDefinition = {
  id: string
  type: MissionType
  title: string
  target: number
  reward: number
  unit: 'm' | 's' | '$' | 'x' | 'lv' | 'HP'
}

export type MissionState = MissionDefinition & {
  progress: number
  completed: boolean
  completedAt: number
}

export const ALL_CONTRACTS: MissionDefinition[] = [
  // 1. Manobras & Veículos Especiais GTA
  { id: 'taxi-fares', type: 'taxi_fares', title: 'Táxi Maluco: Leve 3 passageiros com manobras radicais', target: 3, reward: 3500, unit: 'x' },
  { id: 'speed-bomb', type: 'speed_bomb', title: 'Velocidade Máxima: Mantenha >75 km/h por 45s no Carro-Bomba', target: 45, reward: 5000, unit: 's' },
  { id: 'rampage-police', type: 'rampage_police', title: 'Modo Fúria (Rampage): Destrua 15 viaturas policiais em 60s', target: 15, reward: 4000, unit: 'x' },
  { id: 'ramp-jumps', type: 'ramp_jumps', title: 'Faça 3 saltos na rampa da cegonha', target: 3, reward: 1200, unit: 'x' },
  { id: 'car-haul', type: 'car_haul', title: 'Recolha 5 carros com o caminhão cegonha', target: 5, reward: 4000, unit: 'x' },
  { id: 'aerial-ace', type: 'rings', title: 'Passe por 7 círculos flutuantes (avião)', target: 7, reward: 1000, unit: 'x' },
  { id: 'king-kong', type: 'king_kong', title: 'Derrube o Chefão King Kong do prédio', target: 50, reward: 5000, unit: 'HP' },
  { id: 'monster-crush', type: 'monster_crush', title: 'Esmague 10 carros com o Monster Truck', target: 10, reward: 3500, unit: 'x' },
  { id: 'tanker-fuel', type: 'tanker_deliver', title: 'Entregue combustível inflamável no posto', target: 1, reward: 2500, unit: 'x' },
  { id: 'bus-commuters', type: 'bus_passengers', title: 'Embarque 10 passageiros no ônibus', target: 10, reward: 3000, unit: 'x' },

  // 2. Exploração, Velocidade & Sobrevivência
  { id: 'stretch-1', type: 'distance', title: 'Percorra 350 metros pela cidade', target: 350, reward: 180, unit: 'm' },
  { id: 'cash-1', type: 'coins', title: 'Recolha 4 fichas espalhadas', target: 4, reward: 240, unit: 'x' },
  { id: 'survivor-1', type: 'time', title: 'Sobreviva por 45 segundos na fuga', target: 45, reward: 220, unit: 's' },
  { id: 'heat-1', type: 'wanted', title: 'Alcance o nível 3 de procurado', target: 3, reward: 300, unit: 'lv' },
  { id: 'close-pass', type: 'close', title: 'Escape de 3 viaturas da polícia', target: 3, reward: 260, unit: 'x' },
  { id: 'stretch-2', type: 'distance', title: 'Percorra 900 metros na perseguição', target: 900, reward: 420, unit: 'm' },
  { id: 'heat-2', type: 'wanted', title: 'Alcance o nível 6 de procurado', target: 6, reward: 520, unit: 'lv' },
  { id: 'big-haul', type: 'coins', title: 'Recolha 9 fichas na cidade', target: 9, reward: 500, unit: 'x' },
  { id: 'marathon', type: 'time', title: 'Sobreviva por 100 segundos na cidade', target: 100, reward: 700, unit: 's' },
]

export class Missions {
  readonly allMissions: MissionState[] = []
  private clock = 0

  constructor() {
    this.reset()
  }

  get active(): MissionState[] {
    return this.allMissions.filter(m => !m.completed)
  }

  get completed(): MissionState[] {
    return this.allMissions.filter(m => m.completed)
  }

  reset(): void {
    this.clock = 0
    this.allMissions.length = 0
    for (const def of ALL_CONTRACTS) {
      this.allMissions.push({
        ...def,
        progress: 0,
        completed: false,
        completedAt: 0,
      })
    }
  }

  update(dt: number, event: MissionEvent): MissionState[] {
    this.clock += dt
    const justCompleted: MissionState[] = []

    for (const mission of this.allMissions) {
      if (mission.completed) continue

      if (mission.type === 'distance') mission.progress += event.distance
      if (mission.type === 'coins') mission.progress += event.coins
      if (mission.type === 'time') mission.progress += event.time
      if (mission.type === 'wanted') mission.progress = Math.max(mission.progress, event.wanted)
      if (mission.type === 'close') mission.progress += event.closeCalls
      if (mission.type === 'rings' && event.rings !== undefined) mission.progress = Math.max(mission.progress, event.rings)
      if (mission.type === 'ramp_jumps' && event.rampJumps !== undefined) mission.progress += event.rampJumps
      if (mission.type === 'car_haul' && event.carHaul !== undefined) mission.progress = Math.max(mission.progress, event.carHaul)
      if (mission.type === 'tanker_deliver' && event.tankerDeliver !== undefined) mission.progress += event.tankerDeliver
      if (mission.type === 'bus_passengers' && event.busPassengers !== undefined) mission.progress = Math.max(mission.progress, event.busPassengers)
      if (mission.type === 'monster_crush' && event.monsterCrush !== undefined) mission.progress = Math.max(mission.progress, event.monsterCrush)
      if (mission.type === 'king_kong' && event.kingKongDamage !== undefined) mission.progress = Math.max(mission.progress, event.kingKongDamage)
      if (mission.type === 'taxi_fares' && event.taxiFares !== undefined) mission.progress += event.taxiFares
      if (mission.type === 'speed_bomb' && event.speedBomb !== undefined) mission.progress = Math.max(mission.progress, event.speedBomb)
      if (mission.type === 'rampage_police' && event.rampagePolice !== undefined) mission.progress = Math.max(mission.progress, event.rampagePolice)

      if (mission.progress >= mission.target) {
        mission.progress = mission.target
        mission.completed = true
        mission.completedAt = this.clock
        justCompleted.push(mission)
      }
    }

    return justCompleted
  }

  recordTaxiFare(count = 1): MissionState[] {
    return this.update(0, { distance: 0, coins: 0, time: 0, wanted: 0, closeCalls: 0, taxiFares: count })
  }

  recordSpeedBomb(seconds: number): MissionState[] {
    return this.update(0, { distance: 0, coins: 0, time: 0, wanted: 0, closeCalls: 0, speedBomb: seconds })
  }

  recordRampagePolice(count: number): MissionState[] {
    return this.update(0, { distance: 0, coins: 0, time: 0, wanted: 0, closeCalls: 0, rampagePolice: count })
  }

  recordRampJump(count = 1): MissionState[] {
    return this.update(0, { distance: 0, coins: 0, time: 0, wanted: 0, closeCalls: 0, rampJumps: count })
  }

  recordCarHaul(count: number): MissionState[] {
    return this.update(0, { distance: 0, coins: 0, time: 0, wanted: 0, closeCalls: 0, carHaul: count })
  }

  recordTankerDeliver(): MissionState[] {
    return this.update(0, { distance: 0, coins: 0, time: 0, wanted: 0, closeCalls: 0, tankerDeliver: 1 })
  }

  recordBusPassengers(count: number): MissionState[] {
    return this.update(0, { distance: 0, coins: 0, time: 0, wanted: 0, closeCalls: 0, busPassengers: count })
  }

  recordMonsterCrush(count: number): MissionState[] {
    return this.update(0, { distance: 0, coins: 0, time: 0, wanted: 0, closeCalls: 0, monsterCrush: count })
  }

  recordKingKongDamage(damage: number): MissionState[] {
    return this.update(0, { distance: 0, coins: 0, time: 0, wanted: 0, closeCalls: 0, kingKongDamage: damage })
  }
}

