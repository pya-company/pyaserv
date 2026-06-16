import { requireAuth } from '@pya-company/auth'
import { ForbiddenError, NotFoundError, ValidationError, uuidV7 } from '@pya-company/shared'
import { Hono } from 'hono'
import * as v from 'valibot'
import { ListingCreateSchema, ListingUpdateSchema } from '../schemas.ts'

interface AppEnv {
  readonly Bindings: Env
}

interface ListingRow {
  readonly id: string
  readonly specialist_id: string
  readonly category: string
  readonly title: string
  readonly description: string
  readonly price_from_gs: number | null
  readonly price_unit: string | null
  readonly photo: string | null
  readonly status: string
  readonly created_at: number
  readonly updated_at: number
}

const toDto = (r: ListingRow) => ({
  id: r.id,
  specialistId: r.specialist_id,
  category: r.category,
  title: r.title,
  description: r.description,
  priceFromGs: r.price_from_gs,
  priceUnit: r.price_unit,
  photo: r.photo,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const ensureMySpecialistId = async (env: Env, userId: string): Promise<string> => {
  const row = await env.DB.prepare('SELECT id FROM specialist_profiles WHERE user_id = ?')
    .bind(userId)
    .first<{ id: string }>()
  if (!row) throw new ForbiddenError({ required: "create a specialist profile first" })
  return row.id
}

export const listingsRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const url = new URL(c.req.url)
    const category = url.searchParams.get('category')
    const specialistId = url.searchParams.get('specialist_id')
    const where: string[] = ["l.status = 'active'"]
    const params: unknown[] = []
    if (category) {
      where.push('l.category = ?')
      params.push(category)
    }
    if (specialistId) {
      where.push('l.specialist_id = ?')
      params.push(specialistId)
    }
    const sql = `
      SELECT l.*, s.display_name AS sp_name, s.barrio AS sp_barrio, s.verified AS sp_verified
      FROM listings l JOIN specialist_profiles s ON s.id = l.specialist_id
      WHERE ${where.join(' AND ')}
      ORDER BY s.verified DESC, l.updated_at DESC
      LIMIT 100`
    const result = await c.env.DB.prepare(sql).bind(...params).all<ListingRow & { sp_name: string; sp_barrio: string; sp_verified: number }>()
    c.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=600')
    return c.json({
      data: result.results.map((r) => ({
        ...toDto(r),
        specialist: { id: r.specialist_id, displayName: r.sp_name, barrio: r.sp_barrio, verified: r.sp_verified === 1 },
      })),
    })
  })
  .post('/', requireAuth, async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(ListingCreateSchema, body)
    if (!parsed.success) throw new ValidationError({ issues: parsed.issues.map((i) => ({ path: i.path?.map((p) => p.key).join(".") ?? "", message: i.message })) })
    const specialistId = await ensureMySpecialistId(c.env, c.var.session.userId)
    const now = Math.floor(Date.now() / 1000)
    const id = uuidV7()
    await c.env.DB.prepare(
      `INSERT INTO listings
       (id, specialist_id, category, title, description, price_from_gs, price_unit, photo, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    )
      .bind(
        id,
        specialistId,
        parsed.output.category,
        parsed.output.title,
        parsed.output.description ?? '',
        parsed.output.priceFromGs ?? null,
        parsed.output.priceUnit ?? null,
        parsed.output.photo ?? null,
        now,
        now,
      )
      .run()
    const row = await c.env.DB.prepare('SELECT * FROM listings WHERE id = ?').bind(id).first<ListingRow>()
    return c.json({ data: toDto(row as ListingRow) }, 201)
  })
  .patch('/:id', requireAuth, async (c) => {
    const id = c.req.param('id')
    const existing = await c.env.DB.prepare('SELECT * FROM listings WHERE id = ?').bind(id).first<ListingRow>()
    if (!existing) throw new NotFoundError({ resource: 'listing' })
    const mine = await ensureMySpecialistId(c.env, c.var.session.userId)
    if (existing.specialist_id !== mine) throw new ForbiddenError({ required: "not owner" })

    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(ListingUpdateSchema, body)
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
    if (o.priceFromGs !== undefined) set('price_from_gs', o.priceFromGs)
    if (o.priceUnit !== undefined) set('price_unit', o.priceUnit)
    if (o.photo !== undefined) set('photo', o.photo)
    if (sets.length === 0) return c.json({ data: toDto(existing) })
    sets.push('updated_at = ?')
    params.push(Math.floor(Date.now() / 1000))
    params.push(id)
    await c.env.DB.prepare(`UPDATE listings SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run()
    const fresh = await c.env.DB.prepare('SELECT * FROM listings WHERE id = ?').bind(id).first<ListingRow>()
    return c.json({ data: toDto(fresh as ListingRow) })
  })
  .delete('/:id', requireAuth, async (c) => {
    const id = c.req.param('id')
    const existing = await c.env.DB.prepare('SELECT * FROM listings WHERE id = ?').bind(id).first<ListingRow>()
    if (!existing) throw new NotFoundError({ resource: 'listing' })
    const mine = await ensureMySpecialistId(c.env, c.var.session.userId)
    if (existing.specialist_id !== mine) throw new ForbiddenError({ required: "not owner" })
    await c.env.DB.prepare('DELETE FROM listings WHERE id = ?').bind(id).run()
    return c.json({ data: { deleted: true } })
  })
