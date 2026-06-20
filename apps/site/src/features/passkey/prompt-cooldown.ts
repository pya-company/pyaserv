/*
 * Don't pester. If the user dismissed the post-login passkey prompt, leave
 * them alone for COOLDOWN_DAYS before asking again. State lives in
 * localStorage so it's per-device (correct: passkey UX is per-device too).
 *
 * Pure functions over an injected storage so we can unit-test without DOM.
 */

const KEY = 'pyaserv.passkey.dismissedUntil'
const COOLDOWN_DAYS = 7

export interface ClockLike { now(): number }
export interface StorageLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

export const isPromptOnCooldown = (storage: StorageLike, clock: ClockLike): boolean => {
  const raw = storage.getItem(KEY)
  if (raw === null) return false
  const until = Number(raw)
  if (!Number.isFinite(until)) return false
  return until > clock.now()
}

export const dismissPromptForCooldown = (storage: StorageLike, clock: ClockLike): void => {
  const until = clock.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  storage.setItem(KEY, String(until))
}

/** After a successful enrollment, we don't need to remind for a long time. */
export const muteForeverAfterEnroll = (storage: StorageLike, clock: ClockLike): void => {
  const until = clock.now() + 365 * 24 * 60 * 60 * 1000
  storage.setItem(KEY, String(until))
}
