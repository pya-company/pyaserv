import { requireAuth } from '@pya-company/auth'
import { ValidationError } from '@pya-company/shared'
import { Hono } from 'hono'
import * as v from 'valibot'
import { NotificationPrefsSchema } from '../schemas.ts'

interface AppEnv {
  readonly Bindings: Env
}

interface ReviewRow {
  readonly id: string
  readonly inquiry_id: string
  readonly rater_user_id: string
  readonly ratee_user_id: string
  readonly role: string
  readonly stars: number
  readonly body: string
  readonly created_at: number
}

// Public: aggregate + recent reviews for a specialist (by their specialist_profile id).
export const reviewsRoutes = new Hono<AppEnv>()
  .get('/specialists/:id/reviews', async (c) => {
    const id = c.req.param('id')
    const profile = await c.env.DB.prepare('SELECT user_id FROM specialist_profiles WHERE id = ?')
      .bind(id)
      .first<{ user_id: string }>()
    if (!profile) return c.json({ data: { average: 0, count: 0, recent: [] } })
    const agg = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n, COALESCE(AVG(stars), 0) AS avg FROM reviews WHERE ratee_user_id = ? AND role = 'client'",
    )
      .bind(profile.user_id)
      .first<{ n: number; avg: number }>()
    const recent = await c.env.DB.prepare(
      `SELECT * FROM reviews
       WHERE ratee_user_id = ? AND role = 'client'
       ORDER BY created_at DESC
       LIMIT 5`,
    )
      .bind(profile.user_id)
      .all<ReviewRow>()
    return c.json({
      data: {
        average: agg ? Math.round(agg.avg * 10) / 10 : 0,
        count: agg ? agg.n : 0,
        recent: recent.results.map((r) => ({
          id: r.id,
          stars: r.stars,
          body: r.body,
          createdAt: r.created_at,
        })),
      },
    })
  })
  .patch('/me/notifications', requireAuth, async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(NotificationPrefsSchema, body)
    if (!parsed.success)
      throw new ValidationError({
        issues: parsed.issues.map((i) => ({ path: i.path?.map((p) => p.key).join('.') ?? '', message: i.message })),
      })
    await c.env.DB.prepare('UPDATE users SET email_notifications = ? WHERE id = ?')
      .bind(parsed.output.emailNotifications ? 1 : 0, c.var.session.userId)
      .run()
    return c.json({ data: { emailNotifications: parsed.output.emailNotifications } })
  })
