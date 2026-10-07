import { describe, expect, it } from 'vitest'
import { degreeAt, getPreset, type Degree } from '../theory'
import { RIGHT_FEEDBACK_MS, SILENT_MISS_MS, type Cue } from './cues'
import type { Rng } from './dealer'
import type { PracticeSlice } from './grading'
import { freshProgress, type PresetProgress } from './progress'
import {
  advance,
  CROSSFADE_MS,
  endSession,
  pause,
  replay,
  resume,
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
import {
  DEFAULT_SETTINGS,
  feedbackSettings,
  type FeedbackSettings,
} from './settings'
import { emptyStatsMap, SPEED_LIMIT_MS, type DegreeStatsMap } from './stats'
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
  feedback: Partial<FeedbackSettings> = {},
): SessionStep {
  return startSession(
    {
      preset: MAJOR,
      options: { ...DEFAULT_SESSION_OPTIONS, ...options },
      register: 1,
      feedback: { ...feedbackSettings(DEFAULT_SETTINGS), ...feedback },
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
  feedback: Partial<FeedbackSettings> = {},
): SessionStep {
  return advance(
    start(options, practice, seed, feedback).state,
    SETTLE_MS,
    seeded(seed),
  )
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

// The feedback cue an answer plays.
function cueOf(step: SessionStep): Cue | undefined {
  const play = step.effects.find((effect) => effect.kind === 'play')
  return play?.kind === 'play' ? play.cue : undefined
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

describe('feedback notes setting', () => {
  const melody: Partial<SessionOptions> = { mode: 'melody', melodyLength: 3 }

  // Answers the open melody prompt, every slot right or every slot wrong.
  function answerMelody(state: SessionState, right: boolean): SessionStep {
    let step: SessionStep = { state, effects: [] }
    for (const position of prompt(state)) {
      const degree = degreeAt(position)
      step = tap(step.state, right ? degree : degree === 6 ? 1 : 6, 3000)
    }
    return step
  }

  it('plays the correct note resolving after a right answer on every answer', () => {
    const { state } = firstPrompt({}, practiceWith(), 1, {
      feedbackSound: 'all',
    })
    const step = tap(state, playedDegree(state), 3000)
    expect(cueOf(step)?.notes[0]?.position).toBe(prompt(state)[0])
    expect(wakes(step.effects)).toEqual([
      { kind: 'wake', call: 'advance', inMs: cueOf(step)?.lengthMs },
    ])
  })

  it('replays a clean melody on every answer, but not on misses only', () => {
    const all = firstPrompt(melody, ALL_PASSED, 1, {
      feedbackSound: 'all',
    }).state
    expect(cueOf(answerMelody(all, true))?.notes).toHaveLength(3)
    const misses = firstPrompt(melody, ALL_PASSED, 1, {
      feedbackSound: 'misses',
    }).state
    expect(cueOf(answerMelody(misses, true))).toEqual({
      notes: [],
      lengthMs: RIGHT_FEEDBACK_MS,
    })
    expect(cueOf(answerMelody(misses, false))?.notes.length).toBeGreaterThan(3)
  })

  it('plays nothing on never, and holds a miss longer', () => {
    const { state } = firstPrompt({}, practiceWith(), 1, {
      feedbackSound: 'never',
    })
    expect(cueOf(tap(state, playedDegree(state), 3000))).toEqual({
      notes: [],
      lengthMs: RIGHT_FEEDBACK_MS,
    })
    expect(cueOf(tap(state, wrongDegree(state), 3000))).toEqual({
      notes: [],
      lengthMs: SILENT_MISS_MS,
    })
    const tune = firstPrompt(melody, ALL_PASSED, 1, {
      feedbackSound: 'never',
    }).state
    expect(cueOf(answerMelody(tune, false))).toEqual({
      notes: [],
      lengthMs: SILENT_MISS_MS,
    })
  })
})

// Every degree's Notes window at `right` out of 10.
function statsAt(right: number): DegreeStatsMap {
  const outcomes = Array.from({ length: 10 }, (_, i) => i < right)
  const stats = { ...emptyStatsMap() }
  for (const degree of Object.keys(stats)) {
    stats[Number(degree) as Degree] = { outcomes, speedTimesMs: [] }
  }
  return stats
}

describe('feedback notes below a grade', () => {
  const below = { feedbackSound: 'below' } as const

  function rightCue(
    practice: PracticeSlice,
    feedback: Partial<FeedbackSettings>,
  ): Cue | undefined {
    const { state } = firstPrompt({}, practice, 1, { ...below, ...feedback })
    return cueOf(tap(state, playedDegree(state), 3000))
  }

  it('plays on a right answer to a degree graded below the bar', () => {
    const c = { ...practiceWith(), degreeStats: statsAt(7) }
    expect(rightCue(c, { feedbackBelow: 'B' })?.notes).not.toHaveLength(0)
    expect(rightCue(c, { feedbackBelow: 'C' })?.notes).toHaveLength(0)
  })

  it('plays for an ungraded degree, not for one at the bar', () => {
    expect(rightCue(practiceWith(), {})?.notes).not.toHaveLength(0)
    const b = { ...practiceWith(), degreeStats: statsAt(8) }
    expect(rightCue(b, {})?.notes).toHaveLength(0)
  })

  it('always plays on a miss', () => {
    const a = { ...practiceWith(), degreeStats: statsAt(10) }
    const { state } = firstPrompt({}, a, 1, below)
    expect(cueOf(tap(state, wrongDegree(state), 3000))?.notes).not.toHaveLength(
      0,
    )
  })

  it('reads the melody grade in Melody', () => {
    const melody = { mode: 'melody', melodyLength: 1 } as const
    const clean = (right: number) => ({
      ...ALL_PASSED,
      progress: {
        ...ALL_PASSED.progress,
        melodyOutcomes: Array.from({ length: 10 }, (_, i) => i < right),
      },
    })
    for (const [right, notes] of [
      [10, 0],
      [7, 1],
    ] as const) {
      const { state } = firstPrompt(melody, clean(right), 1, below)
      expect(cueOf(tap(state, playedDegree(state), 3000))?.notes).toHaveLength(
        notes,
      )
    }
  })
})

describe('resolve direction', () => {
  const all = { feedbackSound: 'all' } as const

  // The way each answer's feedback resolved, over `count` right answers;
  // null where the played note was the tonic.
  function ways(
    feedback: Partial<FeedbackSettings>,
    count: number,
    rng?: Rng,
  ): ('up' | 'down' | null)[] {
    let step = firstPrompt({}, practiceWith(), 1, { ...all, ...feedback })
    const result: ('up' | 'down' | null)[] = []
    let t = 3000
    for (let i = 0; i < count; i++) {
      const played = prompt(step.state)[0] ?? 0
      const answered = tap(step.state, degreeAt(played), t, rng)
      const notes = cueOf(answered)?.notes ?? []
      const last = notes.at(-1)?.position ?? played
      result.push(notes.length < 2 ? null : last > played ? 'up' : 'down')
      t += 10_000
      step = advance(answered.state, t, seeded(i))
      t += SETTLE_MS * 3
      if (step.state.phase.kind === 'settling') {
        step = advance(step.state, t)
      }
    }
    return result
  }

  it('goes the set way', () => {
    const up = ways({ resolveDirection: 'up' }, 8)
    expect(up).toContain('up')
    expect(up).not.toContain('down')
    const down = ways({ resolveDirection: 'down' }, 8)
    expect(down).toContain('down')
    expect(down).not.toContain('up')
  })

  it('alternates every few resolves, skipping the tonic', () => {
    const resolved = ways(
      { resolveDirection: 'alternate', alternateEvery: 2 },
      12,
    ).filter((way) => way !== null)
    expect(resolved.length).toBeGreaterThan(4)
    resolved.forEach((way, i) => {
      expect(way).toBe(Math.floor(i / 2) % 2 === 0 ? 'up' : 'down')
    })
  })

  it('picks up or down at random', () => {
    const random = { resolveDirection: 'random' } as const
    expect(ways(random, 6, () => 0.2)).toContain('up')
    expect(ways(random, 6, () => 0.2)).not.toContain('down')
    expect(ways(random, 6, () => 0.8)).toContain('down')
    expect(ways(random, 6, () => 0.8)).not.toContain('up')
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

describe('pausing', () => {
  it('stops the notes and the drone, and ignores waits while paused', () => {
    const { state } = firstPrompt({ mode: 'speed' }, ALL_PASSED)
    const paused = pause(state)
    expect(paused.state.phase).toEqual({ kind: 'paused', from: state.phase })
    expect(paused.effects).toEqual([{ kind: 'silence' }, { kind: 'stopDrone' }])
    expect(timeout(paused.state, 0).state).toBe(paused.state)
    expect(advance(paused.state, 9000).state).toBe(paused.state)
    expect(tap(paused.state, playedDegree(state), 9000).state.answers).toEqual(
      [],
    )
    expect(pause(paused.state).state).toBe(paused.state)
  })

  it('resumes into a settle, then plays the held prompt with a fresh limit', () => {
    const { state } = firstPrompt({ mode: 'speed' }, ALL_PASSED)
    const resumed = resume(pause(state).state, 60_000)
    expect(resumed.effects).toEqual([
      { kind: 'startDrone', tonicMidi: tonicMidi(state.tonic) },
      { kind: 'wake', call: 'advance', inMs: SETTLE_MS },
    ])
    expect(resumed.state.phase.kind).toBe('settling')

    const now = 60_000 + SETTLE_MS
    const reopened = advance(resumed.state, now)
    expect(reopened.state.phase).toEqual({
      kind: 'answering',
      prompt: prompt(state),
      startedMs: now,
      deadlineMs: now + SPEED_LIMIT_MS,
      slots: [],
    })
    expect(cueOf(reopened)?.notes).toMatchObject([
      { position: prompt(state)[0] },
    ])
    expect(wakes(reopened.effects)).toEqual([
      { kind: 'wake', call: 'timeout', inMs: SPEED_LIMIT_MS, prompt: 0 },
    ])
    const answered = tap(reopened.state, playedDegree(state), now + 700)
    expect(answered.state.answers[0]).toMatchObject({
      correct: true,
      timeMs: 700,
    })
  })

  it("keeps Melody's filled slots", () => {
    const { state } = firstPrompt(
      { mode: 'melody', melodyLength: 3 },
      ALL_PASSED,
    )
    const first = degreeAt(prompt(state)[0] ?? 0)
    const filled = tap(state, first, 3000).state
    let step = resume(pause(filled).state, 9000)
    // Paused again during the settle: the prompt is still held.
    step = resume(pause(step.state).state, 12_000)
    step = advance(step.state, 12_000 + SETTLE_MS)
    expect(step.state.phase).toMatchObject({
      kind: 'answering',
      prompt: prompt(state),
      slots: [first],
    })
  })

  it('moves past feedback the pause cut off', () => {
    const { state } = firstPrompt()
    const answered = tap(state, playedDegree(state), 3000).state
    const resumed = resume(pause(answered).state, 9000)
    expect(resumed.state.phase).toEqual({ kind: 'settling' })
    expect(resumed.state.answers).toHaveLength(1)
    const next = advance(resumed.state, 9000 + SETTLE_MS)
    expect(next.state.phase.kind).toBe('answering')
    expect(next.state.answers).toHaveLength(1)
  })

  it('changes the tonic on resume when one was due', () => {
    let step = firstPrompt({ tonicChangeEvery: 10 })
    const first = step.state.tonic
    let now = SETTLE_MS
    for (let i = 0; i < 9; i++) {
      now += 1000
      step = answerRight(step.state, now)
    }
    now += 1000
    const answered = tap(step.state, playedDegree(step.state), now).state
    const resumed = resume(pause(answered).state, now + 5000)
    expect(resumed.state.tonic).not.toBe(first)
    expect(resumed.state.answersOnTonic).toBe(0)
    expect(resumed.effects[0]).toEqual({
      kind: 'startDrone',
      tonicMidi: tonicMidi(resumed.state.tonic),
    })
  })

  it('goes to the Report when the last answer was given', () => {
    let step = firstPrompt({ length: { kind: 'prompts', count: 10 } })
    let now = SETTLE_MS
    for (let i = 0; i < 9; i++) {
      now += 1000
      step = answerRight(step.state, now)
    }
    const answered = tap(step.state, playedDegree(step.state), now + 1000)
    expect(resume(pause(answered.state).state, now + 9000).state.phase).toEqual(
      { kind: 'done' },
    )
  })

  it('lets the player quit while paused', () => {
    const { state } = firstPrompt()
    expect(endSession(pause(state).state).state.phase).toEqual({
      kind: 'done',
    })
  })

  it('counts the Resume tap as activity, but not the pause', () => {
    const { state } = firstPrompt()
    const paused = pause(state).state
    expect(paused.activity).toEqual(state.activity)
    // The Start tap at 0, Resume 4 s later.
    expect(resume(paused, 4000).state.activity.activeMs).toBe(4000)
  })
})
