/*
 * Header-gated dev login route. Issues a real session for an E2E-only
 * fake user when the request carries the secret X-Dev-Bypass-Key header.
 *
 * Why not @pya-company/auth's createDevBypassRoutes: that one short-circuits
 * to 403 on ENVIRONMENT=production. Our pyaserv API runs production by
 * default and we want a path that's safe to leave on as long as the secret
 * stays a secret — Playwright (or anyone with the key) can mint a session
 * without going through Resend.
 *
 * Safety properties:
 *   - Returns 404 (matching catch-all) if DEV_AUTH_BYPASS_KEY env var is
 *     unset → route is effectively invisible.
 *   - Returns 403 if header missing or wrong (constant-time compare).
 *   - Creates a per-call fake user under a sentinel email so production
 *     real users can never collide.
 */
import { newSessionId, writeSession } from '@pya-company/auth'
import { uuidV7 } from '@pya-company/shared'
import { Hono } from 'hono'
import { translatePair } from '../lib/translate.ts'

const HEADER_NAME = 'X-Dev-Bypass-Key'

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const sha256Hex = async (s: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const devLoginRoutes = new Hono<{ Bindings: Env }>().post('/login', async (c) => {
  const expected = (c.env as { DEV_AUTH_BYPASS_KEY?: string }).DEV_AUTH_BYPASS_KEY
  // Fall through to the global 404 catch-all when no key is configured: the
  // route's existence is undetectable from outside.
  if (typeof expected !== 'string' || expected.length === 0) return c.notFound()

  const sent = c.req.header(HEADER_NAME) ?? ''
  if (!constantTimeEqual(sent, expected)) return c.body(null, 403)

  // Sentinel email — easy to find/clean up; "@e2e.invalid" is RFC 6761 reserved.
  const email = (c.req.query('email') ?? `e2e-${Date.now()}@e2e.invalid`).toLowerCase()
  const now = Math.floor(Date.now() / 1000)

  const existing = await c.env.DB.prepare(
    "SELECT id FROM users WHERE email = ? AND status != 'deleted'",
  )
    .bind(email)
    .first<{ id: string }>()
  const userId = existing?.id ?? uuidV7()
  if (existing === null || existing === undefined) {
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, email_verified, display_name, locale, created_at, status)
       VALUES (?, ?, 1, ?, 'es-PY', ?, 'active')`,
    )
      .bind(userId, email, `E2E ${email}`, now)
      .run()
  }

  const sid = newSessionId()
  const ipHash = await sha256Hex(
    (c.req.header('CF-Connecting-IP') ?? '') + (c.env.SESSION_PEPPER ?? ''),
  )
  const uaHash = await sha256Hex(c.req.header('User-Agent') ?? '')
  await writeSession(c.env.SESSIONS, sid, {
    userId,
    roles: ['customer'],
    storeIds: [],
    iat: now,
    lastSeen: now,
    ipHash,
    uaHash,
  })

  return c.json({ data: { ok: true, userId, email, sessionToken: sid } })
}).post('/backfill-translations', async (c) => {
  // Same secret gate as /login. Walks specialist_profiles, listings, requests
  // and fills *_es/*_en columns where the EN copy is NULL. Source assumed ES
  // (every pre-translation row was entered in Spanish). Idempotent.
  const expected = (c.env as { DEV_AUTH_BYPASS_KEY?: string }).DEV_AUTH_BYPASS_KEY
  if (typeof expected !== 'string' || expected.length === 0) return c.notFound()
  if (c.req.header(HEADER_NAME) !== expected) return c.body(null, 403)

  const stats = { specialists: 0, listings: 0, requests: 0 }

  // Post-S22: legacy source columns dropped. Read the ES copy as source.
  const specs = await c.env.DB.prepare(
    "SELECT id, headline_es AS headline, bio_es AS bio FROM specialist_profiles WHERE headline_en IS NULL OR bio_en IS NULL",
  ).all<{ id: string; headline: string; bio: string }>()
  for (const r of (specs.results ?? [])) {
    const h = await translatePair(c.env, 'es', r.headline)
    const b = await translatePair(c.env, 'es', r.bio)
    await c.env.DB.prepare(
      "UPDATE specialist_profiles SET headline_es=?, headline_en=?, bio_es=?, bio_en=? WHERE id=?",
    ).bind(h.es, h.en, b.es, b.en, r.id).run()
    stats.specialists++
  }

  const lst = await c.env.DB.prepare(
    "SELECT id, title_es AS title, description_es AS description FROM listings WHERE title_en IS NULL OR description_en IS NULL",
  ).all<{ id: string; title: string; description: string }>()
  for (const r of (lst.results ?? [])) {
    const t = await translatePair(c.env, 'es', r.title)
    const d = await translatePair(c.env, 'es', r.description)
    await c.env.DB.prepare(
      "UPDATE listings SET title_es=?, title_en=?, description_es=?, description_en=? WHERE id=?",
    ).bind(t.es, t.en, d.es, d.en, r.id).run()
    stats.listings++
  }

  const req = await c.env.DB.prepare(
    "SELECT id, title_es AS title, description_es AS description FROM requests WHERE title_en IS NULL OR description_en IS NULL",
  ).all<{ id: string; title: string; description: string }>()
  for (const r of (req.results ?? [])) {
    const t = await translatePair(c.env, 'es', r.title)
    const d = await translatePair(c.env, 'es', r.description)
    await c.env.DB.prepare(
      "UPDATE requests SET title_es=?, title_en=?, description_es=?, description_en=? WHERE id=?",
    ).bind(t.es, t.en, d.es, d.en, r.id).run()
    stats.requests++
  }

  return c.json({ data: { ok: true, ...stats } })
})
