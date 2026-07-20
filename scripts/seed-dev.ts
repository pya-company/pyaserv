/*
 * Seed the ISOLATED dev backend (pyaserv-api-dev + pyaserv-dev D1) with a rich,
 * realistic specialist account for igor_ganov@yahoo.com, exercising every
 * specialist-side use case through the REAL API (so the seed doubles as an
 * integration smoke of each journey). Unwired bits (collection/tier badges,
 * profile %, 30-day analytics, streak, done-quests) are filled via SQL.
 *
 * Run:  bun scripts/seed-dev.ts
 * Requires: dev-bypass key in scratchpad (written when the dev worker was set up).
 */

const API = process.env.DEV_API_URL ?? 'https://pyaserv-api-dev.igor-ganov.workers.dev'
const BYPASS = (await Bun.file(
  'C:/Users/igor_/AppData/Local/Temp/claude/C--Projects-ParaguayCompany/e111d0a6-723f-48eb-a040-0a862ac0fc72/scratchpad/dev-bypass-key.txt',
).text()).trim()

const SQL_OUT = 'C:/Users/igor_/AppData/Local/Temp/claude/C--Projects-ParaguayCompany/e111d0a6-723f-48eb-a040-0a862ac0fc72/scratchpad/seed-extras.sql'

let step = 0
const ok = (msg: string) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`)
const head = (msg: string) => console.log(`\n\x1b[1m[UC${++step}] ${msg}\x1b[0m`)
const fail = (msg: string, extra?: unknown): never => {
  console.error(`  \x1b[31m✗ ${msg}\x1b[0m`, extra ?? '')
  process.exit(1)
}

interface Session { userId: string; token: string; email: string }

const login = async (email: string): Promise<Session> => {
  const r = await fetch(`${API}/api/dev/login?email=${encodeURIComponent(email)}`, {
    method: 'POST',
    headers: { 'X-Dev-Bypass-Key': BYPASS },
  })
  if (!r.ok) fail(`dev-login ${email} → ${r.status}`, await r.text())
  const b = await r.json() as { data: { userId: string; sessionToken: string } }
  return { userId: b.data.userId, token: b.data.sessionToken, email }
}

const call = async (s: Session, method: string, path: string, body?: unknown) => {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${s.token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await r.text()
  let json: unknown = null
  try { json = text ? JSON.parse(text) : null } catch { /* non-json */ }
  if (!r.ok) fail(`${method} ${path} → ${r.status}`, text.slice(0, 300))
  return (json as { data?: unknown } | null)?.data
}

// ---------------------------------------------------------------- yahoo user
head('Autenticación (dev-bypass, sin email)')
const yahoo = await login('igor_ganov@yahoo.com')
ok(`sesión para ${yahoo.email} · userId=${yahoo.userId}`)

// ------------------------------------------------------------- crear perfil
head('Crear perfil de especialista (POST /v1/specialists)')
const prof = await call(yahoo, 'POST', '/v1/specialists', {
  displayName: 'Igor Ganov',
  headline: 'Electricista matriculado e instalador — trabajos garantizados en Asunción',
  bio: 'Más de 12 años resolviendo instalaciones eléctricas, tableros, aires acondicionados e iluminación en Asunción y Central. Presupuesto sin cargo, materiales de primera y garantía escrita en cada trabajo.',
  phone: '+595 981 555 210',
  whatsapp: '+595 981 555 210',
  barrio: 'Villa Morra',
  lat: -25.293,
  lng: -57.582,
}) as { id: string }
const specialistId = prof.id
ok(`perfil creado · specialistId=${specialistId}`)

// -------------------------------------------- perfil extendido (spec-v1)
head('Perfil extendido: servicios, portfolio, horario, áreas, cédula/RUC, guaraní')
const services = [
  { name: 'Instalación de tomas, llaves y toma-corrientes', priceMin: 80000, priceMax: 150000 },
  { name: 'Tablero eléctrico nuevo con disyuntor', priceMin: 450000, priceMax: 900000 },
  { name: 'Reparación de cortocircuitos y fallas', priceMin: 120000, priceMax: 250000 },
  { name: 'Instalación de aire acondicionado split', priceMin: 250000, priceMax: 400000 },
  { name: 'Iluminación LED y luminarias de techo', priceMin: 90000, priceMax: 180000 },
  { name: 'Revisión eléctrica completa del hogar', priceMin: 150000, priceMax: 150000 },
]
const portfolio = Array.from({ length: 12 }, (_, i) => ({ url: `https://picsum.photos/seed/pyaserv-igor-${i + 1}/480/360` }))
const schedule = {
  weekly: {
    mon: ['08:00-18:00'], tue: ['08:00-18:00'], wed: ['08:00-18:00'],
    thu: ['08:00-18:00'], fri: ['08:00-18:00'], sat: ['08:00-13:00'], sun: [],
  },
}
await call(yahoo, 'PATCH', '/v1/me/profile-extended', {
  services,
  portfolio,
  schedule,
  leadFilters: { categories: ['electrical', 'repair'], minBudgetGs: 100000, barrios: ['villa-morra', 'carmelitas', 'las-mercedes'] },
  cedulaVerified: true,
  rucNumber: '80012345-6',
  headlineGn: 'Electricista — mba\'apo iporãva Asunción-pe',
  bioGn: '12 ary aservíva instalación eléctrica ha aire rehe. Presupuesto reñeñói\'ỹre ha garantía opa mba\'apópe.',
  areas: [
    { slug: 'villa-morra', isPrimary: true },
    { slug: 'carmelitas' }, { slug: 'recoleta' }, { slug: 'las-mercedes' },
    { slug: 'manora' }, { slug: 'mariscal-lopez' },
  ],
})
ok(`${services.length} servicios · ${portfolio.length} fotos portfolio · horario semanal · 6 áreas · cédula+RUC · ES/GN`)

// ------------------------------------------------------------ crear listings
head('Publicar objetivos/listings (POST /v1/listings)')
const listingDefs = [
  { category: 'electrical', title: 'Electricista a domicilio — urgencias y obra', description: 'Instalaciones, reparaciones y mantenimiento eléctrico. Respondo rápido por WhatsApp.', priceFromGs: 120000, priceUnit: 'job' },
  { category: 'electrical', title: 'Instalación de tablero y disyuntor', description: 'Tableros nuevos a norma, con disyuntor diferencial. Garantía escrita.', priceFromGs: 450000, priceUnit: 'job' },
  { category: 'repair', title: 'Instalación y service de aire split', description: 'Colocación, carga de gas y mantenimiento de aires acondicionados.', priceFromGs: 250000, priceUnit: 'job' },
  { category: 'electrical', title: 'Iluminación LED para tu casa', description: 'Cambio a LED, spots, dimmers y luminarias de techo.', priceFromGs: 90000, priceUnit: 'job' },
  { category: 'repair', title: 'Revisión eléctrica de seguridad', description: 'Chequeo completo de la instalación para evitar riesgos.', priceFromGs: 150000, priceUnit: 'hour' },
]
const listings: { id: string }[] = []
for (const def of listingDefs) {
  const l = await call(yahoo, 'POST', '/v1/listings', def) as { id: string }
  listings.push(l)
}
ok(`${listings.length} listings publicados`)

// -------------------------------------------------------------- clientes
head('Clientes (usuarios separados) que contactan al especialista')
const clientDefs = [
  { email: 'carlos.rojas.demo@e2e.invalid', name: 'Carlos Rojas' },
  { email: 'maria.fernandez.demo@e2e.invalid', name: 'María Fernández' },
  { email: 'jose.benitez.demo@e2e.invalid', name: 'José Benítez' },
  { email: 'lucia.melgarejo.demo@e2e.invalid', name: 'Lucía Melgarejo' },
  { email: 'diego.caceres.demo@e2e.invalid', name: 'Diego Cáceres' },
  { email: 'andrea.villalba.demo@e2e.invalid', name: 'Andrea Villalba' },
]
const clients: (Session & { name: string })[] = []
for (const cd of clientDefs) {
  const s = await login(cd.email)
  clients.push({ ...s, name: cd.name })
}
ok(`${clients.length} clientes autenticados`)

// ------------------------------------ inquiries + mensajes + pipeline + reviews
// job scenarios: 12 completos con reseña, 2 negociando, 1 en curso, 1 cancelado.
type Scenario = { client: number; listing: number; state: 'done' | 'negotiating' | 'in_progress' | 'cancelled'; stars?: number; review?: string; msg: string; reply: string; yahooReview?: string }
const scenarios: Scenario[] = [
  { client: 0, listing: 0, state: 'done', stars: 5, review: 'Vino el mismo día y dejó todo funcionando. Muy recomendable.', msg: 'Hola! Se me quemó una llave térmica, podés venir?', reply: 'Buenas Carlos, sí, hoy a la tarde estoy por Villa Morra. Te paso a revisar.', yahooReview: 'Cliente puntual y claro con lo que necesitaba. Un gusto.' },
  { client: 0, listing: 3, state: 'done', stars: 5, review: 'Cambió toda la casa a LED, quedó impecable.', msg: 'Quiero pasar todo a LED, me pasás presupuesto?', reply: 'Claro, te hago el presupuesto por ambiente. ¿Cuántas luminarias son?' },
  { client: 1, listing: 2, state: 'done', stars: 5, review: 'Instaló el aire perfecto y muy prolijo. Gracias!', msg: 'Necesito instalar un split de 12000 BTU.', reply: 'Perfecto María, incluyo soporte y carga de gas. ¿Qué día te queda bien?', yahooReview: 'Todo coordinado por WhatsApp, excelente comunicación.' },
  { client: 1, listing: 1, state: 'done', stars: 4, review: 'Buen trabajo con el tablero, tardó un poco más de lo hablado.', msg: 'El tablero es viejo y salta seguido, se puede renovar?', reply: 'Sí, conviene tablero nuevo con disyuntor. Te llevo los materiales.' },
  { client: 2, listing: 0, state: 'done', stars: 5, review: 'Resolvió un cortocircuito que nadie encontraba. Crack.', msg: 'Tengo un cortocircuito y se corta la luz de media casa.', reply: 'Lo rastreo con el tester, seguro es una caja de conexión. Voy mañana.' },
  { client: 2, listing: 4, state: 'done', stars: 5, review: 'Revisión completa y me explicó todo. Tranquilo ahora.', msg: 'Compré la casa y quiero una revisión eléctrica completa.', reply: 'Buenísimo, hago un informe con fotos de lo que hay que corregir.' },
  { client: 3, listing: 2, state: 'done', stars: 5, review: 'Segundo aire que me instala, siempre impecable.', msg: 'Otro split más para el dormitorio, te animás?', reply: 'Dale Lucía, mismo precio que la vez pasada.' },
  { client: 3, listing: 3, state: 'done', stars: 3, review: 'Trabajo correcto pero llegó tarde el primer día.', msg: 'Quiero spots en el living.', reply: 'Te propongo 6 spots dimerizables. ¿Te sirve?' },
  { client: 4, listing: 0, state: 'done', stars: 5, review: 'Rápido, honesto y limpio. Lo voy a volver a llamar.', msg: 'Se me cayó una toma de la pared, urgente.', reply: 'Tranquilo Diego, eso lo dejo listo en una hora.', yahooReview: 'Pago al día y muy amable.' },
  { client: 4, listing: 1, state: 'done', stars: 5, review: 'Tablero nuevo a norma, quedé muy conforme.', msg: 'Me pediste renovar el tablero de la oficina.', reply: 'Sí, te dejo todo etiquetado y con garantía.' },
  { client: 5, listing: 2, state: 'done', stars: 5, review: 'Instalación de aire perfecta y a tiempo.', msg: 'Split para la oficina, factura con RUC posible?', reply: 'Sí Andrea, emito factura. Coordinamos el día.' },
  { client: 5, listing: 4, state: 'done', stars: 4, review: 'Buena revisión, recomendaciones útiles.', msg: 'Revisión de seguridad para alquilar el depto.', reply: 'Hago el informe para que se lo pases al inquilino.' },
  // en curso / negociando / cancelado
  { client: 0, listing: 2, state: 'in_progress', msg: 'Un aire más para la pieza de mi hijo.', reply: 'Ya lo tengo agendado, esta semana lo instalo.' },
  { client: 1, listing: 4, state: 'negotiating', msg: 'Cuánto sale la revisión completa?', reply: 'Depende del tamaño, ¿cuántos ambientes tiene?' },
  { client: 3, listing: 0, state: 'negotiating', msg: 'Tenés disponibilidad el finde?', reply: 'El sábado a la mañana puedo, ¿te sirve?' },
  { client: 2, listing: 1, state: 'cancelled', msg: 'Quería renovar el tablero pero...', reply: 'Sin problema, cuando quieras retomamos.' },
]

let doneCount = 0
const doneInquiryIds: string[] = []
for (const sc of scenarios) {
  const client = clients[sc.client]
  const listing = listings[sc.listing]
  // client opens the inquiry (first message) on a listing
  const inq = await call(client, 'POST', '/v1/inquiries', {
    subjectType: 'listing', subjectId: listing.id, body: sc.msg,
  }) as { id: string }
  // specialist replies (grants lead-response XP + streak)
  await call(yahoo, 'POST', `/v1/inquiries/${inq.id}/messages`, { body: sc.reply })
  if (sc.state === 'negotiating') continue
  if (sc.state === 'cancelled') {
    await call(yahoo, 'PATCH', `/v1/inquiries/${inq.id}/status`, { action: 'cancel' })
    continue
  }
  // start work
  await call(yahoo, 'PATCH', `/v1/inquiries/${inq.id}/status`, { action: 'start' })
  if (sc.state === 'in_progress') continue
  // both confirm done
  await call(client, 'PATCH', `/v1/inquiries/${inq.id}/status`, { action: 'confirm_done' })
  await call(yahoo, 'PATCH', `/v1/inquiries/${inq.id}/status`, { action: 'confirm_done' })
  // client review (public rating), grants ratee XP + badges
  await call(client, 'POST', `/v1/inquiries/${inq.id}/reviews`, { stars: sc.stars, body: sc.review })
  // some specialist→client reviews
  if (sc.yahooReview) await call(yahoo, 'POST', `/v1/inquiries/${inq.id}/reviews`, { stars: 5, body: sc.yahooReview })
  doneCount++
  doneInquiryIds.push(inq.id)
}
ok(`${scenarios.length} conversaciones: ${doneCount} trabajos completados con reseña, 1 en curso, 2 negociando, 1 cancelado`)

// -------------------------------------------------------- quotes + templates
head('Cotizaciones y plantillas (POST /v1/me/quote-templates, /v1/me/quotes)')
await call(yahoo, 'POST', '/v1/me/quote-templates', {
  oficio: 'electrical', title: 'Instalación de aire split', is_default: true,
  items: [
    { name: 'Aire split 12000 BTU', qty: 1, unitPrice: 2200000 },
    { name: 'Mano de obra instalación', qty: 1, unitPrice: 350000 },
    { name: 'Caño y soporte', qty: 1, unitPrice: 120000 },
  ],
})
await call(yahoo, 'POST', '/v1/me/quote-templates', {
  oficio: 'electrical', title: 'Tablero nuevo',
  items: [
    { name: 'Tablero + disyuntor', qty: 1, unitPrice: 650000 },
    { name: 'Mano de obra', qty: 1, unitPrice: 300000 },
  ],
})
const quoteDefs = [
  { clientName: 'Carlos Rojas', clientPhone: '+595 981 111 222', ivaIncluded: true, items: [{ name: 'Cambio de llave térmica', qty: 1, unitPrice: 180000 }, { name: 'Mano de obra', qty: 1, unitPrice: 120000 }] },
  { clientName: 'María Fernández', clientPhone: '+595 982 333 444', ivaIncluded: true, items: [{ name: 'Aire split 12000 BTU', qty: 1, unitPrice: 2200000 }, { name: 'Instalación', qty: 1, unitPrice: 350000 }] },
  { clientName: 'Diego Cáceres', clientPhone: '+595 983 555 666', ivaIncluded: false, items: [{ name: 'Tablero + disyuntor', qty: 1, unitPrice: 650000 }, { name: 'Mano de obra', qty: 1, unitPrice: 300000 }] },
]
for (const q of quoteDefs) {
  const created = await call(yahoo, 'POST', '/v1/me/quotes', q) as { id: string }
  await call(yahoo, 'POST', `/v1/me/quotes/${created.id}/sent`, undefined)
}
ok(`2 plantillas + ${quoteDefs.length} cotizaciones enviadas`)

// ------------------------------------------------- estado actual (verificación)
head('Verificación del estado del especialista tras los flujos')
const gs = await call(yahoo, 'GET', '/v1/me/game-state') as { xp: number; tier: string }
const revs = await call(yahoo, 'GET', `/v1/specialists/${specialistId}/reviews`).catch(() => null) as { avg?: number; count?: number } | null
ok(`XP=${gs.xp} · tier=${gs.tier}` + (revs ? ` · rating=${revs.avg ?? '?'} (${revs.count ?? '?'})` : ''))

// ------------------------------------------------------------ SQL extras
// Fill what no wired endpoint sets: nice client names, verified flag,
// collection/tier badges, profile 100%, streak, 30-day analytics, done quests.
head('SQL extras (bejes de colección/tier, perfil 100%, streak, analítica 30 días)')
const now = Math.floor(Date.now() / 1000)
const day = 86400
const esc = (s: string) => s.replace(/'/g, "''")
const lines: string[] = []

// nice client display names
for (const c of clients) {
  lines.push(`UPDATE users SET display_name='${esc(c.name)}', email_verified=1 WHERE id='${c.userId}';`)
}
// verified specialist
lines.push(`UPDATE specialist_profiles SET verified=1 WHERE id='${specialistId}';`)

// game state: 100% profile, healthy streak (keep xp/tier from real hooks)
lines.push(`UPDATE user_game_state SET profile_complete_pct=100, streak_current=14, streak_best=27, streak_last_active_date=date('now') WHERE user_id='${yahoo.userId}';`)

// collection + tier badges not granted by any hook
const badges = ['tier_aprendiz', 'tier_oficial', 'tier_maestro', 'perfil_maestro', 'multilingue', 'constructor', 'verificado_completo']
for (const code of badges) {
  lines.push(`INSERT OR IGNORE INTO user_badges (user_id, code, earned_at, hidden) VALUES ('${yahoo.userId}', '${code}', ${now - 20 * day}, 0);`)
}

// backfill some historical xp_events for a fuller timeline (daily logins over 3 weeks)
for (let d = 21; d >= 1; d--) {
  if (d % 3 === 0) continue
  lines.push(`INSERT INTO xp_events (id, user_id, type, xp, ctx_json, at) VALUES ('${crypto.randomUUID()}', '${yahoo.userId}', 'daily_login', 1, '{}', ${now - d * day});`)
}

// 30-day analytics: profile views + phone/whatsapp clicks (subject = profile id)
let views = 0
for (let d = 29; d >= 0; d--) {
  const n = 3 + ((d * 7) % 9) // 3..11 views/day, deterministic
  views += n
  for (let k = 0; k < n; k++) {
    lines.push(`INSERT INTO analytics_events (id, user_id, event, subject_id, ts) VALUES ('${crypto.randomUUID()}', NULL, 'profile_view', '${specialistId}', ${now - d * day - k * 900});`)
  }
  if (d % 2 === 0) lines.push(`INSERT INTO analytics_events (id, user_id, event, subject_id, ts) VALUES ('${crypto.randomUUID()}', NULL, 'whatsapp_click', '${specialistId}', ${now - d * day - 300});`)
  if (d % 3 === 0) lines.push(`INSERT INTO analytics_events (id, user_id, event, subject_id, ts) VALUES ('${crypto.randomUUID()}', NULL, 'phone_click', '${specialistId}', ${now - d * day - 600});`)
}

// mark completed onboarding tours
for (const t of ['T1', 'T2', 'T3']) {
  lines.push(`INSERT OR IGNORE INTO user_tours_completed (user_id, tour_code, status, completed_at) VALUES ('${yahoo.userId}', '${t}', 'completed', ${now - 15 * day});`)
}

await Bun.write(SQL_OUT, lines.join('\n') + '\n')
ok(`SQL extras escritos (${lines.length} sentencias, ~${views} vistas de perfil) → aplicar con wrangler`)

console.log(`\n\x1b[1mIDs:\x1b[0m yahooUser=${yahoo.userId} specialist=${specialistId}`)
console.log(`\x1b[1mSQL:\x1b[0m ${SQL_OUT}`)
console.log('\n\x1b[32m\x1b[1mSeed API-flows OK.\x1b[0m Ahora aplicar seed-extras.sql a pyaserv-dev.')
