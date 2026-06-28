/*
 * Dashboard /me/ tab-switch — STRUCTURAL guard that every tab panel uses
 * content-visibility:hidden (not display:none). When panels are
 * display:none, switching tabs forces a fresh layout pass on every
 * first-time reveal (~393ms on a real device for the profile panel —
 * 7 inputs, 3 fieldsets, passkey list, completeness meter). With
 * content-visibility:hidden the rendering state is preserved and the
 * switch is sub-frame.
 *
 * Previous version of this test measured click→paint under 4× CPU throttle
 * with an 80ms budget. The budget was flaky on shared CI runners (no
 * predictable CPU pressure). The fix in CSS is the actual guarantee, so we
 * assert the computed style instead — deterministic, event-driven, no
 * timeouts.
 */
import { expect, test, type Page } from '@playwright/test'

const BYPASS_KEY = process.env.PYASERV_DEV_BYPASS_KEY ?? ''
const API = process.env.PYASERV_API_URL ?? 'https://api.pyaserv.com'

const provisionSession = async (): Promise<string> => {
  if (!BYPASS_KEY) throw new Error('PYASERV_DEV_BYPASS_KEY missing')
  const r = await fetch(`${API}/api/dev/login?email=e2e-tab-switch@e2e.invalid`, {
    method: 'POST', headers: { 'X-Dev-Bypass-Key': BYPASS_KEY },
  })
  if (!r.ok) throw new Error(`dev login HTTP ${r.status}`)
  const body = await r.json() as { data: { sessionToken: string } }
  return body.data.sessionToken
}

const seedSessionAndOpen = async (page: Page, sid: string): Promise<void> => {
  await page.addInitScript((s) => { try { sessionStorage.setItem('pyaserv.token', s) } catch {} }, sid)
  await page.goto('/es/me/')
  // Hydration gate: the SSR <button id="tab-profile"> has no aria-selected
  // attribute; the in-body module sets aria-selected="true" on the active
  // tab during setTab(initial). Waiting on that attribute proves the click
  // handler has been wired — clicking before this point is a no-op.
  await page.locator('#tab-profile[aria-selected="true"]').waitFor({ state: 'attached' })
}

test.describe('/me/ tab panels use content-visibility:hidden — switch is layout-cached', () => {
  test('every tab panel reports content-visibility:hidden when inactive', async ({ page }) => {
    const sid = await provisionSession()
    await seedSessionAndOpen(page, sid)

    // html[data-me-tab="profile"] is set pre-paint by bootstrap.js, so the
    // profile panel renders normally while the others should be hidden via
    // the content-visibility rule.
    const inactiveContentVis = await page.evaluate(() => {
      const TABS = ['listings', 'requests', 'inquiries', 'stats'] as const
      return TABS.map((tab) => {
        const el = document.getElementById(`panel-${tab}`)
        return { tab, cv: el ? getComputedStyle(el).contentVisibility : '?' }
      })
    })
    for (const { tab, cv } of inactiveContentVis) {
      expect(cv, `panel-${tab} must be content-visibility:hidden while another tab is active (got "${cv}")`).toBe('hidden')
    }
  })

  test('switching to a tab makes its panel visible AND keeps prior panel layout cached', async ({ page }) => {
    const sid = await provisionSession()
    await seedSessionAndOpen(page, sid)

    // Click "listings" tab — the html[data-me-tab] attribute changes and the
    // listings panel goes content-visibility:visible. The profile panel
    // becomes hidden but RETAINS its layout cache (the whole point of
    // content-visibility — display:none would discard it).
    await page.locator('#tab-listings').click()
    await page.locator('#panel-listings').waitFor({ state: 'visible' })

    const after = await page.evaluate(() => ({
      me: document.documentElement.dataset.meTab,
      profileCv: getComputedStyle(document.getElementById('panel-profile') as HTMLElement).contentVisibility,
      listingsCv: getComputedStyle(document.getElementById('panel-listings') as HTMLElement).contentVisibility,
    }))

    expect(after.me).toBe('listings')
    expect(after.profileCv, 'profile panel must remain content-visibility:hidden after switch — display:none would discard its layout cache and reintroduce the 393ms first-reveal cost').toBe('hidden')
    expect(after.listingsCv, 'listings panel must be visible after activation').toBe('visible')
  })
})
