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
  // Melody feedback only: the slot the note sounds for (§6.3).
  slot?: CueSlot
}

// A melody slot, in the player's take or the correct one, lit on the Stage
// while its note sounds.
export interface CueSlot {
  index: number
  take: 'tapped' | 'played'
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
// Melody's two takes, the player's then the correct one, sit this far apart
// (§6.3), so the second isn't heard as more of the first.
export const TAKE_GAP_MS = 1000

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

// The key cue (§3.2): 1, 5 and the octave 1 over a new tonic, so the key is
// heard before the first prompt on it.
export const KEY_CUE_POSITIONS = [0, 7, 12] as const
export const KEY_CUE_STEP_MS = 500
export const KEY_CUE_HOLD_MS = 1000
export const KEY_CUE_GAP_MS = 1000

export function keyCue(): Cue {
  const last = KEY_CUE_POSITIONS.length - 1
  return {
    notes: KEY_CUE_POSITIONS.map((position, i) => ({
      position,
      atMs: i * KEY_CUE_STEP_MS,
      durationMs: i === last ? KEY_CUE_HOLD_MS : KEY_CUE_STEP_MS,
    })),
    lengthMs: last * KEY_CUE_STEP_MS + KEY_CUE_HOLD_MS + KEY_CUE_GAP_MS,
  }
}

export function silentCue(correct: boolean): Cue {
  return { notes: [], lengthMs: correct ? RIGHT_FEEDBACK_MS : SILENT_MISS_MS }
}

// Which parts of the feedback notes play (§6.1, §7.5): the tapped note on a
// miss, the correct note, and the correct note's resolve to the tonic, which
// needs the correct note.
export interface FeedbackParts {
  wrong: boolean
  correct: boolean
  resolve: boolean
}

export const EVERY_PART: FeedbackParts = {
  wrong: true,
  correct: true,
  resolve: true,
}

// An answer in Notes or Speed (§6.1, §6.2): on a miss the tapped note — none
// for a Speed timeout — then the correct note resolving `way`. A right answer
// plays just the correct note resolving. Parts turned off are left out; with
// nothing left it is the silent cue, and a miss never ends sooner than one.
export function noteFeedbackCue(
  played: number,
  tapped: Degree | null,
  way: Resolve = 'closest',
  parts: FeedbackParts = EVERY_PART,
): Cue {
  const right = tapped === degreeAt(played)
  const notes: CueNote[] = []
  let at = 0
  let end = 0
  const note = (position: number, durationMs: number) => {
    notes.push({ position, atMs: at, durationMs })
    end = at + durationMs
  }
  if (parts.wrong && tapped !== null && !right) {
    note(besideOf(played, tapped), FEEDBACK_NOTE_MS)
    at += FEEDBACK_NOTE_MS + TAPPED_PAUSE_MS
  }
  if (parts.correct) {
    const tonic = parts.resolve ? resolveToTonic(played, way) : null
    if (tonic === null) {
      note(played, RESOLVE_HOLD_MS)
    } else {
      note(played, RESOLVE_STEP_MS)
      at += RESOLVE_STEP_MS
      note(tonic, RESOLVE_HOLD_MS)
    }
  }
  if (notes.length === 0) return silentCue(right)
  const lengthMs = end + FEEDBACK_TAIL_MS
  return {
    notes,
    lengthMs: right ? lengthMs : Math.max(lengthMs, SILENT_MISS_MS),
  }
}

// A checked melody (§6.3): on a miss the player's take — each tapped degree
// in the octave of the note it answered — then the correct take, at the
// melody's tempo. A clean melody plays only the correct take. The wrong and
// correct parts keep or drop their take; with neither left it is the silent
// cue, and a miss never ends sooner than one. Melody has no resolve.
export function melodyFeedbackCue(
  played: readonly number[],
  tapped: readonly Degree[],
  tempo: Tempo,
  parts: FeedbackParts = EVERY_PART,
): Cue {
  const right = played.every((position, i) => tapped[i] === degreeAt(position))
  const takes: CueSlot['take'][] = []
  if (parts.wrong && !right) takes.push('tapped')
  if (parts.correct) takes.push('played')
  if (takes.length === 0) return silentCue(right)

  const notes: CueNote[] = []
  let at = 0
  takes.forEach((take, n) => {
    if (n > 0) at += TAKE_GAP_MS
    const positions =
      take === 'played'
        ? played
        : played.map((position, i) =>
            besideOf(position, tapped[i] ?? degreeAt(position)),
          )
    const cue = promptCue(positions, tempo)
    cue.notes.forEach((note, index) => {
      notes.push({ ...note, atMs: at + note.atMs, slot: { index, take } })
    })
    at += cue.lengthMs
  })
  const lengthMs = at + FEEDBACK_TAIL_MS
  return {
    notes,
    lengthMs: right ? lengthMs : Math.max(lengthMs, SILENT_MISS_MS),
  }
}
