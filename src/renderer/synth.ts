import type { SynthKind } from '@/shared/types'

type Builder = (ctx: AudioContext, out: AudioNode, pitch: number) => AudioScheduledSourceNode[]

function envelope(ctx: AudioContext, t: number, attack: number, peak: number, end: number): GainNode {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + end)
  return g
}

/** A buffer of white noise, `seconds` long. */
function noiseSource(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  return src
}

const bark: Builder = (ctx, out, pitch) => {
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(520 * pitch, t)
  osc.frequency.exponentialRampToValueAtTime(180 * pitch, t + 0.15)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 900
  filter.Q.value = 0.8
  const env = envelope(ctx, t, 0.01, 1, 0.2)
  osc.connect(filter)
  filter.connect(env)
  env.connect(out)
  osc.start(t)
  osc.stop(t + 0.22)
  return [osc]
}

const yelp: Builder = (ctx, out, pitch) => {
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(600 * pitch, t)
  osc.frequency.exponentialRampToValueAtTime(1050 * pitch, t + 0.09)
  osc.frequency.exponentialRampToValueAtTime(650 * pitch, t + 0.22)
  const env = envelope(ctx, t, 0.01, 0.8, 0.25)
  osc.connect(env)
  env.connect(out)
  osc.start(t)
  osc.stop(t + 0.27)
  return [osc]
}

const mew: Builder = (ctx, out, pitch) => {
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(480 * pitch, t)
  osc.frequency.exponentialRampToValueAtTime(900 * pitch, t + 0.14)
  osc.frequency.exponentialRampToValueAtTime(560 * pitch, t + 0.45)
  const vibrato = ctx.createOscillator()
  vibrato.frequency.value = 7
  const vibratoDepth = ctx.createGain()
  vibratoDepth.gain.value = 14
  vibrato.connect(vibratoDepth)
  vibratoDepth.connect(osc.frequency)
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 2600
  const env = envelope(ctx, t, 0.04, 0.9, 0.5)
  osc.connect(lowpass)
  lowpass.connect(env)
  env.connect(out)
  osc.start(t)
  vibrato.start(t)
  osc.stop(t + 0.52)
  vibrato.stop(t + 0.52)
  return [osc, vibrato]
}

const purr: Builder = (ctx, out, pitch) => {
  const t = ctx.currentTime
  const length = 1.4
  // 1 s of looping white noise, low-passed, with its volume pulsed at ~25 Hz = purr-like rumble
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  noise.loop = true
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 320
  lowpass.Q.value = 1.2
  const pulse = ctx.createGain()
  pulse.gain.value = 0.5
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 25 * pitch
  const depth = ctx.createGain()
  depth.gain.value = 0.5
  lfo.connect(depth)
  depth.connect(pulse.gain)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(8, t + 0.25)
  env.gain.setValueAtTime(8, t + length - 0.35)
  env.gain.exponentialRampToValueAtTime(0.0001, t + length)
  noise.connect(lowpass)
  lowpass.connect(pulse)
  pulse.connect(env)
  env.connect(out)
  noise.start(t)
  lfo.start(t)
  noise.stop(t + length + 0.05)
  lfo.stop(t + length + 0.05)
  return [noise, lfo]
}

// Rising then falling cry with a wobble, like a puppy whine
const whine: Builder = (ctx, out, pitch) => {
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(520 * pitch, t)
  osc.frequency.exponentialRampToValueAtTime(980 * pitch, t + 0.3)
  osc.frequency.exponentialRampToValueAtTime(700 * pitch, t + 0.55)
  osc.frequency.exponentialRampToValueAtTime(460 * pitch, t + 0.9)
  const wobble = ctx.createOscillator()
  wobble.frequency.value = 6
  const wobbleDepth = ctx.createGain()
  wobbleDepth.gain.value = 22
  wobble.connect(wobbleDepth)
  wobbleDepth.connect(osc.frequency)
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 2400
  const env = envelope(ctx, t, 0.08, 0.8, 0.95)
  osc.connect(lowpass)
  lowpass.connect(env)
  env.connect(out)
  osc.start(t)
  wobble.start(t)
  osc.stop(t + 0.97)
  wobble.stop(t + 0.97)
  return [osc, wobble]
}

// Quiet inhale, short pause, then a sharp burst of filtered noise
const sneeze: Builder = (ctx, out, pitch) => {
  const t = ctx.currentTime
  const noise = noiseSource(ctx, 0.6)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 1.4
  band.frequency.setValueAtTime(2500 * pitch, t)
  band.frequency.linearRampToValueAtTime(3200 * pitch, t + 0.16)
  band.frequency.setValueAtTime(4200 * pitch, t + 0.2)
  band.frequency.exponentialRampToValueAtTime(1600 * pitch, t + 0.42)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(0.25, t + 0.15) // inhale
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.19)
  env.gain.exponentialRampToValueAtTime(2.2, t + 0.21) // burst
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
  noise.connect(band)
  band.connect(env)
  env.connect(out)
  noise.start(t)
  noise.stop(t + 0.5)
  return [noise]
}

