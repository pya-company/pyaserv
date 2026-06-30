/* Post-build: rewrite per-locale HTML files under dist/<lang>/ so that
 * <html lang>, <title>, and <meta name="description"> are localized at
 * SSR time, not after JS hydration.
 *
 * Astro's i18n fallback ('rewrite') copies the default-locale (ES) SSR
 * output to /en/, /de/, /ru/. Without this script the user sees an
 * Spanish title for ~700ms on a Russian page while the client script
 * catches up and swaps. With this script the SSR HTML is already correct.
 *
 * Strategy: walk dist/<lang>/**.html for lang in en/de/ru. For each:
 *   - Replace <html lang="es"> with <html lang="<lang>">.
 *   - Read data-title-key + data-desc-key attrs that Base.astro stamps on
 *     <html>, look them up in the built dict, replace <title> + meta desc.
 *
 * No content-body rewriting — body uses data-l10n-text/-html that the
 * client swaps. The flicker the user sees is dominated by title + lang attr
 * and that's what this fixes.
 */
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { DICTS } from '../src/locales/_built.ts'

const DIST = path.resolve(import.meta.dir ?? new URL('.', import.meta.url).pathname, '../dist')
const LOCALES = ['en', 'de', 'ru'] as const

type Loc = (typeof LOCALES)[number]

const tFor = (loc: Loc, key: string): string | null => {
  const dict = (DICTS as Record<string, Record<string, string>>)[loc]
  if (!dict) return null
  const v = dict[key]
  if (typeof v === 'string' && v.length > 0) return v
  // Fallback to ES then EN
  const es = (DICTS as Record<string, Record<string, string>>).es?.[key]
  if (typeof es === 'string' && es.length > 0) return es
  return null
}

const walkHtml = async (dir: string, out: string[] = []): Promise<string[]> => {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) }
  catch { return out }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walkHtml(full, out)
    else if (e.isFile() && e.name.endsWith('.html')) out.push(full)
  }
  return out
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

let totalRewritten = 0
let totalSkipped = 0

for (const loc of LOCALES) {
  const localeDir = path.join(DIST, loc)
  const files = await walkHtml(localeDir)
  for (const file of files) {
    let html = await fs.readFile(file, 'utf-8')
    const before = html

    // 1. <html lang="es" data-title-key="X" data-desc-key="Y">
    //    → <html lang="<loc>" data-title-key="X" data-desc-key="Y">
    html = html.replace(/<html\s+lang="es"/, `<html lang="${loc}"`)

    // 2. Read the data-title-key from <html> tag. If present, look up the
    //    localized title and replace the <title> body.
    const tk = html.match(/<html[^>]*\sdata-title-key="([^"]+)"/)?.[1]
    if (tk) {
      const localTitle = tFor(loc, tk)
      if (localTitle) {
        const brand = ' · PyaServ'
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(localTitle)}${brand}</title>`)
      }
    }

    // 3. data-desc-key → meta description
    const dk = html.match(/<html[^>]*\sdata-desc-key="([^"]+)"/)?.[1]
    if (dk) {
      const localDesc = tFor(loc, dk)
      if (localDesc) {
        html = html.replace(
          /<meta\s+name="description"\s+content="[^"]*"/,
          `<meta name="description" content="${escapeHtml(localDesc)}"`,
        )
      }
    }

    if (html !== before) {
      await fs.writeFile(file, html, 'utf-8')
      totalRewritten++
    } else {
      totalSkipped++
    }
  }
}

console.log(`[rewrite-locale-head] rewrote ${totalRewritten} files, skipped ${totalSkipped}`)
