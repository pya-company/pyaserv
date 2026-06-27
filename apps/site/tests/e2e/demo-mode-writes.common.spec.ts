/*
 * Demo Mode — write-isolation regression suite (BUG: demo-writes-real-db-via-bypassed-fetch).
 *
 * Safety Charter mech 5 + AC-L2: THE SYSTEM SHALL NEVER write to the database
 * from any demo route. Every write must be intercepted by demoStub.
 *
 * Confirmed bug (2026-06-27):
 *   1. apps/site/src/lib/api.ts:96 uploadImage() calls raw fetch(${API}/v1/media,…)
 *      — bypasses isDemoMode()/demoStub entirely.
 *   2. demoStub ROUTES table is missing several write endpoints reached from the
 *      authed pages: POST /v1/listings, POST /v1/requests, POST /v1/me/quote-templates,
 *      PATCH /v1/me/notifications, /api/auth/passkeys.
 *
 * Strategy: load each authed write surface with ?demo=1, drive the action, and
 * assert that NO network request hits the real production API host
 * (https://api.pyaserv.com). Auth is faked locally by seeding a sessionStorage
 * token — page-level redirect only checks getToken() exists, and demoStub
 * MUST short-circuit before the bearer ever leaves the browser.
 *
 * Tests are RED on current prod (write requests escape to api.pyaserv.com) and
 * will go GREEN once uploadImage routes through apiFetch AND the missing write
 * paths are added to demoStub ROUTES.
 */
import { expect, test, type Page, type Request } from '@playwright/test'

const API_HOST = 'api.pyaserv.com'

// 1x1 transparent PNG (smallest valid image — passes ALLOWED_IMG_TYPES + size check).
const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const seedAuth = async (page: Page): Promise<void> => {
  // Seed before any page script runs. The login redirect only checks
  // sessionStorage.getItem('pyaserv.token') — any non-empty value passes.
  await page.addInitScript(() => {
    try { sessionStorage.setItem('pyaserv.token', 'demo-fake-token-not-real') } catch {}
  })
}

const trackProdApiCalls = (page: Page): Request[] => {
  const calls: Request[] = []
  page.on('request', (req) => {
    const u = new URL(req.url())
    if (u.host === API_HOST) calls.push(req)
  })
  return calls
}

const writeMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])
const onlyWrites = (reqs: Request[]): Request[] =>
  reqs.filter((r) => writeMethods.has(r.method().toUpperCase()))

const describeCalls = (reqs: Request[]): string =>
  reqs.map((r) => `${r.method()} ${r.url()}`).join('\n')

test.describe('Demo Mode write-isolation — NO request must reach api.pyaserv.com', () => {
  test('POST /v1/requests from /me/requests/new/?demo=1 must NOT hit prod API', async ({ page }) => {
    await seedAuth(page)
    const prodCalls = trackProdApiCalls(page)

    await page.goto('/me/requests/new/?demo=1')
    await expect(page.locator('#demo-banner')).toBeVisible({ timeout: 5000 })

    await expect(page.locator('#category option').nth(1)).toBeAttached({ timeout: 5000 })

    await page.locator('select[name="category"]').selectOption({ index: 1 })
    await page.locator('input[name="title"]').fill('Demo regression — should be stubbed')
    await page.locator('textarea[name="description"]').fill('Reproducing demo-writes-real-db bug')
    // barrio is HTML5-required on this form; without it the submit button does
    // nothing and the bug never gets a chance to manifest.
    await page.locator('input[name="barrio"]').fill('Villa Morra')

    await page.locator('form#form button[type="submit"]').click()
    await page.waitForTimeout(2500)

    const writes = onlyWrites(prodCalls)
    expect(
      writes,
      `Demo Mode wrote to real prod API. Captured writes:\n${describeCalls(writes)}`,
    ).toEqual([])
  })

  test('uploadImage() POST /v1/media in demo mode must NOT hit prod API', async ({ page }) => {
    await seedAuth(page)
    const prodCalls = trackProdApiCalls(page)

    // Land on the listing form because it imports uploadImage and exposes a
    // file input wired to it. Demo mode is active via ?demo=1.
    await page.goto('/me/listings/new/?demo=1')
    await expect(page.locator('#demo-banner')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#photo-input')).toBeAttached({ timeout: 5000 })

    // Drop a real PNG into the hidden file input — the change handler awaits
    // uploadImage(file). Under the bug, uploadImage uses raw fetch() and
    // bypasses isDemoMode entirely → request goes to api.pyaserv.com/v1/media.
    await page.locator('#photo-input').setInputFiles({
      name: 'demo-test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_1x1_BASE64, 'base64'),
    })

    await page.waitForTimeout(2500)

    const mediaWrites = onlyWrites(prodCalls).filter((r) => r.url().includes('/v1/media'))
    expect(
      mediaWrites,
      `uploadImage() bypassed demoStub and posted to real prod API. Captured:\n${describeCalls(mediaWrites)}`,
    ).toEqual([])
  })
})
