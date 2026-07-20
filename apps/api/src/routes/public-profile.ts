import { NotFoundError } from '@pya-company/shared'
import { Hono } from 'hono'

interface AppEnv {
  readonly Bindings: Env
}

interface ProfileRow {
  readonly id: string
  readonly user_id: string
  readonly slug: string | null
  readonly display_name: string
  readonly headline_es: string | null
  readonly headline_gn: string | null
  readonly bio_es: string | null
  readonly bio_gn: string | null
  readonly phone: string
  readonly whatsapp: string | null
  readonly barrio: string
  readonly photo: string | null
  readonly cover_url: string | null
  readonly services_json: string | null
  readonly portfolio_json: string | null
  readonly schedule_json: string | null
  readonly verified: number
  readonly cedula_verified: number
  readonly status: string
  readonly created_at: number
  readonly updated_at: number
}

interface BadgeRow {
  readonly code: string
  readonly name_es: string
  readonly description_es: string
  readonly category: string
  readonly rarity: string
  readonly icon_slug: string
  readonly earned_at: number
}

interface ReviewAgg {
  readonly avg: number
  readonly count: number
}

const parseJsonField = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const publicProfileRoutes = new Hono<AppEnv>()
  .get('/p/:slug', async (c) => {
    const slug = c.req.param('slug')
    const profile = await c.env.DB.prepare(
      `SELECT id, user_id, slug, display_name, headline_es, headline_gn,
              bio_es, bio_gn, phone, whatsapp, barrio, photo, cover_url,
              services_json, portfolio_json, schedule_json, verified,
              cedula_verified, status, created_at, updated_at
       FROM specialist_profiles
       WHERE slug = ? AND status = 'active'`,
    ).bind(slug).first<ProfileRow>()
    if (!profile) throw new NotFoundError({ resource: 'profile' })

    const reviewAgg = await c.env.DB.prepare(
      `SELECT COALESCE(AVG(stars), 0) AS avg, COUNT(*) AS count
       FROM reviews
       WHERE ratee_user_id = ? AND role = 'client'`,
    ).bind(profile.user_id).first<ReviewAgg>()

    const badgesResult = await c.env.DB.prepare(
      `SELECT b.code, b.name_es, b.description_es, b.category, b.rarity,
              b.icon_slug, ub.earned_at
       FROM user_badges ub
       JOIN badges_catalog b ON b.code = ub.code
       WHERE ub.user_id = ? AND ub.hidden = 0
       ORDER BY ub.earned_at DESC`,
    ).bind(profile.user_id).all<BadgeRow>()

    const gameState = await c.env.DB.prepare(
      `SELECT tier FROM user_game_state WHERE user_id = ?`,
    ).bind(profile.user_id).first<{ tier: string }>()

    const areasResult = await c.env.DB.prepare(
      `SELECT sa.slug, sa.name, ssa.is_primary
       FROM specialist_service_areas ssa
       JOIN service_areas sa ON sa.slug = ssa.area_slug
       WHERE ssa.specialist_id = ?
       ORDER BY ssa.is_primary DESC, sa.priority ASC`,
    ).bind(profile.id).all<{ slug: string; name: string; is_primary: number }>()

    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=600')
    return c.json({
      data: {
        slug: profile.slug,
        displayName: profile.display_name,
        headline: profile.headline_es ?? '',
        headlineGn: profile.headline_gn,
        bio: profile.bio_es ?? '',
        bioGn: profile.bio_gn,
        barrio: profile.barrio,
        whatsapp: profile.whatsapp,
        phone: profile.phone,
        photo: profile.photo,
        coverUrl: profile.cover_url,
        services: parseJsonField<ReadonlyArray<unknown>>(profile.services_json, []),
        portfolio: parseJsonField<ReadonlyArray<unknown>>(profile.portfolio_json, []),
        schedule: parseJsonField<Record<string, unknown>>(profile.schedule_json, {}),
        verified: profile.verified === 1,
        cedulaVerified: profile.cedula_verified === 1,
        tier: gameState?.tier ?? 'aprendiz',
        ratingAvg: Math.round((reviewAgg?.avg ?? 0) * 10) / 10,
        ratingCount: reviewAgg?.count ?? 0,
        badges: badgesResult.results.map((b) => ({
          code: b.code,
          name: b.name_es,
          description: b.description_es,
          category: b.category,
          rarity: b.rarity,
          iconSlug: b.icon_slug,
          earnedAt: b.earned_at,
        })),
        areas: areasResult.results.map((a) => ({
          slug: a.slug,
          name: a.name,
          isPrimary: a.is_primary === 1,
        })),
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },
    })
  })
