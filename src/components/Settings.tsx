// Settings (DESIGN.md §7.5): drone and note volume with a test sound to set
// them by, which answers play feedback notes, register, the daily goal,
// JSON export/import of everything stored, and reset progress per preset.
// Reached from Home only, so nothing here runs mid-session.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { sound } from '../audio'
import {
  FEEDBACK_SOUNDS,
  localDateKey,
  MAX_GOAL_MINUTES,
  promptCue,
  TONIC_BASE_MIDI,
} from '../practice'
import {
  practiceStore,
  settingsStore,
  usePractice,
  useSettings,
} from '../store'
import {
  appStorage,
  exportStateJson,
  parseStateImport,
  type PersistedState,
} from '../storage'
import { PRESETS, REGISTER_OCTAVES, type Preset } from '../theory'
import { FEEDBACK_SOUND_LABELS } from './labels'
import { Card, Chip, RaisedButton, SectionLabel } from './ui'

const CHIP = 'px-3 py-1.5 text-sm'

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <Card className="flex flex-col gap-4 p-4">{children}</Card>
    </div>
  )
}

export function Settings({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        <RaisedButton size="sm" onClick={onBack}>
          Done
        </RaisedButton>
      </header>
      <SoundSection />
      <PracticeSection />
      <BackupSection />
      <ResetSection />
    </div>
  )
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between font-semibold">
        {label}
        <span className="text-ink-soft tabular-nums">
          {Math.round(value * 100)}%
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full accent-primary"
      />
    </label>
  )
}

// The test sound: the drone on C with 3, 5 and the high 1 taking turns over
// it, until stopped or Settings closes, so the volumes can be set by ear.
const TEST_POSITIONS = [4, 7, 12] as const
const TEST_STEP_MS = 1600

function useTestSound() {
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!testing) return
    let next = 0
    const playNext = () => {
      const position = TEST_POSITIONS[next++ % TEST_POSITIONS.length] ?? 0
      sound.play(TONIC_BASE_MIDI, promptCue([position], 'normal'))
    }
    playNext()
    const timer = setInterval(playNext, TEST_STEP_MS)
    return () => {
      clearInterval(timer)
      sound.silence()
      sound.stopDrone()
    }
  }, [testing])

  // Starting the drone inside the tap is what unlocks audio on iOS (§2).
  const toggle = () => {
    if (!testing) sound.startDrone(TONIC_BASE_MIDI)
    setTesting(!testing)
  }
  return { testing, toggle }
}

function SoundSection() {
  const drone = useSettings((s) => s.settings.droneVolume)
  const note = useSettings((s) => s.settings.noteVolume)
  const feedback = useSettings((s) => s.settings.feedbackSound)
  const update = useSettings((s) => s.update)
  const { testing, toggle } = useTestSound()
  return (
    <Section label="Sound">
      <RaisedButton
        size="sm"
        variant={testing ? 'outline' : 'raised'}
        onClick={toggle}
      >
        {testing ? '■ Stop test sound' : '▶ Test sound'}
      </RaisedButton>
      <Slider
        label="Drone volume"
        value={drone}
        onChange={(droneVolume) => update({ droneVolume })}
      />
      <Slider
        label="Note volume"
        value={note}
        onChange={(noteVolume) => update({ noteVolume })}
      />
      <div className="flex flex-col gap-2">
        <span className="font-semibold">Feedback notes after</span>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_SOUNDS.map((sound) => (
            <Chip
              key={sound}
              className={CHIP}
              selected={feedback === sound}
              onClick={() => update({ feedbackSound: sound })}
            >
              {FEEDBACK_SOUND_LABELS[sound]}
            </Chip>
          ))}
        </div>
      </div>
    </Section>
  )
}

// Minute by minute up to 5, then in fives.
function goalUp(minutes: number): number {
  return Math.min(
    MAX_GOAL_MINUTES,
    minutes < 5 ? minutes + 1 : Math.floor(minutes / 5) * 5 + 5,
  )
}

function goalDown(minutes: number): number {
  return Math.max(
    1,
    minutes <= 5 ? minutes - 1 : Math.ceil(minutes / 5) * 5 - 5,
  )
}

const STEP =
  'flex h-9 w-9 items-center justify-center rounded-[12px] border-2 border-muted-border text-lg font-extrabold leading-none text-ink-soft transition-transform active:translate-y-[1px] disabled:opacity-40'

