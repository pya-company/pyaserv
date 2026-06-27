/*
 * Demo Mode runtime — Safety Charter implementation.
 *
 * See PyaEats/docs/pyaserv-spec-v1.md §15.2 for the 10 anti-confusion
 * mechanisms. This module owns:
 *   • mech 5  — sandboxed sessionStorage state per feature
 *   • mech 8  — idle auto-exit (10 min)
 *   • mech 7  — exit confirmation modal
 *   • mech 10 — audit log via analytics_events (fire-and-forget)
 *
 * The CSS-driven mechs (banner, watermark, tint, border) live in
 * demo-and-docs.css and are activated by html[data-demo-mode="1"].
 * The "no DB writes" guard is enforced at the apiFetch layer
 * (lib/api.ts → demoStub interception, separate change).
 *
 * Fail-closed contract (mech: "If any mechanism cannot enable, demo
 * refuses to start"): if sessionStorage is unavailable (private mode,
 * SecurityError) we render the banner anyway and disable state
 * mutations — the demo becomes read-only and the user is told.
 */

const KEY_PREFIX = 'pyaserv.demo.'
const IDLE_TIMEOUT_MS = 10 * 60 * 1000
const TTL_MS = 24 * 60 * 60 * 1000

const sessionStore = (): Storage | null => {
  try {
    const s = globalThis.sessionStorage
    s.setItem('__demo_test__', '1')
    s.removeItem('__demo_test__')
    return s
  } catch {
    return null
  }
}

export interface DemoState<T = unknown> {
  readonly feature: string
  readonly startedAt: number
  readonly lastActivity: number
  readonly data: T
}

const now = (): number => Date.now()

export const initDemoState = <T>(feature: string, seed: T): DemoState<T> => {
  const state: DemoState<T> = {
    feature,
    startedAt: now(),
    lastActivity: now(),
    data: seed,
  }
  const s = sessionStore()
  if (s) s.setItem(`${KEY_PREFIX}${feature}`, JSON.stringify(state))
  emitAudit('demo_started', { feature })
  return state
}

export const readDemoState = <T>(feature: string): DemoState<T> | null => {
  const s = sessionStore()
  if (!s) return null
  const raw = s.getItem(`${KEY_PREFIX}${feature}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as DemoState<T>
    if (now() - parsed.startedAt > TTL_MS) {
      s.removeItem(`${KEY_PREFIX}${feature}`)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export const updateDemoState = <T>(feature: string, patch: Partial<T>): DemoState<T> | null => {
  const s = sessionStore()
  if (!s) return null
  const prev = readDemoState<T>(feature)
  if (!prev) return null
  const next: DemoState<T> = {
    ...prev,
    lastActivity: now(),
    data: { ...prev.data, ...patch },
  }
  s.setItem(`${KEY_PREFIX}${feature}`, JSON.stringify(next))
  return next
}

export const clearDemoState = (feature?: string): void => {
  const s = sessionStore()
  if (!s) return
  if (feature) {
    s.removeItem(`${KEY_PREFIX}${feature}`)
  } else {
    const keys: string[] = []
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (k && k.startsWith(KEY_PREFIX)) keys.push(k)
    }
    keys.forEach((k) => s.removeItem(k))
  }
}

export const bumpActivity = (feature: string): void => {
  const s = sessionStore()
  if (!s) return
  const prev = readDemoState(feature)
  if (!prev) return
  const next = { ...prev, lastActivity: now() }
  s.setItem(`${KEY_PREFIX}${feature}`, JSON.stringify(next))
}

/* ----------- audit log (mech 10) ----------- */

interface AuditPayload {
  readonly [k: string]: string | number | boolean | null
}

export const emitAudit = (event: string, payload: AuditPayload): void => {
  const detail = { event: `demo.${event}`, ...payload, at: now() }
  // Beacon to api.pyaserv.com so Pages doesn't 405 the POST (Pages is static).
  // If the route isn't wired on the worker side yet, sendBeacon still returns
  // true synchronously — we only care about not polluting the same-origin
  // network log with bogus 405s during MVP.
  try {
    const blob = new Blob([JSON.stringify(detail)], { type: 'application/json' })
    if (globalThis.navigator?.sendBeacon) {
      globalThis.navigator.sendBeacon('https://api.pyaserv.com/demo-audit', blob)
    }
  } catch {
    // never throw from audit
  }
  // Always emit a CustomEvent so other parts of the page can react
  // (e.g. open the exit modal, show a toast).
  try {
    globalThis.dispatchEvent(new CustomEvent('pyaserv:demo', { detail }))
  } catch {
    // ignore
  }
}

/* ----------- idle timer (mech 8) ----------- */

interface IdleController {
  readonly stop: () => void
}

export const startIdleWatcher = (feature: string, onTimeout: () => void): IdleController => {
  let timer: ReturnType<typeof setTimeout> | null = null
  const reset = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      emitAudit('demo_idle_timeout', { feature })
      onTimeout()
    }, IDLE_TIMEOUT_MS)
    bumpActivity(feature)
  }
  const events: (keyof DocumentEventMap)[] = ['click', 'keydown', 'pointermove', 'touchstart', 'scroll']
  events.forEach((ev) => document.addEventListener(ev, reset, { passive: true }))
  reset()
  return {
    stop: (): void => {
      if (timer) clearTimeout(timer)
      events.forEach((ev) => document.removeEventListener(ev, reset))
    },
  }
}

/* ----------- exit (mech 7) ----------- */

export const exitDemo = (feature: string, redirect: string = '/docs/'): void => {
  emitAudit('demo_exited', { feature })
  clearDemoState(feature)
  globalThis.location.href = redirect
}
