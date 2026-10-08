import { describe, expect, it } from 'vitest'
import { AppStorage, type KeyValueStore } from './appStorage'
import { migrateState } from './migrate'
import { defaultState, STATE_STORAGE_KEY } from './schema'

function memoryKV(initial: Record<string, string> = {}): KeyValueStore & {
  data: Map<string, string>
} {
  const data = new Map(Object.entries(initial))
  return {
    data,
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      data.set(key, value)
      return true
    },
  }
}

describe('migrateState', () => {
  it('defaults anything that is not a known version', () => {
    expect(migrateState(undefined)).toEqual(defaultState())
    expect(migrateState([])).toEqual(defaultState())
    expect(migrateState({ version: 99, confusions: [] })).toEqual(
      defaultState(),
    )
  })

  it('drops v1 stats, confusions and pass windows, keeping the rest', () => {
    const progress = {
      unlockedCount: 3,
      passed: [0, 7],
      melodyOutcomes: [],
    }
    const v1 = {
      version: 1,
      settings: { ...defaultState().settings, goalMinutes: 20 },
      degreeStats: { 4: { outcomes: [true, true], speedTimesMs: [] } },
      confusions: [{ played: 4, tapped: 5 }],
      presetProgress: { major: { ...progress, passWindows: { 4: [true] } } },
      dailyRecords: {
        '2026-10-04': { date: '2026-10-04', activeMinutes: 12 },
      },
    }
    const state = migrateState(v1)
    expect(state.version).toBe(3)
    expect(state.presetStats).toEqual({})
    expect(state.confusions).toEqual([])
    expect(state).not.toHaveProperty('degreeStats')
    expect(state.settings.goalMinutes).toBe(20)
    expect(state.presetProgress).toEqual({ major: progress })
    expect(state.dailyRecords).toEqual(v1.dailyRecords)
    expect(state.totals).toEqual({})
  })

  it('starts v2 totals at zero, keeping the rest', () => {
    const v2 = {
      ...defaultState(),
      version: 2,
      presetStats: {
        major: { 4: { outcomes: [true, true], speedTimesMs: [] } },
      },
      confusions: [{ preset: 'major', played: 4, tapped: 5 }],
      dailyRecords: {
        '2026-10-04': { date: '2026-10-04', activeMinutes: 12 },
      },
    }
    const { totals: _totals, ...v2State } = v2
    const state = migrateState(v2State)
    expect(state.version).toBe(3)
    expect(state.totals).toEqual({})
    expect(state.presetStats.major?.[4]?.outcomes).toEqual([true, true])
    expect(state.confusions).toEqual(v2.confusions)
    expect(state.dailyRecords).toEqual(v2.dailyRecords)
  })
})

describe('AppStorage', () => {
  it('starts from defaults and persists them at once', () => {
    const kv = memoryKV()
    const storage = new AppStorage(kv)
    expect(storage.state).toEqual(defaultState())
    expect(kv.data.has(STATE_STORAGE_KEY)).toBe(true)
  })

  it('loads a stored state', () => {
    const stored = {
      ...defaultState(),
      confusions: [{ preset: 'major', played: 0, tapped: 7 }],
    }
    const kv = memoryKV({ [STATE_STORAGE_KEY]: JSON.stringify(stored) })
    expect(new AppStorage(kv).state).toEqual(stored)
  })

  it('survives corrupted JSON', () => {
    const kv = memoryKV({ [STATE_STORAGE_KEY]: '{oops' })
    expect(new AppStorage(kv).state).toEqual(defaultState())
  })

  it('writes through on update', () => {
    const kv = memoryKV()
    const storage = new AppStorage(kv)
    storage.update((state) => ({
      ...state,
      settings: { ...state.settings, goalMinutes: 20 },
    }))
    const saved = JSON.parse(kv.data.get(STATE_STORAGE_KEY) ?? '{}')
    expect(saved.settings.goalMinutes).toBe(20)
  })

  it('keeps working from memory when writes fail', () => {
    const storage = new AppStorage({ get: () => null, set: () => false })
    storage.update((state) => ({ ...state, confusions: [] }))
    expect(storage.state.confusions).toEqual([])
  })
})
