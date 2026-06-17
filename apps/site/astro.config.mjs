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
    locales: ['es', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  // sw-manifest: compiles src/sw/sw.ts to dist/sw.js with a precache list of
  // every emitted route. Registered from Base.astro via setupSwUpdate.
  integrations: [swManifest()],
})
