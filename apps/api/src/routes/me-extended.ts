import { requireAuth } from '@pya-company/auth'
import { ForbiddenError, NotFoundError, ValidationError } from '@pya-company/shared'
import { Hono } from 'hono'

interface AppEnv {
  readonly Bindings: Env
}

interface SpecRow {
  readonly id: string
  readonly user_id: string
  readonly slug: string | null
  readonly display_name: string
  readonly cover_url: string | null
  readonly bio_es: string | null
  readonly bio_gn: string | null
  readonly headline_es: string | null
  readonly headline_gn: string | null
  readonly services_json: string | null
  readonly portfolio_json: string | null
  readonly schedule_json: string | null
  readonly lead_filters_json: string | null
  readonly cedula_verified: number
  readonly ruc_number: string | null
  readonly photo: string | null
  readonly barrio: string
  readonly phone: string
  readonly whatsapp: string | null
}

const j = <T>(s: string | null, fb: T): T => {
  if (!s) return fb
  try { return JSON.parse(s) as T } catch { return fb }
}

const slugify = (name: string, id: string): string => {
  const normalized = name.toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
    .replace(/ñ/g, 'n').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const base = normalized || 'profesional'
  return `${base}-${id.slice(0, 6)}`
}

const toDto = (r: SpecRow) => ({
  id: r.id,
  slug: r.slug,
  displayName: r.display_name,
  coverUrl: r.cover_url,
  bio: r.bio_es ?? '',
  bioGn: r.bio_gn,
  headline: r.headline_es ?? '',
  headlineGn: r.headline_gn,
  services: j<unknown[]>(r.services_json, []),
  portfolio: j<unknown[]>(r.portfolio_json, []),
  schedule: j<Record<string, unknown>>(r.schedule_json, {}),
  leadFilters: j<Record<string, unknown>>(r.lead_filters_json, {}),
  cedulaVerified: r.cedula_verified === 1,
  rucNumber: r.ruc_number,
  photo: r.photo,
  barrio: r.barrio,
  phone: r.phone,
  whatsapp: r.whatsapp,
})

export const meExtendedRoutes = new Hono<AppEnv>()
  .get('/profile-extended', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const row = await c.env.DB.prepare(
      `SELECT id, user_id, slug, display_name, cover_url, bio_es, bio_gn,
              headline_es, headline_gn, services_json, portfolio_json,
              schedule_json, lead_filters_json, cedula_verified, ruc_number,
              photo, barrio, phone, whatsapp
       FROM specialist_profiles WHERE user_id = ?`,
    ).bind(userId).first<SpecRow>()
    if (!row) return c.json({ data: null })

    const areas = await c.env.DB.prepare(
      `SELECT area_slug, is_primary FROM specialist_service_areas WHERE specialist_id = ?`,
    ).bind(row.id).all<{ area_slug: string; is_primary: number }>()

    return c.json({
      data: {
        ...toDto(row),
        areas: areas.results.map((a) => ({ slug: a.area_slug, isPrimary: a.is_primary === 1 })),
      },
    })
  })

  .patch('/profile-extended', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

    const existing = await c.env.DB.prepare(
      'SELECT id, slug, display_name FROM specialist_profiles WHERE user_id = ?',
    ).bind(userId).first<{ id: string; slug: string | null; display_name: string }>()
    if (!existing) throw new NotFoundError({ resource: 'profile' })

    const sets: string[] = []
    const params: unknown[] = []
    const set = (col: string, val: unknown): void => { sets.push(`${col} = ?`); params.push(val) }

    if (typeof body.coverUrl === 'string' || body.coverUrl === null) set('cover_url', body.coverUrl)
    if (typeof body.bioGn === 'string' || body.bioGn === null) set('bio_gn', body.bioGn)
    if (typeof body.headlineGn === 'string' || body.headlineGn === null) set('headline_gn', body.headlineGn)
    if (Array.isArray(body.services)) {
      const items = body.services.slice(0, 30)
      set('services_json', JSON.stringify(items))
    }
    if (Array.isArray(body.portfolio)) {
      const items = body.portfolio.slice(0, 24)
      set('portfolio_json', JSON.stringify(items))
    }
    if (body.schedule && typeof body.schedule === 'object') {
      set('schedule_json', JSON.stringify(body.schedule))
    }
    if (body.leadFilters && typeof body.leadFilters === 'object') {
      set('lead_filters_json', JSON.stringify(body.leadFilters))
    }
    if (typeof body.cedulaVerified === 'boolean') set('cedula_verified', body.cedulaVerified ? 1 : 0)
    if (typeof body.rucNumber === 'string' || body.rucNumber === null) set('ruc_number', body.rucNumber)

    if (!existing.slug && typeof body.displayName === 'string') {
      set('slug', slugify(body.displayName || existing.display_name, existing.id))
    } else if (!existing.slug) {
      set('slug', slugify(existing.display_name, existing.id))
    }

    if (sets.length === 0) {
      const row = await c.env.DB.prepare('SELECT * FROM specialist_profiles WHERE id = ?')
        .bind(existing.id).first<SpecRow>()
      return c.json({ data: toDto(row as SpecRow) })
    }
    sets.push('updated_at = ?'); params.push(Math.floor(Date.now() / 1000))
    params.push(existing.id)
    await c.env.DB.prepare(`UPDATE specialist_profiles SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...params).run()

    if (Array.isArray(body.areas)) {
      await c.env.DB.prepare('DELETE FROM specialist_service_areas WHERE specialist_id = ?')
        .bind(existing.id).run()
      const areas = body.areas.slice(0, 8) as { slug: string; isPrimary?: boolean }[]
      for (const a of areas) {
        if (typeof a?.slug !== 'string') continue
        await c.env.DB.prepare(
          'INSERT INTO specialist_service_areas (specialist_id, area_slug, is_primary) VALUES (?, ?, ?)',
        ).bind(existing.id, a.slug, a.isPrimary ? 1 : 0).run()
      }
    }

    const row = await c.env.DB.prepare('SELECT * FROM specialist_profiles WHERE id = ?')
      .bind(existing.id).first<SpecRow>()
    return c.json({ data: toDto(row as SpecRow) })
  })

  .get('/service-areas', async (c) => {
    const result = await c.env.DB.prepare(
      'SELECT slug, name, type, region, priority FROM service_areas ORDER BY region, priority',
    ).all<{ slug: string; name: string; type: string; region: string; priority: number }>()
    c.header('Cache-Control', 'public, max-age=3600')
    return c.json({ data: result.results })
  })

  .get('/tours', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const result = await c.env.DB.prepare(
      'SELECT tour_code, status, completed_at FROM user_tours_completed WHERE user_id = ?',
    ).bind(userId).all<{ tour_code: string; status: string; completed_at: number }>()
    return c.json({
      data: result.results.map((r) => ({ code: r.tour_code, status: r.status, completedAt: r.completed_at })),
    })
  })

  .post('/tours', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const body = await c.req.json().catch(() => ({})) as { code?: unknown; status?: unknown }
    if (typeof body.code !== 'string' || (body.status !== 'completed' && body.status !== 'skipped')) {
      throw new ValidationError({ issues: [{ path: 'code|status', message: 'invalid' }] })
    }
    const now = Math.floor(Date.now() / 1000)
    await c.env.DB.prepare(
      `INSERT INTO user_tours_completed (user_id, tour_code, status, completed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, tour_code) DO UPDATE SET status = excluded.status, completed_at = excluded.completed_at`,
    ).bind(userId, body.code, body.status, now).run()
    return c.json({ data: { ok: true } })
  })
