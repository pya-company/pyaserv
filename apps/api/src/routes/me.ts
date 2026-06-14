import { requireAuth } from '@pya-company/auth'
import { ValidationError } from '@pya-company/shared'
import { Hono } from 'hono'
import * as v from 'valibot'
import { NotificationPrefsSchema } from '../schemas.ts'

interface AppEnv {
  readonly Bindings: Env
}

interface RequestRow {
  readonly id: string
  readonly client_id: string
  readonly category: string
  readonly title: string
  readonly description: string
  readonly budget_gs: number | null
  readonly barrio: string
  readonly status: string
  readonly created_at: number
  readonly updated_at: number
}

const toRequestDto = (r: RequestRow) => ({
  id: r.id,
  clientId: r.client_id,
  category: r.category,
  title: r.title,
  description: r.description,
  budgetGs: r.budget_gs,
  barrio: r.barrio,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

// Cabinet helpers: list MY own things across statuses.
export const meRoutes = new Hono<AppEnv>()
  .get('/requests', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const result = await c.env.DB.prepare(
      'SELECT * FROM requests WHERE client_id = ? ORDER BY created_at DESC LIMIT 200',
    )
      .bind(userId)
      .all<RequestRow>()
    return c.json({ data: result.results.map(toRequestDto) })
  })
  .get('/notifications', requireAuth, async (c) => {
    const row = await c.env.DB.prepare('SELECT email_notifications FROM users WHERE id = ?')
      .bind(c.var.session.userId)
      .first<{ email_notifications: number }>()
    return c.json({ data: { emailNotifications: row?.email_notifications === 1 } })
  })
  .patch('/notifications', requireAuth, async (c) => {
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
