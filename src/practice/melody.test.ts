import { describe, expect, it } from 'vitest'
import { degreeAt, type Degree } from '../theory'
import type { Rng } from './dealer'
import { checkMelody, generateMelody, MAX_LEAP } from './melody'

// A deterministic stand-in for Math.random (mulberry32).
function seeded(seed: number): Rng {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PASSED: Degree[] = [0, 7, 4, 5, 9] // 1 5 3 4 6

describe('generateMelody', () => {
  it('has the asked length, over passed degrees, inside the register', () => {
    for (const octaves of [1, 2, 3] as const) {
      const rng = seeded(octaves)
      for (let i = 0; i < 200; i++) {
        const melody = generateMelody(PASSED, 6, octaves, rng)
        expect(melody).toHaveLength(6)
        for (const position of melody) {
          expect(PASSED).toContain(degreeAt(position))
          expect(position).toBeGreaterThanOrEqual(0)
          expect(position).toBeLessThan(12 * octaves)
        }
      }
    }
  })

  it('never repeats the note before', () => {
    const rng = seeded(7)
    for (let i = 0; i < 200; i++) {
      const melody = generateMelody(PASSED, 6, 2, rng)
      for (let j = 1; j < melody.length; j++) {
        expect(melody[j]).not.toBe(melody[j - 1])
      }
    }
  })

  it('moves mostly by step, and leaps at most an octave', () => {
    const rng = seeded(11)
    const positions = [0, 4, 5, 7, 9, 12, 16, 17, 19, 21]
    let steps = 0
    let moves = 0
    for (let i = 0; i < 500; i++) {
      const melody = generateMelody(PASSED, 6, 2, rng)
      for (let j = 1; j < melody.length; j++) {
        const from = positions.indexOf(melody[j - 1] ?? -1)
        const to = positions.indexOf(melody[j] ?? -1)
        if (Math.abs(to - from) === 1) steps++
        expect(
          Math.abs((melody[j] ?? 0) - (melody[j - 1] ?? 0)),
        ).toBeLessThanOrEqual(MAX_LEAP)
        moves++
      }
    }
    expect(steps / moves).toBeGreaterThan(0.7)
    expect(steps / moves).toBeLessThan(0.95)
  })

  it('steps when there is nothing to leap to', () => {
    // 3 passed degrees in one octave: from the middle one, both others are
    // steps, so even a leap-sized roll steps. Rolls: start, then the pick.
    const rolls = [0.5, 0.9]
    const melody = generateMelody([0, 4, 7], 2, 1, () => rolls.shift() ?? 0)
    expect(melody).toEqual([4, 7])
  })

  it('needs at least 2 degrees', () => {
    expect(() => generateMelody([0], 3, 1)).toThrow()
  })
})

describe('checkMelody', () => {
  it('is clean when every slot matches, in any octave', () => {
    const check = checkMelody([4, 17, 12], [4, 5, 0])
    expect(check).toEqual({
      slots: [true, true, true],
      clean: true,
      confusions: [],
    })
  })

  it('marks wrong slots and logs them as confusions', () => {
    const check = checkMelody([4, 5, 7], [4, 4, 7])
    expect(check.slots).toEqual([true, false, true])
    expect(check.clean).toBe(false)
    expect(check.confusions).toEqual([{ played: 5, tapped: 4 }])
  })
})
