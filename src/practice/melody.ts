// Melody generation and checking (DESIGN.md §6.3). Melodies move mostly by
// step between neighboring passed degrees, with occasional leaps: uniformly
// random notes sound like nothing and drill memory instead of ear. Notes are
// register positions (semitones above the tonic, §3.3). Pure TS.

import {
  degreeAt,
  positionsOf,
  type Degree,
  type RegisterOctaves,
} from '../theory'
import type { Confusion } from './confusions'
import { pickWeighted, type Rng } from './dealer'

export const MELODY_LENGTHS: readonly number[] = [2, 3, 4, 5, 6]
export const DEFAULT_MELODY_LENGTH = 3

// The chance each next note moves by step; otherwise it leaps.
export const STEP_CHANCE = 0.75

// A leap goes at most an octave, so a wide register doesn't turn leaps into
// jumps no melody makes.
export const MAX_LEAP = 12

function pickUniform<T>(items: readonly T[], rng: Rng): T {
  return pickWeighted(
    items,
    items.map(() => 1),
    rng,
  )
}

// A melody of `length` positions over the passed degrees. A step goes to the
// next passed position up or down; a leap to any other within MAX_LEAP. No
// note repeats the one before it. Needs at least 2 degrees.
export function generateMelody(
  degrees: readonly Degree[],
  length: number,
  octaves: RegisterOctaves,
  rng: Rng = Math.random,
): number[] {
  const positions = [...new Set(degrees)]
    .flatMap((degree) => positionsOf(degree, octaves))
    .sort((a, b) => a - b)
  if (positions.length < 2) {
    throw new Error('A melody needs at least 2 degrees')
  }
  let index = Math.floor(rng() * positions.length)
  const melody = [positions[index] ?? 0]
  while (melody.length < length) {
    const current = positions[index] ?? 0
    const steps = [index - 1, index + 1].filter(
      (i) => i >= 0 && i < positions.length,
    )
    const leaps = positions
      .map((_, i) => i)
      .filter(
        (i) =>
          Math.abs(i - index) > 1 &&
          Math.abs((positions[i] ?? 0) - current) <= MAX_LEAP,
      )
    const step = leaps.length === 0 || rng() < STEP_CHANCE
    index = pickUniform(step ? steps : leaps, rng)
    melody.push(positions[index] ?? 0)
  }
  return melody
}

export interface MelodyCheck {
  // Per slot, whether the tapped degree matched the played one.
  slots: boolean[]
  // Clean only if every note is right (§6.3).
  clean: boolean
  // The wrong slots, for the confusion log.
  confusions: Confusion[]
}

// Checks a filled-in melody: `played` positions against `tapped` degrees,
// slot by slot. Called only once every slot is filled.
export function checkMelody(
  played: readonly number[],
  tapped: readonly Degree[],
): MelodyCheck {
  const confusions: Confusion[] = []
  const slots = played.map((position, i) => {
    const expected = degreeAt(position)
    const answer = tapped[i]
    if (answer === expected) return true
    if (answer !== undefined)
      confusions.push({ played: expected, tapped: answer })
    return false
  })
  return { slots, clean: slots.every(Boolean), confusions }
}
