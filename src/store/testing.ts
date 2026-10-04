// Test-only: in-memory stand-ins for the stores' platform dependencies.

import type { Sound } from '../audio'
import { AppStorage, type KeyValueStore } from '../storage'

export function memoryStorage(): AppStorage {
  const map = new Map<string, string>()
  const kv: KeyValueStore = {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value)
      return true
    },
  }
  return new AppStorage(kv)
}

// Records every call as [method, ...args].
export function recordingSound(): Sound & { calls: unknown[][] } {
  const calls: unknown[][] = []
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push([method, ...args])
    }
  return {
    calls,
    startDrone: record('startDrone'),
    retuneDrone: record('retuneDrone'),
    stopDrone: record('stopDrone'),
    play: record('play'),
    silence: record('silence'),
    setVolumes: record('setVolumes'),
  }
}
