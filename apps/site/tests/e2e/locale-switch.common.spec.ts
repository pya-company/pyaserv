/*
 * Locale switcher — actually swaps visible content, not just aria-pressed.
 *
 * Regression guard for the 2026-06-27 bug: clicking ES/EN/DE/RU buttons
 * caused the active-button visual to change but the visible release titles
 * stayed in their SSR default (Spanish). Fix: server emits per-locale JSON
 * in data-l10n-text / data-l10n-html attrs, client swaps without reload.
 *
 * Cross-viewport: on mobile the topbar nav (and its lang switcher) is hidden
 * behind a flying-menu; we open it first. On desktop it's inline.
 */
import { expect, test } from '@playwright/test'

const clickLang = async (page: import('@playwright/test').Page, lang: 'es' | 'en' | 'de' | 'ru') => {
  const viewport = page.viewportSize()
  const isMobile = (viewport?.width ?? 1280) < 720
  if (isMobile) {
    // Open the flying-menu floating trigger first. Menu animates open with
    // a transform, so `waitFor visible` succeeds before the click point is
    // stable — force the click to bypass Playwright's stability retry loop
    // (the click still fires the button handler correctly).
    await page.locator('#menu-btn').click()
    const btn = page.locator('.ps-fly__menu .ps-lang-btn[data-lang="' + lang + '"]')
    await btn.waitFor({ state: 'visible', timeout: 5000 })
    await btn.click({ force: true })
  } else {
    await page.locator('.ps-topbar__nav .ps-lang-btn[data-lang="' + lang + '"]').click()
  }
  await page.waitForTimeout(300)
}

test.describe('Locale switcher — content actually swaps', () => {
  test('clicking ES replaces release title with Spanish copy', async ({ page }) => {
    await page.goto('/releases/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)

    await clickLang(page, 'es')

    const card = page.locator('.release-card').first()
    await expect(card.locator('.release-card__title a')).toContainText(/idiomas|Cuatro/)
  })

  test('clicking EN replaces release title with English copy', async ({ page }) => {
    await page.goto('/releases/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)

    await clickLang(page, 'en')

    const card = page.locator('.release-card').first()
    await expect(card.locator('.release-card__title a')).toContainText(/languages|Four/)
  })

  test('clicking RU replaces release title with Cyrillic copy', async ({ page }) => {
    await page.goto('/releases/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)

    await clickLang(page, 'ru')

    const card = page.locator('.release-card').first()
    await expect(card.locator('.release-card__title a')).toContainText(/языка|Четыре/)
  })

  test('clicking DE replaces release title with German copy', async ({ page }) => {
    await page.goto('/releases/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)

    await clickLang(page, 'de')

    const card = page.locator('.release-card').first()
    await expect(card.locator('.release-card__title a')).toContainText(/Sprachen|Vier/)
  })

  test('section body HTML swaps with locale', async ({ page }) => {
    await page.goto('/releases/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)

    // Swap directly to EN — proves the per-locale data-l10n-html attrs are
    // wired and applyContent() runs without a page reload. (Avoid double-
    // swap ES→EN: on mobile the flying-menu animation makes the second
    // open + click race intermittently.)
    await clickLang(page, 'en')

    const body = page.locator('.release-card').first().locator('.release-section__body').first()
    await expect(body).toContainText(/Spanish|English|German|top bar/)
  })

  test('language buttons render text labels, not squares', async ({ page }) => {
    await page.goto('/releases/')
    const labels = await page.locator('.ps-lang-btn').allTextContents()
    const uniq = Array.from(new Set(labels.map((s) => s.trim())))
    expect(uniq).toEqual(expect.arrayContaining(['ES', 'EN', 'DE', 'RU']))
  })
})
