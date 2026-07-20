/* Capture screenshots for /docs/<slug>/ pages.
 *
 * Runs Playwright (chromium) against prod (https://pyaserv.com), signs in via
 * the dev-bypass route at https://api.pyaserv.com/api/dev/login, stores the
 * session token in sessionStorage (matches the app's auth bootstrap), and
 * captures one PNG per docs slug into apps/site/public/screenshots/.
 *
 * Required env:
 *   DEV_AUTH_BYPASS_KEY  — secret matching api worker's DEV_AUTH_BYPASS_KEY
 *
 * Optional env:
 *   PYASERV_SITE_URL   default https://pyaserv.com
 *   PYASERV_API_URL    default https://api.pyaserv.com
 *   PYASERV_SCREENSHOT_EMAIL  default screenshots@e2e.invalid
 *
 * Run:
 *   bun apps/site/scripts/capture-doc-screenshots.ts
 *
 * The screenshots target the visible region of each feature; viewport is
 * tuned for desktop (1280×800) and `clip` is used to capture an above-fold
 * 16:10 frame so docs cards have consistent aspect ratios.
 */
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from '@playwright/test'

const __scriptDir = path.dirname(fileURLToPath(import.meta.url))

const SITE = process.env.PYASERV_SITE_URL ?? 'https://pyaserv.com'
const API = process.env.PYASERV_API_URL ?? 'https://api.pyaserv.com'
// Log in as a populated user whose `id` is a real UUID v7 (seed-u-001 etc.
// fail SessionRecord.userId schema validation → session reads as undefined,
// /v1/me throws 401, bootstrap redirects to /?login=1). qa.fresh / María
// González (019ecc37-...) is the canonical demo user behind the public profile
// referenced by the `perfil` doc — same identity, full badges/quotes UI.
const EMAIL = process.env.PYASERV_SCREENSHOT_EMAIL ?? 'qa.fresh@pyaserv.com'
const BYPASS = process.env.DEV_AUTH_BYPASS_KEY ?? ''

const OUT_DIR = path.resolve(__scriptDir, '../public/screenshots')

interface Shot {
  readonly slug: string
  readonly url: string
  readonly settleSelector?: string
  /** Extra wait after settleSelector resolves. /me/ tabs render their data
   *  panels asynchronously after the JS bootstrap; the tab UI is up but the
   *  cards/grids take ~1-2s more on a cold cf-worker. */
  readonly settleMs?: number
  /** CSS selector to scroll into view before the screenshot. The /me/ tabs
   *  put the tab strip ~600px below the page header — without scrolling, the
   *  active panel itself is below the fold of a 1280×800 capture. */
  readonly scrollTo?: string
}

// Order mirrors docs-content.ts entries that have `screenshot:` set.
// /specialists/<id>/ is statically prerendered (no API wait needed) and shows
// the full visible-to-everyone profile (badges, services, work zones, jobs).
// /me/?tab=* tabs run in the authenticated context; the dev-bypass login
// upstream gives us a real populated session.
const SHOTS: ReadonlyArray<Shot> = [
  { slug: 'perfil',        url: `${SITE}/specialists/019ecf43-f9cf-760e-adb5-62f37461380c/`, settleSelector: 'main',         settleMs: 2000 },
  { slug: 'insignias',     url: `${SITE}/me/?tab=game`,                                       settleSelector: '#panel-game', settleMs: 3000, scrollTo: '#panel-game' },
  { slug: 'xp',            url: `${SITE}/me/?tab=game`,                                       settleSelector: '#panel-game', settleMs: 3000, scrollTo: '#panel-game' },
  { slug: 'cotizador',     url: `${SITE}/me/quotes/new/`,                                     settleSelector: 'main',         settleMs: 2500 },
  { slug: 'analitica',     url: `${SITE}/me/?tab=stats`,                                      settleSelector: '#panel-stats', settleMs: 3000, scrollTo: '#panel-stats' },
  { slug: 'mis-clientes',  url: `${SITE}/me/?tab=clients`,                                    settleSelector: '#panel-clients', settleMs: 3000, scrollTo: '#panel-clients' },
  { slug: 'filtros-leads', url: `${SITE}/me/?tab=profile`,                                    settleSelector: '#panel-profile', settleMs: 3000, scrollTo: '#panel-profile' },
  { slug: 'multilingue',   url: `${SITE}/me/?tab=profile`,                                    settleSelector: '#panel-profile', settleMs: 3000, scrollTo: '#panel-profile' },
]

