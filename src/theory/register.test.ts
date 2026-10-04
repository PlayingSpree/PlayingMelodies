import { describe, expect, it } from 'vitest'
import { degreeAt, positionsOf } from './register'

describe('degreeAt', () => {
  it('reads the degree off a position in any octave', () => {
    expect(degreeAt(0)).toBe(0)
    expect(degreeAt(7)).toBe(7)
    expect(degreeAt(19)).toBe(7)
    expect(degreeAt(35)).toBe(11)
  })
})

describe('positionsOf', () => {
  it('gives a one-octave register a single position per degree', () => {
    expect(positionsOf(4, 1)).toEqual([4])
  })

  it('adds one position per extra octave', () => {
    expect(positionsOf(4, 3)).toEqual([4, 16, 28])
  })
})
