/*
 * E2E: locale survives in-app navigation. Architecture is path-based —
 * /en/foo → en, etc. The "persistence" we guard is that nav clicks INSIDE
 * /en/ keep us under /en/, so html.lang stays 'en'.
 */
import { expect, test } from '@playwright/test'
import { gotoStable } from './_helpers.ts'

test.describe('locale persistence (path-based)', () => {
  test('initial paint of /en/ is English', async ({ page }) => {
    await gotoStable(page, '/en/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Services in Paraguay/i)
  })

  test('REGRESSION GUARD: nav from /en/ keeps lang=en (links rewritten to /en/)', async ({ page }) => {
    await gotoStable(page, '/en/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await page.getByRole('link', { name: /browse specialists|i need a specialist/i }).first().click()
    await page.waitForURL(/\/en\/specialists\/$/)
    await page.locator('html[data-i18n-ready="1"]').waitFor({ state: 'attached' })
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Available|Specialists/i)
  })

  test('REGRESSION GUARD: deep nav chain inside /en/ holds locale', async ({ page }) => {
    await gotoStable(page, '/en/')
    await page.getByRole('link', { name: /browse specialists|i need a specialist/i }).first().click()
    await page.waitForURL(/\/en\/specialists\/$/)
    await page.locator('html[data-i18n-ready="1"]').waitFor({ state: 'attached' })
    await page.locator('a.ps-card').first().click()
    await page.waitForURL(/\/en\/specialists\/[0-9a-z-]+\/$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})
