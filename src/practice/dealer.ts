// What Notes and Speed deal next (DESIGN.md §5): a weighted draw from the
// dealable degrees, biased subtly toward recent misses and the degrees they
// were confused with, never excluding any. Stateless — the session keeps the
// played history and passes it in. Pure TS.

import { positionsOf, type Degree, type RegisterOctaves } from '../theory'
import type { Confusion } from './confusions'
import type { DegreeStatsMap } from './stats'

export type Rng = () => number // [0, 1), Math.random-compatible

// Each miss among a degree's last MISS_LOOKBACK Notes outcomes adds
// MISS_WEIGHT to its base weight of 1.
export const MISS_LOOKBACK = 5
export const MISS_WEIGHT = 0.5

// Each of the last CONFUSION_LOOKBACK confusions adds CONFUSION_WEIGHT to
// both of its degrees, so a miss draws the degree it was mistaken for too.
export const CONFUSION_LOOKBACK = 20
export const CONFUSION_WEIGHT = 0.25

// No degree weighs more than this many fresh ones: a bias, not a takeover.
export const MAX_WEIGHT = 3

// The longest run of one degree the dealer allows. Two in a row stays
// possible: with 2 degrees open, forbidding any repeat would just alternate.
export const MAX_RUN = 2

export function degreeWeight(
  degree: Degree,
  stats: DegreeStatsMap,
  confusions: readonly Confusion[],
): number {
  const misses = stats[degree].outcomes
    .slice(-MISS_LOOKBACK)
    .filter((right) => !right).length
  const confused = confusions
    .slice(-CONFUSION_LOOKBACK)
    .filter(
      ({ played, tapped }) => played === degree || tapped === degree,
    ).length
  return Math.min(
    MAX_WEIGHT,
    1 + MISS_WEIGHT * misses + CONFUSION_WEIGHT * confused,
  )
}

// A weighted pick. `items` must be non-empty and match `weights` in length.
export function pickWeighted<T>(
  items: readonly T[],
  weights: readonly number[],
  rng: Rng,
): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let remaining = rng() * total
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as T
    remaining -= weights[i] ?? 0
    if (remaining < 0) return item
  }
  // rng() of ~1 can walk past the end on floating-point rounding.
  const last = items[items.length - 1]
  if (last === undefined) throw new Error('Cannot pick from an empty list')
  return last
}

// The next degree to deal from `pool`. `recent` is the played history,
// oldest first; a degree that has just run MAX_RUN times is held out, unless
// it is all there is.
export function dealDegree(
  pool: readonly Degree[],
  recent: readonly Degree[],
  stats: DegreeStatsMap,
  confusions: readonly Confusion[],
  rng: Rng = Math.random,
): Degree {
  if (pool.length === 0) throw new Error('Cannot deal from an empty pool')
  const tail = recent.slice(-MAX_RUN)
  const run =
    tail.length === MAX_RUN && tail.every((d) => d === tail[0])
      ? tail[0]
      : undefined
  const candidates =
    pool.length > 1 ? pool.filter((degree) => degree !== run) : pool
  return pickWeighted(
    candidates,
    candidates.map((degree) => degreeWeight(degree, stats, confusions)),
    rng,
  )
}

// Where in the register a dealt degree plays (§3.3): any of its octaves,
// evenly — register is never part of what is being asked.
export function placeDegree(
  degree: Degree,
  octaves: RegisterOctaves,
  rng: Rng = Math.random,
): number {
  const positions = positionsOf(degree, octaves)
  return positions[Math.floor(rng() * positions.length)] ?? degree
}
