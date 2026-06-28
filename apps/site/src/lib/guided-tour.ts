/*
 * Guided tour engine — IntelliJ IDEA style.
 *
 * Использование:
 *   import { startTour } from '~/lib/guided-tour'
 *   startTour({
 *     code: 'T1',
 *     steps: [
 *       { selector: '#avatar-upload', title: 'Tu cara', body: 'Una buena foto duplica las consultas.' },
 *       { selector: 'input[name="headline"]', title: 'Tu headline', body: '...' },
 *     ],
 *     onFinish: () => api.savetour('T1','completed'),
 *     onSkip: () => api.savetour('T1','skipped'),
 *   })
 *
 * UX (как в JetBrains IDEA Productivity Guide):
 *  - Полностью затемнённый overlay (`rgba(0,0,0,0.65)`).
 *  - Spotlight cutout вокруг anchor через двойной box-shadow.
 *  - Tooltip автопозиционируется (top|bottom|left|right).
 *  - Sticky controls: «Atrás · 3/7 · Saltar · Siguiente».
 *  - Auto-scroll к anchor если off-screen.
 *  - Close button (×) в углу tooltip.
 *  - Respect `prefers-reduced-motion`: instant transitions.
 */

export interface TourStep {
  readonly selector: string
  readonly title: string
  readonly body: string
  readonly position?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  readonly waitForClick?: boolean
}

export interface TourConfig {
  readonly code: string
  readonly steps: ReadonlyArray<TourStep>
  readonly onFinish?: () => void | Promise<void>
  readonly onSkip?: () => void | Promise<void>
  readonly labels?: {
    back?: string
    next?: string
    skip?: string
    finish?: string
    counter?: (cur: number, total: number) => string
  }
}

interface ActiveTour {
  cfg: TourConfig
  idx: number
  els: { overlay: HTMLElement; tooltip: HTMLElement } | null
}

let activeTour: ActiveTour | null = null

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

export const isTourActive = (): boolean => activeTour !== null

export const startTour = (cfg: TourConfig): void => {
  if (activeTour) endTour('skip', true)
  activeTour = { cfg, idx: 0, els: null }
  mountOverlay()
  renderStep()
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKey)
}

const onResize = (): void => { if (activeTour) renderStep() }
const onKey = (e: KeyboardEvent): void => {
  if (!activeTour) return
  if (e.key === 'Escape') { e.preventDefault(); endTour('skip') }
  if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next() }
  if (e.key === 'ArrowLeft') { e.preventDefault(); back() }
}

const mountOverlay = (): void => {
  if (!activeTour) return
  // Belt and braces: nuke any orphan tour DOM from a previous instance that
  // endTour() may have lost the reference to (e.g. when initDemo fires twice
  // on first paint and creates two activeTours back-to-back, or when Astro
  // view-transitions accumulate astro:page-load listeners across nav and
  // re-run this whole module). Without this, the user sees two stacked
  // tooltips at different step indices ("split personality" bug).
  document.querySelectorAll('.gt-overlay, .gt-tooltip').forEach((el) => el.remove())

  const overlay = document.createElement('div')
  overlay.className = 'gt-overlay'
  overlay.setAttribute('role', 'presentation')
  overlay.innerHTML = `<div class="gt-spotlight" id="gt-spotlight"></div>`
  document.body.appendChild(overlay)

  const tooltip = document.createElement('div')
  tooltip.className = 'gt-tooltip'
  tooltip.setAttribute('role', 'dialog')
  tooltip.setAttribute('aria-modal', 'true')
  tooltip.setAttribute('aria-labelledby', 'gt-tooltip-title')
  document.body.appendChild(tooltip)

  activeTour.els = { overlay, tooltip }
}

