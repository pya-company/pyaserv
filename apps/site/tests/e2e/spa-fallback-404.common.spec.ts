/*
 * E2E: SPA catch-all returns 200 + home HTML for every unknown route.
 *
 * Bug spa-fallback-returns-200-home-for-all-unknown-routes:
 *   Astro's static SPA fallback (Cloudflare Pages serving index.html for any
 *   non-matching path) breaks four contracts at once:
 *     1) /sitemap.xml — advertised in robots.txt — returns text/html, not XML.
 *     2) /manifest.webmanifest — returns text/html, breaks PWA install.
 *     3) /icon-*.png — returns text/html, breaks PWA icon load.
 *     4) Unknown pages (/p/<bogus>, /releases/<bogus>, /random) return 200
 *        with the home body — masks 404s, pollutes search index, breaks
 *        Astro getStaticPaths semantics.
 *
 * Spec (line 179) requires sitemap + Open Graph + schema.org. Unknown routes
 * MUST return a real 404 (dedicated page); PWA assets MUST either ship or 404;
 * the sitemap URL named in robots.txt MUST resolve to real XML.
 *
 * This test MUST be RED until:
 *   - sitemap.xml is generated (e.g. @astrojs/sitemap).
 *   - PWA manifest + icons ship as real files.
 *   - src/pages/404.astro exists AND Cloudflare _routes/_redirects send unknown
 *     routes through it (200 home fallback removed).
 */
import { expect, test } from '@playwright/test'

type ApiRequest = import('@playwright/test').APIRequestContext

const HOME_MARKER = /<title[^>]*>\s*PyaServ/i

const fetchHead = async (request: ApiRequest, path: string) => {
  const res = await request.fetch(path, { method: 'HEAD', maxRedirects: 0 })
  return {
    status: res.status(),
    contentType: res.headers()['content-type'] ?? '',
  }
}

const fetchBody = async (request: ApiRequest, path: string) => {
  const res = await request.get(path, { maxRedirects: 0 })
  return {
    status: res.status(),
    contentType: res.headers()['content-type'] ?? '',
    body: await res.text(),
  }
}

test.describe('SPA fallback must not swallow unknown routes', () => {
  test('/sitemap.xml returns real XML (robots.txt advertises it)', async ({ request }) => {
    const head = await fetchHead(request, '/sitemap.xml')

    expect(head.status, 'sitemap must exist').toBe(200)
    expect(
      head.contentType,
      `Content-Type must be XML, got "${head.contentType}"`,
    ).toMatch(/(application|text)\/xml/i)

    const body = await fetchBody(request, '/sitemap.xml')
    expect(body.body.trimStart().startsWith('<?xml'), 'body must be XML, not HTML').toBe(true)
    expect(body.body, 'body must contain <urlset>').toMatch(/<urlset[\s>]/)
  })

  test('/manifest.webmanifest returns a real JSON manifest', async ({ request }) => {
    const head = await fetchHead(request, '/manifest.webmanifest')

    expect(head.status, 'manifest must exist').toBe(200)
    expect(
      head.contentType,
      `Content-Type must be manifest/json, got "${head.contentType}"`,
    ).toMatch(/(application\/manifest\+json|application\/json)/i)

    const body = await fetchBody(request, '/manifest.webmanifest')
    // Real manifest parses as JSON; SPA fallback returns HTML which throws.
    expect(() => JSON.parse(body.body), 'manifest body must be valid JSON').not.toThrow()
  })

  test('/icon-192.png returns a PNG (or honest 404), not HTML', async ({ request }) => {
    const head = await fetchHead(request, '/icon-192.png')

    // Either ship the icon (200 + image/png) or return a true 404. Anything
    // else (200 text/html from the SPA fallback) is the bug.
    if (head.status === 200) {
      expect(
        head.contentType,
        `200 must serve image/png, got "${head.contentType}"`,
      ).toMatch(/^image\/png/i)
    } else {
      expect(head.status, 'missing icon must 404').toBe(404)
    }
  })

  test('unknown top-level route returns 404, not 200 + home', async ({ request }) => {
    const res = await fetchBody(request, '/this-route-does-not-exist-xyz/')

    expect(res.status, 'unknown path must 404').toBe(404)
    // And critically: the body must NOT be the home page.
    expect(res.body, 'body must not be the home page').not.toMatch(HOME_MARKER)
  })

  test('unknown /p/<slug>/ returns 404 (getStaticPaths must not be masked)', async ({ request }) => {
    const res = await fetchBody(request, '/p/notexist-slug/')

    expect(res.status, 'bogus listing slug must 404').toBe(404)
    expect(res.body, 'body must not be the home page').not.toMatch(HOME_MARKER)
  })

  test('unknown /releases/<slug>/ returns 404', async ({ request }) => {
    const res = await fetchBody(request, '/releases/nonsense-slug/')

    expect(res.status, 'bogus release slug must 404').toBe(404)
    expect(res.body, 'body must not be the home page').not.toMatch(HOME_MARKER)
  })
})
