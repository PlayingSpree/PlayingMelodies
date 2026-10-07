import { describe, expect, it } from 'vitest'
import { getPreset, type Degree } from '../theory'
import { gradeAnswer, type PracticeSlice } from './grading'
import { freshProgress } from './progress'
import { emptyStatsMap, SPEED_LIMIT_MS } from './stats'

const MAJOR = getPreset('major')

function fresh(): PracticeSlice {
  return {
    degreeStats: emptyStatsMap(),
    confusions: [],
    progress: freshProgress(MAJOR),
  }
}

describe('gradeAnswer: Notes', () => {
  it('feeds the grade window, which passing reads', () => {
    const result = gradeAnswer(MAJOR, fresh(), {
      mode: 'notes',
      played: 19, // 5, an octave up
      tapped: 7,
    })
    expect(result.correct).toBe(true)
    expect(result.practice.degreeStats[7].outcomes).toEqual([true])
    expect(result.practice.confusions).toEqual([])
  })

  it('logs a miss as a confusion', () => {
    const result = gradeAnswer(MAJOR, fresh(), {
      mode: 'notes',
      played: 7,
      tapped: 0,
    })
    expect(result.correct).toBe(false)
    expect(result.practice.degreeStats[7].outcomes).toEqual([false])
    expect(result.practice.confusions).toEqual([
      { preset: 'major', played: 7, tapped: 0 },
    ])
  })

  it('reports a pass and the unlock it opens', () => {
    let practice = fresh()
    for (const degree of [0, 0, 0, 0, 7, 7, 7, 7] as Degree[]) {
      practice = gradeAnswer(MAJOR, practice, {
        mode: 'notes',
        played: degree,
        tapped: degree,
      }).practice
    }
    const result = gradeAnswer(MAJOR, practice, {
      mode: 'notes',
      played: 0,
      tapped: 0,
    })
    expect(result.newlyPassed).toBe(0)
    expect(result.newlyUnlocked).toEqual([])
    const opening = gradeAnswer(MAJOR, result.practice, {
      mode: 'notes',
      played: 7,
      tapped: 7,
    })
    expect(opening.newlyPassed).toBe(7)
    expect(opening.newlyUnlocked).toEqual([4])
  })
})

describe('gradeAnswer: Speed', () => {
  it('feeds only the star window', () => {
    const result = gradeAnswer(MAJOR, fresh(), {
      mode: 'speed',
      played: 4,
      tapped: 4,
      timeMs: 1234,
    })
    expect(result.practice.degreeStats[4]).toEqual({
      outcomes: [],
      speedTimesMs: [1234],
    })
    expect(result.practice.progress).toEqual(fresh().progress)
  })

  it('records a wrong tap as the full limit and a confusion', () => {
    const result = gradeAnswer(MAJOR, fresh(), {
      mode: 'speed',
      played: 4,
      tapped: 5,
      timeMs: 400,
    })
    expect(result.correct).toBe(false)
    expect(result.practice.degreeStats[4].speedTimesMs).toEqual([
      SPEED_LIMIT_MS,
    ])
    expect(result.practice.confusions).toEqual([
      { preset: 'major', played: 4, tapped: 5 },
    ])
  })

  it('records a timeout as the full limit, with no confusion', () => {
    const result = gradeAnswer(MAJOR, fresh(), {
      mode: 'speed',
      played: 4,
      tapped: null,
      timeMs: null,
    })
    expect(result.practice.degreeStats[4].speedTimesMs).toEqual([
      SPEED_LIMIT_MS,
    ])
    expect(result.practice.confusions).toEqual([])
  })
})

describe('gradeAnswer: Melody', () => {
  it('feeds only the melody window and the confusion log', () => {
    const result = gradeAnswer(MAJOR, fresh(), {
      mode: 'melody',
      played: [0, 2, 4],
      tapped: [0, 4, 4],
    })
    expect(result.correct).toBe(false)
    expect(result.slots).toEqual([true, false, true])
    expect(result.practice.progress.melodyOutcomes).toEqual([false])
    expect(result.practice.confusions).toEqual([
      { preset: 'major', played: 2, tapped: 4 },
    ])
    expect(result.practice.degreeStats).toEqual(emptyStatsMap())
  })
})
