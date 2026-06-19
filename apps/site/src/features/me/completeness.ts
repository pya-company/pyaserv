/*
 * Profile completeness math — pure, side-effect-free, unit-testable.
 *
 * The DOM-coupled callsite in me.astro used to inline this logic, which
 * meant changing the scoring required editing template strings and there
 * was no way to test it. Extracted so /me/ can shrink and we can verify
 * edge cases (no fields, all fields, photo only, etc.) in isolation.
 */

export interface ProfileSnapshot {
  readonly displayName: string
  readonly headline: string
  readonly phone: string
  readonly barrio: string
  readonly bio: string
  readonly photo: string | null
}

const FIELDS: ReadonlyArray<Exclude<keyof ProfileSnapshot, 'photo'>> = [
  'displayName',
  'headline',
  'phone',
  'barrio',
  'bio',
]

const isFilled = (v: string | null | undefined): boolean =>
  typeof v === 'string' && v.trim().length > 0

/**
 * Returns 0..100 percent. Photo counts as one of the (FIELDS.length + 1)
 * slots so an unfilled photo with all-fields-filled lands at the same
 * fractional score as a filled photo with one-field-missing.
 */
export const completenessPct = (p: ProfileSnapshot): number => {
  const filledFields = FIELDS.filter((k) => isFilled(p[k])).length
  const total = FIELDS.length + 1
  const score = filledFields + (p.photo ? 1 : 0)
  return Math.round((score / total) * 100)
}

/** Read the snapshot from a live HTMLFormElement + photo hidden input. */
export const snapshotFromForm = (
  form: HTMLFormElement,
  photoKey: string | null,
): ProfileSnapshot => {
  const get = (name: string): string => {
    const el = form.elements.namedItem(name)
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.value ?? ''
    }
    return ''
  }
  return {
    displayName: get('displayName'),
    headline: get('headline'),
    phone: get('phone'),
    barrio: get('barrio'),
    bio: get('bio'),
    photo: photoKey,
  }
}
