// The practice store (DESIGN.md §6, §8): the player's records, kept reactive
// for the screens, and the session in progress. It drives the pure session
// runner — each action calls a runner step, keeps the new state, and carries
// out the step's effects: audio through Sound, waits as timers that call the
// runner back, and during feedback which pad key is sounding. After every step it writes what changed through to storage:
// the records when an answer was graded, and new active time to today.

import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { sound as appSound, type Sound } from '../audio'
import {
  addActiveMinutes,
  advance,
  endSession,
  feedbackSettings,
  freshProgress,
  localDateKey,
  pause,
  replay,
  resume,
  startSession,
  tap,
  timeout,
  undo,
  type PracticeSlice,
  type Rng,
  type SessionEffect,
  type SessionOptions,
  type SessionState,
  type SessionStep,
  type Cue,
  type Mode,
  type Settings,
} from '../practice'
import { appStorage, type AppStorage, type PersistedState } from '../storage'
import { degreeAt, getPreset, type Degree, type PresetId } from '../theory'
import { settingsStore } from './settingsStore'

export type PracticeRecords = Pick<
  PersistedState,
  'degreeStats' | 'confusions' | 'presetProgress' | 'dailyRecords'
>

export interface PracticeStoreState {
  records: PracticeRecords
  // The running session, or a finished one while its Report is up.
  session: SessionState | null
  // The session sheet's last choices, saved with each start. Its mode is also
  // Home's open tab, saved as soon as the tab changes (§7.1).
  lastOptions: SessionOptions
  // The degree whose feedback note is sounding now, lit on the pad so each
  // sound can be matched to its key (§6.1). Prompts never light one.
  sounding: Degree | null

  // Must be called synchronously from the Start tap's handler: starting the
  // drone there is what unlocks audio on iOS (§2).
  start(presetId: PresetId, options: SessionOptions): void
  chooseMode(mode: Mode): void
  tap(degree: Degree): void
  undo(): void
  replay(): void
  // The app went to the background (§6). A no-op unless a session runs.
  pause(): void
  // Must be called synchronously from the Resume tap's handler, like start.
  resume(): void
  // Quit: what was answered stands, and the Report comes up.
  end(): void
  // Dismiss the Report (or abandon a session outright).
  close(): void

  // Settings (§7.5), offered from Home only, never mid-session. A reset opens
  // the preset fresh; the shared stats stay (§4, §5).
  resetPreset(presetId: PresetId): void
  // Replaces everything stored with an imported backup, the session sheet's
  // last choices included. The settings store must reload after it.
  importState(state: PersistedState): void
}

export interface PracticeStoreDeps {
  storage?: AppStorage
  sound?: Sound
  settings?: () => Settings
  now?: () => number
  rng?: Rng
}

function recordsOf(state: PersistedState): PracticeRecords {
  const { degreeStats, confusions, presetProgress, dailyRecords } = state
  return { degreeStats, confusions, presetProgress, dailyRecords }
}

