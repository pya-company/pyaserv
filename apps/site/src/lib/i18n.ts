// PyaServ i18n — static dictionary, locale persisted in localStorage.
// Pages reload on locale change (Astro is static; reactivity would be overkill).

export type Locale = 'es' | 'en' | 'gn'

export const LOCALES: ReadonlyArray<Locale> = ['es', 'en', 'gn']

const STORAGE_KEY = 'pyaserv.locale'

const isLocale = (v: unknown): v is Locale => v === 'es' || v === 'en' || v === 'gn'

const detectFromNavigator = (): Locale => {
  if (typeof navigator === 'undefined') return 'es'
  const lang = (navigator.language || '').toLowerCase()
  if (lang.startsWith('gn')) return 'gn'
  if (lang.startsWith('en')) return 'en'
  return 'es'
}

export const getLocale = (): Locale => {
  if (typeof globalThis === 'undefined') return 'es'
  // 1. localStorage
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // localStorage unavailable (SSR, private mode, etc.)
  }
  // 2. URL ?lang=
  try {
    const url = new URL(globalThis.location?.href ?? 'http://x/')
    const qp = url.searchParams.get('lang')
    if (isLocale(qp)) return qp
  } catch {
    // no location
  }
  // 3. navigator
  return detectFromNavigator()
}

export const setLocale = (l: Locale): void => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, l)
  } catch {
    // ignore
  }
  globalThis.location?.reload()
}

type Dict = Readonly<Record<string, string>>

