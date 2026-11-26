import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { load, type Store } from '@tauri-apps/plugin-store'
import { DEFAULT_SETTINGS, GENDERS, MAX_NAME_LENGTH, PET_SIZES, SLEEP_OPTIONS } from '@/shared/defaults'
import { SETTINGS_CHANGED_EVENT, type AppSettings, type SavedPosition, type SleepAfter } from '@/shared/types'
import { listPetConfigs } from '@/pets/registry'

let store: Store | null = null

async function getStore(): Promise<Store> {
  if (!store) store = await load('settings.json', { defaults: {}, autoSave: false })
  return store
}

const cleanName = (v: unknown): string => (typeof v === 'string' ? v.slice(0, MAX_NAME_LENGTH) : '')

function cleanSleep(raw: Partial<AppSettings> | null | undefined): SleepAfter {
  const match = SLEEP_OPTIONS.find((o) => o.value === raw?.sleepAfterMin)
  if (match) return match.value
  // Settings saved by v0.1.0 had a sleepEnabled flag: off there means 'never' here
  if ((raw as { sleepEnabled?: boolean } | null | undefined)?.sleepEnabled === false) return 0
  return DEFAULT_SETTINGS.sleepAfterMin
}

/** Settings saved before this field existed mean an existing user: skip the welcome for them. */
function cleanOnboarded(raw: Partial<AppSettings> | null | undefined): boolean {
  if (typeof raw?.onboarded === 'boolean') return raw.onboarded
  return raw != null
}

function sanitize(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const s = { ...DEFAULT_SETTINGS, ...raw }
  const petIds = listPetConfigs().map((p) => p.id)
  const volume = Number(s.volume)
  return {
    petId: petIds.includes(s.petId) ? s.petId : (petIds[0] ?? DEFAULT_SETTINGS.petId),
    size: PET_SIZES.includes(s.size) ? s.size : DEFAULT_SETTINGS.size,
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_SETTINGS.volume,
    muted: !!s.muted,
    wandering: !!s.wandering,
    sleepAfterMin: cleanSleep(raw),
    petName: cleanName(s.petName),
    gender: GENDERS.includes(s.gender) ? s.gender : DEFAULT_SETTINGS.gender,
    ownerName: cleanName(s.ownerName),
    checkIns: !!s.checkIns,
    onboarded: cleanOnboarded(raw),
    notifications: !!s.notifications,
  }
}

export async function loadSettings(): Promise<AppSettings> {
  const s = await getStore()
  return sanitize(await s.get<Partial<AppSettings>>('settings'))
}

/** Persists settings and tells every window (the pet applies them live). */
export async function saveSettings(next: AppSettings): Promise<void> {
  const clean = sanitize(next)
  const s = await getStore()
  await s.set('settings', clean)
  await s.save()
  await emit(SETTINGS_CHANGED_EVENT, clean)
}

export function onSettingsChanged(cb: (s: AppSettings) => void): Promise<UnlistenFn> {
  return listen<AppSettings>(SETTINGS_CHANGED_EVENT, (e) => cb(e.payload))
}

export async function loadPosition(): Promise<SavedPosition | null> {
  const s = await getStore()
  const p = await s.get<SavedPosition>('position')
  return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null
}

export async function savePosition(p: SavedPosition): Promise<void> {
  const s = await getStore()
  await s.set('position', p)
  await s.save()
}