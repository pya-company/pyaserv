/*
 * E2E: full email→code→authed login flow through the LoginDialog modal (S24).
 *
 * The real bug this guards against:
 *   Backend /api/auth/otp/verify returns { ok, sid, csrf, hasPasskey, redirect }.
 *   An earlier build called setToken(data.token) — `token` never existed.
 *   sessionStorage stayed empty. /me/ bounced back to /login.
 *
 * Now /login/ is a redirect to /?login=1 which auto-opens the dialog. We
 * test the dialog flow against mocked /auth endpoints.
 */
import { expect, test } from '@playwright/test'

const FAKE_SID = '01abcdef-fake-sid-1234-aaaaaaaa'

test.describe('login dialog flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Prior tests in the same worker may have set a session token; without
    // clearing, my openLoginDialog short-circuits because data-auth=user.
    await context.clearCookies()
    await page.goto('about:blank')
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
        // hasPasskey:true bypasses the post-OTP enroll prompt so this test
        // continues to assert the bare close-dialog behavior. The enroll path
        // is covered by passkey-flow.common.spec.ts.
        body: JSON.stringify({
          data: { ok: true, sid: FAKE_SID, csrf: 'fake-csrf', hasPasskey: true },
        }),
      }),
    )
    // Block the discoverable-credential endpoint so passkey-first doesn't fire.
    await page.route('**/api/auth/passkey/discover/options', (route) =>
      route.fulfill({ status: 404, body: '' }),
    )
  })

  test('open dialog → email → code → sessionStorage has SID + dialog closed', async ({ page }) => {
    // Force a guest state on initial load so openLoginDialog isn't a no-op.
    await page.addInitScript(() => {
      try { sessionStorage.removeItem('pyaserv.token') } catch {}
    })
    // Auto-open via ?login=1 — works for both mobile (where the topbar
    // Sign in button is hidden behind the flying-menu) and desktop.
    await page.goto('/?login=1')

    const dlg = page.locator('#login-dlg')
    await expect(dlg).toHaveAttribute('open', '', { timeout: 5000 })

    await page.locator('#dlg-start input[name="email"]').fill('test@example.com')
    // Submit via Enter so we don't race the dialog's submit handler with
    // Playwright's post-click actionability checks (the click on the next
    // submit button is intermittently observed-but-not-fired).
    await page.locator('#dlg-start input[name="email"]').press('Enter')

    await expect(page.locator('#dlg-verify')).toBeVisible()
    await page.locator('#dlg-verify input[name="code"]').fill('123456')
    await page.locator('#dlg-verify input[name="code"]').press('Enter')

    // Dialog closes on success
    await expect(dlg).not.toHaveAttribute('open', '', { timeout: 5000 })
    const stored = await page.evaluate(() => sessionStorage.getItem('pyaserv.token'))
    expect(stored).toBe(FAKE_SID)
    // URL stayed at / — no /login/ page in history
    expect(new URL(page.url()).pathname).toBe('/')
  })

  test('/login/ redirects to /?login=1 and auto-opens dialog', async ({ page }) => {
    await page.addInitScript(() => {
      try { sessionStorage.removeItem('pyaserv.token') } catch {}
    })
    await page.goto('/login/')
    await page.waitForURL((url) => url.pathname === '/', { timeout: 5000 })
    await expect(page.locator('#login-dlg')).toHaveAttribute('open', '', { timeout: 2000 })
    // login param has been stripped from URL
    expect(new URL(page.url()).searchParams.get('login')).toBeNull()
  })

  test('magic link (/login#email=&code=) auto-signs-in without opening dialog', async ({ page }) => {
    await page.addInitScript(() => {
      try { sessionStorage.removeItem('pyaserv.token') } catch {}
    })
    // Navigate to /login with hash; the redirect must preserve it,
    // initPage parses the hash, and /otp/verify gets called automatically.
    // Wait for the verify request to fire so we know the auto-verify path ran.
    const verifyRequest = page.waitForRequest('**/api/auth/otp/verify', { timeout: 8000 })
    await page.goto('/login/#email=test%40example.com&code=123456')
    await verifyRequest
    // Poll until setToken commits (it runs in an async then() after the fetch).
    await expect.poll(
      async () => page.evaluate(() => sessionStorage.getItem('pyaserv.token')),
      { timeout: 5000 },
    ).toBe(FAKE_SID)
    await expect(page.locator('#login-dlg')).not.toHaveAttribute('open', '')
    expect(new URL(page.url()).hash).toBe('')
  })
})
