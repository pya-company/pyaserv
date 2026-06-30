// @ts-check
import { defineConfig } from 'astro/config'
import swManifest from './src/integrations/sw-manifest.ts'

const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  site: 'https://pyaserv.com',
  base,
  output: 'static',
  build: { format: 'directory' },
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en', 'de', 'ru'],
    // Pages render at root once. A post-build script (scripts/mirror-es.ts)
    // copies the ES build into dist/es/, then rewrites every bare page into
    // a tiny client-side language-negotiator redirector. Final layout:
    //   /            → redirector (Accept-Language → /<code>/...)
    //   /es/<page>/  → Spanish
    //   /en/<page>/  → English (via Astro fallback rewrite + post-build head fix)
    //   /de/<page>/  → German
    //   /ru/<page>/  → Russian
    routing: { prefixDefaultLocale: false, fallbackType: 'rewrite' },
    fallback: { en: 'es', de: 'es', ru: 'es' },
  },
  // sw-manifest: compiles src/sw/sw.ts to dist/sw.js with a precache list of
  // every emitted route. Registered from Base.astro via setupSwUpdate.
  integrations: [swManifest()],
})
