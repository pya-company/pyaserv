import type { APIRoute } from 'astro'
import { RELEASES } from '~/data/releases.ts'
import { getReleaseContent } from '~/lib/content.ts'

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export const GET: APIRoute = () => {
  // Single source of truth: data/releases.ts + per-locale YAML.
  // Picks the EN content as canonical for the feed.
  const items = RELEASES.map((r) => {
    const c = getReleaseContent('en', r.slug) ?? getReleaseContent('es', r.slug)
    const title = c?.title ?? r.slug
    const desc = c?.tldr ?? ''
    return `
    <item>
      <title>${escapeXml(`${title} (${r.version})`)}</title>
      <link>https://pyaserv.com/releases/${r.slug}/</link>
      <guid isPermaLink="false">pyaserv-${r.version}</guid>
      <description>${escapeXml(desc)}</description>
      <pubDate>${new Date(`${r.date}T12:00:00Z`).toUTCString()}</pubDate>
    </item>`
  }).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PyaServ — Novedades</title>
    <link>https://pyaserv.com/releases/</link>
    <description>Lo último en PyaServ. Una entrada por release.</description>
    <language>es-PY</language>${items}
  </channel>
</rss>`

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
