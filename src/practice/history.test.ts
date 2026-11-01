import { describe, expect, it } from 'vitest'
import { addActiveMinutes, type DailyRecords } from './daily'
import {
  buildHistory,
  dayMeasure,
  EMPTY_DAY_TALLY,
  HISTORY_DAYS,
  isEmptyDayTally,
  recordDayTally,
  stepDayTally,
  type DayTally,
} from './history'
import type { SessionAnswer } from './session'

function answer(correct: boolean, timeMs: number | null = 900): SessionAnswer {
  return { played: [4], tapped: [4], correct, slots: [correct], timeMs }
}

function at(answers: SessionAnswer[], activeMs: number, passed = 0) {
  return {
    answers,
    activity: { lastEventMs: activeMs, activeMs },
    newlyPassed: Array.from({ length: passed }, () => 4 as const),
  }
}

function tally(answered: number, correct: number, more = {}): DayTally {
  return { ...EMPTY_DAY_TALLY, answered, correct, ...more }
}

describe('stepDayTally', () => {
  it('counts new answers, right-answer times, time and passes', () => {
    const before = at([answer(true)], 1000)
    const after = at(
      [answer(true), answer(true, 1200), answer(false, 700)],
      4000,
      1,
    )
    expect(stepDayTally(before, after)).toEqual({
      answered: 2,
      correct: 1,
      activeMs: 3000,
      rightTimeMs: 1200,
      rightTimed: 1,
      passed: 1,
    })
  })

  it('times no Speed timeout', () => {
    const step = stepDayTally(at([], 0), at([answer(false, null)], 5000))
    expect(step.rightTimed).toBe(0)
    expect(step.rightTimeMs).toBe(0)
  })

  it('is empty when nothing moved', () => {
    const same = at([answer(true)], 10)
    expect(isEmptyDayTally(stepDayTally(same, same))).toBe(true)
    expect(isEmptyDayTally(stepDayTally(at([], 0), at([], 500)))).toBe(false)
  })
})

describe('recordDayTally', () => {
  it('adds to one preset and mode, keeping the day minutes and the rest', () => {
    let records: DailyRecords = addActiveMinutes({}, '2026-11-01', 3)
    records = recordDayTally(
      records,
      '2026-11-01',
      'major',
      'notes',
      tally(2, 1),
    )
    records = recordDayTally(
      records,
      '2026-11-01',
      'major',
      'notes',
      tally(3, 3),
    )
    records = recordDayTally(
      records,
      '2026-11-01',
      'minor',
      'speed',
      tally(1, 1),
    )
    expect(records['2026-11-01']).toEqual({
      date: '2026-11-01',
      activeMinutes: 3,
      tallies: {
        major: { notes: tally(5, 4) },
        minor: { speed: tally(1, 1) },
      },
    })
  })

  it('survives a later minute update', () => {
    let records = recordDayTally(
      {},
      '2026-11-01',
      'major',
      'notes',
      tally(1, 1),
    )
    records = addActiveMinutes(records, '2026-11-01', 2)
    expect(records['2026-11-01']?.tallies?.major?.notes).toEqual(tally(1, 1))
    expect(records['2026-11-01']?.activeMinutes).toBe(2)
  })
})

describe('dayMeasure', () => {
  it('is the share right outside Speed', () => {
    expect(dayMeasure('notes', tally(4, 3))).toBe(0.75)
    expect(dayMeasure('melody', tally(0, 0))).toBeNull()
  })

  it('is the average right-answer time in Speed', () => {
    const speed = tally(4, 2, { rightTimeMs: 3000, rightTimed: 2 })
    expect(dayMeasure('speed', speed)).toBe(1500)
    expect(dayMeasure('speed', tally(3, 0))).toBeNull()
  })
})

describe('buildHistory', () => {
  function practiced(entries: [string, DayTally][]): DailyRecords {
    return entries.reduce<DailyRecords>(
      (records, [date, t]) =>
        recordDayTally(records, date, 'major', 'notes', t),
      {},
    )
  }

  it('lists 30 days ending today, with gaps for days not practiced', () => {
    const { days } = buildHistory(
      practiced([['2026-11-01', tally(4, 2)]]),
      'major',
      'notes',
      '2026-11-01',
    )
    expect(days).toHaveLength(HISTORY_DAYS)
    expect(days[0]?.date).toBe('2026-10-03')
    expect(days.at(-1)).toMatchObject({ date: '2026-11-01', measure: 0.5 })
    expect(days.at(-2)).toMatchObject({ tally: null, measure: null })
  })

  it('reads only its own preset and mode', () => {
    const records = recordDayTally(
      {},
      '2026-11-01',
      'minor',
      'notes',
      tally(1, 1),
    )
    const { days } = buildHistory(records, 'major', 'notes', '2026-11-01')
    expect(days.every((day) => day.measure === null)).toBe(true)
  })

  it('pools each week over its answers', () => {
    const { thisWeek, lastWeek } = buildHistory(
      practiced([
        ['2026-11-01', tally(10, 9)],
        ['2026-10-26', tally(10, 7)], // the 7th day back: this week
        ['2026-10-25', tally(4, 2)], // the 8th: last week
        ['2026-10-19', tally(6, 4)],
        ['2026-10-18', tally(50, 0)], // the 15th: neither
      ]),
      'major',
      'notes',
      '2026-11-01',
    )
    expect(thisWeek).toBe(16 / 20)
    expect(lastWeek).toBe(6 / 10)
  })

  it('reads a week without answers as null', () => {
    const { lastWeek } = buildHistory(
      practiced([['2026-11-01', tally(1, 1)]]),
      'major',
      'notes',
      '2026-11-01',
    )
    expect(lastWeek).toBeNull()
  })
})
