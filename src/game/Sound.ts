export class Sound {
  private context?: AudioContext
  private master?: GainNode
  private engine?: OscillatorNode
  private engineGain?: GainNode
  private siren?: OscillatorNode
  private sirenGain?: GainNode
  muted = false

  async start(): Promise<void> {
    if (!this.context) this.createAudio()
    if (this.context?.state === 'suspended') await this.context.resume()
  }

  private createAudio(): void {
    const context = new AudioContext()
    const master = context.createGain()
    master.gain.value = this.muted ? 0 : 0.38
    master.connect(context.destination)

    const engine = context.createOscillator()
    const engineFilter = context.createBiquadFilter()
    const engineGain = context.createGain()
    engine.type = 'sawtooth'
    engine.frequency.value = 48
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 210
    engineGain.gain.value = 0.012
    engine.connect(engineFilter).connect(engineGain).connect(master)
    engine.start()

    const siren = context.createOscillator()
    const sirenGain = context.createGain()
    siren.type = 'triangle'
    siren.frequency.value = 480
    sirenGain.gain.value = 0
    siren.connect(sirenGain).connect(master)
    siren.start()

    this.context = context
    this.master = master
    this.engine = engine
    this.engineGain = engineGain
    this.siren = siren
    this.sirenGain = sirenGain
  }

  update(speed: number, wantedLevel: number): void {
    if (!this.context) return
    const now = this.context.currentTime
    if (this.engine && this.engineGain) {
      this.engine.frequency.setTargetAtTime(48 + Math.abs(speed) * 3.2, now, 0.08)
      this.engineGain.gain.setTargetAtTime(0.009 + Math.min(0.04, Math.abs(speed) * 0.0009), now, 0.1)
    }
    if (this.siren && this.sirenGain) {
      this.siren.frequency.setTargetAtTime(440 + Math.sin(now * 6) * 125, now, 0.08)
      this.sirenGain.gain.setTargetAtTime(wantedLevel > 0 ? 0.018 + wantedLevel * 0.0015 : 0, now, 0.25)
    }
  }

  effect(kind: 'coin' | 'crash' | 'mission' | 'wanted'): void {
    if (!this.context || this.muted) return
    const context = this.context
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const now = context.currentTime
    const presets = {
      coin: [720, 1180, 0.09],
      crash: [125, 48, 0.18],
      mission: [520, 1040, 0.22],
      wanted: [340, 680, 0.12],
    } as const
    const [start, end, duration] = presets[kind]
    oscillator.type = kind === 'crash' ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(start, now)
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration)
    gain.gain.setValueAtTime(kind === 'crash' ? 0.18 : 0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    oscillator.connect(gain).connect(this.master!)
    oscillator.start(now)
    oscillator.stop(now + duration)
  }

  toggle(): boolean {
    this.muted = !this.muted
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.38, this.context.currentTime, 0.04)
    return !this.muted
  }

  dispose(): void {
    this.engine?.stop()
    this.siren?.stop()
    void this.context?.close()
  }
}
