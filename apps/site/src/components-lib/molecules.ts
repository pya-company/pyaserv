import { AvatarCircle, BadgePill, Button, Icon, ProgressBar, StarRating, Tag, TierLabel } from './atoms.ts'
import { escapeAttr, escapeHtml } from './escape.ts'

/* ===== ServiceItem ===== */
export interface ServiceItemProps {
  readonly name: string
  readonly priceMin?: number | null
  readonly priceMax?: number | null
  readonly currency?: string      // default 'PYG'
}
const fmt = (n: number, locale = 'es-PY'): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n) + ' Gs'

export const ServiceItem = (p: ServiceItemProps): string => {
  const price = p.priceMin && p.priceMax && p.priceMin !== p.priceMax
    ? `${fmt(p.priceMin)} – ${fmt(p.priceMax)}`
    : p.priceMin ? `Desde ${fmt(p.priceMin)}`
    : 'A coordinar'
  return `<li class="cl-service">
    <span class="cl-service__name">${escapeHtml(p.name)}</span>
    <span class="cl-service__price">${escapeHtml(price)}</span>
  </li>`
}

/* ===== QuestRow ===== */
export interface QuestRowProps {
  readonly title: string
  readonly currentProgress: number
  readonly goal: number
  readonly rewardXp: number
  readonly done?: boolean
}
export const QuestRow = (p: QuestRowProps): string => {
  const done = p.done ?? p.currentProgress >= p.goal
  return `<div class="cl-quest" data-done="${done ? '1' : ''}">
    <div class="cl-quest__check">${done ? '✓' : ''}</div>
    <div class="cl-quest__title">${escapeHtml(p.title)} <span class="cl-quest__progress">(${p.currentProgress}/${p.goal})</span></div>
    <div class="cl-quest__reward">+${p.rewardXp} XP</div>
  </div>`
}

/* ===== BadgeTile (для grid'а в /me/?tab=game) ===== */
export interface BadgeTileProps {
  readonly name: string
  readonly description: string
  readonly rarity: 'common' | 'rare' | 'epic' | 'legendary'
  readonly earned: boolean
}
export const BadgeTile = (p: BadgeTileProps): string => {
  const dim = p.earned ? '' : 'opacity:0.4;filter:grayscale(1);'
  return `<div class="cl-badge-tile cl-badge-tile--${p.rarity}" title="${escapeAttr(p.description)}" style="${dim}">
    <div class="cl-badge-tile__icon">${p.earned ? '🏆' : '🔒'}</div>
    <div class="cl-badge-tile__name">${escapeHtml(p.name)}</div>
    <div class="cl-badge-tile__rarity">${escapeHtml(p.rarity)}</div>
  </div>`
}

/* ===== MetricCell (HUD ячейка) ===== */
export interface MetricCellProps {
  readonly value: string          // formatted already, e.g. "1.247" or "🔥 14 d"
  readonly label: string
  readonly streakClass?: 'hot' | 'red' | 'gold' | ''
}
export const MetricCell = (p: MetricCellProps): string => {
  const dataStreak = p.streakClass ? ` data-streak="${escapeAttr(p.streakClass)}"` : ''
  return `<div class="cl-metric"${dataStreak}>
    <div class="cl-metric__value">${escapeHtml(p.value)}</div>
    <div class="cl-metric__label">${escapeHtml(p.label)}</div>
  </div>`
}

/* ===== FeatureCard (для /docs/) ===== */
export interface FeatureCardProps {
  readonly code: string
  readonly title: string
  readonly description: string
  readonly status: 'live' | 'demo' | 'soon'
  readonly statusLabel: string
  readonly demoUrl?: string
  readonly realUrl?: string
  readonly docUrl?: string
  readonly demoLabel?: string
  readonly realLabel?: string
  readonly docLabel?: string
  readonly soonLabel?: string
}
export const FeatureCard = (p: FeatureCardProps): string => {
  const actions: string[] = []
  if (p.docUrl) actions.push(Button({ label: p.docLabel ?? 'Más detalles →', variant: 'primary', size: 'sm', href: p.docUrl }))
  if (p.demoUrl) actions.push(Button({ label: p.demoLabel ?? 'Probar demo →', variant: 'ghost', size: 'sm', href: p.demoUrl }))
  if (p.realUrl) actions.push(Button({ label: p.realLabel ?? 'Ver real →', variant: 'ghost', size: 'sm', href: p.realUrl }))
  if (actions.length === 0) actions.push(Button({ label: p.soonLabel ?? 'Próximamente', size: 'sm', disabled: true }))
  return `<article class="cl-feature-card">
    <header class="cl-feature-card__header">
      <h3 class="cl-feature-card__title">${escapeHtml(p.code)} · ${escapeHtml(p.title)}</h3>
      <span class="cl-feature-card__status" data-status="${escapeAttr(p.status)}">${escapeHtml(p.statusLabel)}</span>
    </header>
    <p class="cl-feature-card__desc">${escapeHtml(p.description)}</p>
    <div class="cl-feature-card__actions">${actions.join('')}</div>
  </article>`
}

/* ===== ReviewCard ===== */
export interface ReviewCardProps {
  readonly author: string
  readonly stars: number
  readonly when: string
  readonly body: string
}
export const ReviewCard = (p: ReviewCardProps): string => {
  const starRow = '★'.repeat(p.stars) + '☆'.repeat(5 - p.stars)
  return `<div class="cl-review">
    <div class="cl-review__head"><strong>${escapeHtml(p.author)}</strong> · ${escapeHtml(starRow)} · <span class="cl-review__when">${escapeHtml(p.when)}</span></div>
    <p class="cl-review__body">${escapeHtml(p.body)}</p>
  </div>`
}

/* ===== AreaChip ===== */
export interface AreaChipProps {
  readonly name: string
  readonly isPrimary?: boolean
}
export const AreaChip = (p: AreaChipProps): string => {
  const cls = p.isPrimary ? 'cl-area-chip cl-area-chip--primary' : 'cl-area-chip'
  return `<span class="${cls}">${escapeHtml(p.name)}</span>`
}

/* ===== WhatsAppCta ===== */
export interface WhatsAppCtaProps {
  readonly href: string
  readonly label: string
}
export const WhatsAppCta = (p: WhatsAppCtaProps): string => `
  <a href="${escapeAttr(p.href)}" class="cl-wa-cta">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2a9.86 9.86 0 0 0-8.49 14.78L2 22l5.36-1.5a9.83 9.83 0 0 0 4.68 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01Z"/>
    </svg>
    ${escapeHtml(p.label)}
  </a>`

/* Re-export atoms for convenience */
export { AvatarCircle, BadgePill, Button, Icon, ProgressBar, StarRating, Tag, TierLabel }
