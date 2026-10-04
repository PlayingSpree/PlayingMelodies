// Scale degrees (DESIGN.md §3): the 12 chromatic degrees above the tonic, the
// unit everything is asked, answered and tracked in. A degree is its distance
// from the tonic in semitones, written with ♭/♯ — never as a note name.

export type Degree = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

export const DEGREES: readonly Degree[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

const LABELS: Readonly<Record<Degree, string>> = {
  0: '1',
  1: '♭2',
  2: '2',
  3: '♭3',
  4: '3',
  5: '4',
  6: '♯4',
  7: '5',
  8: '♭6',
  9: '6',
  10: '♭7',
  11: '7',
}

export function degreeLabel(degree: Degree): string {
  return LABELS[degree]
}

export function isDegree(value: unknown): value is Degree {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < 12
  )
}

const BY_LABEL: ReadonlyMap<string, Degree> = new Map(
  DEGREES.map((degree) => [LABELS[degree], degree]),
)

// A space-separated label list ('1 5 ♭3 4') as degrees — how presets are
// written, so their data reads the way the spec's tables do. Throws on an
// unknown label: it is only ever fed source-code constants.
export function parseDegrees(labels: string): Degree[] {
  return labels
    .trim()
    .split(/\s+/)
    .map((label) => {
      const degree = BY_LABEL.get(label)
      if (degree === undefined) throw new Error(`Unknown degree '${label}'`)
      return degree
    })
}

// One key of the answer pad (§7.3). The naturals 1–7 sit on the bottom row in
// the even columns 0, 2 … 12; the flats and sharp are raised into the odd
// column between their neighbors, the way a piano's black keys sit.
export interface PadKey {
  degree: Degree
  row: 'natural' | 'raised'
  column: number
}

export const PAD_COLUMNS = 13

export const PAD_LAYOUT: readonly PadKey[] = [
  { degree: 0, row: 'natural', column: 0 },
  { degree: 1, row: 'raised', column: 1 },
  { degree: 2, row: 'natural', column: 2 },
  { degree: 3, row: 'raised', column: 3 },
  { degree: 4, row: 'natural', column: 4 },
  { degree: 5, row: 'natural', column: 6 },
  { degree: 6, row: 'raised', column: 7 },
  { degree: 7, row: 'natural', column: 8 },
  { degree: 8, row: 'raised', column: 9 },
  { degree: 9, row: 'natural', column: 10 },
  { degree: 10, row: 'raised', column: 11 },
  { degree: 11, row: 'natural', column: 12 },
]
