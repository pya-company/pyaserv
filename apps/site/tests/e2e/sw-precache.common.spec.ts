/*
 * Service worker precache — must be small, non-atomic, and revision-stable.
 *
 * Bug: sw-precache-470-urls-atomic (2026-06-27)
 *   sw.js precaches ~470 URLs on install via a single atomic cache.addAll
 *   call. On PY 3G this races the user's actual browsing, eats their data
 *   plan, and a single 404/network blip rejects the whole install. The
 *   cache key is `pyaserv-v${r}` — bumped per build — so every deploy
 *   re-downloads everything.
 *
 * What this test asserts (any one failing proves the bug):
 *   1. The precache list contains at most ~30 URLs (app shell + a couple of
 *      critical landing pages). 470 is wildly over budget.
 *   2. The install handler does NOT call `cache.addAll(...)` on a 100+
 *      entry list — it should use `cache.add` per URL or
 *      `Promise.allSettled` so a single failure does not nuke install.
 *
 * Source of evidence is sw.js itself, fetched over HTTP. We do not need to
 * boot a browser context because the bug is in the served artifact.
 */
import { expect, test } from '@playwright/test'

const SW_PATH = '/sw.js'

const MAX_PRECACHE_ENTRIES = 30

const fetchSw = async (
  request: import('@playwright/test').APIRequestContext,
): Promise<string> => {
  const res = await request.get(SW_PATH)
  expect(res.status(), 'sw.js must return 200').toBe(200)
  return await res.text()
}

// The precache array is the only big string-literal list of "/..." paths in
// the bundled SW. Counting quoted absolute paths is a robust proxy for its
// length even after minification.
const countPrecachePaths = (src: string): number => {
  const matches = src.match(/"\/[^"]*"/g)
  return matches ? matches.length : 0
}

test.describe('service worker precache budget', () => {
  test(`precache contains at most ${MAX_PRECACHE_ENTRIES} URLs (app shell only)`, async ({
    request,
  }) => {
    const src = await fetchSw(request)
    const count = countPrecachePaths(src)
    expect(
      count,
      `sw.js precaches ${count} URLs — should be app shell only (<= ${MAX_PRECACHE_ENTRIES}).` +
        ' Per-page HTML must be lazy-cached on first navigation, not bulk-downloaded on install.',
    ).toBeLessThanOrEqual(MAX_PRECACHE_ENTRIES)
  })

  test('install handler does not use atomic cache.addAll on a large list', async ({
    request,
  }) => {
    const src = await fetchSw(request)
    const usesAddAll = /\.addAll\s*\(/.test(src)
    const usesAllSettled = /Promise\.allSettled\s*\(/.test(src)
    const count = countPrecachePaths(src)

    // Atomic addAll is acceptable for a tiny app-shell list, but with 100+
    // entries any single 404 / network blip on PY 3G rejects the whole
    // install. Either drop the list size or switch to allSettled / per-URL
    // cache.add().
    const atomicOnLargeList = usesAddAll && !usesAllSettled && count > 50
    expect(
      atomicOnLargeList,
      `sw.js uses cache.addAll on ${count} URLs without Promise.allSettled — one failing fetch kills the entire install.`,
    ).toBe(false)
  })
})
