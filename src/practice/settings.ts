// App settings (DESIGN.md §7.5), with the sanitizer that coerces whatever
// was persisted or imported into valid values field by field. Pure TS.

import { isRegisterOctaves, type RegisterOctaves } from '../theory'
import type { Resolve } from './cues'
import { DEFAULT_GOAL_MINUTES } from './daily'

// Which answers the feedback notes play after (§6.1, §7.5): every answer,
// misses and answers on a degree graded below a bar, misses only, or none.
export type FeedbackSound = 'all' | 'below' | 'misses' | 'never'
export const FEEDBACK_SOUNDS: readonly FeedbackSound[] = [
  'all',
  'below',
  'misses',
  'never',
]

// The bars 'below' can be set to.
export type FeedbackBar = 'B' | 'C' | 'D'
export const FEEDBACK_BARS: readonly FeedbackBar[] = ['B', 'C', 'D']

// Which way the correct note resolves (§6.1): a fixed way, switching between
// up and down every few resolves, or up or down at random.
export type ResolveDirection = Resolve | 'alternate' | 'random'
export const RESOLVE_DIRECTIONS: readonly ResolveDirection[] = [
  'closest',
  'up',
  'down',
  'alternate',
  'random',
]

export const MAX_ALTERNATE_EVERY = 10

export interface Settings {
  droneVolume: number // 0–1
  noteVolume: number // 0–1
  register: RegisterOctaves
  goalMinutes: number
  feedbackSound: FeedbackSound
  feedbackBelow: FeedbackBar
  resolveDirection: ResolveDirection
  alternateEvery: number // 1–MAX_ALTERNATE_EVERY resolves
  // Which parts of the feedback notes play (§6.1): the tapped note on a miss,
  // the correct note, and its resolve, which needs the correct note.
  feedbackWrong: boolean
  feedbackCorrect: boolean
  feedbackResolve: boolean
  keyCue: boolean // 1–5–1 when a tonic comes in (§3.2)
}

// What a session needs to know about feedback.
export type FeedbackSettings = Pick<
  Settings,
  | 'feedbackSound'
  | 'feedbackBelow'
  | 'resolveDirection'
  | 'alternateEvery'
  | 'feedbackWrong'
  | 'feedbackCorrect'
  | 'feedbackResolve'
>

export const DEFAULT_SETTINGS: Settings = {
  droneVolume: 0.5,
  noteVolume: 0.8,
  register: 1,
  goalMinutes: DEFAULT_GOAL_MINUTES,
  feedbackSound: 'misses',
  feedbackBelow: 'B',
  resolveDirection: 'closest',
  alternateEvery: 1,
  feedbackWrong: true,
  feedbackCorrect: true,
  feedbackResolve: true,
  keyCue: true,
}

export function feedbackSettings(settings: Settings): FeedbackSettings {
  const {
    feedbackSound,
    feedbackBelow,
    resolveDirection,
    alternateEvery,
    feedbackWrong,
    feedbackCorrect,
    feedbackResolve,
  } = settings
  return {
    feedbackSound,
    feedbackBelow,
    resolveDirection,
    alternateEvery,
    feedbackWrong,
    feedbackCorrect,
    feedbackResolve,
  }
}

export const MAX_GOAL_MINUTES = 240

function asVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && value >= 0 && value <= 1
    ? value
    : fallback
}

function asCount(value: unknown, max: number, fallback: number): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= max
    ? value
    : fallback
}

function asFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asOneOf<T>(choices: readonly T[], value: unknown, fallback: T): T {
  return choices.find((choice) => choice === value) ?? fallback
}

// A field that is missing or out of range falls back to its default alone,
// so one bad value never costs the player their other settings.
export function sanitizeSettings(value: unknown): Settings {
  const raw =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}
  const d = DEFAULT_SETTINGS
  return {
    droneVolume: asVolume(raw.droneVolume, d.droneVolume),
    noteVolume: asVolume(raw.noteVolume, d.noteVolume),
    register: isRegisterOctaves(raw.register) ? raw.register : d.register,
    goalMinutes: asCount(raw.goalMinutes, MAX_GOAL_MINUTES, d.goalMinutes),
    feedbackSound: asOneOf(FEEDBACK_SOUNDS, raw.feedbackSound, d.feedbackSound),
    feedbackBelow: asOneOf(FEEDBACK_BARS, raw.feedbackBelow, d.feedbackBelow),
    resolveDirection: asOneOf(
      RESOLVE_DIRECTIONS,
      raw.resolveDirection,
      d.resolveDirection,
    ),
    alternateEvery: asCount(
      raw.alternateEvery,
      MAX_ALTERNATE_EVERY,
      d.alternateEvery,
    ),
    feedbackWrong: asFlag(raw.feedbackWrong, d.feedbackWrong),
    feedbackCorrect: asFlag(raw.feedbackCorrect, d.feedbackCorrect),
    feedbackResolve: asFlag(raw.feedbackResolve, d.feedbackResolve),
    keyCue: asFlag(raw.keyCue, d.keyCue),
  }
}
