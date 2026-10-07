import { describe, expect, it } from 'vitest'
import {
  besideOf,
  FEEDBACK_NOTE_MS,
  FEEDBACK_STEP_MS,
  KEY_CUE_GAP_MS,
  KEY_CUE_HOLD_MS,
  KEY_CUE_STEP_MS,
  keyCue,
  melodyFeedbackCue,
  promptCue,
  resolveToTonic,
  noteFeedbackCue,
  RIGHT_FEEDBACK_MS,
  SILENT_MISS_MS,
  silentCue,
  TAPPED_PAUSE_MS,
  TEMPO_STEP_MS,
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
    expect(resolveToTonic(24, 'up')).toBeNull()
  })

  it('always rises or always falls when told to', () => {
    expect(resolveToTonic(14, 'up')).toBe(24) // 2
    expect(resolveToTonic(19, 'up')).toBe(24) // 5
    expect(resolveToTonic(14, 'down')).toBe(12)
    expect(resolveToTonic(19, 'down')).toBe(12)
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

describe('silentCue', () => {
  it('is a short pause after a right answer', () => {
    expect(silentCue(true)).toEqual({ notes: [], lengthMs: RIGHT_FEEDBACK_MS })
  })

  it('holds a miss longer', () => {
    expect(silentCue(false)).toEqual({ notes: [], lengthMs: SILENT_MISS_MS })
    expect(SILENT_MISS_MS).toBeGreaterThan(RIGHT_FEEDBACK_MS)
  })
})

describe('noteFeedbackCue', () => {
  it('plays tapped, then correct resolving', () => {
    expect(positions(noteFeedbackCue(9, 7))).toEqual([7, 9, 12])
  })

  it('pauses between the tapped note and the correct one', () => {
    const [tapped, correct] = noteFeedbackCue(9, 7).notes
    expect((correct?.atMs ?? 0) - (tapped?.durationMs ?? 0)).toBe(
      TAPPED_PAUSE_MS,
    )
  })

  it('skips the tapped note for a timeout', () => {
    const cue = noteFeedbackCue(16, null)
    expect(positions(cue)).toEqual([16, 12])
    expect(cue.notes[0]?.atMs).toBe(0)
  })

  it('plays just the correct note resolving for a right answer', () => {
    const cue = noteFeedbackCue(16, 4)
    expect(positions(cue)).toEqual([16, 12])
    expect(cue).toEqual(noteFeedbackCue(16, null))
  })

  it('resolves the way it is told', () => {
    expect(positions(noteFeedbackCue(9, 7, 'down'))).toEqual([7, 9, 0])
    expect(positions(noteFeedbackCue(16, null, 'up'))).toEqual([16, 24])
  })

  it('holds the tonic instead of resolving it', () => {
    expect(positions(noteFeedbackCue(12, 11))).toEqual([23, 12])
  })

  it('runs past its last note', () => {
    const cue = noteFeedbackCue(9, 7)
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

describe('keyCue', () => {
  it('plays 1, 5 and the octave 1, then a gap', () => {
    const cue = keyCue()
    expect(positions(cue)).toEqual([0, 7, 12])
    expect(cue.notes.map((note) => note.atMs)).toEqual([
      0,
      KEY_CUE_STEP_MS,
      2 * KEY_CUE_STEP_MS,
    ])
    expect(cue.notes[2]?.durationMs).toBe(KEY_CUE_HOLD_MS)
    expect(cue.lengthMs).toBe(
      2 * KEY_CUE_STEP_MS + KEY_CUE_HOLD_MS + KEY_CUE_GAP_MS,
    )
  })
})
