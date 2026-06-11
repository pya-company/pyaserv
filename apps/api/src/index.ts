import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { passwordlessRoutes, requireAuth, mapErrorToStatus, type DomainError } from '@undeadliner/pya-auth'

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
    })(c, next)
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
  .get('/health', (c) => c.json({
    ok: true,
    service: 'pyaserv-api',
    env: c.env.ENVIRONMENT,
    ts: Math.floor(Date.now() / 1000),
  }))
  .route('/api/auth', passwordlessRoutes)
  .get('/v1/me', requireAuth, (c) => {
    const session = c.var.session
    return c.json({ data: { userId: session.userId, roles: session.roles } })
  })
  .all('*', (c) => c.json({ error: { code: 'NotFound', message: 'Endpoint not yet implemented.' } }, 404))

export default app
