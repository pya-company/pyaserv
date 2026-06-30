import type { APIRoute } from 'astro'

const MANIFEST = {
  name: 'PyaServ',
  short_name: 'PyaServ',
  description: 'Marketplace de servicios en Paraguay sin comisiones.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#4f46e5',
  lang: 'es',
  icons: [
    { src: '/icon-192.png', type: 'image/png', sizes: '192x192', purpose: 'any' },
    { src: '/icon-512.png', type: 'image/png', sizes: '512x512', purpose: 'any' },
  ],
}

export const GET: APIRoute = () =>
  new Response(JSON.stringify(MANIFEST, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  })
