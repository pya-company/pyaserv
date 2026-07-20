/*
 * End-to-end specialist journey against the ISOLATED dev API. Each `it` maps to
 * a use-case row in docs/dev-usecases.md and asserts the real API response, so
 * this suite is the executable spec for the specialist side.
 *
 * Run:  PYASERV_DEV_BYPASS_KEY=<key> bun test apps/api/test/specialist-journey.test.ts
 * (optionally DEV_API_URL=... to point at another deployment)
 *
 * Uses a fresh, uniquely-named specialist + client each run, so it is repeatable
 * and never collides with the seeded igor_ganov@yahoo.com account.
 */
import { beforeAll, describe, expect, it } from 'bun:test'

const API = process.env.DEV_API_URL ?? 'https://pyaserv-api-dev.igor-ganov.workers.dev'
const KEY = process.env.PYASERV_DEV_BYPASS_KEY ?? ''
const run = KEY ? describe : describe.skip
const stamp = Date.now()

interface Session { userId: string; token: string }

const login = async (email: string): Promise<Session> => {
  const r = await fetch(`${API}/api/dev/login?email=${encodeURIComponent(email)}`, {
    method: 'POST', headers: { 'X-Dev-Bypass-Key': KEY },
  })
  expect(r.status).toBe(200)
  const b = await r.json() as { data: { userId: string; sessionToken: string } }
  return { userId: b.data.userId, token: b.data.sessionToken }
}

const api = async (token: string | null, method: string, path: string, body?: unknown) => {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await r.text()
  const json = text ? JSON.parse(text) : null
  return { status: r.status, data: (json as { data?: unknown } | null)?.data, raw: json }
}

