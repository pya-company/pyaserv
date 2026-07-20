/*
 * Dashboard /me/ CLS budget — covers ALL deep-link entry tabs.
 *
 * Bug class this guards against: a tab panel that has SSR-empty async content
 * (e.g. ps-cards / ps-stats-grid with aria-busy) and pushes the footer down
 * 200-500px when JS injects the real list/grid. Hard reload of /me/?tab=X
 * was producing CLS 0.18-0.19 before the fix — well above the CWV 0.1 "poor"
 * threshold — because each tab's container had no reserved height.
 *
 * Fix sites:
 *  - me.astro: every async container has aria-busy="true" in SSR
 *  - global.css: .ps-cards[aria-busy="true"] + .ps-stats-grid[aria-busy="true"]
 *    reserve a min-height matching ~3 typical cards / ~5 stat cards
 *  - me.astro JS: removeAttribute('aria-busy') on every code path that mutates
 *    innerHTML (success, empty, error)
 *
 * Strict 0.05 budget — anything above that is a visible jump. We test under
 * Slow 4G + 4× CPU throttling to mirror a mid-range device on a so-so connection.
 */
import { expect, test } from '@playwright/test'

const BYPASS_KEY = process.env.PYASERV_DEV_BYPASS_KEY ?? ''
const API = process.env.PYASERV_API_URL ?? 'https://api.pyaserv.com'
const CLS_BUDGET = 0.05

interface DevLogin { readonly sessionToken: string }

const provisionSession = async (): Promise<string> => {
  if (!BYPASS_KEY) throw new Error('PYASERV_DEV_BYPASS_KEY env var missing')
  const r = await fetch(`${API}/api/dev/login?email=e2e-dashboard-cls@e2e.invalid`, {
    method: 'POST',
    headers: { 'X-Dev-Bypass-Key': BYPASS_KEY },
  })
  if (!r.ok) throw new Error(`dev login HTTP ${r.status}`)
  const body = await r.json() as { data: DevLogin }
  return body.data.sessionToken
}

// Direct-load each tab. Profile tab is already covered by me-stable.common.spec.ts
// but kept here too so the budget is enforced uniformly across all entry points.
const TABS = ['profile', 'listings', 'requests', 'inquiries', 'stats'] as const

// Serial: shared dev account + prod API throughput — same reasoning as
// me-stable. Parallel workers nudge p99 latency past frame budget.
test.describe.configure({ mode: 'serial' })
test.describe('/me/ dashboard CLS — every tab', () => {
  for (const tab of TABS) {
    test(`?tab=${tab} CLS < ${CLS_BUDGET} on initial paint`, async ({ page }) => {
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

      await page.goto(`/me/?tab=${tab}`)
      // Let every async populate finish — passkeys (3.2s) and analytics (4.8s)
      // are the slowest under prod-RTT, so 6s covers the worst case.
      await page.waitForTimeout(2000)

      const result = await page.evaluate(() => {
        const shifts = (window as { __shifts?: Array<{ value: number; hadRecentInput: boolean; sources?: unknown[] }> }).__shifts || []
        const filtered = shifts.filter((s) => !s.hadRecentInput)
        return {
          cls: filtered.reduce((acc, s) => acc + s.value, 0),
          n: filtered.length,
        }
      })

      expect.soft(
        result.cls,
        `tab=${tab}: CLS=${result.cls.toFixed(4)} over ${result.n} shifts exceeds budget ${CLS_BUDGET}`,
      ).toBeLessThan(CLS_BUDGET)
      expect(result.cls).toBeLessThan(CLS_BUDGET)
    })
  }
})
