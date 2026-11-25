<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { loadPet, type LoadedPet } from '@/pets/loader'
import { listPetConfigs } from '@/pets/registry'
import { PetRenderer } from '@/pets/renderer'
import { PetStateMachine } from '@/pets/stateMachine'
import { ClickThrough } from '@/main/clickThrough'
import { PetWindow } from '@/main/petWindow'
import { loadPosition, loadSettings, onSettingsChanged, saveSettings } from '@/main/settingsStore'
import { openSettings } from '@/main/settingsWindow'
import { PetTray, type TrayActions, type TrayState } from '@/main/tray'
import { Walker } from '@/main/walker'
import { PetAudio } from '@/renderer/audio'
import { DEFAULT_SETTINGS, SIZE_SCALE } from '@/shared/defaults'
import { SHOW_PET_EVENT, type AppSettings, type PetState, type Rect } from '@/shared/types'

const WALK_SPEED = 36 // logical px per second
const HOLD_MS = 600
const HOVER_MS = 2000
const DOUBLE_CLICK_MS = 300
const DRAG_THRESHOLD = 4
const POLL_AWAKE_MS = 50
const POLL_ASLEEP_MS = 250

interface Press {
  sx: number
  sy: number
  rect: Rect | null
  moved: boolean
  held: boolean
}

const spriteEl = ref<HTMLCanvasElement | null>(null)
const fxEl = ref<HTMLCanvasElement | null>(null)
const dragging = ref(false)

const pets = listPetConfigs()
let settings: AppSettings = { ...DEFAULT_SETTINGS }
let loaded: LoadedPet | null = null
let visible = false
let queue: Promise<void> = Promise.resolve()
const unlisten: UnlistenFn[] = []

let renderer: PetRenderer
let audio: PetAudio
let petWindow: PetWindow
let walker: Walker
let machine: PetStateMachine
let clickThrough: ClickThrough
let tray: PetTray | undefined

let press: Press | null = null
let holdTimer: number | undefined
let hoverTimer: number | undefined
let lastClickAt = 0

let sneezeTimer: number | undefined
const recentTaps: number[] = []

const trayActions: TrayActions = {
  toggleVisible: () => void setVisible(!visible),
  choosePet: (id) => void saveSettings({ ...settings, petId: id }),
  toggleMute: () => void saveSettings({ ...settings, muted: !settings.muted }),
  openSettings: () => void openSettings(),
  quit: () => void quit(),
}

/** Occasional sneeze while the pet is awake and calm. Stops completely when hidden. */
function scheduleSneeze(): void {
  window.clearTimeout(sneezeTimer)
  if (!visible) return
  sneezeTimer = window.setTimeout(() => {
    if (machine.state === 'idle' || machine.state === 'sit') audio.play('sneeze')
    scheduleSneeze()
  }, 45_000 + Math.random() * 90_000)
}

function trayState(): TrayState {
  return {
    visible,
    petId: settings.petId,
    pets: pets.map(({ id, name }) => ({ id, name })),
    muted: settings.muted,
  }
}

// ---------- boot / settings ----------

async function boot(): Promise<void> {
  settings = await loadSettings()
  renderer = new PetRenderer(spriteEl.value!, fxEl.value!)
  audio = new PetAudio()
  petWindow = new PetWindow()
  walker = new Walker(petWindow)
  renderer.onFinish = () => machine.animationFinished()
  machine = new PetStateMachine({ onEnter: handleEnter }, { wandering: settings.wandering, sleepEnabled: settings.sleepEnabled })
  clickThrough = new ClickThrough((x, y) => renderer.hitTest(x, y), handleHit)

  await applySettings(settings, true)
  await petWindow.place(await loadPosition())

  tray = new PetTray(trayActions)
  await tray.init(trayState())

  unlisten.push(
    await onSettingsChanged((next) => {
      queue = queue.then(() => applySettings(next)).catch((e) => console.warn('[settings] apply failed', e))
    }),
    await listen(SHOW_PET_EVENT, () => void showPet()),
    await getCurrentWindow().onScaleChanged(() => void resizeWindow(false)),
  )
  await setVisible(true)
}

async function applySettings(next: AppSettings, first = false): Promise<void> {
  const prev = settings
  settings = next
  audio.volume = next.volume
  audio.muted = next.muted
  machine.setOptions({ wandering: next.wandering, sleepEnabled: next.sleepEnabled })
  const petChanged = first || next.petId !== prev.petId
  if (petChanged) await switchPet(next.petId)
  if (petChanged || next.size !== prev.size) await resizeWindow(!first)
  await tray?.update(trayState())
}

async function switchPet(id: string): Promise<void> {
  const cfg = pets.find((p) => p.id === id) ?? pets[0]
  if (!cfg) {
    console.error('[pets] no pets found in /assets/pets')
    return
  }
  loaded = await loadPet(cfg)
  audio.setPet(loaded)
  if (visible) renderer.play(loaded.animations[machine.state])
}

