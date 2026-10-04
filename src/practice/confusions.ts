// The confusion log (DESIGN.md §5): every wrong answer, in any mode, as the
// degree played and the degree tapped. The dealer reads its recent end to
// deal confused degrees together; the Report reads its top pairs. Pure TS.

import type { Degree } from '../theory'

export interface Confusion {
  played: Degree
  tapped: Degree
}

// Kept newest-last and capped, so the persisted log can't grow without
// bound. Far more than the dealer or a session's Report ever reads.
export const CONFUSION_LOG_SIZE = 200

export function recordConfusion(
  log: readonly Confusion[],
  confusion: Confusion,
): Confusion[] {
  return [...log, confusion].slice(-CONFUSION_LOG_SIZE)
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
