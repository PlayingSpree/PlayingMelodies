// Grading one answer into the player's records (DESIGN.md §4–§6.3): which
// mode feeds what. Notes feeds the grade window and the preset's pass window;
// Speed feeds only the star window; Melody feeds only the preset's melody
// window. Every wrong note, in any mode, feeds the confusion log. Pure TS.

import { degreeAt, type Degree, type Preset } from '../theory'
import { recordConfusion, type Confusion } from './confusions'
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

// The part of the persisted state a session reads and writes, for its preset.
export interface PracticeSlice {
  degreeStats: DegreeStatsMap
  confusions: readonly Confusion[]
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
  log: readonly Confusion[],
  confusions: readonly Confusion[],
): readonly Confusion[] {
  return confusions.reduce(recordConfusion, log)
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
        confusions: withConfusions(practice.confusions, check.confusions),
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

  const unlock = recordNotesAnswer(preset, practice.progress, played, correct)
  return {
    practice: {
      confusions,
      degreeStats: {
        ...practice.degreeStats,
        [played]: recordNotesOutcome(stats, correct),
      },
      progress: unlock.progress,
    },
    correct,
    slots: [correct],
    newlyPassed: unlock.newlyPassed,
    newlyUnlocked: unlock.newlyUnlocked,
  }
}
