/*
 * Client-side content localization for static pages.
 *
 * SSR emits per-element JSON of all locale variants in data-l10n-text /
 * data-l10n-html attributes. On page load + on locale change, this module
 * picks the current locale and swaps the element's text or HTML.
 *
 * Why not full-page reload to a locale-prefixed route?
 *   Astro static build would need to generate ×N routes per page (we'd
 *   triple-quadruple our 467 pages). Inlining a few KB of JSON per content
 *   block is cheaper and avoids the route explosion.
 *
 * Attribute encoding:
 *   data-l10n-text  ='{"es":"…","en":"…","de":"…","ru":"…"}'  → textContent
 *   data-l10n-html  ='{"es":"<p>…</p>","en":"<p>…</p>"}'      → innerHTML
 *   data-l10n-attr  ='{"href":{"es":"…","en":"…"}}'           → setAttribute
 *
 * Each map MUST include the EN value at minimum (canonical fallback).
 */
import type { Locale } from './i18n.ts'

type LocaleMap = Partial<Record<Locale, string>>
type AttrMap = Record<string, LocaleMap>

const pick = (m: LocaleMap, loc: Locale): string =>
  m[loc] ?? m.en ?? m.es ?? Object.values(m)[0] ?? ''

const parseJson = <T>(s: string | null): T | null => {
  if (!s) return null
  try { return JSON.parse(s) as T } catch { return null }
}

export const applyContent = (loc: Locale, root: ParentNode = document): void => {
  for (const el of root.querySelectorAll<HTMLElement>('[data-l10n-text]')) {
    const map = parseJson<LocaleMap>(el.getAttribute('data-l10n-text'))
    if (map) el.textContent = pick(map, loc)
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-l10n-html]')) {
    const map = parseJson<LocaleMap>(el.getAttribute('data-l10n-html'))
    if (map) el.innerHTML = pick(map, loc)
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-l10n-attr]')) {
    const map = parseJson<AttrMap>(el.getAttribute('data-l10n-attr'))
    if (!map) continue
    for (const [name, lm] of Object.entries(map)) {
      el.setAttribute(name, pick(lm, loc))
    }
  }
}
