/*
 * Dashboard /me/?tab=X visual-jank budget — catches what CLS misses.
 *
 * Premise: CLS only measures layout shifts of in-viewport elements. The user
 * report ("интерфейс дёргается несколько раз при reload") doesn't reduce to
 * layout shifts — CLS is ~0.003 on every tab now, yet the page visibly
 * flickers through multiple intermediate states (tab highlight animating
 * 200ms after first paint, i18n text swap, color transitions). None of
 * those move layout — they re-paint pixels in place. Spec:
 * https://web.dev/articles/cls (CLS ignores opacity, transform, color).
 *
 * Detection: CDP Page.startScreencast emits a frame for every paint. Hash
 * each frame; transitions = distinct-hash boundaries. After the first
 * frame with REAL content (≥ FIRST_CONTENT_BYTES), no more than
 * MAX_POST_CONTENT_TRANSITIONS distinct frames are allowed. Anything more
 * is a "flicker storm" the user perceives as jank.
 *
 * NOTE: Run with CI-style serial + retries; CDP screencast frame rate
 * varies with throttling. Each test is small (~7s) so 5 tabs × 2 projects
 * = ~70s total.
 */
import { createHash } from 'crypto'
import { expect, test } from '@playwright/test'

const BYPASS_KEY = process.env.PYASERV_DEV_BYPASS_KEY ?? ''
const API = process.env.PYASERV_API_URL ?? 'https://api.pyaserv.com'

const provisionSession = async (): Promise<string> => {
  if (!BYPASS_KEY) throw new Error('PYASERV_DEV_BYPASS_KEY missing')
  const r = await fetch(`${API}/api/dev/login?email=e2e-dashboard-jank@e2e.invalid`, {
    method: 'POST', headers: { 'X-Dev-Bypass-Key': BYPASS_KEY },
  })
  if (!r.ok) throw new Error(`dev login HTTP ${r.status}`)
  const body = await r.json() as { data: { sessionToken: string } }
  return body.data.sessionToken
}

const TABS = ['profile', 'listings', 'requests', 'inquiries', 'stats'] as const
const DURATION_MS = 6000

// A blank or near-blank initial frame is ~2 KB. The first paint with real
// content (header + tabs + tab heading + at least the static panel chrome)
// is ≥ 6 KB on our pages. Below this threshold we treat the frame as part
// of the "still booting" pre-content phase, and don't count it as a
// distinct user-visible state.
const FIRST_CONTENT_BYTES = 6000

// After first content arrives we accept AT MOST this many further distinct
// visible states. Every tab kicks off `/v1/me` plus a tab-specific data
// source (cards list, stats grid, etc.), and profile also runs profile,
// passkeys and upload-token loaders in parallel — each one paints when it
// resolves, which is legitimate progressive enhancement, not flicker.
//
// The original visual-jank we hunted (tab-highlight transition firing 700ms
// after paint, i18n text swap, panel CLS) added ~5 PURELY VISUAL transitions
// on top of the data-loading floor, all within a few hundred ms of each
// other. A regression that re-introduces any of those would push the count
// to 9+ and trip the budget; legitimate data-loading transitions stay under
// 8 (occasional CI jitter pushes a clean run to 7 — leaving headroom of 1).
const MAX_POST_CONTENT_TRANSITIONS = 8

test.describe.configure({ mode: 'serial' })
test.describe('/me/ visual-jank budget — every tab', () => {
  for (const tab of TABS) {
    test(`?tab=${tab}: ≤ ${MAX_POST_CONTENT_TRANSITIONS} visible states after first-content paint`, async ({ page, context }) => {
      const sid = await provisionSession()
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

      const sha = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex').slice(0, 10)
      interface Frame { readonly t: number; readonly hash: string; readonly size: number }
      const frames: Frame[] = []
      const t0 = Date.now()

      cdp.on('Page.screencastFrame', async (params) => {
        const { sessionId, data, metadata } = params as {
          sessionId: number; data: string; metadata: { timestamp?: number }
        }
        const buf = Buffer.from(data, 'base64')
        frames.push({
          t: metadata.timestamp ? Math.round(metadata.timestamp * 1000 - t0) : Date.now() - t0,
          hash: sha(buf),
          size: buf.length,
        })
        try { await cdp.send('Page.screencastFrameAck', { sessionId }) } catch {}
      })

      await cdp.send('Page.startScreencast', {
        format: 'jpeg', quality: 60, maxWidth: 390, maxHeight: 844, everyNthFrame: 1,
      })
      await page.goto(`/me/?tab=${tab}`, { waitUntil: 'commit' }).catch(() => {})
      await page.waitForTimeout(DURATION_MS)
      await cdp.send('Page.stopScreencast').catch(() => {})
      await page.waitForTimeout(200)

      // Compute the distinct-hash sequence
      const transitions: Frame[] = []
      let prev = ''
      for (const f of frames) {
        if (f.hash !== prev) { transitions.push(f); prev = f.hash }
      }

      // Find first transition where size ≥ FIRST_CONTENT_BYTES — this is when
      // real content is on screen. Count transitions AFTER this point.
      const firstContentIdx = transitions.findIndex((f) => f.size >= FIRST_CONTENT_BYTES)
      const postContentCount = firstContentIdx >= 0 ? transitions.length - firstContentIdx - 1 : 0

      const timeline = transitions.map((f) => `t=${String(f.t).padStart(4)}ms ${f.hash} ${f.size}b`).join('\n  ')
      const msg = `tab=${tab}: ${postContentCount} visible states after first-content paint (budget ${MAX_POST_CONTENT_TRANSITIONS}).\n  ${timeline}`

      expect.soft(postContentCount, msg).toBeLessThanOrEqual(MAX_POST_CONTENT_TRANSITIONS)
      // Fail-hard so CI is red
      expect(postContentCount).toBeLessThanOrEqual(MAX_POST_CONTENT_TRANSITIONS)
    })
  }
})
