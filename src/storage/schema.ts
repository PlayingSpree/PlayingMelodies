// The versioned localStorage schema (DESIGN.md §8), currently v3. Pure TS:
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
  MODES,
  OUTCOME_WINDOW,
  sanitizeSessionOptions,
  sanitizeSettings,
  SPEED_LIMIT_MS,
  SPEED_WINDOW,
  type DailyRecord,
  type DailyRecords,
  type Mode,
  type DegreeStats,
  type DegreeStatsMap,
  type LoggedConfusion,
  type PresetProgress,
  type PresetStatsMap,
  type SessionOptions,
  type Settings,
  type Totals,
  type TotalsMap,
} from '../practice'
import {
  BUILT_IN_PRESET_IDS,
  DEGREES,
  getPreset,
  isDegree,
  isPresetId,
  PRESET_IDS,
  type BuiltInPresetId,
  type Degree,
  type PresetId,
} from '../theory'

// v2 keeps stats and confusions per preset (spec 0.13.0); v1 shared them.
// v3 adds the all-time totals (spec 0.16.0).
export const SCHEMA_VERSION = 3

// The single versioned key. The version lives *inside* the payload, so a
// migration reads one blob, checks `version` and upgrades in a chain.
export const STATE_STORAGE_KEY = 'playingmelodies:state'

export interface PersistedState {
  version: typeof SCHEMA_VERSION
  settings: Settings
  // Absent means the preset has no stats yet.
  presetStats: PresetStatsMap
  confusions: readonly LoggedConfusion[]
  // Absent means the preset was never played: it opens fresh. Mix-ups has
  // none; it opens fresh every session.
  presetProgress: Readonly<Partial<Record<BuiltInPresetId, PresetProgress>>>
  // Absent means the preset was never played in that mode.
  totals: TotalsMap
  dailyRecords: DailyRecords
  // The session sheet's last choices, which it opens on (§7.2).
  lastOptions: SessionOptions
}

export function defaultState(): PersistedState {
  return {
    version: SCHEMA_VERSION,
    settings: DEFAULT_SETTINGS,
    presetStats: {},
    confusions: [],
    presetProgress: {},
    totals: {},
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

export function sanitizePresetStatsMap(value: unknown): PresetStatsMap {
  const raw = asRecord(value)
  const map: Partial<Record<PresetId, DegreeStatsMap>> = {}
  for (const id of PRESET_IDS) {
    if (id in raw) map[id] = sanitizeDegreeStatsMap(raw[id])
  }
  return map
}

function isConfusion(value: unknown): value is LoggedConfusion {
  const raw = asRecord(value)
  return (
    isPresetId(raw.preset) &&
    isDegree(raw.played) &&
    isDegree(raw.tapped) &&
    raw.played !== raw.tapped
  )
}

export function sanitizeConfusions(value: unknown): LoggedConfusion[] {
  return sanitizeWindow(value, isConfusion, CONFUSION_LOG_SIZE).map(
    ({ preset, played, tapped }) => ({ preset, played, tapped }),
  )
}

// A preset's record, held to its own invariants: the unlocked count within
// the preset, and passes only for degrees that are open.
export function sanitizePresetProgress(
  id: BuiltInPresetId,
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

  const rawPassed = new Set(asArray(raw.passed))
  return {
    unlockedCount,
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
): Partial<Record<BuiltInPresetId, PresetProgress>> {
  const raw = asRecord(value)
  const map: Partial<Record<BuiltInPresetId, PresetProgress>> = {}
  for (const id of BUILT_IN_PRESET_IDS) {
    if (id in raw) map[id] = sanitizePresetProgress(id, raw[id])
  }
  return map
}

function asCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : 0
}

// Each count on its own; right answers are held to the answers.
function sanitizeTotals(value: unknown): Totals {
  const raw = asRecord(value)
  const answered = asCount(raw.answered)
  const activeMs = raw.activeMs
  return {
    sessions: asCount(raw.sessions),
    answered,
    correct: Math.min(asCount(raw.correct), answered),
    activeMs:
      typeof activeMs === 'number' && Number.isFinite(activeMs) && activeMs > 0
        ? activeMs
        : 0,
  }
}

export function sanitizeTotalsMap(value: unknown): TotalsMap {
  const raw = asRecord(value)
  const map: Partial<Record<PresetId, Partial<Record<Mode, Totals>>>> = {}
  for (const id of PRESET_IDS) {
    if (!(id in raw)) continue
    const modes = asRecord(raw[id])
    const preset: Partial<Record<Mode, Totals>> = {}
    for (const mode of MODES) {
      if (mode in modes) preset[mode] = sanitizeTotals(modes[mode])
    }
    map[id] = preset
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

// A v3 payload, field by field.
export function sanitizeState(raw: Record<string, unknown>): PersistedState {
  return {
    version: SCHEMA_VERSION,
    settings: sanitizeSettings(raw.settings),
    presetStats: sanitizePresetStatsMap(raw.presetStats),
    confusions: sanitizeConfusions(raw.confusions),
    presetProgress: sanitizePresetProgressMap(raw.presetProgress),
    totals: sanitizeTotalsMap(raw.totals),
    dailyRecords: sanitizeDailyRecords(raw.dailyRecords),
    lastOptions: sanitizeSessionOptions(raw.lastOptions),
  }
}
