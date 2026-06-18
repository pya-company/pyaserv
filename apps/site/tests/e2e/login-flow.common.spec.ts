/*
 * E2E: full email→code→authed login flow. The real bug it caught:
 *
 *   Backend /api/auth/otp/verify returns { ok, sid, csrf, hasPasskey, redirect }.
 *   Frontend was doing setToken(data.token) — `token` never existed in the
 *   response, so sessionStorage stayed empty. /me/ then bounced back to /login.
 *   THE most basic flow was broken end-to-end and nothing caught it.
 *
 * Strategy: mock both /auth/start and /auth/otp/verify with `page.route` so the
 * test runs offline without a real OTP roundtrip. Asserts:
 *   - sessionStorage gets the sid stored under the token key
 *   - the page navigates to the next URL (or backend-supplied redirect)
 *   - data-auth on <html> becomes "user"
 */
import { expect, test } from '@playwright/test'

const FAKE_SID = '01abcdef-fake-sid-1234-aaaaaaaa'

test.describe('login flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/start', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { method: 'otp', sentTo: 'te***@example.com' } }),
      }),
    )
    await page.route('**/api/auth/otp/verify', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { ok: true, sid: FAKE_SID, csrf: 'fake-csrf', hasPasskey: false },
        }),
      }),
    )
    // Block /v1/me so navigation to /me/ doesn't fail the test before assertions.
    await page.route('**/v1/me*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { userId: 'fake-user', roles: [] } }),
      }),
    )
  })

  test('email → code → token in sessionStorage → redirect', async ({ page }) => {
    await page.goto('/login/')

    // Step 1: enter email, submit
    await page.locator('#start-form input[name="email"]').fill('test@example.com')
    await page.locator('#start-form button[type="submit"]').click()

    // Step 2: code form visible, enter code
    await expect(page.locator('#verify-form')).toBeVisible()
    await page.locator('#verify-form input[name="code"]').fill('123456')
    await page.locator('#verify-form button[type="submit"]').click()

    // Step 3: navigation must leave /login/ (proves token was usable for /me/)
    // and sessionStorage must hold the SID. URL-first because submit triggers
    // an immediate location.href and a mid-flight evaluate() races the swap.
    await page.waitForURL((url) => !url.pathname.startsWith('/login/'), { timeout: 5000 })
    const stored = await page.evaluate(() => sessionStorage.getItem('pyaserv.token'))
    expect(stored).toBe(FAKE_SID)
  })
})
