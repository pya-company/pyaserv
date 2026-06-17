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

interface RouteCheck {
  readonly path: string
  // Each check is a regex tested against the raw HTML body.
  // The label is for the failure message.
  readonly mustContain: ReadonlyArray<{ readonly label: string; readonly re: RegExp }>
}

const CHECKS: ReadonlyArray<RouteCheck> = [
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
      { label: 'specialist link', re: /href="[^"]*\/specialists\/detail\/\?id=/i },
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
      { label: 'request link', re: /href="[^"]*\/clients\/detail\/\?id=/i },
      // Title of the SSR'd request comes through.
      { label: 'request title visible', re: /<h2[^>]*>[^<]{3,}<\/h2>/i },
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
