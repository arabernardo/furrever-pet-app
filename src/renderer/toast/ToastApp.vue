<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { emit } from '@tauri-apps/api/event'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { TOAST_CHOICE_EVENT, TOAST_READY_EVENT, TOAST_WIDTH, type ToastAction, type ToastContent } from '@/shared/types'

function parse(): ToastContent {
  try {
    return JSON.parse(new URLSearchParams(location.search).get('d') ?? '') as ToastContent
  } catch {
    return { id: 0, title: 'Furever Pet', text: '' }
  }
}

const content = parse()
const root = ref<HTMLElement | null>(null)

/** Resizes this window to fit the card, then tells the pet window so it can position and show us. */
async function fit(): Promise<void> {
  await nextTick()
  const el = root.value
  if (!el) return
  const h = Math.ceil(el.getBoundingClientRect().height)
  await getCurrentWindow().setSize(new LogicalSize(TOAST_WIDTH, h))
  await emit(TOAST_READY_EVENT, { id: content.id, w: TOAST_WIDTH, h })
}

function pick(action: ToastAction): void {
  void emit(TOAST_CHOICE_EVENT, { id: content.id, action })
}

onMounted(() => void fit())
</script>

<template>
  <div ref="root" class="wrap" :style="{ width: TOAST_WIDTH + 'px' }" @contextmenu.prevent>
    <div class="card">
      <div class="head">
        <span class="paw">🐾</span>
        <strong>{{ content.title }}</strong>
      </div>
      <p>{{ content.text }}</p>
      <div class="actions">
        <button type="button" class="primary" @click="pick('feed')">Feed</button>
        <button type="button" class="primary" @click="pick('play')">Play</button>
        <button type="button" class="ghost" @click="pick('dismiss')">Not now</button>
      </div>
    </div>
  </div>
</template>

<style>
html,
body {
  margin: 0;
  background: transparent;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  font: 13px/1.4 system-ui, 'Segoe UI', sans-serif;
}
/* The padding leaves room for the card's shadow inside the transparent window. */
.wrap {
  box-sizing: border-box;
  padding: 8px;
}
.card {
  background: #fffaf0;
  color: #2b2118;
  border: 1px solid #e0a766;
  border-left: 5px solid #e0a766;
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}
.head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}
.card p {
  margin: 4px 0 0;
}
.actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
.actions button {
  padding: 4px 12px;
  border-radius: 6px;
  font: inherit;
  cursor: pointer;
}
.primary {
  border: 0;
  background: #e0a766;
  color: #2b2118;
  font-weight: 600;
}
.primary:hover {
  background: #d4964f;
}
.ghost {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: #7a6a58;
}
.ghost:hover {
  text-decoration: underline;
}
</style>