const LEVEL_THRESHOLDS = [0, 7, 17, 31, 48, 68, 91, 118, 148, 181, 218]

export class WantedSystem {
  heat = 0
  level = 0

  reset(): void {
    this.heat = 0
    this.level = 0
  }

  addHeat(amount: number): boolean {
    const before = this.level
    this.heat = Math.min(LEVEL_THRESHOLDS[10] + 25, this.heat + amount)
    this.refreshLevel()
    return this.level > before
  }

  setLevel(targetLevel: number): boolean {
    const before = this.level
    const clamped = Math.max(0, Math.min(10, targetLevel))
    this.heat = LEVEL_THRESHOLDS[clamped]
    this.refreshLevel()
    return this.level !== before
  }

  addLevels(count = 1): boolean {
    const before = this.level
    const targetLevel = Math.min(10, this.level + count)
    this.heat = LEVEL_THRESHOLDS[targetLevel]
    this.refreshLevel()
    return this.level > before
  }

  removeLevels(count = 1): boolean {
    const before = this.level
    const targetLevel = Math.max(0, this.level - count)
    this.heat = LEVEL_THRESHOLDS[targetLevel]
    this.refreshLevel()
    return this.level < before
  }

  update(_dt: number, _speed: number): boolean {
    // Automatic decay disabled per rules: Wanted level can only be reduced by purchasing items in the Shop.
    return false
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
