// The versioned localStorage schema (DESIGN.md §8), currently v1. Pure TS:
// the persisted shape, its defaults, and sanitizers that coerce unknown data
// (hand-edited, stale, corrupted, imported) into a valid state field by field,
// so one bad record never costs the player the rest. Reading and writing
// localStorage happens only in localStorageAdapter.ts.

import {
  CONFUSION_LOG_SIZE,
  DATE_KEY_PATTERN,
  DEFAULT_SESSION_OPTIONS,
  DEFAULT_SETTINGS,
  emptyStatsMap,
  freshProgress,
  MELODY_WINDOW,
  OUTCOME_WINDOW,
  PASS_WINDOW,
  sanitizeSessionOptions,
  sanitizeSettings,
  SPEED_LIMIT_MS,
  SPEED_WINDOW,
  type Confusion,
  type DailyRecord,
  type DailyRecords,
  type DegreeStats,
  type DegreeStatsMap,
  type PresetProgress,
  type SessionOptions,
  type Settings,
} from '../practice'
import {
  DEGREES,
  getPreset,
  isDegree,
  PRESET_IDS,
  type Degree,
  type PresetId,
} from '../theory'

export const SCHEMA_VERSION = 1

// The single versioned key. The version lives *inside* the payload, so a
// migration reads one blob, checks `version` and upgrades in a chain.
export const STATE_STORAGE_KEY = 'playingmelodies:state'

export interface PersistedState {
  version: typeof SCHEMA_VERSION
  settings: Settings
  degreeStats: DegreeStatsMap
  confusions: readonly Confusion[]
  // Absent means the preset was never played: it opens fresh.
  presetProgress: Readonly<Partial<Record<PresetId, PresetProgress>>>
  dailyRecords: DailyRecords
  // The session sheet's last choices, which it opens on (§7.2).
  lastOptions: SessionOptions
}

export function defaultState(): PersistedState {
  return {
    version: SCHEMA_VERSION,
    settings: DEFAULT_SETTINGS,
    degreeStats: emptyStatsMap(),
    confusions: [],
    presetProgress: {},
    dailyRecords: {},
    lastOptions: DEFAULT_SESSION_OPTIONS,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

// The last `size` entries that pass `keep`, oldest first.
function sanitizeWindow<T>(
  value: unknown,
  keep: (entry: unknown) => entry is T,
  size: number,
): T[] {
  return asArray(value).filter(keep).slice(-size)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isSpeedTime(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= SPEED_LIMIT_MS
  )
}

function sanitizeDegreeStats(value: unknown): DegreeStats {
  const raw = asRecord(value)
  return {
    outcomes: sanitizeWindow(raw.outcomes, isBoolean, OUTCOME_WINDOW),
    speedTimesMs: sanitizeWindow(raw.speedTimesMs, isSpeedTime, SPEED_WINDOW),
  }
}

export function sanitizeDegreeStatsMap(value: unknown): DegreeStatsMap {
  const raw = asRecord(value)
  const map = emptyStatsMap() as Record<Degree, DegreeStats>
  for (const degree of DEGREES) {
    if (degree in raw) map[degree] = sanitizeDegreeStats(raw[degree])
  }
  return map
}

function isConfusion(value: unknown): value is Confusion {
  const raw = asRecord(value)
  return (
    isDegree(raw.played) && isDegree(raw.tapped) && raw.played !== raw.tapped
  )
}

export function sanitizeConfusions(value: unknown): Confusion[] {
  return sanitizeWindow(value, isConfusion, CONFUSION_LOG_SIZE).map(
    ({ played, tapped }) => ({ played, tapped }),
  )
}

// A preset's record, held to its own invariants: the unlocked count within
// the preset, and pass windows and passes only for degrees that are open.
export function sanitizePresetProgress(
  id: PresetId,
  value: unknown,
): PresetProgress {
  const preset = getPreset(id)
  const fresh = freshProgress(preset)
  const raw = asRecord(value)
  const count = raw.unlockedCount
  const unlockedCount =
    typeof count === 'number' && Number.isInteger(count)
      ? Math.min(Math.max(count, fresh.unlockedCount), preset.order.length)
      : fresh.unlockedCount
  const open = preset.order.slice(0, unlockedCount)

  const rawWindows = asRecord(raw.passWindows)
  const passWindows: Partial<Record<Degree, boolean[]>> = {}
  for (const degree of open) {
    if (degree in rawWindows) {
      passWindows[degree] = sanitizeWindow(
        rawWindows[degree],
        isBoolean,
        PASS_WINDOW,
      )
    }
  }
  const rawPassed = new Set(asArray(raw.passed))
  return {
    unlockedCount,
    passWindows,
    passed: open.filter((degree) => rawPassed.has(degree)),
    melodyOutcomes: sanitizeWindow(
      raw.melodyOutcomes,
      isBoolean,
      MELODY_WINDOW,
    ),
  }
}

export function sanitizePresetProgressMap(
  value: unknown,
): Partial<Record<PresetId, PresetProgress>> {
  const raw = asRecord(value)
  const map: Partial<Record<PresetId, PresetProgress>> = {}
  for (const id of PRESET_IDS) {
    if (id in raw) map[id] = sanitizePresetProgress(id, raw[id])
  }
  return map
}

export function sanitizeDailyRecords(value: unknown): DailyRecords {
  const records: Record<string, DailyRecord> = {}
  for (const [key, entry] of Object.entries(asRecord(value))) {
    const minutes = asRecord(entry).activeMinutes
    if (
      DATE_KEY_PATTERN.test(key) &&
      typeof minutes === 'number' &&
      Number.isFinite(minutes) &&
      minutes >= 0
    ) {
      records[key] = { date: key, activeMinutes: minutes }
    }
  }
  return records
}

// A v1 payload, field by field.
export function sanitizeState(raw: Record<string, unknown>): PersistedState {
  return {
    version: SCHEMA_VERSION,
    settings: sanitizeSettings(raw.settings),
    degreeStats: sanitizeDegreeStatsMap(raw.degreeStats),
    confusions: sanitizeConfusions(raw.confusions),
    presetProgress: sanitizePresetProgressMap(raw.presetProgress),
    dailyRecords: sanitizeDailyRecords(raw.dailyRecords),
    lastOptions: sanitizeSessionOptions(raw.lastOptions),
  }
}
