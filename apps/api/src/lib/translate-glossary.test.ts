import { describe, expect, it } from 'bun:test'
import { protectTerms } from './translate-glossary.ts'

describe('protectTerms', () => {
  it('replaces a known term with a sentinel', () => {
    const { masked, restore } = protectTerms('Plomero 24h en Asunción')
    expect(masked).toContain('⟦GP_')
    expect(masked).not.toContain('Asunción')
    expect(restore(masked)).toBe('Plomero 24h en Asunción')
  })

  it('round-trips through a (mocked) translation that preserves placeholders', () => {
    const { masked, restore } = protectTerms('Plomero 24h en Asunción — calefones, fugas')
    // Simulate what an MT model returns: keeps ⟦GP_N⟧ intact, translates rest.
    const translated = masked.replace('Plomero 24h', 'Plumber 24h').replace('calefones, fugas', 'heaters, leaks')
    expect(restore(translated)).toBe('Plumber 24h en Asunción — heaters, leaks')
  })

  it('longest-first wins ("San Lorenzo" before "San")', () => {
    // PROTECTED_TERMS has both "San Lorenzo" and "San Antonio"; both bare "San"
    // should NOT match as a standalone (it's only inside multi-word terms).
    const { masked, restore } = protectTerms('Vivo en San Lorenzo cerca de San Antonio.')
    expect(masked).toContain('⟦GP_0⟧') // first replacement
    expect(masked).toContain('⟦GP_1⟧')
    // Bare "San" shouldn't be tokenized
    const bareSanCount = (masked.match(/⟦GP_/g) ?? []).length
    expect(bareSanCount).toBe(2)
    expect(restore(masked)).toBe('Vivo en San Lorenzo cerca de San Antonio.')
  })

  it('case-insensitive match, preserves original casing', () => {
    const { masked, restore } = protectTerms('VILLA MORRA y villa morra y Villa Morra')
    expect(masked).not.toMatch(/villa morra/i)
    const restored = restore(masked)
    expect(restored).toBe('VILLA MORRA y villa morra y Villa Morra')
  })

  it('empty string passes through', () => {
    const { masked, restore } = protectTerms('')
    expect(masked).toBe('')
    expect(restore('')).toBe('')
  })

  it('text with no protected terms is untouched', () => {
    const { masked, restore } = protectTerms('just plain text')
    expect(masked).toBe('just plain text')
    expect(restore('plain translated')).toBe('plain translated')
  })

  it('handles brand names', () => {
    const { masked, restore } = protectTerms('Bienvenido a PyaServ — usá PyaEats también.')
    expect(masked).not.toContain('PyaServ')
    expect(masked).not.toContain('PyaEats')
    expect(restore(masked)).toBe('Bienvenido a PyaServ — usá PyaEats también.')
  })

  it('restores when MT model strips ⟦⟧ brackets but keeps inner GP_N', () => {
    // Observed behavior of m2m100-1.2b: it drops the unicode brackets and
    // keeps the ASCII core. Restore must tolerate the bareword form.
    const { masked, restore } = protectTerms('Plomero 24h en Asunción')
    expect(masked).toContain('⟦GP_')
    // Simulate the stripped form
    const stripped = masked.replace(/[⟦⟧]/g, '')
    expect(stripped).toContain('GP_0')
    expect(restore(stripped)).toBe('Plomero 24h en Asunción')
  })

  it('GP_1 does not partial-match GP_10 (token boundary)', () => {
    // Build a synthetic 11-token text via 11 protected terms in one string.
    const big = ['PyaServ', 'Asunción', 'Areguá', 'Capiatá', 'Encarnación',
                 'Lambaré', 'Luque', 'Ñemby', 'San Lorenzo', 'Carmelitas', 'Recoleta']
      .join(' / ')
    const { masked, restore } = protectTerms(big)
    // Strip brackets to force the bareword path
    const stripped = masked.replace(/[⟦⟧]/g, '')
    expect(restore(stripped)).toBe(big)
  })
})
