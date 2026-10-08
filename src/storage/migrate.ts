// Migration into the current schema version (DESIGN.md §8). Upgrades chain
// here (v1 → v2 → …) before the final sanitize.

import {
  defaultState,
  sanitizeState,
  SCHEMA_VERSION,
  type PersistedState,
} from './schema'

// `raw` is the parsed value at STATE_STORAGE_KEY, or an imported file's. An
// unrecognized version — a *newer* build's state read by an older one —
// resets to defaults: downgrades are rare for a static site, and an import
// refuses a newer file before it gets here (importExport.ts).
export function migrateState(raw: unknown): PersistedState {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    let state = raw as Record<string, unknown>
    if (state.version === 1) state = fromV1(state)
    if (state.version === 2) state = fromV2(state)
    if (state.version === SCHEMA_VERSION) return sanitizeState(state)
  }
  return defaultState()
}

// v1 → v2: stats and confusions went from shared to per preset (§5). The
// shared ones can't be split after the fact, so they are dropped and every
// preset's stats start empty; progress, daily time and settings carry over.
// v1's per-preset pass windows went too — passing now reads the stats — so
// the sanitizer drops them, and with them any pass a degree was partway to.
function fromV1(state: Record<string, unknown>): Record<string, unknown> {
  const { degreeStats: _stats, confusions: _confusions, ...rest } = state
  return { ...rest, version: 2, presetStats: {}, confusions: [] }
}

// v2 → v3: the all-time totals (§5). Nothing before them recorded which
// preset or mode time was spent in, so they start at zero; the daily time
// stays as it was.
function fromV2(state: Record<string, unknown>): Record<string, unknown> {
  return { ...state, version: 3, totals: {} }
}
