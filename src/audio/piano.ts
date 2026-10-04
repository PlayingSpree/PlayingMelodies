// Web Audio piano synth, ported from PlayingChord: the piano-ish voice for
// test notes (DESIGN.md §8). PlayingChord's noteOn/noteOff followed a MIDI
// keyboard; here every note's start and length are known up front, so a whole
// cue is scheduled on the audio clock at once.

import {
  sharedAudioContext,
  volumeGain,
  type SharedAudioContext,
} from './context'

// A note to play, `atMs` after the call.
export interface PianoNote {
  midi: number
  atMs: number
  durationMs: number
}

// Headroom between scheduling and the first note, so it isn't clipped.
const LEAD_SECONDS = 0.03
const ATTACK_SECONDS = 0.008
const PEAK = 0.25
const SUSTAIN_LEVEL = 0.25 // fraction of peak the note decays toward
const DECAY_TIME_CONSTANT = 0.4
const RELEASE_SECONDS = 0.25
const MASTER_LEVEL = 0.5

// A simple piano-ish patch: fundamental (triangle) plus two upper partials
// (sine), gains normalized to sum to 1 so PEAK is the note's actual ceiling —
// not inflated by the harmonic stack.
const HARMONICS: ReadonlyArray<{
  multiple: number
  type: OscillatorType
  gain: number
}> = [
  { multiple: 1, type: 'triangle', gain: 0.65 },
  { multiple: 2, type: 'sine', gain: 0.25 },
  { multiple: 3, type: 'sine', gain: 0.1 },
]

// The standard MIDI-note-to-frequency formula, A4 (69) = 440 Hz.
export function frequencyOf(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

interface Voice {
  oscillators: OscillatorNode[]
  envelope: GainNode
  endsAt: number // context time its release is over
}

export class Piano {
  private readonly shared: SharedAudioContext
  private master: GainNode | null = null
  private volume = 1
  private voices: Voice[] = []

  constructor(shared: SharedAudioContext = sharedAudioContext) {
    this.shared = shared
  }

  // Lazy, created once against whichever context is currently running —
  // the note-volume setting, and a cap on the summed loudness of overlaps.
  private masterGain(ctx: AudioContext): GainNode {
    if (this.master === null) {
      this.master = ctx.createGain()
      this.master.gain.value = MASTER_LEVEL * volumeGain(this.volume)
      this.master.connect(ctx.destination)
    }
    return this.master
  }

  setVolume(volume: number): void {
    this.volume = volume
    if (this.master) {
      this.master.gain.value = MASTER_LEVEL * volumeGain(volume)
    }
  }

  // Dropped, not queued, while the context isn't running: a late test note
  // would land on the wrong prompt.
  play(notes: readonly PianoNote[]): void {
    const ctx = this.shared.running()
    if (ctx === null) return
    const now = ctx.currentTime
    this.voices = this.voices.filter((voice) => voice.endsAt > now)
    const start = now + LEAD_SECONDS
    for (const note of notes) {
      this.strike(
        ctx,
        note.midi,
        start + note.atMs / 1000,
        note.durationMs / 1000,
      )
    }
  }

  // Cut every note, sounding or still scheduled.
  silence(): void {
    const ctx = this.shared.running()
    if (ctx === null) return
    const now = ctx.currentTime
    for (const voice of this.voices) {
      // Drop the rest of the envelope and glide from wherever it is now to
      // silence. A note that hasn't started is stopped before its start, so
      // it never sounds at all.
      voice.envelope.gain.cancelScheduledValues(now)
      voice.envelope.gain.setTargetAtTime(0, now, RELEASE_SECONDS / 5)
      for (const osc of voice.oscillators) osc.stop(now + RELEASE_SECONDS)
    }
    this.voices = []
  }

  private strike(
    ctx: AudioContext,
    midi: number,
    start: number,
    duration: number,
  ): void {
    const end = start + duration
    const envelope = ctx.createGain()
    envelope.gain.value = 0
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(PEAK, start + ATTACK_SECONDS)
    envelope.gain.setTargetAtTime(
      PEAK * SUSTAIN_LEVEL,
      start + ATTACK_SECONDS,
      DECAY_TIME_CONSTANT,
    )
    // Five time constants is ~-43 dB: silent by the oscillators' stop.
    envelope.gain.setTargetAtTime(0, end, RELEASE_SECONDS / 5)
    envelope.connect(this.masterGain(ctx))

    const frequency = frequencyOf(midi)
    const oscillators = HARMONICS.map(({ multiple, type, gain }) => {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = frequency * multiple
      const harmonicGain = ctx.createGain()
      harmonicGain.gain.value = gain
      osc.connect(harmonicGain)
      harmonicGain.connect(envelope)
      osc.start(start)
      osc.stop(end + RELEASE_SECONDS)
      return osc
    })
    this.voices.push({ oscillators, envelope, endsAt: end + RELEASE_SECONDS })
  }
}
