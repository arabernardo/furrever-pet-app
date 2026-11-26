import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

/** Creates the settings window on demand (closing it frees its memory), or focuses the existing one. */
export async function openSettings(welcome = false): Promise<void> {
  try {
    const existing = await WebviewWindow.getByLabel('settings')
    if (existing) {
      await existing.show()
      await existing.unminimize()
      await existing.setFocus()
      return
    }
    const win = new WebviewWindow('settings', {
      url: welcome ? 'settings.html?welcome=1' : 'settings.html',
      title: welcome ? 'Welcome to Furever Pet' : 'Furever Pet Settings',
      width: 380,
      height: 720,
      resizable: false,
      maximizable: false,
      minimizable: false,
      center: true,
      focus: true,
    })
    void win.once('tauri://error', (e) => console.warn('[settings] failed to open', e))
  } catch (err) {
    console.warn('[settings] openSettings failed', err)
  }
}