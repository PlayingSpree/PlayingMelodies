// The drone (DESIGN.md §3.2, §8): tonic and fifth, sustained for the whole
// session — it never decays — crossfading when the tonic changes.
//
// Voicing: the tonic an octave below the tonic MIDI note, the fifth above
// that, and the tonic itself. Phone speakers barely reproduce anything under
// ~200 Hz and the low tonic sits at 65–123 Hz, so each pitch is a sawtooth
// through a gentle lowpass: the upper harmonics carry the pitch on a small
// speaker, and the filter keeps the buzz down to an organ-like hum.

import {
  sharedAudioContext,
  volumeGain,
  type SharedAudioContext,
} from './context'
import { frequencyOf } from './piano'

const PITCHES: ReadonlyArray<{ offset: number; gain: number }> = [
  { offset: -12, gain: 0.45 },
  { offset: -5, gain: 0.3 },
  { offset: 0, gain: 0.25 },
]
const LOWPASS_HZ = 1200
// Saws are loud: this keeps the drone under the test notes at equal settings.
const MASTER_LEVEL = 0.2
const FADE_IN_SECONDS = 0.6
const FADE_OUT_SECONDS = 0.4

interface Voice {
  tonicMidi: number
  oscillators: OscillatorNode[]
  envelope: GainNode
}

export class Drone {
  private readonly shared: SharedAudioContext
  private master: GainNode | null = null
  private volume = 1
  private voice: Voice | null = null
  // What should be sounding: requests are recorded here and carried out
  // once the context runs, so one made before the unlock isn't lost.
  private wanted: number | null = null

  constructor(shared: SharedAudioContext = sharedAudioContext) {
    this.shared = shared
  }

  start(tonicMidi: number): void {
    this.request(tonicMidi, FADE_IN_SECONDS)
  }

  retune(tonicMidi: number, fadeMs: number): void {
    this.request(tonicMidi, fadeMs / 1000)
  }

  stop(): void {
    this.request(null, FADE_OUT_SECONDS)
  }

  setVolume(volume: number): void {
    this.volume = volume
    if (this.master) {
      this.master.gain.value = MASTER_LEVEL * volumeGain(volume)
    }
  }

  private request(tonicMidi: number | null, fadeSeconds: number): void {
    this.wanted = tonicMidi
    this.shared.whenRunning((ctx) => this.sync(ctx, fadeSeconds))
  }

  // Bring what's sounding in line with what's wanted: fade the old voice
  // out and the new one in over the same span, a crossfade on a retune.
  private sync(ctx: AudioContext, fadeSeconds: number): void {
    const wanted = this.wanted
    if (wanted === (this.voice?.tonicMidi ?? null)) return
    if (this.voice) this.release(ctx, this.voice, fadeSeconds)
    this.voice = wanted === null ? null : this.sound(ctx, wanted, fadeSeconds)
  }

  private masterGain(ctx: AudioContext): GainNode {
    if (this.master === null) {
      this.master = ctx.createGain()
      this.master.gain.value = MASTER_LEVEL * volumeGain(this.volume)
      this.master.connect(ctx.destination)
    }
    return this.master
  }

  private sound(ctx: AudioContext, tonicMidi: number, fadeIn: number): Voice {
    const now = ctx.currentTime
    const envelope = ctx.createGain()
    envelope.gain.value = 0
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(1, now + fadeIn)
    envelope.connect(this.masterGain(ctx))

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = LOWPASS_HZ
    filter.connect(envelope)

    const oscillators = PITCHES.map(({ offset, gain }) => {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = frequencyOf(tonicMidi + offset)
      const pitchGain = ctx.createGain()
      pitchGain.gain.value = gain
      osc.connect(pitchGain)
      pitchGain.connect(filter)
      osc.start(now)
      return osc
    })
    return { tonicMidi, oscillators, envelope }
  }

  private release(ctx: AudioContext, voice: Voice, fadeOut: number): void {
    const now = ctx.currentTime
    // Pin the current level first: a voice still fading in ramps down from
    // where it got to, not from full.
    voice.envelope.gain.cancelScheduledValues(now)
    voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, now)
    voice.envelope.gain.linearRampToValueAtTime(0, now + fadeOut)
    for (const osc of voice.oscillators) osc.stop(now + fadeOut + 0.05)
  }
}
