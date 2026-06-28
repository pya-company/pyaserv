import { type DomainError, mapErrorToStatus, passwordlessRoutes, requireAuth } from '@pya-company/auth'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { checkRateLimit } from './rate-limit.ts'
import { analyticsRoutes } from './routes/analytics.ts'
import { devLoginRoutes } from './routes/dev-login.ts'
import { inquiriesRoutes } from './routes/inquiries.ts'
import { listingsRoutes } from './routes/listings.ts'
import { mediaRoutes } from './routes/media.ts'
import { gamificationRoutes } from './routes/gamification.ts'
import { meRoutes } from './routes/me.ts'
import { meExtendedRoutes } from './routes/me-extended.ts'
import { publicProfileRoutes } from './routes/public-profile.ts'
import { quotesClientsRoutes } from './routes/quotes-clients.ts'
import { requestsRoutes } from './routes/requests.ts'
import { reviewsRoutes } from './routes/reviews.ts'
import { specialistsRoutes } from './routes/specialists.ts'

interface AppEnv {
  readonly Bindings: Env
}

const isDomainError = (e: unknown): e is DomainError =>
  typeof e === 'object' && e !== null && '_tag' in e

const app = new Hono<AppEnv>()
  .use('*', (c, next) =>
    cors({
      origin: c.env.SITE_ORIGIN,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
    })(c, next),
  )
  .onError((err, c) => {
    if (isDomainError(err)) {
      const status = mapErrorToStatus(err)
      return c.json(
        {
          error: {
            code: err._tag,
            message: 'message' in err && typeof err.message === 'string' ? err.message : err._tag,
          },
        },
        status as 400 | 401 | 403 | 404 | 409 | 422 | 429,
      )
    }
    console.error('Unhandled', err)
    return c.json({ error: { code: 'Internal', message: 'Unexpected error' } }, 500)
  })
  .get('/health', (c) =>
    c.json({
      ok: true,
      service: 'pyaserv-api',
      env: c.env.ENVIRONMENT,
      ts: Math.floor(Date.now() / 1000),
    }),
  )
  // Anti-spam: cap /api/auth/start at 5/hour/email. We sniff the email out of
  // the JSON body before passing to passwordlessRoutes (which re-reads via
  // c.req.json — Hono caches it, so no double-consume).
  .use('/api/auth/start', async (c, next) => {
    if (c.req.method !== 'POST') return next()
    const body = await c.req.json().catch(() => ({})) as { email?: unknown }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (email) {
      await checkRateLimit(c.env.SESSIONS, {
        bucket: 'auth-start',
        id: email,
        limit: 5,
        windowSec: 60 * 60,
      })
    }
    await next()
  })
  .route('/api/auth', passwordlessRoutes)
  // Header-gated dev login for E2E. Returns 404 when DEV_AUTH_BYPASS_KEY is
  // unset (route invisible from outside), 403 on wrong header, real session
  // when the secret matches.
  .route('/api/dev', devLoginRoutes)
  .get('/v1/me', requireAuth, (c) => {
    const session = c.var.session
    return c.json({ data: { userId: session.userId, roles: session.roles } })
  })
  .route('/v1/specialists', specialistsRoutes)
  .route('/v1', publicProfileRoutes)
  .route('/v1/listings', listingsRoutes)
  .route('/v1/requests', requestsRoutes)
  .route('/v1/inquiries', inquiriesRoutes)
  .route('/v1/me', meRoutes)
  .route('/v1/me', meExtendedRoutes)
  .route('/v1/me', gamificationRoutes)
  .route('/v1/me', quotesClientsRoutes)
  .route('/v1', reviewsRoutes)
  .route('/v1/media', mediaRoutes)
  .route('/v1/analytics', analyticsRoutes)
  .all('*', (c) => c.json({ error: { code: 'NotFound', message: 'Endpoint not yet implemented.' } }, 404))

export default app
