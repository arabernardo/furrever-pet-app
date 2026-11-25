import type { PetConfig } from '@/shared/types'

// Every pet folder is discovered at build time. Adding a folder needs no code change.
const configs = import.meta.glob<PetConfig>('/assets/pets/*/config.json', { eager: true, import: 'default' })
const files = import.meta.glob<string>('/assets/pets/**/*.{png,webp,svg,gif,mp3,ogg,wav,m4a}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export function listPetConfigs(): PetConfig[] {
  return Object.entries(configs)
    .map(([path, cfg]) => ({ ...cfg, id: path.split('/')[3] })) // folder name is the id
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Returns undefined when the file doesn't exist (so callers can fall back without a 404). */
export function resolveAssetUrl(petId: string, relPath: string): string | undefined {
  return files[`/assets/pets/${petId}/${relPath}`]
}