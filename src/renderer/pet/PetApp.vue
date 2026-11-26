<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { dayPart, greetingPrompt, menuPrompt, offerPrompt, randomPrompt, welcomeBackPrompt, type Persona, type Prompt, type Reaction } from '@/pets/dialogue'
import { Presence } from '@/main/presence'
import { ToastWindow } from '@/main/toastWindow'
import { loadPet, type LoadedAnimation, type LoadedPet } from '@/pets/loader'
import { listPetConfigs } from '@/pets/registry'
import { PetRenderer } from '@/pets/renderer'
import { PetStateMachine, type MachineOptions } from '@/pets/stateMachine'
import { BubbleWindow } from '@/main/bubbleWindow'
import { ClickThrough } from '@/main/clickThrough'
import { PetWindow } from '@/main/petWindow'
import { loadPosition, loadSettings, onSettingsChanged, saveSettings } from '@/main/settingsStore'
import { openSettings } from '@/main/settingsWindow'
import { PetTray, type TrayActions, type TrayState } from '@/main/tray'
import { Walker } from '@/main/walker'
import { PetAudio } from '@/renderer/audio'
import { DEFAULT_SETTINGS, SIZE_SCALE } from '@/shared/defaults'
import { SHOW_PET_EVENT, type AppSettings, type PetState, type Rect, type ToastAction } from '@/shared/types'

const WALK_SPEED = 36 // logical px per second
const HOLD_MS = 600
const HOVER_MS = 2000
const DOUBLE_CLICK_MS = 300
const DRAG_THRESHOLD = 4
const POLL_AWAKE_MS = 50
const POLL_ASLEEP_MS = 250
// Check-ins: a random delay between 30 and 90 minutes. Lower these while testing.
const CHECKIN_MIN_MS = 30 * 60_000
const CHECKIN_SPREAD_MS = 60 * 60_000
// Feed/play notification: every 20-60 minutes, ignored after 20 s. Lower these while testing.
const OFFER_MIN_MS = 5 * 60_000
const OFFER_SPREAD_MS = 10 * 60_000
const TOAST_TTL_MS = 20_000
const GREETING_DELAY_MS = 1500
const BUBBLE_TTL_MS = 15_000
const GREETING_TTL_MS = 6_000
const REPLY_TTL_MS = 4_000
// Panting: starts every 3-6 minutes and lasts 8 seconds. Lower these while testing.
const PANT_EVERY_MIN_MS = 3 * 60_000
const PANT_EVERY_SPREAD_MS = 3 * 60_000
const PANT_DURATION_MS = 8_000
// Welcome back: only if the PC was locked or asleep at least this long. Lower it while testing.
const WELCOME_BACK_MIN_AWAY_MS = 2 * 60_000

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
let bubble: BubbleWindow
let tray: PetTray | undefined

let press: Press | null = null
let holdTimer: number | undefined
let hoverTimer: number | undefined
let sneezeTimer: number | undefined
let checkInTimer: number | undefined
let bubbleTimer: number | undefined

let panting = false
let pantTimer: number | undefined
let pantEndTimer: number | undefined

let toast: ToastWindow
let offerTimer: number | undefined
let toastTimer: number | undefined

let presence: Presence

let acting = false // a feed or play session is running
const actionTimers: number[] = []

let currentPrompt: Prompt | null = null
let lastClickAt = 0
const recentTaps: number[] = []

const trayActions: TrayActions = {
  toggleVisible: () => void setVisible(!visible),
  choosePet: (id) => void saveSettings({ ...settings, petId: id }),
  toggleMute: () => void saveSettings({ ...settings, muted: !settings.muted }),
  openSettings: () => void openSettings(),
  quit: () => void quit(),
  feed: () => void showPet().then(feedPet),
  play: () => void showPet().then(playPet),
}

function trayState(): TrayState {
  return {
    visible,
    petId: settings.petId,
    pets: pets.map(({ id, name }) => ({ id, name })),
    muted: settings.muted,
  }
}

function persona(): Persona {
  return { petName: settings.petName || loaded?.config.name || 'Buddy', ownerName: settings.ownerName }
}

/** Wandering is paused while the pet is talking, so the bubble never gets left behind. */
function machineOptions(): MachineOptions {
  return { wandering: settings.wandering && !currentPrompt, sleepAfterMs: settings.sleepAfterMin * 60_000 }
}

// ---------- boot / settings ----------

async function boot(): Promise<void> {
  settings = await loadSettings()
  renderer = new PetRenderer(spriteEl.value!, fxEl.value!)
  audio = new PetAudio()
  petWindow = new PetWindow()
  walker = new Walker(petWindow)
  bubble = new BubbleWindow(petWindow, () => window.devicePixelRatio || 1)
  bubble.onChoice = onChoice
  toast = new ToastWindow(petWindow, () => window.devicePixelRatio || 1)
  toast.onChoice = onToastChoice
  presence = new Presence((awayMs) => void onReturn(awayMs), WELCOME_BACK_MIN_AWAY_MS)
  renderer.onFinish = () => machine.animationFinished()
  machine = new PetStateMachine({ onEnter: handleEnter }, machineOptions())
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

  // First run: ask for the names before the pet says anything. Otherwise greet as usual.
  if (settings.onboarded) scheduleGreeting()
  else await openSettings(true)
}

