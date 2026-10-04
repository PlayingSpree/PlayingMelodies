import { describe, expect, it } from 'vitest'
import { DEGREES, degreeLabel } from './degrees'
import { getPreset, isPresetId, PRESETS } from './presets'

function labels(id: 'major' | 'minor' | 'combined'): string {
  return getPreset(id).order.map(degreeLabel).join(' ')
}

describe('PRESETS', () => {
  it('match the §4 unlock orders', () => {
    expect(labels('major')).toBe('1 5 3 4 6 2 7')
    expect(labels('minor')).toBe('1 5 ♭3 4 ♭6 2 ♭7')
    expect(labels('combined')).toBe('1 5 3 ♭3 7 ♭7 6 ♭6 4 2 ♭2 ♯4')
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

  it('give Combined all 12 degrees', () => {
    expect([...getPreset('combined').order].sort((a, b) => a - b)).toEqual(
      DEGREES,
    )
  })
})

describe('isPresetId', () => {
  it('accepts the built-in ids only', () => {
    expect(isPresetId('major')).toBe(true)
    expect(isPresetId('combined')).toBe(true)
    expect(isPresetId('dorian')).toBe(false)
    expect(isPresetId(1)).toBe(false)
  })
})
