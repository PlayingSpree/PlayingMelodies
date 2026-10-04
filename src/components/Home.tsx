// Home (DESIGN.md §7.1): the streak and today's minutes against the goal,
// then one card per preset — unlock progress, its degrees' letter grades,
// their stars once Speed is open, and the melody grade once Melody is open.
// Tapping a card opens its session sheet; the gear opens Settings.

import { useState } from 'react'
import {
  computeStreak,
  freshProgress,
  isModeOpen,
  localDateKey,
  melodyGrade,
  starOf,
  windowGrade,
} from '../practice'
import { usePractice, useSettings } from '../store'
import { degreeLabel, PRESETS, type PresetId } from '../theory'
import { cx } from './cx'
import { formatMinutes, gradeLabel, gradeText, STAR_TEXT } from './labels'
import { Card, RaisedButton, SectionLabel } from './ui'

export function Home({
  onOpen,
  onSettings,
}: {
  onOpen: (presetId: PresetId) => void
  onSettings: () => void
}) {
  const records = usePractice((s) => s.records)
  const goal = useSettings((s) => s.settings.goalMinutes)

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

      <SectionLabel>Presets</SectionLabel>
      {PRESETS.map((preset) => {
        const progress =
          records.presetProgress[preset.id] ?? freshProgress(preset)
        const speedOpen = isModeOpen(preset, progress, 'speed')
        const melodyOpen = isModeOpen(preset, progress, 'melody')
        const melody = melodyGrade(progress)
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onOpen(preset.id)}
            className="text-left transition-transform active:translate-y-[2px]"
          >
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold">{preset.name}</span>
                <span className="text-sm font-semibold text-ink-muted">
                  {progress.passed.length} / {preset.order.length} passed
                  {melodyOpen && (
                    <>
                      {' · Melody '}
                      <span className={gradeText(melody)}>
                        {gradeLabel(melody)}
                      </span>
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-1">
                {preset.order.map((degree, i) => {
                  const unlocked = i < progress.unlockedCount
                  const stats = records.degreeStats[degree]
                  const grade = windowGrade(stats.outcomes)
                  const star = starOf(stats.speedTimesMs)
                  return (
                    <div
                      key={degree}
                      className={cx(
                        'flex flex-1 flex-col items-center rounded-lg py-1',
                        progress.passed.includes(degree) && 'bg-primary-tint',
                      )}
                    >
                      <span
                        className={cx(
                          'font-extrabold',
                          unlocked ? 'text-ink' : 'text-ink-faint',
                        )}
                      >
                        {degreeLabel(degree)}
                      </span>
                      <span
                        className={cx(
                          'text-sm font-bold',
                          unlocked ? gradeText(grade) : 'text-ink-faint',
                        )}
                      >
                        {unlocked ? gradeLabel(grade) : '🔒'}
                      </span>
                      {speedOpen && (
                        <span
                          className={cx(
                            'text-sm',
                            star ? STAR_TEXT[star] : 'text-ink-faint',
                          )}
                        >
                          {star ? '★' : '☆'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          </button>
        )
      })}
    </div>
  )
}
