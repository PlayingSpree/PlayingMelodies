// The session sheet's options (DESIGN.md §7.2), with the sanitizer that
// coerces whatever was saved into valid values field by field. Pure TS.

import { DEFAULT_MELODY_LENGTH, MELODY_LENGTHS } from './melody'
import { MODES, type Mode } from './progress'

export const PROMPT_COUNTS = [10, 20, 40] as const
export const SESSION_MINUTES = [3, 5, 10] as const

// A session runs for a number of prompts (a melody counts as one) or for
// minutes of active time (§7.2).
export type SessionLength =
  { kind: 'prompts'; count: number } | { kind: 'minutes'; minutes: number }

// The sheet's choice: a fixed length, or Daily — whatever is left of today's
// goal when the session starts (§7.2).
export type LengthChoice =
  | { kind: 'prompts'; count: (typeof PROMPT_COUNTS)[number] }
  | { kind: 'minutes'; minutes: (typeof SESSION_MINUTES)[number] }
  | { kind: 'daily' }

// Change the tonic every X answers; 0 is off (§3.2).
export const TONIC_CHANGE_EVERY = [0, 10, 20, 30] as const
export type TonicChangeEvery = (typeof TONIC_CHANGE_EVERY)[number]

export type Tempo = 'slow' | 'normal' | 'fast'
export const TEMPOS: readonly Tempo[] = ['slow', 'normal', 'fast']

// A tonic's pitch class, 0 = C. Only the tonic lock ever names a pitch;
// everything played is placed against it as degrees (§3.2).
export type PitchClass = number

export function isPitchClass(value: unknown): value is PitchClass {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < 12
  )
}

export interface SessionOptions {
  mode: Mode
  length: LengthChoice
  // Null is a random tonic per session, the default.
  tonicLock: PitchClass | null
  // Ignored while the tonic is locked.
  tonicChangeEvery: TonicChangeEvery
  melodyLength: number
  tempo: Tempo
}

const DEFAULT_LENGTH = {
  kind: 'prompts',
  count: 20,
} as const satisfies LengthChoice

export const DEFAULT_SESSION_OPTIONS: SessionOptions = {
  mode: 'notes',
  length: DEFAULT_LENGTH,
  tonicLock: null,
  tonicChangeEvery: 0,
  melodyLength: DEFAULT_MELODY_LENGTH,
  tempo: 'normal',
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function oneOf<T>(choices: readonly T[], value: unknown, fallback: T): T {
  return choices.find((choice) => choice === value) ?? fallback
}

function asLength(value: unknown): LengthChoice {
  const raw = asRecord(value)
  if (raw.kind === 'prompts') {
    const count = PROMPT_COUNTS.find((choice) => choice === raw.count)
    if (count !== undefined) return { kind: 'prompts', count }
  }
  if (raw.kind === 'minutes') {
    const minutes = SESSION_MINUTES.find((choice) => choice === raw.minutes)
    if (minutes !== undefined) return { kind: 'minutes', minutes }
  }
  if (raw.kind === 'daily') return { kind: 'daily' }
  return DEFAULT_SESSION_OPTIONS.length
}

// The length a session runs for. Daily with the goal already met has nothing
// left to run, so it falls back to the default.
export function resolveLength(
  choice: LengthChoice,
  goalMinutesLeft: number,
): SessionLength {
  if (choice.kind !== 'daily') return choice
  return goalMinutesLeft > 0
    ? { kind: 'minutes', minutes: goalMinutesLeft }
    : DEFAULT_LENGTH
}

// A field that is missing or out of range falls back to its default alone.
export function sanitizeSessionOptions(value: unknown): SessionOptions {
  const raw = asRecord(value)
  const defaults = DEFAULT_SESSION_OPTIONS
  return {
    mode: oneOf(MODES, raw.mode, defaults.mode),
    length: asLength(raw.length),
    tonicLock: isPitchClass(raw.tonicLock) ? raw.tonicLock : null,
    tonicChangeEvery: oneOf(
      TONIC_CHANGE_EVERY,
      raw.tonicChangeEvery,
      defaults.tonicChangeEvery,
    ),
    melodyLength: oneOf(
      MELODY_LENGTHS,
      raw.melodyLength,
      defaults.melodyLength,
    ),
    tempo: oneOf(TEMPOS, raw.tempo, defaults.tempo),
  }
}
