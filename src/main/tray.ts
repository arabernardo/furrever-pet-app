import { defaultWindowIcon } from '@tauri-apps/api/app'
import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu'
import { TrayIcon } from '@tauri-apps/api/tray'

export interface TrayActions {
  toggleVisible: () => void
  choosePet: (id: string) => void
  toggleMute: () => void
  openSettings: () => void
  quit: () => void
  feed: () => void
  play: () => void
}

export interface TrayState {
  visible: boolean
  petId: string
  pets: { id: string; name: string }[]
  muted: boolean
}

export class PetTray {
  private tray: TrayIcon | null = null
  private menu: Menu | null = null

  constructor(private readonly actions: TrayActions) {}

  async init(state: TrayState): Promise<void> {
    this.menu = await this.build(state)
    const icon = await defaultWindowIcon()
    this.tray = await TrayIcon.new({ id: 'furrever-pet', tooltip: 'furrever Pet', icon: icon ?? undefined, menu: this.menu })
  }

  /** Rebuilds the menu so labels/checkmarks match the current state. */
  async update(state: TrayState): Promise<void> {
    const old = this.menu
    this.menu = await this.build(state)
    await this.tray?.setMenu(this.menu)
    await old?.close()
  }

  /** Removes the tray icon (avoids a ghost icon on Windows after quit). */
  async dispose(): Promise<void> {
    await this.tray?.close()
    this.tray = null
  }

  private async build(s: TrayState): Promise<Menu> {
    const petItems = await Promise.all(
      s.pets.map((p) =>
        CheckMenuItem.new({ id: `pet:${p.id}`, text: p.name, checked: p.id === s.petId, action: () => this.actions.choosePet(p.id) }),
      ),
    )
    return Menu.new({
      items: [
        await MenuItem.new({ id: 'toggle', text: s.visible ? 'Hide pet' : 'Show pet', action: () => this.actions.toggleVisible() }),
        await MenuItem.new({ id: 'feed', text: 'Feed', action: () => this.actions.feed() }),
        await MenuItem.new({ id: 'play', text: 'Play', action: () => this.actions.play() }),
        await Submenu.new({ text: 'Choose pet', items: petItems }),
        await CheckMenuItem.new({ id: 'mute', text: 'Mute sounds', checked: s.muted, action: () => this.actions.toggleMute() }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({ id: 'settings', text: 'Settings…', action: () => this.actions.openSettings() }),
        await MenuItem.new({ id: 'quit', text: 'Quit', action: () => this.actions.quit() }),
      ],
    })
  }
}