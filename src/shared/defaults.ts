import type { AppSettings, PetSize } from './types'

export const PET_SIZES: PetSize[] = ['small', 'medium', 'large']
export const SIZE_SCALE: Record<PetSize, number> = { small: 0.75, medium: 1, large: 1.5 }

export const DEFAULT_SETTINGS: AppSettings = {
  petId: 'dog',
  size: 'medium',
  volume: 0.6,
  muted: false,
  wandering: true,
  sleepEnabled: true,
}