# Lighthouse 100/100 plan — PyaServ

Goal: **100 на всех 4 категориях Lighthouse (Performance, Accessibility, Best Practices, SEO) для каждой публичной страницы**, удержание через CI gate.

## Routes (14)

### Public (no auth needed for measurement)
1. `/` — landing
2. `/specialists/` — spec list with filters
3. `/specialists/detail/?id=…` — spec profile + reviews + listings
4. `/clients/` — request list
5. `/clients/detail/?id=…` — request detail
6. `/login/` — OTP entry

### Cabinet (требует seeded session, не входит в публичный CI gate — измеряем вручную)
7. `/me/?tab=profile`
8. `/me/?tab=listings`
9. `/me/?tab=requests`
10. `/me/?tab=inquiries`
11. `/me/?tab=stats`
12. `/me/listings/new/`
13. `/me/listings/edit/?id=…`
14. `/me/inquiries/detail/?id=…`

## Score matrix (template)

| Route | Perf | A11y | Best-P | SEO | Total |
|---|---|---|---|---|---|
| / | — | — | — | — | — |
| /specialists/ | — | — | — | — | — |
| /specialists/detail/ | — | — | — | — | — |
| /clients/ | — | — | — | — | — |
| /clients/detail/ | — | — | — | — | — |
| /login/ | — | — | — | — | — |

(filled by baseline pass, then by re-test after fixes)

## Tooling

- **Audit:** `chrome-launcher` + `lighthouse` npm package, headless Chrome
  - Why not `lighthouse-ci`? Adds CF/Vercel-shaped GH Action overhead — we want
    a plain `bun test:perf` that works in any CI.
  - Throttling: `mobile`-emulated by default (mirrors real Paraguay traffic on 3G/4G).
- **Trace details:** chrome-devtools MCP `performance_start_trace` + `performance_analyze_insight` for in-session investigation.
- **CI gate:** `bun test:perf` runs lighthouse on each public route, asserts `score ≥ 0.95` on all 4 cats. Fails the build on regression. Threshold deliberately ≤100 so transient network jitter doesn't make CI flaky; weekly nightly job asserts ==1.0 and opens a "perf-drift" issue if any route slips.

## Score-100 checklist per category

### Performance
- LCP <2.5s on mobile slow 4G
- CLS <0.1
- TBT <200ms
- FCP <1.8s
- SI <3.4s
- INP <200ms (need real user data; CrUX or lab approximation)
- No render-blocking CSS >500B
- No unused JS >20KB
- No unused CSS >20KB
- Image dimensions explicit
- Fonts: `font-display: swap` (we use system fonts → free win)

### A11y
- Already 27 items audited; top 10 fixed in `09455f7`.
- Remaining: tabs role=tab+tabpanel (#11), composer overlay z-index (#9), avatar initials fallback (#14), card avatar+chip (#17).

### Best Practices
- HTTPS — done
- No console errors at load
- No deprecated APIs (no `document.write`, no XHR, no event.path, etc.)
- CSP via response header (Cloudflare Pages `_headers` file)
- Image aspect-ratio set
- HTTP/2 — CF gives us h3 too

### SEO
- `<meta name="description">` on every page — already via `descKey` on most pages
- `<html lang>` correctly set before paint — already via FOUC-safe init script
- Canonical link — needs adding
- `robots` policy — needs adding
- Structured data: `Person` schema on `/specialists/detail/`, `Service` on `/specialists/detail/` listings, `Offer` on `/clients/detail/` requests — needs JSON-LD
- Mobile viewport — already
- Tap targets ≥48px — verified via 2.5.5 / 2.5.8 in a11y audit

## Test plan

```ts
// apps/site/tests/perf/lighthouse.spec.ts
import { test, expect } from 'bun:test'
import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'

const ROUTES = [
  '/',
  '/specialists/',
  '/clients/',
  '/login/',
]
const BASE = process.env.PYASERV_BASE_URL ?? 'https://pyaserv.com'
const THRESHOLD = 0.95

for (const path of ROUTES) {
  test(`lighthouse ≥${THRESHOLD * 100} on ${path}`, async () => {
    const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] })
    try {
      const res = await lighthouse(`${BASE}${path}`, {
        port: chrome.port,
        output: 'json',
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 360, height: 780, deviceScaleFactor: 2 },
      })
      const cats = res!.lhr.categories
      expect(cats.performance.score).toBeGreaterThanOrEqual(THRESHOLD)
      expect(cats.accessibility.score).toBeGreaterThanOrEqual(THRESHOLD)
      expect(cats['best-practices'].score).toBeGreaterThanOrEqual(THRESHOLD)
      expect(cats.seo.score).toBeGreaterThanOrEqual(THRESHOLD)
    } finally {
      await chrome.kill()
    }
  })
}
```

Wired via `apps/site/package.json` script `"test:perf": "bun test tests/perf/"` and triggered by GH Actions `perf.yml` on push to main + nightly cron.

## Execution order

1. Plan doc (this) ✅
2. Baseline pass — collect current scores per route, fill matrix
3. CI test scaffold + first run against live → captures baseline + locks min-bar
4. Iterate per category (SEO → Best-P → A11y remainder → Perf), commit per fix
5. Final re-test pass, update matrix, commit
6. Memo to user with deltas

## Out of scope

- Cabinet routes — need authenticated session, will hand-measure in dev env separately
- Mobile-only INP — needs real user data, CrUX is empty for pyaserv.com yet
- Service worker / PWA — separate task (#18 backlog)
