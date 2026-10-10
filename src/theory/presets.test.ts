import { describe, expect, it } from 'vitest'
import { DEGREES, degreeLabel } from './degrees'
import { getPreset, isBuiltInPresetId, isPresetId, PRESETS } from './presets'

function labels(id: 'major' | 'minor' | 'chromatic'): string {
  return getPreset(id).order.map(degreeLabel).join(' ')
}

describe('PRESETS', () => {
  it('match the §4 unlock orders', () => {
    expect(labels('major')).toBe('1 5 3 4 6 2 7')
    expect(labels('minor')).toBe('1 5 ♭3 4 ♭6 2 ♭7')
    expect(labels('chromatic')).toBe('1 5 3 ♭3 7 ♭7 6 ♭6 4 2 ♭2 ♯4')
  })

  it('all open on 1 and 5', () => {
    for (const preset of PRESETS) {
      expect(preset.order.slice(0, 2)).toEqual([0, 7])
    }
  })

  it('never list a degree twice', () => {
    for (const preset of PRESETS) {
      expect(new Set(preset.order).size).toBe(preset.order.length)
    }
  })

  it('start Major on 2, Minor on 3 and Chromatic on 4', () => {
    expect(PRESETS.map((preset) => preset.startUnlocked)).toEqual([2, 3, 4])
  })

  it('give Chromatic all 12 degrees', () => {
    expect([...getPreset('chromatic').order].sort((a, b) => a - b)).toEqual(
      DEGREES,
    )
  })
})

describe('isPresetId', () => {
  it('accepts the built-in ids and Mix-ups', () => {
    expect(isPresetId('major')).toBe(true)
    expect(isPresetId('chromatic')).toBe(true)
    expect(isPresetId('mixups')).toBe(true)
    expect(isPresetId('dorian')).toBe(false)
    expect(isPresetId(1)).toBe(false)
  })
})

describe('isBuiltInPresetId', () => {
  it('leaves out Mix-ups', () => {
    expect(isBuiltInPresetId('minor')).toBe(true)
    expect(isBuiltInPresetId('mixups')).toBe(false)
  })
})
