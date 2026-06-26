/* Docs — STRUCTURE ONLY. All localized strings (title, tldr, section
 * headings, body text) live in src/locales/<lang>/content/docs/<slug>.yaml.
 *
 * Adding a docs page:
 *   1. Add an entry below (slug + code + status + optional demoUrl/realUrl).
 *   2. Create per-locale YAML in locales/<lang>/content/docs/<slug>.yaml.
 *      ES is the bootstrap baseline; EN canonical fallback; DE/RU as available.
 *
 * The TOC / sidebar grouping is data/docs-toc.ts.
 */
export interface DocSchema {
  readonly slug: string
  readonly code: string
  readonly status: 'live' | 'demo' | 'soon'
  readonly demoUrl?: string
  readonly realUrl?: string
}

export const DOC_PAGES: ReadonlyArray<DocSchema> = [
  { slug: 'perfil',         code: 'A', status: 'live',   demoUrl: '/me/?demo=1&tour=T1', realUrl: '/p/maria-gonzalez-019ecf' },
  { slug: 'tour',           code: 'K', status: 'live',   demoUrl: '/me/?demo=1&tour=T1' },
  { slug: 'insignias',      code: 'G', status: 'live',   demoUrl: '/me/?demo=1&tab=game', realUrl: '/me/?tab=game' },
  { slug: 'xp',             code: 'J', status: 'live',   realUrl: '/me/?tab=game' },
  { slug: 'cotizador',      code: 'E', status: 'live',   demoUrl: '/me/quotes/new/?demo=1', realUrl: '/me/quotes/new/' },
  { slug: 'analitica',      code: 'B', status: 'live',   realUrl: '/me/?tab=stats' },
  { slug: 'mis-clientes',   code: 'I', status: 'live',   realUrl: '/me/?tab=clients' },
  { slug: 'filtros-leads',  code: 'F', status: 'live',   realUrl: '/me/?tab=profile' },
  { slug: 'multilingue',    code: 'H', status: 'live',   realUrl: '/me/?tab=profile' },
  { slug: 'demo-mode',      code: 'L', status: 'live',   demoUrl: '/me/?demo=1' },
  { slug: 'this-doc',       code: 'M', status: 'live',   realUrl: '/docs/' },
  { slug: 'recap-card',     code: 'C', status: 'soon' },
  { slug: 'sifen',          code: 'D', status: 'soon' },
  { slug: 'local-first',    code: 'N', status: 'soon' },
  { slug: 'mobile',         code: 'O', status: 'soon' },
]
