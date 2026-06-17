/*
 * E2E: mobile flying-menu must keep working after a ClientRouter swap.
 *
 * Repro the old bug: load /, navigate to /specialists/ via in-page link,
 * tap the floating menu trigger — the previous build's listener was
 * attached once and died after the body swap. With the delegated handler
 * + custom element's own toggle, this stays alive.
 */
import { expect, test } from '@playwright/test'

// flying-menu only renders on mobile viewports — desktop uses inline nav.
test.describe('mobile flying-menu', () => {
  test.skip(({ viewport }) => !!viewport && viewport.width >= 720, 'flying-menu is mobile-only')

  test('opens on first page load', async ({ page }) => {
    await page.goto('/')
    const fly = page.locator('flying-menu')
    await expect(fly).not.toHaveAttribute('open', '')
    const trigger = fly.locator('[slot="trigger"]')
    await trigger.tap()
    await expect(fly).toHaveAttribute('open', '', { timeout: 2000 })
  })

  test('REGRESSION GUARD: still opens after ClientRouter navigation', async ({ page }) => {
    await page.goto('/')

    // Cross-page navigation via in-page <a href="/specialists/"> — ClientRouter
    // intercepts and swaps the body instead of a full reload.
    await page.getByRole('link', { name: /browse specialists|ver profesionales|i need a specialist|necesito a un profesional/i }).first().click()
    await expect(page).toHaveURL(/\/specialists\/$/)

    // Now try the floating menu trigger on the new page.
    const fly = page.locator('flying-menu')
    await expect(fly).not.toHaveAttribute('open', '')
    const trigger = fly.locator('[slot="trigger"]')
    await trigger.tap()
    await expect(fly).toHaveAttribute('open', '', { timeout: 2000 })
  })
})
