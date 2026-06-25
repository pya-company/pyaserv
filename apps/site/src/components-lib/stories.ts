/* Storybook-lite registry. Adding a new component = appending one entry. */

export interface Knob {
  readonly path: string
  readonly type: 'text' | 'number' | 'boolean' | 'select' | 'textarea'
  readonly label: string
  readonly options?: ReadonlyArray<string>
}

export interface Story {
  readonly id: string
  readonly name: string
  readonly level: 'atom' | 'molecule' | 'organism'
  readonly description: string
  readonly initialProps: Record<string, unknown>
  readonly knobs: ReadonlyArray<Knob>
}

export const STORIES: ReadonlyArray<Story> = [
  {
    id: 'button', name: 'Button', level: 'atom',
    description: 'Базовая кнопка с вариантами / размерами / иконкой.',
    initialProps: { label: 'Click me', variant: 'primary', size: 'md', disabled: false },
    knobs: [
      { path: 'label', type: 'text', label: 'label' },
      { path: 'variant', type: 'select', label: 'variant', options: ['primary', 'ghost', 'whatsapp', 'danger'] },
      { path: 'size', type: 'select', label: 'size', options: ['sm', 'md', 'lg'] },
      { path: 'icon', type: 'text', label: 'icon (opcional)' },
      { path: 'disabled', type: 'boolean', label: 'disabled' },
    ],
  },
  {
    id: 'badge-pill', name: 'BadgePill', level: 'atom',
    description: 'Pill-badge с rarity.',
    initialProps: { label: 'Velocista', rarity: 'rare', earned: true },
    knobs: [
      { path: 'label', type: 'text', label: 'label' },
      { path: 'rarity', type: 'select', label: 'rarity', options: ['common', 'rare', 'epic', 'legendary'] },
      { path: 'earned', type: 'boolean', label: 'earned' },
    ],
  },
  {
    id: 'avatar-circle', name: 'AvatarCircle', level: 'atom',
    description: 'Круглый аватар.',
    initialProps: { initials: 'JP', size: 96, borderColor: 'white' },
    knobs: [
      { path: 'initials', type: 'text', label: 'initials (если без src)' },
      { path: 'src', type: 'text', label: 'src (URL фото)' },
      { path: 'size', type: 'number', label: 'size (px)' },
      { path: 'borderColor', type: 'text', label: 'borderColor (CSS color)' },
    ],
  },
  {
    id: 'tier-label', name: 'TierLabel', level: 'atom',
    description: 'Лейбл уровня специалиста.',
    initialProps: { tier: 'maestro', label: 'Maestro' },
    knobs: [
      { path: 'tier', type: 'select', label: 'tier', options: ['aprendiz', 'oficial', 'maestro', 'maestro_mayor', 'patron'] },
      { path: 'label', type: 'text', label: 'label (отображаемое)' },
    ],
  },
  {
    id: 'star-rating', name: 'StarRating', level: 'atom',
    description: 'Звёзды + опц. количество.',
    initialProps: { value: 4.8, count: 12 },
    knobs: [
      { path: 'value', type: 'number', label: 'value (0–5)' },
      { path: 'count', type: 'number', label: 'count' },
    ],
  },
  {
    id: 'progress-bar', name: 'ProgressBar', level: 'atom',
    description: 'Бар прогресса 0–100%.',
    initialProps: { pct: 60, height: 8 },
    knobs: [
      { path: 'pct', type: 'number', label: 'pct (0–100)' },
      { path: 'height', type: 'number', label: 'height (px)' },
      { path: 'accent', type: 'text', label: 'accent (CSS gradient или color)' },
    ],
  },
  {
    id: 'tag', name: 'Tag', level: 'atom',
    description: 'Цветной chip.',
    initialProps: { label: 'live', color: 'green' },
    knobs: [
      { path: 'label', type: 'text', label: 'label' },
      { path: 'color', type: 'select', label: 'color', options: ['gray', 'indigo', 'amber', 'green', 'red'] },
    ],
  },
  {
    id: 'service-item', name: 'ServiceItem', level: 'molecule',
    description: 'Услуга с диапазоном цены.',
    initialProps: { name: 'Destape de cañería', priceMin: 80000, priceMax: 150000 },
    knobs: [
      { path: 'name', type: 'text', label: 'name' },
      { path: 'priceMin', type: 'number', label: 'priceMin (Gs)' },
      { path: 'priceMax', type: 'number', label: 'priceMax (Gs)' },
    ],
  },
  {
    id: 'quest-row', name: 'QuestRow', level: 'molecule',
    description: 'Строка квеста.',
    initialProps: { title: 'Respondé 1 lead', currentProgress: 0, goal: 1, rewardXp: 10, done: false },
    knobs: [
      { path: 'title', type: 'text', label: 'title' },
      { path: 'currentProgress', type: 'number', label: 'currentProgress' },
      { path: 'goal', type: 'number', label: 'goal' },
      { path: 'rewardXp', type: 'number', label: 'rewardXp' },
      { path: 'done', type: 'boolean', label: 'done' },
    ],
  },
  {
    id: 'badge-tile', name: 'BadgeTile', level: 'molecule',
    description: 'Плитка badge для grid.',
    initialProps: { name: 'Estrella del barrio', description: 'Top 3 por reseñas', rarity: 'epic', earned: true },
    knobs: [
      { path: 'name', type: 'text', label: 'name' },
      { path: 'description', type: 'text', label: 'description' },
      { path: 'rarity', type: 'select', label: 'rarity', options: ['common', 'rare', 'epic', 'legendary'] },
      { path: 'earned', type: 'boolean', label: 'earned' },
    ],
  },
  {
    id: 'metric-cell', name: 'MetricCell', level: 'molecule',
    description: 'Ячейка HUD.',
    initialProps: { value: '1.247', label: 'XP' },
    knobs: [
      { path: 'value', type: 'text', label: 'value' },
      { path: 'label', type: 'text', label: 'label' },
      { path: 'streakClass', type: 'select', label: 'streakClass', options: ['', 'hot', 'red', 'gold'] },
    ],
  },
  {
    id: 'feature-card', name: 'FeatureCard', level: 'molecule',
    description: 'Карточка фичи в /docs/.',
    initialProps: {
      code: 'A', title: 'Tu perfil público',
      description: 'Página propia con URL pyaserv.com/p/<tu-slug>. Foto, portada, bio, servicios, badges, horario, botón directo a WhatsApp.',
      status: 'live', statusLabel: 'En vivo',
      demoUrl: '/me/?demo=1&tour=T1', realUrl: '/p/maria-gonzalez-019ecf',
    },
    knobs: [
      { path: 'code', type: 'text', label: 'code' },
      { path: 'title', type: 'text', label: 'title' },
      { path: 'description', type: 'textarea', label: 'description' },
      { path: 'status', type: 'select', label: 'status', options: ['live', 'demo', 'soon'] },
      { path: 'statusLabel', type: 'text', label: 'statusLabel' },
      { path: 'demoUrl', type: 'text', label: 'demoUrl' },
      { path: 'realUrl', type: 'text', label: 'realUrl' },
    ],
  },
  {
    id: 'review-card', name: 'ReviewCard', level: 'molecule',
    description: 'Отзыв клиента.',
    initialProps: { author: 'Carlos M.', stars: 5, when: 'hace 2 semanas', body: 'Excelente trabajo, rápido y limpio.' },
    knobs: [
      { path: 'author', type: 'text', label: 'author' },
      { path: 'stars', type: 'number', label: 'stars (1-5)' },
      { path: 'when', type: 'text', label: 'when' },
      { path: 'body', type: 'textarea', label: 'body' },
    ],
  },
  {
    id: 'area-chip', name: 'AreaChip', level: 'molecule',
    description: 'Чип района.',
    initialProps: { name: 'Villa Morra', isPrimary: false },
    knobs: [
      { path: 'name', type: 'text', label: 'name' },
      { path: 'isPrimary', type: 'boolean', label: 'isPrimary' },
    ],
  },
  {
    id: 'whatsapp-cta', name: 'WhatsAppCta', level: 'molecule',
    description: 'Кнопка WhatsApp.',
    initialProps: { href: 'https://wa.me/595981000000', label: 'Contactar por WhatsApp' },
    knobs: [
      { path: 'href', type: 'text', label: 'href' },
      { path: 'label', type: 'text', label: 'label' },
    ],
  },
  {
    id: 'profile-header', name: 'ProfileHeader', level: 'organism',
    description: 'Шапка профиля целиком.',
    initialProps: {
      displayName: 'Juan Pérez', tier: 'maestro', tierLabel: 'Maestro',
      headline: 'Plomero matriculado', barrio: 'Villa Morra',
      ratingValue: 4.8, ratingCount: 12, responseTimeLabel: 'Responde en <10 min',
      verifiedWa: true, verifiedCedula: false,
    },
    knobs: [
      { path: 'displayName', type: 'text', label: 'displayName' },
      { path: 'tier', type: 'select', label: 'tier', options: ['aprendiz', 'oficial', 'maestro', 'maestro_mayor', 'patron'] },
      { path: 'tierLabel', type: 'text', label: 'tierLabel' },
      { path: 'headline', type: 'text', label: 'headline' },
      { path: 'barrio', type: 'text', label: 'barrio' },
      { path: 'ratingValue', type: 'number', label: 'ratingValue' },
      { path: 'ratingCount', type: 'number', label: 'ratingCount' },
      { path: 'responseTimeLabel', type: 'text', label: 'responseTimeLabel' },
      { path: 'verifiedWa', type: 'boolean', label: 'verifiedWa' },
      { path: 'verifiedCedula', type: 'boolean', label: 'verifiedCedula' },
    ],
  },
  {
    id: 'game-hud', name: 'GameHUD', level: 'organism',
    description: 'XP / Racha / Tier в /me/.',
    initialProps: { xp: 1247, tierShort: 'Maestro', streakDays: 14 },
    knobs: [
      { path: 'xp', type: 'number', label: 'xp' },
      { path: 'tierShort', type: 'text', label: 'tierShort' },
      { path: 'streakDays', type: 'number', label: 'streakDays' },
      { path: 'tierLabel', type: 'text', label: 'tierLabel (нижний)' },
      { path: 'xpLabel', type: 'text', label: 'xpLabel' },
      { path: 'streakLabel', type: 'text', label: 'streakLabel' },
    ],
  },
  {
    id: 'completeness-bar', name: 'CompletenessBar', level: 'organism',
    description: 'Расширенный 10-step completeness.',
    initialProps: { pct: 60, done: 6, total: 10, nextHint: 'Falta: portfolio (3 fotos), horario, RUC' },
    knobs: [
      { path: 'pct', type: 'number', label: 'pct' },
      { path: 'done', type: 'number', label: 'done' },
      { path: 'total', type: 'number', label: 'total' },
      { path: 'nextHint', type: 'text', label: 'nextHint' },
      { path: 'title', type: 'text', label: 'title (опц.)' },
    ],
  },
  {
    id: 'profile-public', name: 'ProfilePublicView', level: 'organism',
    description: 'Целая страница /p/<slug> по props.',
    initialProps: {
      header: { displayName: 'Juan Pérez', tier: 'maestro', tierLabel: 'Maestro', headline: 'Plomero', barrio: 'Villa Morra', ratingValue: 4.8, ratingCount: 12, responseTimeLabel: 'Responde en <10 min', verifiedWa: true },
      bio: 'Plomero con 10 años de experiencia en Villa Morra.',
      services: [{ name: 'Destape', priceMin: 80000 }, { name: 'Calentador', priceMin: 250000, priceMax: 600000 }],
      areas: [{ name: 'Villa Morra', isPrimary: true }, { name: 'Carmelitas' }, { name: 'Recoleta' }],
      badges: [{ label: 'Velocista', rarity: 'rare' }, { label: '10 trabajos', rarity: 'common' }],
      reviews: [{ author: 'Carlos M.', stars: 5, when: 'hace 2 semanas', body: 'Excelente trabajo.' }],
      whatsAppHref: 'https://wa.me/595981000000',
    },
    knobs: [
      { path: 'bio', type: 'textarea', label: 'bio' },
      { path: 'whatsAppHref', type: 'text', label: 'whatsAppHref' },
      { path: 'whatsAppLabel', type: 'text', label: 'whatsAppLabel' },
    ],
  },
]
