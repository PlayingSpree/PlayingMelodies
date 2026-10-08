// The Report (DESIGN.md §7.4): accuracy; the preset's all-time totals in this
// mode; the ratings this mode feeds, before and after; the top 3 confusions;
// anything newly passed or unlocked; the average response time; and the goal
// line.

import { useState, type ReactNode } from 'react'
import {
  computeStreak,
  localDateKey,
  sessionReport,
  totalsOf,
  type Grade,
  type RatingChange,
  type Star,
  type Totals,
} from '../practice'
import { practiceStore, usePractice, useSettings } from '../store'
import { degreeLabel, type Degree } from '../theory'
import { cx } from './cx'
import {
  formatDuration,
  formatMinutes,
  formatSeconds,
  gradeLabel,
  gradeText,
  MODE_LABELS,
  STAR_TEXT,
} from './labels'
import { Card, Chip, RaisedButton, SectionLabel } from './ui'

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  )
}

function GradeText({ grade }: { grade: Grade | null }) {
  return <span className={gradeText(grade)}>{gradeLabel(grade)}</span>
}

function StarText({ star }: { star: Star | null }) {
  return (
    <span className={star ? STAR_TEXT[star] : 'text-ink-faint'}>
      {star ? '★' : '☆'}
    </span>
  )
}

function Changes<T>({
  changes,
  render,
}: {
  changes: RatingChange<T>[]
  render: (rating: T | null) => ReactNode
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-lg font-bold">
      {changes.map(({ degree, before, after }) => (
        <div key={degree} className="contents">
          <span className="text-ink">{degreeLabel(degree)}</span>
          <span>
            {before === after ? (
              render(after)
            ) : (
              <>
                <span className="opacity-60">{render(before)}</span>
                <span className="text-ink-faint"> → </span>
                {render(after)}
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

function AllTime({ totals }: { totals: Totals }) {
  const { sessions, answered, correct, activeMs } = totals
  const cells: [string, string][] = [
    [sessions.toLocaleString(), sessions === 1 ? 'session' : 'sessions'],
    [answered.toLocaleString(), 'answered'],
    [
      answered === 0 ? '—' : `${Math.round((correct / answered) * 100)}%`,
      'right',
    ],
    [formatDuration(activeMs), 'practiced'],
  ]
  return (
    <Card className="grid grid-cols-4 gap-2 p-4 text-center">
      {cells.map(([value, label]) => (
        <div key={label} className="flex flex-col">
          <span className="text-lg font-extrabold tabular-nums">{value}</span>
          <span className="text-sm font-semibold text-ink-soft">{label}</span>
        </div>
      ))}
    </Card>
  )
}

function Degrees({ degrees }: { degrees: Degree[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {degrees.map((degree) => (
        <Chip key={degree} tone="info" className="px-3 py-1 font-extrabold">
          {degreeLabel(degree)}
        </Chip>
      ))}
    </div>
  )
}

export function Report() {
  const session = usePractice((s) => s.session)
  const dailyRecords = usePractice((s) => s.records.dailyRecords)
  const allTotals = usePractice((s) => s.records.totals)
  const goal = useSettings((s) => s.settings.goalMinutes)
  // Read once per mount; Home and the Report remount after every session.
  const [todayKey] = useState(() => localDateKey(new Date()))
  if (session === null) return null

  const report = sessionReport(session)
  const { preset, options } = session.setup
  const today = dailyRecords[todayKey]?.activeMinutes ?? 0
  const streak = computeStreak(dailyRecords, goal, todayKey)
  const { ratings } = report
  const totals = totalsOf(allTotals, preset.id, options.mode)
  const { close, start } = practiceStore.getState()

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold tracking-tight">
        {preset.name} · {MODE_LABELS[options.mode]}
      </h1>

      <Card className="flex items-baseline justify-between p-5">
        <span className="text-5xl font-extrabold tabular-nums">
          {report.accuracy === null
            ? '—'
            : `${Math.round(report.accuracy * 100)}%`}
        </span>
        <span className="text-right font-semibold text-ink-soft">
          {report.correct} of {report.answered} right
          {report.averageTimeMs !== null && (
            <>
              <br />
              avg {formatSeconds(report.averageTimeMs)}
            </>
          )}
        </span>
      </Card>

      <Section label="All time">
        <AllTime totals={totals} />
      </Section>

      {report.newlyPassed.length > 0 && (
        <Section label="Newly passed">
          <Degrees degrees={report.newlyPassed} />
        </Section>
      )}
      {report.newlyUnlocked.length > 0 && (
        <Section label="Unlocked">
          <Degrees degrees={report.newlyUnlocked} />
        </Section>
      )}

      {ratings.kind === 'grades' && ratings.changes.length > 0 && (
        <Section label="Grades">
          <Changes
            changes={ratings.changes}
            render={(grade) => <GradeText grade={grade} />}
          />
        </Section>
      )}
      {ratings.kind === 'stars' && ratings.changes.length > 0 && (
        <Section label="Stars">
          <Changes
            changes={ratings.changes}
            render={(star) => <StarText star={star} />}
          />
        </Section>
      )}
      {ratings.kind === 'melody' && (
        <Section label="Melody grade">
          <span className="text-lg font-bold">
            <GradeText grade={ratings.after} />
            {ratings.before !== ratings.after && (
              <span className="text-ink-faint">
                {' '}
                (was <GradeText grade={ratings.before} />)
              </span>
            )}
          </span>
        </Section>
      )}

      {report.confusions.length > 0 && (
        <Section label="Mixed up">
          <ul className="flex flex-col gap-1 text-lg font-bold">
            {report.confusions.map(({ low, high, count }) => (
              <li key={`${low}:${high}`}>
                {degreeLabel(low)} ↔ {degreeLabel(high)}
                <span className="text-ink-muted"> ×{count}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Card className="flex items-baseline justify-between p-4">
        <span
          className={cx(
            'font-extrabold',
            today >= goal ? 'text-primary-light' : 'text-ink',
          )}
        >
          {formatMinutes(today)} / {goal} min today
        </span>
        <span className="font-semibold text-ink-soft">
          {streak > 0 ? `🔥 ${streak}` : ''}
        </span>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <RaisedButton variant="outline" size="lg" onClick={close}>
          Done
        </RaisedButton>
        {/* Starts from this tap, which keeps iOS audio unlocked (§2). */}
        <RaisedButton
          variant="primary"
          size="lg"
          onClick={() => start(preset.id, options)}
        >
          Again
        </RaisedButton>
      </div>
    </div>
  )
}
