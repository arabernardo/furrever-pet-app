import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { PhysicalPosition } from '@tauri-apps/api/window'
import { TOAST_CHOICE_EVENT, TOAST_READY_EVENT, TOAST_WIDTH, type ToastAction, type ToastContent } from '@/shared/types'
import type { PetWindow } from './petWindow'

type Input = Omit<ToastContent, 'id'>

/**
 * The notification card is its own tiny window, like the speech bubble. Its page measures itself
 * and reports the size ('toast-ready'); we place it in the screen corner and show it.
 * open/close are queued so quick calls can't leave a window behind.
 */
export class ToastWindow {
  onChoice: ((action: ToastAction) => void) | null = null
  private win: WebviewWindow | null = null
  private unlisten: UnlistenFn[] = []
  private id = 0
  private wanted = false
  private chain: Promise<void> = Promise.resolve()

  constructor(
    private readonly pet: PetWindow,
    private readonly dpr: () => number,
  ) {}

  /** True from the moment open() is called until close() is called. */
  get isOpen(): boolean {
    return this.wanted
  }

  open(input: Input): Promise<void> {
    this.wanted = true
    return this.enqueue(() => this.doOpen(input))
  }

  close(): Promise<void> {
    this.wanted = false
    return this.enqueue(() => this.doClose())
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    this.chain = this.chain.then(fn).catch((err) => console.warn('[toast]', err))
    return this.chain
  }

  private async doOpen(input: Input): Promise<void> {
    await this.doClose()
    if (!this.wanted) return // closed again while we were waiting in the queue
    const id = ++this.id
    this.unlisten = [
      await listen<{ id: number; w: number; h: number }>(TOAST_READY_EVENT, (e) => {
        if (e.payload.id === id) void this.place(e.payload.w, e.payload.h).catch((err) => console.warn('[toast] place failed', err))
      }),
      await listen<{ id: number; action: ToastAction }>(TOAST_CHOICE_EVENT, (e) => {
        if (e.payload.id === id) this.onChoice?.(e.payload.action)
      }),
    ]
    const content: ToastContent = { ...input, id }
    const win = new WebviewWindow(`toast-${id}`, {
      url: `toast.html?d=${encodeURIComponent(JSON.stringify(content))}`,
      width: TOAST_WIDTH,
      height: 120,
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
    void win.once('tauri://error', (e) => console.warn('[toast] failed to open', e))
  }

  private async doClose(): Promise<void> {
    for (const off of this.unlisten) off()
    this.unlisten = []
    const win = this.win
    this.win = null
    if (win) await win.close().catch((err) => console.warn('[toast] close failed', err))
  }

  private async place(w: number, h: number): Promise<void> {
    const win = this.win
    if (!win) return
    const dpr = this.dpr()
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    const pos = await this.pet.cornerFor(bw, bh, Math.round(8 * dpr))
    await win.setPosition(new PhysicalPosition(Math.round(pos.x), Math.round(pos.y)))
    await win.show()
  }
}