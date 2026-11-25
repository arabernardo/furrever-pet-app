interface Heart {
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
  size: number
}

function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.3)
  ctx.bezierCurveTo(x, y - s * 0.2, x - s, y - s * 0.2, x - s, y + s * 0.3)
  ctx.bezierCurveTo(x - s, y + s * 0.8, x, y + s, x, y + s * 1.3)
  ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.8, x + s, y + s * 0.3)
  ctx.bezierCurveTo(x + s, y - s * 0.2, x, y - s * 0.2, x, y + s * 0.3)
  ctx.closePath()
}

/** Floating hearts, drawn on their own canvas so they never count as "pet pixels" for click-through. */
export class HeartEffect {
  private readonly ctx: CanvasRenderingContext2D
  private hearts: Heart[] = []
  private last = 0
  private dpr = 1

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas not available')
    this.ctx = ctx
  }

  get active(): boolean {
    return this.hearts.length > 0
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

  draw(now: number): void {
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (this.hearts.length === 0) return
    const dt = (now - this.last) / 1000
    this.last = now
    this.hearts = this.hearts.filter((h) => now - h.born < h.life)
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
    ctx.globalAlpha = 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
}