const renderStep = (): void => {
  if (!activeTour || !activeTour.els) return
  const cfg = activeTour.cfg
  const step = cfg.steps[activeTour.idx]
  if (!step) { endTour('finish'); return }
  // Brief wait-for-anchor (up to 1.2s in 100ms ticks) handles steps whose
  // anchor is rendered by an async demoStub response — without this we
  // skipped straight to the last step on /specialists/ and /clients/.
  const tryRender = (waited: number): void => {
    if (!activeTour) return
    const anchor = document.querySelector<HTMLElement>(step.selector)
    if (!anchor) {
      if (waited < 1200) {
        setTimeout(() => tryRender(waited + 100), 100)
        return
      }
      console.warn('[guided-tour] selector not found:', step.selector, '— skipping step')
      activeTour.idx++
      renderStep()
      return
    }
    const rect = anchor.getBoundingClientRect()
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight
    // Instant scroll — smooth (300ms+) leaves the spotlight measuring
    // pre-scroll geometry, so the cutout lands on empty space and the
    // tooltip ends up off-screen. `auto` finishes synchronously, then
    // the double-RAF gives the browser a chance to commit the layout
    // before positionSpotlight re-reads the post-scroll rect.
    if (!inView) anchor.scrollIntoView({ behavior: 'auto', block: 'center' })
    requestAnimationFrame(() => requestAnimationFrame(() => positionSpotlight(anchor, step)))
  }
  tryRender(0)
}

