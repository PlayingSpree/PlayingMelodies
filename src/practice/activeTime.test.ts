import { describe, expect, it } from 'vitest'
import { IDLE_CLOCK, touchActivity, type ActivityClock } from './activeTime'

function touches(...times: number[]): ActivityClock {
  return times.reduce(touchActivity, IDLE_CLOCK)
}

describe('touchActivity', () => {
  it('earns nothing for the first event', () => {
    expect(touches(1000).activeMs).toBe(0)
  })

  it('earns the gaps between close events', () => {
    expect(touches(0, 4000, 10_000).activeMs).toBe(10_000)
  })

  it('counts a gap of exactly 15 s', () => {
    expect(touches(0, 15_000).activeMs).toBe(15_000)
  })

  it('earns nothing across a longer gap, then starts afresh', () => {
    expect(touches(0, 3000, 18_001, 20_000).activeMs).toBe(3000 + 1999)
  })

  it('ignores clock skew', () => {
    expect(touches(5000, 4000, 6000).activeMs).toBe(2000)
  })
})
