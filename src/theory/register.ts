// Register (DESIGN.md §3.3): which octaves above the tonic test notes play in.
// Notes are placed as a *position* — semitones above the tonic, 0 up to (but
// not including) 12 × octaves — and the audio edge adds the tonic's pitch.
// The register never reaches a degree's identity: position mod 12 is the
// degree, and stats ignore the octave.

import type { Degree } from './degrees'

export type RegisterOctaves = 1 | 2 | 3

export const REGISTER_OCTAVES: readonly RegisterOctaves[] = [1, 2, 3]

export function isRegisterOctaves(value: unknown): value is RegisterOctaves {
  return value === 1 || value === 2 || value === 3
}

export function degreeAt(position: number): Degree {
  return (((position % 12) + 12) % 12) as Degree
}

// Every position a degree can be played at within the register, low first.
export function positionsOf(
  degree: Degree,
  octaves: RegisterOctaves,
): number[] {
  return Array.from({ length: octaves }, (_, octave) => degree + 12 * octave)
}
