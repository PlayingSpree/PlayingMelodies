import { describe, expect, it } from 'vitest'
import { frequencyOf, Piano } from './piano'
import { FakeAudioContext, sharedOn } from './fakeAudio'

function pianoOn(ctx: FakeAudioContext): Piano {
  return new Piano(sharedOn(ctx))
}

describe('frequencyOf', () => {
  it('is 440 Hz at A4 and doubles per octave', () => {
    expect(frequencyOf(69)).toBeCloseTo(440)
    expect(frequencyOf(57)).toBeCloseTo(220)
    expect(frequencyOf(60)).toBeCloseTo(261.63)
  })
})

describe('Piano', () => {
  it('plays each note as 3 harmonics at the fundamental, 2× and 3×', () => {
    const ctx = new FakeAudioContext()
    pianoOn(ctx).play([{ midi: 69, atMs: 0, durationMs: 500 }])
    const freqs = ctx.oscillators
      .map((o) => o.frequency.value)
      .sort((a, b) => a - b)
    expect(freqs).toHaveLength(3)
    expect(freqs[0]).toBeCloseTo(440)
    expect(freqs[1]).toBeCloseTo(880)
    expect(freqs[2]).toBeCloseTo(1320)
  })

  it('schedules every note of a cue at once, at its offset', () => {
    const ctx = new FakeAudioContext()
    pianoOn(ctx).play([
      { midi: 60, atMs: 0, durationMs: 500 },
      { midi: 62, atMs: 600, durationMs: 500 },
    ])
    const starts = ctx.oscillators.map((o) => o.startedAt[0]!)
    const first = starts[0]!
    expect(first).toBeGreaterThan(ctx.currentTime)
    expect(first).toBeLessThan(ctx.currentTime + 0.1)
    expect(starts.slice(0, 3).every((t) => t === first)).toBe(true)
    expect(starts.slice(3).every((t) => t === first + 0.6)).toBe(true)
  })

  it('attacks, then releases at the end of its duration', () => {
    const ctx = new FakeAudioContext()
    pianoOn(ctx).play([{ midi: 60, atMs: 0, durationMs: 1000 }])
    const start = ctx.oscillators[0]!.startedAt[0]!
    const envelope = ctx.gains.find((g) => g.gain.last('linear'))!
    expect(envelope.gain.last('linear')?.at).toBeGreaterThan(start)
    expect(envelope.gain.last('target')).toMatchObject({
      value: 0,
      at: start + 1,
    })
    for (const osc of ctx.oscillators) {
      expect(osc.stoppedAt[0]).toBeGreaterThan(start + 1)
    }
  })

  it('silence cuts sounding and still-scheduled notes alike', () => {
    const ctx = new FakeAudioContext()
    const piano = pianoOn(ctx)
    piano.play([
      { midi: 60, atMs: 0, durationMs: 1000 },
      { midi: 64, atMs: 5000, durationMs: 1000 },
    ])
    ctx.currentTime += 0.5
    piano.silence()
    for (const osc of ctx.oscillators) {
      const stop = osc.stoppedAt.at(-1)!
      expect(stop).toBeLessThan(ctx.currentTime + 0.5)
    }
    // The later note is stopped before it starts, so it never sounds.
    const late = ctx.oscillators[3]!
    expect(late.stoppedAt.at(-1)!).toBeLessThan(late.startedAt[0]!)
  })

  it('silence fades each note to 0 without rescheduling its envelope', () => {
    const ctx = new FakeAudioContext()
    const piano = pianoOn(ctx)
    piano.play([{ midi: 60, atMs: 0, durationMs: 1000 }])
    ctx.currentTime += 0.5
    piano.silence()
    const envelope = ctx.gains.find((g) => g.gain.last('target'))!
    expect(envelope.gain.last('cancel')).toBeUndefined()
    const cut = ctx.gains.find((g) => envelope.outputs.includes(g))!
    // Starting a little ahead, so the fade isn't already rendered past.
    const hold = cut.gain.events[0]!
    expect(hold).toMatchObject({ kind: 'set', value: 1 })
    expect(hold.at).toBeGreaterThan(ctx.currentTime)
    const fade = cut.gain.last('linear')!
    expect(fade.value).toBe(0)
    expect(fade.at).toBeGreaterThan(hold.at)
    for (const osc of ctx.oscillators) {
      expect(osc.stoppedAt.at(-1)).toBeGreaterThanOrEqual(fade.at)
    }
  })

  it('silence leaves notes that already ended alone', () => {
    const ctx = new FakeAudioContext()
    const piano = pianoOn(ctx)
    piano.play([{ midi: 60, atMs: 0, durationMs: 200 }])
    ctx.currentTime += 5
    piano.play([{ midi: 62, atMs: 0, durationMs: 200 }])
    piano.silence()
    expect(
      ctx.oscillators.slice(0, 3).every((o) => o.stoppedAt.length === 1),
    ).toBe(true)
    expect(
      ctx.oscillators.slice(3).every((o) => o.stoppedAt.length === 2),
    ).toBe(true)
  })

  it('drops notes while the context is suspended, but asks it to resume', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    pianoOn(ctx).play([{ midi: 60, atMs: 0, durationMs: 500 }])
    expect(ctx.oscillators).toHaveLength(0)
    expect(ctx.resumeCalls).toBe(1)
  })

  it('creates the master gain once and sets it from the note volume', () => {
    const ctx = new FakeAudioContext()
    const piano = pianoOn(ctx)
    piano.play([{ midi: 60, atMs: 0, durationMs: 500 }])
    piano.play([{ midi: 64, atMs: 0, durationMs: 500 }])
    const masters = ctx.gains.filter((g) => g.outputs.includes(ctx.destination))
    expect(masters).toHaveLength(1)
    const loud = masters[0]!.gain.value
    piano.setVolume(0.5)
    expect(masters[0]!.gain.value).toBeLessThan(loud)
    piano.setVolume(0)
    expect(masters[0]!.gain.value).toBe(0)
  })

  it('applies a volume set before the first note', () => {
    const ctx = new FakeAudioContext()
    const piano = pianoOn(ctx)
    piano.setVolume(0)
    piano.play([{ midi: 60, atMs: 0, durationMs: 500 }])
    const master = ctx.gains.find((g) => g.outputs.includes(ctx.destination))
    expect(master?.gain.value).toBe(0)
  })
})
