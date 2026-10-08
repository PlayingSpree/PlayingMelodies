import { describe, expect, it } from 'vitest'
import type { SessionAnswer } from './session'
import {
  EMPTY_TOTALS,
  isEmptyTotals,
  recordTotals,
  stepTotals,
  totalsOf,
} from './totals'

function answer(correct: boolean): SessionAnswer {
  return { played: [4], tapped: [4], correct, slots: [correct], timeMs: 900 }
}

function at(answers: boolean[], activeMs: number) {
  return {
    answers: answers.map(answer),
    activity: { lastEventMs: activeMs, activeMs },
  }
}

describe('stepTotals', () => {
  it('counts the session with its first answer', () => {
    expect(stepTotals(at([], 0), at([true], 3000))).toEqual({
      sessions: 1,
      answered: 1,
      correct: 1,
      activeMs: 3000,
    })
  })

  it('adds later answers without counting the session again', () => {
    expect(stepTotals(at([true], 3000), at([true, false], 5000))).toEqual({
      sessions: 0,
      answered: 1,
      correct: 0,
      activeMs: 2000,
    })
  })

  it('adds only time for a step without an answer', () => {
    const step = stepTotals(at([], 0), at([], 1500))
    expect(step).toEqual({ ...EMPTY_TOTALS, activeMs: 1500 })
    expect(isEmptyTotals(step)).toBe(false)
    expect(isEmptyTotals(stepTotals(at([true], 10), at([true], 10)))).toBe(true)
  })
})

describe('recordTotals', () => {
  it('adds to one preset and mode, leaving the rest', () => {
    const step = { sessions: 1, answered: 2, correct: 1, activeMs: 4000 }
    let totals = recordTotals({}, 'major', 'notes', step)
    totals = recordTotals(totals, 'major', 'notes', step)
    totals = recordTotals(totals, 'major', 'speed', step)

    expect(totalsOf(totals, 'major', 'notes')).toEqual({
      sessions: 2,
      answered: 4,
      correct: 2,
      activeMs: 8000,
    })
    expect(totalsOf(totals, 'major', 'speed')).toEqual(step)
    expect(totalsOf(totals, 'major', 'melody')).toEqual(EMPTY_TOTALS)
    expect(totalsOf(totals, 'minor', 'notes')).toEqual(EMPTY_TOTALS)
  })
})
