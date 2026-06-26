/* Release notes — strongly typed. Per-release page is generated from this data
 * via /releases/[slug].astro. Index page lists all as full cards.
 *
 * Add a new release: prepend a new entry to RELEASES. Each `bodyMd` supports
 * the same mini-markdown subset as /docs/<slug>/: paragraphs, "·" lists,
 * **bold**, `code`, and inline GIF references via the `media` field.
 */
export interface ReleaseMedia {
  readonly src: string         // /docs/media/<file>.webp
  readonly alt: string
  readonly caption?: string
}
export interface ReleaseSection {
  readonly kind: 'new' | 'improved' | 'fixed' | 'next'
  readonly heading?: string
  readonly bodyMd: string
  readonly media?: ReadonlyArray<ReleaseMedia>
}
export interface Release {
  readonly slug: string
  readonly version: string
  readonly date: string         // YYYY-MM-DD
  readonly title: string
  readonly tags: ReadonlyArray<string>
  readonly tldr: string
  readonly sections: ReadonlyArray<ReleaseSection>
  // i18n: ideally these strings are moved to a per-release YAML in locales/<lang>/releases-<slug>.yaml.
  // Bootstrap: ship in ES for now, EN/DE/RU follow as translator capacity allows.
}

export const RELEASES: ReadonlyArray<Release> = [
  {
    slug: '2026-06-26-i18n-yaml-docs-wiki',
    version: 'v1.2.0',
    date: '2026-06-26',
    title: 'i18n YAML + 4 idiomas + docs wiki + releases full pages',
    tags: ['i18n', 'docs', 'releases', 'ui'],
    tldr: 'Strings movidas a YAML por idioma. 4 idiomas equal: ES, EN, DE, RU. Docs es ahora wiki con sidebar. Cada release tiene página propia con detalles.',
    sections: [
      { kind: 'new', heading: 'i18n basado en YAML',
        bodyMd: `· Cada string vive en \`apps/site/src/locales/<lang>/<ns>.yaml\` — un archivo por namespace.\n· Drop a YAML, run \`bun run i18n:build\`, ship. Cero hardcoded strings en código nuevo.\n· **309 keys** en ES + EN paridad obligatoria (unit test \`i18n.test.ts\`), 97 en DE/RU bootstrap, GN sparse.\n· Cadena de fallback: locale → EN → ES → key (last-ditch). EN canonical.\n· \`t(key)\` API igual que antes — sin breaking changes en callsites.` },
      { kind: 'new', heading: 'Cuatro idiomas equal: ES / EN / DE / RU',
        bodyMd: `· Auto-detect del navegador sin sesgo a español: \`de\` → DE, \`ru\` → RU, \`es\` → ES, fallback EN.\n· Cuatro botones en el switcher de idioma del topbar y flying-menu (antes solo 2).\n· Aria-labels traducidas en cada idioma para el screen reader del usuario.\n· Spec §17 (multi-lang strategy) — target inicial: comunidades expat en Paraguay (alemana, inglesa, rusa) + local.` },
      { kind: 'new', heading: 'Documentación como wiki',
        bodyMd: `· \`/docs/\` ahora es vista wiki con sidebar de navegación a la izquierda (no más cards).\n· Categorías: Perfil & visibilidad · Gamification · Herramientas · Sistema · Roadmap · Desarrollo.\n· Cada feature mantiene su página propia \`/docs/<slug>/\`.\n· Buscador de docs viene con Pagefind en próximo release.` },
      { kind: 'new', heading: 'Releases — páginas completas',
        bodyMd: `· \`/releases/\` ahora muestra cards completas con todo el contenido (no mini-cards).\n· Cada release tiene su URL propia \`/releases/<slug>/\` — link compartible, indexable.\n· Soporte para secciones tipadas: Nuevo / Mejorado / Arreglado / Próximamente.\n· Slots para GIFs por sección (próximamente: pipeline Playwright→ffmpeg para auto-recordings).` },
      { kind: 'fixed', heading: 'Demo banner stuck bug + tests',
        bodyMd: `· \`.ps-demo-banner { display: flex }\` sobrescribía el UA \`[hidden]{display:none}\`, dejando el banner visible siempre.\n· Fix: \`.ps-demo-banner[hidden] { display: none !important }\`.\n· Suite \`tests/e2e/demo-mode.common.spec.ts\` — **9 scenarios × 2 viewports = 18 tests**, todos passing.\n· Sticky in-demo navigation: links a \`/me/* /p/* /specialists/* /clients/*\` auto-reciben \`?demo=1\`; los demás cortan demo.` },
      { kind: 'fixed', heading: 'Botones — focus-visible unificado',
        bodyMd: `· Una sola regla CSS cubre \`.cl-btn, .ps-lang-btn, .ps-theme-btn, .ps-tab, .gt-btn, .ps-demo-banner__exit\` con \`outline: 2px solid var(--ps-acc); outline-offset: 2px\`.\n· Hover separado del focus-visible (antes mismo selector — accesibilidad pobre).` },
      { kind: 'fixed', heading: 'Dark theme en componentes nuevos',
        bodyMd: `· Todos los \`cl-*\` (Button, Card, BadgePill, ProfileHeader, etc.) ahora usan tokens \`--ps-*\` de \`global.css\` en vez de colores hardcoded.\n· Demo banner y guided-tour respetan el tema activo.` },
      { kind: 'next', heading: 'Próximo',
        bodyMd: `· Mover los strings restantes (texto de docs, contenido de release-notes) a YAML por idioma.\n· Pagefind search en /docs/ + /releases/.\n· Email digest suscripción mensual.\n· In-app toast cuando hay release nuevo desde la última visita.` },
    ],
  },
  {
    slug: '2026-06-25-spec-v1-features',
    version: 'v1.1.0',
    date: '2026-06-25',
    title: 'Spec v1 features live — 13 funciones + components-lib + Demo v2',
    tags: ['profile', 'gamification', 'quotes', 'crm', 'tour', 'docs', 'components'],
    tldr: 'Las 13 features de spec v1 en producción + components-lib pure-stateless + Demo Mode v2 con apiFetch interception.',
    sections: [
      { kind: 'new', heading: 'Perfil público + 4 nuevos endpoints',
        bodyMd: `· \`/p/<tu-slug>\` con foto, portada, bio, servicios, badges, horario, WhatsApp CTA.\n· API: \`/v1/p/:slug\` agrega profile + reviews + badges + tier + areas.\n· Pretty URL via CF Pages \`_redirects\` rewrite.` },
      { kind: 'new', heading: 'Cotizador rápido con PDF',
        bodyMd: `· \`/me/quotes/new\` — editor de items, IVA toggle, jsPDF descarga client-side, share por WhatsApp.\n· Templates por oficio (próximo: bibliotecas pre-cargadas).` },
      { kind: 'new', heading: 'Gamification engine completo',
        bodyMd: `· XP, 5 tiers (Aprendiz → Patrón), 18 badges en 4 categorías, racha diaria con freezes.\n· Misiones diarias (3) y semanales (2) con auto-seed.\n· HUD en \`/me/\` con XP / 🔥 racha / ⚡ tier.\n· XP grants automáticos en eventos: respuesta < 1h, job completed, review con foto.` },
      { kind: 'new', heading: 'Lite-CRM "Mis clientes"',
        bodyMd: `· Auto-creación de \`client_record\` cuando se completa un trabajo.\n· Notas editables, contador de trabajos por cliente.\n· Próximo: recordatorios de mantenimiento N meses después.` },
      { kind: 'new', heading: 'Onboarding Tour T1',
        bodyMd: `· Driver.js lazy-loaded, 7 pasos guiados.\n· Auto-launch al primer ingreso a \`/me/\` si profile_complete_pct < 100.\n· Persistencia en tabla \`user_tours_completed\`.` },
      { kind: 'new', heading: 'Hyperlocal SEO landings × 400',
        bodyMd: `· \`/servicios/<oficio>/<barrio>/\` — 10 oficios × 40 zonas = 400 páginas auto-generadas.\n· Cada una con title/meta únicos, FAQ, CTA "¿Sos profesional?", live-fetch de specialists matching.` },
      { kind: 'new', heading: 'Demo Mode v2',
        bodyMd: `· Cualquier ruta + \`?demo=1\` = misma app con datos canned (sin pages mock).\n· apiFetch intercepta llamadas via demoStub.\n· 10 mechanisms del Safety Charter activos: banner naranja, body tint, html[data-demo-mode], identidad logged-out, exit modal, idle timeout 10min, no data import, audit beacon.` },
      { kind: 'new', heading: 'Components library + Storybook lite',
        bodyMd: `· \`apps/site/src/components-lib/\` — 19 funciones pure stateless (atoms / molecules / organisms).\n· \`/components/\` lista con props panel + locale switcher (debug i18n).\n· Demo Mode v2 reutiliza estas mismas funciones.` },
    ],
  },
  {
    slug: '2026-06-24-spec-v1-foundation',
    version: 'v1.0.0',
    date: '2026-06-24',
    title: 'Spec v1 Foundation — schema + service areas + gamification base',
    tags: ['foundation', 'schema', 'i18n', 'migrations'],
    tldr: 'Base de datos lista para todas las features de spec v1. 4 migraciones aplicadas en prod D1.',
    sections: [
      { kind: 'new', heading: 'Migraciones',
        bodyMd: `· **0009** — extensions a \`specialist_profiles\` (slug, cover, services_json, portfolio_json, schedule_json, lead_filters_json, cedula_verified, ruc_number, bio_gn, headline_gn).\n· **0010** — tablas de gamification (user_game_state, xp_events, badges_catalog con 18 seeded, user_badges, quests).\n· **0011** — user_tours_completed + slug backfill para perfiles existentes.\n· **0012** — quotes, quote_templates, client_records, release_subscriptions, user_subscriptions.` },
      { kind: 'new', heading: 'Service areas canonical',
        bodyMd: `· 40 zonas seeded: 25 barrios de Asunción + 15 distritos de Departamento Central.\n· Tabla \`service_areas\` (canonical) + link \`specialist_service_areas\` (many-to-many, hasta 8 zonas por profesional).` },
      { kind: 'new', heading: 'Sistema de gamification base',
        bodyMd: `· Event-sourced: cada XP grant es row inmutable en \`xp_events\`.\n· Materialización: \`user_game_state\` con projection denormalizada para lectura rápida del HUD.\n· 18 badges seeded en 4 categorías (tier · milestone · superlative · collection).` },
      { kind: 'new', heading: 'Idioma guaraní (sparse)',
        bodyMd: `· Locale type extended a \`'es' | 'en' | 'gn'\`.\n· GN sparse dictionary, fallback a ES para keys faltantes.\n· Per-specialist: bio_gn, headline_gn opcionales.` },
    ],
  },
]

export const findRelease = (slug: string): Release | undefined =>
  RELEASES.find((r) => r.slug === slug)
