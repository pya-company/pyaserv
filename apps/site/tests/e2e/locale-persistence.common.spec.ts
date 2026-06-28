/*
 * E2E: locale survives in-app navigation. Architecture is path-based —
 * /en/foo → en, /de/foo → de, etc. The "persistence" we test is:
 * starting at /en/, every nav click stays under /en/, so html.lang stays 'en'.
 *
 * The previous version of this test used localStorage to seed the locale.
 * That's irrelevant now (we have no client-side locale store). Instead we
 * navigate directly to the locale-prefixed URL.
 */
import { expect, test } from '@playwright/test'

test.describe('locale persistence (path-based)', () => {
  test('initial paint of /en/ is English', async ({ page }) => {
    await page.goto('/en/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Services in Paraguay/i)
  })

  test('REGRESSION GUARD: nav from /en/ keeps lang=en (links rewritten to /en/)', async ({ page }) => {
    await page.goto('/en/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.waitForTimeout(800) // initPage rewrites internal hrefs

    await page.getByRole('link', { name: /browse specialists|i need a specialist/i }).first().click()
    await expect(page).toHaveURL(/\/en\/specialists\/$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 2000 })
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Available|Specialists/i, { timeout: 2000 })
  })

  test('REGRESSION GUARD: deep nav chain inside /en/ holds locale', async ({ page }) => {
    await page.goto('/en/')
    await page.waitForTimeout(800)
    await page.getByRole('link', { name: /browse specialists|i need a specialist/i }).first().click()
    await expect(page).toHaveURL(/\/en\/specialists\/$/)
    await page.waitForTimeout(800)
    await page.locator('a.ps-card').first().click()
    // Card hrefs are also rewritten to include /en/ prefix
    await expect(page).toHaveURL(/\/en\/specialists\/[0-9a-z-]+\/$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})