const positionSpotlight = (anchor: HTMLElement, step: TourStep): void => {
  if (!activeTour || !activeTour.els) return
  const { tooltip } = activeTour.els
  const r = anchor.getBoundingClientRect()
  const padding = 6
  const spot = document.getElementById('gt-spotlight')
  if (!spot) return
  // Spotlight = transparent rect; overlay tinted via box-shadow trick.
  spot.style.cssText = `
    position: fixed;
    left: ${r.left - padding}px;
    top: ${r.top - padding}px;
    width: ${r.width + padding * 2}px;
    height: ${r.height + padding * 2}px;
    border-radius: 8px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65);
    pointer-events: none;
    transition: all 0.22s cubic-bezier(.22,1,.36,1);
  `

  // Tooltip content
  const cfg = activeTour.cfg
  const L = cfg.labels ?? {}
  const counter = (L.counter ?? ((c, t) => `${c} / ${t}`))(activeTour.idx + 1, cfg.steps.length)
  const isLast = activeTour.idx === cfg.steps.length - 1
  tooltip.innerHTML = `
    <button class="gt-close" aria-label="Cerrar" data-gt-action="skip">×</button>
    <h3 class="gt-title" id="gt-tooltip-title">${escapeHtml(step.title)}</h3>
    <p class="gt-body">${escapeHtml(step.body)}</p>
    <div class="gt-progress">
      <div class="gt-progress__bar"><div class="gt-progress__fill" style="width:${((activeTour.idx + 1) / cfg.steps.length) * 100}%"></div></div>
      <span class="gt-progress__counter">${counter}</span>
    </div>
    <div class="gt-controls">
      ${activeTour.idx > 0 ? `<button class="gt-btn gt-btn--ghost" data-gt-action="back">${escapeHtml(L.back ?? 'Atrás')}</button>` : '<span></span>'}
      <button class="gt-btn gt-btn--ghost" data-gt-action="skip">${escapeHtml(L.skip ?? 'Saltar')}</button>
      <button class="gt-btn gt-btn--primary" data-gt-action="next">${escapeHtml(isLast ? (L.finish ?? '¡Listo!') : (L.next ?? 'Siguiente'))}</button>
    </div>
  `

  // Position tooltip relative to spotlight.
  // IMPORTANT: set `position: fixed` BEFORE measuring, otherwise the tooltip
  // is a block in normal flow and `getBoundingClientRect()` returns layout
  // width (often full viewport width on mobile), which then breaks every
  // subsequent clamp/centering calculation.
  tooltip.style.position = 'fixed'
  tooltip.style.left = '0px'
  tooltip.style.top = '0px'
  const desired = step.position ?? 'auto'
  const ttRect = tooltip.getBoundingClientRect()
  const gap = 14
  const margin = 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  const space = {
    top: r.top, bottom: vh - r.bottom,
    left: r.left, right: vw - r.right,
  }
  // If the tooltip cannot physically fit beside the anchor at all (typical on
  // narrow mobile viewports), force a top/bottom layout instead of letting
  // explicit 'left'/'right' push it off-screen.
  const fitsRight = space.right >= ttRect.width + gap + margin
  const fitsLeft = space.left >= ttRect.width + gap + margin
  const fitsBelow = space.bottom >= ttRect.height + gap + margin
  const fitsAbove = space.top >= ttRect.height + gap + margin
  let pos: 'top' | 'bottom' | 'left' | 'right'
  if (desired === 'auto') {
    if (fitsBelow) pos = 'bottom'
    else if (fitsAbove) pos = 'top'
    else if (fitsRight) pos = 'right'
    else if (fitsLeft) pos = 'left'
    else pos = space.bottom >= space.top ? 'bottom' : 'top'
  } else {
    // Honour explicit position when possible; otherwise flip to the opposite
    // side, then fall back to top/bottom so the popover never escapes the
    // viewport.
    pos = desired
    if (pos === 'right' && !fitsRight) pos = fitsLeft ? 'left' : (fitsBelow ? 'bottom' : 'top')
    else if (pos === 'left' && !fitsLeft) pos = fitsRight ? 'right' : (fitsBelow ? 'bottom' : 'top')
    else if (pos === 'bottom' && !fitsBelow) pos = fitsAbove ? 'top' : (fitsRight ? 'right' : 'left')
    else if (pos === 'top' && !fitsAbove) pos = fitsBelow ? 'bottom' : (fitsRight ? 'right' : 'left')
  }
  let top = 0, left = 0
  if (pos === 'bottom') {
    top = r.bottom + gap
    left = r.left + r.width / 2 - ttRect.width / 2
  } else if (pos === 'top') {
    top = r.top - ttRect.height - gap
    left = r.left + r.width / 2 - ttRect.width / 2
  } else if (pos === 'right') {
    left = r.right + gap
    top = r.top + r.height / 2 - ttRect.height / 2
  } else {
    left = r.left - ttRect.width - gap
    top = r.top + r.height / 2 - ttRect.height / 2
  }
  // Final viewport clamp on BOTH axes (margin around edges). Guarantees the
  // popover is fully visible even when anchor sits at the very edge of a
  // narrow viewport.
  const maxLeft = Math.max(margin, vw - ttRect.width - margin)
  const maxTop = Math.max(margin, vh - ttRect.height - margin)
  left = Math.max(margin, Math.min(maxLeft, left))
  top = Math.max(margin, Math.min(maxTop, top))
  tooltip.style.top = `${top}px`
  tooltip.style.left = `${left}px`
  tooltip.style.opacity = '1'

  tooltip.querySelectorAll<HTMLButtonElement>('[data-gt-action]').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      const action = btn.dataset.gtAction
      if (action === 'next') next()
      else if (action === 'back') back()
      else if (action === 'skip') endTour('skip')
    }
  })
}

const next = (): void => {
  if (!activeTour) return
  activeTour.idx++
  if (activeTour.idx >= activeTour.cfg.steps.length) endTour('finish')
  else renderStep()
}

const back = (): void => {
  if (!activeTour) return
  activeTour.idx = Math.max(0, activeTour.idx - 1)
  renderStep()
}

const endTour = (reason: 'finish' | 'skip', silent = false): void => {
  if (!activeTour) return
  const cfg = activeTour.cfg
  if (activeTour.els) {
    activeTour.els.overlay.remove()
    activeTour.els.tooltip.remove()
  }
  activeTour = null
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKey)
  if (!silent) {
    if (reason === 'finish') void cfg.onFinish?.()
    else void cfg.onSkip?.()
  }
}
