import { invoke } from '@tauri-apps/api/core'

/** Direction the eyes look: -1, 0 or 1 on each axis. [0, 0] is straight ahead. */
export type Gaze = [number, number]

/** Turns a cursor offset from the pet's centre (physical px) into one of 9 directions. */
export function toGaze(dx: number, dy: number, dpr: number): Gaze {
  if (Math.hypot(dx, dy) < 60 * dpr) return [0, 0] // cursor on or next to the pet
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  return [ax > ay * 0.4 ? Math.sign(dx) : 0, ay > ax * 0.4 ? Math.sign(dy) : 0]
}

/** Polls the cursor position and reports only when the look direction changes. */
export class GazeTracker {
  private last: Gaze = [0, 0]
  private running = false
  private inflight = false
  private timer: number | undefined

  constructor(
    private readonly onChange: (g: Gaze) => void,
    private readonly intervalMs = 150,
  ) {}

  start(): void {
    this.running = true
    if (!this.inflight && this.timer === undefined) void this.poll()
  }

  stop(): void {
    this.running = false
    window.clearTimeout(this.timer)
    this.timer = undefined
  }

  private async poll(): Promise<void> {
    this.inflight = true
    try {
      const off = await invoke<[number, number] | null>('cursor_offset')
      if (off) {
        const g = toGaze(off[0], off[1], window.devicePixelRatio || 1)
        if (g[0] !== this.last[0] || g[1] !== this.last[1]) {
          this.last = g
          this.onChange(g)
        }
      }
    } catch (err) {
      console.warn('[gaze] poll failed', err)
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
}