export const ES: Dict = {
  // -------- common --------
  'common.loading': 'Cargando…',
  'common.sending': 'Enviando…',
  'common.saving': 'Guardando…',
  'common.publishing': 'Publicando…',
  'common.verifying': 'Verificando…',
  'common.save': 'Guardar',
  'common.cancel': 'Cancelar',
  'common.send': 'Enviar',
  'common.delete': 'Eliminar',
  'common.edit': 'Editar',
  'common.missing_id': 'Falta el id',
  'common.price_tbd': 'A coordinar',
  'common.budget_tbd': 'A coordinar',
  'common.now': 'ahora',
  'common.no_description': '(sin descripción)',

  // brand / chrome
  'brand.suffix': 'PyaServ',
  'brand.tagline_short': 'hermano de PyaEats',
  'brand.tagline_long': 'construido sobre pya-platform',

  // nav
  'nav.menu_open': 'Abrir menú',
  'nav.primary_aria': 'Principal',
  'nav.specialists': 'Profesionales',
  'nav.clients': 'Pedidos',
  'nav.me': 'Mi panel',
  'nav.login': 'Ingresar',
  'nav.lang_label': 'Idioma',
  'nav.lang_es': 'ES',
  'nav.lang_en': 'EN',
  'nav.lang_gn': 'GN',
  'nav.lang_es_aria': 'Cambiar a español',
  'nav.lang_en_aria': 'Cambiar a inglés',
  'nav.lang_gn_aria': 'Cambiar a guaraní',
  'nav.theme_label': 'Cambiar tema (claro/oscuro/auto)',
  'nav.skip': 'Saltar al contenido',

  // home
  'home.title': 'Servicios en Paraguay sin comisiones',
  'home.description': 'PyaServ conecta profesionales con clientes en Paraguay. Sin comisiones por contacto, sin pagos en plataforma.',
  'home.hero.title': 'Servicios en Paraguay, sin intermediarios.',
  'home.hero.body': 'Si ofrecés un servicio o si buscás a alguien que resuelva algo concreto, PyaServ tiene un lado para vos. Nada de comisiones por presentar — el trato lo cierran ustedes.',
  'home.specialists.title': 'Necesito a un profesional',
  'home.specialists.desc': 'Plomeros, electricistas, profes, peluqueras — buscá por barrio y categoría. Contactá directo cuando te decidas.',
  'home.specialists.cta': 'Ver profesionales →',
  'home.clients.title': 'Ofrezco un servicio',
  'home.clients.desc': 'Mirá los pedidos abiertos en tu zona. Si encaja con lo tuyo, escribiles directo — sin filtros, sin pago para postularte.',
  'home.clients.cta': 'Ver pedidos →',
  'home.banner.html': '<strong>Estado:</strong> MVP en vivo. Crearás tu perfil de profesional o tu pedido en el panel <a data-banner-link>Mi panel</a>. Si todavía no tenés cuenta, te creamos una con tu email — sin contraseñas.',
  'home.banner.status_label': 'Estado:',
  'home.banner.body': 'MVP en vivo. Crearás tu perfil de profesional o tu pedido en el panel',
  'home.banner.cta': 'Mi panel',
  'home.banner.tail': 'Si todavía no tenés cuenta, te creamos una con tu email — sin contraseñas.',
  'home.stats': '<strong>{specs}</strong> profesionales activos · <strong>{reqs}</strong> pedidos abiertos',

  // specialists list
  'specialists.title': 'Profesionales',
  'specialists.description': 'Plomeros, electricistas, peluqueras, profes — encontralos en tu barrio en Asunción.',
  'specialists.heading': 'Profesionales disponibles',
  'specialists.intro': 'Filtrá por categoría o barrio. El contacto se hace fuera de la plataforma; PyaServ solo presenta.',
  'specialists.filter.category': 'Categoría',
  'specialists.filter.category.all': 'Todas',
  'specialists.filter.barrio': 'Barrio',
  'specialists.filter.barrio.placeholder': 'Villa Morra, Carmelitas…',
  'specialists.empty.title': 'Nada por acá',
  'specialists.empty.hint': 'Probá quitar filtros o cambiar el barrio.',
  'specialists.filter.near_me': '📍 Cerca de mí',
  'specialists.filter.near_me_on': '📍 Cerca de mí · activado',
  'specialists.filter.near_me_denied': 'Sin acceso a ubicación',
  'specialists.count.one': 'profesional',
  'specialists.count.many': 'profesionales',
  'specialists.card.verified': '✓ verificado',
  'specialists.card.cta': 'Ver perfil →',

  // specialist detail
  'specialist.detail.title': 'Perfil',
  'specialist.detail.locked': 'Para ver el contacto,',
  'specialist.detail.locked.cta': 'iniciá sesión',
  'specialist.detail.verified': '✓ Verificado',
  'specialist.detail.contact_btn': 'Enviar mensaje',
  'specialist.detail.services_h': 'Servicios que ofrece',
  'specialist.detail.no_services.title': 'Aún no publicó servicios',
  'specialist.detail.compose_h': 'Escribirle',
  'specialist.detail.compose.label': 'Mensaje',
  'specialist.detail.compose.placeholder': 'Hola, me interesa…',
  'specialist.detail.no_listings_err': 'Este profesional aún no publicó servicios; no se puede iniciar la conversación todavía.',
  'specialist.detail.price_from': 'desde',
  'specialist.detail.per_hour': 'hora',
  'specialist.detail.per_job': 'trabajo',
  'specialist.detail.price_tbd': 'Precio a coordinar',
  'specialist.detail.ask_about': 'Consultar sobre este servicio',

  // clients list
  'clients.title': 'Pedidos',
  'clients.description': 'Pedidos de clientes en Asunción. Si ofrecés el servicio que buscan, escribiles directo.',
  'clients.heading': 'Pedidos abiertos',
  'clients.intro': 'Clientes que están buscando un profesional ahora. Para responder, iniciá sesión y abrí una conversación.',
  'clients.empty.title': 'Sin pedidos por ahora',
  'clients.empty.hint': 'Volvé más tarde o cambiá los filtros.',
  'clients.count.one': 'pedido abierto',
  'clients.count.many': 'pedidos abiertos',
  'clients.card.cta': 'Postularme →',

  // client (request) detail
  'request.detail.title': 'Pedido',
  'request.detail.status.open': 'Abierto',
  'request.detail.status.closed': 'Cerrado',
  'request.detail.locked': 'Para responder al pedido,',
  'request.detail.locked.cta': 'iniciá sesión',
  'request.detail.reply_btn': 'Postularme',
  'request.detail.compose_h': 'Postularme',
  'request.detail.compose.label': 'Mensaje al cliente',
  'request.detail.compose.placeholder': 'Hola, puedo encargarme…',

  // login
  'login.title': 'Iniciar sesión',
  'login.description': 'Entrá a PyaServ con tu email — sin contraseña. Código de 6 dígitos por correo.',
  'login.intro': 'Sin contraseñas — te mandamos un código de 6 dígitos por email.',
  'specialist.detail.description': 'Perfil del profesional en PyaServ. Contactá directo sin comisiones.',
  'request.detail.description': 'Pedido publicado por un cliente. Postulate sin comisión.',
  'login.email': 'Email',
  'login.email.placeholder': 'tunombre@correo.com',
  'login.send_code': 'Enviar código',
  'login.code': 'Código (6 dígitos)',
  'login.confirm': 'Confirmar',
  'login.change_email': 'Cambiar email',
  'login.sent_ok': 'Revisá tu email — buscá un código de 6 dígitos.',
  'login.success': '✓ Listo, redirigiendo…',

  // me / dashboard
  'me.title': 'Mi panel',
  'me.heading': 'Mi panel',
  'me.logout': 'Cerrar sesión',
  'me.tabs.aria': 'Secciones',
  'me.tabs.profile': '👤 Mi perfil',
  'me.tabs.listings': '🛠️ Mis servicios',
  'me.tabs.requests': '📢 Mis pedidos',
  'me.tabs.inquiries': '💬 Conversaciones',
  'me.tabs.stats': '📊 Estadísticas',
  'me.stats.h': 'Estadísticas',
  'me.stats.intro': 'Métricas de tu perfil — últimos 30 días.',
  'me.stats.empty': 'Aún no tenés perfil de profesional. Creá tu perfil para empezar a ver métricas.',
  'me.stats.profile_view': 'Vistas de perfil',
  'me.stats.phone_click': 'Clics en teléfono',
  'me.stats.whatsapp_click': 'Clics en WhatsApp',
  'me.stats.inquiries': 'Consultas recibidas',
  'me.stats.completed': 'Trabajos completados',
  'me.session_prefix': 'Sesión iniciada · userId',

  'me.profile.h': 'Perfil de profesional',
  'me.profile.intro': 'Si querés ofrecer servicios, completá tu perfil acá.',
  'me.profile.display_name': 'Nombre que mostramos',
  'me.profile.headline': 'Frase corta (headline)',
  'me.profile.headline.placeholder': 'Plomero 24h en Asunción',
  'me.profile.phone': 'Teléfono',
  'me.profile.phone.placeholder': '+595 981 234567',
  'me.profile.whatsapp': 'WhatsApp (opcional)',
  'me.profile.whatsapp.placeholder': '+595 981 234567',
  'me.profile.barrio': 'Barrio',
  'me.profile.barrio.placeholder': 'Villa Morra',
  'me.profile.bio': 'Bio',
  'me.profile.bio.placeholder': 'Contales tu experiencia, herramientas, zonas que cubrís…',
  'me.profile.saved': '✓ Perfil guardado',
  'me.profile.geoloc': '📍 Usar mi ubicación',
  'me.profile.geoloc.locating': 'Buscando ubicación…',
  'me.profile.geoloc.denied': 'Acceso a ubicación denegado',
  'me.profile.geoloc.unavailable': 'Geolocalización no disponible',
  'me.profile.completeness': 'Perfil completo: {pct}%',
  'me.profile.completeness.empty': 'Perfil completo: 0%',

  'me.listings.h': 'Mis servicios publicados',
  'me.listings.new': '+ Nuevo',
  'me.listings.empty_profile.title': 'Primero creá tu perfil',
  'me.listings.empty_profile.hint': 'Completá la pestaña «Mi perfil» antes de publicar.',
  'me.listings.empty.title': 'No publicaste servicios todavía',
  'me.listings.empty.hint': 'Tocá «+ Nuevo» arriba para empezar.',
  'me.listings.price_from': 'desde',
  'me.listings.confirm_delete': '¿Eliminar este servicio?',

  'me.requests.h': 'Mis pedidos como cliente',
  'me.requests.new': '+ Nuevo',
  'me.requests.empty.title': 'No publicaste pedidos abiertos',
  'me.requests.empty.hint': 'Si necesitás algo concreto, tocá «+ Nuevo».',
  'me.requests.status.open': 'Abierto',
  'me.requests.status.closed': 'Cerrado',
  'me.requests.public_view': 'Vista pública →',

  'me.inquiries.h': 'Conversaciones',
  'me.inquiries.empty.title': 'Sin conversaciones todavía',
  'me.inquiries.empty.hint': 'Cuando contactes a alguien o te contacten, aparecerán acá.',
  'me.inquiries.as_client': 'Como cliente',
  'me.inquiries.as_specialist': 'Como profesional',
  'me.inquiries.about_listing': 'Sobre un servicio',
  'me.inquiries.about_request': 'Sobre un pedido',

  // listing new/edit
  'listing.new.title': 'Nuevo servicio',
  'listing.new.back': '← Mis servicios',
  'listing.new.intro': 'Publicá un servicio concreto que ofrecés. Aparecerá en el catálogo público de profesionales filtrable por categoría.',
  'listing.field.category': 'Categoría',
  'listing.field.title': 'Título',
  'listing.field.title.placeholder': 'Reparación de calefones',
  'listing.field.description': 'Descripción',
  'listing.field.description.placeholder': 'Qué incluye el servicio, qué materiales, en qué zonas…',
  'listing.field.price_from': 'Precio desde (Gs, opcional)',
  'listing.field.price_from.short': 'Precio desde (Gs)',
  'listing.field.unit': 'Por',
  'listing.field.unit.none': '—',
  'listing.field.unit.hour': 'Hora',
  'listing.field.unit.job': 'Trabajo',
  'listing.new.submit': 'Publicar',
  'listing.edit.title': 'Editar servicio',
  'listing.edit.not_found': 'Servicio no encontrado o no es tuyo',
  'listing.edit.confirm_delete': '¿Eliminar definitivamente?',

  // request new/edit
  'request.new.title': 'Nuevo pedido',
  'request.new.back': '← Mis pedidos',
  'request.new.intro': 'Describí el trabajo que necesitás. Los profesionales relevantes podrán postularse — el contacto ocurre por mensaje privado.',
  'request.field.category': 'Categoría',
  'request.field.title': 'Título',
  'request.field.title.placeholder': 'Necesito plomero urgente',
  'request.field.description': 'Descripción',
  'request.field.description.placeholder': 'Qué hay que hacer, fecha aproximada, urgencia, particularidades…',
  'request.field.barrio': 'Barrio',
  'request.field.barrio.placeholder': 'Villa Morra',
  'request.field.budget': 'Presupuesto (Gs, opcional)',
  'request.field.budget.short': 'Presupuesto (Gs)',
  'request.field.status': 'Estado',
  'request.field.status.open': 'Abierto',
  'request.field.status.closed': 'Cerrado',
  'request.new.submit': 'Publicar pedido',
  'request.edit.title': 'Editar pedido',

  // inquiry detail
  'inquiry.detail.title': 'Conversación',
  'inquiry.detail.back': '← Conversaciones',
  'inquiry.detail.heading': 'Conversación',
  'inquiry.detail.view_subject': 'Ver publicación',
  'inquiry.detail.placeholder': 'Escribí un mensaje…',
  'inquiry.detail.about_listing': 'Sobre un servicio',
  'inquiry.detail.about_request': 'Sobre un pedido',
  'inquiry.back': '← Conversaciones',
  'inquiry.view_subject': 'Ver publicación',
  'inquiry.compose_placeholder': 'Escribí un mensaje…',
  'inquiry.subject_listing': 'Sobre un servicio',
  'inquiry.subject_request': 'Sobre un pedido',
  'inquiry.status_negotiating': 'Negociando',
  'inquiry.status_in_progress': 'En curso',
  'inquiry.status_done': 'Terminado',
  'inquiry.status_cancelled': 'Cancelado',
  'inquiry.btn_start': 'Comenzar trabajo',
  'inquiry.btn_done': 'Marcar terminado',
  'inquiry.btn_cancel': 'Cancelar',
  'inquiry.cancel_confirm': '¿Cancelar trabajo?',
  'inquiry.review_h': 'Calificar trabajo',
  'inquiry.review_body_label': 'Comentario (opcional)',
  'inquiry.review_body_placeholder': 'Contale a otros cómo fue.',
  'inquiry.review_submit': 'Enviar reseña',
  'inquiry.review_thanks': '¡Gracias por tu reseña!',

  // reviews on specialist detail
  'reviews.h': 'Reseñas',
  'reviews.empty': 'Sin reseñas todavía.',
  'reviews.avg_one': 'reseña',
  'reviews.avg_many': 'reseñas',

  // photo upload
  'media.upload': 'Subir foto',
  'media.uploading': 'Subiendo…',
  'media.replace': 'Cambiar foto',
  'media.remove': 'Quitar',
  'media.too_big': 'La imagen debe pesar menos de 5 MB.',
  'media.bad_type': 'Solo JPG, PNG o WebP.',

  // notifications
  'me.notifs.h': 'Notificaciones',
  'me.notifs.email': 'Recibir avisos por email',
  'me.notifs.saved': '✓ Preferencia guardada',

  // categories
  'category.plumbing': 'Plomería',
  'category.electrical': 'Electricidad',
  'category.cleaning': 'Limpieza',
  'category.repair': 'Reparaciones',
  'category.beauty': 'Belleza',
  'category.teaching': 'Clases',
  'category.photography': 'Fotografía',
  'category.translation': 'Traducción',
  'category.events': 'Eventos',
  'category.other': 'Otro',

  // time
  'time.now': 'ahora',
  'time.min_ago': 'hace {n} min',
  'time.hour_ago': 'hace {n} h',
  'time.day_ago': 'hace {n} d',

  // footer
  'foot.brother': 'hermano de PyaEats',
  'foot.built_on': 'construido sobre pya-platform',

  // errors
  'error.network': 'Error de red. Intentá de nuevo.',
}

