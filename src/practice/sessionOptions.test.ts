import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SESSION_OPTIONS,
  resolveLength,
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

  it('keeps Daily', () => {
    expect(
      sanitizeSessionOptions({ length: { kind: 'daily' } }).length,
    ).toEqual({ kind: 'daily' })
  })
})

describe('resolveLength', () => {
  it('passes a fixed length through', () => {
    const length = { kind: 'minutes', minutes: 5 } as const
    expect(resolveLength(length, 2)).toEqual(length)
  })

  it('runs Daily for what is left of the goal', () => {
    expect(resolveLength({ kind: 'daily' }, 6.5)).toEqual({
      kind: 'minutes',
      minutes: 6.5,
    })
  })

  it('falls back to the default once the goal is met', () => {
    expect(resolveLength({ kind: 'daily' }, 0)).toEqual(
      DEFAULT_SESSION_OPTIONS.length,
    )
  })
})
