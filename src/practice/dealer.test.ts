import { describe, expect, it } from 'vitest'
import type { Degree } from '../theory'
import {
  dealDegree,
  degreeWeight,
  MAX_WEIGHT,
  pickWeighted,
  placeDegree,
} from './dealer'
import { emptyStatsMap, recordNotesOutcome, type DegreeStatsMap } from './stats'

function withOutcomes(degree: Degree, ...outcomes: boolean[]): DegreeStatsMap {
  const map = emptyStatsMap()
  return { ...map, [degree]: outcomes.reduce(recordNotesOutcome, map[degree]) }
}

describe('degreeWeight', () => {
  it('weighs a fresh degree 1', () => {
    expect(degreeWeight(4, emptyStatsMap(), [])).toBe(1)
  })

  it('adds 0.5 per miss among the last 5 outcomes', () => {
    const stats = withOutcomes(4, false, true, true, true, true, false)
    // The oldest miss has left the 5-answer lookback.
    expect(degreeWeight(4, stats, [])).toBe(1.5)
  })

  it('adds 0.25 to both degrees of each recent confusion', () => {
    const log = [
      { played: 4 as Degree, tapped: 5 as Degree },
      { played: 5 as Degree, tapped: 4 as Degree },
    ]
    expect(degreeWeight(4, emptyStatsMap(), log)).toBe(1.5)
    expect(degreeWeight(5, emptyStatsMap(), log)).toBe(1.5)
    expect(degreeWeight(7, emptyStatsMap(), log)).toBe(1)
  })

  it('reads only the last 20 confusions', () => {
    const old = { played: 4 as Degree, tapped: 5 as Degree }
    const recent = Array.from({ length: 20 }, () => ({
      played: 0 as Degree,
      tapped: 7 as Degree,
    }))
    expect(degreeWeight(4, emptyStatsMap(), [old, ...recent])).toBe(1)
  })

  it('caps the weight', () => {
    const stats = withOutcomes(4, false, false, false, false, false)
    const log = Array.from({ length: 10 }, () => ({
      played: 4 as Degree,
      tapped: 5 as Degree,
    }))
    expect(degreeWeight(4, stats, log)).toBe(MAX_WEIGHT)
  })
})

describe('pickWeighted', () => {
  it('walks the cumulative weights', () => {
    const items = ['a', 'b', 'c']
    const weights = [1, 2, 1]
    expect(pickWeighted(items, weights, () => 0)).toBe('a')
    expect(pickWeighted(items, weights, () => 0.3)).toBe('b')
    expect(pickWeighted(items, weights, () => 0.74)).toBe('b')
    expect(pickWeighted(items, weights, () => 0.76)).toBe('c')
  })

  it('falls back to the last item on rounding', () => {
    expect(pickWeighted(['a', 'b'], [1, 1], () => 1)).toBe('b')
  })
})

describe('dealDegree', () => {
  it('deals by weight', () => {
    const stats = withOutcomes(7, false, false, false, false)
    // 1 weighs 1, 5 weighs 3: the first quarter of the range is 1.
    expect(dealDegree([0, 7], [], stats, [], () => 0.2)).toBe(0)
    expect(dealDegree([0, 7], [], stats, [], () => 0.3)).toBe(7)
  })

  it('allows two in a row but never three', () => {
    expect(dealDegree([0, 7], [0], emptyStatsMap(), [], () => 0)).toBe(0)
    expect(dealDegree([0, 7], [0, 0], emptyStatsMap(), [], () => 0)).toBe(7)
    expect(dealDegree([0, 7], [7, 0, 0], emptyStatsMap(), [], () => 0)).toBe(7)
  })

  it('repeats a lone degree', () => {
    expect(dealDegree([0], [0, 0], emptyStatsMap(), [], () => 0)).toBe(0)
  })

  it('throws on an empty pool', () => {
    expect(() => dealDegree([], [], emptyStatsMap(), [])).toThrow()
  })
})

describe('placeDegree', () => {
  it('plays in the octave above the tonic by default', () => {
    expect(placeDegree(4, 1, () => 0.99)).toBe(4)
  })

  it('spreads over the register', () => {
    expect(placeDegree(4, 3, () => 0)).toBe(4)
    expect(placeDegree(4, 3, () => 0.5)).toBe(16)
    expect(placeDegree(4, 3, () => 0.99)).toBe(28)
  })
})
