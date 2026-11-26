import type { AppSettings, Gender, PetSize, SleepAfter } from './types'

export const PET_SIZES: PetSize[] = ['small', 'medium', 'large']
export const SIZE_SCALE: Record<PetSize, number> = { small: 0.75, medium: 1, large: 1.5 }
export const GENDERS: Gender[] = ['boy', 'girl']
export const COLLAR_COLORS: Record<Gender, string> = { boy: '#4a90e2', girl: '#ff7eb6' }
export const MAX_NAME_LENGTH = 20

export const SLEEP_OPTIONS: { value: SleepAfter; label: string }[] = [
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 0, label: 'Never' },
]

export const DEFAULT_SETTINGS: AppSettings = {
  petId: 'dog',
  size: 'medium',
  volume: 0.6,
  muted: false,
  wandering: true,
  sleepAfterMin: 5,
  petName: '',
  gender: 'boy',
  ownerName: '',
  checkIns: true,
  onboarded: false,
  notifications: true,
}