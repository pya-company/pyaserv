/*
 * Demo Mode v2 — apiFetch interception layer.
 *
 * Когда URL содержит ?demo=1 (или sessionStorage.demoMode = '1'),
 * apiFetch вызывает demoStub(path, init) перед реальным fetch.
 * Если stub возвращает не null — это используется как ответ.
 * Если null — fall-through к реальному fetch (read-only ОК для
 * публичных endpoints типа /v1/p/:slug).
 *
 * Все writes (POST/PATCH/DELETE) перехватываются ВСЕГДА когда demo=1:
 * либо возвращаем optimistic success, либо ловим в sessionStorage.
 */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/* Demo Mode is URL-only — `?demo=1` query param.
 * Никакого sessionStorage-persistence: пользователь выходит из demo
 * простой навигацией на URL без `?demo=1`. Это решает баг "banner stuck".
 * Stripe test-mode-style sticky NOT нужен — пользователю проще понять
 * "demo живёт пока URL содержит ?demo".
 */
export const isDemoMode = (): boolean => {
  if (typeof location === 'undefined') return false
  try {
    return new URLSearchParams(location.search).has('demo')
  } catch { return false }
}

export const exitDemoMode = (): void => {
  // Clear any leftover sessionStorage from older versions
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith('pyaserv.demo.')) keys.push(k)
    }
    keys.forEach((k) => sessionStorage.removeItem(k))
  } catch {}
  delete document.documentElement.dataset.demoMode
}

/* ----------- canned data ----------- */

