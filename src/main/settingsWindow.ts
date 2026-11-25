import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

/** Creates the settings window on demand (closing it frees its memory), or focuses the existing one. */
export async function openSettings(): Promise<void> {
  try {
    const existing = await WebviewWindow.getByLabel('settings')
    if (existing) {
      await existing.show()
      await existing.unminimize()
      await existing.setFocus()
      return
    }
    const win = new WebviewWindow('settings', {
      url: 'settings.html',
      title: 'Furever Pet Settings',
      width: 380,
      height: 640,
      resizable: false,
      maximizable: false,
      minimizable: false,
      center: true,
    })
    void win.once('tauri://error', (e) => console.warn('[settings] failed to open', e))
  } catch (err) {
    console.warn('[settings] openSettings failed', err)
  }
}