/*
 * E2E for path-based locale routing.
 *
 *   /            → tiny negotiator HTML → redirects to /<best>/
 *   /es/...      → es
 *   /en/...      → en
 *   /de/...      → de
 *   /ru/...      → ru
 *
 * Bare /<page>/ also negotiates and redirects to /<lang>/<page>/. No
 * ?lang=, no localStorage. URL is the only source of truth.
 */
import { expect, test } from '@playwright/test'
import { clickLang, gotoStable } from './_helpers.ts'

test.describe('Per-locale pages exist under /<lang>/', () => {
  for (const { path, expected } of [
    { path: '/es/',             expected: 'es' },
    { path: '/en/',             expected: 'en' },
    { path: '/de/',             expected: 'de' },
    { path: '/ru/',             expected: 'ru' },
    { path: '/es/specialists/', expected: 'es' },
    { path: '/en/specialists/', expected: 'en' },
    { path: '/de/specialists/', expected: 'de' },
    { path: '/ru/specialists/', expected: 'ru' },
  ]) {
    test(`${path} → html.lang = ${expected}`, async ({ page }) => {
      await gotoStable(page, path)
      await expect(page.locator('html')).toHaveAttribute('lang', expected)
      await expect(page.locator('html')).toHaveAttribute('data-loc', expected)
    })
  }
})

test.describe('Bare root / negotiates Accept-Language to /<lang>/', () => {
  for (const { langs, expected } of [
    { langs: ['ru-RU', 'ru'],          expected: '/ru/' },
    { langs: ['de-DE', 'de'],          expected: '/de/' },
    { langs: ['es-ES', 'es'],          expected: '/es/' },
    { langs: ['en-US'],                expected: '/en/' },
    { langs: ['ja-JP', 'ja'],          expected: '/en/' }, // unsupported → EN fallback
    { langs: ['pt-BR', 'es-AR', 'es'], expected: '/es/' }, // first supported wins
  ]) {
    test(`navigator.languages=${JSON.stringify(langs)} → ${expected}`, async ({ page }) => {
      await page.addInitScript((picks) => {
        Object.defineProperty(navigator, 'languages', { get: () => picks, configurable: true })
        Object.defineProperty(navigator, 'language', { get: () => picks[0], configurable: true })
      }, langs)
      await page.goto('/')
      await page.waitForURL((url) => url.pathname === expected)
      expect(new URL(page.url()).pathname).toBe(expected)
    })
  }

  test('bare /specialists/ also negotiates (with EN browser → /en/specialists/)', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US'], configurable: true })
    })
    await page.goto('/specialists/')
    await page.waitForURL((url) => url.pathname === '/en/specialists/')
  })
})

test.describe('Lang button click navigates to new locale prefix', () => {
  test('/es/ → click DE → /de/', async ({ page }) => {
    await gotoStable(page, '/es/')
    await clickLang(page, 'de')
    expect(new URL(page.url()).pathname).toBe('/de/')
  })

  test('/de/specialists/ → click RU → /ru/specialists/', async ({ page }) => {
    await gotoStable(page, '/de/specialists/')
    await clickLang(page, 'ru')
    expect(new URL(page.url()).pathname).toBe('/ru/specialists/')
  })

  test('/en/docs/ → click ES → /es/docs/', async ({ page }) => {
    await gotoStable(page, '/en/docs/')
    await clickLang(page, 'es')
    expect(new URL(page.url()).pathname).toBe('/es/docs/')
  })

  test('query string survives the locale switch', async ({ page }) => {
    await gotoStable(page, '/es/?cb=42')
    await clickLang(page, 'ru')
    expect(new URL(page.url()).search).toContain('cb=42')
    expect(new URL(page.url()).pathname).toBe('/ru/')
  })
})

test.describe('Internal nav links stay inside the current locale', () => {
  test('on /en/, the Specialists nav link is /en/specialists/', async ({ page }) => {
    await gotoStable(page, '/en/')
    const href = await page.locator('header.ps-topbar nav a[href*="specialists"]').first().getAttribute('href')
    expect(href).toBe('/en/specialists/')
  })

  test('on /ru/docs/, the Releases nav link is /ru/releases/', async ({ page }) => {
    await gotoStable(page, '/ru/docs/')
    const href = await page.locator('header.ps-topbar nav a[href*="releases"]').first().getAttribute('href')
    expect(href).toBe('/ru/releases/')
  })

  test('on /es/, internal nav links are prefixed with /es/', async ({ page }) => {
    await gotoStable(page, '/es/')
    const href = await page.locator('header.ps-topbar nav a[href*="docs"]').first().getAttribute('href')
    expect(href).toBe('/es/docs/')
  })
})
