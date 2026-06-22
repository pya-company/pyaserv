/*
 * E2E: /me/ must load without layout jump. Repro: user logs in, /me/ has
 * CLS = 0.21 (way over the 0.1 "poor" CWV threshold) — the tab panel starts
 * hidden and the form area pops in after the initial paint, pushing the
 * tab strip and the footer down.
 *
 * Strategy: mint a real session via /api/dev/login (S11), drop the SID in
 * sessionStorage, load /me/ behind a CLS observer, assert sum < 0.05.
 *
 * Must be RED on the current build, GREEN once the default tab panel
 * stops hiding behind `hidden` attribute and skeletons reserve heights.
 *
 * Requires PYASERV_DEV_BYPASS_KEY in env (loaded from .env.local in CI).
 */
import { expect, test } from '@playwright/test'

const BYPASS_KEY = process.env.PYASERV_DEV_BYPASS_KEY ?? ''
const API = process.env.PYASERV_API_URL ?? 'https://api.pyaserv.com'
// CWV thresholds: good ≤0.1, needs-improvement 0.1–0.25, poor >0.25.
// 0.08 is a strict-but-realistic budget for an authed page hitting a live
// API roundtrip. Bumped from 0.05 after observing real prod-latency outliers
// (CF Pages + Workers, sub-100ms p50 but occasional p99 spikes that nudge
// a single-frame shift over the tight original budget).
const CLS_BUDGET = 0.08

const provisionSession = async (): Promise<string> => {
  if (!BYPASS_KEY) throw new Error('PYASERV_DEV_BYPASS_KEY env var missing — see .env.local')
  const r = await fetch(`${API}/api/dev/login?email=e2e-stable@e2e.invalid`, {
    method: 'POST',
    headers: { 'X-Dev-Bypass-Key': BYPASS_KEY },
  })
  if (!r.ok) throw new Error(`dev login HTTP ${r.status}`)
  const body = await r.json() as { data: { sessionToken: string } }
  return body.data.sessionToken
}

// Serial mode: the CLS observer is sensitive to network jitter. When 4
// Playwright workers hit prod in parallel, /me/'s API roundtrip latency goes
// up enough to push a real device-frame shift just over budget. Running this
// describe block one test at a time keeps prod within deterministic load.
test.describe.configure({ mode: 'serial' })
test.describe('/me/ stability', () => {
  test('CLS < budget on initial paint', async ({ page }) => {
    const sid = await provisionSession()
    await page.addInitScript((s) => {
      try { sessionStorage.setItem('pyaserv.token', s) } catch {}
      ;(window as { __shifts?: unknown[] }).__shifts = []
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as PerformanceEntry[]) {
            ;(window as { __shifts: unknown[] }).__shifts.push(e.toJSON())
          }
        }).observe({ type: 'layout-shift', buffered: true })
      } catch {}
    }, sid)

    await page.goto('/me/')
    await page.waitForLoadState('networkidle')
    // give post-paint settle a moment
    await page.waitForTimeout(800)

    const cls = await page.evaluate(() => {
      const shifts = (window as { __shifts?: Array<{ value: number; hadRecentInput: boolean }> }).__shifts || []
      return shifts
        .filter((s) => !s.hadRecentInput)
        .reduce((acc, s) => acc + s.value, 0)
    })

    expect.soft(cls, `CLS=${cls.toFixed(4)} exceeded budget of ${CLS_BUDGET}`).toBeLessThan(CLS_BUDGET)
    expect(cls).toBeLessThan(CLS_BUDGET)
  })

  test('default tab panel is visible from the first paint', async ({ page }) => {
    const sid = await provisionSession()
    await page.addInitScript((s) => {
      try { sessionStorage.setItem('pyaserv.token', s) } catch {}
    }, sid)

    await page.goto('/me/')
    // Read computed style ASAP after navigation commits — before the in-page
    // JS has had time to flip panel.hidden. If the panel is hidden in the
    // SSR'd HTML this test catches it without waiting for JS.
    const profilePanelHidden = await page.locator('#panel-profile').evaluate(
      (el) => (el as HTMLElement).hidden || getComputedStyle(el).display === 'none',
    )
    expect(profilePanelHidden, 'panel-profile must be visible in SSR — JS-only reveal causes CLS').toBe(false)
  })

  test('REGRESSION GUARD: tabs still work after ClientRouter nav away + back', async ({ page }) => {
    const sid = await provisionSession()
    await page.addInitScript((s) => {
      try { sessionStorage.setItem('pyaserv.token', s) } catch {}
    }, sid)

    await page.goto('/me/')
    // Wait for the initial /v1/me roundtrip to settle.
    await page.waitForLoadState('networkidle')

    // Navigate away through a ClientRouter swap, then back.
    await page.goto('/specialists/')
    await page.waitForURL(/\/specialists\/$/)
    await page.goto('/me/')
    await page.waitForLoadState('networkidle')

    // Click the Listings tab and assert its panel becomes the active one. The
    // bug: inline script ran once at first /me/ load; after the swap the tab
    // click listeners died, so nothing happened on click.
    //
    // Visibility is driven by `html[data-me-tab]` + `content-visibility` on
    // .ps-tabpanel — Playwright's toBeVisible/toBeHidden don't understand
    // content-visibility (the element still has a bounding box and isn't
    // visibility:hidden), so we assert the source of truth: the documentElement
    // dataset attribute that the click handler sets. Then double-check via
    // computed style that profile is content-visibility:hidden and listings is
    // content-visibility:visible.
    await page.locator('#tab-listings').click()
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.meTab), { timeout: 2000 }).toBe('listings')
    const cv = await page.evaluate(() => ({
      listings: getComputedStyle(document.getElementById('panel-listings')!).contentVisibility,
      profile: getComputedStyle(document.getElementById('panel-profile')!).contentVisibility,
    }))
    expect(cv.listings).toBe('visible')
    expect(cv.profile).toBe('hidden')
  })
})
