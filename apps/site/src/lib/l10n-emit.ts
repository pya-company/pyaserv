/*
 * Server-side helpers (used in Astro frontmatter) to emit data-l10n-*
 * attributes containing per-locale JSON. Default visible value is the
 * `defaultLoc` variant; client JS swaps on locale change.
 */
import { CONTENT } from '../locales/_built.ts'
import { LOCALES, type Locale } from './i18n.ts'

type LocaleMap = Partial<Record<Locale, string>>

const ALL: ReadonlyArray<Locale> = LOCALES.filter((l) => l !== 'gn') as ReadonlyArray<Locale>

/** Pull a string value from a per-locale lookup path (e.g. release titles). */
export const getAllLocales = (
  type: 'releases' | 'docs',
  slug: string,
  path: ReadonlyArray<string | number>,
): LocaleMap => {
  const out: LocaleMap = {}
  for (const loc of ALL) {
    let cur: unknown = (CONTENT as Record<string, Record<string, Record<string, unknown>>>)[loc]?.[type]?.[slug]
    for (const k of path) {
      if (cur == null) break
      cur = (cur as Record<string | number, unknown>)[k]
    }
    if (typeof cur === 'string') out[loc] = cur
  }
  return out
}

/** Emit a data-l10n-text attribute string. */
export const dataL10nText = (m: LocaleMap): string =>
  `data-l10n-text='${escapeAttr(JSON.stringify(m))}'`

/** Emit a data-l10n-html attribute string. */
export const dataL10nHtml = (m: LocaleMap): string =>
  `data-l10n-html='${escapeAttr(JSON.stringify(m))}'`

const escapeAttr = (s: string): string =>
  s.replace(/'/g, '&#39;').replace(/</g, '&lt;')
