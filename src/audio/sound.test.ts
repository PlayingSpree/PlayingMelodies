import { describe, expect, it } from 'vitest'
import { promptCue } from '../practice'
import { frequencyOf } from './piano'
import { WebAudioSound } from './sound'
import { FakeAudioContext, sharedOn } from './fakeAudio'

describe('WebAudioSound', () => {
  it('plays cue positions above the tonic', () => {
    const ctx = new FakeAudioContext()
    new WebAudioSound(sharedOn(ctx)).play(50, promptCue([0, 7, 16], 'normal'))
    const fundamentals = ctx.oscillators
      .filter((o) => o.type === 'triangle')
      .map((o) => o.frequency.value)
    expect(fundamentals).toHaveLength(3)
    expect(fundamentals[0]).toBeCloseTo(frequencyOf(50))
    expect(fundamentals[1]).toBeCloseTo(frequencyOf(57))
    expect(fundamentals[2]).toBeCloseTo(frequencyOf(66))
  })

  it('silence cuts the test notes but leaves the drone running', () => {
    const ctx = new FakeAudioContext()
    const sound = new WebAudioSound(sharedOn(ctx))
    sound.startDrone(48)
    sound.play(48, promptCue([4], 'normal'))
    sound.silence()
    const drone = ctx.oscillators.filter((o) => o.type === 'sawtooth')
    expect(drone).toHaveLength(3)
    expect(drone.every((o) => o.stoppedAt.length === 0)).toBe(true)
    const notes = ctx.oscillators.filter((o) => o.type !== 'sawtooth')
    expect(notes.every((o) => o.stoppedAt.length === 2)).toBe(true)
  })

  it('routes each volume to its own voice', () => {
    const ctx = new FakeAudioContext()
    const sound = new WebAudioSound(sharedOn(ctx))
    sound.setVolumes({ drone: 0, note: 1 })
    sound.startDrone(48)
    sound.play(48, promptCue([4], 'normal'))
    const masters = ctx.gains
      .filter((g) => g.outputs.includes(ctx.destination))
      .map((g) => g.gain.value)
    expect(masters).toHaveLength(2)
    expect(masters[0]).toBe(0) // the drone's, created first
    expect(masters[1]).toBeGreaterThan(0)
  })
})
