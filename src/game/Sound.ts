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

  effect(kind: 'coin' | 'crash' | 'mission' | 'wanted' | 'explosion' | 'ring' | 'takeoff' | 'shoot' | 'roar' | 'transform' | 'laser'): void {
    if (!this.context || this.muted) return
    const context = this.context
    const now = context.currentTime

    if (kind === 'transform') {
      // Transformers mechanical servo pitch-shifting sound
      const osc = context.createOscillator()
      const gain = context.createGain()
      const filter = context.createBiquadFilter()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(160, now)
      osc.frequency.linearRampToValueAtTime(580, now + 0.16)
      osc.frequency.linearRampToValueAtTime(280, now + 0.32)
      osc.frequency.linearRampToValueAtTime(740, now + 0.48)

      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1400, now)
      filter.Q.value = 3.5

      gain.gain.setValueAtTime(0.28, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52)

      osc.connect(filter).connect(gain).connect(this.master!)
      osc.start(now)
      osc.stop(now + 0.52)
      return
    }

    if (kind === 'laser') {
      // High-energy ion blaster laser cannon shot
      const osc = context.createOscillator()
      const gain = context.createGain()
      const filter = context.createBiquadFilter()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(980, now)
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.14)

      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(2200, now)
      filter.Q.value = 2.5

      gain.gain.setValueAtTime(0.32, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

      osc.connect(filter).connect(gain).connect(this.master!)
      osc.start(now)
      osc.stop(now + 0.15)
      return
    }

    if (kind === 'shoot') {
      const osc = context.createOscillator()
      const gain = context.createGain()
      const filter = context.createBiquadFilter()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(480, now)
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.09)

      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1200, now)
      filter.Q.value = 2.0

      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)

      osc.connect(filter).connect(gain).connect(this.master!)
      osc.start(now)
      osc.stop(now + 0.09)
      return
    }

    if (kind === 'roar') {
      const osc = context.createOscillator()
      const gain = context.createGain()
      const filter = context.createBiquadFilter()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(95, now)
      osc.frequency.linearRampToValueAtTime(140, now + 0.25)
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.9)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(400, now)

      gain.gain.setValueAtTime(0.42, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95)

      osc.connect(filter).connect(gain).connect(this.master!)
      osc.start(now)
      osc.stop(now + 0.95)
      return
    }

    if (kind === 'explosion') {
      const osc = context.createOscillator()
      const gain = context.createGain()
      const filter = context.createBiquadFilter()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(140, now)
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.7)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(600, now)
      filter.frequency.exponentialRampToValueAtTime(80, now + 0.7)

      gain.gain.setValueAtTime(0.48, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75)

      osc.connect(filter).connect(gain).connect(this.master!)
      osc.start(now)
      osc.stop(now + 0.75)
      return
    }

    if (kind === 'ring') {
      // Pleasant double harmonic chime for passing through aerial rings
      const osc1 = context.createOscillator()
      const osc2 = context.createOscillator()
      const gain1 = context.createGain()
      const gain2 = context.createGain()

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(880, now)
      osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.22)
      gain1.gain.setValueAtTime(0.24, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc1.connect(gain1).connect(this.master!)
      osc1.start(now)
      osc1.stop(now + 0.25)

      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(1320, now + 0.05)
      osc2.frequency.exponentialRampToValueAtTime(2640, now + 0.28)
      gain2.gain.setValueAtTime(0.18, now + 0.05)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc2.connect(gain2).connect(this.master!)
      osc2.start(now + 0.05)
      osc2.stop(now + 0.3)
      return
    }

    if (kind === 'takeoff') {
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(120, now)
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.8)
      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85)
      osc.connect(gain).connect(this.master!)
      osc.start(now)
      osc.stop(now + 0.85)
      return
    }

    const oscillator = context.createOscillator()
    const gain = context.createGain()
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
