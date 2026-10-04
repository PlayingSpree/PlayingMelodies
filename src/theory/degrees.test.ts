import { describe, expect, it } from 'vitest'
import {
  DEGREES,
  degreeLabel,
  isDegree,
  PAD_COLUMNS,
  PAD_LAYOUT,
  parseDegrees,
} from './degrees'

describe('degreeLabel', () => {
  it('writes degrees as numbers with ♭/♯', () => {
    expect(DEGREES.map(degreeLabel)).toEqual([
      '1',
      '♭2',
      '2',
      '♭3',
      '3',
      '4',
      '♯4',
      '5',
      '♭6',
      '6',
      '♭7',
      '7',
    ])
  })
})

describe('parseDegrees', () => {
  it('reads a label list back into degrees', () => {
    expect(parseDegrees('1 5 ♭3 ♯4 7')).toEqual([0, 7, 3, 6, 11])
  })

  it('round-trips every label', () => {
    expect(parseDegrees(DEGREES.map(degreeLabel).join(' '))).toEqual(DEGREES)
  })

  it('throws on an unknown label', () => {
    expect(() => parseDegrees('1 ♯2')).toThrow("Unknown degree '♯2'")
  })
})

describe('isDegree', () => {
  it('accepts integers 0–11 only', () => {
    expect(isDegree(0)).toBe(true)
    expect(isDegree(11)).toBe(true)
    expect(isDegree(12)).toBe(false)
    expect(isDegree(-1)).toBe(false)
    expect(isDegree(2.5)).toBe(false)
    expect(isDegree('3')).toBe(false)
  })
})

describe('PAD_LAYOUT', () => {
  it('holds every degree once', () => {
    expect(PAD_LAYOUT.map((key) => key.degree).sort((a, b) => a - b)).toEqual(
      DEGREES,
    )
  })

  it('puts the naturals on the bottom row, in order, in even columns', () => {
    const naturals = PAD_LAYOUT.filter((key) => key.row === 'natural')
    expect(naturals.map((key) => degreeLabel(key.degree))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
    ])
    expect(naturals.map((key) => key.column)).toEqual([0, 2, 4, 6, 8, 10, 12])
  })

  it('raises each flat or sharp between its two neighbors', () => {
    for (const key of PAD_LAYOUT.filter((k) => k.row === 'raised')) {
      const below = PAD_LAYOUT.find((k) => k.degree === key.degree - 1)
      const above = PAD_LAYOUT.find((k) => k.degree === key.degree + 1)
      expect(below?.row).toBe('natural')
      expect(above?.row).toBe('natural')
      expect(key.column).toBe((below?.column ?? -1) + 1)
      expect(key.column).toBe((above?.column ?? -1) - 1)
    }
  })

  it('fits the grid', () => {
    for (const key of PAD_LAYOUT) {
      expect(key.column).toBeGreaterThanOrEqual(0)
      expect(key.column).toBeLessThan(PAD_COLUMNS)
    }
  })
})