// Low rough rumble: a low sawtooth with fast volume flutter, plus a little breathy noise
const growl: Builder = (ctx, out, pitch) => {
  const t = ctx.currentTime
  const length = 0.95
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(95 * pitch, t)
  osc.frequency.linearRampToValueAtTime(70 * pitch, t + length)
  const flutter = ctx.createGain()
  flutter.gain.value = 0.6
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 26
  const lfoDepth = ctx.createGain()
  lfoDepth.gain.value = 0.4
  lfo.connect(lfoDepth)
  lfoDepth.connect(flutter.gain)
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 520
  lowpass.Q.value = 2
  const breath = noiseSource(ctx, length)
  const breathFilter = ctx.createBiquadFilter()
  breathFilter.type = 'lowpass'
  breathFilter.frequency.value = 700
  const breathGain = ctx.createGain()
  breathGain.gain.value = 0.25
  const env = envelope(ctx, t, 0.1, 1.6, length)
  osc.connect(flutter)
  flutter.connect(lowpass)
  lowpass.connect(env)
  breath.connect(breathFilter)
  breathFilter.connect(breathGain)
  breathGain.connect(env)
  env.connect(out)
  osc.start(t)
  lfo.start(t)
  breath.start(t)
  osc.stop(t + length + 0.02)
  lfo.stop(t + length + 0.02)
  breath.stop(t + length + 0.02)
  return [osc, lfo, breath]
}

// High-passed noise: a cat hiss
const hiss: Builder = (ctx, out) => {
  const t = ctx.currentTime
  const noise = noiseSource(ctx, 0.8)
  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 3500
  const env = envelope(ctx, t, 0.06, 0.8, 0.7)
  noise.connect(highpass)
  highpass.connect(env)
  env.connect(out)
  noise.start(t)
  noise.stop(t + 0.75)
  return [noise]
}

// Three breathy "heh" bursts: band-passed noise plus a faint voiced layer for the "eh"
const pant: Builder = (ctx, out, pitch) => {
  const t = ctx.currentTime
  const noise = noiseSource(ctx, 1.2)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1500 * pitch
  band.Q.value = 1.1
  const voice = ctx.createOscillator()
  voice.type = 'sawtooth'
  voice.frequency.value = 240 * pitch
  const formant = ctx.createBiquadFilter()
  formant.type = 'bandpass'
  formant.frequency.value = 800
  formant.Q.value = 2
  const voiceGain = ctx.createGain()
  voiceGain.gain.value = 0.12
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  for (let k = 0; k < 3; k++) {
    const s = t + k * 0.3
    env.gain.setValueAtTime(0.0001, s)
    env.gain.exponentialRampToValueAtTime(1.2, s + 0.04)
    env.gain.exponentialRampToValueAtTime(0.0001, s + 0.17)
  }
  noise.connect(band)
  band.connect(env)
  voice.connect(formant)
  formant.connect(voiceGain)
  voiceGain.connect(env)
  env.connect(out)
  noise.start(t)
  voice.start(t)
  noise.stop(t + 1)
  voice.stop(t + 1)
  return [noise, voice]
}

// Four crunchy bursts of band-passed noise
const munch: Builder = (ctx, out, pitch) => {
  const t = ctx.currentTime
  const noise = noiseSource(ctx, 1)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1100 * pitch
  band.Q.value = 0.9
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  for (let k = 0; k < 4; k++) {
    const s = t + k * 0.17
    env.gain.setValueAtTime(0.0001, s)
    env.gain.exponentialRampToValueAtTime(1.6, s + 0.015)
    env.gain.exponentialRampToValueAtTime(0.0001, s + 0.1)
  }
  noise.connect(band)
  band.connect(env)
  env.connect(out)
  noise.start(t)
  noise.stop(t + 0.8)
  return [noise]
}

// Two quick wet strokes: band-passed noise with a rising sweep
const lick: Builder = (ctx, out, pitch) => {
  const t = ctx.currentTime
  const noise = noiseSource(ctx, 0.5)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 2.5
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  for (const s of [0, 0.2]) {
    band.frequency.setValueAtTime(1800 * pitch, t + s)
    band.frequency.exponentialRampToValueAtTime(3400 * pitch, t + s + 0.12)
    env.gain.setValueAtTime(0.0001, t + s)
    env.gain.exponentialRampToValueAtTime(0.5, t + s + 0.04)
    env.gain.exponentialRampToValueAtTime(0.0001, t + s + 0.14)
  }
  noise.connect(band)
  band.connect(env)
  env.connect(out)
  noise.start(t)
  noise.stop(t + 0.45)
  return [noise]
}

const BUILDERS: Record<SynthKind, Builder> = { bark, yelp, mew, purr, whine, sneeze, growl, hiss, pant, munch, lick }

export function buildSynth(kind: SynthKind, ctx: AudioContext, out: AudioNode, pitch: number): AudioScheduledSourceNode[] {
  return BUILDERS[kind](ctx, out, pitch)
}