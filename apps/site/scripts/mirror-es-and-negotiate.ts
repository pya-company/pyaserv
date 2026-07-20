/* Post-build: make ES symmetric with EN/DE/RU under /es/ and replace each
 * bare /<page>/index.html with a tiny client-side locale negotiator.
 *
 * Astro emits the default locale (ES) at the bare root, and EN/DE/RU under
 * /en/, /de/, /ru/ via fallback rewrite. Per user requirement: ES must also
 * live at /es/, and the bare root URLs must redirect the visitor to the
 * locale that best matches their Accept-Language / navigator.languages,
 * falling back to /en/ if none match.
 *
 * Strategy (runs AFTER astro build + rewrite-locale-head):
 *   1. Walk dist/**.html. For each file at the ROOT (not under /es /en /de /ru),
 *      copy it to dist/es/<same-path>.
 *   2. After the copy, replace the original bare file with a 200-byte
 *      negotiator HTML: parses navigator.languages, picks best supported
 *      locale, location.replace's to that prefix.
 *
 * Skips: bare assets / dirs (_astro, _redirects, _headers, sw.js, favicon,
 * bootstrap.js, robots.txt, sitemap.xml, manifest.webmanifest, icon-*.png,
 * /api, /v1, /401, /403, /404). They stay at root.
 */
import { promises as fs } from 'node:fs'
import * as path from 'node:path'

const DIST = path.resolve(import.meta.dir ?? new URL('.', import.meta.url).pathname, '../dist')
const KNOWN_LOCS = new Set(['es', 'en', 'de', 'ru', 'gn'])
const KEEP_AT_ROOT = new Set(['404.html', 'robots.txt', 'sitemap.xml', 'sitemap-index.xml', 'manifest.webmanifest', 'rss.xml', 'favicon.svg', 'bootstrap.js', 'sw.js'])

const NEGOTIATOR = `<!doctype html><meta charset="utf-8"><title>PyaServ</title><meta name="robots" content="noindex"><script>
(function(){
  var supported = ['es','en','de','ru'];
  var rest = location.pathname.replace(/^\\/+/, '');
  var search = location.search || '';
  var hash = location.hash || '';
  var picks = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']);
  var loc = 'en';
  for (var i = 0; i < picks.length; i++) {
    var p = (picks[i] || '').toLowerCase().split('-')[0];
    if (supported.indexOf(p) !== -1) { loc = p; break; }
  }
  var target = '/' + loc + '/' + rest + search + hash;
  location.replace(target);
})();
</script>`

const walkHtml = async (dir: string, base: string, out: string[] = []): Promise<string[]> => {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) }
  catch { return out }
  for (const e of entries) {
    if (e.name.startsWith('_') || e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    const relTop = path.relative(base, full).split(path.sep)[0]
    if (KNOWN_LOCS.has(relTop)) continue
    if (e.isDirectory()) await walkHtml(full, base, out)
    else if (e.isFile() && e.name.endsWith('.html')) out.push(full)
  }
  return out
}

let mirrored = 0
let negotiated = 0
let skipped = 0

const bareHtmlFiles = await walkHtml(DIST, DIST)

for (const file of bareHtmlFiles) {
  const rel = path.relative(DIST, file)
  if (KEEP_AT_ROOT.has(rel)) { skipped++; continue }
  // 1. Mirror to dist/es/<same path>
  const esTarget = path.join(DIST, 'es', rel)
  await fs.mkdir(path.dirname(esTarget), { recursive: true })
  await fs.copyFile(file, esTarget)
  mirrored++

  // 2. Replace original with negotiator
  await fs.writeFile(file, NEGOTIATOR, 'utf-8')
  negotiated++
}

console.log(`[mirror-es-and-negotiate] mirrored ${mirrored} pages to /es/, replaced ${negotiated} bare roots with negotiator (skipped ${skipped})`)
