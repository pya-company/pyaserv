// CI gate test: server-rendered payloads contain real content.
//
// Companion to no-mutations.ts. The mutation gate proves nothing changes
// AFTER FCP. This proves real data is present BEFORE the browser executes a
// single line of script — i.e. that the build-time SSR fetch actually
// succeeded and we shipped a populated page, not a skeleton.
//
// Method: plain HTTP GET, no browser. Each route declares what payload
// fragments it MUST contain in the raw HTML. If a future commit accidentally
// reverts to client-side rendering, the gate trips.

const BASE = process.env.PYASERV_BASE_URL ?? 'https://pyaserv.com'
const API = process.env.PYASERV_API_URL ?? 'https://api.pyaserv.com'

interface RouteCheck {
  readonly path: string
  // Each check is a regex tested against the raw HTML body.
  // The label is for the failure message.
  readonly mustContain: ReadonlyArray<{ readonly label: string; readonly re: RegExp }>
}

// Pick a real specialist/request id from the live API so we can audit the
// SSR'd detail page that actually exists at build time.
const pickFirstId = async (collection: 'specialists' | 'requests'): Promise<string | null> => {
  try {
    const r = await fetch(`${API}/v1/${collection}`)
    if (!r.ok) return null
    const body = await r.json() as { data?: ReadonlyArray<{ id: string }> }
    return body.data?.[0]?.id ?? null
  } catch { return null }
}

const buildChecks = async (): Promise<ReadonlyArray<RouteCheck>> => {
  const specId = await pickFirstId('specialists')
  const reqId = await pickFirstId('requests')
  const out: RouteCheck[] = [...STATIC_CHECKS]
  if (specId) out.push({
    path: `/specialists/${specId}/`,
    mustContain: [
      { label: 'name SSR\'d as h1', re: /<h1[^>]*class="ps-detail__name"[^>]*>[^<]{2,}<\/h1>/i },
      { label: 'avatar block', re: /class="ps-detail__avatar/i },
      // bio now wraps both ES and EN spans inside the article.
      { label: 'bio article', re: /class="ps-detail__bio"[^>]*>\s*<span lang="es"/i },
      { label: 'guest-locked banner SSR\'d', re: /data-auth-guest/i },
      { label: 'auth-user contact block SSR\'d', re: /data-auth-user/i },
    ],
  })
  if (reqId) out.push({
    path: `/clients/${reqId}/`,
    mustContain: [
      // title now contains dual-lang spans
      { label: 'request title SSR\'d', re: /<h1[^>]*>\s*<span lang="es"[^>]*>[^<]{3,}<\/span>/i },
      { label: 'budget visible (ES)', re: /lang="es"[^>]*>📍/i },
      { label: 'budget visible (EN)', re: /lang="en"[^>]*>📍/i },
      { label: 'description article', re: /class="ps-detail__bio"[^>]*>\s*<span lang="es"/i },
    ],
  })
  return out
}

const STATIC_CHECKS: ReadonlyArray<RouteCheck> = [
  {
    path: '/',
    mustContain: [
      // Stats line must be SSR'd with both languages and at least 1 numeric strong.
      { label: 'stats: ES variant', re: /lang="es"[^>]*>\s*<strong>\d+<\/strong>\s*profesionales activos/i },
      { label: 'stats: EN variant', re: /lang="en"[^>]*>\s*<strong>\d+<\/strong>\s*active specialists/i },
      // Hero must be dual-rendered.
      { label: 'hero h1 ES', re: /lang="es"[^>]*>Servicios en Paraguay/i },
      { label: 'hero h1 EN', re: /lang="en"[^>]*>Services in Paraguay/i },
      // No client-side stats fetch script.
      { label: 'no client stats script', re: /^(?!.*home-stats.*innerHTML).*/s },
    ],
  },
  {
    path: '/specialists/',
    mustContain: [
      // At least one SSR'd specialist card with an avatar block.
      { label: 'card with avatar block', re: /class="[^"]*ps-card[^"]*ps-card--with-avatar/i },
      { label: 'avatar (img OR initials)', re: /class="[^"]*ps-card__avatar/i },
      { label: 'specialist link', re: /href="[^"]*\/specialists\/[0-9a-f-]+\/"/i },
      // Dual-render CTA on the card.
      { label: 'card CTA ES (Ver perfil)', re: /lang="es"[^>]*>[^<]*Ver perfil/i },
      { label: 'card CTA EN (View profile)', re: /lang="en"[^>]*>[^<]*View profile/i },
    ],
  },
  {
    path: '/clients/',
    mustContain: [
      // At least one SSR'd request card.
      { label: 'request card', re: /class="[^"]*ps-card[^"]*ps-card--request/i },
      { label: 'request link', re: /href="[^"]*\/clients\/[0-9a-f-]+\/"/i },
      // Title of the SSR'd request comes through (dual-lang spans inside <h2>).
      { label: 'request title visible', re: /<h2[^>]*>\s*<span lang="es"[^>]*>[^<]{3,}<\/span>/i },
      { label: 'card CTA ES (Postularme)', re: /lang="es"[^>]*>[^<]*Postularme/i },
      { label: 'card CTA EN (Apply)', re: /lang="en"[^>]*>[^<]*Apply/i },
    ],
  },
  {
    path: '/login/',
    mustContain: [
      { label: 'email field present', re: /name="email"[^>]*type="email"|type="email"[^>]*name="email"/i },
      { label: 'submit button dual-lang', re: /lang="es"[^>]*>[^<]*[Ee]nviar/i },
    ],
  },
]

const fetchText = async (url: string): Promise<string> => {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.text()
}

const main = async (): Promise<void> => {
  const failures: string[] = []
  const CHECKS = await buildChecks()

  for (const route of CHECKS) {
    const url = `${BASE}${route.path}`
    console.log(`[ssr] auditing ${url}`)
    let html: string
    try {
      html = await fetchText(url)
    } catch (err) {
      failures.push(`${route.path}: fetch failed — ${(err as Error).message}`)
      continue
    }

    const missing: string[] = []
    for (const check of route.mustContain) {
      if (!check.re.test(html)) missing.push(check.label)
    }
    if (missing.length > 0) {
      failures.push(`${route.path}: missing in SSR payload — ${missing.join(', ')}`)
      console.log(`  ❌ ${missing.length} check(s) failed: ${missing.join(', ')}`)
    } else {
      console.log(`  ✅ all ${route.mustContain.length} payload checks passed`)
    }
  }

  if (failures.length > 0) {
    console.error('\n❌ SSR payload regressions:')
    for (const f of failures) console.error('  -', f)
    process.exit(1)
  }
  console.log('\n✅ Every route ships its real content in the initial HTML.')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
