import type { TreatKind } from '@/shared/types'
import { HeartEffect } from './effects'
import type { LoadedAnimation } from './loader'

/**
 * Draws the sprite at the animation's own fps. When nothing is animating (single frame, finished
 * one-shot, paused) no timer is scheduled, so idle CPU is effectively zero.
 */
export class PetRenderer {
  onFinish: (() => void) | null = null
  private readonly ctx: CanvasRenderingContext2D
  private readonly hearts: HeartEffect
  private anim: LoadedAnimation | null = null
  private frame = 0
  private lastFrameAt = 0
  private running = false
  private timer: number | undefined
  private finishTimer: number | undefined
  private cssW = 128
  private cssH = 128

  constructor(private readonly canvas: HTMLCanvasElement, fxCanvas: HTMLCanvasElement) {
    // willReadFrequently keeps the bitmap on the CPU so the alpha hit-test (getImageData) is cheap.
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('2D canvas not available')
    this.ctx = ctx
    this.hearts = new HeartEffect(fxCanvas)
  }

  /** Sizes both canvases to cssW×cssH CSS px at the current device pixel ratio. */
  resize(cssW: number, cssH: number): void {
    const dpr = window.devicePixelRatio || 1
    this.cssW = cssW
    this.cssH = cssH
    for (const c of [this.canvas, this.hearts.canvas]) {
      c.width = Math.round(cssW * dpr)
      c.height = Math.round(cssH * dpr)
      c.style.width = `${cssW}px`
      c.style.height = `${cssH}px`
    }
    this.hearts.setScale(dpr)
    this.kick()
  }

  play(anim: LoadedAnimation): void {
    this.anim = anim
    this.frame = 0
    this.lastFrameAt = performance.now()
    window.clearTimeout(this.finishTimer)
    this.finishTimer = undefined
    if (!anim.loop) {
      const total = (anim.frames / anim.fps) * 1000
      this.finishTimer = window.setTimeout(() => this.onFinish?.(), Math.max(200, total + 60))
    }
    this.kick()
  }

  /** Swaps the sheet but keeps the current frame, for same-length variants (eye direction). */
  swap(anim: LoadedAnimation): void {
    if (!this.anim || this.anim.frames !== anim.frames) return this.play(anim)
    this.anim = anim
    this.kick()
  }

  start(): void {
    this.running = true
    this.lastFrameAt = performance.now()
    this.kick()
  }

  stop(): void {
    this.running = false
    window.clearTimeout(this.timer)
    window.clearTimeout(this.finishTimer)
    this.timer = undefined
    this.finishTimer = undefined
  }

  /** True if the pixel (canvas/physical px) is visibly part of the pet. */
  hitTest(px: number, py: number): boolean {
    const x = Math.floor(px)
    const y = Math.floor(py)
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return false
    return this.ctx.getImageData(x, y, 1, 1).data[3] > 10
  }

  burstHearts(): void {
    this.hearts.burst(this.cssW, this.cssH)
    this.kick()
  }

  dropTreat(kind: TreatKind): void {
    this.hearts.drop(kind, this.cssW, this.cssH)
    this.kick()
  }

  bounceBall(): void {
    this.hearts.bounce(this.cssW, this.cssH)
    this.kick()
  }

  clearProps(): void {
    this.hearts.clearProps()
  }

  private kick(): void {
    if (this.running && this.timer === undefined) this.timer = window.setTimeout(this.loop, 0)
  }

  private get animating(): boolean {
    const a = this.anim
    return !!a && a.frames > 1 && (a.loop || this.frame < a.frames - 1)
  }

  private loop = (): void => {
    this.timer = undefined
    const anim = this.anim
    if (!this.running || !anim) return
    const now = performance.now()
    const frameMs = 1000 / anim.fps
    if (this.animating) {
      const steps = Math.floor((now - this.lastFrameAt) / frameMs)
      if (steps > 0) {
        this.lastFrameAt += steps * frameMs
        const next = this.frame + steps
        this.frame = anim.loop ? next % anim.frames : Math.min(next, anim.frames - 1)
      }
    }
    this.draw(anim, now)
    if (this.hearts.active) {
      this.timer = window.setTimeout(this.loop, 33)
    } else if (this.animating) {
      this.timer = window.setTimeout(this.loop, Math.max(8, this.lastFrameAt + frameMs - performance.now()))
    }
  }

  private draw(anim: LoadedAnimation, now: number): void {
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    if (anim.flip) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(anim.sheet, this.frame * anim.frameW, 0, anim.frameW, anim.frameH, 0, 0, canvas.width, canvas.height)
    ctx.restore()
    this.hearts.draw(now)
  }
}