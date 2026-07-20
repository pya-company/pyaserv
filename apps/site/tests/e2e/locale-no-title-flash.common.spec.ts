/*
 * E2E: under /en/ /de/ /ru/, the SSR'd <title> and <html lang> must already
 * be in the target locale — no client-side swap, no Spanish flash.
 *
 * Pre-fix: Astro's fallbackType:'rewrite' copied the ES SSR HTML verbatim
 * to /en/, /de/, /ru/. A Russian visitor saw <title>Servicios en Paraguay…</title>
 * for ~700ms while the client-side localize-content script caught up — a
 * visible Spanish-title flash on what should be a Russian page.
 *
 * Fix: post-build script scripts/rewrite-locale-head.ts walks dist/<lang>/**.html
 * and rewrites <html lang>, <title>, <meta name=description> in-place at
 * build time. The SSR HTML for /ru/ is now born Russian.
 *
 * This test reads the raw HTML over fetch (no JS execution), so it catches
 * exactly what the browser sees on its first paint.
 */
import { expect, test } from '@playwright/test'

type Case = { path: string; lang: string; titleMustContain: RegExp }
const CASES: Case[] = [
  { path: '/en/',               lang: 'en', titleMustContain: /Services in Paraguay/i },
  { path: '/de/',               lang: 'de', titleMustContain: /Dienste|Dienstleistungen/i },
  { path: '/ru/',               lang: 'ru', titleMustContain: /Услуги/i },
  { path: '/en/specialists/',   lang: 'en', titleMustContain: /Specialists/i },
  { path: '/de/specialists/',   lang: 'de', titleMustContain: /Fachleute/i },
  { path: '/ru/specialists/',   lang: 'ru', titleMustContain: /Специалисты/i },
  { path: '/en/clients/',       lang: 'en', titleMustContain: /Requests/i },
  { path: '/de/clients/',       lang: 'de', titleMustContain: /Anfragen/i },
  { path: '/ru/clients/',       lang: 'ru', titleMustContain: /заявки|Заявки/i },
]

test.describe('Per-locale SSR head: no Spanish-title flash on /en /de /ru', () => {
  for (const c of CASES) {
    test(`${c.path} → raw HTML has <html lang="${c.lang}"> and matching title`, async ({ request }) => {
      const res = await request.get(c.path)
      expect(res.status(), `${c.path} should 200`).toBe(200)
      const html = await res.text()

      const htmlLangMatch = html.match(/<html\s+lang="([^"]+)"/)
      expect(htmlLangMatch?.[1], `${c.path} <html lang> must be ${c.lang} in SSR`).toBe(c.lang)

      const titleMatch = html.match(/<title>([^<]+)<\/title>/)
      expect(titleMatch?.[1], `${c.path} <title> missing`).toBeTruthy()
      expect(titleMatch?.[1] ?? '', `${c.path} <title> must contain ${c.titleMustContain} (got "${titleMatch?.[1]}")`).toMatch(c.titleMustContain)

      // And the title must NOT be the bare Spanish default — that's the
      // pre-fix bug we are guarding against.
      expect(titleMatch?.[1] ?? '', `${c.path} <title> must NOT be the Spanish "Servicios en Paraguay…" default`).not.toMatch(/Servicios en Paraguay sin comisiones/i)
    })
  }
})
