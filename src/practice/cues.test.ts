import { describe, expect, it } from 'vitest'
import {
  besideOf,
  FEEDBACK_NOTE_MS,
  FEEDBACK_STEP_MS,
  melodyFeedbackCue,
  promptCue,
  resolveToTonic,
  rightCue,
  RIGHT_FEEDBACK_MS,
  TAPPED_PAUSE_MS,
  TEMPO_STEP_MS,
  wrongCue,
  type Cue,
} from './cues'

function positions(cue: Cue): number[] {
  return cue.notes.map((note) => note.position)
}

describe('resolveToTonic', () => {
  it('falls from ♭2–4 and rises from ♯4–7', () => {
    expect(resolveToTonic(2)).toBe(0) // 2
    expect(resolveToTonic(5)).toBe(0) // 4
    expect(resolveToTonic(6)).toBe(12) // ♯4
    expect(resolveToTonic(7)).toBe(12) // 5
    expect(resolveToTonic(11)).toBe(12) // 7
  })

  it('stays in the note’s octave', () => {
    expect(resolveToTonic(14)).toBe(12)
    expect(resolveToTonic(35)).toBe(36)
  })

  it('has nowhere to go from the tonic', () => {
    expect(resolveToTonic(0)).toBeNull()
    expect(resolveToTonic(24)).toBeNull()
  })
})

describe('besideOf', () => {
  it('places a degree in the octave of a position', () => {
    expect(besideOf(16, 5)).toBe(17)
    expect(besideOf(16, 0)).toBe(12)
  })
})

describe('promptCue', () => {
  it('plays a single note', () => {
    expect(positions(promptCue([7], 'normal'))).toEqual([7])
  })

  it('spaces a melody evenly at the tempo', () => {
    const cue = promptCue([0, 2, 4], 'slow')
    expect(cue.notes.map((note) => note.atMs)).toEqual([0, 800, 1600])
    expect(cue.lengthMs).toBe(3 * TEMPO_STEP_MS.slow)
  })
})

describe('rightCue', () => {
  it('is a silent pause', () => {
    expect(rightCue()).toEqual({ notes: [], lengthMs: RIGHT_FEEDBACK_MS })
  })
})

describe('wrongCue', () => {
  it('plays tapped, then correct resolving', () => {
    expect(positions(wrongCue(9, 7))).toEqual([7, 9, 12])
  })

  it('pauses between the tapped note and the correct one', () => {
    const [tapped, correct] = wrongCue(9, 7).notes
    expect((correct?.atMs ?? 0) - (tapped?.durationMs ?? 0)).toBe(
      TAPPED_PAUSE_MS,
    )
  })

  it('skips the tapped note for a timeout', () => {
    const cue = wrongCue(16, null)
    expect(positions(cue)).toEqual([16, 12])
    expect(cue.notes[0]?.atMs).toBe(0)
  })

  it('holds the tonic instead of resolving it', () => {
    expect(positions(wrongCue(12, 11))).toEqual([23, 12])
  })

  it('runs past its last note', () => {
    const cue = wrongCue(9, 7)
    const last = cue.notes.at(-1)
    expect(cue.lengthMs).toBeGreaterThan(
      (last?.atMs ?? 0) + (last?.durationMs ?? 0),
    )
  })
})

describe('melodyFeedbackCue', () => {
  it('replays the melody, then tapped-versus-correct per wrong slot', () => {
    const cue = melodyFeedbackCue([0, 2, 16], [0, 3, 5], 'normal')
    expect(positions(cue)).toEqual([0, 2, 16, 3, 2, 17, 16])
    const replayEnd = 3 * TEMPO_STEP_MS.normal
    expect(cue.notes[3]?.atMs).toBe(replayEnd + FEEDBACK_STEP_MS)
    expect(cue.notes[4]?.atMs).toBe(
      replayEnd + FEEDBACK_STEP_MS + FEEDBACK_NOTE_MS + TAPPED_PAUSE_MS,
    )
  })

  it('only replays a clean melody', () => {
    expect(positions(melodyFeedbackCue([0, 2], [0, 2], 'fast'))).toEqual([0, 2])
  })
})
