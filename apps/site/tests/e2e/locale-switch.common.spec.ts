/*
 * Locale switcher — clicking ES/EN/DE/RU navigates to the corresponding
 * /<code>/releases/ page and the content is server-rendered in that locale.
 * (Architecture changed from SPA-style in-place content swap to full
 * navigation between /es/ /en/ /de/ /ru/ — i18n.ts setLocale does
 * location.href to the new locale path.)
 */
import { expect, test } from '@playwright/test'
import { clickLang, gotoStable } from './_helpers.ts'

test.describe('Locale switcher navigates to /<code>/releases/ with localized title', () => {
  test('ES → click EN → /en/releases/ shows English title', async ({ page }) => {
    await gotoStable(page, '/es/releases/')
    await clickLang(page, 'en')
    expect(new URL(page.url()).pathname).toBe('/en/releases/')
    const card = page.locator('.release-card').first()
    await expect(card.locator('.release-card__title a')).toContainText(/languages|Four/)
  })

  test('ES → click RU → /ru/releases/ shows Cyrillic title', async ({ page }) => {
    await gotoStable(page, '/es/releases/')
    await clickLang(page, 'ru')
    expect(new URL(page.url()).pathname).toBe('/ru/releases/')
    const card = page.locator('.release-card').first()
    await expect(card.locator('.release-card__title a')).toContainText(/языка|Четыре/)
  })

  test('ES → click DE → /de/releases/ shows German title', async ({ page }) => {
    await gotoStable(page, '/es/releases/')
    await clickLang(page, 'de')
    expect(new URL(page.url()).pathname).toBe('/de/releases/')
    const card = page.locator('.release-card').first()
    await expect(card.locator('.release-card__title a')).toContainText(/Sprachen|Vier/)
  })

  test('section body HTML is server-rendered in the target locale', async ({ page }) => {
    await gotoStable(page, '/es/releases/')
    await clickLang(page, 'en')
    expect(new URL(page.url()).pathname).toBe('/en/releases/')
    const body = page.locator('.release-card').first().locator('.release-section__body').first()
    await expect(body).toContainText(/Spanish|English|German|top bar/)
  })

  test('lang switcher buttons render their two-letter codes', async ({ page }) => {
    await gotoStable(page, '/es/releases/')
    const labels = await page.locator('.ps-lang-btn').allTextContents()
    const uniq = Array.from(new Set(labels.map((s) => s.trim())))
    expect(uniq).toEqual(expect.arrayContaining(['ES', 'EN', 'DE', 'RU']))
  })
})
