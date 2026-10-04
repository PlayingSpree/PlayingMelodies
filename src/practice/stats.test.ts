import { describe, expect, it } from 'vitest'
import {
  EMPTY_DEGREE_STATS,
  emptyStatsMap,
  gradeOf,
  median,
  OUTCOME_WINDOW,
  recordNotesOutcome,
  recordSpeedTime,
  SPEED_LIMIT_MS,
  starOf,
  windowGrade,
  type DegreeStats,
} from './stats'

function notes(...outcomes: boolean[]): DegreeStats {
  return outcomes.reduce(recordNotesOutcome, EMPTY_DEGREE_STATS)
}

describe('recordNotesOutcome', () => {
  it('keeps the last 10 outcomes, oldest first', () => {
    const stats = notes(false, ...Array<boolean>(OUTCOME_WINDOW).fill(true))
    expect(stats.outcomes).toHaveLength(OUTCOME_WINDOW)
    expect(stats.outcomes.every(Boolean)).toBe(true)
  })

  it('leaves the Speed window alone', () => {
    expect(notes(true).speedTimesMs).toEqual([])
  })
})

describe('recordSpeedTime', () => {
  it('records a miss or timeout as the full limit', () => {
    expect(recordSpeedTime(EMPTY_DEGREE_STATS, null).speedTimesMs).toEqual([
      SPEED_LIMIT_MS,
    ])
  })

  it('caps a time at the limit', () => {
    expect(recordSpeedTime(EMPTY_DEGREE_STATS, 7000).speedTimesMs).toEqual([
      SPEED_LIMIT_MS,
    ])
  })

  it('keeps the last 10 times', () => {
    let stats = EMPTY_DEGREE_STATS
    for (let i = 1; i <= 12; i++) stats = recordSpeedTime(stats, i * 100)
    expect(stats.speedTimesMs).toEqual([
      300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200,
    ])
  })
})

describe('gradeOf', () => {
  it('uses the §5 bands', () => {
    expect(gradeOf(1)).toBe('A')
    expect(gradeOf(0.9)).toBe('A')
    expect(gradeOf(0.89)).toBe('B')
    expect(gradeOf(0.8)).toBe('B')
    expect(gradeOf(0.7)).toBe('C')
    expect(gradeOf(0.6)).toBe('D')
    expect(gradeOf(0.59)).toBe('F')
  })
})

describe('windowGrade', () => {
  it('shows nothing until 5 answers exist', () => {
    expect(windowGrade([true, true, true, true])).toBeNull()
    expect(windowGrade([true, true, true, true, true])).toBe('A')
  })

  it('grades accuracy over the whole window', () => {
    const outcomes = [false, false, ...Array<boolean>(8).fill(true)]
    expect(windowGrade(outcomes)).toBe('B')
  })
})

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

describe('starOf', () => {
  it('gives no star until 5 times exist', () => {
    expect(starOf([500, 500, 500, 500])).toBeNull()
  })

  it('rates the median time', () => {
    expect(starOf([900, 900, 900, 5000, 5000])).toBe('gold')
    expect(starOf([1000, 1500, 1500, 1500, 400])).toBe('silver')
    expect(starOf([2999, 2999, 2999, 100, 100])).toBe('bronze')
    expect(starOf([3000, 3000, 3000, 100, 100])).toBeNull()
  })
})

describe('emptyStatsMap', () => {
  it('holds an empty record for every degree', () => {
    const map = emptyStatsMap()
    expect(Object.keys(map)).toHaveLength(12)
    expect(map[11]).toEqual(EMPTY_DEGREE_STATS)
  })
})
