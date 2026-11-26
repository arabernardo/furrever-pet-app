export const PET_STATES = ['idle', 'blink', 'walk-left', 'walk-right', 'sit', 'sleep', 'happy', 'surprised', 'dangle'] as const
export type PetState = (typeof PET_STATES)[number]
export type PetSize = 'small' | 'medium' | 'large'
export const SOUND_KINDS = ['click', 'doubleClick', 'pickup', 'sneeze', 'growl', 'pant', 'eat'] as const
export type PetSoundKind = (typeof SOUND_KINDS)[number]
export type SynthKind = 'bark' | 'yelp' | 'purr' | 'mew' | 'whine' | 'sneeze' | 'growl' | 'hiss' | 'pant' | 'munch'
export type Gender = 'boy' | 'girl'
export type TreatKind = 'bone' | 'fish'

/** Minutes of no interaction before the pet falls asleep. 0 = never. */
export type SleepAfter = 0 | 5 | 15 | 30

export interface AnimationConfig {
  /** Horizontal strip, path relative to the pet folder. Omit to use the generated placeholder. */
  sheet?: string
  /** Reuse another animation's sheet, flipped horizontally (e.g. walk-right mirrors walk-left). */
  mirrorOf?: PetState
  frames: number
  fps: number
  loop: boolean
  /** Optional per-gender sheets for real art with the collar drawn in. Falls back to `sheet`. */
  genderSheets?: Partial<Record<Gender, string>>
}

export interface PlaceholderConfig {
  style: 'dog' | 'cat' | 'blob'
  body: string
  accent: string
  belly: string
  /** Draw an open mouth with a panting tongue (dogs). */
  tongue?: boolean
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
  /** What this pet is fed. Defaults to 'bone'. */
  treat?: TreatKind
}

export interface AppSettings {
  petId: string
  size: PetSize
  volume: number
  muted: boolean
  wandering: boolean
  sleepAfterMin: SleepAfter
  petName: string
  gender: Gender
  ownerName: string
  checkIns: boolean
  /** False until the first-run welcome has been completed. */
  onboarded: boolean
  notifications: boolean
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
export const BUBBLE_READY_EVENT = 'bubble-ready'
export const BUBBLE_CHOICE_EVENT = 'bubble-choice'
export const BUBBLE_WIDTH = 200

export interface BubbleChoice {
  label: string
  reply: string
}

export interface BubbleContent {
  id: number
  text: string
  choices: BubbleChoice[]
}

export const TOAST_READY_EVENT = 'toast-ready'
export const TOAST_CHOICE_EVENT = 'toast-choice'
export const TOAST_WIDTH = 320

export type ToastAction = 'feed' | 'play' | 'dismiss'

export interface ToastContent {
  id: number
  title: string
  text: string
}