run('specialist journey (dev API)', () => {
  let spec: Session
  let client: Session
  let specialistId: string
  let listingId: string
  let inquiryId: string

  beforeAll(async () => {
    spec = await login(`e2e-spec-${stamp}@e2e.invalid`)
    client = await login(`e2e-client-${stamp}@e2e.invalid`)
  })

  // UC1
  it('UC1 dev-login issues a session', () => {
    expect(spec.userId).toBeTruthy()
    expect(spec.token.length).toBeGreaterThan(10)
  })

  // UC2
  it('UC2 creates a specialist profile', async () => {
    const res = await api(spec.token, 'POST', '/v1/specialists', {
      displayName: `E2E Especialista ${stamp}`,
      headline: 'Electricista de prueba',
      bio: 'Perfil generado por el test de journey.',
      phone: '+595 981 000 000',
      whatsapp: '+595 981 000 000',
      barrio: 'Villa Morra',
    })
    expect([200, 201]).toContain(res.status)
    specialistId = (res.data as { id: string }).id
    expect(specialistId).toBeTruthy()
  })

  // UC3
  it('UC3 edits the basic profile', async () => {
    const res = await api(spec.token, 'PATCH', `/v1/specialists/${specialistId}`, {
      whatsapp: '+595 985 111 222',
    })
    expect(res.status).toBe(200)
  })

  // UC4/5/6/8/9/10
  it('UC4-10 sets extended profile (services, portfolio, schedule, areas, GN, cédula)', async () => {
    const patch = await api(spec.token, 'PATCH', '/v1/me/profile-extended', {
      services: [{ name: 'Instalación eléctrica', priceMin: 100000, priceMax: 200000 }],
      portfolio: Array.from({ length: 11 }, (_, i) => ({ url: `https://picsum.photos/seed/e2e-${stamp}-${i}/400/300` })),
      schedule: { weekly: { mon: ['08:00-18:00'], sat: ['08:00-13:00'], sun: [] } },
      leadFilters: { categories: ['electrical'], minBudgetGs: 100000 },
      areas: [{ slug: 'villa-morra', isPrimary: true }, { slug: 'carmelitas' }],
      cedulaVerified: true,
      rucNumber: '80099999-9',
      headlineGn: 'Electricista',
      bioGn: 'Aservíva instalación eléctrica rehe.',
    })
    expect(patch.status).toBe(200)

    const got = await api(spec.token, 'GET', '/v1/me/profile-extended')
    const d = got.data as { services: unknown[]; portfolio: unknown[]; cedulaVerified: boolean; areas: unknown[] }
    expect(d.services.length).toBe(1)
    expect(d.portfolio.length).toBe(11)
    expect(d.cedulaVerified).toBe(true)
    expect(d.areas.length).toBe(2)
  })

  it('UC8 service-areas catalog is available', async () => {
    const res = await api(spec.token, 'GET', '/v1/me/service-areas')
    expect(res.status).toBe(200)
    expect((res.data as unknown[]).length).toBeGreaterThanOrEqual(40)
  })

  // UC12
  it('UC12 publishes a service listing', async () => {
    const res = await api(spec.token, 'POST', '/v1/listings', {
      category: 'electrical', title: 'Electricista a domicilio (e2e)',
      description: 'Servicio de prueba', priceFromGs: 120000, priceUnit: 'job',
    })
    expect([200, 201]).toContain(res.status)
    listingId = (res.data as { id: string }).id
    expect(listingId).toBeTruthy()
  })

  // UC13
  it('UC13 the specialist appears in search', async () => {
    const res = await api(null, 'GET', '/v1/specialists')
    const list = res.data as { id: string }[]
    expect(list.some((s) => s.id === specialistId)).toBe(true)
  })

  // UC14
  it('UC14 a client opens an inquiry and the specialist replies', async () => {
    const inq = await api(client.token, 'POST', '/v1/inquiries', {
      subjectType: 'listing', subjectId: listingId, body: 'Hola, necesito una instalación.',
    })
    expect([200, 201]).toContain(inq.status)
    inquiryId = (inq.data as { id: string }).id
    const reply = await api(spec.token, 'POST', `/v1/inquiries/${inquiryId}/messages`, {
      body: 'Claro, coordinemos.',
    })
    expect([200, 201]).toContain(reply.status)
  })

  // UC15
  it('UC15 the work pipeline reaches done when both confirm', async () => {
    expect((await api(spec.token, 'PATCH', `/v1/inquiries/${inquiryId}/status`, { action: 'start' })).status).toBe(200)
    expect((await api(client.token, 'PATCH', `/v1/inquiries/${inquiryId}/status`, { action: 'confirm_done' })).status).toBe(200)
    const done = await api(spec.token, 'PATCH', `/v1/inquiries/${inquiryId}/status`, { action: 'confirm_done' })
    expect(done.status).toBe(200)
    const thread = await api(spec.token, 'GET', `/v1/inquiries/${inquiryId}`)
    expect((thread.data as { inquiry: { workStatus: string } }).inquiry.workStatus).toBe('done')
  })

  // UC16
  it('UC16 the client leaves a 5★ review that shows on the public rating', async () => {
    const rev = await api(client.token, 'POST', `/v1/inquiries/${inquiryId}/reviews`, {
      stars: 5, body: 'Excelente trabajo.',
    })
    expect([200, 201]).toContain(rev.status)
    const pub = await api(null, 'GET', `/v1/specialists/${specialistId}/reviews`)
    const d = pub.data as { count?: number; avg?: number }
    expect((d.count ?? 0)).toBeGreaterThanOrEqual(1)
  })

  // UC18/19
  it('UC18-19 completing a job grants XP and the first-job badge', async () => {
    const gs = await api(spec.token, 'GET', '/v1/me/game-state')
    expect((gs.data as { xp: number }).xp).toBeGreaterThan(0)
    const badges = await api(spec.token, 'GET', '/v1/me/badges')
    const earned = (badges.data as { code: string; earned: boolean }[]).filter((b) => b.earned).map((b) => b.code)
    expect(earned).toContain('milestone_first_job')
  })

  // UC22
  it('UC22 builds a quote with IVA computed', async () => {
    const q = await api(spec.token, 'POST', '/v1/me/quotes', {
      clientName: 'Cliente E2E', clientPhone: '+595 981 222 333', ivaIncluded: true,
      items: [{ name: 'Servicio', qty: 2, unitPrice: 100000 }],
    })
    expect([200, 201]).toContain(q.status)
    const d = q.data as { subtotalGs?: number; ivaGs?: number; totalGs?: number; subtotal?: number; total?: number }
    const subtotal = d.subtotalGs ?? d.subtotal
    const total = d.totalGs ?? d.total
    expect(subtotal).toBe(200000)
    expect(total).toBe(220000) // +10% IVA
  })

  // UC23
  it('UC23 the completed job created a CRM client record', async () => {
    const res = await api(spec.token, 'GET', '/v1/me/clients')
    expect((res.data as unknown[]).length).toBeGreaterThanOrEqual(1)
  })

  // UC24
  it('UC24 the analytics dashboard returns a funnel', async () => {
    const res = await api(spec.token, 'GET', '/v1/analytics/me')
    const d = res.data as { funnel?: { inquiries: number; completed: number } }
    expect(d.funnel?.completed).toBeGreaterThanOrEqual(1)
  })

  // UC25
  it('UC25 reads and updates notification preferences', async () => {
    const get = await api(spec.token, 'GET', '/v1/me/notifications')
    expect(get.status).toBe(200)
    const patch = await api(spec.token, 'PATCH', '/v1/me/notifications', { emailNotifications: false })
    expect(patch.status).toBe(200)
  })
})
