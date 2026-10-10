// Mix-ups (DESIGN.md §4, §5): a preset whose degrees come from the player's
// recent confusions instead of a fixed list. It reads the newest wrong answers
// given in the other presets, takes their most frequent pairs and opens both
// degrees of each, so confused degrees are drilled side by side. Built when a
// session starts and fixed for it. Pure TS.

import {
  getPreset,
  MIXUPS_ID,
  type Degree,
  type Preset,
  type PresetId,
} from '../theory'
import {
  topConfusions,
  type ConfusionPair,
  type LoggedConfusion,
} from './confusions'

export const MIXUPS_NAME = 'Mix-ups'

// How many of the newest wrong answers it reads: counted in answers, not
// days, so a break doesn't empty it.
export const MIXUPS_WINDOW = 30

// At most this many degrees, so the drill stays on the worst pairs.
export const MIXUPS_MAX_DEGREES = 6

// It opens once the window holds this many different pairs; one pair alone
// would be a two-way guess.
export const MIXUPS_MIN_PAIRS = 2

export interface Mixups {
  preset: Preset
  // The pairs its degrees come from, most frequent first.
  pairs: ConfusionPair[]
}

// The pairs in the window, most frequent first. Mix-ups' own wrong answers
// are left out, so it never feeds on itself.
function windowPairs(log: readonly LoggedConfusion[]): ConfusionPair[] {
  const recent = log
    .filter((entry) => entry.preset !== MIXUPS_ID)
    .slice(-MIXUPS_WINDOW)
  return topConfusions(recent, recent.length)
}

// How many different pairs the window holds, for the locked card.
export function mixupPairCount(log: readonly LoggedConfusion[]): number {
  return windowPairs(log).length
}

// The Mix-ups preset as the log stands, or null while it can't open. Pairs
// are taken in order until the next would go past the degree cap. Every
// degree is open from the start: there's no order to unlock along.
export function buildMixups(log: readonly LoggedConfusion[]): Mixups | null {
  const pairs = windowPairs(log)
  if (pairs.length < MIXUPS_MIN_PAIRS) return null
  let degrees = new Set<Degree>()
  const used: ConfusionPair[] = []
  for (const pair of pairs) {
    const next = new Set([...degrees, pair.low, pair.high])
    if (next.size > MIXUPS_MAX_DEGREES) break
    degrees = next
    used.push(pair)
  }
  const order = [...degrees].sort((a, b) => a - b)
  return {
    preset: {
      id: MIXUPS_ID,
      name: MIXUPS_NAME,
      order,
      startUnlocked: order.length,
    },
    pairs: used,
  }
}

// The preset behind an id: a built-in, or Mix-ups as the log stands now
// (null while it can't open).
export function resolvePreset(
  id: PresetId,
  log: readonly LoggedConfusion[],
): Preset | null {
  return id === MIXUPS_ID ? (buildMixups(log)?.preset ?? null) : getPreset(id)
}
