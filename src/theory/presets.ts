// The built-in presets (DESIGN.md §4): named, ordered degree lists. The order
// is the unlock order and the starting count how much of it a fresh preset
// opens, both kept as data so changing one is a one-line edit. Mix-ups is a
// preset too, but has no fixed degrees: practice/mixups.ts builds them from
// the confusion log.

import { parseDegrees, type Degree } from './degrees'

export type BuiltInPresetId = 'major' | 'minor' | 'chromatic'

export const MIXUPS_ID = 'mixups'

export type PresetId = BuiltInPresetId | typeof MIXUPS_ID

export interface Preset {
  id: PresetId
  name: string
  order: readonly Degree[]
  // How many of `order` a fresh preset opens.
  startUnlocked: number
}

export interface BuiltInPreset extends Preset {
  id: BuiltInPresetId
}

export const PRESETS: readonly BuiltInPreset[] = [
  {
    id: 'major',
    name: 'Major',
    order: parseDegrees('1 5 3 4 6 2 7'),
    startUnlocked: 2,
  },
  {
    id: 'minor',
    name: 'Minor',
    order: parseDegrees('1 5 ♭3 4 ♭6 2 ♭7'),
    startUnlocked: 3,
  },
  {
    id: 'chromatic',
    name: 'Chromatic',
    order: parseDegrees('1 5 3 ♭3 7 ♭7 6 ♭6 4 2 ♭2 ♯4'),
    startUnlocked: 4,
  },
]

export const BUILT_IN_PRESET_IDS: readonly BuiltInPresetId[] = PRESETS.map(
  (preset) => preset.id,
)

// Every id that keeps stats, confusions and totals: Mix-ups included.
export const PRESET_IDS: readonly PresetId[] = [
  ...BUILT_IN_PRESET_IDS,
  MIXUPS_ID,
]

export function isPresetId(value: unknown): value is PresetId {
  return PRESET_IDS.some((id) => id === value)
}

export function isBuiltInPresetId(value: unknown): value is BuiltInPresetId {
  return BUILT_IN_PRESET_IDS.some((id) => id === value)
}

export function getPreset(id: BuiltInPresetId): BuiltInPreset {
  const preset = PRESETS.find((candidate) => candidate.id === id)
  // Unreachable: BuiltInPresetId names exactly the entries above.
  if (preset === undefined) throw new Error(`Unknown preset '${id}'`)
  return preset
}
