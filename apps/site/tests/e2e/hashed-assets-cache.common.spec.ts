/*
 * E2E: Hashed assets under /_astro/ must be served as immutable for 1y.
 *
 * Bug hashed-assets-4h-cache-not-immutable:
 *   Cloudflare Pages serves every /_astro/*.css and /_astro/*.js (content-
 *   hashed filenames such as clients.DqgFmAc-.css) with
 *     Cache-Control: public, max-age=14400, must-revalidate
 *   instead of the canonical hashed-asset policy
 *     Cache-Control: public, max-age=31536000, immutable
 *
 *   Consequence: every 4h the browser performs a conditional GET (304) for a
 *   file whose URL changes when its content changes. On PY 3G this adds
 *   ~200 ms RTT per file per revalidation cycle, defeating content-hashing
 *   and the LCP <2.0 s budget in the spec.
 *
 *   Layered on top: the static-prerendered HTML for /, /docs/ comes back as
 *     Cache-Control: max-age=0, must-revalidate
 *     Cf-Cache-Status: DYNAMIC
 *   meaning the edge will not even serve the document from cache. The spec
 *   wants short-TTL HTML (max-age=300, s-maxage=3600, swr=86400) so CF can
 *   respond from POP without hitting origin.
 *
 * This test MUST be RED until the Pages project sets the correct headers
 * (e.g. via apps/site/public/_headers) for /_astro/* and the static pages.
 */
import { expect, test } from '@playwright/test'

type ApiRequest = import('@playwright/test').APIRequestContext

const HASHED_ASSET_PATHS: ReadonlyArray<string> = [
  '/_astro/clients.DqgFmAc-.css',
  '/_astro/Base.astro_astro_type_script_index_1_lang.D4VjF1n8.js',
]

const STATIC_HTML_PATHS: ReadonlyArray<string> = ['/', '/docs/']

const headHeaders = async (
  request: ApiRequest,
  path: string,
): Promise<Readonly<Record<string, string>>> => {
  const res = await request.fetch(path, { method: 'HEAD', maxRedirects: 0 })
  expect(res.status(), `${path} must respond 200`).toBe(200)
  return res.headers()
}

const parseCacheControl = (raw: string): ReadonlySet<string> =>
  new Set(raw.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean))

test.describe('hashed _astro/* assets are immutable for 1 year', () => {
  for (const path of HASHED_ASSET_PATHS) {
    test(`${path} → Cache-Control: public, max-age=31536000, immutable`, async ({ request }) => {
      const headers = await headHeaders(request, path)
      const raw = headers['cache-control'] ?? ''
      const directives = parseCacheControl(raw)

      expect(
        directives.has('immutable'),
        `expected "immutable" in Cache-Control, got "${raw}"`,
      ).toBe(true)

      expect(
        directives.has('public'),
        `expected "public" in Cache-Control, got "${raw}"`,
      ).toBe(true)

      // Hashed-asset budget: at least 1 year. 14400 (4h) is the bug value.
      const maxAge = [...directives]
        .map((d) => /^max-age=(\d+)$/.exec(d))
        .find((m): m is RegExpExecArray => m !== null)?.[1]
      const maxAgeSeconds = maxAge ? Number(maxAge) : 0

      expect(
        maxAgeSeconds,
        `expected max-age >= 31536000 (1y), got ${maxAgeSeconds} from "${raw}"`,
      ).toBeGreaterThanOrEqual(31_536_000)

      // must-revalidate defeats the point of immutable hashed assets.
      expect(
        directives.has('must-revalidate'),
        `must-revalidate must NOT appear on hashed assets, got "${raw}"`,
      ).toBe(false)
    })
  }
})

test.describe('static prerendered HTML is edge-cacheable', () => {
  for (const path of STATIC_HTML_PATHS) {
    test(`${path} → s-maxage set so CDN can serve from cache`, async ({ request }) => {
      const headers = await headHeaders(request, path)
      const raw = headers['cache-control'] ?? ''
      const directives = parseCacheControl(raw)

      // Spec wants HTML to be cacheable at the edge: s-maxage and/or a
      // non-zero shared TTL. Today's value is "max-age=0, must-revalidate"
      // which makes CF treat it as DYNAMIC and skips the cache entirely.
      const hasSharedTtl = [...directives].some((d) => /^s-maxage=(\d+)$/.test(d))

      expect(
        hasSharedTtl,
        `expected s-maxage=<seconds> on HTML so the edge can cache, got "${raw}"`,
      ).toBe(true)

      // And the CDN must actually be able to serve from cache — DYNAMIC means
      // the response was not cacheable at all.
      const cfStatus = (headers['cf-cache-status'] ?? '').toUpperCase()
      expect(
        cfStatus,
        `Cf-Cache-Status must not be DYNAMIC (means CDN cannot cache), got "${cfStatus}"`,
      ).not.toBe('DYNAMIC')
    })
  }
})