export const EN: Dict = {
  // -------- common --------
  'common.loading': 'Loading…',
  'common.sending': 'Sending…',
  'common.saving': 'Saving…',
  'common.publishing': 'Publishing…',
  'common.verifying': 'Verifying…',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.send': 'Send',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.missing_id': 'Missing id',
  'common.price_tbd': 'To be agreed',
  'common.budget_tbd': 'To be agreed',
  'common.now': 'now',
  'common.no_description': '(no description)',

  // brand / chrome
  'brand.suffix': 'PyaServ',
  'brand.tagline_short': 'sibling of PyaEats',
  'brand.tagline_long': 'built on pya-platform',

  // nav
  'nav.menu_open': 'Open menu',
  'nav.primary_aria': 'Main',
  'nav.specialists': 'Specialists',
  'nav.clients': 'Requests',
  'nav.me': 'My dashboard',
  'nav.login': 'Sign in',
  'nav.lang_label': 'Language',
  'nav.lang_es': 'ES',
  'nav.lang_en': 'EN',
  'nav.lang_gn': 'GN',
  'nav.lang_es_aria': 'Switch to Spanish',
  'nav.lang_en_aria': 'Switch to English',
  'nav.lang_gn_aria': 'Switch to Guarani',
  'nav.theme_label': 'Toggle theme (light/dark/auto)',
  'nav.skip': 'Skip to content',

  // home
  'home.title': 'Services in Paraguay without fees',
  'home.description': 'PyaServ connects specialists with clients across Paraguay. No contact fees, no in-platform payments.',
  'home.hero.title': 'Services in Paraguay, no middlemen.',
  'home.hero.body': 'Whether you offer a service or you are looking for someone to get something done, PyaServ has a side for you. No fees for introducing — you close the deal directly.',
  'home.specialists.title': 'I need a specialist',
  'home.specialists.desc': 'Plumbers, electricians, tutors, hairdressers — search by neighborhood and category. Reach out directly when you decide.',
  'home.specialists.cta': 'Browse specialists →',
  'home.clients.title': 'I offer a service',
  'home.clients.desc': 'See open requests in your area. If it matches what you do, message them directly — no filters, no fee to apply.',
  'home.clients.cta': 'Browse requests →',
  'home.banner.html': '<strong>Status:</strong> MVP live. Create your specialist profile or your request from the <a data-banner-link>My dashboard</a> panel. If you do not have an account yet, we create one with your email — no passwords.',
  'home.banner.status_label': 'Status:',
  'home.banner.body': 'MVP live. Create your specialist profile or your request from the',
  'home.banner.cta': 'My dashboard',
  'home.banner.tail': 'If you do not have an account yet, we create one with your email — no passwords.',
  'home.stats': '<strong>{specs}</strong> active specialists · <strong>{reqs}</strong> open requests',

  // specialists list
  'specialists.title': 'Specialists',
  'specialists.description': 'Plumbers, electricians, hairdressers, tutors — find them in your neighborhood in Asunción.',
  'specialists.heading': 'Available specialists',
  'specialists.intro': 'Filter by category or neighborhood. Contact happens outside the platform; PyaServ only introduces.',
  'specialists.filter.category': 'Category',
  'specialists.filter.category.all': 'All',
  'specialists.filter.barrio': 'Neighborhood',
  'specialists.filter.barrio.placeholder': 'Villa Morra, Carmelitas…',
  'specialists.empty.title': 'Nothing here',
  'specialists.empty.hint': 'Try removing filters or changing the neighborhood.',
  'specialists.filter.near_me': '📍 Near me',
  'specialists.filter.near_me_on': '📍 Near me · on',
  'specialists.filter.near_me_denied': 'Location access denied',
  'specialists.count.one': 'specialist',
  'specialists.count.many': 'specialists',
  'specialists.card.verified': '✓ verified',
  'specialists.card.cta': 'View profile →',

  // specialist detail
  'specialist.detail.title': 'Profile',
  'specialist.detail.locked': 'To see contact details,',
  'specialist.detail.locked.cta': 'sign in',
  'specialist.detail.verified': '✓ Verified',
  'specialist.detail.contact_btn': 'Send message',
  'specialist.detail.services_h': 'Services offered',
  'specialist.detail.no_services.title': 'No services posted yet',
  'specialist.detail.compose_h': 'Message',
  'specialist.detail.compose.label': 'Message',
  'specialist.detail.compose.placeholder': 'Hi, I am interested…',
  'specialist.detail.no_listings_err': 'This specialist has not posted services yet; the conversation cannot be started.',
  'specialist.detail.price_from': 'from',
  'specialist.detail.per_hour': 'hour',
  'specialist.detail.per_job': 'job',
  'specialist.detail.price_tbd': 'Price to be agreed',
  'specialist.detail.ask_about': 'Ask about this service',

  // clients list
  'clients.title': 'Requests',
  'clients.description': 'Client requests in Asunción. If you offer the service they need, message them directly.',
  'clients.heading': 'Open requests',
  'clients.intro': 'Clients looking for a specialist right now. To reply, sign in and start a conversation.',
  'clients.empty.title': 'No requests right now',
  'clients.empty.hint': 'Check back later or change the filters.',
  'clients.count.one': 'open request',
  'clients.count.many': 'open requests',
  'clients.card.cta': 'Apply →',

  // client (request) detail
  'request.detail.title': 'Request',
  'request.detail.status.open': 'Open',
  'request.detail.status.closed': 'Closed',
  'request.detail.locked': 'To reply to this request,',
  'request.detail.locked.cta': 'sign in',
  'request.detail.reply_btn': 'Apply',
  'request.detail.compose_h': 'Apply',
  'request.detail.compose.label': 'Message to the client',
  'request.detail.compose.placeholder': 'Hi, I can take this on…',

  // login
  'login.title': 'Sign in',
  'login.description': 'Sign in to PyaServ with your email — no password. 6-digit code by email.',
  'login.intro': 'No passwords — we email you a 6-digit code.',
  'specialist.detail.description': 'Specialist profile on PyaServ. Reach out directly, no commissions.',
  'request.detail.description': 'Request posted by a client. Apply directly, no commission.',
  'login.email': 'Email',
  'login.email.placeholder': 'yourname@email.com',
  'login.send_code': 'Send code',
  'login.code': 'Code (6 digits)',
  'login.confirm': 'Confirm',
  'login.change_email': 'Change email',
  'login.sent_ok': 'Check your email — look for a 6-digit code.',
  'login.success': '✓ Done, redirecting…',

  // me / dashboard
  'me.title': 'My dashboard',
  'me.heading': 'My dashboard',
  'me.logout': 'Sign out',
  'me.tabs.aria': 'Sections',
  'me.tabs.profile': '👤 My profile',
  'me.tabs.listings': '🛠️ My services',
  'me.tabs.requests': '📢 My requests',
  'me.tabs.inquiries': '💬 Conversations',
  'me.tabs.stats': '📊 Stats',
  'me.stats.h': 'Stats',
  'me.stats.intro': 'Profile metrics — last 30 days.',
  'me.stats.empty': 'You don\'t have a specialist profile yet. Create one to start seeing metrics.',
  'me.stats.profile_view': 'Profile views',
  'me.stats.phone_click': 'Phone clicks',
  'me.stats.whatsapp_click': 'WhatsApp clicks',
  'me.stats.inquiries': 'Inquiries received',
  'me.stats.completed': 'Jobs completed',
  'me.session_prefix': 'Signed in · userId',

  'me.profile.h': 'Specialist profile',
  'me.profile.intro': 'If you want to offer services, fill out your profile here.',
  'me.profile.display_name': 'Display name',
  'me.profile.headline': 'Short tagline (headline)',
  'me.profile.headline.placeholder': '24/7 plumber in Asunción',
  'me.profile.phone': 'Phone',
  'me.profile.phone.placeholder': '+595 981 234567',
  'me.profile.whatsapp': 'WhatsApp (optional)',
  'me.profile.whatsapp.placeholder': '+595 981 234567',
  'me.profile.barrio': 'Neighborhood',
  'me.profile.barrio.placeholder': 'Villa Morra',
  'me.profile.bio': 'Bio',
  'me.profile.bio.placeholder': 'Tell about your experience, tools, areas you cover…',
  'me.profile.saved': '✓ Profile saved',
  'me.profile.geoloc': '📍 Use my location',
  'me.profile.geoloc.locating': 'Locating…',
  'me.profile.geoloc.denied': 'Location access denied',
  'me.profile.geoloc.unavailable': 'Geolocation unavailable',
  'me.profile.completeness': 'Profile complete: {pct}%',
  'me.profile.completeness.empty': 'Profile complete: 0%',

  'me.listings.h': 'My published services',
  'me.listings.new': '+ New',
  'me.listings.empty_profile.title': 'Create your profile first',
  'me.listings.empty_profile.hint': 'Fill out the “My profile” tab before publishing.',
  'me.listings.empty.title': 'You have not published services yet',
  'me.listings.empty.hint': 'Tap “+ New” above to start.',
  'me.listings.price_from': 'from',
  'me.listings.confirm_delete': 'Delete this service?',

  'me.requests.h': 'My requests as a client',
  'me.requests.new': '+ New',
  'me.requests.empty.title': 'You have no open requests',
  'me.requests.empty.hint': 'If you need something specific, tap “+ New”.',
  'me.requests.status.open': 'Open',
  'me.requests.status.closed': 'Closed',
  'me.requests.public_view': 'Public view →',

  'me.inquiries.h': 'Conversations',
  'me.inquiries.empty.title': 'No conversations yet',
  'me.inquiries.empty.hint': 'When you contact someone or they contact you, threads will appear here.',
  'me.inquiries.as_client': 'As client',
  'me.inquiries.as_specialist': 'As specialist',
  'me.inquiries.about_listing': 'About a service',
  'me.inquiries.about_request': 'About a request',

  // listing new/edit
  'listing.new.title': 'New service',
  'listing.new.back': '← My services',
  'listing.new.intro': 'Publish a concrete service you offer. It will appear in the public catalog of specialists, filterable by category.',
  'listing.field.category': 'Category',
  'listing.field.title': 'Title',
  'listing.field.title.placeholder': 'Water heater repair',
  'listing.field.description': 'Description',
  'listing.field.description.placeholder': 'What the service includes, materials, areas you cover…',
  'listing.field.price_from': 'Price from (Gs, optional)',
  'listing.field.price_from.short': 'Price from (Gs)',
  'listing.field.unit': 'Per',
  'listing.field.unit.none': '—',
  'listing.field.unit.hour': 'Hour',
  'listing.field.unit.job': 'Job',
  'listing.new.submit': 'Publish',
  'listing.edit.title': 'Edit service',
  'listing.edit.not_found': 'Service not found or not yours',
  'listing.edit.confirm_delete': 'Delete permanently?',

  // request new/edit
  'request.new.title': 'New request',
  'request.new.back': '← My requests',
  'request.new.intro': 'Describe the work you need. Relevant specialists will be able to apply — contact happens by private message.',
  'request.field.category': 'Category',
  'request.field.title': 'Title',
  'request.field.title.placeholder': 'Need a plumber urgently',
  'request.field.description': 'Description',
  'request.field.description.placeholder': 'What needs to be done, approximate date, urgency, details…',
  'request.field.barrio': 'Neighborhood',
  'request.field.barrio.placeholder': 'Villa Morra',
  'request.field.budget': 'Budget (Gs, optional)',
  'request.field.budget.short': 'Budget (Gs)',
  'request.field.status': 'Status',
  'request.field.status.open': 'Open',
  'request.field.status.closed': 'Closed',
  'request.new.submit': 'Publish request',
  'request.edit.title': 'Edit request',

  // inquiry detail
  'inquiry.detail.title': 'Conversation',
  'inquiry.detail.back': '← Conversations',
  'inquiry.detail.heading': 'Conversation',
  'inquiry.detail.view_subject': 'View post',
  'inquiry.detail.placeholder': 'Write a message…',
  'inquiry.detail.about_listing': 'About a service',
  'inquiry.detail.about_request': 'About a request',
  'inquiry.back': '← Conversations',
  'inquiry.view_subject': 'View post',
  'inquiry.compose_placeholder': 'Write a message…',
  'inquiry.subject_listing': 'About a service',
  'inquiry.subject_request': 'About a request',
  'inquiry.status_negotiating': 'Negotiating',
  'inquiry.status_in_progress': 'In progress',
  'inquiry.status_done': 'Done',
  'inquiry.status_cancelled': 'Cancelled',
  'inquiry.btn_start': 'Start work',
  'inquiry.btn_done': 'Mark done',
  'inquiry.btn_cancel': 'Cancel',
  'inquiry.cancel_confirm': 'Cancel this work?',
  'inquiry.review_h': 'Rate the work',
  'inquiry.review_body_label': 'Comment (optional)',
  'inquiry.review_body_placeholder': 'Tell others how it went.',
  'inquiry.review_submit': 'Submit review',
  'inquiry.review_thanks': 'Thanks for your review!',

  // reviews on specialist detail
  'reviews.h': 'Reviews',
  'reviews.empty': 'No reviews yet.',
  'reviews.avg_one': 'review',
  'reviews.avg_many': 'reviews',

  // photo upload
  'media.upload': 'Upload photo',
  'media.uploading': 'Uploading…',
  'media.replace': 'Replace photo',
  'media.remove': 'Remove',
  'media.too_big': 'Image must be under 5 MB.',
  'media.bad_type': 'Only JPG, PNG or WebP.',

  // notifications
  'me.notifs.h': 'Notifications',
  'me.notifs.email': 'Receive email notifications',
  'me.notifs.saved': '✓ Preference saved',

  // categories
  'category.plumbing': 'Plumbing',
  'category.electrical': 'Electrical',
  'category.cleaning': 'Cleaning',
  'category.repair': 'Repairs',
  'category.beauty': 'Beauty',
  'category.teaching': 'Lessons',
  'category.photography': 'Photography',
  'category.translation': 'Translation',
  'category.events': 'Events',
  'category.other': 'Other',

  // time
  'time.now': 'now',
  'time.min_ago': '{n} min ago',
  'time.hour_ago': '{n} h ago',
  'time.day_ago': '{n} d ago',

  // footer
  'foot.brother': 'sibling of PyaEats',
  'foot.built_on': 'built on pya-platform',

  // errors
  'error.network': 'Network error. Please try again.',
}

