// Shared UI primitives, ported from PlayingChord (DESIGN.md §7: the same
// visual language): chunky 2px-bordered rounded panels with a hard offset
// shadow on a dark navy surface, green primary action. Pure presentation —
// no store or audio knowledge.
//
// Convention: base classes deliberately omit padding and text-size so callers
// supply them via `className` without fighting Tailwind's utility ordering.

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

// A raised panel: 2px border, hard offset shadow, rounded. Padding is the
// caller's.
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        'rounded-[20px] border-2 border-card-border bg-card shadow-hard',
        className,
      )}
      {...rest}
    />
  )
}

// The small uppercase tracking label above a group.
export function SectionLabel({
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx(
        'text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-muted',
        className,
      )}
      {...rest}
    />
  )
}

type RaisedVariant = 'primary' | 'outline' | 'raised'
type RaisedSize = 'sm' | 'md' | 'lg'

const RAISED_VARIANTS: Record<RaisedVariant, string> = {
  // Green fill with a green hard shadow — the one primary action per screen.
  primary:
    'border-2 border-transparent bg-primary text-primary-ink shadow-primary font-extrabold',
  // Quiet bordered action (Quit, Done).
  outline:
    'border-2 border-muted-border bg-transparent text-ink-muted font-semibold',
  // Card-colored raised control.
  raised:
    'border-2 border-card-border bg-card text-ink-soft shadow-hard-sm font-semibold',
}

const RAISED_SIZES: Record<RaisedSize, string> = {
  sm: 'rounded-[14px] px-4 py-2 text-sm',
  md: 'rounded-[16px] px-4 py-2.5 text-base',
  lg: 'rounded-[18px] px-5 py-3.5 text-xl',
}

// A chunky pressable button. `active:translate-y` presses it into its own
// hard shadow for a tactile feel.
export function RaisedButton({
  variant = 'raised',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: RaisedVariant
  size?: RaisedSize
}) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 transition-transform',
        'active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-50',
        RAISED_VARIANTS[variant],
        RAISED_SIZES[size],
        className,
      )}
      {...rest}
    />
  )
}

type ChipTone = 'default' | 'info' | 'locked'

const CHIP_TONES: Record<ChipTone, { on: string; off: string }> = {
  default: {
    on: 'border-primary bg-primary-tint text-primary-light',
    off: 'border-muted-border bg-surface text-ink-soft',
  },
  info: {
    on: 'border-info-border bg-info-tint text-info-light',
    off: 'border-info-border bg-info-tint text-info-light',
  },
  locked: {
    on: 'border-dashed border-muted-border text-ink-faint',
    off: 'border-dashed border-muted-border text-ink-faint',
  },
}

// A pill: a labeled tag or a selectable segment (the session sheet's choosers).
// Padding + text size come from `className`. Renders a <button> when onClick
// is given, else a <span>.
export function Chip({
  selected = false,
  tone = 'default',
  className,
  onClick,
  children,
  ...rest
}: {
  selected?: boolean
  tone?: ChipTone
  className?: string
  onClick?: () => void
  children?: ReactNode
} & Omit<HTMLAttributes<HTMLElement>, 'onClick' | 'children'>) {
  const palette = CHIP_TONES[tone]
  const classes = cx(
    'inline-flex items-center gap-2 rounded-xl border-2',
    selected ? 'font-extrabold' : 'font-semibold',
    selected ? palette.on : palette.off,
    className,
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} {...rest}>
        {children}
      </button>
    )
  }
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  )
}
