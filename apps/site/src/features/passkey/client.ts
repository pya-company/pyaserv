/*
 * Browser-side passkey orchestration.
 *
 * - `enrollPasskey(apiFetch)` — runs the full register flow against an
 *   already-authenticated session. Returns 'ok' / 'cancelled' / 'unsupported' /
 *   'error'. Never throws.
 * - `assertPasskey(apiFetch, email, serverOptions)` — runs the get flow with
 *   options already fetched from /api/auth/start. Returns the verify payload
 *   on success, 'cancelled' / 'error' otherwise. Never throws.
 *
 * Best-practice notes inline. All API requests funnel through the caller's
 * `apiFetch` so auth header + JSON unwrapping stay in one place.
 */
import {
  formatAssertion,
  formatAttestation,
  prepCreateOptions,
  prepGetOptions,
  type ServerAuthOptions,
  type ServerRegOptions,
} from './encoding.ts'
import { credentialLabel, passkeySupported } from './platform.ts'

export type EnrollResult = 'ok' | 'cancelled' | 'unsupported' | 'error'

interface ApiFetch {
  <T = unknown>(path: string, init?: RequestInit): Promise<T>
}

/** True for any error that means "the user actively dismissed the OS prompt".
 *  We treat this as a benign signal — fall back to OTP, don't surface it. */
const isCancellation = (err: unknown): boolean => {
  const name = err instanceof Error ? err.name : ''
  return name === 'NotAllowedError' || name === 'AbortError'
}

export const enrollPasskey = async (apiFetch: ApiFetch): Promise<EnrollResult> => {
  if (!passkeySupported()) return 'unsupported'
  let server: { challengeId: string; options: ServerRegOptions }
  try {
    server = await apiFetch('/api/auth/passkey/register/options', { method: 'POST' })
  } catch { return 'error' }

  let cred: PublicKeyCredential | null
  try {
    cred = (await navigator.credentials.create({
      publicKey: prepCreateOptions(server.options),
    })) as PublicKeyCredential | null
  } catch (err) {
    return isCancellation(err) ? 'cancelled' : 'error'
  }
  if (!cred) return 'cancelled'

  try {
    await apiFetch('/api/auth/passkey/register/verify', {
      method: 'POST',
      body: JSON.stringify({
        challengeId: server.challengeId,
        attestation: formatAttestation(cred),
        label: credentialLabel(navigator.userAgent),
      }),
    })
    return 'ok'
  } catch { return 'error' }
}

export type AssertResult =
  | { readonly status: 'ok'; readonly response: unknown }
  | { readonly status: 'cancelled' | 'unsupported' | 'error' }

export const assertPasskey = async (
  apiFetch: ApiFetch,
  email: string,
  serverOptions: ServerAuthOptions,
  opts: { readonly mediation?: 'conditional' | 'optional' | 'required' } = {},
): Promise<AssertResult> => {
  if (!passkeySupported()) return { status: 'unsupported' }
  let cred: PublicKeyCredential | null
  try {
    cred = (await navigator.credentials.get({
      publicKey: prepGetOptions(serverOptions),
      mediation: opts.mediation,
    })) as PublicKeyCredential | null
  } catch (err) {
    return { status: isCancellation(err) ? 'cancelled' : 'error' }
  }
  if (!cred) return { status: 'cancelled' }

  try {
    const response = await apiFetch('/api/auth/passkey/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, assertion: formatAssertion(cred) }),
    })
    return { status: 'ok', response }
  } catch { return { status: 'error' } }
}

/**
 * Conditional UI flow. Fetches discoverable-credential options, fires a
 * background `navigator.credentials.get({mediation:'conditional'})` that
 * resolves ONLY when the user picks a passkey from the email-field autofill
 * chip. If accepted, posts to /passkey/discover/verify (no email — identity
 * comes from the assertion's userHandle) and returns the session payload.
 *
 * Caller passes an AbortController.signal so the conditional request can be
 * cancelled when the user submits the regular email form first.
 */
export const startConditionalLogin = async (
  apiFetch: ApiFetch,
  signal: AbortSignal,
): Promise<AssertResult> => {
  if (!passkeySupported()) return { status: 'unsupported' }
  let server: { challengeId: string; options: ServerAuthOptions }
  try {
    server = await apiFetch('/api/auth/passkey/discover/options', { method: 'POST' })
  } catch { return { status: 'error' } }
  if (signal.aborted) return { status: 'cancelled' }

  let cred: PublicKeyCredential | null
  try {
    cred = (await navigator.credentials.get({
      publicKey: prepGetOptions(server.options),
      mediation: 'conditional',
      signal,
    } as CredentialRequestOptions)) as PublicKeyCredential | null
  } catch (err) {
    return { status: isCancellation(err) ? 'cancelled' : 'error' }
  }
  if (!cred) return { status: 'cancelled' }

  try {
    const response = await apiFetch('/api/auth/passkey/discover/verify', {
      method: 'POST',
      body: JSON.stringify({
        challengeId: server.challengeId,
        assertion: formatAssertion(cred),
      }),
    })
    return { status: 'ok', response }
  } catch { return { status: 'error' } }
}
