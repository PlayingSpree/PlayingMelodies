// Grading one answer into the player's records (DESIGN.md §4–§6.3): which
// mode feeds what. Notes feeds the grade window, which passing reads too;
// Speed feeds only the star window; Melody feeds only the preset's melody
// window. Every wrong note, in any mode, feeds the confusion log. Pure TS.

import { degreeAt, type Degree, type Preset, type PresetId } from '../theory'
import {
  recordConfusion,
  type Confusion,
  type LoggedConfusion,
} from './confusions'
import { checkMelody } from './melody'
import {
  recordMelodyOutcome,
  recordNotesAnswer,
  type PresetProgress,
} from './progress'
import {
  recordNotesOutcome,
  recordSpeedTime,
  type DegreeStatsMap,
} from './stats'

// The part of the persisted state a session reads and writes, for its preset:
// the preset's stats and progress, and the whole confusion log, which every
// preset shares (its entries are tagged with theirs).
export interface PracticeSlice {
  degreeStats: DegreeStatsMap
  confusions: readonly LoggedConfusion[]
  progress: PresetProgress
}

export type Answer =
  | { mode: 'notes'; played: number; tapped: Degree }
  // `tapped` and `timeMs` are null for a timeout.
  | {
      mode: 'speed'
      played: number
      tapped: Degree | null
      timeMs: number | null
    }
  | { mode: 'melody'; played: readonly number[]; tapped: readonly Degree[] }

export interface GradeResult {
  practice: PracticeSlice
  correct: boolean
  // Per note, whether it was right: one entry outside Melody.
  slots: boolean[]
  newlyPassed: Degree | null
  newlyUnlocked: Degree[]
}

function withConfusions(
  log: readonly LoggedConfusion[],
  preset: PresetId,
  confusions: readonly Confusion[],
): readonly LoggedConfusion[] {
  return confusions.reduce(
    (next, confusion) => recordConfusion(next, { ...confusion, preset }),
    log,
  )
}

export function gradeAnswer(
  preset: Preset,
  practice: PracticeSlice,
  answer: Answer,
): GradeResult {
  if (answer.mode === 'melody') {
    const check = checkMelody(answer.played, answer.tapped)
    return {
      practice: {
        ...practice,
        confusions: withConfusions(
          practice.confusions,
          preset.id,
          check.confusions,
        ),
        progress: recordMelodyOutcome(practice.progress, check.clean),
      },
      correct: check.clean,
      slots: check.slots,
      newlyPassed: null,
      newlyUnlocked: [],
    }
  }

  const played = degreeAt(answer.played)
  const correct = answer.tapped === played
  const confusions =
    answer.tapped === null || correct
      ? practice.confusions
      : recordConfusion(practice.confusions, {
          played,
          tapped: answer.tapped,
          preset: preset.id,
        })
  const stats = practice.degreeStats[played]

  if (answer.mode === 'speed') {
    return {
      practice: {
        ...practice,
        confusions,
        degreeStats: {
          ...practice.degreeStats,
          [played]: recordSpeedTime(stats, correct ? answer.timeMs : null),
        },
      },
      correct,
      slots: [correct],
      newlyPassed: null,
      newlyUnlocked: [],
    }
  }

  const recorded = recordNotesOutcome(stats, correct)
  const unlock = recordNotesAnswer(
    preset,
    practice.progress,
    played,
    recorded.outcomes,
  )
  return {
    practice: {
      confusions,
      degreeStats: { ...practice.degreeStats, [played]: recorded },
      progress: unlock.progress,
    },
    correct,
    slots: [correct],
    newlyPassed: unlock.newlyPassed,
    newlyUnlocked: unlock.newlyUnlocked,
  }
}
