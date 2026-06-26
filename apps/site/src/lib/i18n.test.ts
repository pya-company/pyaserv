/*
 * i18n fallback chain — EN canonical (mandatory-complete), other locales
 * may be sparse. EN missing → ES present → returns ES (safety net for
 * the legacy ES-as-source-of-truth callsites). EN missing AND ES missing
 * → returns the raw key.
 *
 * Sentinel chain validated:
 *   GN missing → EN present → returns EN
 *   GN present                → returns GN
 *   bogus key in every dict    → returns the key
 */
import { describe, expect, it } from 'bun:test'
import { ES, EN, GN, RU, DE, tFor } from './i18n.ts'

describe('tFor — fallback chain', () => {
  it('returns the localized string when present', () => {
    expect(tFor('en', 'nav.skip')).toBe(EN['nav.skip'])
    expect(tFor('es', 'nav.skip')).toBe(ES['nav.skip'])
  })

  it('GN falls back to EN when key is missing', () => {
    expect(GN['nav.skip']).toBeUndefined()
    expect(EN['nav.skip']).toBeDefined()
    expect(tFor('gn', 'nav.skip')).toBe(EN['nav.skip'])
  })

  it('returns GN value when present', () => {
    expect(GN['common.save']).toBeDefined()
    expect(tFor('gn', 'common.save')).toBe(GN['common.save'])
  })

  it('RU has nav.docs', () => {
    expect(RU['nav.docs']).toBe('Документация')
    expect(tFor('ru', 'nav.docs')).toBe('Документация')
  })

  it('DE has nav.docs', () => {
    expect(DE['nav.docs']).toBe('Docs')
    expect(tFor('de', 'nav.docs')).toBe('Docs')
  })

  it('returns the key for a string missing in all dicts', () => {
    expect(tFor('en', 'bogus.key.nowhere')).toBe('bogus.key.nowhere')
    expect(tFor('es', 'bogus.key.nowhere')).toBe('bogus.key.nowhere')
    expect(tFor('ru', 'bogus.key.nowhere')).toBe('bogus.key.nowhere')
  })

  it('EN dict completeness — every ES key exists in EN', () => {
    // GN/DE/RU may be sparse; EN cannot be (mandatory canonical).
    const missing = Object.keys(ES).filter((k) => EN[k] === undefined)
    expect(missing).toEqual([])
  })
})
