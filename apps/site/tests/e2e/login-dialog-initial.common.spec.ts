/*
 * E2E regression: LoginDialog initial render — only the start (email) form
 * is visible. The verify form (#dlg-verify) carries the [hidden] attribute
 * in SSR HTML, and must stay collapsed until the user requests a code.
 *
 * Bug: `.ps-form { display: grid }` (global.css) was authored without a
 * `:not([hidden])` guard, so CSS overrides the HTML [hidden] attribute and
 * #dlg-verify renders alongside #dlg-start on first open. The user sees:
 *   email input → Send code → (empty) Code (6 digits) input → Confirm → Change email
 *
 * RED on current prod, GREEN once the .ps-form rule (or [hidden] handling)
 * is fixed to respect the hidden attribute.
 */
import { expect, test } from '@playwright/test'

test.describe('login dialog initial render', () => {
  test.beforeEach(async ({ context, page }) => {
    // Make sure we are a guest — prior tests in the worker may have set a
    // session token, which would short-circuit openLoginDialog.
    await context.clearCookies()
    await page.addInitScript(() => {
      try { sessionStorage.removeItem('pyaserv.token') } catch {}
    })
  })

  test('only #dlg-start is visible on first open; #dlg-verify stays hidden', async ({ page }) => {
    // /me/ as a guest auto-opens the login dialog.
    await page.goto('/me/')

    const dlg = page.locator('#login-dlg')
    await expect(dlg).toHaveAttribute('open', '', { timeout: 5000 })

    const start = page.locator('#dlg-start')
    const verify = page.locator('#dlg-verify')

    // Sanity: start form is visible.
    await expect(start).toBeVisible()

    // The actual bug assertion. Playwright's toBeHidden honours
    // `display:none`/`visibility:hidden`/the [hidden] attribute — but on the
    // current build the global `.ps-form { display: grid }` rule overrides
    // [hidden], so getComputedStyle(verify).display === 'grid' and the
    // element is visually rendered. This expect MUST fail until the CSS
    // is corrected to honour [hidden].
    await expect(verify).toBeHidden()

    // Cross-check at the computed-style level for a clearer failure message
    // when the visibility assertion above misses (e.g. if the element gets
    // visibility:hidden in a future fix but display stays grid).
    const display = await verify.evaluate((el) => getComputedStyle(el).display)
    expect(
      display,
      `#dlg-verify has [hidden] in SSR but computed display="${display}" — .ps-form rule overrides the attribute`,
    ).toBe('none')

    // And a behavioural assertion the user would notice: the code input
    // inside the verify form must not be a tab/focus target before the
    // user has even asked for a code.
    const codeInputVisible = await page.locator('#dlg-verify input[name="code"]').isVisible()
    expect(codeInputVisible, '#dlg-verify input[name="code"] is rendered on first open').toBe(false)
  })
})