async function applySettings(next: AppSettings, first = false): Promise<void> {
  const prev = settings
  settings = next
  audio.volume = next.volume
  audio.muted = next.muted
  machine.setOptions(machineOptions())
  const petChanged = first || next.petId !== prev.petId
  // A gender change reloads the sprites so the collar colour updates.
  if (petChanged || next.gender !== prev.gender) await switchPet(next.petId)
  if (petChanged || next.size !== prev.size) await resizeWindow(!first)
  if (next.checkIns !== prev.checkIns) scheduleCheckIn()
  if (next.notifications !== prev.notifications) {
    scheduleOffer()
    if (!next.notifications) closeToast()
  }
  // The welcome was just completed: now the pet can introduce itself
  if (!prev.onboarded && next.onboarded) scheduleGreeting()
  await tray?.update(trayState())
}

async function switchPet(id: string): Promise<void> {
  const cfg = pets.find((p) => p.id === id) ?? pets[0]
  if (!cfg) {
    console.error('[pets] no pets found in /assets/pets')
    return
  }
  loaded = await loadPet(cfg, settings.gender)
  audio.setPet(loaded)
  if (visible) renderer.play(animFor(machine.state))
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
    schedulePant()
    scheduleCheckIn()
    scheduleOffer()
    presence.start()
  } else {
    // Hidden: stop polling, timers and drawing completely.
    clickThrough.stop()
    window.clearTimeout(sneezeTimer)
    window.clearTimeout(pantTimer)
    window.clearTimeout(pantEndTimer)
    setPanting(false)
    window.clearTimeout(checkInTimer)
    window.clearTimeout(offerTimer)
    presence.stop()
    closeToast()
    await endTalk()
    walker.stop()
    cancelActions()
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

// ---------- talking ----------

/** Only talk when the pet is awake, calm, visible and not being touched. */
function canTalk(): boolean {
  return visible && !currentPrompt && !press && (machine.state === 'idle' || machine.state === 'sit')
}

function scheduleCheckIn(delayMs?: number): void {
  window.clearTimeout(checkInTimer)
  if (!visible || !settings.checkIns) return
  const delay = delayMs ?? CHECKIN_MIN_MS + Math.random() * CHECKIN_SPREAD_MS
  checkInTimer = window.setTimeout(() => {
    // Asleep in the daytime: wake the pet up so it can ask. At night it stays asleep.
    if (machine.state === 'sleep' && !press && !currentPrompt && dayPart() !== 'night') {
      machine.touch()
      window.setTimeout(() => {
        if (canTalk()) void say(randomPrompt(persona()))
      }, 1200)
      scheduleCheckIn()
      return
    }
    if (canTalk()) {
      void say(randomPrompt(persona()))
      scheduleCheckIn()
    } else {
      scheduleCheckIn(60_000) // busy or asleep at night: try again in a minute
    }
  }, delay)
}

async function say(prompt: Prompt): Promise<void> {
  currentPrompt = prompt
  machine.setOptions(machineOptions())
  if (prompt.kind !== 'greeting') audio.play('click') // a little bark/purr to get attention
  machine.click() // happy animation
  window.clearTimeout(bubbleTimer)
  bubbleTimer = window.setTimeout(() => void endTalk(), prompt.choices.length > 0 ? BUBBLE_TTL_MS : GREETING_TTL_MS)
  await bubble.open({ text: prompt.text, choices: prompt.choices.map(({ label, reply }) => ({ label, reply })) })
}

function scheduleGreeting(): void {
  window.setTimeout(() => {
    if (canTalk()) void say(greetingPrompt(persona()))
  }, GREETING_DELAY_MS)
}

function onChoice(index: number): void {
  const choice = currentPrompt?.choices[index]
  if (!choice) return
  react(choice.react)
  window.clearTimeout(bubbleTimer)
  bubbleTimer = window.setTimeout(() => void endTalk(), REPLY_TTL_MS)
}

async function endTalk(): Promise<void> {
  window.clearTimeout(bubbleTimer)
  currentPrompt = null
  if (machine) machine.setOptions(machineOptions())
  await bubble?.close()
}

function react(r: Reaction): void {
  if (r === 'happy') {
    machine.click()
    audio.play('click')
  } else if (r === 'hearts') {
    renderer.burstHearts()
  } else if (r === 'play') {
    playPet()
  } else if (r === 'feed') {
    feedPet()
  }
}

/** Runs `fn` after `ms`, unless the pet was hidden in the meantime. */
function later(ms: number, fn: () => void): void {
  actionTimers.push(
    window.setTimeout(() => {
      if (visible) fn()
    }, ms),
  )
}

function cancelActions(): void {
  for (const t of actionTimers) window.clearTimeout(t)
  actionTimers.length = 0
  acting = false
  renderer?.clearProps()
}

/** Drops a treat, the pet eats it, then hearts. Ignored while another session is running. */
function feedPet(): void {
  if (!visible || acting) return
  acting = true
  machine.touch()
  renderer.dropTreat(loaded?.config.treat ?? 'bone')
  later(1150, () => {
    machine.click()
    audio.play('eat')
  })
  later(1500, () => renderer.burstHearts())
  later(2000, () => {
    acting = false
  })
}

/** Every 20-60 minutes, offer feed/play in a notification card. Stops completely when hidden. */
function scheduleOffer(delayMs?: number): void {
  window.clearTimeout(offerTimer)
  if (!visible || !settings.notifications) return
  const delay = delayMs ?? OFFER_MIN_MS + Math.random() * OFFER_SPREAD_MS
  offerTimer = window.setTimeout(() => {
    if (settings.onboarded && !acting && !currentPrompt && !press && !toast.isOpen) {
      void showOffer()
      scheduleOffer()
    } else {
      scheduleOffer(60_000) // busy: try again in a minute
    }
  }, delay)
}

async function showOffer(): Promise<void> {
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => void toast.close(), TOAST_TTL_MS)
  await toast.open(offerPrompt(persona()))
}

