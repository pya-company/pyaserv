// @ts-nocheck
// Lighthouse CI gate — fails if any public route slips below the per-category
// threshold. Run via `bun run --filter @pyaserv/site test:perf` locally, or
// via the GH Action `perf.yml` on every push to main + nightly cron.
//
// Strategy: spawn headless Chromium via chrome-launcher, run lighthouse against
// the live URL with mobile emulation (matches the user demographic — Paraguay
// is mobile-dominant on 3G/4G). Assert score >= threshold per category. Print
// a markdown table at the end for the PR comment / nightly digest.

import lighthouse from 'lighthouse'
import { launch } from 'chrome-launcher'

interface RouteSpec {
  readonly path: string
  readonly thresholds: Readonly<Record<string, number>>
  readonly skip?: ReadonlyArray<string>
}

// Spec/detail pages need a real id; the script picks one from the live API
// at startup so the test does not break when seed data rotates.
const BASE = process.env.PYASERV_BASE_URL ?? 'https://pyaserv.com'
const API = process.env.PYASERV_API_URL ?? 'https://api.pyaserv.com'

// All categories must be high. Performance gets a slim 0.05 buffer because
// synthetic 4G + cold start to Cloudflare can jitter — a11y/BP/SEO are
// deterministic and must be a flat 100.
const DEFAULT_T = { performance: 0.95, accessibility: 1.0, 'best-practices': 1.0, seo: 1.0 }

interface ApiList<T> {
  readonly data: ReadonlyArray<T>
}

const fetchJson = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
  return (await r.json()) as T
}

const pickAnyId = async (collection: 'specialists' | 'requests'): Promise<string | null> => {
  const j = await fetchJson<ApiList<{ id: string }>>(`${API}/v1/${collection}`)
  return j.data[0]?.id ?? null
}

const main = async (): Promise<void> => {
  const specId = await pickAnyId('specialists')
  const reqId = await pickAnyId('requests')

  const routes: RouteSpec[] = [
    { path: '/', thresholds: DEFAULT_T },
    { path: '/specialists/', thresholds: DEFAULT_T },
    { path: '/clients/', thresholds: DEFAULT_T },
    { path: '/login/', thresholds: DEFAULT_T },
    ...(specId
      ? [{ path: `/specialists/detail/?id=${specId}`, thresholds: { ...DEFAULT_T, performance: 0.85 } }]
      : []),
    ...(reqId
      ? [{ path: `/clients/detail/?id=${reqId}`, thresholds: DEFAULT_T }]
      : []),
  ]

  const chrome = await launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  })
  const failures: string[] = []
  const rows: string[] = []
  try {
    for (const route of routes) {
      const url = `${BASE}${route.path}`
      console.log(`[lh] auditing ${url}`)
      const res = await lighthouse(url, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 360, height: 780, deviceScaleFactor: 2, disabled: false },
        throttlingMethod: 'simulate',
      })
      if (!res) throw new Error(`lighthouse returned empty for ${url}`)
      const cats = res.lhr.categories
      const row: string[] = [route.path]
      for (const cat of ['performance', 'accessibility', 'best-practices', 'seo']) {
        const score = cats[cat]?.score ?? 0
        const threshold = route.thresholds[cat] ?? 0
        row.push(Math.round(score * 100).toString())
        if (score < threshold) {
          failures.push(`${route.path} | ${cat}: ${score} < ${threshold}`)
        }
      }
      rows.push(`| ${row.join(' | ')} |`)
    }

    console.log('\n## Lighthouse results\n')
    console.log('| Route | Perf | A11y | Best-P | SEO |')
    console.log('|---|---|---|---|---|')
    for (const r of rows) console.log(r)

    if (failures.length > 0) {
      console.error('\n❌ Threshold breaches:')
      for (const f of failures) console.error('  -', f)
      // Kill before exit so the temp-dir cleanup window race on Windows doesn't
      // shadow the failures.
      try { chrome.kill() } catch {}
      process.exit(1)
    }
    console.log('\n✅ All thresholds met.')
  } finally {
    // Windows holds the chrome temp dir briefly; swallow EBUSY — the harness
    // process is exiting anyway.
    try { chrome.kill() } catch {}
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
