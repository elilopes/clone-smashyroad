import type { DriveInput } from './Car'

export class Input {
  private readonly keys = new Set<string>()
  private readonly buttons = new Set<string>()

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.clear)

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

  read(): DriveInput {
    const pressed = (...keys: string[]) => keys.some((key) => this.keys.has(key) || this.buttons.has(key))
    const throttle = Number(pressed('w', 'arrowup', 'accelerate')) - Number(pressed('s', 'arrowdown', 'reverse'))
    const steer = Number(pressed('a', 'arrowleft', 'left')) - Number(pressed('d', 'arrowright', 'right'))
    const handbrake = pressed('handbrake')
    const thrust = pressed('shift', 'shiftleft', 'shiftright', 'q', 'thrust', 'boost', ' ', 'space')
    const shoot = pressed('f', 'j', 'enter', 'shoot', 'x', 'control')
    return { throttle, steer, handbrake, shoot, thrust }
  }

  clear = (): void => {
    this.keys.clear()
    this.buttons.clear()
    document.querySelectorAll('.mobile-control.pressed').forEach((button) => button.classList.remove('pressed'))
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.clear)
    this.clear()
  }
}
