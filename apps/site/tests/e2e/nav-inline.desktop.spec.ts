/*
 * E2E (desktop only): inline topbar nav must work on first load AND after
 * a ClientRouter swap. Same regression class as the mobile flying-menu —
 * the body inline <script> ran once and lost its handlers after ClientRouter
 * replaced the body. Document-level delegation fixes both at once; this test
 * proves the desktop side.
 */
import { expect, test } from '@playwright/test'

test.describe('desktop inline nav', () => {
  test('Specialists link routes after navigation chain', async ({ page }) => {
    await page.goto('/es/')
    // From home, click the topbar Specialists link.
    await page.locator('.ps-topbar__nav a').filter({ hasText: /Profesionales|Specialists/i }).click()
    await expect(page).toHaveURL(/\/specialists\/$/)

    // From /specialists/, click the topbar Clients link — proves the nav
    // is still wired after the prior ClientRouter swap.
    await page.locator('.ps-topbar__nav a').filter({ hasText: /Pedidos|Requests/i }).click()
    await expect(page).toHaveURL(/\/clients\/$/)
  })

  test('theme cycle button works after navigation', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.removeItem('pyaserv.theme') } catch {}
    })
    await page.goto('/es/')
    await page.locator('.ps-topbar__nav a').filter({ hasText: /Specialists|Profesionales/i }).click()
    await expect(page).toHaveURL(/\/specialists\/$/)

    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'auto')
    await page.locator('#theme-btn').click()
    await expect(html).toHaveAttribute('data-theme', /light|dark/)
  })
})
