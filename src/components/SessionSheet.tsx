// The session sheet (DESIGN.md §7.2): a bottom sheet over Home for the open
// tab's mode, with the length (Daily: what's left of today's goal), the tonic lock, the tonic change interval, and
// Melody's length and tempo. Home only opens it on a preset where that mode
// is open.

import { useState, type ReactNode } from 'react'
import {
  DEFAULT_SESSION_OPTIONS,
  goalMinutesLeft,
  localDateKey,
  MELODY_LENGTHS,
  PROMPT_COUNTS,
  SESSION_MINUTES,
  TEMPOS,
  TONIC_CHANGE_EVERY,
  type SessionOptions,
} from '../practice'
import { practiceStore, usePractice, useSettings } from '../store'
import { getPreset, type PresetId } from '../theory'
import { formatMinutes, MODE_LABELS, pitchName, TEMPO_LABELS } from './labels'
import { Chip, RaisedButton, SectionLabel } from './ui'

const CHIP = 'px-3 py-1.5 text-sm'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function SessionSheet({
  presetId,
  onClose,
}: {
  presetId: PresetId
  onClose: () => void
}) {
  const preset = getPreset(presetId)
  const dailyRecords = usePractice((s) => s.records.dailyRecords)
  const goal = useSettings((s) => s.settings.goalMinutes)
  const [todayKey] = useState(() => localDateKey(new Date()))
  const left = goalMinutesLeft(dailyRecords, goal, todayKey)
  // The remembered options; their mode is Home's open tab. Daily with the
  // goal met has nothing to run, so the sheet opens on the default length.
  const lastOptions = usePractice((s) => s.lastOptions)
  const [options, setOptions] = useState<SessionOptions>(() =>
    lastOptions.length.kind === 'daily' && left <= 0
      ? { ...lastOptions, length: DEFAULT_SESSION_OPTIONS.length }
      : lastOptions,
  )
  const set = (patch: Partial<SessionOptions>) =>
    setOptions((current) => ({ ...current, ...patch }))

  // Close first, then start, both inside the tap: starting the drone here
  // is what unlocks audio on iOS (§2).
  const start = () => {
    onClose()
    practiceStore.getState().start(presetId, options)
  }

  const { length } = options
  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative mx-auto flex max-h-[90dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-[24px] border-2 border-b-0 border-card-border bg-card px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <h2 className="text-2xl font-extrabold">
          {preset.name}
          <span className="text-ink-muted"> · {MODE_LABELS[options.mode]}</span>
        </h2>

        <Row label="Length">
          {PROMPT_COUNTS.map((count) => (
            <Chip
              key={`p${count}`}
              className={CHIP}
              selected={length.kind === 'prompts' && length.count === count}
              onClick={() => set({ length: { kind: 'prompts', count } })}
            >
              {count}
            </Chip>
          ))}
          {SESSION_MINUTES.map((minutes) => (
            <Chip
              key={`m${minutes}`}
              className={CHIP}
              selected={length.kind === 'minutes' && length.minutes === minutes}
              onClick={() => set({ length: { kind: 'minutes', minutes } })}
            >
              {minutes} min
            </Chip>
          ))}
          {left > 0 ? (
            <Chip
              className={CHIP}
              selected={length.kind === 'daily'}
              onClick={() => set({ length: { kind: 'daily' } })}
            >
              Daily · {formatMinutes(left)} min
            </Chip>
          ) : (
            <Chip className={`${CHIP} opacity-50`}>Goal met</Chip>
          )}
        </Row>

        {options.mode === 'melody' && (
          <>
            <Row label="Melody length">
              {MELODY_LENGTHS.map((melodyLength) => (
                <Chip
                  key={melodyLength}
                  className={CHIP}
                  selected={options.melodyLength === melodyLength}
                  onClick={() => set({ melodyLength })}
                >
                  {melodyLength} notes
                </Chip>
              ))}
            </Row>
            <Row label="Tempo">
              {TEMPOS.map((tempo) => (
                <Chip
                  key={tempo}
                  className={CHIP}
                  selected={options.tempo === tempo}
                  onClick={() => set({ tempo })}
                >
                  {TEMPO_LABELS[tempo]}
                </Chip>
              ))}
            </Row>
          </>
        )}

        <Row label="Tonic">
          <Chip
            className={CHIP}
            selected={options.tonicLock === null}
            onClick={() => set({ tonicLock: null })}
          >
            Random
          </Chip>
          {Array.from({ length: 12 }, (_, pitch) => (
            <Chip
              key={pitch}
              className={`${CHIP} min-w-11 justify-center`}
              selected={options.tonicLock === pitch}
              onClick={() => set({ tonicLock: pitch })}
            >
              {pitchName(pitch)}
            </Chip>
          ))}
        </Row>

        {options.tonicLock === null && (
          <Row label="Change tonic every">
            {TONIC_CHANGE_EVERY.map((every) => (
              <Chip
                key={every}
                className={CHIP}
                selected={options.tonicChangeEvery === every}
                onClick={() => set({ tonicChangeEvery: every })}
              >
                {every === 0 ? 'Off' : `${every} answers`}
              </Chip>
            ))}
          </Row>
        )}

        <RaisedButton variant="primary" size="lg" onClick={start}>
          Start {MODE_LABELS[options.mode]}
        </RaisedButton>
      </div>
    </div>
  )
}
