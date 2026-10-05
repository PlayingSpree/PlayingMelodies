// Per-degree stats (DESIGN.md §5): the shared Notes outcome window behind the
// letter grade and the Speed time window behind the star. Keyed by degree
// only — every preset, tonic and octave feeds the same 12 records. Pure TS.

import { DEGREES, type Degree } from '../theory'

// Both windows keep the last 10 answers, oldest first.
export const OUTCOME_WINDOW = 10
export const SPEED_WINDOW = 10

// A grade or a star needs this many answers in its window; until then it
// shows as "—" / no star, so a lucky first tap rates nothing.
export const MIN_RATED_ANSWERS = 5

// Speed's fixed per-note limit (§6.2). A miss or timeout is recorded as the
// full limit, so a fast wrong tap can't earn a star.
export const SPEED_LIMIT_MS = 5000

export interface DegreeStats {
  outcomes: readonly boolean[]
  speedTimesMs: readonly number[]
}

export type DegreeStatsMap = Readonly<Record<Degree, DegreeStats>>

export const EMPTY_DEGREE_STATS: DegreeStats = {
  outcomes: [],
  speedTimesMs: [],
}

export function emptyStatsMap(): DegreeStatsMap {
  const map = {} as Record<Degree, DegreeStats>
  for (const degree of DEGREES) map[degree] = EMPTY_DEGREE_STATS
  return map
}

// Appends to a window, dropping the oldest entries past `size`.
export function pushWindow<T>(
  window: readonly T[],
  value: T,
  size: number,
): T[] {
  return [...window, value].slice(-size)
}

export function recordNotesOutcome(
  stats: DegreeStats,
  correct: boolean,
): DegreeStats {
  return {
    ...stats,
    outcomes: pushWindow(stats.outcomes, correct, OUTCOME_WINDOW),
  }
}

// `timeMs` is null for a miss or timeout.
export function recordSpeedTime(
  stats: DegreeStats,
  timeMs: number | null,
): DegreeStats {
  const time =
    timeMs === null ? SPEED_LIMIT_MS : Math.min(timeMs, SPEED_LIMIT_MS)
  return {
    ...stats,
    speedTimesMs: pushWindow(stats.speedTimesMs, time, SPEED_WINDOW),
  }
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

export function gradeOf(accuracy: number): Grade {
  if (accuracy >= 0.9) return 'A'
  if (accuracy >= 0.8) return 'B'
  if (accuracy >= 0.7) return 'C'
  if (accuracy >= 0.6) return 'D'
  return 'F'
}

// The letter grade of an outcome window — a degree's Notes window or a
// preset's melody window (§6.3), which share the bands. Null shows as "—".
export function windowGrade(outcomes: readonly boolean[]): Grade | null {
  if (outcomes.length < MIN_RATED_ANSWERS) return null
  const right = outcomes.filter(Boolean).length
  return gradeOf(right / outcomes.length)
}

// A preset's grade averages its degrees' grades as points, A = 4 … F = 0,
// and rounds down (§5). Null, for no grades at all, is "—".
const GRADE_POINTS: readonly Grade[] = ['F', 'D', 'C', 'B', 'A']

export function averageGrade(grades: readonly Grade[]): Grade | null {
  if (grades.length === 0) return null
  const points = grades.reduce((sum, g) => sum + GRADE_POINTS.indexOf(g), 0)
  return GRADE_POINTS[Math.floor(points / grades.length)] ?? null
}

export type Star = 'gold' | 'silver' | 'bronze'

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  if (sorted.length % 2 === 1) return upper
  return ((sorted[middle - 1] ?? 0) + upper) / 2
}

// The Speed star from the median time (§5); null is "no star".
export function starOf(speedTimesMs: readonly number[]): Star | null {
  if (speedTimesMs.length < MIN_RATED_ANSWERS) return null
  const time = median(speedTimesMs) ?? SPEED_LIMIT_MS
  if (time < 1000) return 'gold'
  if (time < 2000) return 'silver'
  if (time < 3000) return 'bronze'
  return null
}

// Stars average the same way, gold = 3 … no star = 0 (§5). Unlike a grade,
// "no star" is itself a rating, so the caller passes only rated degrees.
const STAR_POINTS: readonly (Star | null)[] = [null, 'bronze', 'silver', 'gold']

export function averageStar(stars: readonly (Star | null)[]): Star | null {
  if (stars.length === 0) return null
  const points = stars.reduce((sum, s) => sum + STAR_POINTS.indexOf(s), 0)
  return STAR_POINTS[Math.floor(points / stars.length)] ?? null
}
