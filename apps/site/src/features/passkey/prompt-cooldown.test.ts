import { beforeEach, describe, expect, it } from 'bun:test'
import { dismissPromptForCooldown, isPromptOnCooldown, muteForeverAfterEnroll } from './prompt-cooldown.ts'

const makeStorage = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
    _data: m,
  }
}
const makeClock = (start: number) => {
  let t = start
  return {
    now: () => t,
    advance: (ms: number) => { t += ms },
  }
}

const DAY = 24 * 60 * 60 * 1000

describe('prompt cooldown', () => {
  let storage: ReturnType<typeof makeStorage>
  let clock: ReturnType<typeof makeClock>

  beforeEach(() => {
    storage = makeStorage()
    clock = makeClock(1_000_000_000_000)
  })

  it('fresh: no cooldown', () => {
    expect(isPromptOnCooldown(storage, clock)).toBe(false)
  })

  it('dismiss sets 7-day cooldown', () => {
    dismissPromptForCooldown(storage, clock)
    expect(isPromptOnCooldown(storage, clock)).toBe(true)
    clock.advance(6 * DAY)
    expect(isPromptOnCooldown(storage, clock)).toBe(true)
    clock.advance(2 * DAY) // now 8 days passed
    expect(isPromptOnCooldown(storage, clock)).toBe(false)
  })

  it('successful enroll mutes for a year', () => {
    muteForeverAfterEnroll(storage, clock)
    clock.advance(300 * DAY)
    expect(isPromptOnCooldown(storage, clock)).toBe(true)
    clock.advance(100 * DAY) // 400 > 365
    expect(isPromptOnCooldown(storage, clock)).toBe(false)
  })

  it('garbage value treated as not-on-cooldown (defensive)', () => {
    storage.setItem('pyaserv.passkey.dismissedUntil', 'definitely-not-a-number')
    expect(isPromptOnCooldown(storage, clock)).toBe(false)
  })
})
