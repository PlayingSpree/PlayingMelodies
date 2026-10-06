// The session runner (DESIGN.md §3.2, §6): one session as a state machine,
// from Start to the Report. Pure TS with no timers and no audio — every step
// takes the time it happens at and returns the next state plus the effects
// the edge carries out: drone changes, cues to play, and when to call back
// (`advance` after a wait, `timeout` at a Speed deadline). A stale callback
// is harmless: each step checks it still applies — a timeout by the index of
// the prompt it was set for, so it never depends on the edge's timer firing
// exactly on time.
//
//   settling ──advance──▶ answering ──tap / timeout──▶ feedback
//      ▲                                                   │
//      └─────── advance (tonic change) ◀──────advance──────┤
//                       answering ◀──advance (next prompt)─┤
//                            done ◀──advance (length met)──┘

import { degreeAt, type Degree, type Preset } from '../theory'
import type { RegisterOctaves } from '../theory'
import { IDLE_CLOCK, touchActivity, type ActivityClock } from './activeTime'
import {
  melodyFeedbackCue,
  noteFeedbackCue,
  promptCue,
  resolveToTonic,
  silentCue,
  type Cue,
  type Resolve,
} from './cues'
import { dealDegree, placeDegree, type Rng } from './dealer'
import { gradeAnswer, type Answer, type PracticeSlice } from './grading'
import { generateMelody } from './melody'
import { dealableDegrees, isModeOpen, melodyGrade } from './progress'
import type { PitchClass, SessionOptions } from './sessionOptions'
import type { FeedbackSettings } from './settings'
import { gradeBelow, SPEED_LIMIT_MS, windowGrade } from './stats'
import { pickTonic, tonicMidi } from './tonic'

// After the drone starts or retunes, a pause before the next prompt, so the
// first note on a tonic is heard against it and not the old one (§3.2).
export const SETTLE_MS = 2000
export const CROSSFADE_MS = 2000

export interface SessionSetup {
  preset: Preset
  options: SessionOptions
  register: RegisterOctaves
  feedback: FeedbackSettings
}

// One graded prompt, for the Report.
export interface SessionAnswer {
  played: Degree[] // one outside Melody
  tapped: Degree[] // empty for a Speed timeout
  correct: boolean
  slots: boolean[]
  // From the prompt's first note to the deciding tap — the last slot, in
  // Melody. Null for a Speed timeout.
  timeMs: number | null
}

export type SessionPhase =
  | { kind: 'settling' }
  | {
      kind: 'answering'
      prompt: number[] // positions; one outside Melody
      startedMs: number
      deadlineMs: number | null // Speed only
      slots: Degree[] // Melody's filled slots so far
    }
  | { kind: 'feedback'; prompt: number[]; answer: SessionAnswer }
  | { kind: 'done' }

export interface SessionState {
  setup: SessionSetup
  // The player's records, live: an unlock mid-session changes what Notes
  // deals next. The edge persists this after every answer.
  practice: PracticeSlice
  // The records as they stood at Start, for the Report's deltas (§7.4).
  startPractice: PracticeSlice
  tonic: PitchClass
  answersOnTonic: number
  phase: SessionPhase
  answers: SessionAnswer[]
  newlyPassed: Degree[]
  newlyUnlocked: Degree[]
  activity: ActivityClock
  // Feedback cues so far that resolved to a tonic, for 'alternate' (§6.1).
  resolves: number
}

export type SessionEffect =
  | { kind: 'startDrone'; tonicMidi: number }
  | { kind: 'retuneDrone'; tonicMidi: number; fadeMs: number }
  | { kind: 'stopDrone' }
  // Cut any test notes still sounding, before something else plays.
  | { kind: 'silence' }
  | { kind: 'play'; tonicMidi: number; cue: Cue }
  | { kind: 'wake'; call: 'advance'; inMs: number }
  // Call `timeout` with this prompt index (the answers before it).
  | { kind: 'wake'; call: 'timeout'; inMs: number; prompt: number }

export interface SessionStep {
  state: SessionState
  effects: SessionEffect[]
}

function still(state: SessionState): SessionStep {
  return { state, effects: [] }
}

export function startSession(
  setup: SessionSetup,
  practice: PracticeSlice,
  nowMs: number,
  rng: Rng = Math.random,
): SessionStep {
  const { preset, options } = setup
  if (!isModeOpen(preset, practice.progress, options.mode)) {
    throw new Error(`${options.mode} is not open in ${preset.name}`)
  }
  const tonic = pickTonic(options.tonicLock, null, rng)
  return {
    state: {
      setup,
      practice,
      startPractice: practice,
      tonic,
      answersOnTonic: 0,
      phase: { kind: 'settling' },
      answers: [],
      newlyPassed: [],
      newlyUnlocked: [],
      // The Start tap is the first interaction.
      activity: touchActivity(IDLE_CLOCK, nowMs),
      resolves: 0,
    },
    effects: [
      { kind: 'startDrone', tonicMidi: tonicMidi(tonic) },
      { kind: 'wake', call: 'advance', inMs: SETTLE_MS },
    ],
  }
}

