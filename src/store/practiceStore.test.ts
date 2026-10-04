import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CROSSFADE_MS,
  DEFAULT_SESSION_OPTIONS,
  DEFAULT_SETTINGS,
  localDateKey,
  RIGHT_FEEDBACK_MS,
  SETTLE_MS,
  SPEED_LIMIT_MS,
  type Cue,
  type PresetProgress,
  type SessionOptions,
} from '../practice'
import { defaultState } from '../storage'
import { degreeAt, getPreset, type Degree, type PresetId } from '../theory'
import { createPracticeStore } from './practiceStore'
import { memoryStorage, recordingSound } from './testing'

// A seeded generator, so deals vary but runs repeat.
function seeded(seed = 1): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function allPassed(id: PresetId): PresetProgress {
  const { order } = getPreset(id)
  return {
    unlockedCount: order.length,
    passWindows: {},
    passed: [...order],
    melodyOutcomes: [],
  }
}

function setup(progress?: PresetProgress) {
  const storage = memoryStorage()
  if (progress) {
    storage.update((state) => ({
      ...state,
      presetProgress: { major: progress },
    }))
  }
  const sound = recordingSound()
  const store = createPracticeStore({
    storage,
    sound,
    settings: () => DEFAULT_SETTINGS,
    rng: seeded(),
  })
  const start = (options: Partial<SessionOptions> = {}) =>
    store.getState().start('major', { ...DEFAULT_SESSION_OPTIONS, ...options })
  const phase = () => store.getState().session?.phase
  const prompt = () => {
    const current = phase()
    if (current?.kind !== 'answering') throw new Error('no prompt is open')
    return current.prompt
  }
  const answerRight = () => store.getState().tap(degreeAt(prompt()[0]!))
  const answerWrong = () =>
    store.getState().tap(degreeAt(prompt()[0]! + 1) as Degree)
  const callsOf = (method: string) =>
    sound.calls.filter(([name]) => name === method)
  return {
    storage,
    sound,
    store,
    start,
    phase,
    prompt,
    answerRight,
    answerWrong,
    callsOf,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 4, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('practiceStore', () => {
  it('starts the drone, settles, then plays the first prompt', () => {
    const t = setup()
    t.start()
    expect(t.callsOf('startDrone')).toHaveLength(1)
    expect(t.phase()?.kind).toBe('settling')
    expect(t.callsOf('play')).toHaveLength(0)

    vi.advanceTimersByTime(SETTLE_MS)
    expect(t.phase()?.kind).toBe('answering')
    const [, tonicMidi, cue] = t.callsOf('play')[0]!
    const [, droneMidi] = t.callsOf('startDrone')[0]!
    expect(tonicMidi).toBe(droneMidi)
    expect(cue).toMatchObject({ notes: [{ position: t.prompt()[0] }] })
  })

  it('remembers the options it was started with, across reloads', () => {
    const t = setup()
    t.start({ tempo: 'fast' })
    expect(t.store.getState().lastOptions.tempo).toBe('fast')
    expect(t.storage.state.lastOptions.tempo).toBe('fast')

    const reloaded = createPracticeStore({
      storage: t.storage,
      sound: recordingSound(),
      settings: () => DEFAULT_SETTINGS,
    })
    expect(reloaded.getState().lastOptions.tempo).toBe('fast')
  })

  it('a right answer is persisted, then the next prompt follows', () => {
    const t = setup()
    t.start()
    vi.advanceTimersByTime(SETTLE_MS)
    const played = degreeAt(t.prompt()[0]!)
    t.answerRight()

    expect(t.phase()?.kind).toBe('feedback')
    const stored = t.storage.state.degreeStats[played]
    expect(stored?.outcomes).toEqual([true])
    expect(t.store.getState().records.degreeStats[played]).toEqual(stored)
    expect(t.storage.state.presetProgress.major?.passWindows[played]).toEqual([
      true,
    ])

    vi.advanceTimersByTime(RIGHT_FEEDBACK_MS)
    expect(t.phase()?.kind).toBe('answering')
    expect(t.callsOf('play')).toHaveLength(3) // prompt, (silent) right, prompt
  })

  it('a wrong answer plays the feedback cue and logs the confusion', () => {
    const t = setup()
    t.start()
    vi.advanceTimersByTime(SETTLE_MS)
    t.answerWrong()
    expect(t.storage.state.confusions).toHaveLength(1)
    const [, , cue] = t.callsOf('play').at(-1)!
    const { notes, lengthMs } = cue as { notes: unknown[]; lengthMs: number }
    expect(notes.length).toBeGreaterThanOrEqual(2)
    expect(t.callsOf('silence').length).toBeGreaterThan(0)

    vi.advanceTimersByTime(lengthMs - 1)
    expect(t.phase()?.kind).toBe('feedback')
    vi.advanceTimersByTime(1)
    expect(t.phase()?.kind).toBe('answering')
  })

  it('lights each feedback note’s key while it sounds', () => {
    const t = setup()
    t.start()
    vi.advanceTimersByTime(SETTLE_MS)
    const sounding = () => t.store.getState().sounding
    expect(sounding()).toBeNull() // a prompt gives nothing away
    t.answerWrong()
    const [, , cue] = t.callsOf('play').at(-1)!
    const { notes } = cue as Cue

    let elapsed = 0
    for (const note of notes) {
      vi.advanceTimersByTime(note.atMs - elapsed)
      expect(sounding()).toBe(degreeAt(note.position))
      elapsed = note.atMs
    }
    const last = notes.at(-1)!
    vi.advanceTimersByTime(last.durationMs)
    expect(sounding()).toBeNull()
  })

  it('goes dark when the session is quit mid-feedback', () => {
    const t = setup()
    t.start()
    vi.advanceTimersByTime(SETTLE_MS)
    t.answerWrong()
    vi.advanceTimersByTime(0)
    expect(t.store.getState().sounding).not.toBeNull()
    t.store.getState().end()
    expect(t.store.getState().sounding).toBeNull()
    vi.runAllTimers()
    expect(t.store.getState().sounding).toBeNull()
  })

  it('taps outside an open prompt are ignored', () => {
    const t = setup()
    t.start()
    t.store.getState().tap(0)
    expect(t.phase()?.kind).toBe('settling')
    expect(t.storage.state.confusions).toHaveLength(0)
  })

  it('ends at the length, stops the drone and leaves no callbacks', () => {
    const t = setup()
    t.start({ length: { kind: 'prompts', count: 10 } })
    vi.advanceTimersByTime(SETTLE_MS)
    for (let i = 0; i < 10; i++) {
      t.answerRight()
      vi.advanceTimersByTime(RIGHT_FEEDBACK_MS)
    }
    expect(t.phase()?.kind).toBe('done')
    expect(t.store.getState().session?.answers).toHaveLength(10)
    expect(t.callsOf('stopDrone')).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('changes the tonic every X answers: retune, settle, then go on', () => {
    const t = setup()
    t.start({ tonicChangeEvery: 10, length: { kind: 'prompts', count: 20 } })
    vi.advanceTimersByTime(SETTLE_MS)
    for (let i = 0; i < 10; i++) {
      t.answerRight()
      vi.advanceTimersByTime(RIGHT_FEEDBACK_MS)
    }
    expect(t.phase()?.kind).toBe('settling')
    const [, newMidi, fadeMs] = t.callsOf('retuneDrone')[0]!
    expect(fadeMs).toBe(CROSSFADE_MS)
    expect(newMidi).not.toBe(t.callsOf('startDrone')[0]![1])

    vi.advanceTimersByTime(CROSSFADE_MS + SETTLE_MS)
    expect(t.phase()?.kind).toBe('answering')
    expect(t.callsOf('play').at(-1)![1]).toBe(newMidi)
  })

  it('a Speed prompt left unanswered times out as a miss', () => {
    const t = setup(allPassed('major'))
    t.start({ mode: 'speed' })
    vi.advanceTimersByTime(SETTLE_MS)
    const played = degreeAt(t.prompt()[0]!)
    vi.advanceTimersByTime(SPEED_LIMIT_MS)

    const answer = t.store.getState().session?.answers[0]
    expect(answer).toMatchObject({ correct: false, tapped: [], timeMs: null })
    expect(t.storage.state.degreeStats[played]?.speedTimesMs).toEqual([
      SPEED_LIMIT_MS,
    ])
  })

  it('a Speed timeout set for an answered prompt does nothing', () => {
    const t = setup(allPassed('major'))
    t.start({ mode: 'speed' })
    vi.advanceTimersByTime(SETTLE_MS)
    t.answerRight()
    vi.advanceTimersByTime(SPEED_LIMIT_MS)
    expect(t.store.getState().session?.answers).toHaveLength(1)
  })

  it('Melody fills slots, undoes, and grades on the last one', () => {
    const t = setup(allPassed('major'))
    t.start({ mode: 'melody', melodyLength: 3 })
    vi.advanceTimersByTime(SETTLE_MS)
    const melody = t.prompt().map(degreeAt)
    const { tap, undo } = t.store.getState()

    tap(melody[0]!)
    tap(((melody[1]! + 1) % 12) as Degree)
    undo()
    tap(melody[1]!)
    expect(t.phase()?.kind).toBe('answering')
    tap(melody[2]!)

    expect(t.phase()?.kind).toBe('feedback')
    const answer = t.store.getState().session?.answers[0]
    expect(answer).toMatchObject({ correct: true, tapped: melody })
    expect(t.storage.state.presetProgress.major?.melodyOutcomes).toEqual([true])
  })

  it('replay plays the open prompt again', () => {
    const t = setup()
    t.start()
    vi.advanceTimersByTime(SETTLE_MS)
    const before = t.callsOf('play').length
    t.store.getState().replay()
    expect(t.callsOf('play')).toHaveLength(before + 1)
    expect(t.callsOf('play').at(-1)).toEqual(t.callsOf('play').at(-2))
  })

  it('adds active time between taps to today', () => {
    const t = setup()
    t.start()
    vi.advanceTimersByTime(SETTLE_MS)
    vi.advanceTimersByTime(1000)
    t.answerRight() // 3 s after the Start tap
    vi.advanceTimersByTime(RIGHT_FEEDBACK_MS + 2000)
    t.answerRight() // 3 s after the last

    const today = t.storage.state.dailyRecords[localDateKey(new Date())]
    expect(today?.activeMinutes).toBeCloseTo(6000 / 60_000)
    expect(t.store.getState().records.dailyRecords).toEqual(
      t.storage.state.dailyRecords,
    )
  })

  it('quitting keeps the answers for the Report; closing clears it', () => {
    const t = setup()
    t.start()
    vi.advanceTimersByTime(SETTLE_MS)
    t.answerRight()
    t.store.getState().end()

    expect(t.phase()?.kind).toBe('done')
    expect(t.store.getState().session?.answers).toHaveLength(1)
    expect(t.callsOf('stopDrone')).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)

    t.store.getState().close()
    expect(t.store.getState().session).toBeNull()
    expect(t.callsOf('stopDrone')).toHaveLength(1)
  })

  it('closing a running session stops it and cancels its callbacks', () => {
    const t = setup()
    t.start()
    t.store.getState().close()
    expect(t.store.getState().session).toBeNull()
    expect(t.callsOf('stopDrone')).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a new session reads the records the last one left', () => {
    const t = setup()
    t.start()
    vi.advanceTimersByTime(SETTLE_MS)
    const played = degreeAt(t.prompt()[0]!)
    t.answerRight()
    t.store.getState().close()

    t.start()
    const practice = t.store.getState().session?.practice
    expect(practice?.degreeStats[played]?.outcomes).toEqual([true])
    expect(practice?.progress.passWindows[played]).toEqual([true])
  })

  it('resets one preset to fresh, leaving the others and the shared stats', () => {
    const t = setup(allPassed('major'))
    t.storage.update((state) => ({
      ...state,
      presetProgress: { ...state.presetProgress, minor: allPassed('minor') },
    }))
    t.start()
    vi.advanceTimersByTime(SETTLE_MS)
    const played = degreeAt(t.prompt()[0]!)
    t.answerRight()
    t.store.getState().close()

    t.store.getState().resetPreset('major')
    const { records } = t.store.getState()
    expect(records.presetProgress.major).toBeUndefined()
    expect(records.presetProgress.minor).toEqual(allPassed('minor'))
    expect(records.degreeStats[played].outcomes).toEqual([true])
    expect(t.storage.state.presetProgress.major).toBeUndefined()
  })

  it('an import replaces the stored state and the records', () => {
    const t = setup(allPassed('major'))
    const imported = {
      ...defaultState(),
      presetProgress: { combined: allPassed('combined') },
      lastOptions: { ...DEFAULT_SESSION_OPTIONS, mode: 'melody' as const },
    }
    t.store.getState().importState(imported)
    expect(t.storage.state).toEqual(imported)
    expect(t.store.getState().records.presetProgress).toEqual({
      combined: allPassed('combined'),
    })
    expect(t.store.getState().lastOptions.mode).toBe('melody')
  })
})
