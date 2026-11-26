import type { TreatKind } from '@/shared/types'

type PropKind = TreatKind | 'ball'

interface Heart {
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
  size: number
}

/** A thing that falls or bounces: a treat or the ball. Positions are CSS px. */
interface Prop {
  kind: PropKind
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
  rest: boolean
}

export const TREAT_LIFE_MS = 1500
export const BALL_LIFE_MS = 4200
const FADE_MS = 350

function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.3)
  ctx.bezierCurveTo(x, y - s * 0.2, x - s, y - s * 0.2, x - s, y + s * 0.3)
  ctx.bezierCurveTo(x - s, y + s * 0.8, x, y + s, x, y + s * 1.3)
  ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.8, x + s, y + s * 0.3)
  ctx.bezierCurveTo(x + s, y - s * 0.2, x, y - s * 0.2, x, y + s * 0.3)
  ctx.closePath()
}

/** Draws one prop centred on (0, 0) in 128px units. The caller translates and scales. */
function drawProp(ctx: CanvasRenderingContext2D, kind: PropKind): void {
  if (kind === 'bone') {
    ctx.fillStyle = '#f4e6c8'
    ctx.fillRect(-8, -2.5, 16, 5)
    for (const [x, y] of [[-8, -3], [-8, 3], [8, -3], [8, 3]]) {
      ctx.beginPath()
      ctx.arc(x, y, 3.4, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (kind === 'fish') {
    ctx.fillStyle = '#6fb7e9'
    ctx.beginPath()
    ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(8, 0)
    ctx.lineTo(16, -5.5)
    ctx.lineTo(16, 5.5)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#2b2118'
    ctx.beginPath()
    ctx.arc(-4.5, -1, 1.2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = '#ff6b6b'
    ctx.beginPath()
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(0, 0, 4.2, 0.3 * Math.PI, 0.95 * Math.PI)
    ctx.stroke()
  }
}

/** Hearts, treats and the ball, drawn on their own canvas so they never count as "pet pixels" for click-through. */
export class HeartEffect {
  private readonly ctx: CanvasRenderingContext2D
  private hearts: Heart[] = []
  private props: Prop[] = []
  private last = 0
  private dpr = 1
  private w = 128
  private h = 128

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas not available')
    this.ctx = ctx
  }

  get active(): boolean {
    return this.hearts.length > 0 || this.props.length > 0
  }

  setScale(dpr: number): void {
    this.dpr = dpr
  }

  burst(cssW: number, cssH: number): void {
    const now = performance.now()
    this.last = now
    for (let i = 0; i < 5; i++) {
      this.hearts.push({
        x: cssW * (0.35 + Math.random() * 0.3),
        y: cssH * 0.3,
        vx: (Math.random() - 0.5) * 18,
        vy: -(22 + Math.random() * 16),
        born: now + i * 120,
        life: 1400,
        size: 5 + Math.random() * 4,
      })
    }
  }

  /** A treat falls in beside the pet, rests on the floor, then shrinks away. */
  drop(kind: TreatKind, cssW: number, cssH: number): void {
    this.begin(cssW, cssH)
    this.props = this.props.filter((p) => p.kind === 'ball')
    this.props.push({ kind, x: cssW * 0.8, y: -cssH * 0.08, vx: 0, vy: 0, born: performance.now(), life: TREAT_LIFE_MS, rest: false })
  }

  /** A ball bounces around the window for a few seconds. */
  bounce(cssW: number, cssH: number): void {
    this.begin(cssW, cssH)
    const s = cssW / 128
    this.props = this.props.filter((p) => p.kind !== 'ball')
    this.props.push({ kind: 'ball', x: cssW * 0.15, y: cssH * 0.3, vx: 75 * s, vy: -60 * s, born: performance.now(), life: BALL_LIFE_MS, rest: false })
  }

  clearProps(): void {
    this.props = []
  }

  private begin(cssW: number, cssH: number): void {
    if (!this.active) this.last = performance.now() // avoid a big time step after idling
    this.w = cssW
    this.h = cssH
  }

  private step(dt: number): void {
    const s = this.w / 128
    const gravity = 900 * s
    const floor = this.h * 0.86
    for (const p of this.props) {
      if (p.rest) continue
      p.vy += gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.kind === 'ball') {
        const r = 6.5 * s
        if (p.x < r || p.x > this.w - r) {
          p.vx = -p.vx
          p.x = Math.min(Math.max(p.x, r), this.w - r)
        }
        if (p.y > floor - r) {
          p.y = floor - r
          p.vy = -Math.max(Math.abs(p.vy) * 0.85, 190 * s) // keeps bouncing
        }
      } else if (p.y >= floor) {
        p.y = floor
        p.vy = 0
        p.rest = true
      }
    }
  }

  draw(now: number): void {
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!this.active) return
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000))
    this.last = now
    this.hearts = this.hearts.filter((h) => now - h.born < h.life)
    this.props = this.props.filter((p) => now - p.born < p.life)
    this.step(dt)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    ctx.fillStyle = '#ff5d8f'
    for (const h of this.hearts) {
      const age = now - h.born
      if (age < 0) continue
      h.x += h.vx * dt
      h.y += h.vy * dt
      ctx.globalAlpha = 1 - age / h.life
      heartPath(ctx, h.x, h.y, h.size)
      ctx.fill()
    }

    const s = this.w / 128
    for (const p of this.props) {
      const left = p.life - (now - p.born)
      const k = left < FADE_MS ? Math.max(0, left / FADE_MS) : 1
      ctx.globalAlpha = 1
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.scale(s * k, s * k)
      drawProp(ctx, p.kind)
      ctx.restore()
    }
    ctx.globalAlpha = 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
}