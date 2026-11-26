<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch, computed } from 'vue'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { loadSettings, onSettingsChanged, saveSettings } from '@/main/settingsStore'
import { listPetConfigs } from '@/pets/registry'
import { DEFAULT_SETTINGS, GENDERS, MAX_NAME_LENGTH, PET_SIZES, SLEEP_OPTIONS } from '@/shared/defaults'
import type { AppSettings } from '@/shared/types'
import { getCurrentWindow } from '@tauri-apps/api/window'

const welcome = new URLSearchParams(location.search).has('welcome')
const canStart = computed(() => form.petName.trim() !== '' && form.ownerName.trim() !== '')

async function start(): Promise<void> {
  window.clearTimeout(saveTimer)
  await saveSettings({ ...toRaw(form), onboarded: true })
  await getCurrentWindow().close()
}

const pets = listPetConfigs().map(({ id, name }) => ({ id, name }))
const sizes = PET_SIZES
const genders = GENDERS
const sleepOptions = SLEEP_OPTIONS
const maxName = MAX_NAME_LENGTH
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
    <h1>{{ welcome ? 'Welcome to Furever Pet!' : 'Furever Pet' }}</h1>
    <p v-if="welcome" class="hint">Give your pet a name and tell it yours. It will say hi right after.</p>

    <label class="row">
      <span>Pet</span>
      <select v-model="form.petId">
        <option v-for="p in pets" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </label>

    <label class="row">
      <span>Pet name</span>
      <input v-model.lazy.trim="form.petName" type="text" :maxlength="maxName" placeholder="Name your pet" />
    </label>

    <div class="row">
      <span>Boy or girl</span>
      <div class="seg">
        <button v-for="g in genders" :key="g" type="button" :class="{ on: form.gender === g }" @click="form.gender = g">{{ g }}</button>
      </div>
    </div>
    <p class="hint">Boys wear a blue collar, girls a pink one.</p>

    <label class="row">
      <span>Your name</span>
      <input v-model.lazy.trim="form.ownerName" type="text" :maxlength="maxName" placeholder="So your pet can greet you" />
    </label>
    <label class="row"><span>Pet checks in on me</span><input v-model="form.checkIns" type="checkbox" /></label>

    <label class="row"><span>Feed/play reminders</span><input v-model="form.notifications" type="checkbox" /></label>

    <label class="row"><span>Welcome back greeting</span><input v-model="form.welcomeBack" type="checkbox" /></label>

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
    <label class="row">
      <span>Fall asleep after</span>
      <select v-model.number="form.sleepAfterMin">
        <option v-for="o in sleepOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <p class="hint">Time with no clicks, hovers or drags. "Never" also stops random naps.</p>
    <label class="row">
      <span>Launch at startup</span>
      <input type="checkbox" :checked="autostart" @change="onAutostart" />
    </label>
    <button v-if="welcome" type="button" class="start" :disabled="!canStart" @click="start">Start</button>
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
.row input[type='text'] {
  flex: 1.4;
  min-width: 0;
  padding: 4px 8px;
}
.hint {
  margin: 4px 0 0;
  font-size: 12px;
  opacity: 0.7;
}
.start {
  margin-top: 16px;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: #e0a766;
  color: #2b2118;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.start:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
