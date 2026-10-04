// The one audio interface (DESIGN.md §8): what the session runner's effects
// ask of the platform, and the volume settings (§7.5). Everything else talks
// to this, so the oscillator voices behind it can become samples later.

import type { Cue } from '../practice'
import { sharedAudioContext, type SharedAudioContext } from './context'
import { Drone } from './drone'
import { Piano } from './piano'

export interface Volumes {
  drone: number // 0–1
  note: number // 0–1
}

export interface Sound {
  startDrone(tonicMidi: number): void
  retuneDrone(tonicMidi: number, fadeMs: number): void
  stopDrone(): void
  // A cue's notes, starting now; positions are semitones above the tonic.
  play(tonicMidi: number, cue: Cue): void
  // Cut any test notes sounding or scheduled; the drone plays on.
  silence(): void
  setVolumes(volumes: Volumes): void
}

export class WebAudioSound implements Sound {
  private readonly drone: Drone
  private readonly piano: Piano

  constructor(shared: SharedAudioContext = sharedAudioContext) {
    this.drone = new Drone(shared)
    this.piano = new Piano(shared)
  }

  startDrone(tonicMidi: number): void {
    this.drone.start(tonicMidi)
  }

  retuneDrone(tonicMidi: number, fadeMs: number): void {
    this.drone.retune(tonicMidi, fadeMs)
  }

  stopDrone(): void {
    this.drone.stop()
  }

  play(tonicMidi: number, cue: Cue): void {
    this.piano.play(
      cue.notes.map(({ position, atMs, durationMs }) => ({
        midi: tonicMidi + position,
        atMs,
        durationMs,
      })),
    )
  }

  silence(): void {
    this.piano.silence()
  }

  setVolumes({ drone, note }: Volumes): void {
    this.drone.setVolume(drone)
    this.piano.setVolume(note)
  }
}

// The app-wide instance; tests construct their own.
export const sound: Sound = new WebAudioSound()
