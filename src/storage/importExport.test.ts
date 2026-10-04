import { describe, expect, it } from 'vitest'
import { EXPORT_KIND, exportStateJson, parseStateImport } from './importExport'
import { defaultState, SCHEMA_VERSION } from './schema'

describe('state export/import', () => {
  it('round-trips the whole state', () => {
    const state = {
      ...defaultState(),
      confusions: [{ played: 4 as const, tapped: 5 as const }],
      dailyRecords: {
        '2026-10-04': { date: '2026-10-04', activeMinutes: 12 },
      },
    }
    expect(parseStateImport(exportStateJson(state))).toEqual({
      ok: true,
      state,
    })
  })

  it('sanitizes what it imports', () => {
    const json = JSON.stringify({
      kind: EXPORT_KIND,
      version: SCHEMA_VERSION,
      confusions: [{ played: 4, tapped: 4 }],
    })
    expect(parseStateImport(json)).toEqual({ ok: true, state: defaultState() })
  })

  it('refuses a file that is not JSON', () => {
    expect(parseStateImport('{nope')).toEqual({
      ok: false,
      error: 'Not valid JSON.',
    })
  })

  it('refuses a file of another kind', () => {
    const result = parseStateImport(JSON.stringify({ version: 1 }))
    expect(result).toEqual({
      ok: false,
      error: 'Not a PlayingMelodies backup file.',
    })
  })

  it('refuses a file without a valid version', () => {
    const result = parseStateImport(
      JSON.stringify({ kind: EXPORT_KIND, version: '1' }),
    )
    expect(result.ok).toBe(false)
  })

  it('refuses a file from a newer schema', () => {
    const result = parseStateImport(
      JSON.stringify({ kind: EXPORT_KIND, version: SCHEMA_VERSION + 1 }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('newer app version')
  })
})
