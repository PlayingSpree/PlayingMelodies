// The Stage (DESIGN.md §7.3): the session's progress, replay and quit on
// top; in the middle what the session wants now — listening, an answer, the
// Speed limit draining, Melody's slots — or the feedback on the last answer;
// the pad at the bottom, in reach of the thumb.

import {
  SPEED_LIMIT_MS,
  unlockedDegrees,
  type SessionAnswer,
  type SessionState,
} from '../practice'
import { practiceStore, usePractice } from '../store'
import { degreeLabel, type Degree } from '../theory'
import { cx } from './cx'
import { formatMinutes } from './labels'
import { Pad, type KeyMark } from './Pad'
import { RaisedButton } from './ui'

function progressText({ setup, answers, phase, activity }: SessionState) {
  const { length } = setup.options
  if (length.kind === 'minutes') {
    const left = Math.max(0, length.minutes - activity.activeMs / 60_000)
    return `${formatMinutes(left)} min left`
  }
  const current = answers.length + (phase.kind === 'answering' ? 1 : 0)
  return `${current} / ${length.count}`
}

// The pad's marks after a Notes or Speed answer: the tapped key right or
// wrong, and on a miss the key it should have been.
function keyMarks(answer: SessionAnswer): Partial<Record<Degree, KeyMark>> {
  const played = answer.played[0]
  const tapped = answer.tapped[0]
  if (played === undefined) return {}
  if (answer.correct) return { [played]: 'right' }
  return {
    ...(tapped === undefined ? {} : { [tapped]: 'wrong' }),
    [played]: 'answer',
  }
}

function Slots({
  count,
  filled,
  answer,
}: {
  count: number
  filled: readonly Degree[]
  answer: SessionAnswer | null
}) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: count }, (_, i) => {
        const degree = answer ? answer.tapped[i] : filled[i]
        const right = answer?.slots[i]
        const played = answer?.played[i]
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={cx(
                'flex h-14 w-12 items-center justify-center rounded-xl border-2 text-xl font-extrabold',
                answer === null &&
                  degree === undefined &&
                  'border-dashed border-muted-border',
                answer === null &&
                  degree !== undefined &&
                  'border-card-border bg-card',
                right === true &&
                  'border-primary bg-primary-tint text-primary-light',
                right === false && 'border-danger bg-danger-tint text-danger',
              )}
            >
              {degree === undefined ? '' : degreeLabel(degree)}
            </div>
            <span className="h-5 text-sm font-bold text-primary-light">
              {right === false && played !== undefined
                ? degreeLabel(played)
                : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Status({ session }: { session: SessionState }) {
  const { phase, setup, answers } = session
  const { mode } = setup.options

  if (phase.kind === 'settling') {
    return <p className="text-xl font-bold text-ink-muted">Listen…</p>
  }

  if (mode === 'melody') {
    const count =
      phase.kind === 'answering' || phase.kind === 'feedback'
        ? phase.prompt.length
        : 0
    return (
      <Slots
        count={count}
        filled={phase.kind === 'answering' ? phase.slots : []}
        answer={phase.kind === 'feedback' ? phase.answer : null}
      />
    )
  }

  // Numbers only: the correct degree ✓, and on a miss the tapped one ✗
  // before it — just ✗ for a Speed timeout.
  if (phase.kind === 'feedback') {
    const { answer } = phase
    const played = answer.played[0]
    const tapped = answer.tapped[0]
    return (
      <p className="flex items-baseline gap-8 text-5xl font-extrabold">
        {!answer.correct && (
          <span className="text-danger">
            ✗{tapped === undefined ? '' : ` ${degreeLabel(tapped)}`}
          </span>
        )}
        {played !== undefined && (
          <span className="text-primary-light">✓ {degreeLabel(played)}</span>
        )}
      </p>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-xl font-bold text-ink-soft">Which degree?</p>
      {mode === 'speed' && (
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-track">
          <div
            // Remounted per prompt, which restarts the drain.
            key={answers.length}
            className="h-full origin-left rounded-full bg-warn"
            style={{ animation: `drain ${SPEED_LIMIT_MS}ms linear forwards` }}
          />
        </div>
      )}
    </div>
  )
}

export function Stage() {
  const session = usePractice((s) => s.session)
  const sounding = usePractice((s) => s.sounding)
  if (session === null) return null
  const { tap, undo, replay, end } = practiceStore.getState()
  const { setup, phase, practice } = session
  const { preset, options } = setup

  const answering = phase.kind === 'answering'
  const marks =
    phase.kind === 'feedback' && options.mode !== 'melody'
      ? keyMarks(phase.answer)
      : {}

  return (
    <div className="flex min-h-full flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <RaisedButton variant="outline" size="sm" onClick={end}>
          Quit
        </RaisedButton>
        <span className="font-bold text-ink-soft tabular-nums">
          {progressText(session)}
        </span>
        <RaisedButton size="sm" onClick={replay} disabled={!answering}>
          ↻ Replay
        </RaisedButton>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Status session={session} />
      </div>

      {options.mode === 'melody' && (
        <div className="flex justify-end">
          <RaisedButton
            size="sm"
            onClick={undo}
            disabled={!answering || phase.slots.length === 0}
          >
            ⌫ Undo
          </RaisedButton>
        </div>
      )}

      <Pad
        inPreset={new Set(preset.order)}
        unlocked={new Set(unlockedDegrees(preset, practice.progress))}
        marks={marks}
        sounding={sounding}
        onTap={tap}
      />
    </div>
  )
}
