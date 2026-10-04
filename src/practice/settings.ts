// App settings (DESIGN.md §7.5), with the sanitizer that coerces whatever
// was persisted or imported into valid values field by field. Pure TS.

import { isRegisterOctaves, type RegisterOctaves } from '../theory'
import { DEFAULT_GOAL_MINUTES } from './daily'

export interface Settings {
  droneVolume: number // 0–1
  noteVolume: number // 0–1
  register: RegisterOctaves
  goalMinutes: number
}

export const DEFAULT_SETTINGS: Settings = {
  droneVolume: 0.5,
  noteVolume: 0.8,
  register: 1,
  goalMinutes: DEFAULT_GOAL_MINUTES,
}

export const MAX_GOAL_MINUTES = 240

function asVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && value >= 0 && value <= 1
    ? value
    : fallback
}

function asGoalMinutes(value: unknown): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_GOAL_MINUTES
    ? value
    : DEFAULT_SETTINGS.goalMinutes
}

// A field that is missing or out of range falls back to its default alone,
// so one bad value never costs the player their other settings.
export function sanitizeSettings(value: unknown): Settings {
  const raw =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}
  return {
    droneVolume: asVolume(raw.droneVolume, DEFAULT_SETTINGS.droneVolume),
    noteVolume: asVolume(raw.noteVolume, DEFAULT_SETTINGS.noteVolume),
    register: isRegisterOctaves(raw.register)
      ? raw.register
      : DEFAULT_SETTINGS.register,
    goalMinutes: asGoalMinutes(raw.goalMinutes),
  }
}
