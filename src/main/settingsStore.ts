import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { load, type Store } from '@tauri-apps/plugin-store'
import { DEFAULT_SETTINGS, PET_SIZES } from '@/shared/defaults'
import { listPetConfigs } from '@/pets/registry'
import { SETTINGS_CHANGED_EVENT, type AppSettings, type SavedPosition } from '@/shared/types'

let store: Store | null = null

async function getStore(): Promise<Store> {
  if (!store) store = await load('settings.json', { defaults: {}, autoSave: false })
  return store
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
    sleepEnabled: !!s.sleepEnabled,
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