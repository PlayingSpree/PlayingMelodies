// The Report (DESIGN.md §7.4), derived from a finished session: accuracy,
// how each rating moved since Start, this session's top confusions, what was
// newly passed or unlocked, and the average response time. Each mode reports
// the rating it feeds (§5): Notes the degrees' grades, Speed their stars,
// Melody the preset's melody grade. Pure TS.

import type { Degree } from '../theory'
import { topConfusions, type Confusion, type ConfusionPair } from './confusions'
import { melodyGrade } from './progress'
import type { SessionState } from './session'
import { starOf, windowGrade, type Grade, type Star } from './stats'

export const REPORT_CONFUSIONS = 3

export interface RatingChange<T> {
  degree: Degree
  before: T | null
  after: T | null
}

export type ReportRatings =
  | { kind: 'grades'; changes: RatingChange<Grade>[] }
  | { kind: 'stars'; changes: RatingChange<Star>[] }
  | { kind: 'melody'; before: Grade | null; after: Grade | null }

export interface SessionReport {
  answered: number
  correct: number
  accuracy: number | null // null before any answer
  // Notes and Melody; Speed reports stars instead (§7.4).
  averageTimeMs: number | null
  ratings: ReportRatings
  confusions: ConfusionPair[]
  newlyPassed: Degree[]
  newlyUnlocked: Degree[]
}

export function sessionReport(state: SessionState): SessionReport {
  const { answers, practice, startPractice, setup } = state
  const { mode } = setup.options
  const correct = answers.filter((answer) => answer.correct).length

  const times = answers.flatMap((answer) =>
    answer.timeMs === null ? [] : [answer.timeMs],
  )
  const averageTimeMs =
    mode === 'speed' || times.length === 0
      ? null
      : times.reduce((sum, t) => sum + t, 0) / times.length

  // The degrees heard this session, in the preset's order.
  const heard = new Set(answers.flatMap((answer) => answer.played))
  const degrees = setup.preset.order.filter((degree) => heard.has(degree))
  const change = <T>(
    rate: (stats: (typeof practice.degreeStats)[Degree]) => T | null,
  ) =>
    degrees.map((degree) => ({
      degree,
      before: rate(startPractice.degreeStats[degree]),
      after: rate(practice.degreeStats[degree]),
    }))

  let ratings: ReportRatings
  switch (mode) {
    case 'notes':
      ratings = {
        kind: 'grades',
        changes: change((s) => windowGrade(s.outcomes)),
      }
      break
    case 'speed':
      ratings = {
        kind: 'stars',
        changes: change((s) => starOf(s.speedTimesMs)),
      }
      break
    case 'melody':
      ratings = {
        kind: 'melody',
        before: melodyGrade(startPractice.progress),
        after: melodyGrade(practice.progress),
      }
      break
  }

  // This session's misses, slot by slot; a Speed timeout tapped nothing.
  const misses: Confusion[] = answers.flatMap((answer) =>
    answer.slots.flatMap((right, i) => {
      const played = answer.played[i]
      const tapped = answer.tapped[i]
      return right || played === undefined || tapped === undefined
        ? []
        : [{ played, tapped }]
    }),
  )

  return {
    answered: answers.length,
    correct,
    accuracy: answers.length === 0 ? null : correct / answers.length,
    averageTimeMs,
    ratings,
    confusions: topConfusions(misses, REPORT_CONFUSIONS),
    newlyPassed: state.newlyPassed,
    newlyUnlocked: state.newlyUnlocked,
  }
}
