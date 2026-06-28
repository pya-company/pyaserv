/*
 * E2E for path-based locale routing — pyaserv.com is locale-via-URL only.
 *
 * Architecture: /         → es (default at root)
 *               /en/...   → en
 *               /de/...   → de
 *               /ru/...   → ru
 *
 * No ?lang= query param. No localStorage. The URL IS the source of truth.
 * bootstrap.js reads the first non-empty path segment; if it's a known locale
 * code that's the locale, otherwise 'es'. Lang switcher click navigates to
 * the same page under the new locale prefix.
 */
import { expect, test, type Page } from '@playwright/test'

const clickLang = async (page: Page, lang: 'es' | 'en' | 'de' | 'ru'): Promise<void> => {
  await page.evaluate((l) => {
    const btn = document.querySelector<HTMLElement>(`.ps-lang-btn[data-lang="${l}"]`)
    if (!btn) throw new Error('lang button missing: ' + l)
    btn.click()
  }, lang)
  await page.waitForURL((url) => url.pathname === '/' || /^\/(en|de|ru)?\//.test(url.pathname), { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(400)
}

test.describe('Path-based locale routing — / = es, /en/ /de/ /ru/ = others', () => {
  for (const { path, expected } of [
    { path: '/',               expected: 'es' },
    { path: '/en/',            expected: 'en' },
    { path: '/de/',            expected: 'de' },
    { path: '/ru/',            expected: 'ru' },
    { path: '/en/specialists/', expected: 'en' },
    { path: '/de/specialists/', expected: 'de' },
    { path: '/ru/specialists/', expected: 'ru' },
  ]) {
    test(`${path} → html.lang = ${expected}`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(400)
      await expect(page.locator('html')).toHaveAttribute('lang', expected)
      await expect(page.locator('html')).toHaveAttribute('data-loc', expected)
    })
  }
})

test.describe('Lang button click navigates to new locale prefix', () => {
  test('ES / → click DE → /de/', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)
    await clickLang(page, 'de')
    expect(new URL(page.url()).pathname).toBe('/de/')
  })

  test('/de/specialists/ → click RU → /ru/specialists/', async ({ page }) => {
    await page.goto('/de/specialists/')
    await page.waitForTimeout(500)
    await clickLang(page, 'ru')
    expect(new URL(page.url()).pathname).toBe('/ru/specialists/')
  })

  test('/en/docs/ → click ES → /docs/ (root, no prefix)', async ({ page }) => {
    await page.goto('/en/docs/')
    await page.waitForTimeout(500)
    await clickLang(page, 'es')
    expect(new URL(page.url()).pathname).toBe('/docs/')
  })

  test('query string survives the locale switch', async ({ page }) => {
    await page.goto('/?cb=42')
    await page.waitForTimeout(500)
    await clickLang(page, 'ru')
    expect(new URL(page.url()).search).toContain('cb=42')
    expect(new URL(page.url()).pathname).toBe('/ru/')
  })
})

test.describe('Internal nav links stay inside the current locale', () => {
  test('on /en/, clicking the Specialists nav link goes to /en/specialists/', async ({ page }) => {
    await page.goto('/en/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800) // initPage rewrites internal hrefs
    const href = await page.locator('header.ps-topbar nav a[href*="specialists"]').first().getAttribute('href')
    expect(href).toBe('/en/specialists/')
  })

  test('on /ru/docs/, clicking the Releases nav link goes to /ru/releases/', async ({ page }) => {
    await page.goto('/ru/docs/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    const href = await page.locator('header.ps-topbar nav a[href*="releases"]').first().getAttribute('href')
    expect(href).toBe('/ru/releases/')
  })
})
