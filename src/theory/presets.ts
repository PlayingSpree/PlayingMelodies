// The built-in presets (DESIGN.md §4): named, ordered degree lists. The order
// is the unlock order and the starting count how much of it a fresh preset
// opens, both kept as data so changing one is a one-line edit.

import { parseDegrees, type Degree } from './degrees'

export type PresetId = 'major' | 'minor' | 'chromatic'

export interface Preset {
  id: PresetId
  name: string
  order: readonly Degree[]
  // How many of `order` a fresh preset opens.
  startUnlocked: number
}

export const PRESETS: readonly Preset[] = [
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

export const PRESET_IDS: readonly PresetId[] = PRESETS.map(
  (preset) => preset.id,
)

export function isPresetId(value: unknown): value is PresetId {
  return PRESET_IDS.some((id) => id === value)
}

export function getPreset(id: PresetId): Preset {
  const preset = PRESETS.find((candidate) => candidate.id === id)
  // Unreachable: PresetId names exactly the entries above.
  if (preset === undefined) throw new Error(`Unknown preset '${id}'`)
  return preset
}
