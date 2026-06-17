/*
 * Service-worker registration with forced rollover on new deploys.
 *
 * Two guarantees on top of a plain navigator.serviceWorker.register('/sw.js'):
 *
 * 1. registration.update() runs on every page load so a fresh /sw.js
 *    byte-check happens immediately. The browser's own poll is once per
 *    24h and a deploy could otherwise sit invisible for a day.
 *
 * 2. controllerchange triggers a one-shot location.reload() when an
 *    EXISTING controller is replaced — i.e. a new SW just activated.
 *    The first-time install (controller was previously null) does NOT
 *    trigger a reload; it's not a "new version", it's the first version.
 *
 * IO is injected so the logic is unit-testable without navigator.serviceWorker.
 */

export interface SwApi {
  readonly hasController: () => boolean
  readonly register: () => Promise<{ readonly update: () => Promise<unknown> }>
  readonly onControllerChange: (handler: () => void) => void
}

export interface SwSideEffects {
  readonly reload: () => void
}

export const setupSwUpdate = (api: SwApi, effects: SwSideEffects): void => {
  const hadController = api.hasController()
  api.register().then((reg) => {
    reg.update().catch(() => undefined)
  })
  let refreshing = false
  api.onControllerChange(() => {
    if (!hadController || refreshing) return
    refreshing = true
    effects.reload()
  })
}
