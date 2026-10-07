import { describe, expect, it } from 'vitest'
import {
  CONFUSION_LOG_SIZE,
  presetConfusions,
  recordConfusion,
  topConfusions,
  type Confusion,
  type LoggedConfusion,
} from './confusions'

describe('recordConfusion', () => {
  it('appends newest last and caps the log', () => {
    let log: LoggedConfusion[] = []
    for (let i = 0; i < CONFUSION_LOG_SIZE + 5; i++) {
      log = recordConfusion(log, {
        preset: 'major',
        played: 4,
        tapped: i % 2 === 0 ? 5 : 3,
      })
    }
    expect(log).toHaveLength(CONFUSION_LOG_SIZE)
    expect(log.at(-1)).toEqual({ preset: 'major', played: 4, tapped: 5 })
  })
})

describe('presetConfusions', () => {
  it("keeps only the preset's entries, in order", () => {
    const log: LoggedConfusion[] = [
      { preset: 'major', played: 4, tapped: 5 },
      { preset: 'chromatic', played: 3, tapped: 4 },
      { preset: 'major', played: 11, tapped: 0 },
    ]
    expect(presetConfusions(log, 'major')).toEqual([
      { played: 4, tapped: 5 },
      { played: 11, tapped: 0 },
    ])
    expect(presetConfusions(log, 'minor')).toEqual([])
  })
})

describe('topConfusions', () => {
  it('counts a pair both ways round, lower degree first', () => {
    const log: Confusion[] = [
      { played: 4, tapped: 5 },
      { played: 5, tapped: 4 },
      { played: 3, tapped: 4 },
    ]
    expect(topConfusions(log, 3)).toEqual([
      { low: 4, high: 5, count: 2 },
      { low: 3, high: 4, count: 1 },
    ])
  })

  it('breaks ties toward the more recent pair and keeps only `count`', () => {
    const log: Confusion[] = [
      { played: 0, tapped: 7 },
      { played: 10, tapped: 11 },
      { played: 3, tapped: 4 },
    ]
    expect(topConfusions(log, 2)).toEqual([
      { low: 3, high: 4, count: 1 },
      { low: 10, high: 11, count: 1 },
    ])
  })

  it('is empty for an empty log', () => {
    expect(topConfusions([], 3)).toEqual([])
  })
})