// GN (Guaraní) — sparse dictionary per spec decision 2.2:
// only emotional CTAs and high-impact phrases are translated; everything
// else falls back to Spanish via tFor()'s `?? DICT.es[key]` chain. Pure
// Spanish is kept for SEO-bearing strings (categories, page titles).
//
// Source: short well-known Guaraní/jopará phrases verified by native PY
// reference. Expanded as the product grows and we hire a translator.
export const GN: Dict = {
  // nav
  'nav.lang_label': 'Ñeʼeʼ',                                // "language"
  'nav.lang_es': 'ES',
  'nav.lang_en': 'EN',
  'nav.lang_gn': 'GN',

  // home — hero (high-impact CTA strings)
  'home.specialists.cta': 'Mbaʼe reheka? →',                // "What are you looking for?"
  'home.clients.cta': 'Remeʼe mbaʼe? →',               // "Do you offer something?"

  // me — positive feedback after save
  'me.profile.saved': 'I porã ✓ Mbohasapyre',               // "All good ✓ Saved"
  'login.success': 'I porã ✓ Roho hína…',              // "All good ✓ Going…"
}

const DICT: Readonly<Record<Locale, Dict>> = { es: ES, en: EN, gn: GN }

// Fallback chain: requested locale → Spanish (canonical source) → raw key.
// This makes GN safe to use even with a sparse dictionary: any missing key
// renders as the Spanish version rather than the raw `'nav.skip'` key.
export const t = (key: string): string => tFor(getLocale(), key)

