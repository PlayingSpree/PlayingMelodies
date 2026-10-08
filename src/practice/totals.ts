// All-time totals (DESIGN.md §5): how much each preset has been practiced in
// each mode — sessions, answers, right answers and active time. Unlike the
// stats they never roll off, and they rate nothing. Pure TS.

import type { PresetId } from '../theory'
import type { Mode } from './progress'
import type { SessionState } from './session'

export interface Totals {
  // Sessions with at least one answer.
  sessions: number
  // Answers as the Report counts them: a melody is one, right when clean.
  answered: number
  correct: number
  activeMs: number
}

export const EMPTY_TOTALS: Totals = {
  sessions: 0,
  answered: 0,
  correct: 0,
  activeMs: 0,
}

// Each preset's totals, then each mode's. Absent means never played.
export type TotalsMap = Readonly<
  Partial<Record<PresetId, Readonly<Partial<Record<Mode, Totals>>>>>
>

export function totalsOf(
  totals: TotalsMap,
  preset: PresetId,
  mode: Mode,
): Totals {
  return totals[preset]?.[mode] ?? EMPTY_TOTALS
}

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    sessions: a.sessions + b.sessions,
    answered: a.answered + b.answered,
    correct: a.correct + b.correct,
    activeMs: a.activeMs + b.activeMs,
  }
}

type Step = Pick<SessionState, 'answers' | 'activity'>

// What a session step adds to its preset and mode's totals. A session counts
// with its first answer, so one quit before answering adds only its time.
export function stepTotals(before: Step, after: Step): Totals {
  const added = after.answers.slice(before.answers.length)
  return {
    sessions: before.answers.length === 0 && added.length > 0 ? 1 : 0,
    answered: added.length,
    correct: added.filter((answer) => answer.correct).length,
    activeMs: after.activity.activeMs - before.activity.activeMs,
  }
}

export function isEmptyTotals(totals: Totals): boolean {
  return (
    totals.sessions === 0 &&
    totals.answered === 0 &&
    totals.correct === 0 &&
    totals.activeMs <= 0
  )
}

export function recordTotals(
  totals: TotalsMap,
  preset: PresetId,
  mode: Mode,
  step: Totals,
): TotalsMap {
  return {
    ...totals,
    [preset]: {
      ...totals[preset],
      [mode]: addTotals(totalsOf(totals, preset, mode), step),
    },
  }
}