async function resizeWindow(anchor: boolean): Promise<void> {
  if (!loaded) return
  const scale = SIZE_SCALE[settings.size]
  const w = Math.round(loaded.config.frame.width * scale)
  const h = Math.round(loaded.config.frame.height * scale)
  await petWindow.setLogicalSize(w, h, anchor)
  renderer.resize(w, h)
}

// ---------- show / hide / quit ----------

async function setVisible(next: boolean): Promise<void> {
  if (next === visible) return
  visible = next
  if (next) {
    await petWindow.show()
    renderer.start()
    machine.resume()
    clickThrough.start(POLL_AWAKE_MS)
    scheduleSneeze()
  } else {
    // Hidden: stop polling, timers and drawing completely.
    clickThrough.stop()
    window.clearTimeout(sneezeTimer)
    walker.stop()
    machine.pause()
    renderer.stop()
    await petWindow.hide()
  }
  await tray?.update(trayState())
}

async function showPet(): Promise<void> {
  if (visible) await petWindow.show()
  else await setVisible(true)
}

async function quit(): Promise<void> {
  await tray?.dispose()
  await invoke('quit_app')
}

// ---------- state machine hook ----------

function handleEnter(state: PetState): void {
  if (!loaded) return
  renderer.play(loaded.animations[state])
  if (state === 'walk-left' || state === 'walk-right') {
    const dpr = window.devicePixelRatio || 1
    void walker.start(state === 'walk-left' ? -1 : 1, WALK_SPEED * dpr, () => machine.blocked())
  } else {
    walker.stop()
  }
  // Asleep: poll slowly (still lets you wake the pet by hovering/clicking it).
  clickThrough.setInterval(state === 'sleep' ? POLL_ASLEEP_MS : POLL_AWAKE_MS)
}

// ---------- pointer interactions ----------

function handleHit(hit: boolean): void {
  window.clearTimeout(hoverTimer)
  if (!hit || press) return
  hoverTimer = window.setTimeout(() => {
    machine.touch()
    renderer.burstHearts()
  }, HOVER_MS)
}

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const p: Press = { sx: e.screenX, sy: e.screenY, rect: null, moved: false, held: false }
  press = p
  clickThrough.captureLock = true
  window.clearTimeout(hoverTimer)
  machine.touch()
  void Promise.all([petWindow.getRect(), petWindow.refreshScreens()]).then(([r]) => {
    p.rect = r
  })
  holdTimer = window.setTimeout(() => {
    if (!p.moved) {
      p.held = true
      renderer.burstHearts()
    }
  }, HOLD_MS)
}

function onPointerMove(e: PointerEvent): void {
  const p = press
  if (!p || !p.rect) return
  const dx = e.screenX - p.sx
  const dy = e.screenY - p.sy
  if (!p.moved) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    p.moved = true
    window.clearTimeout(holdTimer)
    dragging.value = true
    walker.stop()
    machine.dragStart()
    audio.play('pickup')
  }
  const dpr = window.devicePixelRatio || 1
  petWindow.dragTo(p.rect.x + dx * dpr, p.rect.y + dy * dpr)
}

function endPress(e: PointerEvent, cancelled: boolean): void {
  window.clearTimeout(holdTimer)
  const p = press
  press = null
  clickThrough.captureLock = false
  const el = e.currentTarget as HTMLElement
  if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
  if (!p) return
  if (p.moved) {
    dragging.value = false
    machine.dragEnd()
    petWindow.persistSoon()
    return
  }
  if (cancelled || p.held) return
  const now = Date.now()
  recentTaps.push(now)
  while (recentTaps.length > 0 && now - recentTaps[0] > 2500) recentTaps.shift()
  if (recentTaps.length >= 6) {
    // Poked too much: the pet gets annoyed.
    recentTaps.length = 0
    lastClickAt = 0
    machine.click()
    audio.play('growl')
    return
  }
  if (now - lastClickAt < DOUBLE_CLICK_MS) {
    lastClickAt = 0
    machine.doubleClick()
    audio.play('doubleClick')
  } else {
    lastClickAt = now
    machine.click()
    audio.play('click')
  }
}

onMounted(() => {
  boot().catch((err) => console.error('[boot] failed', err))
})

onBeforeUnmount(() => {
  clickThrough?.stop()
  window.clearTimeout(sneezeTimer)
  walker?.stop()
  machine?.pause()
  renderer?.stop()
  for (const fn of unlisten) fn()
})
</script>

<template>
  <div
    class="stage"
    :class="{ dragging }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endPress($event, false)"
    @pointercancel="endPress($event, true)"
    @contextmenu.prevent
  >
    <canvas ref="spriteEl" />
    <canvas ref="fxEl" />
  </div>
</template>

<style>
html,
body,
#app {
  margin: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}
.stage {
  position: relative;
  width: 100%;
  height: 100%;
  cursor: grab;
}
.stage.dragging {
  cursor: grabbing;
}
.stage canvas {
  position: absolute;
  inset: 0;
  display: block;
  pointer-events: none;
}
</style>
