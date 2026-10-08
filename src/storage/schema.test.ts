import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SESSION_OPTIONS,
  DEFAULT_SETTINGS,
  EMPTY_DEGREE_STATS,
  emptyStatsMap,
} from '../practice'
import {
  defaultState,
  sanitizeConfusions,
  sanitizeDailyRecords,
  sanitizeDegreeStatsMap,
  sanitizePresetProgress,
  sanitizePresetStatsMap,
  sanitizePresetProgressMap,
  sanitizeState,
  sanitizeTotalsMap,
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
      presetStats: {
        major: {
          ...emptyStatsMap(),
          4: { outcomes: [true, false], speedTimesMs: [1200] },
        },
      },
      confusions: [{ preset: 'major', played: 4, tapped: 5 }],
      presetProgress: {
        major: {
          unlockedCount: 3,
          passed: [0, 7],
          melodyOutcomes: [true],
        },
      },
      totals: {
        major: {
          notes: { sessions: 3, answered: 60, correct: 51, activeMs: 540_000 },
        },
      },
      dailyRecords: {
        '2026-10-04': { date: '2026-10-04', activeMinutes: 4.5 },
      },
      lastOptions: {
        ...DEFAULT_SESSION_OPTIONS,
        mode: 'speed',
        tonicLock: 7,
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

describe('sanitizePresetStatsMap', () => {
  it('keeps known presets only, each filled out', () => {
    const map = sanitizePresetStatsMap({
      minor: { 3: { outcomes: [true] } },
      dorian: { 3: { outcomes: [true] } },
    })
    expect(Object.keys(map)).toEqual(['minor'])
    expect(map.minor?.[3]).toEqual({ outcomes: [true], speedTimesMs: [] })
    expect(map.minor?.[0]).toEqual(EMPTY_DEGREE_STATS)
  })
})

describe('sanitizeConfusions', () => {
  it('drops entries that are not two different degrees in a known preset', () => {
    expect(
      sanitizeConfusions([
        { preset: 'major', played: 4, tapped: 5, extra: 1 },
        { preset: 'major', played: 4, tapped: 4 },
        { preset: 'major', played: 4, tapped: 12 },
        { preset: 'dorian', played: 4, tapped: 5 },
        { played: 4, tapped: 5 },
        'junk',
      ]),
    ).toEqual([{ preset: 'major', played: 4, tapped: 5 }])
  })
})

describe('sanitizePresetProgress', () => {
  it('opens a fresh preset for junk', () => {
    expect(sanitizePresetProgress('major', null)).toEqual({
      unlockedCount: 2,
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

  it("raises a save from before a preset's starting count grew", () => {
    // Minor opened only 2 degrees before spec 0.9.0, as did Combined, now
    // Chromatic.
    const minor = sanitizePresetProgress('minor', {
      unlockedCount: 2,
      passed: [0, 7],
    })
    expect(minor.unlockedCount).toBe(3)
    expect(minor.passed).toEqual([0, 7])
    expect(
      sanitizePresetProgress('chromatic', { unlockedCount: 2 }).unlockedCount,
    ).toBe(4)
  })

  it('drops progress saved under an old preset id', () => {
    // Chromatic was Combined, id and all, before spec 0.9.0.
    expect(
      sanitizePresetProgressMap({ combined: { unlockedCount: 6 } }),
    ).toEqual({})
  })

  it('keeps passes only for open degrees', () => {
    // Major opens 1 5 3 at a count of 3; 4 is not open yet.
    const progress = sanitizePresetProgress('major', {
      unlockedCount: 3,
      passed: [7, 5, 7, 'x'],
    })
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

describe('sanitizeTotalsMap', () => {
  it('keeps known presets and modes only', () => {
    const totals = { sessions: 1, answered: 20, correct: 18, activeMs: 90_000 }
    expect(
      sanitizeTotalsMap({
        major: { notes: totals, chords: totals },
        dorian: { notes: totals },
        minor: 'junk',
      }),
    ).toEqual({ major: { notes: totals }, minor: {} })
  })

  it('zeroes bad counts and holds right answers to the answers', () => {
    expect(
      sanitizeTotalsMap({
        major: {
          speed: { sessions: -1, answered: 5, correct: 9, activeMs: 'x' },
          melody: { sessions: 1.5, answered: 4, correct: 2, activeMs: -3 },
        },
      }),
    ).toEqual({
      major: {
        speed: { sessions: 0, answered: 5, correct: 5, activeMs: 0 },
        melody: { sessions: 0, answered: 4, correct: 2, activeMs: 0 },
      },
    })
  })
})
