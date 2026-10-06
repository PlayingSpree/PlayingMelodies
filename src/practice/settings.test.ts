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
      feedbackSound: 'below',
      feedbackBelow: 'D',
      resolveDirection: 'alternate',
      alternateEvery: 10,
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
        feedbackSound: 'sometimes',
        feedbackBelow: 'A',
        resolveDirection: 'sideways',
        alternateEvery: 11,
      }),
    ).toEqual({ ...DEFAULT_SETTINGS, noteVolume: 0.3 })
  })

  it('defaults a field older saves lack', () => {
    const {
      feedbackSound: _,
      feedbackBelow: __,
      resolveDirection: ___,
      alternateEvery: ____,
      ...older
    } = DEFAULT_SETTINGS
    expect(sanitizeSettings({ ...older, register: 2 })).toEqual({
      ...DEFAULT_SETTINGS,
      register: 2,
    })
  })
})
