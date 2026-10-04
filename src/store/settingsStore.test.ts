import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../practice'
import { createSettingsStore } from './settingsStore'
import { memoryStorage, recordingSound } from './testing'

describe('settingsStore', () => {
  it('starts from the stored settings and hands their volumes to the audio', () => {
    const storage = memoryStorage()
    storage.update((state) => ({
      ...state,
      settings: { ...state.settings, droneVolume: 0.3 },
    }))
    const sound = recordingSound()
    const store = createSettingsStore({ storage, sound })
    expect(store.getState().settings.droneVolume).toBe(0.3)
    expect(sound.calls).toEqual([
      ['setVolumes', { drone: 0.3, note: DEFAULT_SETTINGS.noteVolume }],
    ])
  })

  it('applies a partial update, persists it, and sets the volumes live', () => {
    const storage = memoryStorage()
    const sound = recordingSound()
    const store = createSettingsStore({ storage, sound })
    store.getState().update({ noteVolume: 0.4, register: 2 })
    const expected = { ...DEFAULT_SETTINGS, noteVolume: 0.4, register: 2 }
    expect(store.getState().settings).toEqual(expected)
    expect(storage.state.settings).toEqual(expected)
    expect(sound.calls.at(-1)).toEqual([
      'setVolumes',
      { drone: DEFAULT_SETTINGS.droneVolume, note: 0.4 },
    ])
  })

  it('sanitizes what it is given', () => {
    const store = createSettingsStore({
      storage: memoryStorage(),
      sound: recordingSound(),
    })
    store.getState().update({ droneVolume: 7, goalMinutes: -3 })
    const { droneVolume, goalMinutes } = store.getState().settings
    expect(droneVolume).toBeLessThanOrEqual(1)
    expect(goalMinutes).toBeGreaterThanOrEqual(1)
  })

  it('reloads the stored settings after an import replaced them', () => {
    const storage = memoryStorage()
    const sound = recordingSound()
    const store = createSettingsStore({ storage, sound })
    const settings = { ...DEFAULT_SETTINGS, droneVolume: 0.1, goalMinutes: 25 }
    storage.update((state) => ({ ...state, settings }))
    store.getState().reload()
    expect(store.getState().settings).toEqual(settings)
    expect(sound.calls.at(-1)).toEqual([
      'setVolumes',
      { drone: 0.1, note: DEFAULT_SETTINGS.noteVolume },
    ])
  })
})
