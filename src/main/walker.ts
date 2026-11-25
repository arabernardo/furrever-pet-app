import type { PetWindow } from './petWindow'

/** Moves the window sideways while the pet is in a walk state. Stops at screen edges. */
export class Walker {
  private timer: number | undefined
  private run = 0

  constructor(private readonly win: PetWindow) {}

  async start(dir: -1 | 1, speedPxPerSec: number, onBlocked: () => void): Promise<void> {
    this.stop()
    const id = ++this.run
    await this.win.refreshScreens()
    const rect = await this.win.getRect()
    if (id !== this.run) return // cancelled while we were awaiting
    let x = rect.x
    let last = performance.now()
    this.timer = window.setInterval(() => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      const wanted = x + dir * speedPxPerSec * dt
      const c = this.win.clamp(wanted, rect.y, rect.w, rect.h)
      x = c.x
      this.win.moveTo(c.x, c.y)
      if (Math.abs(c.x - wanted) > 0.5) {
        this.stop()
        onBlocked()
      }
    }, 33)
  }

  stop(): void {
    this.run++
    if (this.timer !== undefined) {
      window.clearInterval(this.timer)
      this.timer = undefined
      this.win.persistSoon()
    }
  }
}
