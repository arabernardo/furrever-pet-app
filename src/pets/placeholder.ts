import type { PetConfig, PetState, PlaceholderConfig } from '@/shared/types'

type Eyes = 'open' | 'closed' | 'happy' | 'wide' | 'sleep'
type Mouth = 'smile' | 'open' | 'o' | 'flat'
type Legs = 'stand' | 'walk' | 'sit' | 'lie' | 'dangle'

interface Pose {
  bob: number
  tilt: number
  stretch: number
  eyes: Eyes
  mouth: Mouth
  tail: number
  legs: Legs
  phase: number
  t: number
  extra?: 'zzz' | 'bang'
}

const INK = '#2b2118'

function poseFor(anim: PetState, i: number, n: number): Pose {
  const t = n > 1 ? i / n : 0
  const wave = Math.sin(t * Math.PI * 2)
  const base: Pose = { bob: 0, tilt: 0, stretch: 1, eyes: 'open', mouth: 'smile', tail: wave * 0.4, legs: 'stand', phase: 0, t }
  switch (anim) {
    case 'idle':
      return { ...base, bob: wave * 1.5 }
    case 'blink':
      return { ...base, eyes: i === 1 || i === 2 ? 'closed' : 'open' }
    case 'walk-left':
    case 'walk-right':
      return { ...base, legs: 'walk', phase: t * Math.PI * 2, bob: -Math.abs(wave) * 3, tilt: (anim === 'walk-left' ? -1 : 1) * 0.06, tail: wave * 0.6 }
    case 'sit':
      return { ...base, legs: 'sit', stretch: 1 + wave * 0.02 }
    case 'sleep':
      return { ...base, legs: 'lie', eyes: 'sleep', mouth: 'flat', stretch: 1 + wave * 0.04, tail: 0, extra: 'zzz' }
    case 'happy': {
      const k = n > 1 ? i / (n - 1) : 0
      return { ...base, bob: -Math.sin(k * Math.PI) * 14, eyes: 'happy', mouth: 'open', tail: Math.sin(k * Math.PI * 6) * 0.7 }
    }
    case 'surprised':
      return { ...base, eyes: 'wide', mouth: 'o', stretch: 1.06, bob: i === 0 ? -6 : -2, tail: 0, extra: 'bang' }
    case 'dangle':
      return { ...base, legs: 'dangle', eyes: 'wide', mouth: 'o', tilt: wave * 0.08, phase: t * Math.PI * 2, tail: 0 }
  }
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
}

function triangle(ctx: CanvasRenderingContext2D, a: number[], b: number[], c: number[], fill: string): void {
  ctx.beginPath()
  ctx.moveTo(a[0], a[1])
  ctx.lineTo(b[0], b[1])
  ctx.lineTo(c[0], c[1])
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function arc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, from: number, to: number): void {
  ctx.beginPath()
  ctx.arc(x, y, r, from * Math.PI, to * Math.PI)
  ctx.stroke()
}

function drawTail(ctx: CanvasRenderingContext2D, style: string, color: string, x: number, y: number, angle: number, legs: Legs): void {
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineWidth = style === 'cat' ? 9 : 12
  ctx.beginPath()
  ctx.moveTo(x, y)
  if (legs === 'dangle') ctx.quadraticCurveTo(x + 8, y + 12, x + 2, y + 28)
  else if (legs === 'lie') ctx.quadraticCurveTo(x + 18, y + 6, x + 8, y + 14)
  else if (style === 'cat') ctx.quadraticCurveTo(x + 24, y - 6, x + 14 + angle * 22, y - 40)
  else ctx.quadraticCurveTo(x + 14, y - 2, x + 12 + angle * 18, y - 26)
  ctx.stroke()
}

