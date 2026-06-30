/* atoms.ts — атомарные render-функции. Каждая = чистая (props) => HTML.
 * Никаких побочных эффектов, никаких fetch, никаких глобалок.
 * Композируйте через шаблонные строки в molecules.ts.
 */
import { escapeAttr, escapeHtml } from './escape.ts'

/* ===== Button ===== */
export interface ButtonProps {
  readonly label: string
  readonly variant?: 'primary' | 'ghost' | 'whatsapp' | 'danger'
  readonly size?: 'sm' | 'md' | 'lg'
  readonly icon?: string
  readonly href?: string
  readonly disabled?: boolean
  readonly testId?: string
}
export const Button = (p: ButtonProps): string => {
  const variant = p.variant ?? 'primary'
  const size = p.size ?? 'md'
  const tag = p.href ? 'a' : 'button'
  const cls = `cl-btn cl-btn--${variant} cl-btn--${size}`
  const href = p.href ? ` href="${escapeAttr(p.href)}"` : ''
  const type = p.href ? '' : ' type="button"'
  const dis = p.disabled ? ' disabled aria-disabled="true"' : ''
  const tid = p.testId ? ` data-testid="${escapeAttr(p.testId)}"` : ''
  const icon = p.icon ? `<span class="cl-btn__icon" aria-hidden="true">${escapeHtml(p.icon)}</span>` : ''
  return `<${tag} class="${cls}"${href}${type}${dis}${tid}>${icon}${escapeHtml(p.label)}</${tag}>`
}

/* ===== BadgePill ===== */
export interface BadgePillProps {
  readonly label: string
  readonly rarity?: 'common' | 'rare' | 'epic' | 'legendary'
  readonly icon?: string
  readonly earned?: boolean
}
export const BadgePill = (p: BadgePillProps): string => {
  const rarity = p.rarity ?? 'common'
  const earned = p.earned !== false
  const dim = earned ? '' : ' style="opacity:0.4;filter:grayscale(1);"'
  const icon = p.icon ? `<span aria-hidden="true">${escapeHtml(p.icon)}</span>` : ''
  return `<span class="cl-badge cl-badge--${rarity}"${dim}>${icon}${escapeHtml(p.label)}</span>`
}

/* ===== AvatarCircle ===== */
export interface AvatarCircleProps {
  readonly src?: string | null
  readonly initials?: string
  readonly size?: number
  readonly borderColor?: string
}
export const AvatarCircle = (p: AvatarCircleProps): string => {
  const size = p.size ?? 96
  const bg = p.src ? `background-image:url(${escapeAttr(p.src)});background-size:cover;background-position:center;` : 'background:#e5e7eb;'
  const border = p.borderColor ? `border:4px solid ${escapeAttr(p.borderColor)};` : ''
  const inner = p.src ? '' : `<span aria-hidden="true">${escapeHtml(p.initials ?? '⬤')}</span>`
  return `<div class="cl-avatar" style="width:${size}px;height:${size}px;${bg}${border}border-radius:50%;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:${Math.round(size * 0.4)}px;">${inner}</div>`
}

/* ===== TierLabel ===== */
export interface TierLabelProps {
  readonly tier: 'aprendiz' | 'oficial' | 'maestro' | 'maestro_mayor' | 'patron'
  readonly label: string
}
export const TierLabel = (p: TierLabelProps): string =>
  `<span class="cl-tier" data-tier="${escapeAttr(p.tier)}">${escapeHtml(p.label)}</span>`

/* ===== StarRating ===== */
export interface StarRatingProps {
  readonly value: number          // 0..5
  readonly count?: number
}
export const StarRating = (p: StarRatingProps): string => {
  const v = p.value.toFixed(1)
  const c = p.count !== undefined ? ` <span class="cl-stars__count">(${p.count})</span>` : ''
  return `<span class="cl-stars">★ ${escapeHtml(v)}${c}</span>`
}

/* ===== ProgressBar ===== */
export interface ProgressBarProps {
  readonly pct: number            // 0..100
  readonly height?: number
  readonly accent?: string
}
export const ProgressBar = (p: ProgressBarProps): string => {
  const pct = Math.max(0, Math.min(100, p.pct))
  const h = p.height ?? 8
  const accent = p.accent ?? 'linear-gradient(90deg,#4f46e5,#818cf8)'
  return `<div class="cl-progress" style="background:#e5e7eb;border-radius:999px;height:${h}px;overflow:hidden;">
    <div class="cl-progress__fill" style="background:${accent};height:100%;width:${pct}%;transition:width .6s cubic-bezier(.22,1,.36,1);"></div>
  </div>`
}

/* ===== Icon — поддержка простых эмодзи или SVG path ===== */
export interface IconProps {
  readonly glyph: string
  readonly size?: number
}
export const Icon = (p: IconProps): string => {
  const size = p.size ?? 16
  return `<span class="cl-icon" aria-hidden="true" style="font-size:${size}px;line-height:1;">${escapeHtml(p.glyph)}</span>`
}

/* ===== Tag (chip) ===== */
export interface TagProps {
  readonly label: string
  readonly color?: 'gray' | 'indigo' | 'amber' | 'green' | 'red'
}
export const Tag = (p: TagProps): string => {
  const color = p.color ?? 'gray'
  return `<span class="cl-tag cl-tag--${color}">${escapeHtml(p.label)}</span>`
}
