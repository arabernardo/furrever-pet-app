import type { LoadedPet } from '@/pets/loader'
import type { PetSoundKind } from '@/shared/types'
import { buildSynth } from './synth'

const COOLDOWN_MS: Record<PetSoundKind, number> = { click: 350, doubleClick: 600, pickup: 1500, sneeze: 0, growl: 1500, pant: 2000, eat: 800, lick: 300 }

/** Plays sound files via HTMLAudioElement; falls back to Web Audio synth when none exist. */
export class PetAudio {
  volume = 0.6
  muted = false
  private pet: LoadedPet | null = null
  private ctx: AudioContext | null = null
  private stopCurrent: (() => void) | null = null
  private lastAt: Record<PetSoundKind, number> = { click: 0, doubleClick: 0, pickup: 0, sneeze: 0, growl: 0, pant: 0, eat: 0, lick: 0 }
  private lastVariant: Record<PetSoundKind, number> = { click: -1, doubleClick: -1, pickup: -1, sneeze: -1, growl: -1, pant: -1, eat: -1, lick: -1 }

  setPet(pet: LoadedPet): void {
    this.pet = pet
    this.stopSound()
  }

  play(kind: PetSoundKind): void {
    if (this.muted || this.volume <= 0 || !this.pet) return
    const now = performance.now()
    if (now - this.lastAt[kind] < COOLDOWN_MS[kind]) return // rapid clicks don't stack
    this.lastAt[kind] = now
    this.stopSound() // never overlap two sounds
    const urls = this.pet.sounds[kind]
    if (urls.length > 0) this.playFile(kind, urls)
    else this.playSynth(kind)
  }

  private stopSound(): void {
    this.stopCurrent?.()
    this.stopCurrent = null
  }

  private pickVariant(kind: PetSoundKind, count: number): number {
    let i = Math.floor(Math.random() * count)
    if (count > 1 && i === this.lastVariant[kind]) i = (i + 1) % count
    this.lastVariant[kind] = i
    return i
  }

  private playFile(kind: PetSoundKind, urls: string[]): void {
    const el = new Audio(urls[this.pickVariant(kind, urls.length)])
    el.volume = this.volume
    this.stopCurrent = () => {
      el.pause()
      el.currentTime = 0
    }
    el.play().catch((err) => {
      console.warn('[audio] file failed, using synth fallback', err)
      this.playSynth(kind)
    })
  }

  private playSynth(kind: PetSoundKind): void {
    const synth = this.pet?.config.sounds?.synth?.[kind]
    if (!synth || synth === 'none') return
    try {
      const ctx = this.ctx ?? (this.ctx = new AudioContext())
      if (ctx.state === 'suspended') void ctx.resume()
      const master = ctx.createGain()
      master.gain.value = this.volume * 0.5
      master.connect(ctx.destination)
      const nodes = buildSynth(synth, ctx, master, 0.92 + Math.random() * 0.16)
      this.stopCurrent = () => {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.01)
        for (const n of nodes) {
          try {
            n.stop(ctx.currentTime + 0.05)
          } catch {
            // already stopped
          }
        }
      }
    } catch (err) {
      console.warn('[audio] synth failed', err)
    }
  }
}