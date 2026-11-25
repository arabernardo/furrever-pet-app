import { PET_STATES, type AnimationConfig, type PetConfig, type PetSoundKind, type PetState } from '@/shared/types'
import { createPlaceholderSheet } from './placeholder'
import { resolveAssetUrl } from './registry'
import { SOUND_KINDS } from '@/shared/types'

type Sheet = HTMLImageElement | HTMLCanvasElement

export interface LoadedAnimation {
  sheet: Sheet
  frameW: number
  frameH: number
  frames: number
  fps: number
  loop: boolean
  flip: boolean
}

export interface LoadedPet {
  config: PetConfig
  animations: Record<PetState, LoadedAnimation>
  sounds: Record<PetSoundKind, string[]>
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`failed to load ${url}`))
    img.src = url
  })
}

async function buildSheet(config: PetConfig, name: PetState, def: AnimationConfig): Promise<Sheet> {
  const tag = `[pet:${config.id}]`
  if (def.sheet) {
    const url = resolveAssetUrl(config.id, def.sheet)
    if (url) {
      try {
        return await loadImage(url)
      } catch (err) {
        console.warn(`${tag} ${def.sheet} could not be decoded, using placeholder`, err)
      }
    } else {
      console.warn(`${tag} missing sprite sheet ${def.sheet}, using placeholder`)
    }
  }
  return createPlaceholderSheet(config, name, def.frames)
}

export async function loadPet(config: PetConfig): Promise<LoadedPet> {
  const tag = `[pet:${config.id}]`
  const sheets = new Map<string, Promise<Sheet>>()
  const getSheet = (name: PetState, def: AnimationConfig): Promise<Sheet> => {
    let p = sheets.get(name)
    if (!p) {
      p = buildSheet(config, name, def)
      sheets.set(name, p)
    }
    return p
  }

  const animations = {} as Record<PetState, LoadedAnimation>
  for (const state of PET_STATES) {
    const own = config.animations[state]
    if (!own) console.warn(`${tag} no "${state}" animation in config.json, reusing idle`)
    const def = own ?? config.animations.idle
    const sourceName: PetState = own ? (own.mirrorOf ?? state) : 'idle'
    const sourceDef = (own?.mirrorOf ? config.animations[own.mirrorOf] : undefined) ?? def
    const sheet = await getSheet(sourceName, sourceDef)
    animations[state] = {
      sheet,
      frameW: sheet.width / sourceDef.frames,
      frameH: sheet.height,
      frames: sourceDef.frames,
      fps: def.fps,
      loop: def.loop,
      flip: !!own?.mirrorOf,
    }
  }

  const sounds = Object.fromEntries(SOUND_KINDS.map((k) => [k, [] as string[]])) as Record<PetSoundKind, string[]>
  for (const kind of SOUND_KINDS) {
    for (const file of config.sounds?.[kind] ?? []) {
      const url = resolveAssetUrl(config.id, `sounds/${file}`)
      if (url) sounds[kind].push(url)
      else console.warn(`${tag} missing sound sounds/${file}, skipping`)
    }
  }
  return { config, animations, sounds }
}