// The app's persisted-state holder, ported from PlayingChord: loads and
// migrates once at construction, then serves reads from memory and writes
// through on every update. Pure TS — the key-value backend is injected
// (localStorage in the app, a Map in tests).

import { migrateState } from './migrate'
import { STATE_STORAGE_KEY, type PersistedState } from './schema'

export interface KeyValueStore {
  get(key: string): string | null
  // false when the write failed (quota, privacy mode) — persistence is then
  // best-effort for the session, but the app keeps working from memory.
  set(key: string, value: string): boolean
}

export function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

export class AppStorage {
  private readonly kv: KeyValueStore
  private current: PersistedState

  constructor(kv: KeyValueStore) {
    this.kv = kv
    this.current = migrateState(parseJson(kv.get(STATE_STORAGE_KEY)))
    // Persist the migrated shape immediately.
    this.persist()
  }

  get state(): PersistedState {
    return this.current
  }

  update(mutate: (state: PersistedState) => PersistedState): void {
    this.current = mutate(this.current)
    this.persist()
  }

  private persist(): boolean {
    return this.kv.set(STATE_STORAGE_KEY, JSON.stringify(this.current))
  }
}
