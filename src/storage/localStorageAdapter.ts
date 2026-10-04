// The ONLY place that touches window.localStorage and navigator.storage
// (DESIGN.md §8) — the rest of storage/ is pure and takes a KeyValueStore.
// All failures (privacy mode, quota, no window at all) degrade to
// in-memory-only operation.

import { AppStorage, type KeyValueStore } from './appStorage'

export const localStorageKV: KeyValueStore = {
  get(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
}

// Asks the browser not to evict the app's storage under pressure (§2) —
// localStorage holds the only copy of the player's stats. Resolves to whether
// storage is persistent; false where the API is missing or refused.
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      return false
    }
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

// App-wide singleton; the Zustand stores build on it.
export const appStorage = new AppStorage(localStorageKV)
