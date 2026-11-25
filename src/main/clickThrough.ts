import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * Click-through by polling. The window ignores the mouse by default. Every tick we ask Rust
 * where the cursor is, read the sprite's alpha there, and only let the window take mouse input
 * while the cursor is over a visible pixel (or while a press/drag is in progress).
 */
export class ClickThrough {
  /** Set true during press/drag so the window never turns click-through under the cursor. */
  captureLock = false
  private ignoring: boolean | null = null
  private lastHit = false
  private running = false
  private inflight = false
  private timer: number | undefined
  private intervalMs = 50
  private readonly win = getCurrentWindow()

  constructor(
    private readonly hitTest: (x: number, y: number) => boolean,
    private readonly onHitChange: (hit: boolean) => void,
  ) {}

  start(intervalMs: number): void {
    this.intervalMs = intervalMs
    this.running = true
    if (!this.inflight && this.timer === undefined) void this.poll()
  }

  setInterval(ms: number): void {
    this.intervalMs = ms
  }

  stop(): void {
    this.running = false
    window.clearTimeout(this.timer)
    this.timer = undefined
    if (this.lastHit) {
      this.lastHit = false
      this.onHitChange(false)
    }
  }

  private async poll(): Promise<void> {
    this.inflight = true
    try {
      const pos = await invoke<[number, number] | null>('cursor_in_window')
      const hit = pos !== null && this.hitTest(pos[0], pos[1])
      if (hit !== this.lastHit) {
        this.lastHit = hit
        this.onHitChange(hit)
      }
      await this.setIgnore(!(hit || this.captureLock))
    } catch (err) {
      console.warn('[click-through] poll failed', err)
    } finally {
      this.inflight = false
    }
    if (this.running) {
      this.timer = window.setTimeout(() => {
        this.timer = undefined
        void this.poll()
      }, this.intervalMs)
    }
  }

  private async setIgnore(ignore: boolean): Promise<void> {
    if (ignore === this.ignoring) return
    this.ignoring = ignore
    await this.win.setIgnoreCursorEvents(ignore)
  }
}