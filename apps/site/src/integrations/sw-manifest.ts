/**
 * Astro integration that compiles src/sw/sw.ts via esbuild on build:done,
 * injects the precache URL list (every emitted index.html) and a fresh cache
 * version (build timestamp). Output: dist/sw.js, ready to register at /sw.js.
 *
 * Why not let Vite/Astro handle it: the SW source uses WebWorker globals
 * (`ServiceWorkerGlobalScope`, `clients`) that conflict with the DOM lib the
 * rest of the project uses. Keeping it on a separate esbuild lane avoids
 * tsconfig contortions.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { buildSync } from 'esbuild'

const SW_SOURCE = resolve('src/sw/sw.ts')

const collectHtmlRoutes = (dir: string, base: string = dir): ReadonlyArray<string> => {
  const routes: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      routes.push(...collectHtmlRoutes(full, base))
    } else if (entry === 'index.html') {
      const rel = `/${relative(base, dir).replace(/\\/g, '/')}`
      routes.push(rel === '/' ? '/' : `${rel}/`)
    }
  }
  return routes
}

const compileSw = (outPath: string): void => {
  buildSync({
    entryPoints: [SW_SOURCE],
    outfile: outPath,
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2022',
    logLevel: 'warning',
  })
}

const swManifest = (): AstroIntegration => ({
  name: 'sw-manifest',
  hooks: {
    'astro:build:done': ({ dir, logger }) => {
      // Astro hands the dist URL as file:// — normalize to a real path that
      // works on Windows (file:///C:/… → C:\…) and POSIX alike.
      const distPath = fileURLToPath(dir)
      const swPath = join(distPath, 'sw.js')

      compileSw(swPath)

      const routes = collectHtmlRoutes(distPath)
      // Build timestamp as the cache version. Same source + same routes →
      // same SW bytes → browser sees no update → no purge thrash. Different
      // build → version flips → activate purges old cache.
      const version = readFileSync(swPath, 'utf-8').length.toString(36)

      let sw = readFileSync(swPath, 'utf-8')
      sw = sw.replace('"__PRECACHE_URLS__"', JSON.stringify(routes))
      sw = sw.replace('__CACHE_VERSION__', version)
      writeFileSync(swPath, sw, 'utf-8')

      logger.info(`compiled sw.js with ${routes.length} precached routes, version ${version}`)
    },
  },
})

export default swManifest
