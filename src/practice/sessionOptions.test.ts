import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SESSION_OPTIONS,
  sanitizeSessionOptions,
  type SessionOptions,
} from './sessionOptions'

describe('sanitizeSessionOptions', () => {
  it('defaults everything for junk', () => {
    expect(sanitizeSessionOptions(undefined)).toEqual(DEFAULT_SESSION_OPTIONS)
    expect(sanitizeSessionOptions(7)).toEqual(DEFAULT_SESSION_OPTIONS)
  })

  it('keeps valid fields', () => {
    const options: SessionOptions = {
      mode: 'melody',
      length: { kind: 'minutes', minutes: 5 },
      tonicLock: 11,
      tonicChangeEvery: 30,
      melodyLength: 6,
      tempo: 'fast',
    }
    expect(sanitizeSessionOptions(options)).toEqual(options)
  })

  it('replaces only the bad fields', () => {
    expect(
      sanitizeSessionOptions({
        mode: 'chords',
        length: { kind: 'prompts', count: 15 },
        tonicLock: 12,
        tonicChangeEvery: 10,
        melodyLength: 7,
        tempo: 'slow',
      }),
    ).toEqual({
      ...DEFAULT_SESSION_OPTIONS,
      tonicChangeEvery: 10,
      tempo: 'slow',
    })
  })

  it('rejects a length that mixes its kinds', () => {
    expect(
      sanitizeSessionOptions({ length: { kind: 'minutes', count: 10 } }).length,
    ).toEqual(DEFAULT_SESSION_OPTIONS.length)
  })
})
