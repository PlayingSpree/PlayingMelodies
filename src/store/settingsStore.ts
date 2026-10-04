// App settings (DESIGN.md §7.5), persisted in the versioned schema (§8). The
// volumes are live: every change reaches the audio at once, mid-session too.

import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { sound as appSound, type Sound } from '../audio'
import { sanitizeSettings, type Settings } from '../practice'
import { appStorage, type AppStorage } from '../storage'

export interface SettingsStoreState {
  settings: Settings
  update(patch: Partial<Settings>): void
}

export interface SettingsStoreDeps {
  storage?: AppStorage
  sound?: Pick<Sound, 'setVolumes'>
}

const volumesOf = (settings: Settings) => ({
  drone: settings.droneVolume,
  note: settings.noteVolume,
})

export function createSettingsStore({
  storage = appStorage,
  sound = appSound,
}: SettingsStoreDeps = {}) {
  const initial = storage.state.settings // sanitized during load/migration
  sound.setVolumes(volumesOf(initial))

  return createStore<SettingsStoreState>()((set, get) => ({
    settings: initial,

    update(patch) {
      const settings = sanitizeSettings({ ...get().settings, ...patch })
      set({ settings })
      storage.update((state) => ({ ...state, settings }))
      sound.setVolumes(volumesOf(settings))
    },
  }))
}

export const settingsStore = createSettingsStore()

export function useSettings<T>(selector: (state: SettingsStoreState) => T): T {
  return useStore(settingsStore, selector)
}
