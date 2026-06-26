/* Typed accessor for rich content YAML files.
 *
 * Source: locales/<lang>/content/<type>/<slug>.yaml
 * Loaded into CONTENT export of locales/_built.ts (codegen).
 *
 * Fallback chain mirrors t(): requested locale → EN → ES → null.
 */
import { CONTENT } from '../locales/_built.ts'
import type { Locale } from './i18n.ts'

export interface ReleaseContentSection {
  readonly kind: 'new' | 'improved' | 'fixed' | 'next'
  readonly heading: string
  readonly body: string
}
export interface ReleaseContent {
  readonly title: string
  readonly tldr: string
  readonly sections: ReadonlyArray<ReleaseContentSection>
}

export interface DocContentSection {
  readonly heading: string
  readonly body: string
}
export interface DocContent {
  readonly title: string
  readonly tldr: string
  readonly sections: ReadonlyArray<DocContentSection>
}

const lookup = <T>(loc: Locale, type: 'releases' | 'docs', slug: string): T | null => {
  const langs: Locale[] = [loc, 'en', 'es']
  for (const l of langs) {
    const bucket = (CONTENT as Record<string, Record<string, Record<string, unknown>>>)[l]?.[type]
    if (bucket && bucket[slug]) return bucket[slug] as T
  }
  return null
}

export const getReleaseContent = (loc: Locale, slug: string): ReleaseContent | null =>
  lookup<ReleaseContent>(loc, 'releases', slug)

export const getDocContent = (loc: Locale, slug: string): DocContent | null =>
  lookup<DocContent>(loc, 'docs', slug)
