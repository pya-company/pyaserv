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
const CLS_BUDGET = 0.05

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
})
