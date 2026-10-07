// The confusion log (DESIGN.md §5): every wrong answer, in any mode, as the
// degree played and the degree tapped, tagged with the preset it was given
// in. The dealer reads the recent end of its own preset's entries to deal
// confused degrees together; the Report reads a session's top pairs. Pure TS.

import type { Degree, PresetId } from '../theory'

export interface Confusion {
  played: Degree
  tapped: Degree
}

// One entry in the persisted log.
export interface LoggedConfusion extends Confusion {
  preset: PresetId
}

// Kept newest-last and capped, so the persisted log can't grow without
// bound. One log for every preset, so it still reads in order across them.
export const CONFUSION_LOG_SIZE = 200

export function recordConfusion(
  log: readonly LoggedConfusion[],
  confusion: LoggedConfusion,
): LoggedConfusion[] {
  return [...log, confusion].slice(-CONFUSION_LOG_SIZE)
}

// The log's entries for one preset, oldest first. Confusions stay with their
// preset like the stats do (§5): mixing 3 up with ♭3 in Chromatic says
// nothing about Major, which has no ♭3.
export function presetConfusions(
  log: readonly LoggedConfusion[],
  preset: PresetId,
): Confusion[] {
  return log
    .filter((entry) => entry.preset === preset)
    .map(({ played, tapped }) => ({ played, tapped }))
}

// A confused pair, lower degree first. Pairs are counted both ways round:
// 3 heard as 4 and 4 heard as 3 are one confusion to drill and to report.
export interface ConfusionPair {
  low: Degree
  high: Degree
  count: number
}

// The most frequent pairs in `log`, most frequent first; a tie goes to the
// pair confused more recently.
export function topConfusions(
  log: readonly Confusion[],
  count: number,
): ConfusionPair[] {
  const pairs = new Map<string, ConfusionPair & { last: number }>()
  log.forEach(({ played, tapped }, index) => {
    const low = Math.min(played, tapped) as Degree
    const high = Math.max(played, tapped) as Degree
    const key = `${low}:${high}`
    const pair = pairs.get(key) ?? { low, high, count: 0, last: index }
    pairs.set(key, { ...pair, count: pair.count + 1, last: index })
  })
  return [...pairs.values()]
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, count)
    .map(({ low, high, count: n }) => ({ low, high, count: n }))
}