export const tFor = (loc: Locale, key: string): string =>
  DICT[loc][key] ?? DICT.es[key] ?? key

export const interp = (template: string, vars: Readonly<Record<string, string | number>>): string =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`))

// ---------- formatting helpers (locale-aware) ----------

const CURRENCY_LOCALE: Readonly<Record<Locale, string>> = { es: 'es-PY', en: 'en-US', gn: 'es-PY' }

export const formatGs = (gs: number | null | undefined): string => {
  if (gs === undefined || gs === null) return t('common.price_tbd')
  const n = new Intl.NumberFormat(CURRENCY_LOCALE[getLocale()], { maximumFractionDigits: 0 }).format(gs)
  return `${n} Gs`
}

export const formatRelativeTime = (unixSeconds: number): string => {
  const now = Math.floor(Date.now() / 1000)
  const delta = now - unixSeconds
  const loc = getLocale()
  if (delta < 60) return tFor(loc, 'time.now')
  if (delta < 3600) return interp(tFor(loc, 'time.min_ago'), { n: Math.floor(delta / 60) })
  if (delta < 86400) return interp(tFor(loc, 'time.hour_ago'), { n: Math.floor(delta / 3600) })
  if (delta < 604800) return interp(tFor(loc, 'time.day_ago'), { n: Math.floor(delta / 86400) })
  return new Date(unixSeconds * 1000).toLocaleDateString(CURRENCY_LOCALE[loc], { day: '2-digit', month: 'short', year: 'numeric' })
}

// ---------- DOM apply ----------

// Walks the document and replaces:
//  - textContent for [data-i18n="key"]
//  - placeholder  for [data-i18n-placeholder="key"]
//  - aria-label   for [data-i18n-aria="key"]
//  - innerHTML    for [data-i18n-html="key"]
export const applyI18n = (root: ParentNode = document): void => {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset.i18n
    if (key) el.textContent = t(key)
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]')) {
    const key = el.dataset.i18nPlaceholder
    if (key && 'placeholder' in el) {
      ;(el as HTMLInputElement | HTMLTextAreaElement).placeholder = t(key)
    }
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const key = el.dataset.i18nAria
    if (key) el.setAttribute('aria-label', t(key))
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-html]')) {
    const key = el.dataset.i18nHtml
    if (key) el.innerHTML = t(key)
  }
}
