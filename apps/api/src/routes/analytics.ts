import { requireAuth } from '@pya-company/auth'
import { uuidV7 } from '@pya-company/shared'
import { Hono } from 'hono'
import { checkRateLimit } from '../rate-limit.ts'

interface AppEnv {
  readonly Bindings: Env
}

const VALID_EVENTS = new Set(['profile_view', 'phone_click', 'whatsapp_click'])

interface SpecialistRow {
  readonly id: string
  readonly user_id: string
}

interface InquiryAggRow {
  readonly total: number
  readonly done: number
}

// Public anonymous record + private per-specialist aggregate read.
export const analyticsRoutes = new Hono<AppEnv>()
  // POST /v1/analytics — fire-and-forget. Body: {event, subjectId}.
  // Rate-limited to keep abuse cheap; specialist owners get their own view
  // back in aggregate so unrelated callers can't inflate their own counters
  // beyond a sane noise floor.
  .post('/', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { event?: string; subjectId?: string }
    if (!body.event || !body.subjectId || !VALID_EVENTS.has(body.event)) {
      return c.json({ error: { code: 'BadInput', message: 'event + subjectId required' } }, 400)
    }
    // Don't record self-views: if the caller is authenticated and the subject
    // belongs to them, skip — keeps the dashboard honest.
    const auth = c.req.header('Authorization')
    let userId: string | null = null
    if (auth?.startsWith('Bearer ')) {
      const sid = auth.slice(7)
      const sess = await c.env.SESSIONS.get(`sess:${sid}`, { type: 'json' })
      if (sess && typeof sess === 'object' && 'userId' in sess) {
        userId = (sess as { userId: string }).userId
      }
    }
    if (userId) {
      const profile = await c.env.DB.prepare('SELECT user_id FROM specialist_profiles WHERE id = ?')
        .bind(body.subjectId)
        .first<SpecialistRow>()
      if (profile && profile.user_id === userId) return c.json({ data: { ok: true, skipped: 'self' } })
    }
    // Cheap rate limit: 200 events / hour / (IP+subject pair) — keeps fan-out
    // bots from juicing counts.
    const ip = c.req.header('CF-Connecting-IP') ?? 'noip'
    await checkRateLimit(c.env.SESSIONS, {
      bucket: 'analytics',
      id: `${ip}:${body.subjectId}:${body.event}`,
      limit: 200,
      windowSec: 60 * 60,
    })
    await c.env.DB.prepare(
      'INSERT INTO analytics_events (id, user_id, event, subject_id, ts) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(uuidV7(), userId, body.event, body.subjectId, Math.floor(Date.now() / 1000))
      .run()
    return c.json({ data: { ok: true } }, 201)
  })
  // GET /v1/me/stats — aggregates for the calling specialist's profile.
  // Returns counters over the last 30 days + lifetime inquiry funnel.
  .get('/me', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const profile = await c.env.DB.prepare(
      'SELECT id FROM specialist_profiles WHERE user_id = ? LIMIT 1',
    )
      .bind(userId)
      .first<{ id: string }>()
    if (!profile) return c.json({ data: null })

    const now = Math.floor(Date.now() / 1000)
    const day = 24 * 60 * 60
    const since30d = now - 30 * day
    const events = await c.env.DB.prepare(
      `SELECT event, COUNT(*) AS n
       FROM analytics_events
       WHERE subject_id = ? AND ts >= ?
       GROUP BY event`,
    )
      .bind(profile.id, since30d)
      .all<{ event: string; n: number }>()
    const byEvent: Record<string, number> = {}
    for (const r of events.results) byEvent[r.event] = r.n

    // Inquiry funnel (lifetime — small numbers, no need to bound)
    const inq = await c.env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN work_status = 'done' THEN 1 ELSE 0 END) AS done
       FROM inquiries WHERE specialist_user_id = ?`,
    )
      .bind(userId)
      .first<InquiryAggRow>()

    return c.json({
      data: {
        last30d: {
          profileView: byEvent.profile_view ?? 0,
          phoneClick: byEvent.phone_click ?? 0,
          whatsappClick: byEvent.whatsapp_click ?? 0,
        },
        funnel: {
          inquiries: inq?.total ?? 0,
          completed: inq?.done ?? 0,
        },
      },
    })
  })
