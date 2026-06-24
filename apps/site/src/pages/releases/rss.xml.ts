import type { APIRoute } from 'astro'

const releases = [
  {
    date: '2026-06-25',
    version: 'v1.1.0',
    title: 'Sprint 1-6 features live',
    desc: 'Las 13 features de spec v1 están en producción.',
  },
  {
    date: '2026-06-24',
    version: 'v1.0.0',
    title: 'Spec v1 Foundation',
    desc: 'Base de datos lista para todas las features.',
  },
]

export const GET: APIRoute = () => {
  const items = releases.map((r) => `
    <item>
      <title>${r.title} (${r.version})</title>
      <link>https://pyaserv.com/releases/</link>
      <guid isPermaLink="false">pyaserv-${r.version}</guid>
      <description>${r.desc}</description>
      <pubDate>${new Date(`${r.date}T12:00:00Z`).toUTCString()}</pubDate>
    </item>
  `).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PyaServ — Novedades</title>
    <link>https://pyaserv.com/releases/</link>
    <description>Lo último en PyaServ. Una entrada por release.</description>
    <language>es-PY</language>
    ${items}
  </channel>
</rss>`

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
