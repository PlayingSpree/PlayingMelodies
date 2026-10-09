import { describe, expect, it } from 'vitest'
import { degreeAt, getPreset, type Degree } from '../theory'
import type { PracticeSlice } from './grading'
import { freshProgress } from './progress'
import { sessionReport } from './report'
import {
  advance,
  endSession,
  SETTLE_MS,
  startSession,
  tap,
  timeout,
  type SessionState,
} from './session'
import {
  DEFAULT_SESSION_OPTIONS,
  resolveLength,
  type SessionOptions,
} from './sessionOptions'
import { DEFAULT_SETTINGS, feedbackSettings } from './settings'
import { emptyStatsMap, recordNotesOutcome, recordSpeedTime } from './stats'

const MAJOR = getPreset('major')

// The setup's options and the length they resolve to; Daily has nothing
// left of the goal here, so it gets the default.
function setupOptions(options: Partial<SessionOptions>) {
  const full = { ...DEFAULT_SESSION_OPTIONS, ...options }
  return { options: full, length: resolveLength(full.length, 0) }
}

function practice(passedAll = false): PracticeSlice {
  return {
    degreeStats: emptyStatsMap(),
    confusions: [],
    progress: passedAll
      ? {
          ...freshProgress(MAJOR),
          unlockedCount: MAJOR.order.length,
          passed: [...MAJOR.order],
        }
      : freshProgress(MAJOR),
  }
}

// A session driven by `answer`, which picks the taps for each prompt (an
// empty list lets a Speed prompt time out).
function play(
  options: Partial<SessionOptions>,
  slice: PracticeSlice,
  prompts: number,
  answer: (prompt: number[], i: number) => Degree[],
): SessionState {
  let t = 0
  let state = startSession(
    {
      preset: MAJOR,
      ...setupOptions(options),
      register: 1,
      feedback: feedbackSettings(DEFAULT_SETTINGS),
      keyCue: false,
    },
    slice,
    t,
    () => 0.3,
  ).state
  state = advance(state, (t += SETTLE_MS), () => 0.3).state
  for (let i = 0; i < prompts; i++) {
    if (state.phase.kind !== 'answering') throw new Error(state.phase.kind)
    const taps = answer(state.phase.prompt, i)
    t += 800
    if (taps.length === 0) state = timeout(state, i).state
    for (const degree of taps) state = tap(state, degree, t).state
    state = advance(state, (t += 3000), () => 0.3).state
  }
  return endSession(state).state
}

const right = (prompt: number[]) => prompt.map(degreeAt)
const wrong = (prompt: number[]) => prompt.map((p) => degreeAt(p + 2))

describe('sessionReport', () => {
  it('counts accuracy and averages response time in Notes', () => {
    const state = play({ mode: 'notes' }, practice(), 4, (p, i) =>
      i < 3 ? right(p) : wrong(p),
    )
    const report = sessionReport(state)
    expect(report).toMatchObject({ answered: 4, correct: 3, accuracy: 0.75 })
    expect(report.averageTimeMs).toBe(800)
  })

  it('has no accuracy before any answer', () => {
    const state = play({ mode: 'notes' }, practice(), 0, right)
    expect(sessionReport(state)).toMatchObject({
      answered: 0,
      accuracy: null,
      averageTimeMs: null,
    })
  })

  it('reports Notes grades before and after, for degrees heard', () => {
    const slice = practice()
    // Degree 1 starts with 4 rights: one more makes it rated.
    let one = slice.degreeStats[0]
    for (let i = 0; i < 4; i++) one = recordNotesOutcome(one, true)
    const start = { ...slice, degreeStats: { ...slice.degreeStats, 0: one } }
    const state = play({ mode: 'notes' }, start, 6, right)
    const { ratings } = sessionReport(state)
    if (ratings.kind !== 'grades') throw new Error(ratings.kind)
    const heard = new Set(state.answers.flatMap((a) => a.played))
    expect(ratings.changes.map((c) => c.degree)).toEqual(
      MAJOR.order.filter((d) => heard.has(d)),
    )
    expect(ratings.changes.find((c) => c.degree === 0)).toEqual({
      degree: 0,
      before: null,
      after: 'A',
    })
  })

  it('reports stars in Speed, and no average time', () => {
    // Every degree 4 fast times in: its first answer here rates it.
    const slice = practice(true)
    const degreeStats = { ...slice.degreeStats }
    for (const degree of MAJOR.order) {
      for (let i = 0; i < 4; i++) {
        degreeStats[degree] = recordSpeedTime(degreeStats[degree], 800)
      }
    }
    const state = play({ mode: 'speed' }, { ...slice, degreeStats }, 10, right)
    const report = sessionReport(state)
    expect(report.averageTimeMs).toBeNull()
    if (report.ratings.kind !== 'stars') throw new Error(report.ratings.kind)
    expect(report.ratings.changes.length).toBeGreaterThan(0)
    for (const change of report.ratings.changes) {
      expect(change).toMatchObject({ before: null, after: 'gold' })
    }
  })

  it('reports the melody grade in Melody', () => {
    const state = play({ mode: 'melody' }, practice(true), 5, right)
    expect(sessionReport(state).ratings).toEqual({
      kind: 'melody',
      before: null,
      after: 'A',
    })
  })

  it("ranks this session's confusions, slot by slot, timeouts excluded", () => {
    const state = play({ mode: 'speed' }, practice(true), 6, (p, i) =>
      i < 3 ? [((degreeAt(p[0]!) + 1) % 12) as Degree] : [],
    )
    const report = sessionReport(state)
    const total = report.confusions.reduce((sum, c) => sum + c.count, 0)
    expect(total).toBe(3)
    expect(report.confusions.length).toBeLessThanOrEqual(3)
  })

  it('carries what was newly passed and unlocked', () => {
    const state = play({ mode: 'notes' }, practice(), 12, right)
    const report = sessionReport(state)
    expect(report.newlyPassed).toEqual(state.newlyPassed)
    expect(report.newlyUnlocked).toEqual(state.newlyUnlocked)
    expect(report.newlyPassed.length).toBeGreaterThan(0)
  })
})
