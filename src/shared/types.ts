export const PET_STATES = ['idle', 'blink', 'walk-left', 'walk-right', 'sit', 'sleep', 'happy', 'surprised', 'dangle'] as const
export type PetState = (typeof PET_STATES)[number]
export type PetSize = 'small' | 'medium' | 'large'
export const SOUND_KINDS = ['click', 'doubleClick', 'pickup', 'sneeze', 'growl'] as const
export type PetSoundKind = (typeof SOUND_KINDS)[number]
export type SynthKind = 'bark' | 'yelp' | 'purr' | 'mew' | 'whine' | 'sneeze' | 'growl' | 'hiss'

export interface AnimationConfig {
  /** Horizontal strip, path relative to the pet folder. Omit to use the generated placeholder. */
  sheet?: string
  /** Reuse another animation's sheet, flipped horizontally (e.g. walk-right mirrors walk-left). */
  mirrorOf?: PetState
  frames: number
  fps: number
  loop: boolean
}

export interface PlaceholderConfig {
  style: 'dog' | 'cat' | 'blob'
  body: string
  accent: string
  belly: string
}

export interface PetConfig {
  id: string
  name: string
  /** Logical size in px at "medium". Sheet frames should be this size (or an integer multiple). */
  frame: { width: number; height: number }
  placeholder: PlaceholderConfig
  sounds: Partial<Record<PetSoundKind, string[]>> & {
    /** Web Audio fallback used when no sound files exist for that kind. */
    synth?: Partial<Record<PetSoundKind, SynthKind | 'none'>>
  }
  animations: Partial<Record<PetState, AnimationConfig>> & { idle: AnimationConfig }
}

export interface AppSettings {
  petId: string
  size: PetSize
  volume: number
  muted: boolean
  wandering: boolean
  sleepEnabled: boolean
}

export interface SavedPosition {
  x: number
  y: number
}

/** Physical pixels. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const SETTINGS_CHANGED_EVENT = 'settings-changed'
export const SHOW_PET_EVENT = 'show-pet'