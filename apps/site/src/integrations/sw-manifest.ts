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
import { createHash } from 'node:crypto'
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

      // App-shell only — keep precache <= 30 URLs. Every other page is lazy-
      // cached on first navigation via the SW fetch handler. Avoids burning
      // 2.5 MB on PY 3G install and stops one 404 from killing the install.
      const allRoutes = collectHtmlRoutes(distPath)
      const APP_SHELL: ReadonlyArray<string> = ['/', '/specialists/', '/clients/', '/docs/', '/releases/', '/me/']
      const routes = APP_SHELL.filter((r) => allRoutes.includes(r))
      // Cache version = hash of the precached HTML payloads. Those payloads
      // embed the content-hashed _astro asset URLs, so ANY content, script or
      // style change flips the version — which is exactly when the SW must
      // update and `activate` must purge the stale app-shell cache. (The old
      // sw.js-length version never changed on content-only deploys, pinning
      // returning users to a stale /me/ forever.)
      const shellHash = createHash('sha256')
      for (const r of routes) {
        const htmlFile = r === '/'
          ? join(distPath, 'index.html')
          : join(distPath, r.replace(/^\/+|\/+$/g, ''), 'index.html')
        try { shellHash.update(readFileSync(htmlFile)) } catch { /* route not emitted yet */ }
      }
      const version = shellHash.digest('hex').slice(0, 12)

      let sw = readFileSync(swPath, 'utf-8')
      sw = sw.replace('"__PRECACHE_URLS__"', JSON.stringify(routes))
      sw = sw.replace('__CACHE_VERSION__', version)
      writeFileSync(swPath, sw, 'utf-8')

      logger.info(`compiled sw.js with ${routes.length} precached routes, version ${version}`)
    },
  },
})

export default swManifest
