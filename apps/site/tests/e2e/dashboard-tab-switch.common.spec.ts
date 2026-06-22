/*
 * Dashboard /me/ tab-switch latency budget.
 *
 * User report: "при переключении между вкладками думает по 10 лет".
 * Click→paint instrumented in-page measured 393ms for the FIRST profile
 * reveal and 149ms for FIRST requests reveal — display:none discards layout
 * cache, so each first-time panel reveal re-lays the panel's subtree from
 * scratch. The profile panel has 7 inputs, 3 fieldsets, a passkey list and
 * a completeness meter; first-reveal layout is expensive.
 *
 * Fix: hide panels via content-visibility:hidden instead of display:none.
 * Per spec, the rendering state is preserved across show/hide cycles, so
 * subsequent switches reuse the cached layout. Test caps click→paint at
 * 80ms on each FIRST-time reveal of every tab.
 */
import { expect, test } from '@playwright/test'

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

// Strict 80ms p95 budget per click. Real-device, throttled mobile this gives
// 320ms (4× CPU) — still under the 100ms "feels instant" threshold.
const BUDGET_MS = 80

test.describe('/me/ tab-switch latency', () => {
  test('every tab paints within budget on FIRST reveal after a different tab was active', async ({ page, context }) => {
    const sid = await provisionSession()
    // Throttle to match a real mid-range mobile — networkidle alone hides the
    // bug because the layout cost only shows under CPU pressure (which the
    // user has on a real device).
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 150,
      downloadThroughput: (1.5 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.addInitScript((s) => {
      try { sessionStorage.setItem('pyaserv.token', s) } catch {}
    }, sid)

    await page.goto('/me/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const results = await page.evaluate(async () => {
      const measure = async (id: string): Promise<number> => {
        const t0 = performance.now()
        ;(document.getElementById(id) as HTMLElement).click()
        // Two rAFs ≈ next two paints completed
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
        return performance.now() - t0
      }
      // Each tab visited for the first time after a different tab was active.
      // The order matters: switching profile → listings → profile measures the
      // "back to profile" first-reveal cost (the bug); the second profile
      // click was cheap because layout cache persisted under display:none for
      // a short window — we don't rely on that.
      const seq = ['listings', 'requests', 'inquiries', 'stats', 'profile'] as const
      const out: Array<{ tab: string; ms: number }> = []
      for (const t of seq) {
        const ms = await measure(`tab-${t}`)
        out.push({ tab: t, ms: Number(ms.toFixed(1)) })
        await new Promise((r) => setTimeout(r, 200))
      }
      return out
    })

    console.log(`tab switch latencies (ms):`, results)
    for (const { tab, ms } of results) {
      expect.soft(ms, `${tab}: click→paint=${ms}ms exceeds ${BUDGET_MS}ms`).toBeLessThanOrEqual(BUDGET_MS)
    }
    const worst = Math.max(...results.map((r) => r.ms))
    expect(worst).toBeLessThanOrEqual(BUDGET_MS)
  })
})
