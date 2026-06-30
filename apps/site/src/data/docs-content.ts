/* Docs — STRUCTURE ONLY. All localized strings (title, tldr, section
 * headings, body text) live in src/locales/<lang>/content/docs/<slug>.yaml.
 *
 * Adding a docs page:
 *   1. Add an entry below (slug + code + status + optional realUrl + optional screenshot).
 *   2. Create per-locale YAML in locales/<lang>/content/docs/<slug>.yaml.
 *      ES is the bootstrap baseline; EN canonical fallback; DE/RU as available.
 *
 * realUrl: ONLY set for publicly reachable URLs (no auth gate). /me/* features
 *   redirect guests to login and feel like a dead-end — drop the CTA for those
 *   and let the screenshot carry the visual.
 * screenshot: path under /public/screenshots/. Captured by scripts/capture-doc-screenshots.ts.
 *
 * The TOC / sidebar grouping is data/docs-toc.ts.
 */
export interface DocSchema {
  readonly slug: string
  readonly code: string
  readonly status: 'live' | 'soon'
  readonly realUrl?: string
  readonly screenshot?: string
}

export const DOC_PAGES: ReadonlyArray<DocSchema> = [
  { slug: 'perfil',         code: 'A', status: 'live', realUrl: '/specialists/019ecf43-f9cf-760e-adb5-62f37461380c/', screenshot: '/screenshots/perfil.png' },
  { slug: 'insignias',      code: 'G', status: 'live', screenshot: '/screenshots/insignias.png' },
  { slug: 'xp',             code: 'J', status: 'live', screenshot: '/screenshots/xp.png' },
  { slug: 'cotizador',      code: 'E', status: 'live', screenshot: '/screenshots/cotizador.png' },
  { slug: 'analitica',      code: 'B', status: 'live', screenshot: '/screenshots/analitica.png' },
  { slug: 'mis-clientes',   code: 'I', status: 'live', screenshot: '/screenshots/mis-clientes.png' },
  { slug: 'filtros-leads',  code: 'F', status: 'live', screenshot: '/screenshots/filtros-leads.png' },
  { slug: 'multilingue',    code: 'H', status: 'live', screenshot: '/screenshots/multilingue.png' },
  { slug: 'this-doc',       code: 'M', status: 'live', realUrl: '/docs/' },
  { slug: 'recap-card',     code: 'C', status: 'soon' },
  { slug: 'sifen',          code: 'D', status: 'soon' },
  { slug: 'local-first',    code: 'N', status: 'soon' },
  { slug: 'mobile',         code: 'O', status: 'soon' },
]
