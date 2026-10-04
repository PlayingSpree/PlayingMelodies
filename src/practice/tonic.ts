// The tonic (DESIGN.md §3.2): random per session unless locked, and when it
// changes mid-session, always to a different one. Pure TS.

import type { Rng } from './dealer'
import type { PitchClass } from './sessionOptions'

// Tonics sit in one fixed octave, C3–B3, so test notes up to 3 octaves above
// stay in a comfortable range. The audio edge adds positions to this.
export const TONIC_BASE_MIDI = 48

export function tonicMidi(tonic: PitchClass): number {
  return TONIC_BASE_MIDI + tonic
}

// The session's tonic: the lock if set, otherwise any pitch class but
// `previous` (null at the start of a session).
export function pickTonic(
  lock: PitchClass | null,
  previous: PitchClass | null,
  rng: Rng = Math.random,
): PitchClass {
  if (lock !== null) return lock
  const choices = Array.from({ length: 12 }, (_, pc) => pc).filter(
    (pc) => pc !== previous,
  )
  return choices[Math.floor(rng() * choices.length)] ?? 0
}
