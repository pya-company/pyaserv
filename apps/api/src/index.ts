import { Hono } from 'hono'

// PyaServ API — placeholder Worker.
//
// Phase 6 (refactor pyaeats-app) verifies that `@pya/auth` works in production
// against PyaEats first. Once that's green, this Worker mounts:
//
//   import { passwordlessRoutes, oauthRoutes, requireAuth } from '@pya/auth'
//   app.route('/api/auth', passwordlessRoutes)
//   app.route('/api/auth', oauthRoutes)
//   app.use('/v1/*', requireAuth)
//
// Until then we serve only a health probe so the Worker can be deployed,
// custom domain bound, and DNS verified independent of the engine cutover.

interface Env {
  readonly ENVIRONMENT: 'development' | 'preview' | 'staging' | 'production'
  readonly SITE_ORIGIN: string
  readonly API_ORIGIN: string
}

const app = new Hono<{ Bindings: Env }>()

app.get('/health', (c) => c.json({
  ok: true,
  service: 'pyaserv-api',
  env: c.env.ENVIRONMENT,
  ts: Math.floor(Date.now() / 1000),
}))

app.get('/', (c) => c.text(
  'PyaServ API — placeholder Worker.\n' +
  'See https://github.com/undeadliner/pyaserv for the source and roadmap.\n',
))

app.all('*', (c) => c.json({
  error: { code: 'NotFound', message: 'Endpoint not yet implemented.' },
}, 404))

export default app
