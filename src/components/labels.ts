// How ratings, modes and pitches read on screen (DESIGN.md §5, §7), in one
// place so a grade can't be green on Home and red on the Report.

import type {
  FeedbackSound,
  Grade,
  Mode,
  PitchClass,
  Star,
  Tempo,
} from '../practice'

export const MODE_LABELS: Readonly<Record<Mode, string>> = {
  notes: 'Notes',
  speed: 'Speed',
  melody: 'Melody',
}

export const TEMPO_LABELS: Readonly<Record<Tempo, string>> = {
  slow: 'Slow',
  normal: 'Normal',
  fast: 'Fast',
}

export const FEEDBACK_SOUND_LABELS: Readonly<Record<FeedbackSound, string>> = {
  all: 'Every answer',
  misses: 'Misses only',
  never: 'Never',
}

// The tonic lock is the one place a pitch is named (§3.2); spelled the way
// the common key signatures spell them.
const PITCH_NAMES = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
] as const

export function pitchName(pitch: PitchClass): string {
  return PITCH_NAMES[pitch] ?? '?'
}

// A grade's color: A/B green, C/D neutral, F red; "—" (not yet rated) is
// neutral, since red would be a verdict.
export function gradeText(grade: Grade | null): string {
  switch (grade) {
    case 'A':
    case 'B':
      return 'text-primary-light'
    case 'F':
      return 'text-danger'
    default:
      return 'text-ink-soft'
  }
}

export function gradeLabel(grade: Grade | null): string {
  return grade ?? '—'
}

// Stars are a glyph, deliberately never a letter (§5).
export const STAR_TEXT: Readonly<Record<Star, string>> = {
  gold: 'text-warn',
  silver: 'text-ink-soft',
  bronze: 'text-bronze',
}

export const STAR_NAMES: Readonly<Record<Star, string>> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
}

// Whole minutes read plain, anything else to one decimal.
export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`
}
