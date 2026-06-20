/*
 * WebAuthn ⇄ JSON wire encoding. Browser hands us `ArrayBuffer`/`Uint8Array`
 * for raw bytes; the backend (and @simplewebauthn/server) speaks base64url
 * strings. These are the pure helpers + the per-shape converters that wrap
 * `navigator.credentials.create/get` calls.
 *
 * Spec compliance: WebAuthn Level 3 §5.8 (publicKey member, base64url encoding),
 * RFC 4648 §5 (URL-safe base64, no padding).
 */

const B64URL_TO_B64: Readonly<Record<string, string>> = { '-': '+', _: '/' }
const B64_TO_B64URL: Readonly<Record<string, string>> = { '+': '-', '/': '_' }

export const bufToBase64url = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0)
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64')
  return b64.replace(/[+/]/g, (c) => B64_TO_B64URL[c] ?? c).replace(/=+$/, '')
}

export const base64urlToBuf = (s: string): Uint8Array => {
  const b64 = s.replace(/[-_]/g, (c) => B64URL_TO_B64[c] ?? c).padEnd(s.length + ((4 - (s.length % 4)) % 4), '=')
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Server sends base64url-encoded byte fields; browser API needs BufferSource.
 *  Mutates a deep-copied shape so the caller can pass through to `create()`. */
export interface ServerRegOptions {
  readonly challenge: string
  readonly user: { readonly id: string; readonly name: string; readonly displayName: string }
  readonly rp: { readonly id: string; readonly name: string }
  readonly pubKeyCredParams: ReadonlyArray<{ readonly type: 'public-key'; readonly alg: number }>
  readonly timeout?: number
  readonly excludeCredentials?: ReadonlyArray<{
    readonly id: string
    readonly type: 'public-key'
    readonly transports?: ReadonlyArray<string>
  }>
  readonly authenticatorSelection?: {
    readonly residentKey?: 'discouraged' | 'preferred' | 'required'
    readonly userVerification?: 'discouraged' | 'preferred' | 'required'
    readonly authenticatorAttachment?: 'platform' | 'cross-platform'
  }
  readonly attestation?: 'none' | 'indirect' | 'direct' | 'enterprise'
  readonly extensions?: Record<string, unknown>
}

export const prepCreateOptions = (
  s: ServerRegOptions,
): PublicKeyCredentialCreationOptions => ({
  challenge: base64urlToBuf(s.challenge),
  rp: { id: s.rp.id, name: s.rp.name },
  user: {
    id: base64urlToBuf(s.user.id),
    name: s.user.name,
    displayName: s.user.displayName,
  },
  pubKeyCredParams: s.pubKeyCredParams as PublicKeyCredentialParameters[],
  timeout: s.timeout,
  excludeCredentials: s.excludeCredentials?.map((c) => ({
    id: base64urlToBuf(c.id),
    type: c.type,
    transports: c.transports as AuthenticatorTransport[] | undefined,
  })),
  authenticatorSelection: s.authenticatorSelection as AuthenticatorSelectionCriteria | undefined,
  attestation: s.attestation,
  extensions: s.extensions as AuthenticationExtensionsClientInputs | undefined,
})

export interface ServerAuthOptions {
  readonly challenge: string
  readonly rpId?: string
  readonly timeout?: number
  readonly userVerification?: 'discouraged' | 'preferred' | 'required'
  readonly allowCredentials?: ReadonlyArray<{
    readonly id: string
    readonly type: 'public-key'
    readonly transports?: ReadonlyArray<string>
  }>
}

export const prepGetOptions = (
  s: ServerAuthOptions,
): PublicKeyCredentialRequestOptions => ({
  challenge: base64urlToBuf(s.challenge),
  rpId: s.rpId,
  timeout: s.timeout,
  userVerification: s.userVerification,
  allowCredentials: s.allowCredentials?.map((c) => ({
    id: base64urlToBuf(c.id),
    type: c.type,
    transports: c.transports as AuthenticatorTransport[] | undefined,
  })),
})

/** Convert a `PublicKeyCredential` (attestation flavour) into the JSON the
 *  server expects (matches @simplewebauthn/server's RegistrationResponseJSON). */
export const formatAttestation = (cred: PublicKeyCredential): Record<string, unknown> => {
  const r = cred.response as AuthenticatorAttestationResponse
  return {
    id: cred.id,
    rawId: bufToBase64url(cred.rawId),
    type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: bufToBase64url(r.clientDataJSON),
      attestationObject: bufToBase64url(r.attestationObject),
      transports: r.getTransports ? r.getTransports() : [],
    },
  }
}

/** Same but for assertion (login). */
export const formatAssertion = (cred: PublicKeyCredential): Record<string, unknown> => {
  const r = cred.response as AuthenticatorAssertionResponse
  return {
    id: cred.id,
    rawId: bufToBase64url(cred.rawId),
    type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: bufToBase64url(r.clientDataJSON),
      authenticatorData: bufToBase64url(r.authenticatorData),
      signature: bufToBase64url(r.signature),
      userHandle: r.userHandle ? bufToBase64url(r.userHandle) : null,
    },
  }
}
