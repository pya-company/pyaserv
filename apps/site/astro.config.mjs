// @ts-check
import { defineConfig } from 'astro/config'

// Long-term home is https://pyaserv.com (custom domain via GitHub Pages).
// While the domain is still being acquired, the site also serves on
// https://undeadliner.github.io/pyaserv/ — set BASE_PATH=/pyaserv/ before
// `bun run build` to make all links work under that prefix.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  site: 'https://pyaserv.com',
  base,
  output: 'static',
  build: {
    format: 'directory',
  },
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: { prefixDefaultLocale: false },
  },
})
