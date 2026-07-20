/**
 * Service Worker for pyaserv.com (Astro SSG, Cloudflare Pages).
 *
 * Strategies:
 * - HTML navigations: stale-while-revalidate — cache renders instantly, fresh
 *   copy fetched in the background. Returning visitors get sub-perceptual
 *   page loads.
 * - Static assets (JS/CSS/img/font/icon): cache-first. Hashed Astro asset
 *   names mean stale === wrong-version, so safe.
 * - API + auth (/api/*, /v1/*): bypassed entirely. Always live network —
 *   backend mutations + auth state must never see a cached body.
 * - Cross-origin requests: bypassed (e.g. api.pyaserv.com is a separate
 *   origin so falls through, but make it explicit for clarity).
 *
 * Cache versioning: CACHE_VERSION is replaced at build time by the
 * sw-manifest integration. Changing it busts the old cache on activate.
 *
 * Compiled by esbuild via the sw-manifest integration (NOT Vite — this file
 * uses WebWorker globals and must compile to an IIFE bundle).
 */

export type {}

const sw = globalThis as unknown as ServiceWorkerGlobalScope

const CACHE_VERSION = '__CACHE_VERSION__'
const CACHE_NAME = `pyaserv-v${CACHE_VERSION}`

const PRECACHE_URLS: ReadonlyArray<string> =
  '__PRECACHE_URLS__' as unknown as ReadonlyArray<string>

// Paths never cached — they're either live API calls or auth-state-bearing.
const NEVER_CACHE = ['/api/', '/v1/']

sw.addEventListener('install', (event) => {
  // Non-atomic: a single 404 / flaky 3G fetch must not poison the whole
  // install. Promise.allSettled keeps every successful add and ignores the rest.
  // Every other page is lazy-cached on first navigation via fetch handler.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u)))
      })
      .then(() => sw.skipWaiting()),
  )
})

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('pyaserv-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => sw.clients.claim()),
  )
})

sw.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== sw.location.origin) return
  if (NEVER_CACHE.some((p) => url.pathname.startsWith(p))) return

  const accept = request.headers.get('accept') ?? ''
  const isNavigate = request.mode === 'navigate' || accept.includes('text/html')

  event.respondWith(
    isNavigate ? staleWhileRevalidate(request) : cacheFirst(request),
  )
})

const staleWhileRevalidate = async (request: Request): Promise<Response> => {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)

  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached ?? caches.match('/'))

  return cached ?? (await networkFetch) ?? new Response('Offline', { status: 503 })
}

const cacheFirst = async (request: Request): Promise<Response> => {
  const cached = await caches.match(request)
  if (cached) return cached

  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}