const provisionSession = async (): Promise<string> => {
  if (BYPASS === '') throw new Error('DEV_AUTH_BYPASS_KEY env var missing')
  const r = await fetch(`${API}/api/dev/login?email=${encodeURIComponent(EMAIL)}`, {
    method: 'POST',
    headers: { 'X-Dev-Bypass-Key': BYPASS },
  })
  if (!r.ok) throw new Error(`dev login HTTP ${r.status}: ${await r.text()}`)
  const body = await r.json() as { data: { sessionToken: string } }
  return body.data.sessionToken
}

const waitDomSettle = async (page: Page, shot: Shot): Promise<void> => {
  await page.locator('html[data-i18n-ready="1"]').waitFor({ state: 'attached', timeout: 15000 })
  if (shot.settleSelector !== undefined) {
    await page.locator(shot.settleSelector).waitFor({ state: 'attached', timeout: 15000 })
  }
  // Give per-tab/per-page async data loaders time to settle. Screenshot is
  // for visual docs, not a flaky test — a small fixed pause beats a brittle
  // per-tab data-ready selector. Override per-shot via settleMs.
  await page.waitForTimeout(shot.settleMs ?? 800)
}

const main = async (): Promise<void> => {
  const sid = await provisionSession()
  await fs.mkdir(OUT_DIR, { recursive: true })
  // Use the full chromium build, not the headless_shell — on Windows the
  // shell's remote-debugging-pipe handshake can stall (>180s) without
  // surfacing a useful error. Full chromium with --headless=new launches
  // reliably in our local + CI environments.
  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
    timeout: 60000,
  })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  })
  await context.addInitScript((s: string) => {
    try { sessionStorage.setItem('pyaserv.token', s) } catch {}
  }, sid)

  const page = await context.newPage()
  for (const shot of SHOTS) {
    process.stdout.write(`  capturing ${shot.slug.padEnd(16)} ← ${shot.url}\n`)
    await page.goto(shot.url, { waitUntil: 'commit' }).catch(() => {})
    try {
      await waitDomSettle(page, shot)
    } catch (err) {
      process.stdout.write(`    !! settle failed (${(err as Error).message}) — proceeding with partial paint\n`)
    }
    if (shot.scrollTo !== undefined) {
      try {
        // The dashboard header is ~520px tall; scroll the target panel to the
        // top of the viewport so the screenshot clip captures content, not
        // the page chrome above it.
        await page.evaluate((sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null
          if (el) {
            const top = el.getBoundingClientRect().top + window.scrollY
            window.scrollTo({ top: Math.max(0, top - 20), left: 0, behavior: 'auto' })
          }
        }, shot.scrollTo)
      } catch { /* no-op */ }
      await page.waitForTimeout(400)
    }
    const out = path.join(OUT_DIR, `${shot.slug}.png`)
    await page.screenshot({
      path: out,
      // Above-fold 16:10 frame matches the .docpage__screenshot aspect-ratio.
      clip: { x: 0, y: 0, width: 1280, height: 800 },
      type: 'png',
    })
    process.stdout.write(`    ✓ ${out}\n`)
  }
  await browser.close()
  process.stdout.write(`\nWrote ${SHOTS.length} screenshots to ${OUT_DIR}\n`)
}

main().catch((err: unknown) => {
  process.stderr.write(`\nfailed: ${(err as Error).stack ?? String(err)}\n`)
  process.exit(1)
})
