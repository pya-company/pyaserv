/*
 * E2E: hashed assets under /_astro/ must be served as `public, max-age=31536000,
 * immutable`. Static prerendered HTML must be edge-cacheable (s-maxage + non-
 * DYNAMIC Cf-Cache-Status).
 *
 * Asset URLs are content-hashed and change every build, so the test discovers
 * them at runtime by fetching a known page once and harvesting the first
 * _astro/*.css and _astro/*.js it references. No hardcoded hashes → no
 * post-build flake.
 */
import { expect, test } from '@playwright/test'

type ApiRequest = import('@playwright/test').APIRequestContext

const HARVEST_PAGE = '/es/'                     // any page works — all share the same Astro chunks
const STATIC_HTML_PATHS: ReadonlyArray<string> = ['/es/', '/es/docs/']

const harvestOneCssAndOneJs = async (request: ApiRequest): Promise<{ readonly css: string; readonly js: string }> => {
  const res = await request.get(HARVEST_PAGE)
  expect(res.status(), `${HARVEST_PAGE} must respond 200`).toBe(200)
  const html = await res.text()
  const css = html.match(/\/_astro\/[A-Za-z0-9._-]+\.css/)?.[0]
  const js = html.match(/\/_astro\/[A-Za-z0-9._-]+\.js/)?.[0]
  expect(css, 'no /_astro/*.css href found on harvest page').toBeTruthy()
  expect(js, 'no /_astro/*.js src found on harvest page').toBeTruthy()
  return { css: css as string, js: js as string }
}

const parseCacheControl = (raw: string): ReadonlySet<string> =>
  new Set(raw.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean))

const headHeaders = async (request: ApiRequest, path: string): Promise<Readonly<Record<string, string>>> => {
  const res = await request.fetch(path, { method: 'HEAD', maxRedirects: 0 })
  expect(res.status(), `${path} must respond 200`).toBe(200)
  return res.headers()
}

test.describe('hashed /_astro/* assets are immutable for 1 year', () => {
  test('first CSS chunk discovered at runtime → Cache-Control: public, max-age=31536000, immutable', async ({ request }) => {
    const { css } = await harvestOneCssAndOneJs(request)
    const headers = await headHeaders(request, css)
    const raw = headers['cache-control'] ?? ''
    const directives = parseCacheControl(raw)

    expect(directives.has('public'), `expected "public" in Cache-Control, got "${raw}"`).toBe(true)
    expect(directives.has('immutable'), `expected "immutable" in Cache-Control, got "${raw}"`).toBe(true)
    const maxAgeRaw = [...directives].find((d) => /^max-age=\d+$/.test(d))
    const maxAgeSeconds = maxAgeRaw ? Number(maxAgeRaw.replace('max-age=', '')) : 0
    expect(maxAgeSeconds, `expected max-age >= 31536000, got ${maxAgeSeconds} from "${raw}"`).toBeGreaterThanOrEqual(31_536_000)
    expect(directives.has('must-revalidate'), `must-revalidate must NOT appear on hashed assets, got "${raw}"`).toBe(false)
  })

  test('first JS chunk discovered at runtime → Cache-Control: public, max-age=31536000, immutable', async ({ request }) => {
    const { js } = await harvestOneCssAndOneJs(request)
    const headers = await headHeaders(request, js)
    const raw = headers['cache-control'] ?? ''
    const directives = parseCacheControl(raw)

    expect(directives.has('public')).toBe(true)
    expect(directives.has('immutable')).toBe(true)
    const maxAgeRaw = [...directives].find((d) => /^max-age=\d+$/.test(d))
    const maxAgeSeconds = maxAgeRaw ? Number(maxAgeRaw.replace('max-age=', '')) : 0
    expect(maxAgeSeconds).toBeGreaterThanOrEqual(31_536_000)
    expect(directives.has('must-revalidate')).toBe(false)
  })
})

test.describe('static prerendered HTML is edge-cacheable', () => {
  for (const path of STATIC_HTML_PATHS) {
    test(`${path} → s-maxage set so CDN can serve from cache`, async ({ request }) => {
      const headers = await headHeaders(request, path)
      const raw = headers['cache-control'] ?? ''
      const directives = parseCacheControl(raw)

      const hasSharedTtl = [...directives].some((d) => /^s-maxage=\d+$/.test(d))
      expect(hasSharedTtl, `expected s-maxage=<seconds> on HTML, got "${raw}"`).toBe(true)
      const cfStatus = (headers['cf-cache-status'] ?? '').toUpperCase()
      expect(cfStatus, `Cf-Cache-Status must not be DYNAMIC, got "${cfStatus}"`).not.toBe('DYNAMIC')
    })
  }
})
