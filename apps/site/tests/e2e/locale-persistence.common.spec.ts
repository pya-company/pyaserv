/*
 * E2E: the active locale (from localStorage) must survive ClientRouter swaps.
 *
 * Current bug: on /, bootstrap.js sets <html lang="en"> from localStorage.
 * After navigation via ClientRouter to /specialists/, the new document's
 * SSR'd <html lang="es"> wins because bootstrap.js doesn't re-run on swap.
 * Result: half the page renders Spanish (CSS hides .lang="es" spans only
 * when html[lang="en"], so when html flips back to "es" everything ES shows).
 *
 * This test MUST be RED until S7.2 re-applies locale on astro:after-swap.
 */
import { expect, test } from '@playwright/test'

test.describe('locale persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('pyaserv.locale', 'en') } catch {}
    })
  })

  test('initial paint of / is English', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Services in Paraguay/i)
  })

  test('REGRESSION GUARD: navigation keeps lang=en', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await page.getByRole('link', { name: /browse specialists|i need a specialist/i }).first().click()
    await expect(page).toHaveURL(/\/specialists\/$/)

    await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 2000 })
    // Visible UI chrome must be in English after the swap.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Available|Specialists/i, { timeout: 2000 })
  })

  test('REGRESSION GUARD: deep nav chain holds locale', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /browse specialists|i need a specialist/i }).first().click()
    await expect(page).toHaveURL(/\/specialists\/$/)
    // Click the first specialist card → detail page.
    await page.locator('a.ps-card').first().click()
    await expect(page).toHaveURL(/\/specialists\/[0-9a-f-]+\/$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})
