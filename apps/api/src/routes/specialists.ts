import { requireAuth } from '@pya-company/auth'
import { ForbiddenError, NotFoundError, ValidationError, uuidV7 } from '@pya-company/shared'
import { Hono } from 'hono'
import * as v from 'valibot'
import { translatePair } from '../lib/translate.ts'
import { SpecialistCreateSchema, SpecialistUpdateSchema } from '../schemas.ts'

interface AppEnv {
  readonly Bindings: Env
}

interface SpecialistRow {
  readonly id: string
  readonly user_id: string
  readonly display_name: string
  readonly headline: string
  readonly bio: string
  readonly headline_es: string | null
  readonly headline_en: string | null
  readonly bio_es: string | null
  readonly bio_en: string | null
  readonly phone: string
  readonly whatsapp: string | null
  readonly barrio: string
  readonly lat: number | null
  readonly lng: number | null
  readonly photo: string | null
  readonly verified: number
  readonly status: string
  readonly created_at: number
  readonly updated_at: number
}

const toDto = (r: SpecialistRow) => ({
  id: r.id,
  userId: r.user_id,
  displayName: r.display_name,
  headline: r.headline,
  bio: r.bio,
  // Locale pair — read-side falls back to the source value when the
  // translation column is NULL (pre-backfill rows).
  headlineEs: r.headline_es ?? r.headline,
  headlineEn: r.headline_en ?? r.headline,
  bioEs: r.bio_es ?? r.bio,
  bioEn: r.bio_en ?? r.bio,
  phone: r.phone,
  whatsapp: r.whatsapp,
  barrio: r.barrio,
  lat: r.lat,
  lng: r.lng,
  photo: r.photo,
  verified: r.verified === 1,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export const specialistsRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const url = new URL(c.req.url)
    const barrio = url.searchParams.get('barrio')
    const near = url.searchParams.get('near')
    const where: string[] = ["status = 'active'"]
    const params: unknown[] = []
    if (barrio) {
      where.push('barrio = ?')
      params.push(barrio)
    }
    // LEFT JOIN aggregates: avg/count of client-role reviews for this specialist's user_id,
    // plus a single example category from one of their listings. Keeps the list call to a
    // single round trip — no N+1 reviews/listings fetches on the client side.
    const sql = `
      SELECT s.*,
             COALESCE(r.avg_stars, 0) AS rating_avg,
             COALESCE(r.n, 0) AS rating_count,
             l.category AS primary_category
      FROM specialist_profiles s
      LEFT JOIN (
        SELECT ratee_user_id, AVG(stars) AS avg_stars, COUNT(*) AS n
        FROM reviews WHERE role = 'client'
        GROUP BY ratee_user_id
      ) r ON r.ratee_user_id = s.user_id
      LEFT JOIN (
        SELECT specialist_id, MIN(category) AS category FROM listings WHERE status='active' GROUP BY specialist_id
      ) l ON l.specialist_id = s.id
      WHERE ${where.join(' AND ')}
      ORDER BY s.verified DESC, s.updated_at DESC LIMIT 100`
    const result = await c.env.DB.prepare(sql).bind(...params).all<SpecialistRow & { rating_avg: number; rating_count: number; primary_category: string | null }>()
    const rows = result.results
    // Optional ?near=lat,lng — Haversine in JS keeps the SQL portable across
    // workers + lets us return distance to the client. Profiles without
    // lat/lng fall to the end.
    if (near) {
      const [latStr, lngStr] = near.split(',')
      const lat = Number(latStr)
      const lng = Number(lngStr)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const R = 6371
        const toRad = (d: number) => (d * Math.PI) / 180
        const distance = (r: SpecialistRow): number => {
          if (r.lat === null || r.lng === null) return Number.POSITIVE_INFINITY
          const dLat = toRad(r.lat - lat)
          const dLng = toRad(r.lng - lng)
          const a = Math.sin(dLat / 2) ** 2
            + Math.cos(toRad(lat)) * Math.cos(toRad(r.lat)) * Math.sin(dLng / 2) ** 2
          return 2 * R * Math.asin(Math.sqrt(a))
        }
        rows.sort((a, b) => distance(a) - distance(b))
        return c.json({
          data: rows.map((r) => {
            const km = distance(r)
            return {
              ...toDto(r),
              ratingAvg: Math.round((r.rating_avg as number) * 10) / 10,
              ratingCount: r.rating_count as number,
              primaryCategory: r.primary_category,
              distanceKm: Number.isFinite(km) ? Math.round(km * 10) / 10 : null,
            }
          }),
        })
      }
    }
    return c.json({
      data: rows.map((r) => ({
        ...toDto(r),
        ratingAvg: Math.round((r.rating_avg as number) * 10) / 10,
        ratingCount: r.rating_count as number,
        primaryCategory: r.primary_category,
      })),
    })
  })
  .get('/:id', async (c) => {
    const row = await c.env.DB.prepare('SELECT * FROM specialist_profiles WHERE id = ?')
      .bind(c.req.param('id'))
      .first<SpecialistRow>()
    if (!row) throw new NotFoundError({ resource: 'specialist' })
    // 60s edge cache + 600s stale-while-revalidate — profiles change rarely; PATCH
    // path invalidates implicitly by returning a new updatedAt that the client uses
    // to bust if needed. CF's edge cache + browser will both honor.
    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=600')
    return c.json({ data: toDto(row) })
  })
  .post('/', requireAuth, async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(SpecialistCreateSchema, body)
    if (!parsed.success) throw new ValidationError({ issues: parsed.issues.map((i) => ({ path: i.path?.map((p) => p.key).join(".") ?? "", message: i.message })) })
    const userId = c.var.session.userId
    const now = Math.floor(Date.now() / 1000)
    const id = uuidV7()
    // User content arrives in the active UI locale (ES by default; EN if the
    // client opted in). Translate-on-write so reads never block on the model.
    const sourceLoc = ((c.req.header('Accept-Language') ?? '').toLowerCase().startsWith('en') ? 'en' : 'es') as 'es' | 'en'
    const headlinePair = await translatePair(c.env, sourceLoc, parsed.output.headline)
    const bioPair = await translatePair(c.env, sourceLoc, parsed.output.bio ?? '')
    await c.env.DB.prepare(
      `INSERT INTO specialist_profiles
       (id, user_id, display_name, headline, bio, headline_es, headline_en, bio_es, bio_en,
        phone, whatsapp, barrio, lat, lng, photo, verified, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)`,
    )
      .bind(
        id,
        userId,
        parsed.output.displayName,
        parsed.output.headline,
        parsed.output.bio ?? '',
        headlinePair.es,
        headlinePair.en,
        bioPair.es,
        bioPair.en,
        parsed.output.phone,
        parsed.output.whatsapp ?? null,
        parsed.output.barrio,
        parsed.output.lat ?? null,
        parsed.output.lng ?? null,
        parsed.output.photo ?? null,
        now,
        now,
      )
      .run()
    const row = await c.env.DB.prepare('SELECT * FROM specialist_profiles WHERE id = ?')
      .bind(id)
      .first<SpecialistRow>()
    return c.json({ data: toDto(row as SpecialistRow) }, 201)
  })
  .patch('/:id', requireAuth, async (c) => {
    const id = c.req.param('id')
    const existing = await c.env.DB.prepare('SELECT * FROM specialist_profiles WHERE id = ?')
      .bind(id)
      .first<SpecialistRow>()
    if (!existing) throw new NotFoundError({ resource: 'specialist' })
    if (existing.user_id !== c.var.session.userId) throw new ForbiddenError({ required: "not owner" })

    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(SpecialistUpdateSchema, body)
    if (!parsed.success) throw new ValidationError({ issues: parsed.issues.map((i) => ({ path: i.path?.map((p) => p.key).join(".") ?? "", message: i.message })) })
    const o = parsed.output

    const sets: string[] = []
    const params: unknown[] = []
    const set = (col: string, val: unknown) => {
      sets.push(`${col} = ?`)
      params.push(val)
    }
    const sourceLoc = ((c.req.header('Accept-Language') ?? '').toLowerCase().startsWith('en') ? 'en' : 'es') as 'es' | 'en'
    if (o.displayName !== undefined) set('display_name', o.displayName)
    if (o.headline !== undefined) {
      set('headline', o.headline)
      const pair = await translatePair(c.env, sourceLoc, o.headline)
      set('headline_es', pair.es); set('headline_en', pair.en)
    }
    if (o.bio !== undefined) {
      set('bio', o.bio)
      const pair = await translatePair(c.env, sourceLoc, o.bio)
      set('bio_es', pair.es); set('bio_en', pair.en)
    }
    if (o.phone !== undefined) set('phone', o.phone)
    if (o.whatsapp !== undefined) set('whatsapp', o.whatsapp)
    if (o.barrio !== undefined) set('barrio', o.barrio)
    if (o.lat !== undefined) set('lat', o.lat)
    if (o.lng !== undefined) set('lng', o.lng)
    if (o.photo !== undefined) set('photo', o.photo)
    if (sets.length === 0) return c.json({ data: toDto(existing) })
    sets.push('updated_at = ?')
    params.push(Math.floor(Date.now() / 1000))
    params.push(id)
    await c.env.DB.prepare(`UPDATE specialist_profiles SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run()
    const fresh = await c.env.DB.prepare('SELECT * FROM specialist_profiles WHERE id = ?')
      .bind(id)
      .first<SpecialistRow>()
    return c.json({ data: toDto(fresh as SpecialistRow) })
  })
