import { requireAuth } from '@pya-company/auth'
import { ForbiddenError, NotFoundError, ValidationError, uuidV7 } from '@pya-company/shared'
import { Hono } from 'hono'
import * as v from 'valibot'
import { RequestCreateSchema, RequestUpdateSchema } from '../schemas.ts'

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

const toDto = (r: RequestRow) => ({
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

export const requestsRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const url = new URL(c.req.url)
    const category = url.searchParams.get('category')
    const barrio = url.searchParams.get('barrio')
    const where: string[] = ["status = 'open'"]
    const params: unknown[] = []
    if (category) {
      where.push('category = ?')
      params.push(category)
    }
    if (barrio) {
      where.push('barrio = ?')
      params.push(barrio)
    }
    const sql = `SELECT * FROM requests WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 100`
    const result = await c.env.DB.prepare(sql).bind(...params).all<RequestRow>()
    return c.json({ data: result.results.map(toDto) })
  })
  .get('/:id', async (c) => {
    const row = await c.env.DB.prepare('SELECT * FROM requests WHERE id = ?').bind(c.req.param('id')).first<RequestRow>()
    if (!row) throw new NotFoundError({ resource: 'request' })
    return c.json({ data: toDto(row) })
  })
  .post('/', requireAuth, async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(RequestCreateSchema, body)
    if (!parsed.success) throw new ValidationError({ issues: parsed.issues.map((i) => ({ path: i.path?.map((p) => p.key).join(".") ?? "", message: i.message })) })
    const now = Math.floor(Date.now() / 1000)
    const id = uuidV7()
    await c.env.DB.prepare(
      `INSERT INTO requests
       (id, client_id, category, title, description, budget_gs, barrio, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
    )
      .bind(
        id,
        c.var.session.userId,
        parsed.output.category,
        parsed.output.title,
        parsed.output.description ?? '',
        parsed.output.budgetGs ?? null,
        parsed.output.barrio,
        now,
        now,
      )
      .run()
    const row = await c.env.DB.prepare('SELECT * FROM requests WHERE id = ?').bind(id).first<RequestRow>()
    return c.json({ data: toDto(row as RequestRow) }, 201)
  })
  .patch('/:id', requireAuth, async (c) => {
    const id = c.req.param('id')
    const existing = await c.env.DB.prepare('SELECT * FROM requests WHERE id = ?').bind(id).first<RequestRow>()
    if (!existing) throw new NotFoundError({ resource: 'request' })
    if (existing.client_id !== c.var.session.userId) throw new ForbiddenError({ required: "not owner" })

    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(RequestUpdateSchema, body)
    if (!parsed.success) throw new ValidationError({ issues: parsed.issues.map((i) => ({ path: i.path?.map((p) => p.key).join(".") ?? "", message: i.message })) })
    const o = parsed.output
    const sets: string[] = []
    const params: unknown[] = []
    const set = (col: string, val: unknown) => {
      sets.push(`${col} = ?`)
      params.push(val)
    }
    if (o.category !== undefined) set('category', o.category)
    if (o.title !== undefined) set('title', o.title)
    if (o.description !== undefined) set('description', o.description)
    if (o.budgetGs !== undefined) set('budget_gs', o.budgetGs)
    if (o.barrio !== undefined) set('barrio', o.barrio)
    if (o.status !== undefined) set('status', o.status)
    if (sets.length === 0) return c.json({ data: toDto(existing) })
    sets.push('updated_at = ?')
    params.push(Math.floor(Date.now() / 1000))
    params.push(id)
    await c.env.DB.prepare(`UPDATE requests SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run()
    const fresh = await c.env.DB.prepare('SELECT * FROM requests WHERE id = ?').bind(id).first<RequestRow>()
    return c.json({ data: toDto(fresh as RequestRow) })
  })
