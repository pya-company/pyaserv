/*
 * E2E: ?lang=de / ?lang=ru URL parameter must take effect on first load.
 *
 * Bug (lang-url-param-ignored-by-pre-paint-bootstrap):
 *   apps/site/public/bootstrap.js hardcodes
 *     isLoc = v => v === 'es' || v === 'en'
 *   so DE/RU/GN query-string values are rejected at the pre-paint stage.
 *   Navigator-language fallback is also EN-or-ES only:
 *     navigator.startsWith('en') ? 'en' : 'es'
 *   so a DE/RU/PT browser pre-paints as ES. ?lang=de is never persisted
 *   to localStorage either, so reload re-runs the same broken branch.
 *
 * AC-ML4: visitor on ?lang=de SHALL get full DE site — html[lang]='de',
 *          DE labels visible.
 * AC-ML1: detect locale from navigator.language without ES bias.
 *
 * These tests MUST be RED against prod until the bootstrap accepts the
 * full supported-locale set (es, en, de, ru — plus gn when added).
 */
import { expect, test } from '@playwright/test'

test.describe('?lang=<code> URL parameter — pre-paint locale', () => {
  test('?lang=de sets html[lang]=de on first paint', async ({ page }) => {
    await page.goto('/?lang=de')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.locator('html')).toHaveAttribute('data-loc', 'de')
  })

  test('?lang=ru sets html[lang]=ru on first paint', async ({ page }) => {
    await page.goto('/?lang=ru')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await expect(page.locator('html')).toHaveAttribute('data-loc', 'ru')
  })

  test('?lang=de is persisted to localStorage so reload stays DE', async ({ page }) => {
    await page.goto('/?lang=de')
    const stored = await page.evaluate(() => {
      try { return localStorage.getItem('pyaserv.locale') } catch { return null }
    })
    expect(stored).toBe('de')
  })

  test('?lang=ru is persisted to localStorage so reload stays RU', async ({ page }) => {
    await page.goto('/?lang=ru')
    const stored = await page.evaluate(() => {
      try { return localStorage.getItem('pyaserv.locale') } catch { return null }
    })
    expect(stored).toBe('ru')
  })
})

test.describe('Clicking a lang button writes ?lang=<code> to the URL (shareable)', () => {
  // Regression guard for the post-demo-removal cleanup: clicking ES/EN/DE/RU
  // must update history.replaceState so the address bar reflects the chosen
  // locale. Without this the URL a user copies from the bar doesn't carry
  // the language and the recipient sees the page in the wrong one.

  // The lang button lives in TWO DOM trees: desktop topbar nav and mobile
  // flying-menu. Desktop one is display:none on mobile and vice versa.
  // setLocale runs from a document-level click handler regardless of which
  // tree the click came from, so dispatching the click via JS bypasses the
  // viewport-specific visibility plumbing and tests the URL-update logic.
  const clickLang = async (page: import('@playwright/test').Page, lang: 'es' | 'en' | 'de' | 'ru'): Promise<void> => {
    await page.evaluate((l) => {
      const btn = document.querySelector<HTMLElement>(`.ps-lang-btn[data-lang="${l}"]`)
      if (!btn) throw new Error('lang button not found: ' + l)
      btn.click()
    }, lang)
    await page.waitForTimeout(400)
  }

  test('clicking RU lang button updates URL with ?lang=ru', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => { try { localStorage.clear() } catch {} })
    await clickLang(page, 'ru')
    expect(new URL(page.url()).searchParams.get('lang')).toBe('ru')
  })

  test('clicking DE lang button updates URL with ?lang=de', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => { try { localStorage.clear() } catch {} })
    await clickLang(page, 'de')
    expect(new URL(page.url()).searchParams.get('lang')).toBe('de')
  })

  test('switching locales replaces (not appends) the lang param', async ({ page }) => {
    await page.goto('/?lang=ru')
    await clickLang(page, 'en')
    const url = new URL(page.url())
    expect(url.searchParams.getAll('lang')).toEqual(['en'])
  })

  test('history is replaceState — back button does NOT cycle through lang clicks', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => { try { localStorage.clear() } catch {} })
    // Mark the initial history.length so we can assert no entries were pushed.
    const startLen = await page.evaluate(() => history.length)
    await clickLang(page, 'de')
    await clickLang(page, 'ru')
    await clickLang(page, 'en')
    const endLen = await page.evaluate(() => history.length)
    expect(endLen, 'replaceState must not grow history per lang click').toBe(startLen)
  })
})

test.describe('navigator.language — no ES bias for non-EN browsers (AC-ML1)', () => {
  // Asserts the EARLIEST observable state: while bootstrap.js (sync head
  // script) is the only thing that has run, html[lang] / data-loc must
  // already reflect the navigator's language family. A DE browser without
  // any ?lang or stored locale must NOT silently fall through to ES.
  test.use({ locale: 'de-DE' })

  test('navigator=de-DE: bootstrap pre-paint must not silently default to es', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.removeItem('pyaserv.locale') } catch {} })
    // Snapshot html[lang]/data-loc the moment bootstrap.js finishes —
    // before any later i18n module can correct it.
    await page.addInitScript(() => {
      const snap = () => {
        if ((window as unknown as { __locSnap?: unknown }).__locSnap) return
        ;(window as unknown as { __locSnap: { lang: string; loc?: string } }).__locSnap = {
          lang: document.documentElement.lang,
          loc: document.documentElement.dataset.loc,
        }
      }
      // bootstrap.js mutates <html> synchronously during head parse, so
      // DOMContentLoaded already sees its result.
      document.addEventListener('readystatechange', snap, true)
      document.addEventListener('DOMContentLoaded', snap, true)
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const snap = await page.evaluate(() => (window as unknown as { __locSnap?: { lang: string; loc?: string } }).__locSnap)
    expect(snap, 'bootstrap.js should have snapped before DOMContentLoaded').toBeTruthy()
    // The bug: bootstrap.js picks 'es' for any non-en navigator language.
    expect(snap?.lang).not.toBe('es')
    expect(snap?.loc).not.toBe('es')
  })
})
