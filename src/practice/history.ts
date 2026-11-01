// Day tallies and the last 30 days (DESIGN.md §5, §7.4): the all-time totals
// split by local day, per preset and mode, and what the Report's chart and
// week-against-week headline are drawn from. Like the totals they count
// practice that happened, rate nothing and never feed the dealer. Pure TS.

import type { PresetId } from '../theory'
import { previousDateKey, type DailyRecords } from './daily'
import type { Mode } from './progress'
import type { SessionState } from './session'

export const HISTORY_DAYS = 30
export const WEEK_DAYS = 7

export interface DayTally {
  // Answers as the Report counts them: a melody is one, right when clean.
  answered: number
  correct: number
  activeMs: number
  // The response times of the right answers, summed and counted, for a
  // day's average. A right answer always has a time; only a timeout lacks one.
  rightTimeMs: number
  rightTimed: number
  // Degrees newly passed, in Notes.
  passed: number
}

export const EMPTY_DAY_TALLY: DayTally = {
  answered: 0,
  correct: 0,
  activeMs: 0,
  rightTimeMs: 0,
  rightTimed: 0,
  passed: 0,
}

// A day's tallies: each preset's, then each mode's. Absent means unpracticed.
export type DayTallies = Readonly<
  Partial<Record<PresetId, Readonly<Partial<Record<Mode, DayTally>>>>>
>

export function addDayTally(a: DayTally, b: DayTally): DayTally {
  return {
    answered: a.answered + b.answered,
    correct: a.correct + b.correct,
    activeMs: a.activeMs + b.activeMs,
    rightTimeMs: a.rightTimeMs + b.rightTimeMs,
    rightTimed: a.rightTimed + b.rightTimed,
    passed: a.passed + b.passed,
  }
}

type Step = Pick<SessionState, 'answers' | 'activity' | 'newlyPassed'>

// What a session step adds to today's tally for its preset and mode.
export function stepDayTally(before: Step, after: Step): DayTally {
  const added = after.answers.slice(before.answers.length)
  const times = added.flatMap((answer) =>
    answer.correct && answer.timeMs !== null ? [answer.timeMs] : [],
  )
  return {
    answered: added.length,
    correct: added.filter((answer) => answer.correct).length,
    activeMs: after.activity.activeMs - before.activity.activeMs,
    rightTimeMs: times.reduce((sum, t) => sum + t, 0),
    rightTimed: times.length,
    passed: after.newlyPassed.length - before.newlyPassed.length,
  }
}

export function isEmptyDayTally(tally: DayTally): boolean {
  return tally.answered === 0 && tally.passed === 0 && tally.activeMs <= 0
}

export function dayTallyOf(
  records: DailyRecords,
  dateKey: string,
  preset: PresetId,
  mode: Mode,
): DayTally | undefined {
  return records[dateKey]?.tallies?.[preset]?.[mode]
}

export function recordDayTally(
  records: DailyRecords,
  dateKey: string,
  preset: PresetId,
  mode: Mode,
  step: DayTally,
): DailyRecords {
  const record = records[dateKey]
  const tallies = record?.tallies ?? {}
  const tally = addDayTally(
    dayTallyOf(records, dateKey, preset, mode) ?? EMPTY_DAY_TALLY,
    step,
  )
  return {
    ...records,
    [dateKey]: {
      date: dateKey,
      activeMinutes: record?.activeMinutes ?? 0,
      tallies: { ...tallies, [preset]: { ...tallies[preset], [mode]: tally } },
    },
  }
}

// The mode's own measure (§7.4): the share right in Notes, the share clean in
// Melody, and in Speed the average time of the right answers in ms, where
// lower is better. Null when there is nothing to measure.
export function dayMeasure(mode: Mode, tally: DayTally): number | null {
  if (mode === 'speed') {
    return tally.rightTimed === 0 ? null : tally.rightTimeMs / tally.rightTimed
  }
  return tally.answered === 0 ? null : tally.correct / tally.answered
}

export interface HistoryDay {
  date: string
  tally: DayTally | null
  // Null on a day without practice: a gap, never a zero.
  measure: number | null
}

export interface History {
  days: HistoryDay[] // oldest first, ending today
  // The last 7 days and the 7 before them, each pooled over its answers.
  thisWeek: number | null
  lastWeek: number | null
}

export function buildHistory(
  records: DailyRecords,
  preset: PresetId,
  mode: Mode,
  todayKey: string,
): History {
  const keys: string[] = []
  let key = todayKey
  for (let i = 0; i < HISTORY_DAYS; i++) {
    keys.unshift(key)
    key = previousDateKey(key)
  }
  const days = keys.map((date) => {
    const tally = dayTallyOf(records, date, preset, mode) ?? null
    return { date, tally, measure: tally ? dayMeasure(mode, tally) : null }
  })
  const week = (from: number) => {
    const pooled = days
      .slice(from, from + WEEK_DAYS)
      .reduce((sum, day) => addDayTally(sum, day.tally ?? EMPTY_DAY_TALLY), {
        ...EMPTY_DAY_TALLY,
      })
    return dayMeasure(mode, pooled)
  }
  return {
    days,
    thisWeek: week(HISTORY_DAYS - WEEK_DAYS),
    lastWeek: week(HISTORY_DAYS - 2 * WEEK_DAYS),
  }
}
