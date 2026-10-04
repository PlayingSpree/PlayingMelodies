// Per-preset unlock progress (DESIGN.md §4) and the mode gates it drives
// (§6). A fresh preset opens its first 2 degrees; once every open degree has
// passed, the next one opens. Passing reads the preset's *own* window of
// Notes answers, not the shared stats (§5), so a degree passed in Major still
// has to be passed again in Combined. Pure TS.

import type { Degree, Preset } from '../theory'
import { pushWindow, windowGrade, type Grade } from './stats'

export const INITIAL_UNLOCKED = 2

// A degree passes at PASS_REQUIRED right among its last PASS_WINDOW Notes
// answers in the preset — a full window, so 4 straight right isn't enough.
export const PASS_WINDOW = 5
export const PASS_REQUIRED = 4

// Melody opens once this many degrees have passed (§6.3).
export const MELODY_OPENS_AT = 3

// The melody grade's window: the last 10 melodies, clean or not (§6.3).
export const MELODY_WINDOW = 10

export interface PresetProgress {
  // How many of the preset's degrees are open, counted along its order.
  unlockedCount: number
  // The last PASS_WINDOW Notes outcomes of each degree answered in this
  // preset, oldest first. Absent means none yet.
  passWindows: Readonly<Partial<Record<Degree, readonly boolean[]>>>
  // A latch: a degree that slips afterwards stays passed (§4).
  passed: readonly Degree[]
  melodyOutcomes: readonly boolean[]
}

export function freshProgress(preset: Preset): PresetProgress {
  return {
    unlockedCount: Math.min(INITIAL_UNLOCKED, preset.order.length),
    passWindows: {},
    passed: [],
    melodyOutcomes: [],
  }
}

export function unlockedDegrees(
  preset: Preset,
  progress: PresetProgress,
): Degree[] {
  return preset.order.slice(0, progress.unlockedCount)
}

// Passed degrees in the preset's order.
export function passedDegrees(
  preset: Preset,
  progress: PresetProgress,
): Degree[] {
  return preset.order.filter((degree) => progress.passed.includes(degree))
}

export function passesWindow(window: readonly boolean[]): boolean {
  const recent = window.slice(-PASS_WINDOW)
  return (
    recent.length === PASS_WINDOW &&
    recent.filter(Boolean).length >= PASS_REQUIRED
  )
}

export interface NotesAnswerResult {
  progress: PresetProgress
  newlyPassed: Degree | null
  newlyUnlocked: Degree[]
}

// Records one graded Notes answer (§6.1) against the preset. An answer for a
// degree that isn't open changes nothing — Notes never deals one.
export function recordNotesAnswer(
  preset: Preset,
  progress: PresetProgress,
  degree: Degree,
  correct: boolean,
): NotesAnswerResult {
  if (!unlockedDegrees(preset, progress).includes(degree)) {
    return { progress, newlyPassed: null, newlyUnlocked: [] }
  }
  const window = pushWindow(
    progress.passWindows[degree] ?? [],
    correct,
    PASS_WINDOW,
  )
  const passes = !progress.passed.includes(degree) && passesWindow(window)
  let next: PresetProgress = {
    ...progress,
    passWindows: { ...progress.passWindows, [degree]: window },
    passed: passes ? [...progress.passed, degree] : progress.passed,
  }
  const newlyUnlocked: Degree[] = []
  while (
    next.unlockedCount < preset.order.length &&
    unlockedDegrees(preset, next).every((d) => next.passed.includes(d))
  ) {
    const opened = preset.order[next.unlockedCount]
    if (opened !== undefined) newlyUnlocked.push(opened)
    next = { ...next, unlockedCount: next.unlockedCount + 1 }
  }
  return {
    progress: next,
    newlyPassed: passes ? degree : null,
    newlyUnlocked,
  }
}

export function recordMelodyOutcome(
  progress: PresetProgress,
  clean: boolean,
): PresetProgress {
  return {
    ...progress,
    melodyOutcomes: pushWindow(progress.melodyOutcomes, clean, MELODY_WINDOW),
  }
}

export function melodyGrade(progress: PresetProgress): Grade | null {
  return windowGrade(progress.melodyOutcomes)
}

export type Mode = 'notes' | 'speed' | 'melody'

export const MODES: readonly Mode[] = ['notes', 'speed', 'melody']

// Notes is always open. Speed waits for the whole preset to pass, so it never
// times a degree not yet heard reliably (§6.2); Melody opens early, at 3.
export function isModeOpen(
  preset: Preset,
  progress: PresetProgress,
  mode: Mode,
): boolean {
  const passed = passedDegrees(preset, progress).length
  switch (mode) {
    case 'notes':
      return true
    case 'speed':
      return passed === preset.order.length
    case 'melody':
      return passed >= MELODY_OPENS_AT
  }
}

// What each mode deals from: Notes the open degrees, Speed the whole preset,
// Melody only the passed ones (§6).
export function dealableDegrees(
  preset: Preset,
  progress: PresetProgress,
  mode: Mode,
): Degree[] {
  switch (mode) {
    case 'notes':
      return unlockedDegrees(preset, progress)
    case 'speed':
      return [...preset.order]
    case 'melody':
      return passedDegrees(preset, progress)
  }
}
