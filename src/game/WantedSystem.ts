const LEVEL_THRESHOLDS = [0, 7, 17, 31, 48, 68, 91, 118, 148, 181, 218]

export class WantedSystem {
  heat = 0
  level = 0
  private calmTime = 0

  reset(): void {
    this.heat = 0
    this.level = 0
    this.calmTime = 0
  }

  addHeat(amount: number): boolean {
    const before = this.level
    this.heat = Math.min(LEVEL_THRESHOLDS[10] + 25, this.heat + amount)
    this.refreshLevel()
    return this.level > before
  }

  update(dt: number, speed: number): boolean {
    const before = this.level
    if (speed > 28) {
      this.heat += dt * 0.52 * Math.min(1.5, (speed - 26) / 10)
      this.calmTime = 0
    } else if (this.level > 0 && speed < 4) {
      this.calmTime += dt
      if (this.calmTime > 7) this.heat = Math.max(0, this.heat - dt * 1.25)
    } else {
      this.calmTime = 0
    }
    this.refreshLevel()
    return this.level !== before
  }

  get progress(): number {
    if (this.level >= 10) return 1
    const floor = LEVEL_THRESHOLDS[this.level]
    const ceiling = LEVEL_THRESHOLDS[this.level + 1]
    return Math.max(0, Math.min(1, (this.heat - floor) / (ceiling - floor)))
  }

  private refreshLevel(): void {
    let next = 0
    for (let level = 1; level <= 10; level += 1) {
      if (this.heat >= LEVEL_THRESHOLDS[level]) next = level
      else break
    }
    this.level = next
  }
}
