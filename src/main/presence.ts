import { invoke } from '@tauri-apps/api/core'

const TICK_MS = 3000
/** Timers pause during sleep, so a gap this much longer than the tick means the PC slept. */
const SLEEP_GAP_MS = 20_000

/**
 * Notices when the user comes back after the PC was locked or asleep.
 * Polls every few seconds and reports once, after the PC is unlocked again, how long they were away.
 */
export class Presence {
  private timer: number | undefined
  private lastTick = 0
  private awaySince: number | null = null
  private busy = false

  constructor(
    private readonly onReturn: (awayMs: number) => void,
    private readonly minAwayMs: number,
  ) {}

  start(): void {
    this.stop()
    this.lastTick = Date.now()
    this.timer = window.setInterval(() => void this.tick(), TICK_MS)
  }

  stop(): void {
    window.clearInterval(this.timer)
    this.timer = undefined
    this.awaySince = null
  }

  private async tick(): Promise<void> {
    if (this.busy) return
    this.busy = true
    try {
      const now = Date.now()
      const gap = now - this.lastTick
      this.lastTick = now
      // Slept: remember when we last ran. Keep the earliest start if we were already away.
      if (gap > SLEEP_GAP_MS && this.awaySince === null) this.awaySince = now - gap

      const locked = await invoke<boolean>('is_session_locked').catch(() => false)
      if (locked) {
        if (this.awaySince === null) this.awaySince = now
        return
      }
      if (this.awaySince !== null) {
        const away = now - this.awaySince
        this.awaySince = null
        if (away >= this.minAwayMs) this.onReturn(away)
      }
    } finally {
      this.busy = false
    }
  }
}