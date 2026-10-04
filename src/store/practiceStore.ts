// The practice store (DESIGN.md §6, §8): the player's records, kept reactive
// for the screens, and the session in progress. It drives the pure session
// runner — each action calls a runner step, keeps the new state, and carries
// out the step's effects: audio through Sound, waits as timers that call the
// runner back. After every step it writes what changed through to storage:
// the records when an answer was graded, and new active time to today.

import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { sound as appSound, type Sound } from '../audio'
import {
  addActiveMinutes,
  advance,
  DEFAULT_SESSION_OPTIONS,
  endSession,
  freshProgress,
  localDateKey,
  replay,
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
  type Settings,
} from '../practice'
import { appStorage, type AppStorage, type PersistedState } from '../storage'
import { getPreset, type Degree, type PresetId } from '../theory'
import { settingsStore } from './settingsStore'

export type PracticeRecords = Pick<
  PersistedState,
  'degreeStats' | 'confusions' | 'presetProgress' | 'dailyRecords'
>

export interface PracticeStoreState {
  records: PracticeRecords
  // The running session, or a finished one while its Report is up.
  session: SessionState | null
  // The session sheet's last choices; in memory only for now.
  lastOptions: SessionOptions

  // Must be called synchronously from the Start tap's handler: starting the
  // drone there is what unlocks audio on iOS (§2).
  start(presetId: PresetId, options: SessionOptions): void
  tap(degree: Degree): void
  undo(): void
  replay(): void
  // Quit: what was answered stands, and the Report comes up.
  end(): void
  // Dismiss the Report (or abandon a session outright).
  close(): void

  // Settings (§7.5), offered from Home only, never mid-session. A reset opens
  // the preset fresh; the shared stats stay (§4, §5).
  resetPreset(presetId: PresetId): void
  // Replaces everything stored with an imported backup. The settings store
  // must reload after it.
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

    function carryOut(effects: readonly SessionEffect[]): void {
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
            break
          case 'wake':
            if (effect.call === 'advance') {
              wake(() => step((s) => advance(s, now(), rng)), effect.inMs)
            } else {
              const { prompt } = effect
              wake(() => step((s) => timeout(s, prompt)), effect.inMs)
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
      // A finished session needs no more callbacks.
      if (state.phase.kind === 'done') clearTimers()
      carryOut(effects)
    }

    return {
      records: recordsOf(storage.state),
      session: null,
      lastOptions: DEFAULT_SESSION_OPTIONS,

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
        const { state, effects } = startSession(
          { preset, options, register: settings().register },
          practice,
          now(),
          rng,
        )
        set({ session: state, lastOptions: options })
        carryOut(effects)
      },

      tap(degree) {
        step((s) => tap(s, degree, now()))
      },

      undo() {
        step((s) => undo(s, now()))
      },

      replay() {
        step((s) => replay(s, now()))
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
        set({ records: recordsOf(storage.state) })
      },
    }
  })
}

export const practiceStore = createPracticeStore()

export function usePractice<T>(selector: (state: PracticeStoreState) => T): T {
  return useStore(practiceStore, selector)
}