function drawFeet(ctx: CanvasRenderingContext2D, legs: Legs, phase: number, color: string): void {
  const foot = (x: number, y: number, rx = 11, ry = 6.5): void => ellipse(ctx, x, y, rx, ry, color)
  switch (legs) {
    case 'walk': {
      const a = Math.sin(phase)
      const b = Math.sin(phase + Math.PI)
      foot(50 + a * 8, 113 - Math.max(0, a) * 6)
      foot(78 + b * 8, 113 - Math.max(0, b) * 6)
      break
    }
    case 'sit':
      foot(50, 115, 11, 6)
      foot(78, 115, 11, 6)
      break
    case 'lie':
      foot(48, 107, 11, 6)
      foot(80, 107, 11, 6)
      break
    case 'dangle': {
      const s = Math.sin(phase) * 4
      ctx.strokeStyle = color
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      line(ctx, 50, 100, 48 + s, 120)
      line(ctx, 78, 100, 80 - s, 120)
      break
    }
    default:
      foot(50, 113)
      foot(78, 113)
  }
}

function drawEars(ctx: CanvasRenderingContext2D, style: string, cx: number, hy: number, body: string, accent: string, flop: number): void {
  for (const s of [-1, 1]) {
    if (style === 'cat') {
      triangle(ctx, [cx + s * 29, hy - 6], [cx + s * 25, hy - 38], [cx + s * 7, hy - 25], body)
      triangle(ctx, [cx + s * 25, hy - 14], [cx + s * 23, hy - 31], [cx + s * 12, hy - 23], '#f6a9b6')
    } else {
      ctx.save()
      ctx.translate(cx + s * 28, hy - 8)
      ctx.rotate(-s * flop)
      ellipse(ctx, 0, 10, 10, 19, accent)
      ctx.restore()
    }
  }
}

function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, kind: Eyes): void {
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  switch (kind) {
    case 'open':
      ellipse(ctx, x, y, 4.6, 5.4, INK)
      ellipse(ctx, x + 1.6, y - 1.8, 1.6, 1.6, '#fff')
      break
    case 'wide':
      ctx.beginPath()
      ctx.ellipse(x, y, 8, 9, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.stroke()
      ellipse(ctx, x, y, 3.2, 3.6, INK)
      break
    case 'closed':
      line(ctx, x - 5, y, x + 5, y)
      break
    case 'happy':
      arc(ctx, x, y + 3, 5, 1.1, 1.9)
      break
    case 'sleep':
      arc(ctx, x, y - 1, 5, 0.1, 0.9)
      break
  }
}

function drawFace(ctx: CanvasRenderingContext2D, p: PlaceholderConfig, cx: number, hy: number, pose: Pose): void {
  if (p.style === 'dog') ellipse(ctx, cx - 14, hy - 2, 11, 12, p.accent) // eye patch
  if (p.style === 'cat') {
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    for (const dx of [-9, 0, 9]) line(ctx, cx + dx, hy - 29, cx + dx * 0.8, hy - 20)
  }
  drawEye(ctx, cx - 14, hy + 2, pose.eyes)
  drawEye(ctx, cx + 14, hy + 2, pose.eyes)
  ellipse(ctx, cx - 23, hy + 13, 5, 3.5, 'rgba(255,120,140,.35)')
  ellipse(ctx, cx + 23, hy + 13, 5, 3.5, 'rgba(255,120,140,.35)')

  let my = hy + 13
  if (p.style === 'dog') {
    ellipse(ctx, cx, hy + 12, 14, 10, p.belly)
    ellipse(ctx, cx, hy + 7, 5.5, 3.8, INK)
    my = hy + 14
  } else if (p.style === 'cat') {
    triangle(ctx, [cx - 3.5, hy + 8], [cx + 3.5, hy + 8], [cx, hy + 12], '#f08ea0')
    ctx.strokeStyle = 'rgba(60,45,35,.55)'
    ctx.lineWidth = 1.6
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) line(ctx, cx + s * 26, hy + 9 + k * 4, cx + s * 46, hy + 4 + k * 8)
    }
  }

  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  switch (pose.mouth) {
    case 'smile':
      arc(ctx, cx - 5, my, 5, 0.1, 0.9)
      arc(ctx, cx + 5, my, 5, 0.1, 0.9)
      break
    case 'open':
      ellipse(ctx, cx, my + 5, 5, 6.5, '#7a2e3a')
      ellipse(ctx, cx, my + 8, 3.6, 2.8, '#f06a7e')
      break
    case 'o':
      ellipse(ctx, cx, my + 5, 3.5, 4.5, INK)
      break
    case 'flat':
      line(ctx, cx - 4, my + 2, cx + 4, my + 2)
      break
  }
}

