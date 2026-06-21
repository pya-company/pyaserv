/*
 * Diagnostic filmstrip via CDP Page.startScreencast — non-blocking frame
 * capture at video framerate. Outputs the per-frame hash timeline so we can
 * count distinct visual states the page passes through on reload.
 *
 * Used to characterize the "интерфейс дёргается несколько раз" report that
 * CLS doesn't catch (CLS = 0.003 but user sees rapid swaps).
 *
 * Run:
 *   PYASERV_DEV_BYPASS_KEY=... bun x playwright test tests/e2e/jank-filmstrip.common.spec.ts --project=mobile-chrome
 */
import { createHash } from 'crypto'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { expect, test } from '@playwright/test'

const BYPASS_KEY = process.env.PYASERV_DEV_BYPASS_KEY ?? ''
const API = process.env.PYASERV_API_URL ?? 'https://api.pyaserv.com'

const provisionSession = async (): Promise<string> => {
  const r = await fetch(`${API}/api/dev/login?email=e2e-jank-film@e2e.invalid`, {
    method: 'POST', headers: { 'X-Dev-Bypass-Key': BYPASS_KEY },
  })
  const body = await r.json() as { data: { sessionToken: string } }
  return body.data.sessionToken
}

const TABS = ['profile', 'listings', 'requests', 'inquiries', 'stats'] as const
const DURATION_MS = 6000
const SIGNIFICANT_DIFF_BYTES = 1500

test.describe.configure({ mode: 'serial' })
test.describe('JANK FILMSTRIP', () => {
  for (const tab of TABS) {
    test(`tab=${tab}`, async ({ page, context }) => {
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

      const sha = (buf: Buffer): string =>
        createHash('sha256').update(buf).digest('hex').slice(0, 10)

      interface CapturedFrame { readonly t: number; readonly hash: string; readonly size: number; readonly buf: Buffer }
      const frames: CapturedFrame[] = []
      const t0 = Date.now()
      const outDir = join('test-results', 'jank-filmstrip', tab)
      mkdirSync(outDir, { recursive: true })

      cdp.on('Page.screencastFrame', async (params) => {
        const { sessionId, data, metadata } = params as {
          sessionId: number; data: string; metadata: { timestamp?: number }
        }
        const buf = Buffer.from(data, 'base64')
        frames.push({
          t: metadata.timestamp ? Math.round(metadata.timestamp * 1000 - t0) : Date.now() - t0,
          hash: sha(buf),
          size: buf.length,
          buf,
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

      const transitions: CapturedFrame[] = []
      let prev = ''
      for (const f of frames) {
        if (f.hash !== prev) { transitions.push(f); prev = f.hash }
      }
      // Save each distinct frame as a numbered jpg + the index so we can eyeball
      for (let i = 0; i < transitions.length; i++) {
        const tr = transitions[i]
        writeFileSync(join(outDir, `${String(i).padStart(3, '0')}_t${String(tr.t).padStart(5, '0')}_${tr.hash}.jpg`), tr.buf)
      }

      let sizeJumps = 0
      let lastSize = 0
      for (const f of frames) {
        if (lastSize && Math.abs(f.size - lastSize) > SIGNIFICANT_DIFF_BYTES) sizeJumps++
        lastSize = f.size
      }

      const tailHash = frames.at(-1)?.hash
      let tail = 0
      for (let i = frames.length - 1; i >= 0; i--) {
        if (frames[i].hash === tailHash) tail++; else break
      }

      console.log(`\n=== tab=${tab} ===`)
      console.log(`frames=${frames.length}  distinct=${new Set(frames.map(f => f.hash)).size}  size_jumps=${sizeJumps}  settled_tail=${tail}`)
      console.log(`transitions (${transitions.length}):`)
      for (const tr of transitions) console.log(`  t=${String(tr.t).padStart(4)}ms  ${tr.hash}  ${tr.size}b`)

      expect(frames.length).toBeGreaterThan(2)
    })
  }
})
