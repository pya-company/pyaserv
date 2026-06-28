/*
 * PyaServ i18n — file-based, YAML-driven, locale-agnostic.
 *
 * Source-of-truth: apps/site/src/locales/<locale>/<namespace>.yaml
 * Add a new string: drop it in the YAML, reference as `t('namespace.key')`.
 * Add a new language: create the locale folder, ship a translator on it.
 *
 * Fallback chain at runtime: requested-locale → EN → raw key.
 * EN is the canonical mandatory-complete dict (unit test in i18n.test.ts).
 */
import { DICTS } from '../locales/_built.ts'

export type Locale = 'es' | 'en' | 'de' | 'ru' | 'gn'
export const LOCALES: ReadonlyArray<Locale> = ['es', 'en', 'de', 'ru', 'gn']

const STORAGE_KEY = 'pyaserv.locale'

const isLocale = (v: unknown): v is Locale =>
  v === 'es' || v === 'en' || v === 'de' || v === 'ru' || v === 'gn'

const detectFromNavigator = (): Locale => {
  if (typeof navigator === 'undefined') return 'en'
  const lang = (navigator.language || '').toLowerCase()
  if (lang.startsWith('de')) return 'de'
  if (lang.startsWith('ru')) return 'ru'
  if (lang.startsWith('es')) return 'es'
  if (lang.startsWith('gn')) return 'gn'
  return 'en'
}

export const getLocale = (): Locale => {
  if (typeof globalThis === 'undefined') return 'en'
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {}
  try {
    const url = new URL(globalThis.location?.href ?? 'http://x/')
    const qp = url.searchParams.get('lang')
    if (isLocale(qp)) return qp
  } catch {}
  return detectFromNavigator()
}

export const setLocale = (l: Locale): void => {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, l) } catch {}
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l
    document.documentElement.dataset.loc = l
  }
  // Reflect the choice in the URL so the link a user shares from the address
  // bar carries the language — `?lang=ru` opens that page in Russian on the
  // recipient's browser regardless of their stored preference. Uses
  // replaceState so back-button history isn't polluted with one entry per
  // language click. bootstrap.js reads ?lang= first on every page load.
  if (typeof location !== 'undefined' && typeof history !== 'undefined') {
    try {
      const url = new URL(location.href)
      if (url.searchParams.get('lang') !== l) {
        url.searchParams.set('lang', l)
        history.replaceState(history.state, '', url.toString())
      }
    } catch {}
  }
  // Dispatch a custom event so app code can re-render content without a
  // full reload. Base.astro listens → applyContent + applyI18n + aria-pressed.
  try { globalThis.dispatchEvent(new CustomEvent('pyaserv:locale', { detail: { locale: l } })) } catch {}
}

type Dict = Readonly<Record<string, string>>
type LocaleDicts = Readonly<Record<Locale, Dict>>

const DICT: LocaleDicts = DICTS as LocaleDicts

// Exposed for tests + parity checks
export const ES: Dict = DICT.es
export const EN: Dict = DICT.en
export const DE: Dict = DICT.de
export const RU: Dict = DICT.ru
export const GN: Dict = DICT.gn

/* ----------- t() with locale → EN → key fallback chain ----------- */

export const t = (key: string): string => tFor(getLocale(), key)

export const tFor = (loc: Locale, key: string): string =>
  DICT[loc][key] ?? DICT.en[key] ?? DICT.es[key] ?? key

/* ----------- helpers ----------- */

export const interp = (template: string, vars: Readonly<Record<string, string | number>>): string =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`))

const CURRENCY_LOCALE: Readonly<Record<Locale, string>> = {
  es: 'es-PY', en: 'en-US', de: 'de-DE', ru: 'ru-RU', gn: 'es-PY',
}

export const formatGs = (gs: number | null | undefined): string => {
  if (gs === undefined || gs === null) return t('common.price_tbd')
  const n = new Intl.NumberFormat(CURRENCY_LOCALE[getLocale()], { maximumFractionDigits: 0 }).format(gs)
  return `${n} Gs`
}

export const formatRelativeTime = (unixSeconds: number): string => {
  const now = Math.floor(Date.now() / 1000)
  const delta = now - unixSeconds
  const loc = getLocale()
  if (delta < 60) return tFor(loc, 'common.now')
  // Use Intl.RelativeTimeFormat for unit pluralization across locales.
  const rtf = new Intl.RelativeTimeFormat(CURRENCY_LOCALE[loc], { numeric: 'auto' })
  if (delta < 3600) return rtf.format(-Math.floor(delta / 60), 'minute')
  if (delta < 86400) return rtf.format(-Math.floor(delta / 3600), 'hour')
  if (delta < 604800) return rtf.format(-Math.floor(delta / 86400), 'day')
  return new Date(unixSeconds * 1000).toLocaleDateString(CURRENCY_LOCALE[loc], {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

/* ----------- DOM apply (для data-i18n атрибутов) ----------- */

export const applyI18n = (root: ParentNode = document): void => {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset.i18n
    if (key) el.textContent = t(key)
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]')) {
    const key = el.dataset.i18nPlaceholder
    if (key && 'placeholder' in el) {
      ;(el as HTMLInputElement | HTMLTextAreaElement).placeholder = t(key)
    }
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const key = el.dataset.i18nAria
    if (key) el.setAttribute('aria-label', t(key))
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-html]')) {
    const key = el.dataset.i18nHtml
    if (key) el.innerHTML = t(key)
  }
}
