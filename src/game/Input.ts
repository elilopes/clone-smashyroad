import * as THREE from 'three'
import type { DriveInput } from './Car'

export type MobileControlMode = 'joystick' | 'tilt' | 'touch'

export interface MobileElements {
  joystick?: HTMLElement | null
  joystickKnob?: HTMLElement | null
  joystickArrows?: {
    up?: HTMLElement | null
    down?: HTMLElement | null
    left?: HTMLElement | null
    right?: HTMLElement | null
  }
  tiltIndicator?: HTMLElement | null
  tiltBubble?: HTMLElement | null
  touchZoneLeft?: HTMLElement | null
  touchZoneRight?: HTMLElement | null
}

export class Input {
  private readonly keys = new Set<string>()
  private readonly buttons = new Set<string>()

  // Mobile control mode
  private controlMode: MobileControlMode = 'joystick'

  // Joystick state
  private joystickEl: HTMLElement | null = null
  private joystickKnobEl: HTMLElement | null = null
  private joystickArrows: {
    up?: HTMLElement | null
    down?: HTMLElement | null
    left?: HTMLElement | null
    right?: HTMLElement | null
  } = {}
  private joystickPointerId: number | null = null
  private joystickRadius = 46
  private joystickSteer = 0
  private joystickThrottle = 0

  // Tilt sensor state
  private tiltListenerActive = false
  private tiltSteer = 0
  private tiltIndicatorEl: HTMLElement | null = null
  private tiltBubbleEl: HTMLElement | null = null

  // Touch zones state
  private touchZoneLeftEl: HTMLElement | null = null
  private touchZoneRightEl: HTMLElement | null = null
  private touchSteerLeft = false
  private touchSteerRight = false

