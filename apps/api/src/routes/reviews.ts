import { Hono } from 'hono'

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

// Public: aggregate + items reviews for a specialist (by their specialist_profile id).
export const reviewsRoutes = new Hono<AppEnv>()
  .get('/specialists/:id/reviews', async (c) => {
    const id = c.req.param('id')
    const profile = await c.env.DB.prepare('SELECT user_id FROM specialist_profiles WHERE id = ?')
      .bind(id)
      .first<{ user_id: string }>()
    if (!profile) return c.json({ data: { average: 0, count: 0, items: [] } })
    const agg = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n, COALESCE(AVG(stars), 0) AS avg FROM reviews WHERE ratee_user_id = ? AND role = 'client'",
    )
      .bind(profile.user_id)
      .first<{ n: number; avg: number }>()
    const items = await c.env.DB.prepare(
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
        items: items.results.map((r) => ({
          id: r.id,
          stars: r.stars,
          body: r.body,
          createdAt: r.created_at,
        })),
      },
    })
  })
