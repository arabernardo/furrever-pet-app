<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { emit } from '@tauri-apps/api/event'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { BUBBLE_CHOICE_EVENT, BUBBLE_READY_EVENT, BUBBLE_WIDTH, type BubbleContent } from '@/shared/types'

function parse(): BubbleContent {
  try {
    return JSON.parse(new URLSearchParams(location.search).get('d') ?? '') as BubbleContent
  } catch {
    return { id: 0, text: '...', choices: [] }
  }
}

const content = parse()
const text = ref(content.text)
const choices = ref(content.choices)
const root = ref<HTMLElement | null>(null)

/** Resizes this window to fit the content, then tells the pet window so it can position and show us. */
async function fit(): Promise<void> {
  await nextTick()
  const el = root.value
  if (!el) return
  const h = Math.ceil(el.getBoundingClientRect().height)
  await getCurrentWindow().setSize(new LogicalSize(BUBBLE_WIDTH, h))
  await emit(BUBBLE_READY_EVENT, { id: content.id, w: BUBBLE_WIDTH, h })
}

async function pick(index: number): Promise<void> {
  const choice = choices.value[index]
  if (!choice) return
  text.value = choice.reply // show the pet's answer in the same bubble
  choices.value = []
  await emit(BUBBLE_CHOICE_EVENT, { id: content.id, index })
  await fit()
}

onMounted(() => void fit())
</script>

<template>
  <div ref="root" class="wrap" :style="{ width: BUBBLE_WIDTH + 'px' }" @contextmenu.prevent>
    <div class="bubble">
      <p>{{ text }}</p>
      <div v-if="choices.length" class="choices">
        <button v-for="(c, i) in choices" :key="c.label" type="button" @click="pick(i)">{{ c.label }}</button>
      </div>
    </div>
    <div class="tail" />
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
  font: 13px/1.35 system-ui, 'Segoe UI', sans-serif;
}
.bubble {
  box-sizing: border-box;
  background: #fffaf0;
  color: #2b2118;
  border: 2px solid #e0a766;
  border-radius: 14px;
  padding: 9px 12px;
}
.bubble p {
  margin: 0;
}
.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.choices button {
  padding: 3px 10px;
  border: 1px solid #e0a766;
  border-radius: 999px;
  background: #fff;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.choices button:hover {
  background: #e0a766;
}
.tail {
  width: 0;
  height: 0;
  margin: 0 auto;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 10px solid #e0a766;
}
</style>
