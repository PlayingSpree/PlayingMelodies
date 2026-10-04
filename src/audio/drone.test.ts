import { describe, expect, it } from 'vitest'
import { Drone } from './drone'
import { frequencyOf } from './piano'
import { FakeAudioContext, sharedOn } from './fakeAudio'

function droneOn(ctx: FakeAudioContext): Drone {
  return new Drone(sharedOn(ctx))
}

const pitchesOf = (ctx: FakeAudioContext) =>
  ctx
    .sounding()
    .map((o) => o.frequency.value)
    .sort((a, b) => a - b)

describe('Drone', () => {
  it('sounds the low tonic, the fifth above it, and the tonic', () => {
    const ctx = new FakeAudioContext()
    droneOn(ctx).start(48)
    const pitches = pitchesOf(ctx)
    expect(pitches).toHaveLength(3)
    expect(pitches[0]).toBeCloseTo(frequencyOf(36))
    expect(pitches[1]).toBeCloseTo(frequencyOf(43))
    expect(pitches[2]).toBeCloseTo(frequencyOf(48))
  })

  it('fades in and never schedules its own end', () => {
    const ctx = new FakeAudioContext()
    droneOn(ctx).start(48)
    const envelope = ctx.gains.find((g) => g.gain.last('linear'))!
    expect(envelope.gain.events.map((e) => e.kind)).toEqual(['set', 'linear'])
    expect(envelope.gain.last('linear')?.value).toBe(1)
    expect(ctx.oscillators.every((o) => o.stoppedAt.length === 0)).toBe(true)
  })

  it('waits for the unlock when started on a suspended context', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    droneOn(ctx).start(48)
    expect(ctx.oscillators).toHaveLength(0)
    ctx.unlock()
    expect(pitchesOf(ctx)).toHaveLength(3)
  })

  it('sounds only the latest request once unlocked', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    const drone = droneOn(ctx)
    drone.start(48)
    drone.retune(53, 2000)
    ctx.unlock()
    expect(ctx.oscillators).toHaveLength(3)
    expect(pitchesOf(ctx)[2]).toBeCloseTo(frequencyOf(53))
  })

  it('a stop before the unlock leaves it silent', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    const drone = droneOn(ctx)
    drone.start(48)
    drone.stop()
    ctx.unlock()
    expect(ctx.oscillators).toHaveLength(0)
  })

  it('crossfades a retune: the old voice ramps out as the new one ramps in', () => {
    const ctx = new FakeAudioContext()
    const drone = droneOn(ctx)
    drone.start(48)
    ctx.currentTime = 10
    drone.retune(53, 2000)

    // Envelopes are the only gains with automation; the old one came first.
    const [fadingOut, fadingIn] = ctx.gains.filter((g) => g.gain.last('linear'))
    expect(fadingOut!.gain.last('cancel')?.at).toBe(10)
    expect(fadingOut!.gain.last('linear')).toEqual({
      kind: 'linear',
      value: 0,
      at: 12,
    })
    expect(fadingIn!.gain.last('linear')).toEqual({
      kind: 'linear',
      value: 1,
      at: 12,
    })
    // The old oscillators stop just after the fade; the new ones run on.
    expect(ctx.oscillators.slice(0, 3).every((o) => o.stoppedAt[0]! > 12)).toBe(
      true,
    )
    expect(pitchesOf(ctx)[2]).toBeCloseTo(frequencyOf(53))
  })

  it('stop fades the voice out', () => {
    const ctx = new FakeAudioContext()
    const drone = droneOn(ctx)
    drone.start(48)
    drone.stop()
    expect(ctx.sounding()).toHaveLength(0)
    drone.stop()
    expect(ctx.oscillators.every((o) => o.stoppedAt.length === 1)).toBe(true)
  })

  it('a retune to the tonic already sounding changes nothing', () => {
    const ctx = new FakeAudioContext()
    const drone = droneOn(ctx)
    drone.start(48)
    drone.retune(48, 2000)
    expect(ctx.oscillators).toHaveLength(3)
    expect(ctx.sounding()).toHaveLength(3)
  })

  it('sets one master gain from the drone volume', () => {
    const ctx = new FakeAudioContext()
    const drone = droneOn(ctx)
    drone.setVolume(0)
    drone.start(48)
    drone.retune(50, 2000)
    const masters = ctx.gains.filter((g) => g.outputs.includes(ctx.destination))
    expect(masters).toHaveLength(1)
    expect(masters[0]!.gain.value).toBe(0)
    drone.setVolume(1)
    expect(masters[0]!.gain.value).toBeGreaterThan(0)
  })
})
