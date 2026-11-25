<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch } from 'vue'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { loadSettings, onSettingsChanged, saveSettings } from '@/main/settingsStore'
import { listPetConfigs } from '@/pets/registry'
import { DEFAULT_SETTINGS, PET_SIZES } from '@/shared/defaults'
import type { AppSettings } from '@/shared/types'

const pets = listPetConfigs().map(({ id, name }) => ({ id, name }))
const sizes = PET_SIZES
const form = reactive<AppSettings>({ ...DEFAULT_SETTINGS })
const autostart = ref(false)
let ready = false
let saveTimer: number | undefined
let unlisten: UnlistenFn | undefined

async function sync(s: AppSettings): Promise<void> {
  ready = false
  Object.assign(form, s)
  await nextTick()
  ready = true
}

// Debounced so dragging the volume slider doesn't write to disk on every tick.
watch(
  form,
  () => {
    if (!ready) return
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => void saveSettings({ ...toRaw(form) }), 150)
  },
  { deep: true },
)

async function onAutostart(e: Event): Promise<void> {
  const on = (e.target as HTMLInputElement).checked
  try {
    if (on) await enable()
    else await disable()
  } catch (err) {
    console.warn('[autostart] failed', err)
  }
  autostart.value = await isEnabled().catch(() => false)
}

onMounted(async () => {
  await sync(await loadSettings())
  autostart.value = await isEnabled().catch(() => false)
  unlisten = await onSettingsChanged((s) => void sync(s)) // e.g. tray changed the pet or mute
})
onBeforeUnmount(() => unlisten?.())
</script>

<template>
  <main>
    <h1>Furever Pet</h1>

    <label class="row">
      <span>Pet</span>
      <select v-model="form.petId">
        <option v-for="p in pets" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </label>

    <div class="row">
      <span>Size</span>
      <div class="seg">
        <button v-for="s in sizes" :key="s" type="button" :class="{ on: form.size === s }" @click="form.size = s">{{ s }}</button>
      </div>
    </div>

    <label class="row">
      <span>Volume</span>
      <input v-model.number="form.volume" type="range" min="0" max="1" step="0.05" />
      <output>{{ Math.round(form.volume * 100) }}%</output>
    </label>

    <label class="row"><span>Mute sounds</span><input v-model="form.muted" type="checkbox" /></label>
    <label class="row"><span>Wander around</span><input v-model="form.wandering" type="checkbox" /></label>
    <label class="row"><span>Fall asleep when idle</span><input v-model="form.sleepEnabled" type="checkbox" /></label>
    <label class="row">
      <span>Launch at startup</span>
      <input type="checkbox" :checked="autostart" @change="onAutostart" />
    </label>
  </main>
</template>

<style>
:root {
  color-scheme: light dark;
  font-family: system-ui, 'Segoe UI', sans-serif;
}
body {
  margin: 0;
}
main {
  padding: 20px 24px;
}
h1 {
  font-size: 18px;
  margin: 0 0 16px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.25);
  font-size: 14px;
}
.row > span {
  flex: 1;
}
.row input[type='range'] {
  flex: 1.2;
}
.row output {
  width: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
select {
  padding: 4px 8px;
}
.seg {
  display: flex;
  gap: 4px;
}
.seg button {
  padding: 4px 10px;
  border: 1px solid rgba(128, 128, 128, 0.5);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-transform: capitalize;
  cursor: pointer;
}
.seg button.on {
  background: #e0a766;
  border-color: #e0a766;
  color: #2b2118;
}
</style>
