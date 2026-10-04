// The answer pad (DESIGN.md §7.3): all 12 degrees in a fixed, piano-like
// layout — naturals on the bottom row, the flats and sharp raised between
// them. Degrees outside the preset are blank and the not-yet-unlocked ones
// dimmed, but nothing ever moves, so the thumb learns the positions.
//
// The grid is 14 half-columns: each natural spans two, and a raised key
// spans the two either side of the boundary it sits on — so PAD_LAYOUT's
// column c always starts at half-column c + 1.

import { degreeLabel, PAD_LAYOUT, type Degree } from '../theory'
import { cx } from './cx'

export type KeyMark = 'right' | 'wrong' | 'answer'

// One class per property, so a mark never races the base colors.
const MARK_BORDER: Readonly<Record<KeyMark, string>> = {
  right: 'border-primary text-primary-light',
  wrong: 'border-danger text-danger',
  answer: 'border-primary text-primary-light',
}

const MARK_FILL = {
  right: 'bg-primary-tint',
  wrong: 'bg-danger-tint',
} as const

export function Pad({
  inPreset,
  unlocked,
  marks = {},
  onTap,
}: {
  inPreset: ReadonlySet<Degree>
  unlocked: ReadonlySet<Degree>
  marks?: Partial<Record<Degree, KeyMark>>
  onTap: (degree: Degree) => void
}) {
  return (
    <div className="grid touch-manipulation grid-cols-14 grid-rows-[4.5rem_5rem] gap-x-1 gap-y-2 select-none">
      {PAD_LAYOUT.map(({ degree, row, column }) => {
        const place = {
          gridColumn: `${column + 1} / span 2`,
          gridRow: row === 'raised' ? 1 : 2,
        }
        if (!inPreset.has(degree)) {
          return <div key={degree} style={place} aria-hidden />
        }
        const mark = marks[degree]
        return (
          <button
            key={degree}
            type="button"
            style={place}
            onClick={() => onTap(degree)}
            aria-label={`Degree ${degreeLabel(degree)}`}
            className={cx(
              'rounded-2xl border-2 text-2xl font-extrabold shadow-hard-sm transition-transform active:translate-y-[2px]',
              mark === undefined ? 'border-card-border' : MARK_BORDER[mark],
              mark === 'right' || mark === 'wrong'
                ? MARK_FILL[mark]
                : row === 'raised'
                  ? 'bg-track'
                  : 'bg-card',
              !unlocked.has(degree) && mark === undefined && 'opacity-40',
            )}
          >
            {degreeLabel(degree)}
          </button>
        )
      })}
    </div>
  )
}
