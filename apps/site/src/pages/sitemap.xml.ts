import type { APIRoute } from 'astro'
import { DOC_PAGES } from '~/data/docs-content.ts'
import { RELEASES } from '~/data/releases.ts'

const SITE = 'https://pyaserv.com'

const STATIC_PATHS: ReadonlyArray<string> = [
  '/',
  '/specialists/',
  '/clients/',
  '/docs/',
  '/releases/',
]

export const GET: APIRoute = () => {
  const docs = DOC_PAGES.map((p) => `/docs/${p.slug}/`)
  const releases = RELEASES.map((r) => `/releases/${r.slug}/`)
  const all = [...STATIC_PATHS, ...docs, ...releases]
  const items = all
    .map((p) => `  <url><loc>${SITE}${p}</loc></url>`)
    .join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