function lengthMet(state: SessionState): boolean {
  const { length } = state.setup.options
  return length.kind === 'prompts'
    ? state.answers.length >= length.count
    : state.activity.activeMs >= length.minutes * 60_000
}

function tonicChangeDue(state: SessionState): boolean {
  const { tonicLock, tonicChangeEvery } = state.setup.options
  return (
    tonicLock === null &&
    tonicChangeEvery > 0 &&
    state.answersOnTonic >= tonicChangeEvery
  )
}

function dealPrompt(state: SessionState, rng: Rng): number[] {
  const { preset, options, register } = state.setup
  const { practice } = state
  const pool = dealableDegrees(preset, practice.progress, options.mode)
  if (options.mode === 'melody') {
    return generateMelody(pool, options.melodyLength, register, rng)
  }
  const recent = state.answers.flatMap((answer) => answer.played)
  const degree = dealDegree(
    pool,
    recent,
    practice.degreeStats,
    practice.confusions,
    rng,
  )
  return [placeDegree(degree, register, rng)]
}

function play(state: SessionState, cue: Cue): SessionEffect {
  return { kind: 'play', tonicMidi: tonicMidi(state.tonic), cue }
}

function nextPrompt(state: SessionState, nowMs: number, rng: Rng): SessionStep {
  const prompt = dealPrompt(state, rng)
  const speed = state.setup.options.mode === 'speed'
  const next: SessionState = {
    ...state,
    phase: {
      kind: 'answering',
      prompt,
      startedMs: nowMs,
      deadlineMs: speed ? nowMs + SPEED_LIMIT_MS : null,
      slots: [],
    },
  }
  const effects: SessionEffect[] = [
    play(next, promptCue(prompt, state.setup.options.tempo)),
  ]
  if (speed) {
    effects.push({
      kind: 'wake',
      call: 'timeout',
      inMs: SPEED_LIMIT_MS,
      prompt: state.answers.length,
    })
  }
  return { state: next, effects }
}

function finish(state: SessionState): SessionStep {
  return {
    state: { ...state, phase: { kind: 'done' } },
    effects: [{ kind: 'silence' }, { kind: 'stopDrone' }],
  }
}

// Called when a wait ends: the settle pause, or a feedback cue.
export function advance(
  state: SessionState,
  nowMs: number,
  rng: Rng = Math.random,
): SessionStep {
  switch (state.phase.kind) {
    case 'settling':
      return nextPrompt(state, nowMs, rng)
    case 'feedback': {
      if (lengthMet(state)) return finish(state)
      if (!tonicChangeDue(state)) return nextPrompt(state, nowMs, rng)
      const tonic = pickTonic(null, state.tonic, rng)
      return {
        state: {
          ...state,
          tonic,
          answersOnTonic: 0,
          phase: { kind: 'settling' },
        },
        effects: [
          {
            kind: 'retuneDrone',
            tonicMidi: tonicMidi(tonic),
            fadeMs: CROSSFADE_MS,
          },
          { kind: 'wake', call: 'advance', inMs: CROSSFADE_MS + SETTLE_MS },
        ],
      }
    }
    default:
      return still(state)
  }
}

// Whether an answer plays feedback notes (§6.1, §7.5). 'below' reads the
// grade as it stood before this answer: the degree's Notes grade — Speed's
// too, since stars rate speed, not knowing — or in Melody the preset's
// melody grade.
function playsFeedback(state: SessionState, correct: boolean): boolean {
  const { feedbackSound, feedbackBelow } = state.setup.feedback
  switch (feedbackSound) {
    case 'all':
      return true
    case 'never':
      return false
    case 'misses':
      return !correct
    case 'below': {
      if (!correct || state.phase.kind !== 'answering') return true
      const { practice } = state
      const grade =
        state.setup.options.mode === 'melody'
          ? melodyGrade(practice.progress)
          : windowGrade(
              practice.degreeStats[degreeAt(state.phase.prompt[0] ?? 0)]
                .outcomes,
            )
      return gradeBelow(grade, feedbackBelow)
    }
  }
}

// Which way the next resolve goes: 'alternate' starts each session up and
// switches every `alternateEvery` resolves.
function resolveWay(state: SessionState, rng: Rng): Resolve {
  const { resolveDirection, alternateEvery } = state.setup.feedback
  switch (resolveDirection) {
    case 'alternate':
      return Math.floor(state.resolves / alternateEvery) % 2 === 0
        ? 'up'
        : 'down'
    case 'random':
      return rng() < 0.5 ? 'up' : 'down'
    default:
      return resolveDirection
  }
}

