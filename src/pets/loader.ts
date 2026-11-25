import { COLLAR_COLORS } from '@/shared/defaults'
import { PET_STATES, SOUND_KINDS, type AnimationConfig, type Gender, type PetConfig, type PetSoundKind, type PetState } from '@/shared/types'
import { createPlaceholderSheet } from './placeholder'
import { resolveAssetUrl } from './registry'

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
  /** Same animations with the panting tongue drawn in. Null for pets that can't pant. */
  pantAnimations: Record<PetState, LoadedAnimation> | null
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

async function buildSheet(config: PetConfig, name: PetState, def: AnimationConfig, gender: Gender, tongue: boolean): Promise<Sheet> {
  const tag = `[pet:${config.id}]`
  // Real art can ship one sheet per gender (collar drawn into the art).
  const file = def.genderSheets?.[gender] ?? def.sheet
  if (file) {
    const url = resolveAssetUrl(config.id, file)
    if (url) {
      try {
        return await loadImage(url)
      } catch (err) {
        console.warn(`${tag} ${file} could not be decoded, using placeholder`, err)
      }
    } else {
      console.warn(`${tag} missing sprite sheet ${file}, using placeholder`)
    }
  }
  return createPlaceholderSheet(config, name, def.frames, COLLAR_COLORS[gender], gender === 'girl', tongue)
}

async function buildAnimations(config: PetConfig, gender: Gender, tongue: boolean): Promise<Record<PetState, LoadedAnimation>> {
  const tag = `[pet:${config.id}]`
  const sheets = new Map<string, Promise<Sheet>>()
  const getSheet = (name: PetState, def: AnimationConfig): Promise<Sheet> => {
    let p = sheets.get(name)
    if (!p) {
      p = buildSheet(config, name, def, gender, tongue)
      sheets.set(name, p)
    }
    return p
  }

  const animations = {} as Record<PetState, LoadedAnimation>
  for (const state of PET_STATES) {
    const own = config.animations[state]
    if (!own && !tongue) console.warn(`${tag} no "${state}" animation in config.json, reusing idle`)
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
  return animations
}

export async function loadPet(config: PetConfig, gender: Gender): Promise<LoadedPet> {
  const tag = `[pet:${config.id}]`
  const animations = await buildAnimations(config, gender, false)
  const pantAnimations = config.placeholder.tongue ? await buildAnimations(config, gender, true) : null

  const sounds = Object.fromEntries(SOUND_KINDS.map((k) => [k, [] as string[]])) as Record<PetSoundKind, string[]>
  for (const kind of SOUND_KINDS) {
    for (const file of config.sounds?.[kind] ?? []) {
      const url = resolveAssetUrl(config.id, `sounds/${file}`)
      if (url) sounds[kind].push(url)
      else console.warn(`${tag} missing sound sounds/${file}, skipping`)
    }
  }
  return { config, animations, pantAnimations, sounds }
}
