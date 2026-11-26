import {
  availableMonitors,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  primaryMonitor,
  type Monitor,
} from '@tauri-apps/api/window'
import type { Rect, SavedPosition } from '@/shared/types'
import { savePosition } from './settingsStore'

interface MaybeWorkArea {
  workArea?: { position: { x: number; y: number }; size: { width: number; height: number } }
}

/** Monitor area minus the taskbar, when Tauri reports it. */
function usableRect(m: Monitor): Rect {
  const wa = (m as unknown as MaybeWorkArea).workArea
  if (wa) return { x: wa.position.x, y: wa.position.y, w: wa.size.width, h: wa.size.height }
  // Older builds don't expose the work area: stay clear of a typical ~48px taskbar.
  return { x: m.position.x, y: m.position.y, w: m.size.width, h: m.size.height - Math.round(48 * m.scaleFactor) }
}

/** Keeps a w×h box fully inside the screen nearest to its centre. */
export function clampToScreens(x: number, y: number, w: number, h: number, screens: Rect[]): { x: number; y: number } {
  if (screens.length === 0) return { x, y }
  const cx = x + w / 2
  const cy = y + h / 2
  let best = screens[0]
  let bestDist = Infinity
  for (const s of screens) {
    const dx = Math.max(s.x - cx, 0, cx - (s.x + s.w))
    const dy = Math.max(s.y - cy, 0, cy - (s.y + s.h))
    const d = dx * dx + dy * dy
    if (d < bestDist) {
      best = s
      bestDist = d
    }
  }
  return {
    x: Math.min(Math.max(x, best.x), Math.max(best.x, best.x + best.w - w)),
    y: Math.min(Math.max(y, best.y), Math.max(best.y, best.y + best.h - h)),
  }
}

export class PetWindow {
  private readonly win = getCurrentWindow()
  private screens: Rect[] = []
  private size = { w: 128, h: 128 }
  private pending: { x: number; y: number } | null = null
  private busy = false
  private saveTimer: number | undefined

  async refreshScreens(): Promise<void> {
    this.screens = (await availableMonitors()).map(usableRect)
  }

  async getRect(): Promise<Rect> {
    const [p, s] = await Promise.all([this.win.outerPosition(), this.win.outerSize()])
    this.size = { w: s.width, h: s.height }
    return { x: p.x, y: p.y, w: s.width, h: s.height }
  }

  clamp(x: number, y: number, w = this.size.w, h = this.size.h): { x: number; y: number } {
    return clampToScreens(x, y, w, h, this.screens)
  }

  /**
   * Bottom-right corner of the screen the pet is on (physical px), `margin` in from the edges.
   * If that spot would cover the pet, the box goes just above the pet instead.
   */
  async cornerFor(w: number, h: number, margin: number): Promise<{ x: number; y: number }> {
    await this.refreshScreens()
    const r = await this.getRect()
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    const s = this.screens.find((m) => cx >= m.x && cx < m.x + m.w && cy >= m.y && cy < m.y + m.h) ?? this.screens[0]
    if (!s) return { x: 0, y: 0 }
    const x = s.x + s.w - w - margin
    const y = s.y + s.h - h - margin
    const covers = x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y
    return this.clamp(x, covers ? r.y - h - margin : y, w, h)
  }

  /** Resizes to a logical size. With `anchor`, the pet's bottom-centre stays put so it doesn't jump. */
  async setLogicalSize(w: number, h: number, anchor: boolean): Promise<void> {
    const before = anchor ? await this.getRect() : null
    await this.win.setSize(new LogicalSize(w, h))
    const after = await this.getRect()
    if (!before) return
    await this.refreshScreens()
    const c = this.clamp(before.x + before.w / 2 - after.w / 2, before.y + before.h - after.h)
    await this.win.setPosition(new PhysicalPosition(Math.round(c.x), Math.round(c.y)))
    this.persistSoon()
  }

  /** Restores the saved position, or starts at the bottom-right of the primary monitor. Never off-screen. */
  async place(saved: SavedPosition | null): Promise<void> {
    await this.refreshScreens()
    const r = await this.getRect()
    let target: { x: number; y: number }
    if (saved) {
      target = this.clamp(saved.x, saved.y)
    } else {
      const primary = await primaryMonitor()
      const area = primary ? usableRect(primary) : (this.screens[0] ?? { x: 0, y: 0, w: 1280, h: 720 })
      const margin = Math.round(24 * (primary?.scaleFactor ?? 1))
      target = this.clamp(area.x + area.w - r.w - margin, area.y + area.h - r.h)
    }
    await this.win.setPosition(new PhysicalPosition(Math.round(target.x), Math.round(target.y)))
  }

  /** Move while dragging (clamped to the screen). */
  dragTo(x: number, y: number): void {
    const c = this.clamp(x, y)
    this.moveTo(c.x, c.y)
  }

  /** Latest-wins move: at most one IPC call in flight, so fast drags never queue up. */
  moveTo(x: number, y: number): void {
    this.pending = { x: Math.round(x), y: Math.round(y) }
    if (!this.busy) void this.flush()
  }

  private async flush(): Promise<void> {
    this.busy = true
    try {
      while (this.pending) {
        const p = this.pending
        this.pending = null
        await this.win.setPosition(new PhysicalPosition(p.x, p.y))
      }
    } finally {
      this.busy = false
    }
  }

  persistSoon(): void {
    window.clearTimeout(this.saveTimer)
    this.saveTimer = window.setTimeout(async () => {
      const p = await this.win.outerPosition()
      await savePosition({ x: p.x, y: p.y })
    }, 400)
  }

  show(): Promise<void> {
    return this.win.show()
  }

  hide(): Promise<void> {
    return this.win.hide()
  }
}