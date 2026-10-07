// Home (DESIGN.md §7.1): the streak and today's minutes against the goal,
// then a tab per mode, each with one card per preset showing that mode's
// ratings: Notes its letter grades, Speed its stars, Melody its melody grade.
// Tapping an open card opens its session sheet in the tab's mode; a card
// whose mode is still locked says what opens it. The gear opens Settings. A
// card on top offers a reload when a new version of the app is waiting.

import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  computeStreak,
  freshProgress,
  isModeOpen,
  localDateKey,
  MELODY_OPENS_AT,
  melodyGrade,
  MODES,
  presetGrade,
  presetStar,
  starOf,
  statsOf,
  windowGrade,
  type Grade,
  type Mode,
  type Star,
} from '../practice'
import { reloadToUpdate, useUpdateReady } from '../pwa'
import { practiceStore, usePractice, useSettings } from '../store'
import { degreeLabel, PRESETS, type Preset, type PresetId } from '../theory'
import { cx } from './cx'
import {
  formatMinutes,
  gradeLabel,
  gradeText,
  MODE_LABELS,
  STAR_TEXT,
} from './labels'
import { Card, RaisedButton, Tabs } from './ui'

export function Home({
  onOpen,
  onSettings,
}: {
  onOpen: (presetId: PresetId) => void
  onSettings: () => void
}) {
  const records = usePractice((s) => s.records)
  const goal = useSettings((s) => s.settings.goalMinutes)
  // The open tab is the session sheet's remembered mode (§7.1).
  const mode = usePractice((s) => s.lastOptions.mode)
  const updateReady = useUpdateReady()

  // Read once per mount; Home and the Report remount after every session.
  const [todayKey] = useState(() => localDateKey(new Date()))
  const today = records.dailyRecords[todayKey]?.activeMinutes ?? 0
  const streak = computeStreak(records.dailyRecords, goal, todayKey)
  const goalShare = Math.min(1, today / goal)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-3xl font-extrabold tracking-tight">
            PlayingMelodies
          </h1>
          <span className="text-xs font-semibold text-ink-faint">
            v{__APP_VERSION__}
            {__APP_BRANCH__ &&
              __APP_BRANCH__ !== 'master' &&
              ` · ${__APP_BRANCH__}`}
          </span>
        </div>
        <RaisedButton size="sm" aria-label="Settings" onClick={onSettings}>
          ⚙
        </RaisedButton>
      </header>

      {updateReady && (
        <Card className="flex items-center justify-between gap-3 border-info-border bg-info-tint p-4">
          <span className="font-semibold text-info-light">Update ready</span>
          <RaisedButton size="sm" variant="primary" onClick={reloadToUpdate}>
            Reload
          </RaisedButton>
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-extrabold">
            {streak > 0 ? `🔥 ${streak}-day streak` : 'No streak yet'}
          </span>
          <span className="font-semibold text-ink-soft tabular-nums">
            {formatMinutes(today)} / {goal} min today
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${goalShare * 100}%` }}
          />
        </div>
      </Card>

      <Tabs
        tabs={MODES.map((id) => ({ id, label: MODE_LABELS[id] }))}
        value={mode}
        onChange={(id) => practiceStore.getState().chooseMode(id)}
      />
      {PRESETS.map((preset) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          mode={mode}
          onOpen={() => onOpen(preset.id)}
        />
      ))}
    </div>
  )
}

function GradeMark({ grade }: { grade: Grade | null }) {
  return <span className={gradeText(grade)}>{gradeLabel(grade)}</span>
}

// A star, an empty one for rated without a star, or "—" for not yet rated.
function StarMark({ star }: { star: Star | 'none' | null }) {
  if (star === null) return <span className="text-ink-soft">—</span>
  if (star === 'none') return <span className="text-ink-faint">☆</span>
  return <span className={STAR_TEXT[star]}>★</span>
}

function PresetCard({
  preset,
  mode,
  onOpen,
}: {
  preset: Preset
  mode: Mode
  onOpen: () => void
}) {
  const stats = usePractice((s) => statsOf(s.records.presetStats, preset.id))
  // Defaulted outside the selector: a fresh object per call would re-render
  // forever.
  const progress =
    usePractice((s) => s.records.presetProgress[preset.id]) ??
    freshProgress(preset)
  const open = isModeOpen(preset, progress, mode)
  const passed = progress.passed.length
  const total = preset.order.length

  let rating: ReactNode
  let detail: string
  switch (mode) {
    case 'notes':
      rating = <GradeMark grade={presetGrade(preset, progress, stats)} />
      detail = `${passed} / ${total} passed`
      break
    case 'speed':
      rating = <StarMark star={presetStar(preset, stats)} />
      detail = `${
        preset.order.filter((d) => starOf(stats[d].speedTimesMs) !== null)
          .length
      } / ${total} starred`
      break
    case 'melody': {
      const melodies = progress.melodyOutcomes
      rating = <GradeMark grade={melodyGrade(progress)} />
      detail =
        melodies.length === 0
          ? 'No melodies yet'
          : `${melodies.filter(Boolean).length} / ${melodies.length} clean`
      break
    }
  }
  if (!open) {
    rating = '🔒'
    detail =
      mode === 'speed'
        ? `Pass all ${total} in Notes · ${passed} / ${total}`
        : `Pass ${MELODY_OPENS_AT} in Notes · ${Math.min(passed, MELODY_OPENS_AT)} / ${MELODY_OPENS_AT}`
  }

  const card = (
    <Card className={cx('flex flex-col gap-3 p-4', !open && 'opacity-60')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xl font-extrabold">{preset.name}</span>
          <span className="text-sm font-semibold text-ink-muted">{detail}</span>
        </div>
        <span className="text-3xl font-extrabold">{rating}</span>
      </div>
      <div className="flex justify-between gap-1">
        {preset.order.map((degree, i) => (
          <DegreeCell
            key={degree}
            label={degreeLabel(degree)}
            mode={mode}
            unlocked={i < progress.unlockedCount}
            passed={progress.passed.includes(degree)}
            grade={windowGrade(stats[degree].outcomes)}
            star={starOf(stats[degree].speedTimesMs)}
          />
        ))}
      </div>
    </Card>
  )
  if (!open) return card
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left transition-transform active:translate-y-[2px]"
    >
      {card}
    </button>
  )
}

// One degree on a card, rated the way the tab rates: Notes its letter grade
// (locked ones show a lock), Speed its star, Melody whether it has passed —
// the degrees melodies are made from.
function DegreeCell({
  label,
  mode,
  unlocked,
  passed,
  grade,
  star,
}: {
  label: string
  mode: Mode
  unlocked: boolean
  passed: boolean
  grade: Grade | null
  star: Star | null
}) {
  const lit = mode === 'speed' || (mode === 'melody' ? passed : unlocked)
  return (
    <div
      className={cx(
        'flex flex-1 flex-col items-center rounded-lg py-1',
        mode !== 'speed' && passed && 'bg-primary-tint',
      )}
    >
      <span
        className={cx('font-extrabold', lit ? 'text-ink' : 'text-ink-faint')}
      >
        {label}
      </span>
      {mode === 'notes' && (
        <span
          className={cx(
            'text-sm font-bold',
            unlocked ? gradeText(grade) : 'text-ink-faint',
          )}
        >
          {unlocked ? gradeLabel(grade) : '🔒'}
        </span>
      )}
      {mode === 'speed' && (
        <span
          className={cx('text-sm', star ? STAR_TEXT[star] : 'text-ink-faint')}
        >
          {star ? '★' : '☆'}
        </span>
      )}
    </div>
  )
}
