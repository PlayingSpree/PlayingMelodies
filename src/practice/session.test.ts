import { describe, expect, it } from 'vitest'
import { degreeAt, getPreset, type Degree } from '../theory'
import { RIGHT_FEEDBACK_MS } from './cues'
import type { Rng } from './dealer'
import type { PracticeSlice } from './grading'
import { freshProgress, type PresetProgress } from './progress'
import {
  advance,
  CROSSFADE_MS,
  endSession,
  replay,
  SETTLE_MS,
  startSession,
  tap,
  timeout,
  undo,
  type SessionEffect,
  type SessionState,
  type SessionStep,
} from './session'
import { DEFAULT_SESSION_OPTIONS, type SessionOptions } from './sessionOptions'
import { emptyStatsMap, SPEED_LIMIT_MS } from './stats'
import { tonicMidi } from './tonic'

const MAJOR = getPreset('major')

// A deterministic stand-in for Math.random (mulberry32).
function seeded(seed: number): Rng {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function practiceWith(progress: Partial<PresetProgress> = {}): PracticeSlice {
  return {
    degreeStats: emptyStatsMap(),
    confusions: [],
    progress: { ...freshProgress(MAJOR), ...progress },
  }
}

// Every Major degree open and passed: Speed and Melody both open.
const ALL_PASSED = practiceWith({
  unlockedCount: MAJOR.order.length,
  passed: [...MAJOR.order],
})

function start(
  options: Partial<SessionOptions> = {},
  practice = practiceWith(),
  seed = 1,
): SessionStep {
  return startSession(
    {
      preset: MAJOR,
      options: { ...DEFAULT_SESSION_OPTIONS, ...options },
      register: 1,
    },
    practice,
    0,
    seeded(seed),
  )
}

// Started and settled: the first prompt is open at `nowMs` SETTLE_MS.
function firstPrompt(
  options: Partial<SessionOptions> = {},
  practice = practiceWith(),
  seed = 1,
): SessionStep {
  return advance(start(options, practice, seed).state, SETTLE_MS, seeded(seed))
}

function prompt(state: SessionState): number[] {
  if (state.phase.kind !== 'answering') throw new Error(state.phase.kind)
  return state.phase.prompt
}

function playedDegree(state: SessionState): Degree {
  return degreeAt(prompt(state)[0] ?? 0)
}

function wrongDegree(state: SessionState): Degree {
  return playedDegree(state) === 0 ? 7 : 0
}

function wakes(effects: readonly SessionEffect[]) {
  return effects.filter((effect) => effect.kind === 'wake')
}

// Answers the open prompt right, then advances past its feedback.
function answerRight(state: SessionState, nowMs: number): SessionStep {
  const answered = tap(state, playedDegree(state), nowMs).state
  return advance(answered, nowMs + RIGHT_FEEDBACK_MS)
}

describe('startSession', () => {
  it('starts the drone and settles before the first prompt', () => {
    const { state, effects } = start()
    expect(state.phase).toEqual({ kind: 'settling' })
    expect(effects).toEqual([
      { kind: 'startDrone', tonicMidi: tonicMidi(state.tonic) },
      { kind: 'wake', call: 'advance', inMs: SETTLE_MS },
    ])
  })

  it('uses a locked tonic', () => {
    expect(start({ tonicLock: 9 }).state.tonic).toBe(9)
  })

  it('refuses a mode that is not open', () => {
    expect(() => start({ mode: 'speed' })).toThrow()
    expect(() => start({ mode: 'melody' })).toThrow()
    expect(() => start({ mode: 'speed' }, ALL_PASSED)).not.toThrow()
  })
})

describe('Notes', () => {
  it('deals the unlocked degrees and plays the prompt', () => {
    const { state, effects } = firstPrompt()
    expect([0, 7]).toContain(playedDegree(state))
    expect(effects).toHaveLength(1)
    expect(effects[0]).toMatchObject({
      kind: 'play',
      tonicMidi: tonicMidi(state.tonic),
    })
  })

  it('grades the first tap, with the time since the prompt', () => {
    const { state } = firstPrompt()
    const step = tap(state, playedDegree(state), SETTLE_MS + 1500)
    expect(step.state.phase.kind).toBe('feedback')
    expect(step.state.answers).toEqual([
      {
        played: [playedDegree(state)],
        tapped: [playedDegree(state)],
        correct: true,
        slots: [true],
        timeMs: 1500,
      },
    ])
    expect(
      step.state.practice.degreeStats[playedDegree(state)].outcomes,
    ).toEqual([true])
    expect(step.effects[0]).toEqual({ kind: 'silence' })
    expect(wakes(step.effects)).toEqual([
      { kind: 'wake', call: 'advance', inMs: RIGHT_FEEDBACK_MS },
    ])
  })

  it('ignores taps during feedback', () => {
    const { state } = firstPrompt()
    const answered = tap(state, wrongDegree(state), 3000).state
    const again = tap(answered, playedDegree(state), 3100)
    expect(again.state.answers).toHaveLength(1)
    expect(again.state.answers[0]?.correct).toBe(false)
    expect(again.effects).toEqual([])
  })

  it('plays tapped, correct and the resolution on a miss', () => {
    const { state } = firstPrompt()
    const step = tap(state, wrongDegree(state), 3000)
    const play = step.effects.find((effect) => effect.kind === 'play')
    expect(play?.kind === 'play' && play.cue.notes.length).toBeGreaterThan(2)
    expect(step.state.practice.confusions).toEqual([
      { played: playedDegree(state), tapped: wrongDegree(state) },
    ])
  })

  it('replays freely without moving the clock', () => {
    const { state } = firstPrompt()
    const replayed = replay(state, 4000)
    expect(replayed.effects.map((effect) => effect.kind)).toEqual([
      'silence',
      'play',
    ])
    const answered = tap(replayed.state, playedDegree(state), 5000)
    expect(answered.state.answers[0]?.timeMs).toBe(5000 - SETTLE_MS)
  })

  it('opens the next degree mid-session and deals it', () => {
    let step = firstPrompt({ length: { kind: 'prompts', count: 40 } })
    let now = SETTLE_MS
    for (let i = 0; i < 30; i++) {
      now += 1000
      step = answerRight(step.state, now)
    }
    // 1 and 5 pass first, which opens 3, which then gets dealt.
    expect(step.state.newlyPassed.slice(0, 2).sort()).toEqual([0, 7])
    expect(step.state.newlyUnlocked[0]).toBe(4)
    const dealt = step.state.answers.flatMap((a) => a.played)
    expect(dealt).toContain(4)
  })
})

describe('session length', () => {
  it('ends after the set number of prompts', () => {
    let step = firstPrompt({ length: { kind: 'prompts', count: 10 } })
    let now = SETTLE_MS
    for (let i = 0; i < 10; i++) {
      now += 1000
      step = answerRight(step.state, now)
    }
    expect(step.state.answers).toHaveLength(10)
    expect(step.state.phase).toEqual({ kind: 'done' })
    expect(step.effects).toEqual([{ kind: 'silence' }, { kind: 'stopDrone' }])
  })

  it('ends at the first prompt boundary past the active minutes', () => {
    let step = firstPrompt({ length: { kind: 'minutes', minutes: 3 } })
    let now = SETTLE_MS
    while (step.state.phase.kind !== 'done') {
      now += 10_000
      step = answerRight(step.state, now)
    }
    expect(step.state.activity.activeMs).toBeGreaterThanOrEqual(180_000)
    expect(step.state.activity.activeMs).toBeLessThan(180_000 + 10_000)
  })

  it('doesn’t count time away toward the minutes', () => {
    const { state } = firstPrompt({ length: { kind: 'minutes', minutes: 3 } })
    const answered = tap(state, playedDegree(state), 600_000).state
    expect(answered.activity.activeMs).toBe(0)
  })

  it('ends early on quit, keeping what was answered', () => {
    const { state } = firstPrompt()
    const answered = tap(state, playedDegree(state), 3000).state
    const ended = endSession(answered)
    expect(ended.state.phase).toEqual({ kind: 'done' })
    expect(ended.state.answers).toHaveLength(1)
    expect(endSession(ended.state).effects).toEqual([])
  })
})

describe('tonic changes', () => {
  it('crossfades to a new tonic every X answers, then settles', () => {
    let step = firstPrompt({ tonicChangeEvery: 10 })
    const first = step.state.tonic
    let now = SETTLE_MS
    for (let i = 0; i < 9; i++) {
      now += 1000
      step = answerRight(step.state, now)
      expect(step.state.phase.kind).toBe('answering')
    }
    now += 1000
    step = answerRight(step.state, now)
    expect(step.state.phase).toEqual({ kind: 'settling' })
    expect(step.state.tonic).not.toBe(first)
    expect(step.effects).toEqual([
      {
        kind: 'retuneDrone',
        tonicMidi: tonicMidi(step.state.tonic),
        fadeMs: CROSSFADE_MS,
      },
      { kind: 'wake', call: 'advance', inMs: CROSSFADE_MS + SETTLE_MS },
    ])
    const resumed = advance(step.state, now + 4000)
    expect(resumed.state.phase.kind).toBe('answering')
    expect(resumed.state.answersOnTonic).toBe(0)
  })

  it('never changes a locked tonic', () => {
    let step = firstPrompt({ tonicChangeEvery: 10, tonicLock: 2 })
    let now = SETTLE_MS
    for (let i = 0; i < 12; i++) {
      now += 1000
      step = answerRight(step.state, now)
    }
    expect(step.state.tonic).toBe(2)
    expect(step.state.phase.kind).toBe('answering')
  })
})

describe('Speed', () => {
  it('deals the whole preset against a deadline', () => {
    const { state, effects } = firstPrompt({ mode: 'speed' }, ALL_PASSED)
    expect(MAJOR.order).toContain(playedDegree(state))
    expect(wakes(effects)).toEqual([
      { kind: 'wake', call: 'timeout', inMs: SPEED_LIMIT_MS, prompt: 0 },
    ])
  })

  it('records the time of a right tap as the star sample', () => {
    const { state } = firstPrompt({ mode: 'speed' }, ALL_PASSED)
    const answered = tap(state, playedDegree(state), SETTLE_MS + 900).state
    expect(
      answered.practice.degreeStats[playedDegree(state)].speedTimesMs,
    ).toEqual([900])
    expect(answered.practice.progress).toEqual(ALL_PASSED.progress)
  })

  it('grades a timeout as a miss', () => {
    const { state } = firstPrompt({ mode: 'speed' }, ALL_PASSED)
    const step = timeout(state, 0)
    expect(step.state.answers[0]).toMatchObject({
      tapped: [],
      correct: false,
      timeMs: null,
    })
    expect(
      step.state.practice.degreeStats[playedDegree(state)].speedTimesMs,
    ).toEqual([SPEED_LIMIT_MS])
  })

  it('ignores a timeout for a prompt already answered', () => {
    const { state } = firstPrompt({ mode: 'speed' }, ALL_PASSED)
    const next = answerRight(state, SETTLE_MS + 500).state
    expect(timeout(next, 0).state).toBe(next)
  })

  it('treats a tap past the deadline as the timeout', () => {
    const { state } = firstPrompt({ mode: 'speed' }, ALL_PASSED)
    const late = tap(
      state,
      playedDegree(state),
      SETTLE_MS + SPEED_LIMIT_MS + 50,
    )
    expect(late.state.answers[0]).toMatchObject({
      correct: false,
      timeMs: null,
    })
  })
})

describe('Melody', () => {
  const options: Partial<SessionOptions> = { mode: 'melody', melodyLength: 3 }

  it('deals a melody of the set length over passed degrees', () => {
    const { state } = firstPrompt(options, ALL_PASSED)
    expect(prompt(state)).toHaveLength(3)
  })

  it('fills slots in order and grades only the last', () => {
    const { state } = firstPrompt(options, ALL_PASSED)
    const melody = prompt(state).map(degreeAt)
    let step = tap(state, melody[0] ?? 0, 3000)
    step = tap(step.state, 6, 3100) // a slip
    expect(step.state.answers).toEqual([])
    step = undo(step.state, 3200)
    step = tap(step.state, melody[1] ?? 0, 3300)
    step = tap(step.state, melody[2] ?? 0, 3400)
    expect(step.state.answers[0]).toMatchObject({
      played: melody,
      tapped: melody,
      correct: true,
      timeMs: 3400 - SETTLE_MS,
    })
    expect(step.state.practice.progress.melodyOutcomes).toEqual([true])
  })

  it('marks wrong slots and logs their confusions', () => {
    const { state } = firstPrompt(options, ALL_PASSED, 3)
    const melody = prompt(state).map(degreeAt)
    const wrong: Degree = melody[1] === 6 ? 1 : 6
    let step = tap(state, melody[0] ?? 0, 3000)
    step = tap(step.state, wrong, 3100)
    step = tap(step.state, melody[2] ?? 0, 3200)
    expect(step.state.answers[0]?.slots).toEqual([true, false, true])
    expect(step.state.practice.confusions).toEqual([
      { played: melody[1], tapped: wrong },
    ])
  })

  it('does nothing on undo with no slots filled', () => {
    const { state } = firstPrompt(options, ALL_PASSED)
    expect(undo(state, 3000).state.phase).toEqual(state.phase)
  })
})

describe('activity', () => {
  it('counts taps, replays and undos', () => {
    const { state } = firstPrompt({ mode: 'melody' }, ALL_PASSED)
    // The Start tap at 0 is the first event.
    let next = replay(state, 3000).state
    next = tap(next, 0, 5000).state
    next = undo(next, 6000).state
    expect(next.activity.activeMs).toBe(6000)
  })
})