const DEMO_PROFILE = {
  id: 'demo-juan-perez',
  userId: 'demo-user',
  slug: 'juan-perez-demo',
  displayName: 'Demo: Juan Pérez',
  coverUrl: null,
  bio: 'Plomero matriculado con 10 años de experiencia en Villa Morra y barrios cercanos. Trabajo con todas las marcas de calentadores y grifería. Atención rápida en emergencias.',
  bioGn: null,
  headline: 'Plomero matriculado · Atención rápida',
  headlineGn: null,
  services: [
    { name: 'Destape de cañería', priceMin: 80000, priceMax: 150000, currency: 'PYG' },
    { name: 'Cambio de calentador', priceMin: 250000, priceMax: 600000, currency: 'PYG' },
    { name: 'Instalación de grifería', priceMin: 120000, currency: 'PYG' },
  ],
  portfolio: [
    { url: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=400', caption: 'Cambio de calentador' },
    { url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400', caption: 'Instalación nueva' },
    { url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400', caption: 'Reparación urgente' },
  ],
  schedule: { weekly: { mon: ['08:00-18:00'], tue: ['08:00-18:00'], wed: ['08:00-18:00'], thu: ['08:00-18:00'], fri: ['08:00-18:00'], sat: ['09:00-13:00'] } },
  leadFilters: { minBudget: 50000, hideNewAccounts: true },
  cedulaVerified: true,
  rucNumber: null,
  photo: null,
  barrio: 'Villa Morra',
  phone: '+595 000 0000000',
  whatsapp: '+595 000 0000000',
  verified: true,
  areas: [
    { slug: 'villa-morra', name: 'Villa Morra', isPrimary: true },
    { slug: 'carmelitas', name: 'Carmelitas', isPrimary: false },
    { slug: 'recoleta', name: 'Recoleta', isPrimary: false },
    { slug: 'las-mercedes', name: 'Las Mercedes', isPrimary: false },
    { slug: 'mariscal-lopez', name: 'Mariscal López', isPrimary: false },
  ],
}

const DEMO_GAME_STATE = {
  xp: 1247,
  tier: 'maestro',
  nextTier: { tier: 'maestro_mayor', xp: 2000, remaining: 753 },
  profileCompletePct: 80,
  streak: { current: 14, best: 23, lastActiveDate: '2026-06-25', freezesUsedThisMonth: 1, pausedUntil: null },
}

const DEMO_BADGES = [
  { code: 'tier_maestro', name: { es: 'Maestro', en: 'Master', gn: null }, description: { es: 'Acumulaste 500 XP.', en: '500 XP earned.', gn: null }, category: 'tier', rarity: 'rare', iconSlug: 'tier-maestro', earned: true, earnedAt: 1782000000, hidden: false },
  { code: 'milestone_10_jobs', name: { es: '10 trabajos', en: '10 jobs', gn: null }, description: { es: 'Diez trabajos completados.', en: 'Ten jobs done.', gn: null }, category: 'milestone', rarity: 'common', iconSlug: 'milestone-10-jobs', earned: true, earnedAt: 1782100000, hidden: false },
  { code: 'velocista_mes', name: { es: 'Velocista del mes', en: 'Speedster', gn: null }, description: { es: 'Top 10% por tiempo de respuesta.', en: 'Top 10% response time.', gn: null }, category: 'superlative', rarity: 'rare', iconSlug: 'velocista', earned: true, earnedAt: 1782200000, hidden: false },
  { code: 'estrella_barrio', name: { es: 'Estrella de Villa Morra', en: 'Neighborhood star', gn: null }, description: { es: 'Top 3 por reseñas.', en: 'Top 3 by reviews.', gn: null }, category: 'superlative', rarity: 'epic', iconSlug: 'estrella-barrio', earned: true, earnedAt: 1782300000, hidden: false },
  { code: 'constructor', name: { es: 'Constructor', en: 'Builder', gn: null }, description: { es: '10+ fotos de trabajos.', en: '10+ portfolio photos.', gn: null }, category: 'collection', rarity: 'common', iconSlug: 'constructor', earned: true, earnedAt: 1782400000, hidden: false },
  { code: 'verificado_completo', name: { es: 'Verificado completo', en: 'Fully verified', gn: null }, description: { es: 'WhatsApp + Cédula.', en: 'WhatsApp + Cédula.', gn: null }, category: 'collection', rarity: 'epic', iconSlug: 'verificado-completo', earned: true, earnedAt: 1782500000, hidden: false },
  { code: 'tier_aprendiz', name: { es: 'Aprendiz', en: 'Apprentice', gn: 'Aprendiz' }, description: { es: 'Iniciaste tu camino.', en: 'Started your journey.', gn: '' }, category: 'tier', rarity: 'common', iconSlug: 'tier-aprendiz', earned: true, earnedAt: 1781000000, hidden: false },
  { code: 'tier_oficial', name: { es: 'Oficial', en: 'Journeyman', gn: null }, description: { es: '100 XP.', en: '100 XP.', gn: null }, category: 'tier', rarity: 'common', iconSlug: 'tier-oficial', earned: true, earnedAt: 1781500000, hidden: false },
  { code: 'tier_maestro_mayor', name: { es: 'Maestro Mayor', en: 'Grand Master', gn: null }, description: { es: '2000 XP.', en: '2000 XP.', gn: null }, category: 'tier', rarity: 'epic', iconSlug: 'tier-maestro-mayor', earned: false, earnedAt: null, hidden: false },
  { code: 'tier_patron', name: { es: 'Patrón del Oficio', en: 'Patron', gn: null }, description: { es: '5000 XP.', en: '5000 XP.', gn: null }, category: 'tier', rarity: 'legendary', iconSlug: 'tier-patron', earned: false, earnedAt: null, hidden: false },
  { code: 'milestone_first_job', name: { es: 'Primer trabajo', en: 'First job', gn: null }, description: { es: 'Completaste el primero.', en: 'You did the first one.', gn: null }, category: 'milestone', rarity: 'common', iconSlug: 'milestone-first-job', earned: true, earnedAt: 1781100000, hidden: false },
  { code: 'milestone_50_jobs', name: { es: '50 trabajos', en: '50 jobs', gn: null }, description: { es: 'Veterano.', en: 'Veteran.', gn: null }, category: 'milestone', rarity: 'rare', iconSlug: 'milestone-50-jobs', earned: false, earnedAt: null, hidden: false },
  { code: 'milestone_100_jobs', name: { es: '100 trabajos', en: '100 jobs', gn: null }, description: { es: 'Maestro veterano.', en: 'Veteran master.', gn: null }, category: 'milestone', rarity: 'epic', iconSlug: 'milestone-100-jobs', earned: false, earnedAt: null, hidden: false },
  { code: 'milestone_first_5star', name: { es: 'Primer 5★', en: 'First 5★', gn: null }, description: { es: 'Primera reseña perfecta.', en: 'First perfect review.', gn: null }, category: 'milestone', rarity: 'common', iconSlug: 'milestone-first-5star', earned: true, earnedAt: 1781200000, hidden: false },
  { code: 'maestro_de_barrio', name: { es: 'Maestro del barrio', en: 'Master of the hood', gn: null }, description: { es: '#1 del barrio.', en: '#1 of the area.', gn: null }, category: 'superlative', rarity: 'legendary', iconSlug: 'maestro-de-barrio', earned: false, earnedAt: null, hidden: false },
  { code: 'perfil_maestro', name: { es: 'Perfil Maestro', en: 'Master Profile', gn: null }, description: { es: 'Perfil al 100%.', en: '100% profile.', gn: null }, category: 'collection', rarity: 'common', iconSlug: 'perfil-maestro', earned: false, earnedAt: null, hidden: false },
  { code: 'multilingue', name: { es: 'Multilingüe', en: 'Multilingual', gn: null }, description: { es: 'ES + GN.', en: 'ES + GN.', gn: null }, category: 'collection', rarity: 'rare', iconSlug: 'multilingue', earned: false, earnedAt: null, hidden: false },
  { code: 'equipo', name: { es: 'Equipo', en: 'Squad', gn: null }, description: { es: '3 colegas.', en: '3 colleagues.', gn: null }, category: 'collection', rarity: 'rare', iconSlug: 'equipo', earned: false, earnedAt: null, hidden: false },
]

const DEMO_QUESTS = [
  { id: 'q1', type: 'daily', templateCode: 'respond_1_lead', title: 'Respondé 1 lead', goal: { count: 1 }, progress: { current: 1 }, status: 'done', rewardXp: 10, rewardBoostH: 1, startedAt: 1782350000, expiresAt: 1782450000, completedAt: 1782370000 },
  { id: 'q2', type: 'daily', templateCode: 'share_profile', title: 'Compartí tu perfil en WhatsApp', goal: { count: 1 }, progress: { current: 0 }, status: 'active', rewardXp: 10, rewardBoostH: 1, startedAt: 1782350000, expiresAt: 1782450000, completedAt: null },
  { id: 'q3', type: 'daily', templateCode: 'add_portfolio_photo', title: 'Agregá 1 foto al portfolio', goal: { count: 1 }, progress: { current: 0 }, status: 'active', rewardXp: 10, rewardBoostH: 1, startedAt: 1782350000, expiresAt: 1782450000, completedAt: null },
  { id: 'q4', type: 'weekly', templateCode: 'get_3_reviews', title: 'Conseguí 3 reseñas esta semana', goal: { count: 3 }, progress: { current: 1 }, status: 'active', rewardXp: 50, rewardBoostH: 24, startedAt: 1782200000, expiresAt: 1782800000, completedAt: null },
]

const DEMO_TOURS = [{ code: 'T1', status: 'completed', completedAt: 1782300000 }]

const DEMO_AREAS = [
  { slug: 'villa-morra', name: 'Villa Morra', type: 'barrio', region: 'asuncion', priority: 0 },
  { slug: 'carmelitas', name: 'Carmelitas', type: 'barrio', region: 'asuncion', priority: 1 },
  { slug: 'recoleta', name: 'Recoleta', type: 'barrio', region: 'asuncion', priority: 2 },
  { slug: 'las-mercedes', name: 'Las Mercedes', type: 'barrio', region: 'asuncion', priority: 3 },
  { slug: 'lambare', name: 'Lambaré', type: 'distrito', region: 'central', priority: 25 },
  { slug: 'san-lorenzo', name: 'San Lorenzo', type: 'distrito', region: 'central', priority: 27 },
]

const DEMO_QUOTES: unknown[] = [
  { id: 'demo-quote-1', clientName: 'Demo: Carlos M.', clientPhone: '+595 000 0000111', items: [{ name: 'Cambio de calentador 50L', qty: 1, unitPrice: 250000 }, { name: 'Mano de obra', qty: 1, unitPrice: 150000 }], subtotal: 400000, iva: 40000, total: 440000, ivaIncluded: true, pdfKey: null, sentAt: 1782300000, createdAt: 1782290000 },
]

const DEMO_CLIENTS: unknown[] = [
  { id: 'demo-client-1', clientUserId: 'demo-client-1-u', displayName: 'Demo: María R.', phone: '+595 000 0000222', barrio: 'Carmelitas', notes: 'Cliente de Carmelitas. Tiene un calentador Whirlpool 2018, recomienda llamarla a la mañana.', jobCount: 3, lastJobAt: 1782200000, lastJobOficio: 'plomero', nextPitchAt: null, optOut: false, createdAt: 1781000000, updatedAt: 1782200000 },
  { id: 'demo-client-2', clientUserId: 'demo-client-2-u', displayName: 'Demo: Pedro G.', phone: '+595 000 0000333', barrio: 'Villa Morra', notes: '', jobCount: 1, lastJobAt: 1782100000, lastJobOficio: 'plomero', nextPitchAt: 1798000000, optOut: false, createdAt: 1781500000, updatedAt: 1782100000 },
]

const DEMO_ANALYTICS = {
  last30Days: { profileViews: 142, phoneClicks: 28, whatsappClicks: 38, inquiriesReceived: 12, jobsCompleted: 9 },
  lifetime: { reviewsCount: 12, ratingAvg: 4.8 },
  viewsByDay: [],
}

const wrap = <T>(data: T) => ({ data })

const ROUTES: Array<{ match: RegExp; build: (path: string, init: RequestInit) => unknown | null }> = [
  { match: /^\/v1\/me\/game-state$/,             build: () => wrap(DEMO_GAME_STATE) },
  { match: /^\/v1\/me\/profile-extended$/,       build: (_, init) => init.method === 'PATCH' ? wrap(DEMO_PROFILE) : wrap(DEMO_PROFILE) },
  { match: /^\/v1\/me\/badges$/,                 build: () => wrap(DEMO_BADGES) },
  { match: /^\/v1\/me\/badges\/[\w-]+$/,         build: () => wrap({ ok: true }) },
  { match: /^\/v1\/me\/quests$/,                 build: () => wrap(DEMO_QUESTS) },
  { match: /^\/v1\/me\/quests\/[\w-]+\/claim$/,  build: () => wrap({ xpGranted: 10, newTotal: 1257, tierChanged: false, newTier: 'maestro' }) },
  { match: /^\/v1\/me\/tours$/,                  build: (_, init) => init.method === 'POST' ? wrap({ ok: true }) : wrap(DEMO_TOURS) },
  { match: /^\/v1\/me\/service-areas$/,          build: () => wrap(DEMO_AREAS) },
  { match: /^\/v1\/me\/quotes$/,                 build: (_, init) => init.method === 'POST' ? wrap({ id: 'demo-quote-new', items: [], subtotal: 0, iva: 0, total: 0, ivaIncluded: true, createdAt: Math.floor(Date.now()/1000) }) : wrap(DEMO_QUOTES) },
  { match: /^\/v1\/me\/quote-templates$/,        build: (_, init) => init.method === 'POST' ? wrap({ id: 'demo-tpl-new', name: 'Demo template', items: [], ivaIncluded: true, createdAt: Math.floor(Date.now()/1000) }) : wrap([]) },
  { match: /^\/v1\/me\/quote-templates\/[\w-]+$/, build: () => wrap({ ok: true }) },
  { match: /^\/v1\/me\/notifications$/,          build: (_, init) => init.method === 'PATCH' ? wrap({ ok: true }) : wrap({ emailNotifications: false }) },
  { match: /^\/v1\/me\/requests/,                build: () => wrap([]) },
  // Sample list for /clients/?demo=1 — needs entries so #results renders
  // and the T_CLIENTS tour has a non-zero anchor to spotlight.
  { match: /^\/v1\/requests/, build: (_, init) => {
    if (init.method === 'POST') return wrap({ id: 'demo-request-new', createdAt: Math.floor(Date.now()/1000) })
    return wrap([
      { id: 'demo-r-1', userId: 'demo-c-1', title: 'Necesito instalación de termotanque', titleEs: 'Necesito instalación de termotanque', titleEn: 'I need a thermostat installed', body: 'Compré un termotanque eléctrico 80L marca Sole. Necesito instalación profesional con factura.', bodyEs: 'Compré un termotanque eléctrico 80L marca Sole.', bodyEn: 'I bought an 80L electric thermostat. Need professional installation.', category: 'plumbing', barrio: 'Carmelitas', budgetGs: 450000, status: 'open', createdAt: Math.floor(Date.now()/1000) - 86400 * 3 },
    { id: 'demo-r-2', userId: 'demo-c-2', title: 'Clases de inglés conversacional', titleEs: 'Clases de inglés conversacional', titleEn: 'Conversational English lessons', body: 'Necesito un profesor para clases de conversación 2 veces por semana. Nivel intermedio.', bodyEs: 'Necesito un profesor para clases de conversación.', bodyEn: 'Looking for a tutor for conversation classes twice a week.', category: 'teaching', barrio: 'Villa Morra', budgetGs: 250000, status: 'open', createdAt: Math.floor(Date.now()/1000) - 86400 * 1 },
    ])
  } },
  { match: /^\/v1\/analytics\/me$/,              build: () => wrap({ profileViews: 0, phoneClicks: 0, whatsappClicks: 0, inquiriesReceived: 0, jobsCompleted: 0 }) },
  { match: /^\/api\/auth\/passkeys/,             build: (_, init) => init.method === 'DELETE' ? wrap({ ok: true }) : wrap([]) },
  { match: /^\/v1\/media/,                       build: () => wrap({ key: `demo-media-${Date.now()}` }) },
  { match: /^\/v1\/me\/quotes\/[\w-]+\/sent$/,   build: () => wrap({ ok: true }) },
  { match: /^\/v1\/me\/clients$/,                build: () => wrap(DEMO_CLIENTS) },
  { match: /^\/v1\/me\/clients\/[\w-]+$/,        build: () => wrap({ ok: true }) },
  { match: /^\/v1\/me\/analytics-extended$/,     build: () => wrap(DEMO_ANALYTICS) },
  { match: /^\/v1\/me$/,                         build: () => wrap({ userId: 'demo-user', roles: [] }) },
  { match: /^\/v1\/p\/[\w-]+$/,                  build: () => wrap(DEMO_PROFILE) },
  // Sample list for /specialists/?demo=1 — needs at least a couple of cards
  // so the public list looks alive and the guided tour has something to
  // anchor its "Tap a card" step on. Empty `[]` left the page blank and
  // collapsed `#results` to zero height, breaking the tour spotlight.
  { match: /^\/v1\/specialists/, build: () => wrap([
    { id: 'demo-s-1', userId: 'demo-u-1', slug: 'demo-andreas-weber', displayName: 'Andreas Weber', headline: 'Carpintero — muebles a medida y restauración', bio: 'Carpintería fina y restauración. 15 años en Asunción.', headlineEs: 'Carpintero — muebles a medida y restauración', headlineEn: 'Carpenter — custom furniture and restoration', bioEs: 'Carpintería fina y restauración. 15 años en Asunción.', bioEn: 'Fine joinery and restoration. 15 years in Asunción.', phone: '+595 981 700001', whatsapp: '+595 981 700001', barrio: 'Carmelitas', lat: -25.2867, lng: -57.5816, photo: null, verified: true, status: 'active', createdAt: 1781000000, updatedAt: 1781000000, ratingAvg: 4.8, ratingCount: 12, primaryCategory: 'repair' },
    { id: 'demo-s-2', userId: 'demo-u-2', slug: 'demo-svetlana-petrova', displayName: 'Svetlana Petrova', headline: 'Profesora particular de matemática', bio: 'Doy clases en español, ruso e inglés. Primaria y secundaria.', headlineEs: 'Profesora particular de matemática', headlineEn: 'Private math tutor', bioEs: 'Doy clases en español, ruso e inglés.', bioEn: 'I teach math in Spanish, Russian and English.', phone: '+595 981 700002', whatsapp: '+595 981 700002', barrio: 'Villa Morra', lat: -25.2913, lng: -57.5772, photo: null, verified: true, status: 'active', createdAt: 1781100000, updatedAt: 1781100000, ratingAvg: 5.0, ratingCount: 7, primaryCategory: 'teaching' },
    { id: 'demo-s-3', userId: 'demo-u-3', slug: 'demo-lucia-benitez', displayName: 'Lucía Benítez', headline: 'Peluquera y colorista', bio: 'Salón propio en Las Mercedes. Corte, color, balayage.', headlineEs: 'Peluquera y colorista', headlineEn: 'Hairdresser and colorist', bioEs: 'Salón propio en Las Mercedes.', bioEn: 'My own salon in Las Mercedes.', phone: '+595 981 700004', whatsapp: '+595 981 700004', barrio: 'Las Mercedes', lat: -25.3001, lng: -57.5635, photo: null, verified: true, status: 'active', createdAt: 1781300000, updatedAt: 1781300000, ratingAvg: 4.9, ratingCount: 23, primaryCategory: 'beauty' },
  ]) },
  { match: /^\/v1\/listings/,                    build: (_, init) => init.method === 'POST' ? wrap({ id: 'demo-listing-new', createdAt: Math.floor(Date.now()/1000) }) : init.method === 'PATCH' || init.method === 'DELETE' ? wrap({ ok: true }) : wrap([]) },
  { match: /^\/v1\/inquiries/,                   build: (_, init) => init.method === 'POST' || init.method === 'PATCH' ? wrap({ ok: true, id: 'demo-inq' }) : wrap([]) },
  { match: /^\/v1\/analytics$/,                  build: () => wrap({ ok: true }) },
]

export const demoStub = async <T = unknown>(path: string, init: RequestInit = {}): Promise<T | null> => {
  await sleep(80 + Math.random() * 60)  // simulate network
  const route = ROUTES.find((r) => r.match.test(path))
  if (!route) return null
  return route.build(path, init) as T
}