// Grades the answering phase's prompt. `tapped` is every tap that answers
// it: one in Notes and Speed (none for a timeout), every slot in Melody.
function grade(
  state: SessionState,
  tapped: Degree[],
  nowMs: number,
  timedOut: boolean,
  rng: Rng,
): SessionStep {
  if (state.phase.kind !== 'answering') return still(state)
  const { prompt, startedMs } = state.phase
  const { preset, options } = state.setup
  const played = prompt[0] ?? 0
  const timeMs = timedOut ? null : nowMs - startedMs

  let answer: Answer
  switch (options.mode) {
    case 'notes':
      answer = { mode: 'notes', played, tapped: tapped[0] ?? 0 }
      break
    case 'speed':
      answer = { mode: 'speed', played, tapped: tapped[0] ?? null, timeMs }
      break
    case 'melody':
      answer = { mode: 'melody', played: prompt, tapped }
      break
  }
  const result = gradeAnswer(preset, state.practice, answer)

  const graded: SessionAnswer = {
    played: prompt.map(degreeAt),
    tapped,
    correct: result.correct,
    slots: result.slots,
    timeMs,
  }
  const sounds = playsFeedback(state, result.correct)
  // Melody's feedback replays the melody and has no resolve (§6.3).
  const resolves =
    sounds && options.mode !== 'melody' && resolveToTonic(played) !== null
  const cue = !sounds
    ? silentCue(result.correct)
    : options.mode === 'melody'
      ? melodyFeedbackCue(prompt, tapped, options.tempo)
      : noteFeedbackCue(
          played,
          tapped[0] ?? null,
          resolves ? resolveWay(state, rng) : 'closest',
        )

  const next: SessionState = {
    ...state,
    practice: result.practice,
    answersOnTonic: state.answersOnTonic + 1,
    phase: { kind: 'feedback', prompt, answer: graded },
    answers: [...state.answers, graded],
    newlyPassed:
      result.newlyPassed === null
        ? state.newlyPassed
        : [...state.newlyPassed, result.newlyPassed],
    newlyUnlocked: [...state.newlyUnlocked, ...result.newlyUnlocked],
    resolves: state.resolves + (resolves ? 1 : 0),
  }
  return {
    state: next,
    effects: [
      { kind: 'silence' },
      play(next, cue),
      { kind: 'wake', call: 'advance', inMs: cue.lengthMs },
    ],
  }
}

// A tap on the pad. Only the first tap on a prompt is graded (§6.1); in
// Melody each tap fills the next slot and the last one grades (§6.3). Taps
// at any other time are ignored, but still count as activity.
export function tap(
  state: SessionState,
  degree: Degree,
  nowMs: number,
  rng: Rng = Math.random,
): SessionStep {
  const touched = { ...state, activity: touchActivity(state.activity, nowMs) }
  const { phase } = touched
  if (phase.kind !== 'answering') return still(touched)
  if (phase.deadlineMs !== null && nowMs >= phase.deadlineMs) {
    // A tap racing a late timeout callback loses: the time was up.
    return grade(touched, [], phase.deadlineMs, true, rng)
  }
  if (touched.setup.options.mode !== 'melody') {
    return grade(touched, [degree], nowMs, false, rng)
  }
  const slots = [...phase.slots, degree]
  if (slots.length < phase.prompt.length) {
    return still({ ...touched, phase: { ...phase, slots } })
  }
  return grade(touched, slots, nowMs, false, rng)
}

// Melody's undo key: empties the last filled slot.
export function undo(state: SessionState, nowMs: number): SessionStep {
  const touched = { ...state, activity: touchActivity(state.activity, nowMs) }
  const { phase } = touched
  if (phase.kind !== 'answering' || phase.slots.length === 0) {
    return still(touched)
  }
  return still({
    ...touched,
    phase: { ...phase, slots: phase.slots.slice(0, -1) },
  })
}

// Replay is free while a prompt is open (§6.1, §6.3). It never moves the
// response clock or the Speed deadline.
export function replay(state: SessionState, nowMs: number): SessionStep {
  const touched = { ...state, activity: touchActivity(state.activity, nowMs) }
  const { phase } = touched
  if (phase.kind !== 'answering') return still(touched)
  return {
    state: touched,
    effects: [
      { kind: 'silence' },
      play(touched, promptCue(phase.prompt, touched.setup.options.tempo)),
    ],
  }
}

// Speed's limit ran out on prompt index `prompt` (§6.2): a miss. A callback
// for a prompt already answered does nothing.
export function timeout(
  state: SessionState,
  prompt: number,
  rng: Rng = Math.random,
): SessionStep {
  const { phase } = state
  if (
    phase.kind !== 'answering' ||
    phase.deadlineMs === null ||
    state.answers.length !== prompt
  ) {
    return still(state)
  }
  return grade(state, [], phase.deadlineMs, true, rng)
}

// The player quits. Whatever was answered stands and goes to the Report.
export function endSession(state: SessionState): SessionStep {
  return state.phase.kind === 'done' ? still(state) : finish(state)
}
