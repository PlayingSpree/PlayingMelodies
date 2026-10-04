import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings'

describe('sanitizeSettings', () => {
  it('defaults everything for junk', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings('loud')).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid fields', () => {
    const settings = {
      droneVolume: 0,
      noteVolume: 1,
      register: 3,
      goalMinutes: 25,
    }
    expect(sanitizeSettings(settings)).toEqual(settings)
  })

  it('replaces only the bad fields', () => {
    expect(
      sanitizeSettings({
        droneVolume: 1.5,
        noteVolume: 0.3,
        register: 4,
        goalMinutes: 0,
      }),
    ).toEqual({ ...DEFAULT_SETTINGS, noteVolume: 0.3 })
  })
})