function PracticeSection() {
  const register = useSettings((s) => s.settings.register)
  const goal = useSettings((s) => s.settings.goalMinutes)
  const update = useSettings((s) => s.update)
  return (
    <Section label="Practice">
      <div className="flex flex-col gap-2">
        <span className="font-semibold">Register</span>
        <div className="flex flex-wrap gap-2">
          {REGISTER_OCTAVES.map((octaves) => (
            <Chip
              key={octaves}
              className={CHIP}
              selected={register === octaves}
              onClick={() => update({ register: octaves })}
            >
              {octaves} octave{octaves === 1 ? '' : 's'}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-semibold">Daily goal</span>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Decrease daily goal"
            className={STEP}
            disabled={goal <= 1}
            onClick={() => update({ goalMinutes: goalDown(goal) })}
          >
            −
          </button>
          <span className="min-w-16 text-center font-semibold tabular-nums">
            {goal} min
          </span>
          <button
            type="button"
            aria-label="Increase daily goal"
            className={STEP}
            disabled={goal >= MAX_GOAL_MINUTES}
            onClick={() => update({ goalMinutes: goalUp(goal) })}
          >
            +
          </button>
        </div>
      </div>
    </Section>
  )
}

// On a phone the share sheet is the dependable way to save a file: an
// installed iOS web app can open an <a download> in a viewer with no way back.
// Elsewhere a plain download.
async function saveFile(json: string, name: string): Promise<void> {
  const file = new File([json], name, { type: 'application/json' })
  const touch = window.matchMedia('(pointer: coarse)').matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

type ImportStatus =
  | { kind: 'confirm'; state: PersistedState }
  | { kind: 'error'; message: string }
  | { kind: 'done' }

function BackupSection() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<ImportStatus | null>(null)

  const exportBackup = () => {
    const name = `playingmelodies-${localDateKey(new Date())}.json`
    void saveFile(exportStateJson(appStorage.state), name)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const result = parseStateImport(await file.text())
    setStatus(
      result.ok
        ? { kind: 'confirm', state: result.state }
        : { kind: 'error', message: result.error },
    )
  }

  const confirmImport = (state: PersistedState) => {
    practiceStore.getState().importState(state)
    settingsStore.getState().reload()
    setStatus({ kind: 'done' })
  }

  return (
    <Section label="Backup">
      <p className="text-sm text-ink-soft">
        Progress lives only on this device. Export a backup to keep it or move
        it to another one.
      </p>
      <div className="flex gap-2">
        <RaisedButton size="sm" className="flex-1" onClick={exportBackup}>
          Export
        </RaisedButton>
        <RaisedButton
          size="sm"
          className="flex-1"
          onClick={() => fileInput.current?.click()}
        >
          Import…
        </RaisedButton>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="Import backup file"
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {status?.kind === 'error' && (
        <p className="text-sm text-danger">✘ {status.message}</p>
      )}
      {status?.kind === 'done' && (
        <p className="text-sm text-primary-light">✔ Backup imported.</p>
      )}
      {status?.kind === 'confirm' && (
        <Confirm
          message="Replace all progress and settings on this device with this backup?"
          action="Replace"
          onConfirm={() => confirmImport(status.state)}
          onCancel={() => setStatus(null)}
        />
      )}
    </Section>
  )
}

function Confirm({
  message,
  action,
  onConfirm,
  onCancel,
}: {
  message: string
  action: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border-2 border-danger/40 bg-danger-tint p-3">
      <p className="text-sm font-semibold">{message}</p>
      <div className="flex gap-2">
        <RaisedButton
          size="sm"
          className="flex-1 border-danger! text-danger!"
          onClick={onConfirm}
        >
          {action}
        </RaisedButton>
        <RaisedButton
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
        >
          Cancel
        </RaisedButton>
      </div>
    </div>
  )
}

function ResetSection() {
  const [confirming, setConfirming] = useState<Preset['id'] | null>(null)
  return (
    <Section label="Reset progress">
      <p className="text-sm text-ink-soft">
        A reset relocks a preset to its first two degrees. Grades, stars and
        daily time are shared by every preset and stay.
      </p>
      {PRESETS.map((preset) => (
        <ResetRow
          key={preset.id}
          preset={preset}
          confirming={confirming === preset.id}
          onAsk={() => setConfirming(preset.id)}
          onDone={() => setConfirming(null)}
        />
      ))}
    </Section>
  )
}

function ResetRow({
  preset,
  confirming,
  onAsk,
  onDone,
}: {
  preset: Preset
  confirming: boolean
  onAsk: () => void
  onDone: () => void
}) {
  const progress = usePractice((s) => s.records.presetProgress[preset.id])
  if (confirming) {
    return (
      <Confirm
        message={`Reset ${preset.name}? Its unlocks and passes start over.`}
        action="Reset"
        onConfirm={() => {
          practiceStore.getState().resetPreset(preset.id)
          onDone()
        }}
        onCancel={onDone}
      />
    )
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col">
        <span className="font-extrabold">{preset.name}</span>
        <span className="text-sm text-ink-muted">
          {progress
            ? `${progress.unlockedCount} / ${preset.order.length} unlocked · ${progress.passed.length} passed`
            : 'Not started'}
        </span>
      </div>
      <RaisedButton
        size="sm"
        variant="outline"
        disabled={!progress}
        onClick={onAsk}
      >
        Reset
      </RaisedButton>
    </div>
  )
}
