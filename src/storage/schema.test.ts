import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, EMPTY_DEGREE_STATS } from '../practice'
import {
  defaultState,
  sanitizeConfusions,
  sanitizeDailyRecords,
  sanitizeDegreeStatsMap,
  sanitizePresetProgress,
  sanitizeState,
  SCHEMA_VERSION,
} from './schema'

describe('sanitizeState', () => {
  it('turns junk into the default state', () => {
    expect(sanitizeState({})).toEqual(defaultState())
  })

  it('keeps a valid state as it is', () => {
    const state = {
      version: SCHEMA_VERSION,
      settings: { ...DEFAULT_SETTINGS, register: 2 },
      degreeStats: {
        ...defaultState().degreeStats,
        4: { outcomes: [true, false], speedTimesMs: [1200] },
      },
      confusions: [{ played: 4, tapped: 5 }],
      presetProgress: {
        major: {
          unlockedCount: 3,
          passWindows: { 0: [true, true, true, true, true], 4: [false] },
          passed: [0, 7],
          melodyOutcomes: [true],
        },
      },
      dailyRecords: {
        '2026-10-04': { date: '2026-10-04', activeMinutes: 4.5 },
      },
    }
    expect(sanitizeState(JSON.parse(JSON.stringify(state)))).toEqual(state)
  })
})

describe('sanitizeDegreeStatsMap', () => {
  it('fills every degree and drops bad entries', () => {
    const map = sanitizeDegreeStatsMap({
      3: { outcomes: [true, 'yes', false], speedTimesMs: [800, -1, 9000, 'x'] },
      12: { outcomes: [true] },
    })
    expect(map[3]).toEqual({ outcomes: [true, false], speedTimesMs: [800] })
    expect(map[0]).toEqual(EMPTY_DEGREE_STATS)
    expect(Object.keys(map)).toHaveLength(12)
  })

  it('trims windows to their size, keeping the newest', () => {
    const outcomes = [false, ...Array<boolean>(10).fill(true)]
    expect(sanitizeDegreeStatsMap({ 0: { outcomes } })[0].outcomes).toEqual(
      Array<boolean>(10).fill(true),
    )
  })
})

describe('sanitizeConfusions', () => {
  it('drops entries that are not two different degrees', () => {
    expect(
      sanitizeConfusions([
        { played: 4, tapped: 5, extra: 1 },
        { played: 4, tapped: 4 },
        { played: 4, tapped: 12 },
        'junk',
      ]),
    ).toEqual([{ played: 4, tapped: 5 }])
  })
})

describe('sanitizePresetProgress', () => {
  it('opens a fresh preset for junk', () => {
    expect(sanitizePresetProgress('major', null)).toEqual({
      unlockedCount: 2,
      passWindows: {},
      passed: [],
      melodyOutcomes: [],
    })
  })

  it('holds the unlocked count within the preset', () => {
    expect(
      sanitizePresetProgress('major', { unlockedCount: 1 }).unlockedCount,
    ).toBe(2)
    expect(
      sanitizePresetProgress('major', { unlockedCount: 40 }).unlockedCount,
    ).toBe(7)
  })

  it('keeps passes and pass windows only for open degrees', () => {
    // Major opens 1 5 3 at a count of 3; 4 is not open yet.
    const progress = sanitizePresetProgress('major', {
      unlockedCount: 3,
      passWindows: { 0: [true], 5: [true] },
      passed: [7, 5, 7, 'x'],
    })
    expect(progress.passWindows).toEqual({ 0: [true] })
    expect(progress.passed).toEqual([7])
  })
})

describe('sanitizeDailyRecords', () => {
  it('keeps well-formed days, keyed by date', () => {
    expect(
      sanitizeDailyRecords({
        '2026-10-04': { date: 'ignored', activeMinutes: 3 },
        '2026-10-05': { activeMinutes: -1 },
        yesterday: { activeMinutes: 3 },
      }),
    ).toEqual({ '2026-10-04': { date: '2026-10-04', activeMinutes: 3 } })
  })
})
