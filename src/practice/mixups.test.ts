import { describe, expect, it } from 'vitest'
import {
  degreeLabel,
  parseDegrees,
  type Degree,
  type PresetId,
} from '../theory'
import type { LoggedConfusion } from './confusions'
import {
  buildMixups,
  mixupPairCount,
  MIXUPS_WINDOW,
  resolvePreset,
} from './mixups'

// "3>4" is 3 played, 4 tapped.
function log(spec: string, preset: PresetId = 'major'): LoggedConfusion[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((entry) => {
      const [played, tapped] = parseDegrees(entry.replace('>', ' ')) as [
        Degree,
        Degree,
      ]
      return { played, tapped, preset }
    })
}

function labels(entries: readonly LoggedConfusion[]): string | undefined {
  return buildMixups(entries)?.preset.order.map(degreeLabel).join(' ')
}

describe('buildMixups', () => {
  it('stays closed until the window holds 2 different pairs', () => {
    expect(buildMixups([])).toBeNull()
    expect(buildMixups(log('3>4 4>3 3>4'))).toBeNull()
    expect(buildMixups(log('3>4 6>5'))).not.toBeNull()
  })

  it('opens both degrees of each pair, in pitch order, all unlocked', () => {
    const mixups = buildMixups(log('6>5 3>4 4>3'))
    expect(mixups?.preset.order).toEqual(parseDegrees('3 4 5 6'))
    expect(mixups?.preset.startUnlocked).toBe(4)
    expect(mixups?.preset.id).toBe('mixups')
  })

  it('reads across presets', () => {
    const entries = [...log('3>4', 'major'), ...log('♭3>3', 'chromatic')]
    expect(labels(entries)).toBe('♭3 3 4')
  })

  it('takes the most frequent pairs until the next goes past 6 degrees', () => {
    // 3/4 ×3, 5/6 ×2, 2/7 ×2 (6 degrees so far), 1/♭7 ×1 would make 8.
    const entries = log('3>4 4>3 3>4 5>6 6>5 2>7 7>2 1>♭7')
    expect(labels(entries)).toBe('2 3 4 5 6 7')
    expect(buildMixups(entries)?.pairs.map((p) => p.count)).toEqual([3, 2, 2])
  })

  it('reads only the newest wrong answers', () => {
    const old = log('6>5 2>1')
    const recent = Array.from({ length: MIXUPS_WINDOW / 2 }, () =>
      log('3>4 ♭3>3'),
    ).flat()
    expect(labels([...old, ...recent])).toBe('♭3 3 4')
  })

  it("leaves out Mix-ups' own wrong answers", () => {
    const entries = [...log('3>4', 'major'), ...log('6>5', 'mixups')]
    expect(buildMixups(entries)).toBeNull()
    expect(mixupPairCount(entries)).toBe(1)
  })
})

describe('resolvePreset', () => {
  it('returns a built-in by id, and Mix-ups only once it opens', () => {
    expect(resolvePreset('minor', [])?.name).toBe('Minor')
    expect(resolvePreset('mixups', [])).toBeNull()
    expect(resolvePreset('mixups', log('3>4 6>5'))?.name).toBe('Mix-ups')
  })
})