export function createPracticeStore({
  storage = appStorage,
  sound = appSound,
  settings = () => settingsStore.getState().settings,
  now = () => Date.now(),
  rng = Math.random,
}: PracticeStoreDeps = {}) {
  return createStore<PracticeStoreState>()((set, get) => {
    const timers = new Set<ReturnType<typeof setTimeout>>()

    function clearTimers(): void {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    }

    function wake(fn: () => void, inMs: number): void {
      const timer = setTimeout(() => {
        timers.delete(timer)
        fn()
      }, inMs)
      timers.add(timer)
    }

    // Lights each note's key for as long as it sounds. A note that ends
    // only clears the key it lit, so the next one may already have taken over.
    let notesLit = 0
    let litNote = 0
    function lightNotes(cue: Cue): void {
      for (const { position, atMs, durationMs } of cue.notes) {
        const note = ++notesLit
        wake(() => {
          litNote = note
          set({ sounding: degreeAt(position) })
        }, atMs)
        wake(() => {
          if (litNote === note) set({ sounding: null })
        }, atMs + durationMs)
      }
    }

    function carryOut(
      effects: readonly SessionEffect[],
      phase: SessionState['phase']['kind'],
    ): void {
      for (const effect of effects) {
        switch (effect.kind) {
          case 'startDrone':
            sound.startDrone(effect.tonicMidi)
            break
          case 'retuneDrone':
            sound.retuneDrone(effect.tonicMidi, effect.fadeMs)
            break
          case 'stopDrone':
            sound.stopDrone()
            break
          case 'silence':
            sound.silence()
            break
          case 'play':
            sound.play(effect.tonicMidi, effect.cue)
            if (phase === 'feedback') lightNotes(effect.cue)
            break
          case 'wake':
            if (effect.call === 'advance') {
              wake(() => step((s) => advance(s, now(), rng)), effect.inMs)
            } else {
              const { prompt } = effect
              wake(() => step((s) => timeout(s, prompt, rng)), effect.inMs)
            }
            break
        }
      }
    }

    // Writes a step's changes through: the preset's records once an answer
    // is graded, and active time earned since the last step to today.
    function persist(before: SessionState, after: SessionState): void {
      const graded = after.practice !== before.practice
      const earnedMs = after.activity.activeMs - before.activity.activeMs
      if (!graded && earnedMs <= 0) return
      const presetId = after.setup.preset.id
      storage.update((state) => {
        let next = state
        if (graded) {
          const { degreeStats, confusions, progress } = after.practice
          next = {
            ...next,
            degreeStats,
            confusions,
            presetProgress: { ...next.presetProgress, [presetId]: progress },
          }
        }
        if (earnedMs > 0) {
          next = {
            ...next,
            dailyRecords: addActiveMinutes(
              next.dailyRecords,
              localDateKey(new Date(now())),
              earnedMs / 60_000,
            ),
          }
        }
        return next
      })
      set({ records: recordsOf(storage.state) })
    }

    function step(run: (state: SessionState) => SessionStep): void {
      const before = get().session
      if (before === null) return
      const { state, effects } = run(before)
      set({ session: state })
      persist(before, state)
      if (state.phase.kind !== 'feedback') set({ sounding: null })
      // A paused or finished session needs no more callbacks.
      if (state.phase.kind === 'paused' || state.phase.kind === 'done') {
        clearTimers()
      }
      carryOut(effects, state.phase.kind)
    }

    return {
      records: recordsOf(storage.state),
      session: null,
      lastOptions: storage.state.lastOptions,
      sounding: null,

      start(presetId, options) {
        clearTimers()
        sound.silence()
        const preset = getPreset(presetId)
        const { records } = get()
        const practice: PracticeSlice = {
          degreeStats: records.degreeStats,
          confusions: records.confusions,
          progress: records.presetProgress[presetId] ?? freshProgress(preset),
        }
        const { register } = settings()
        const { state, effects } = startSession(
          { preset, options, register, feedback: feedbackSettings(settings()) },
          practice,
          now(),
          rng,
        )
        set({ session: state, lastOptions: options, sounding: null })
        storage.update((stored) => ({ ...stored, lastOptions: options }))
        carryOut(effects, state.phase.kind)
      },

      chooseMode(mode) {
        const lastOptions = { ...get().lastOptions, mode }
        set({ lastOptions })
        storage.update((stored) => ({ ...stored, lastOptions }))
      },

      tap(degree) {
        step((s) => tap(s, degree, now(), rng))
      },

      undo() {
        step((s) => undo(s, now()))
      },

      replay() {
        step((s) => replay(s, now()))
      },

      pause() {
        step(pause)
      },

      resume() {
        step((s) => resume(s, now(), rng))
      },

      end() {
        step(endSession)
      },

      close() {
        step(endSession)
        clearTimers()
        set({ session: null })
      },

      resetPreset(presetId) {
        storage.update((state) => {
          const { [presetId]: _reset, ...presetProgress } = state.presetProgress
          return { ...state, presetProgress }
        })
        set({ records: recordsOf(storage.state) })
      },

      importState(state) {
        storage.update(() => state)
        set({ records: recordsOf(state), lastOptions: state.lastOptions })
      },
    }
  })
}

export const practiceStore = createPracticeStore()

export function usePractice<T>(selector: (state: PracticeStoreState) => T): T {
  return useStore(practiceStore, selector)
}
