import { describe, expect, it } from 'vitest'
import {
  addActiveMinutes,
  computeStreak,
  localDateKey,
  previousDateKey,
  type DailyRecords,
} from './daily'

function days(...entries: [string, number][]): DailyRecords {
  return Object.fromEntries(
    entries.map(([date, activeMinutes]) => [date, { date, activeMinutes }]),
  )
}

describe('date keys', () => {
  it('formats a local date', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('steps back across month and year ends', () => {
    expect(previousDateKey('2026-03-01')).toBe('2026-02-28')
    expect(previousDateKey('2026-01-01')).toBe('2025-12-31')
  })
})

describe('addActiveMinutes', () => {
  it('starts and adds to a day', () => {
    const once = addActiveMinutes({}, '2026-10-04', 2.5)
    const twice = addActiveMinutes(once, '2026-10-04', 1)
    expect(twice).toEqual(days(['2026-10-04', 3.5]))
  })
})

describe('computeStreak', () => {
  it('counts consecutive days meeting the goal, ending today', () => {
    const records = days(
      ['2026-10-01', 12],
      ['2026-10-02', 10],
      ['2026-10-03', 15],
      ['2026-10-04', 11],
    )
    expect(computeStreak(records, 10, '2026-10-04')).toBe(4)
  })

  it("doesn't break on a today still short of the goal", () => {
    const records = days(['2026-10-03', 10], ['2026-10-04', 3])
    expect(computeStreak(records, 10, '2026-10-04')).toBe(1)
  })

  it('breaks on a missed day', () => {
    const records = days(['2026-10-01', 10], ['2026-10-03', 10])
    expect(computeStreak(records, 10, '2026-10-04')).toBe(1)
  })

  it('reads against the current goal', () => {
    const records = days(['2026-10-03', 10], ['2026-10-04', 10])
    expect(computeStreak(records, 15, '2026-10-04')).toBe(0)
  })
})
