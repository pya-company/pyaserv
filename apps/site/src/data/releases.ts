/* Releases — STRUCTURE ONLY. All localized strings (title, tldr, headings,
 * body text) live in src/locales/<lang>/content/releases/<slug>.yaml.
 *
 * Adding a release:
 *   1. Add an entry below with slug + version + date + tags + section order/kinds.
 *   2. Create the per-locale YAML files in locales/<lang>/content/releases/<slug>.yaml.
 *      ES + EN are mandatory (EN is canonical fallback). DE/RU strongly encouraged.
 *
 * At render time the page resolves the content via getReleaseContent(loc, slug).
 */
export type SectionKind = 'new' | 'improved' | 'fixed' | 'next'

export interface ReleaseSchema {
  readonly slug: string
  readonly version: string
  readonly date: string                       // YYYY-MM-DD
  readonly tags: ReadonlyArray<string>
  readonly sectionKinds: ReadonlyArray<SectionKind>  // order + kind only; copy via YAML
}

export const RELEASES: ReadonlyArray<ReleaseSchema> = [
  {
    slug: '2026-06-26-i18n-yaml-docs-wiki',
    version: 'v1.2.0',
    date: '2026-06-26',
    tags: ['i18n', 'docs', 'releases', 'ui'],
    sectionKinds: ['new', 'new', 'new', 'new', 'fixed', 'fixed', 'fixed', 'next'],
  },
  {
    slug: '2026-06-25-spec-v1-features',
    version: 'v1.1.0',
    date: '2026-06-25',
    tags: ['profile', 'gamification', 'quotes', 'crm', 'tour', 'docs', 'components'],
    sectionKinds: ['new', 'new', 'new', 'new', 'new', 'new', 'new', 'new'],
  },
  {
    slug: '2026-06-24-spec-v1-foundation',
    version: 'v1.0.0',
    date: '2026-06-24',
    tags: ['foundation', 'schema', 'i18n', 'migrations'],
    sectionKinds: ['new', 'new', 'new', 'new'],
  },
]

export const findRelease = (slug: string): ReleaseSchema | undefined =>
  RELEASES.find((r) => r.slug === slug)
