import {
  AreaChip, AvatarCircle, BadgePill, MetricCell, ProgressBar,
  ReviewCard, ServiceItem, StarRating, TierLabel, WhatsAppCta,
} from './molecules.ts'
import { escapeHtml } from './escape.ts'

/* ===== ProfileHeader ===== */
export interface ProfileHeaderProps {
  readonly displayName: string
  readonly tier: 'aprendiz' | 'oficial' | 'maestro' | 'maestro_mayor' | 'patron'
  readonly tierLabel: string
  readonly headline?: string
  readonly barrio?: string
  readonly photo?: string | null
  readonly ratingValue?: number
  readonly ratingCount?: number
  readonly responseTimeLabel?: string  // "Responde en <10 min"
  readonly verifiedWa?: boolean
  readonly verifiedCedula?: boolean
}
export const ProfileHeader = (p: ProfileHeaderProps): string => {
  const meta = [p.headline, p.barrio].filter(Boolean).join(' · ')
  const stars = p.ratingCount && p.ratingValue
    ? `<span>${StarRating({ value: p.ratingValue, count: p.ratingCount })}</span>` : ''
  const respTime = p.responseTimeLabel ? `<span>· ${escapeHtml(p.responseTimeLabel)}</span>` : ''
  const badges: string[] = []
  if (p.verifiedWa) badges.push(BadgePill({ label: '✓ WhatsApp verificado', rarity: 'common' }))
  if (p.verifiedCedula) badges.push(BadgePill({ label: '✓ Cédula verificada', rarity: 'rare' }))
  return `<div class="cl-profile-header">
    ${AvatarCircle({ src: p.photo, initials: p.displayName.slice(0, 2).toUpperCase(), size: 96, borderColor: 'white' })}
    <h1 class="cl-profile-header__name">
      ${escapeHtml(p.displayName)}
      ${TierLabel({ tier: p.tier, label: p.tierLabel })}
    </h1>
    ${meta ? `<p class="cl-profile-header__meta">${escapeHtml(meta)}</p>` : ''}
    <div class="cl-profile-header__stats">${stars}${respTime}</div>
    ${badges.length ? `<div class="cl-profile-header__badges">${badges.join(' ')}</div>` : ''}
  </div>`
}

/* ===== GameHUD ===== */
export interface GameHUDProps {
  readonly xp: number
  readonly tierShort: string         // "Maestro", "Aprendiz"
  readonly tierIcon?: string
  readonly streakDays: number
  readonly streakLabel?: string      // 'Racha'
  readonly xpLabel?: string
  readonly tierLabel?: string
}
export const GameHUD = (p: GameHUDProps): string => {
  const streakClass: 'hot' | 'red' | 'gold' | '' =
    p.streakDays >= 100 ? 'gold' : p.streakDays >= 30 ? 'red' : p.streakDays >= 7 ? 'hot' : ''
  return `<div class="cl-game-hud">
    ${MetricCell({ value: String(p.xp), label: p.xpLabel ?? 'XP' })}
    ${MetricCell({ value: `🔥 ${p.streakDays} d`, label: p.streakLabel ?? 'Racha', streakClass })}
    ${MetricCell({ value: `${p.tierIcon ?? '⚡'} ${p.tierShort}`, label: p.tierLabel ?? '' })}
  </div>`
}

/* ===== CompletenessBar ===== */
export interface CompletenessBarProps {
  readonly pct: number
  readonly done: number
  readonly total: number
  readonly nextHint?: string
  readonly title?: string
}
export const CompletenessBar = (p: CompletenessBarProps): string => {
  return `<div class="cl-completeness">
    <div class="cl-completeness__top">
      <span class="cl-completeness__title">${escapeHtml(p.title ?? `Perfil ${p.pct}% completo`)}</span>
      <span class="cl-completeness__pct">${p.done}/${p.total}</span>
    </div>
    ${ProgressBar({ pct: p.pct })}
    ${p.nextHint ? `<div class="cl-completeness__next">${escapeHtml(p.nextHint)}</div>` : ''}
  </div>`
}

/* ===== ProfilePublicView — полная страница профиля по props ===== */
export interface ProfilePublicViewProps {
  readonly header: ProfileHeaderProps
  readonly bio?: string
  readonly services?: ReadonlyArray<{ name: string; priceMin?: number | null; priceMax?: number | null }>
  readonly areas?: ReadonlyArray<{ name: string; isPrimary?: boolean }>
  readonly portfolio?: ReadonlyArray<{ url: string }>
  readonly badges?: ReadonlyArray<{ label: string; rarity: 'common' | 'rare' | 'epic' | 'legendary' }>
  readonly reviews?: ReadonlyArray<ReviewCardProps>
  readonly whatsAppHref?: string
  readonly whatsAppLabel?: string
  readonly sectionLabels?: {
    bio?: string
    services?: string
    areas?: string
    portfolio?: string
    badges?: string
    reviews?: string
  }
}
export interface ReviewCardProps { author: string; stars: number; when: string; body: string }
export const ProfilePublicView = (p: ProfilePublicViewProps): string => {
  const L = p.sectionLabels ?? {}
  const sec = (title: string, body: string): string => `<section class="cl-profile-section">
    <h3>${escapeHtml(title)}</h3>${body}
  </section>`
  const parts: string[] = [ProfileHeader(p.header)]
  if (p.whatsAppHref) parts.push(`<div class="cl-profile-cta">${WhatsAppCta({ href: p.whatsAppHref, label: p.whatsAppLabel ?? 'Contactar por WhatsApp' })}</div>`)
  if (p.bio) parts.push(sec(L.bio ?? 'Sobre mí', `<p>${escapeHtml(p.bio)}</p>`))
  if (p.services?.length) parts.push(sec(L.services ?? 'Servicios', `<ul class="cl-profile-services">${p.services.map(ServiceItem).join('')}</ul>`))
  if (p.areas?.length) parts.push(sec(L.areas ?? 'Zonas de trabajo', `<div class="cl-profile-areas">${p.areas.map(AreaChip).join('')}</div>`))
  if (p.portfolio?.length) parts.push(sec(L.portfolio ?? 'Trabajos', `<div class="cl-profile-portfolio">${p.portfolio.slice(0, 9).map((ph) => `<div style="background-image:url(${ph.url})"></div>`).join('')}</div>`))
  if (p.badges?.length) parts.push(sec(L.badges ?? 'Insignias', `<div class="cl-profile-badges">${p.badges.map(BadgePill).join(' ')}</div>`))
  if (p.reviews?.length) parts.push(sec(L.reviews ?? 'Reseñas', p.reviews.map(ReviewCard).join('')))
  return `<div class="cl-profile-wrap">${parts.join('')}</div>`
}

/* Re-exports */
export { AreaChip, AvatarCircle, BadgePill, MetricCell, ProgressBar, ReviewCard, ServiceItem, StarRating, TierLabel, WhatsAppCta }
