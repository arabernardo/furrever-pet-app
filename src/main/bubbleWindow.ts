import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { PhysicalPosition } from '@tauri-apps/api/window'
import { BUBBLE_CHOICE_EVENT, BUBBLE_READY_EVENT, BUBBLE_WIDTH, type BubbleContent } from '@/shared/types'
import type { PetWindow } from './petWindow'

type Input = Omit<BubbleContent, 'id'>

/**
 * The speech bubble is its own tiny window. Its page measures itself and reports the size
 * ('bubble-ready'), then we place it above the pet and show it. Choices come back as events.
 * open/close are queued so quick calls can't leave a window behind.
 */
export class BubbleWindow {
  onChoice: ((index: number) => void) | null = null
  private win: WebviewWindow | null = null
  private unlisten: UnlistenFn[] = []
  private id = 0
  private chain: Promise<void> = Promise.resolve()

  constructor(
    private readonly pet: PetWindow,
    private readonly dpr: () => number,
  ) {}

  open(input: Input): Promise<void> {
    return this.enqueue(() => this.doOpen(input))
  }

  close(): Promise<void> {
    return this.enqueue(() => this.doClose())
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    this.chain = this.chain.then(fn).catch((err) => console.warn('[bubble]', err))
    return this.chain
  }

  private async doOpen(input: Input): Promise<void> {
    await this.doClose()
    const id = ++this.id
    this.unlisten = [
      await listen<{ id: number; w: number; h: number }>(BUBBLE_READY_EVENT, (e) => {
        if (e.payload.id === id) void this.place(e.payload.w, e.payload.h)
      }),
      await listen<{ id: number; index: number }>(BUBBLE_CHOICE_EVENT, (e) => {
        if (e.payload.id === id) this.onChoice?.(e.payload.index)
      }),
    ]
    const content: BubbleContent = { ...input, id }
    // Unique label per bubble: a closed window's label can take a moment to be freed.
    const win = new WebviewWindow(`bubble-${id}`, {
      url: `bubble.html?d=${encodeURIComponent(JSON.stringify(content))}`,
      width: BUBBLE_WIDTH,
      height: 80,
      decorations: false,
      transparent: true,
      shadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focus: false,
      visible: false, // shown once the page has reported its size and we've positioned it
    })
    this.win = win
    void win.once('tauri://error', (e) => console.warn('[bubble] failed to open', e))
  }

  private async doClose(): Promise<void> {
    for (const off of this.unlisten) off()
    this.unlisten = []
    const win = this.win
    this.win = null
    if (win) await win.close().catch((err) => console.warn('[bubble] close failed', err))
  }

  /** Centres the bubble above the pet, kept on screen. Near the top of the screen it goes below instead. */
  private async place(w: number, h: number): Promise<void> {
    const win = this.win
    if (!win) return
    const dpr = this.dpr()
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    const overlap = Math.round(6 * dpr)
    await this.pet.refreshScreens()
    const r = await this.pet.getRect()
    const x = r.x + r.w / 2 - bw / 2
    const aboveY = r.y - bh + overlap
    const above = this.pet.clamp(x, aboveY, bw, bh)
    // If clamping pushed it down over the pet, there is no room above.
    const pos = above.y > aboveY + 1 ? this.pet.clamp(x, r.y + r.h - overlap, bw, bh) : above
    await win.setPosition(new PhysicalPosition(Math.round(pos.x), Math.round(pos.y)))
    await win.show()
  }
}