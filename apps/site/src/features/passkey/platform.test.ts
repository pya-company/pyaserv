import { describe, expect, it } from 'bun:test'
import { authenticatorLabel, credentialLabel, guessPlatform } from './platform.ts'

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const WIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const AND_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

describe('guessPlatform', () => {
  it('ios', () => expect(guessPlatform(IOS_UA)).toBe('ios'))
  it('macos (not iOS even though it mentions Mac OS X)', () => expect(guessPlatform(MAC_UA)).toBe('macos'))
  it('windows', () => expect(guessPlatform(WIN_UA)).toBe('windows'))
  it('android', () => expect(guessPlatform(AND_UA)).toBe('android'))
  it('falls back to other on garbage', () => expect(guessPlatform('curl/8.0')).toBe('other'))
})

describe('authenticatorLabel', () => {
  it('windows → Windows Hello (both locales)', () => {
    expect(authenticatorLabel('windows', 'es')).toBe('Windows Hello')
    expect(authenticatorLabel('windows', 'en')).toBe('Windows Hello')
  })
  it('android → bloqueo del dispositivo / screen lock', () => {
    expect(authenticatorLabel('android', 'es')).toBe('bloqueo del dispositivo')
    expect(authenticatorLabel('android', 'en')).toBe('screen lock')
  })
  it('other falls back', () => {
    expect(authenticatorLabel('other', 'es')).toBe('este dispositivo')
    expect(authenticatorLabel('other', 'en')).toBe('this device')
  })
})

describe('credentialLabel', () => {
  it('Chrome on Mac', () => expect(credentialLabel(MAC_UA)).toBe('Chrome on Mac'))
  it('Safari on iPhone', () => expect(credentialLabel(IOS_UA)).toBe('Safari on iPhone'))
  it('Chrome on Windows', () => expect(credentialLabel(WIN_UA)).toBe('Chrome on Windows'))
  it('Chrome on Android', () => expect(credentialLabel(AND_UA)).toBe('Chrome on Android'))
})
