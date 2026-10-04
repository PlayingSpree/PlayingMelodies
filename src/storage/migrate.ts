// Migration into the current schema version (DESIGN.md §8). There is only v1
// so far; the hook exists from the first persisted byte so later schema churn
// stays cheap — upgrades chain here (v1 → v2 → …) before the final sanitize.

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
    const state = raw as Record<string, unknown>
    if (state.version === SCHEMA_VERSION) return sanitizeState(state)
  }
  return defaultState()
}