  // Auto acceleration state
  private autoAccel = false

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.clear)

    this.bindDataControlButtons()
  }

  setAutoAccel(enabled: boolean): void {
    this.autoAccel = enabled
  }

  isAutoAccel(): boolean {
    return this.autoAccel
  }

  setControlMode(mode: MobileControlMode): void {
    this.controlMode = mode
    this.resetMobileState()

    if (mode === 'tilt') {
      void this.startTiltListener()
    } else {
      this.stopTiltListener()
    }

    this.updateElementVisibilities()
  }

  getControlMode(): MobileControlMode {
    return this.controlMode
  }

  setupMobileControls(elements: MobileElements): void {
    this.joystickEl = elements.joystick ?? null
    this.joystickKnobEl = elements.joystickKnob ?? null
    this.joystickArrows = elements.joystickArrows ?? {}
    this.tiltIndicatorEl = elements.tiltIndicator ?? null
    this.tiltBubbleEl = elements.tiltBubble ?? null
    this.touchZoneLeftEl = elements.touchZoneLeft ?? null
    this.touchZoneRightEl = elements.touchZoneRight ?? null

    this.bindJoystick()
    this.bindTouchZones()
    this.updateElementVisibilities()
  }

  private updateElementVisibilities(): void {
    if (this.joystickEl) {
      this.joystickEl.classList.toggle('hidden', this.controlMode !== 'joystick')
    }
    if (this.tiltIndicatorEl) {
      this.tiltIndicatorEl.classList.toggle('hidden', this.controlMode !== 'tilt')
    }
    if (this.touchZoneLeftEl?.parentElement) {
      this.touchZoneLeftEl.parentElement.classList.toggle('hidden', this.controlMode !== 'touch')
    }
  }

  private resetMobileState(): void {
    this.joystickSteer = 0
    this.joystickThrottle = 0
    this.joystickPointerId = null
    if (this.joystickKnobEl) {
      this.joystickKnobEl.style.transform = 'translate(0px, 0px)'
    }
    this.highlightJoystickArrows(0, 0)

    this.tiltSteer = 0
    if (this.tiltBubbleEl) {
      this.tiltBubbleEl.style.transform = 'translateX(0px)'
    }

    this.touchSteerLeft = false
    this.touchSteerRight = false
    this.touchZoneLeftEl?.classList.remove('active')
    this.touchZoneRightEl?.classList.remove('active')
  }

  private bindJoystick(): void {
    if (!this.joystickEl || !this.joystickKnobEl) return

    const handlePointerDown = (event: PointerEvent) => {
      if (this.controlMode !== 'joystick') return
      event.preventDefault()
      this.joystickPointerId = event.pointerId
      this.joystickEl?.setPointerCapture(event.pointerId)
      this.updateJoystickPosition(event.clientX, event.clientY)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (this.controlMode !== 'joystick' || event.pointerId !== this.joystickPointerId) return
      event.preventDefault()
      this.updateJoystickPosition(event.clientX, event.clientY)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== this.joystickPointerId) return
      event.preventDefault()
      this.joystickPointerId = null
      this.joystickSteer = 0
      this.joystickThrottle = 0
      if (this.joystickKnobEl) {
        this.joystickKnobEl.style.transform = 'translate(0px, 0px)'
      }
      this.highlightJoystickArrows(0, 0)
    }

    this.joystickEl.addEventListener('pointerdown', handlePointerDown)
    this.joystickEl.addEventListener('pointermove', handlePointerMove)
    this.joystickEl.addEventListener('pointerup', handlePointerUp)
    this.joystickEl.addEventListener('pointercancel', handlePointerUp)
    this.joystickEl.addEventListener('lostpointercapture', handlePointerUp)
  }

  private updateJoystickPosition(clientX: number, clientY: number): void {
    if (!this.joystickEl || !this.joystickKnobEl) return

    const rect = this.joystickEl.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const dx = clientX - centerX
    const dy = clientY - centerY
    const dist = Math.hypot(dx, dy)

    const clampedDist = Math.min(dist, this.joystickRadius)
    const angle = Math.atan2(dy, dx)

    const knobX = Math.cos(angle) * clampedDist
    const knobY = Math.sin(angle) * clampedDist

    this.joystickKnobEl.style.transform = `translate(${knobX}px, ${knobY}px)`

    const normX = knobX / this.joystickRadius
    const normY = knobY / this.joystickRadius

    // In vehicle physics: normX < 0 (left) => steer > 0 (left)
    // normX > 0 (right) => steer < 0 (right)
    // Add small deadzone so pushing straight up doesn't veer left or right
    const deadzoneX = 0.12
    if (Math.abs(normX) < deadzoneX) {
      this.joystickSteer = 0
    } else {
      const signX = Math.sign(normX)
      const scaledX = (Math.abs(normX) - deadzoneX) / (1 - deadzoneX)
      this.joystickSteer = -signX * scaledX
    }

    // normY < 0 (up) => throttle > 0 (accelerate)
    // normY > 0 (down) => throttle < 0 (reverse/brake)
    this.joystickThrottle = -normY

    this.highlightJoystickArrows(normX, normY)
  }

  private highlightJoystickArrows(normX: number, normY: number): void {
    this.joystickArrows.up?.classList.toggle('active', normY < -0.25)
    this.joystickArrows.down?.classList.toggle('active', normY > 0.25)
    this.joystickArrows.left?.classList.toggle('active', normX < -0.25)
    this.joystickArrows.right?.classList.toggle('active', normX > 0.25)
  }

  async requestTiltPermission(): Promise<boolean> {
    const DeviceOrientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }

    if (typeof DeviceOrientation?.requestPermission === 'function') {
      try {
        const result = await DeviceOrientation.requestPermission()
        if (result === 'granted') {
          this.startTiltListener()
          return true
        }
        return false
      } catch (err) {
        console.warn('Permissão de orientação recusada:', err)
        return false
      }
    } else {
      this.startTiltListener()
      return true
    }
  }

  private startTiltListener(): void {
    if (this.tiltListenerActive) return
    window.addEventListener('deviceorientation', this.onDeviceOrientation)
    this.tiltListenerActive = true
  }

  private stopTiltListener(): void {
    if (!this.tiltListenerActive) return
    window.removeEventListener('deviceorientation', this.onDeviceOrientation)
    this.tiltListenerActive = false
    this.tiltSteer = 0
    if (this.tiltBubbleEl) {
      this.tiltBubbleEl.style.transform = 'translateX(0px)'
    }
  }

  private readonly onDeviceOrientation = (event: DeviceOrientationEvent): void => {
    if (this.controlMode !== 'tilt') return

    const angle = window.screen?.orientation?.angle ?? (window.orientation as number) ?? 0
    let tiltVal = 0

    if (angle === 90) {
      tiltVal = -(event.beta ?? 0)
    } else if (angle === -90 || angle === 270) {
      tiltVal = event.beta ?? 0
    } else {
      tiltVal = event.gamma ?? 0
    }

    const deadzone = 3.5
    const maxTilt = 28.0

    if (Math.abs(tiltVal) > deadzone) {
      const sign = Math.sign(tiltVal)
      const normalized = Math.min(1, (Math.abs(tiltVal) - deadzone) / (maxTilt - deadzone))
      // Tilting left (tiltVal < 0) => steer left (+1)
      // Tilting right (tiltVal > 0) => steer right (-1)
      this.tiltSteer = -sign * normalized
    } else {
      this.tiltSteer = 0
    }

    if (this.tiltBubbleEl) {
      // Offset bubble visually according to tilt steer (-36px to +36px)
      const bubbleOffset = -this.tiltSteer * 38
      this.tiltBubbleEl.style.transform = `translateX(${bubbleOffset}px)`
    }
  }

  private bindTouchZones(): void {
    if (!this.touchZoneLeftEl || !this.touchZoneRightEl) return

    const setupZone = (
      el: HTMLElement,
      onPress: (pressed: boolean) => void
    ) => {
      let activePointerId: number | null = null

      el.addEventListener('pointerdown', (e) => {
        if (this.controlMode !== 'touch') return
        e.preventDefault()
        activePointerId = e.pointerId
        el.setPointerCapture(e.pointerId)
        el.classList.add('active')
        onPress(true)
      })

      const release = (e: PointerEvent) => {
        if (e.pointerId !== activePointerId) return
        e.preventDefault()
        activePointerId = null
        el.classList.remove('active')
        onPress(false)
      }

      el.addEventListener('pointerup', release)
      el.addEventListener('pointercancel', release)
      el.addEventListener('lostpointercapture', release)
    }

    setupZone(this.touchZoneLeftEl, (pressed) => {
      this.touchSteerLeft = pressed
    })

    setupZone(this.touchZoneRightEl, (pressed) => {
      this.touchSteerRight = pressed
    })
  }

  private bindDataControlButtons(): void {
    for (const button of document.querySelectorAll<HTMLElement>('[data-control]')) {
      const control = button.dataset.control!
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        this.buttons.add(control)
        button.classList.add('pressed')
        button.setPointerCapture(event.pointerId)
      })
      const release = () => {
        this.buttons.delete(control)
        button.classList.remove('pressed')
      }
      button.addEventListener('pointerup', release)
      button.addEventListener('pointercancel', release)
      button.addEventListener('lostpointercapture', release)
    }
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase()
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault()
    this.keys.add(key)
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.key.toLowerCase())
  }

  read(autoAccel?: boolean): DriveInput {
    const pressed = (...keys: string[]) => keys.some((key) => this.keys.has(key) || this.buttons.has(key))
    const keySteer = Number(pressed('a', 'arrowleft', 'left')) - Number(pressed('d', 'arrowright', 'right'))

    let steer = keySteer

    if (this.controlMode === 'joystick') {
      steer = this.joystickPointerId !== null && Math.abs(this.joystickSteer) > 0.05
        ? this.joystickSteer
        : keySteer
    } else if (this.controlMode === 'tilt') {
      steer = Math.abs(this.tiltSteer) > 0.04 ? this.tiltSteer : keySteer
    } else if (this.controlMode === 'touch') {
      const touchSteer = (this.touchSteerLeft ? 1 : 0) - (this.touchSteerRight ? 1 : 0)
      steer = touchSteer !== 0 ? touchSteer : keySteer
    }

    steer = THREE.MathUtils.clamp(steer, -1, 1)

    let throttle = Number(pressed('w', 'arrowup', 'accelerate')) - Number(pressed('s', 'arrowdown', 'reverse'))
    if (this.controlMode === 'joystick' && this.joystickPointerId !== null && Math.abs(this.joystickThrottle) > 0.05) {
      throttle = this.joystickThrottle
    }

    const isAuto = autoAccel !== undefined ? autoAccel : this.autoAccel

    if (isAuto) {
      const isReversing = pressed('s', 'arrowdown', 'reverse') || (this.controlMode === 'joystick' && this.joystickPointerId !== null && this.joystickThrottle < -0.25)
      const isBraking = pressed('handbrake')
      if (isBraking) {
        throttle = 0
      } else if (isReversing) {
        throttle = -1
      } else {
        throttle = 1
      }
    }

    throttle = THREE.MathUtils.clamp(throttle, -1, 1)

    const handbrake = pressed('handbrake')
    const thrust = pressed('shift', 'shiftleft', 'shiftright', 'q', 'thrust', 'boost', ' ', 'space')
    const shoot = pressed('f', 'j', 'enter', 'shoot', 'x', 'control')

    return { throttle, steer, handbrake, shoot, thrust }
  }

  clear = (): void => {
    this.keys.clear()
    this.buttons.clear()
    this.resetMobileState()
    document.querySelectorAll('.mobile-control.pressed').forEach((button) => button.classList.remove('pressed'))
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.clear)
    this.stopTiltListener()
    this.clear()
  }
}

