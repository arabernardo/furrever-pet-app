import type { PetState } from '@/shared/types'

export interface MachineOptions {
  wandering: boolean
  /** Milliseconds without interaction before sleeping. 0 = never sleep. */
  sleepAfterMs: number
}

export interface MachineHooks {
  onEnter: (state: PetState) => void
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min)

/** Pure logic: no DOM, no Tauri. Timers are cleared on every transition, so states can't overlap. */
export class PetStateMachine {
  state: PetState = 'idle'
  private stateTimer: number | undefined
  private sleepTimer: number | undefined
  private napping = false
  private paused = true

  constructor(
    private readonly hooks: MachineHooks,
    private opts: MachineOptions,
  ) {}

  start(): void {
    this.paused = false
    this.enter('idle')
    this.armSleepTimer()
  }

  resume(): void {
    this.start()
  }

  pause(): void {
    this.paused = true
    window.clearTimeout(this.stateTimer)
    window.clearTimeout(this.sleepTimer)
  }

  setOptions(opts: MachineOptions): void {
    this.opts = opts
    if (this.paused) return
    if (opts.sleepAfterMs <= 0 && this.state === 'sleep') this.enter('idle')
    if (!opts.wandering && this.isWalking()) this.enter('idle')
    this.armSleepTimer()
  }

  click(): void {
    this.interacted()
    this.enter('happy')
  }

  doubleClick(): void {
    this.interacted()
    this.enter('surprised')
  }

  /** Hover/hold: counts as interaction and wakes the pet, without changing a non-sleep state. */
  touch(): void {
    this.interacted()
    if (this.state === 'sleep') this.enter('idle')
  }

  dragStart(): void {
    this.interacted()
    this.enter('dangle')
  }

  dragEnd(): void {
    this.interacted()
    if (this.state === 'dangle') this.enter('sit') // lands
  }

  animationFinished(): void {
    if (this.state === 'blink' || this.state === 'happy' || this.state === 'surprised') this.enter('idle')
  }

  /** The window hit a screen edge while walking. */
  blocked(): void {
    if (this.isWalking()) this.enter('idle')
  }

  private isWalking(): boolean {
    return this.state === 'walk-left' || this.state === 'walk-right'
  }

  private interacted(): void {
    if (!this.paused) this.armSleepTimer()
  }

  private armSleepTimer(): void {
    window.clearTimeout(this.sleepTimer)
    if (this.paused || this.opts.sleepAfterMs <= 0) return
    this.sleepTimer = window.setTimeout(() => this.fallAsleep(), this.opts.sleepAfterMs)
  }

  private fallAsleep(): void {
    if (this.state === 'dangle') return this.armSleepTimer()
    this.napping = false
    this.enter('sleep')
  }

  private after(ms: number, fn: () => void): void {
    this.stateTimer = window.setTimeout(fn, ms)
  }

  private enter(next: PetState): void {
    window.clearTimeout(this.stateTimer)
    this.state = next
    this.hooks.onEnter(next)
    switch (next) {
      case 'idle':
        this.after(rand(3000, 8000), () => this.pickIdleAction())
        break
      case 'sit':
        this.after(rand(6000, 12000), () => this.leaveSit())
        break
      case 'walk-left':
      case 'walk-right':
        this.after(rand(1500, 3500), () => this.enter('idle'))
        break
      case 'sleep':
        if (this.napping) this.after(rand(20000, 40000), () => this.enter('idle'))
        break
      case 'blink':
      case 'happy':
      case 'surprised':
        this.after(3000, () => this.enter('idle')) // safety net: never get stuck
        break
      case 'dangle':
        break
    }
  }

  private pickIdleAction(): void {
    const r = Math.random()
    if (r < 0.45) return this.enter('blink')
    if (r < 0.7) return this.enter('sit')
    if (this.opts.wandering) return this.enter(Math.random() < 0.5 ? 'walk-left' : 'walk-right')
    return this.enter('blink')
  }

  private leaveSit(): void {
    if (this.opts.sleepAfterMs > 0 && Math.random() < 0.15) {
      this.napping = true
      this.enter('sleep')
    } else {
      this.enter('idle')
    }
  }
}