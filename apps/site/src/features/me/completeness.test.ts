import { describe, expect, it } from 'bun:test'
import { completenessPct, type ProfileSnapshot } from './completeness.ts'

const empty: ProfileSnapshot = {
  displayName: '',
  headline: '',
  phone: '',
  barrio: '',
  bio: '',
  photo: null,
}
const full: ProfileSnapshot = {
  displayName: 'María',
  headline: 'Plomera 24h',
  phone: '+595981000000',
  barrio: 'Villa Morra',
  bio: 'lorem',
  photo: 'some-key.png',
}

describe('completenessPct', () => {
  it('returns 0 for empty profile', () => {
    expect(completenessPct(empty)).toBe(0)
  })

  it('returns 100 for fully filled profile', () => {
    expect(completenessPct(full)).toBe(100)
  })

  it('treats whitespace-only field as unfilled', () => {
    expect(completenessPct({ ...empty, displayName: '   ' })).toBe(0)
  })

  it('photo alone scores 1/6 ≈ 17%', () => {
    expect(completenessPct({ ...empty, photo: 'p.png' })).toBe(17)
  })

  it('one text field alone scores 1/6 ≈ 17%', () => {
    expect(completenessPct({ ...empty, bio: 'hi' })).toBe(17)
  })

  it('all text fields without photo scores 5/6 ≈ 83%', () => {
    expect(completenessPct({ ...full, photo: null })).toBe(83)
  })

  it('photo missing + 4 of 5 fields ≈ 67%', () => {
    expect(completenessPct({ ...full, photo: null, bio: '' })).toBe(67)
  })

  it('null/undefined coerced safely', () => {
    expect(completenessPct({
      ...empty,
      displayName: null as unknown as string,
      bio: undefined as unknown as string,
    })).toBe(0)
  })
})
