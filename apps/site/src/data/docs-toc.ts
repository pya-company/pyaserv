/* Docs TOC — categorized wiki nav. Single source of truth for both index and per-slug pages. */
import { DOC_PAGES, type DocPage } from './docs-content.ts'

export interface DocGroup {
  readonly id: string
  readonly i18nKey: string       // e.g. 'docs.group_profile'
  readonly pageSlugs: ReadonlyArray<string>
}

export const DOC_GROUPS: ReadonlyArray<DocGroup> = [
  { id: 'profile',      i18nKey: 'docs.group_profile',      pageSlugs: ['perfil', 'multilingue', 'analitica'] },
  { id: 'gamification', i18nKey: 'docs.group_gamification', pageSlugs: ['insignias', 'xp', 'tour'] },
  { id: 'tools',        i18nKey: 'docs.group_tools',        pageSlugs: ['cotizador', 'mis-clientes', 'filtros-leads'] },
  { id: 'system',       i18nKey: 'docs.group_system',       pageSlugs: ['demo-mode', 'this-doc'] },
  { id: 'roadmap',      i18nKey: 'docs.group_roadmap',      pageSlugs: ['recap-card', 'sifen', 'local-first', 'mobile'] },
]

export interface TocEntry {
  readonly group: DocGroup
  readonly pages: ReadonlyArray<DocPage>
}

export const TOC: ReadonlyArray<TocEntry> = DOC_GROUPS.map((g) => ({
  group: g,
  pages: g.pageSlugs
    .map((s) => DOC_PAGES.find((p) => p.slug === s))
    .filter((p): p is DocPage => p !== undefined),
}))
