// What a session plays, as data (DESIGN.md §6): the prompt and the feedback
// after an answer, each a list of notes at offsets plus how long the cue runs
// before the session moves on. Notes are register positions (semitones above
// the tonic, §3.3); the audio edge adds the tonic's pitch. Pure TS.

import { degreeAt, type Degree } from '../theory'
import type { Tempo } from './sessionOptions'

export interface CueNote {
  position: number
  atMs: number // from the start of the cue
  durationMs: number
}

export interface Cue {
  notes: CueNote[]
  // When the cue is over, trailing pause included: the session waits this
  // long before it advances.
  lengthMs: number
}

export const PROMPT_NOTE_MS = 1200

// Feedback with no notes (§6.1, §7.5): a short confirmation on a right
// answer; a miss stays longer, so the correct key can be found on the pad.
export const RIGHT_FEEDBACK_MS = 1000
export const SILENT_MISS_MS = 2000

// With notes: the tapped note on a miss, a silent pause so it doesn't run
// into the answer, then the correct note resolving to the tonic, which it
// holds (§6.1).
export const FEEDBACK_NOTE_MS = 900
export const TAPPED_PAUSE_MS = 700
export const RESOLVE_STEP_MS = 900
export const RESOLVE_HOLD_MS = 1500
export const FEEDBACK_TAIL_MS = 800
// Melody's tapped-versus-correct pairs start this far apart (§6.3).
export const FEEDBACK_STEP_MS = 1000

// Melody notes are evenly spaced (§6.3); each sounds for most of its step.
export const TEMPO_STEP_MS: Readonly<Record<Tempo, number>> = {
  slow: 800,
  normal: 600,
  fast: 450,
}
const MELODY_NOTE_SHARE = 0.9

// Which tonic a note resolves to (§6.1): the nearest one, or always the one
// above or below it.
export type Resolve = 'closest' | 'up' | 'down'

// Where a position resolves: straight to a tonic in its own octave. Closest
// lets ♭2–4 fall and ♯4–7 rise (♯4, a tritone either way, rises). Null for
// the tonic itself.
export function resolveToTonic(
  position: number,
  way: Resolve = 'closest',
): number | null {
  const degree = degreeAt(position)
  if (degree === 0) return null
  const rises = way === 'closest' ? degree >= 6 : way === 'up'
  return rises ? position + (12 - degree) : position - degree
}

// A degree placed in the same octave as `position`, for tapped-versus-correct.
export function besideOf(position: number, degree: Degree): number {
  return position - degreeAt(position) + degree
}

export function promptCue(positions: readonly number[], tempo: Tempo): Cue {
  if (positions.length === 1) {
    const position = positions[0] ?? 0
    return {
      notes: [{ position, atMs: 0, durationMs: PROMPT_NOTE_MS }],
      lengthMs: PROMPT_NOTE_MS,
    }
  }
  const step = TEMPO_STEP_MS[tempo]
  return {
    notes: positions.map((position, i) => ({
      position,
      atMs: i * step,
      durationMs: step * MELODY_NOTE_SHARE,
    })),
    lengthMs: positions.length * step,
  }
}

export function silentCue(correct: boolean): Cue {
  return { notes: [], lengthMs: correct ? RIGHT_FEEDBACK_MS : SILENT_MISS_MS }
}

// An answer in Notes or Speed (§6.1, §6.2): on a miss the tapped note — none
// for a Speed timeout — then the correct note resolving `way`. A right answer
// plays just the correct note resolving.
export function noteFeedbackCue(
  played: number,
  tapped: Degree | null,
  way: Resolve = 'closest',
): Cue {
  const notes: CueNote[] = []
  let at = 0
  const note = (position: number, durationMs: number) =>
    notes.push({ position, atMs: at, durationMs })
  if (tapped !== null && tapped !== degreeAt(played)) {
    note(besideOf(played, tapped), FEEDBACK_NOTE_MS)
    at += FEEDBACK_NOTE_MS + TAPPED_PAUSE_MS
  }
  const tonic = resolveToTonic(played, way)
  if (tonic === null) {
    note(played, RESOLVE_HOLD_MS)
  } else {
    note(played, RESOLVE_STEP_MS)
    at += RESOLVE_STEP_MS
    note(tonic, RESOLVE_HOLD_MS)
  }
  return { notes, lengthMs: at + RESOLVE_HOLD_MS + FEEDBACK_TAIL_MS }
}

// A checked melody (§6.3): it replays as played, then each wrong slot plays
// tapped-versus-correct.
export function melodyFeedbackCue(
  played: readonly number[],
  tapped: readonly Degree[],
  tempo: Tempo,
): Cue {
  const replay = promptCue(played, tempo)
  const notes = [...replay.notes]
  let at = replay.lengthMs
  played.forEach((position, i) => {
    const answer = tapped[i]
    if (answer === undefined || answer === degreeAt(position)) return
    at += FEEDBACK_STEP_MS
    notes.push({
      position: besideOf(position, answer),
      atMs: at,
      durationMs: FEEDBACK_NOTE_MS,
    })
    at += FEEDBACK_NOTE_MS + TAPPED_PAUSE_MS
    notes.push({ position, atMs: at, durationMs: FEEDBACK_NOTE_MS })
  })
  return { notes, lengthMs: at + FEEDBACK_STEP_MS + FEEDBACK_TAIL_MS }
}