/** The owner is back after a lock or sleep: wake the pet if needed, then welcome them. */
async function onReturn(awayMs: number): Promise<void> {
  if (!settings.welcomeBack || !settings.onboarded || !visible || acting || press) return
  if (currentPrompt) await endTalk()
  machine.touch() // wakes the pet if it was asleep
  audio.play('click')
  // Give the wake-up animation a moment before the bubble appears.
  window.setTimeout(() => {
    if (canTalk()) void say(welcomeBackPrompt(persona(), awayMs))
  }, 1200)
}

function onToastChoice(action: ToastAction): void {
  closeToast()
  if (action === 'feed') feedPet()
  else if (action === 'play') playPet()
}

function closeToast(): void {
  window.clearTimeout(toastTimer)
  void toast?.close()
}

/** A bouncing ball while the pet hops and makes its normal click sound. */
function playPet(): void {
  if (!visible || acting) return
  acting = true
  machine.touch()
  renderer.bounceBall()
  for (let i = 0; i < 4; i++) {
    later(300 + i * 1000, () => {
      machine.click()
      audio.play('click')
      if (i % 2 === 1) renderer.burstHearts()
    })
  }
  later(4500, () => {
    acting = false
  })
}

/** Right-click on the pet: ask what to do. */
async function openMenu(): Promise<void> {
  if (!visible || acting || press) return
  if (currentPrompt) await endTalk()
  machine.touch()
  void say(menuPrompt(persona()))
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

/** The animation set to use right now: tongue out while panting, otherwise the normal one. */
function animFor(state: PetState): LoadedAnimation {
  const set = panting && loaded?.pantAnimations ? loaded.pantAnimations : loaded!.animations
  return set[state]
}

function setPanting(on: boolean): void {
  if (panting === on) return
  panting = on
  if (loaded && visible) renderer.play(animFor(machine.state)) // swap sheets now
}

/** Pants for a few seconds, with "heh, heh, heh" at the start and again halfway. */
function startPanting(): void {
  setPanting(true)
  for (const ms of [0, 3500]) {
    window.setTimeout(() => {
      if (panting) audio.play('pant')
    }, ms)
  }
  window.clearTimeout(pantEndTimer)
  pantEndTimer = window.setTimeout(() => setPanting(false), PANT_DURATION_MS)
}

/** Every few minutes, if the pet can pant and is awake and calm. Stops completely when hidden. */
function schedulePant(): void {
  window.clearTimeout(pantTimer)
  if (!visible) return
  pantTimer = window.setTimeout(() => {
    const s = machine.state
    const calm = s === 'idle' || s === 'sit' || s === 'walk-left' || s === 'walk-right'
    if (calm && loaded?.pantAnimations && !panting) startPanting()
    schedulePant()
  }, PANT_EVERY_MIN_MS + Math.random() * PANT_EVERY_SPREAD_MS)
}

// ---------- state machine hook ----------

function handleEnter(state: PetState): void {
  if (!loaded) return
  renderer.play(animFor(state))
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
    if (currentPrompt) void endTalk() // the bubble can't follow a drag, so dismiss it
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
  window.clearTimeout(sneezeTimer)
  window.clearTimeout(pantTimer)
  window.clearTimeout(pantEndTimer)
  window.clearTimeout(checkInTimer)
  window.clearTimeout(offerTimer)
  presence?.stop()
  closeToast()
  window.clearTimeout(bubbleTimer)
  void bubble?.close()
  clickThrough?.stop()
  walker?.stop()
  cancelActions()
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
    @contextmenu.prevent="openMenu"
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
