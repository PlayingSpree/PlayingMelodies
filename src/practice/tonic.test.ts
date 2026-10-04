import { describe, expect, it } from 'vitest'
import { pickTonic, TONIC_BASE_MIDI, tonicMidi } from './tonic'

describe('pickTonic', () => {
  it('keeps a locked tonic', () => {
    expect(pickTonic(7, null, () => 0.5)).toBe(7)
    expect(pickTonic(7, 7, () => 0.5)).toBe(7)
  })

  it('reaches every pitch class at the start', () => {
    const picked = new Set(
      Array.from({ length: 12 }, (_, i) => pickTonic(null, null, () => i / 12)),
    )
    expect(picked.size).toBe(12)
  })

  it('never repeats the previous tonic', () => {
    for (let i = 0; i < 100; i++) {
      expect(pickTonic(null, 4, () => i / 100)).not.toBe(4)
    }
  })
})

describe('tonicMidi', () => {
  it('places tonics in one octave from C3', () => {
    expect(tonicMidi(0)).toBe(TONIC_BASE_MIDI)
    expect(tonicMidi(11)).toBe(TONIC_BASE_MIDI + 11)
  })
})