function drawExtras(ctx: CanvasRenderingContext2D, kind: Pose['extra'], t: number): void {
  if (kind === 'zzz') {
    for (let k = 0; k < 2; k++) {
      const u = (t + k * 0.5) % 1
      ctx.globalAlpha = 1 - u
      ctx.fillStyle = '#5b7bd6'
      ctx.font = `bold ${12 + k * 4}px sans-serif`
      ctx.fillText('Z', 86 + u * 12, 62 - u * 30)
    }
    ctx.globalAlpha = 1
  } else if (kind === 'bang') {
    ctx.fillStyle = '#e8494f'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText('!', 94, 30)
  }
}

function drawPet(ctx: CanvasRenderingContext2D, p: PlaceholderConfig, pose: Pose): void {
  const lie = pose.legs === 'lie'
  const sit = pose.legs === 'sit'
  const hang = pose.legs === 'dangle'
  const cx = 64
  const headY = hang ? 46 : lie ? 82 : 58
  const bodyY = hang ? 84 : lie ? 100 : sit ? 96 : 94
  const bodyRx = lie ? 40 : sit ? 25 : 28
  const bodyRy = (hang ? 24 : lie ? 16 : sit ? 26 : 22) * pose.stretch

  if (!hang) ellipse(ctx, cx, 119, 34, 5, 'rgba(0,0,0,.12)')

  ctx.save()
  const pivotY = hang ? 14 : 118
  ctx.translate(cx, pivotY)
  ctx.rotate(pose.tilt)
  ctx.translate(-cx, -pivotY + pose.bob)

  drawTail(ctx, p.style, p.style === 'cat' ? p.body : p.accent, cx + bodyRx - 6, bodyY - 2, pose.tail, pose.legs)
  ellipse(ctx, cx, bodyY, bodyRx, bodyRy, p.body)
  if (!lie) ellipse(ctx, cx, bodyY + 4, bodyRx * 0.6, bodyRy * 0.72, p.belly)
  drawFeet(ctx, pose.legs, pose.phase, p.belly)
  drawEars(ctx, p.style, cx, headY, p.body, p.accent, pose.eyes === 'wide' ? 0.2 : 0.5)
  ellipse(ctx, cx, headY, 32, 29, p.body)
  drawFace(ctx, p, cx, headY, pose)
  ctx.restore()

  drawExtras(ctx, pose.extra, pose.t)
}

/** Builds a horizontal sprite strip (frames × frame size, rendered at 2× for sharpness). */
export function createPlaceholderSheet(cfg: PetConfig, anim: PetState, frames: number): HTMLCanvasElement {
  const k = 2
  const { width: w, height: h } = cfg.frame
  const canvas = document.createElement('canvas')
  canvas.width = w * k * frames
  canvas.height = h * k
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas not available')
  const unit = (Math.min(w, h) / 128) * k
  for (let i = 0; i < frames; i++) {
    ctx.save()
    ctx.translate(i * w * k + (w * k - 128 * unit) / 2, (h * k - 128 * unit) / 2)
    ctx.scale(unit, unit)
    drawPet(ctx, cfg.placeholder, poseFor(anim, i, frames))
    ctx.restore()
  }
  return canvas
}