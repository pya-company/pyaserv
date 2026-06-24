/*
 * i18n fallback chain — GN sparse dict must fall back to ES for any key it
 * doesn't define, not return the raw `'nav.skip'` key. EN remains fully
 * defined and must NOT trigger the ES fallback. Sentinel chain validated:
 *
 *   GN missing →  ES present  → returns ES
 *   GN missing →  ES missing  → returns the key (last-ditch)
 */
import { describe, expect, it } from 'bun:test'
import { ES, EN, GN, tFor } from './i18n.ts'

describe('tFor — fallback chain', () => {
  it('returns the localized string when present', () => {
    expect(tFor('es', 'nav.skip')).toBe(ES['nav.skip'])
    expect(tFor('en', 'nav.skip')).toBe(EN['nav.skip'])
  })

  it('falls back to ES when GN key is missing', () => {
    // nav.skip is NOT in GN; spec §2.2 says GN is sparse for non-emotional UI
    expect(GN['nav.skip']).toBeUndefined()
    expect(tFor('gn', 'nav.skip')).toBe(ES['nav.skip'])
  })

  it('returns GN value when present, not ES', () => {
    expect(GN['me.profile.saved']).toBeDefined()
    expect(tFor('gn', 'me.profile.saved')).toBe(GN['me.profile.saved'])
    expect(tFor('gn', 'me.profile.saved')).not.toBe(ES['me.profile.saved'])
  })

  it('returns the key for a string missing in all three dicts', () => {
    expect(tFor('gn', 'bogus.key.nowhere')).toBe('bogus.key.nowhere')
    expect(tFor('en', 'bogus.key.nowhere')).toBe('bogus.key.nowhere')
    expect(tFor('es', 'bogus.key.nowhere')).toBe('bogus.key.nowhere')
  })

  it('EN dict completeness — every ES key must exist in EN', () => {
    // GN is allowed to be sparse; EN is not (legacy contract).
    const missing = Object.keys(ES).filter((k) => EN[k] === undefined)
    expect(missing).toEqual([])
  })
})
