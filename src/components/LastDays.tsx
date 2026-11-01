// The Report's last 30 days (DESIGN.md §7.4): this week against last week,
// then a dot per practiced day in the mode's own measure — percent right in
// Notes, percent clean in Melody, Speed's average right-answer time — with
// passes marked in Notes. Tapping a day shows its line. One axis only:
// minutes live in that line, never on the chart.

import { useState } from 'react'
import {
  buildHistory,
  parseDateKey,
  SPEED_LIMIT_MS,
  type DailyRecords,
  type HistoryDay,
  type Mode,
} from '../practice'
import type { PresetId } from '../theory'
import { cx } from './cx'
import { formatDuration, formatSeconds } from './labels'
import { Card, SectionLabel } from './ui'

// The chart's own coordinates; the SVG scales to the card's width.
const WIDTH = 320
const PLOT_LEFT = 34
const PLOT_RIGHT = WIDTH - 6
const PLOT_TOP = 8
const PLOT_BOTTOM = 112
const MARK_Y = 124 // pass markers, under the plot
const HEIGHT = 132

function formatMeasure(mode: Mode, value: number | null): string {
  if (value === null) return '—'
  return mode === 'speed' ? formatSeconds(value) : `${Math.round(value * 100)}%`
}

function dayLabel(date: string): string {
  return parseDateKey(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function dayLine(mode: Mode, day: HistoryDay): string {
  const tally = day.tally
  if (tally === null) return dayLabel(day.date)
  const parts = [dayLabel(day.date), `${tally.answered} answered`]
  if (mode !== 'speed') {
    const share = formatMeasure(mode, day.measure)
    parts.push(`${share} ${mode === 'melody' ? 'clean' : 'right'}`)
  }
  if (tally.rightTimed > 0) {
    parts.push(`avg ${formatSeconds(tally.rightTimeMs / tally.rightTimed)}`)
  }
  parts.push(formatDuration(tally.activeMs))
  return parts.join(' · ')
}

export function LastDays({
  records,
  preset,
  mode,
  todayKey,
}: {
  records: DailyRecords
  preset: PresetId
  mode: Mode
  todayKey: string
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const { days, thisWeek, lastWeek } = buildHistory(
    records,
    preset,
    mode,
    todayKey,
  )
  const measured = days.filter((day) => day.measure !== null)
  const latest = measured.at(-1)
  if (latest === undefined) return null
  const selected = days.find((day) => day.date === picked) ?? latest

  // Percent runs 0–100%; Speed 0 to its limit, where lower is better.
  const top = mode === 'speed' ? SPEED_LIMIT_MS : 1
  const columnWidth = (PLOT_RIGHT - PLOT_LEFT) / days.length
  const x = (i: number) => PLOT_LEFT + columnWidth * (i + 0.5)
  const y = (value: number) =>
    PLOT_BOTTOM - (Math.min(value, top) / top) * (PLOT_BOTTOM - PLOT_TOP)
  const ticks: [number, string][] =
    mode === 'speed'
      ? [
          [0, '0 s'],
          [top / 2, `${top / 2000} s`],
          [top, `${top / 1000} s`],
        ]
      : [
          [0, '0%'],
          [0.5, '50%'],
          [1, '100%'],
        ]
  const passes = mode === 'notes' && days.some((day) => day.tally?.passed)

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Last {days.length} days</SectionLabel>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-col">
          <span className="text-lg font-extrabold tabular-nums">
            This week {formatMeasure(mode, thisWeek)}
            <span className="text-ink-soft">
              {' '}
              · last week {formatMeasure(mode, lastWeek)}
            </span>
          </span>
          {mode === 'speed' && (
            <span className="text-sm font-semibold text-ink-muted">
              Average time of right answers · lower is better
            </span>
          )}
        </div>

        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={`Last ${days.length} days, ${measured.length} practiced`}
        >
          {days.map((day, i) =>
            day.date === selected.date ? (
              <rect
                key="selected"
                x={x(i) - columnWidth / 2}
                y={PLOT_TOP - 4}
                width={columnWidth}
                height={HEIGHT - PLOT_TOP + 4}
                rx={3}
                className="fill-track"
              />
            ) : null,
          )}
          {ticks.map(([value, label]) => (
            <g key={label}>
              <line
                x1={PLOT_LEFT}
                x2={PLOT_RIGHT}
                y1={y(value)}
                y2={y(value)}
                strokeWidth={1}
                className="stroke-muted-border"
              />
              <text
                x={PLOT_LEFT - 6}
                y={y(value)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                className="fill-ink-muted"
              >
                {label}
              </text>
            </g>
          ))}
          {/* Lines join consecutive practiced days only; a gap stays a gap. */}
          {days.map((day, i) => {
            const prev = days[i - 1]
            if (day.measure === null || prev?.measure == null) return null
            return (
              <line
                key={`line-${day.date}`}
                x1={x(i - 1)}
                y1={y(prev.measure)}
                x2={x(i)}
                y2={y(day.measure)}
                strokeWidth={2}
                strokeLinecap="round"
                className="stroke-primary-light"
              />
            )
          })}
          {days.map((day, i) =>
            day.measure === null ? null : (
              <circle
                key={`dot-${day.date}`}
                cx={x(i)}
                cy={y(day.measure)}
                r={day.date === selected.date ? 5 : 4}
                strokeWidth={2}
                className={cx(
                  'fill-primary-light',
                  day.date === selected.date ? 'stroke-ink' : 'stroke-card',
                )}
              />
            ),
          )}
          {mode === 'notes' &&
            days.map((day, i) =>
              day.tally?.passed ? (
                <path
                  key={`pass-${day.date}`}
                  d={`M ${x(i)} ${MARK_Y - 4} l 4 7 h -8 z`}
                  className="fill-info"
                />
              ) : null,
            )}
          {/* Hit targets: a full column per day, wider than any mark. */}
          {days.map((day, i) => (
            <rect
              key={`hit-${day.date}`}
              x={x(i) - columnWidth / 2}
              y={0}
              width={columnWidth}
              height={HEIGHT}
              fill="transparent"
              className={day.measure === null ? undefined : 'cursor-pointer'}
              onClick={() => {
                if (day.measure !== null) setPicked(day.date)
              }}
            />
          ))}
        </svg>

        <div className="flex justify-between text-xs font-semibold text-ink-muted">
          <span>{dayLabel(days[0]?.date ?? todayKey)}</span>
          {passes && (
            <span>
              <span className="text-info">▲</span> degree passed
            </span>
          )}
          <span>Today</span>
        </div>

        <span className="text-sm font-semibold text-ink-soft tabular-nums">
          {dayLine(mode, selected)}
        </span>
      </Card>
    </div>
  )
}
