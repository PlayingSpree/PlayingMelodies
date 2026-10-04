// JSON export/import of the whole persisted state (DESIGN.md §2, §7.5):
// localStorage holds the only copy of the player's stats, so the backup is
// all of it. Pure TS — the file download/upload lives in the UI.

import { migrateState } from './migrate'
import { SCHEMA_VERSION, type PersistedState } from './schema'

export const EXPORT_KIND = 'playingmelodies-state'

export function exportStateJson(state: PersistedState): string {
  return JSON.stringify({ kind: EXPORT_KIND, ...state }, null, 2)
}

export type ImportResult =
  { ok: true; state: PersistedState } | { ok: false; error: string }

// Reads an exported file into a state that replaces the current one. Files
// from the same or an older schema version are accepted (and migrated); a
// newer one is refused rather than reset, unlike a newer state found in
// localStorage, since here the player can still choose not to import.
export function parseStateImport(json: string): ImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: 'Not valid JSON.' }
  }
  if (
    typeof raw !== 'object' ||
    raw === null ||
    (raw as Record<string, unknown>).kind !== EXPORT_KIND
  ) {
    return { ok: false, error: 'Not a PlayingMelodies backup file.' }
  }
  const { kind: _kind, ...state } = raw as Record<string, unknown>
  const version = state.version
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    return { ok: false, error: 'The file has no valid schema version.' }
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `The file was exported by a newer app version (schema v${version}; this app reads up to v${SCHEMA_VERSION}).`,
    }
  }
  return { ok: true, state: migrateState(state) }
}
