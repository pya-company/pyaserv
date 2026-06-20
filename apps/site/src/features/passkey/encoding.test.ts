import { describe, expect, it } from 'bun:test'
import { base64urlToBuf, bufToBase64url, prepCreateOptions, prepGetOptions } from './encoding.ts'

describe('base64url round-trips', () => {
  it('empty', () => {
    expect(bufToBase64url(new Uint8Array())).toBe('')
    expect(base64urlToBuf('')).toEqual(new Uint8Array())
  })

  it('ascii bytes', () => {
    const u = new TextEncoder().encode('hello')
    const enc = bufToBase64url(u)
    expect(enc).toBe('aGVsbG8') // no padding
    expect(new TextDecoder().decode(base64urlToBuf(enc))).toBe('hello')
  })

  it('binary with URL-significant chars (+ and /)', () => {
    // 0xfb 0xff 0xbf encodes in std b64 to "+/+/" → base64url "-_-_"
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf])
    const enc = bufToBase64url(bytes)
    expect(enc).toContain('-')
    expect(enc).toContain('_')
    expect(enc).not.toContain('+')
    expect(enc).not.toContain('/')
    expect(enc).not.toContain('=')
    expect(base64urlToBuf(enc)).toEqual(bytes)
  })

  it('round-trip 256 random bytes', () => {
    const u = new Uint8Array(256)
    for (let i = 0; i < 256; i++) u[i] = i
    expect(base64urlToBuf(bufToBase64url(u))).toEqual(u)
  })

  it('accepts ArrayBuffer input', () => {
    const u = new Uint8Array([1, 2, 3, 4])
    expect(bufToBase64url(u.buffer)).toBe(bufToBase64url(u))
  })
})

describe('prepCreateOptions', () => {
  it('converts challenge + user.id + excludeCredentials.id to Uint8Array', () => {
    const out = prepCreateOptions({
      challenge: 'aGVsbG8',
      user: { id: 'd29ybGQ', name: 'a@b', displayName: 'A' },
      rp: { id: 'pyaserv.com', name: 'PyaServ' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      excludeCredentials: [{ id: 'aGVsbG8', type: 'public-key', transports: ['internal'] }],
    })
    expect(out.challenge).toBeInstanceOf(Uint8Array)
    expect(out.user.id).toBeInstanceOf(Uint8Array)
    expect(out.excludeCredentials?.[0]?.id).toBeInstanceOf(Uint8Array)
    expect(out.rp.id).toBe('pyaserv.com')
    expect(out.user.name).toBe('a@b')
  })

  it('omits excludeCredentials when server didn\'t send any', () => {
    const out = prepCreateOptions({
      challenge: 'aGVsbG8',
      user: { id: 'd29ybGQ', name: 'a@b', displayName: 'A' },
      rp: { id: 'pyaserv.com', name: 'PyaServ' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    })
    expect(out.excludeCredentials).toBeUndefined()
  })
})

describe('prepGetOptions', () => {
  it('converts challenge + allowCredentials.id', () => {
    const out = prepGetOptions({
      challenge: 'aGVsbG8',
      rpId: 'pyaserv.com',
      allowCredentials: [{ id: 'd29ybGQ', type: 'public-key' }],
      userVerification: 'preferred',
    })
    expect(out.challenge).toBeInstanceOf(Uint8Array)
    expect(out.allowCredentials?.[0]?.id).toBeInstanceOf(Uint8Array)
    expect(out.userVerification).toBe('preferred')
  })
})
