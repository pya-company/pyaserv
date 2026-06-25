export interface DocPage {
  readonly slug: string
  readonly code: string
  readonly title: string
  readonly tldr: string
  readonly status: 'live' | 'demo' | 'soon'
  readonly demoUrl?: string
  readonly realUrl?: string
  readonly sections: ReadonlyArray<{ heading: string; bodyMd: string }>
}

const sec = (heading: string, bodyMd: string) => ({ heading, bodyMd })

export const DOC_PAGES: ReadonlyArray<DocPage> = [
  {
    slug: 'perfil', code: 'A', title: 'Tu perfil público',
    status: 'live', demoUrl: '/me/?demo=1&tour=T1', realUrl: '/p/maria-gonzalez-019ecf',
    tldr: 'Página propia en pyaserv.com/p/<tu-slug> con foto, portada, bio, servicios con precio, galería de trabajos, reseñas, badges, horario y botón directo a WhatsApp.',
    sections: [
      sec('¿Qué incluye?', '· Foto de perfil + imagen de portada (16:9)\n· Bio + servicios con rango de precio\n· Hasta 8 zonas de trabajo\n· Horario semanal\n· Galería de trabajos (hasta 24 fotos)\n· Reseñas de clientes con foto\n· Badges + tier de gamification\n· Botón sticky de WhatsApp\n· QR para tarjeta de visita'),
      sec('URL', 'Cada profesional recibe un slug humano-friendly basado en su nombre: `pyaserv.com/p/juan-perez-019ec8`. Se genera al guardar el perfil; no se puede cambiar.'),
      sec('SEO', '· Title y meta description dinámicos\n· Schema.org `LocalBusiness` con aggregateRating\n· Open Graph + Twitter Card\n· Hreflang para versiones ES/EN/DE/RU\n· LCP target < 2 s en 3 G + 4× CPU'),
      sec('Cómo editar', 'Ingresá a `/me/` → tab "Mi perfil" → ahí los campos básicos. Para portada / servicios / portfolio / horario / filtros / guaraní: abrir details "Perfil avanzado" debajo del form principal.'),
      sec('Cómo se calcula el "completeness"', '10 pasos, cada uno 10 %, comenzando con 20 % de endowed-progress (Nunes 2006). Al 100 %: insignia "Perfil Maestro" + 7 días de Boost gratis.'),
    ],
  },
  {
    slug: 'tour', code: 'K', title: 'Onboarding Tour',
    status: 'live', demoUrl: '/me/?demo=1&tour=T1',
    tldr: 'Tour interactivo de 7 pasos que lleva al nuevo profesional por el armado del perfil. Auto-lanza al primer ingreso a /me/ si el perfil está incompleto.',
    sections: [
      sec('Triggers', 'T1 "Tu primer perfil" — auto-lanza si: (a) primera visita a /me/, (b) no existe registro en `user_tours_completed`, (c) `profile_complete_pct < 100`.'),
      sec('Pasos T1', '1. Foto · 2. Headline · 3. Bio · 4. Teléfono · 5. WhatsApp · 6. Barrio · 7. Completeness review.'),
      sec('Engine', 'Driver.js v1.5 (~5 KB) lazy-loaded. Spotlight + tooltip + Next/Prev/Skip. Persiste status `completed` o `skipped` en `user_tours_completed` table.'),
      sec('Re-launch', 'Sin recompensa XP repetida. Se puede re-lanzar manualmente desde el help menu (próximo sprint).'),
      sec('Demo Mode v2', 'En vez de Driver.js, ?demo=1 activa el nuevo IntelliJ-style overlay con darken-spotlight y navegación step-by-step.'),
    ],
  },
  {
    slug: 'insignias', code: 'G', title: 'Insignias',
    status: 'live', demoUrl: '/me/?demo=1&tab=game', realUrl: '/me/?tab=game',
    tldr: '18 insignias en 4 categorías que reconocen logros del profesional. Públicas en el perfil, opcionalmente ocultables.',
    sections: [
      sec('Categorías', '· **Tier** (5): Aprendiz → Patrón del Oficio\n· **Milestone** (5): primer trabajo, 10/50/100 trabajos, primer 5★\n· **Superlative** (3): velocista del mes, estrella del barrio, maestro del barrio\n· **Collection** (5): Perfil Maestro, multilingüe, constructor, equipo, verificado completo'),
      sec('Rarity', 'common · rare · epic · legendary. Determina color del pill y peso visual.'),
      sec('Auto-grant', 'Las superlativos se evalúan mensualmente (cron próximo sprint). Las milestone + collection se otorgan en eventos (job completed, photo added, ruc set).'),
      sec('Visibilidad', 'Por defecto públicas en el perfil. El usuario puede ocultar individualmente desde /me/?tab=game.'),
    ],
  },
  {
    slug: 'xp', code: 'J', title: 'XP, rachas, misiones',
    status: 'live', realUrl: '/me/?tab=game',
    tldr: 'Sistema de gamification completo: XP por acción, 5 tiers, racha diaria con freezes, misiones diarias y semanales con recompensas XP + boost.',
    sections: [
      sec('XP table (spec §4.4)', '· Respuesta < 1h: +5 · Respuesta < 24h: +2 · Trabajo completado: +25 · Reseña: +30 · Reseña con foto: +50 · 5★ bonus: +20 · Foto portfolio: +5 · Compartir trabajo: +15 · Quest diaria: +10 · Quest semanal: +50 · Referido: +100'),
      sec('Tiers', 'Aprendiz (0) → Oficial (100) → Maestro (500) → Maestro Mayor (2000) → Patrón del Oficio (5000). Sticky — no se baja.'),
      sec('Racha', 'Acción "activa" cualquier día (respuesta, foto, login con actividad). Auto-freeze si no hubo leads (max 3/mes). Manual pause hasta 14 días. Repair 1×/mes por 100 XP.'),
      sec('Quests', '3 diarias (10 XP cada una) + 1-2 semanales (50 XP). Auto-seed cuando el usuario abre /me/?tab=game.'),
    ],
  },
  {
    slug: 'cotizador', code: 'E', title: 'Cotizador rápido',
    status: 'live', demoUrl: '/me/quotes/new/?demo=1', realUrl: '/me/quotes/new/',
    tldr: 'Plantillas por oficio + editor de items + IVA opcional + PDF descargable + envío por WhatsApp con un click.',
    sections: [
      sec('Flow', '1. Elegí plantilla (opcional, por oficio).\n2. Llená/editá items (nombre + cantidad + precio).\n3. Toggle IVA 10 %.\n4. "Guardar y descargar PDF" — genera PDF client-side con jsPDF.\n5. "Enviar por WhatsApp" — abre wa.me con un mensaje pre-llenado con el resumen.'),
      sec('Plantillas', 'Sin plantillas pre-cargadas (vacío al inicio). Después de armar tu primer presupuesto, podés "Guardar como plantilla" para reutilizar.'),
      sec('PDF', 'Generado en el browser con jspdf 4.2. Sin server side fonts ni Workers complejos. Funciona offline (una vez que la página esté cacheada).'),
    ],
  },
  {
    slug: 'analitica', code: 'B', title: 'Analítica del perfil',
    status: 'live', realUrl: '/me/?tab=stats',
    tldr: 'Vistas del perfil, clicks a WhatsApp, conversión, tiempo de respuesta, comparación con el promedio del rubro en tu barrio.',
    sections: [
      sec('Métricas (últimos 30 días)', '· Profile views\n· Phone clicks\n· WhatsApp clicks\n· Inquiries received\n· Jobs completed\n· Reviews acumuladas + rating promedio'),
      sec('Próximos sprints', '· Sparkline por día\n· Source attribution (Google / WhatsApp share / direct / search en PyaServ)\n· Heatmap hora-de-día\n· Comparación vs avg del rubro en barrio'),
    ],
  },
  {
    slug: 'mis-clientes', code: 'I', title: 'Mis clientes (Lite-CRM)',
    status: 'live', realUrl: '/me/?tab=clients',
    tldr: 'Lista de clientes recurrentes. Se agregan automáticamente al completar un trabajo. Notas editables.',
    sections: [
      sec('Auto-add', 'Cuando una inquiry pasa a `work_status=done` (ambos confirmaron), se crea `client_record` con: display_name, phone, barrio, job_count, last_job_at.'),
      sec('Notas', 'Cada record tiene un campo `notes` libre, editable por el profesional. Útil para "le instalé el calefactor de cocina en marzo, le devuelvo en septiembre para mantenimiento".'),
      sec('Próximo: maintenance pitch', 'Para oficios con mantenimiento regular (plomería, AC), el sistema sugerirá auto-contacto al cliente N meses después de cierto tipo de trabajo.'),
    ],
  },
  {
    slug: 'filtros-leads', code: 'F', title: 'Filtros de leads',
    status: 'live', realUrl: '/me/?tab=profile',
    tldr: 'Configurá presupuesto mínimo y escondé cuentas nuevas (anti-spam). Hoy persistido en perfil; filtering en query — próximo sprint.',
    sections: [
      sec('Opciones actuales', '· `minBudget` (Gs): no mostrar inquiries por debajo de X\n· `hideNewAccounts`: esconder de cuentas creadas hace menos de 7 días\n· Próximo: distance limit, only-my-area, time-of-day'),
      sec('Estado', 'UI + persistence ✓. Aplicación al query de `/v1/me/inquiries` — pendiente próximo sprint (afecta query existente).'),
    ],
  },
  {
    slug: 'multilingue', code: 'H', title: 'Multilingüe per-perfil',
    status: 'live', realUrl: '/me/?tab=profile',
    tldr: 'Versión en guaraní de tu bio/headline sin perder el SEO en español. Próximamente: DE, EN, RU como equal-class.',
    sections: [
      sec('Hoy', 'Campos `bio_gn` y `headline_gn` en el "Perfil avanzado". Si están llenos, aparecen en `/p/<slug>?lang=gn` con hreflang correspondiente.'),
      sec('Estrategia 2026-06-25 (PIVOT)', 'La estrategia comercial pivó a DE/EN/RU/ES como **idiomas equal** — apuntando a expat communities en Paraguay (alemana, inglesa, rusa) + local. Migration 0013 agregará `bio_de`/`bio_ru`/`headline_de`/`headline_ru` columns en Sprint 2.'),
    ],
  },
  {
    slug: 'demo-mode', code: 'L', title: 'Demo Mode v2',
    status: 'live', demoUrl: '/me/?demo=1',
    tldr: 'Cualquier página real con ?demo=1 = apiFetch interceptado, datos mock, banner permanente, identidad logged-out. Mismo código que producción.',
    sections: [
      sec('Cómo funciona', 'apiFetch detecta `URLSearchParams.has(\'demo\')` y devuelve canned stubs en vez de hacer fetch real. Todas las páginas reales (`/me/`, `/p/<slug>`, `/me/quotes/new/`) renderizan con los mismos componentes pero con datos demo.'),
      sec('Safety Charter (10 mechanisms)', 'Spec §15.2. Banner naranja non-dismissible, body tint, html[data-demo-mode], prefijo "Demo:" en todos los nombres, sessionStorage state, logged-out identity, exit modal, 10-min idle timeout, NO data import, audit beacon.'),
      sec('Tours dentro de Demo', '?demo=1&tour=T1 lanza el tour overlay sobre la página real (IntelliJ-style en v2 próximo).'),
    ],
  },
  {
    slug: 'this-doc', code: 'M', title: 'Documentación + Releases',
    status: 'live', realUrl: '/docs/',
    tldr: 'Esta página. Cada feature tiene página de detalle. Releases en /releases/ con RSS.',
    sections: [
      sec('Estructura', '· `/docs/` — index con cards de todas las features.\n· `/docs/<slug>/` — página de detalle por feature (esta misma).\n· `/releases/` — notas de release ordenadas por fecha.\n· `/releases/rss.xml` — feed RSS 2.0.\n· `/components/` — Storybook lite (catálogo de componentes pure-stateless).'),
      sec('Próximo', '· Pagefind search across docs + releases.\n· Subscripción email mensual.\n· Toast on login si hay novedades desde la última visita.'),
    ],
  },
  {
    slug: 'recap-card', code: 'C', title: 'Recap-card PNG (WhatsApp Status)',
    status: 'soon',
    tldr: 'Generador 1080×1920 PNG semanal con métricas de la semana, listo para compartir en WhatsApp Status / Instagram Story.',
    sections: [
      sec('Trigger', 'Domingo 18:00 PY — auto-genera y muestra modal en /me/ si hubo actividad significativa esa semana.'),
      sec('Triggers adicionales', '· Desbloqueo de insignia importante.\n· Hito numérico (50, 100 trabajos).\n· Manual "Compartir mi semana".'),
      sec('Stack', 'Cloudflare Worker + Satori + Resvg. Pendiente bundling fix.'),
    ],
  },
  {
    slug: 'sifen', code: 'D', title: 'SIFEN — factura electrónica',
    status: 'soon',
    tldr: 'Generación de factura electrónica integrada con DGII en cada trabajo completado. Bloqueada por consultoría tributaria.',
    sections: [
      sec('Bloqueo', 'Antes de implementar necesito clarity de un contador parguayo sobre:\n· ¿Qué tipo de RUC requiere PyaServ?\n· ¿Es PyaServ emisor o sólo proveedor de infra para el profesional?\n· ¿Cómo se aplica IVA si el profesional NO tiene RUC?'),
      sec('Plan', 'Sprint 5 si juicio legal positivo, sino sigue como "soon" hasta resolver.'),
    ],
  },
  {
    slug: 'local-first', code: 'N', title: 'Local-first / Offline (multi-sprint)',
    status: 'soon',
    tldr: 'Páginas se renderizan offline desde cache, mutations queued, sync en reconexión, conflict resolution. Reference: Todoist.',
    sections: [
      sec('Vision', 'Cuando la red se cae, la app sigue funcionando: ver datos cacheados, crear/editar, queue local, sync automático al reconectar, conflict modal si hay edits paralelas.'),
      sec('Sub-tickets (spec §19.2)', '10 sub-tickets: SW offline shell, IndexedDB layer, mutation queue, sync engine, conflict resolution, UI badges, background sync, optimistic UI, network detection, E2E suite (50+ scenarios).'),
      sec('Estimación', '4-6 semanas. Top priority initiative.'),
    ],
  },
  {
    slug: 'mobile', code: 'O', title: 'Mobile (Tauri + WebView)',
    status: 'soon',
    tldr: 'iOS + Android app envolviendo el mismo código web vía Tauri 2.0 mobile. Single codebase. Sprint 7+.',
    sections: [
      sec('Decisión arquitectónica (spec §18)', 'NO React Native. NO Flutter. NO separate mobile app. Tauri WebView wrappea apps/site/dist directamente.'),
      sec('Plan', 'Sprint 7+: scaffold apps/mobile, iOS Xcode signing, Android Gradle, push notifications, share intent, biometric.'),
    ],
  },
]
