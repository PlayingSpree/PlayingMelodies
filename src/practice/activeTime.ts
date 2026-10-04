// Active practice time (DESIGN.md §1, §7.1), the rule ported from
// PlayingChord: time accrues between consecutive interaction events — a tap,
// a replay, an undo, the Start tap — whenever the gap between two is at most
// ACTIVE_IDLE_WINDOW_MS. A longer gap earns nothing: walking away stops the
// clock at the last tap, and the next tap starts a fresh segment. Pure TS,
// as a value rather than PlayingChord's class, so a session state can hold it.

export const ACTIVE_IDLE_WINDOW_MS = 15_000

export interface ActivityClock {
  lastEventMs: number | null
  activeMs: number
}

export const IDLE_CLOCK: ActivityClock = { lastEventMs: null, activeMs: 0 }

// Registers an interaction event at `nowMs`, crediting the gap since the
// previous one if it fits the window.
export function touchActivity(
  clock: ActivityClock,
  nowMs: number,
): ActivityClock {
  const last = clock.lastEventMs
  const gap = last === null ? 0 : nowMs - last
  // A first event, or clock skew, earns nothing.
  const earned = gap > 0 && gap <= ACTIVE_IDLE_WINDOW_MS ? gap : 0
  return { lastEventMs: nowMs, activeMs: clock.activeMs + earned }
}
