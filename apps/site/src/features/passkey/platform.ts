/*
 * Device-aware copy for passkey prompts. WebAuthn doesn't tell the page WHICH
 * biometric will be used — the OS owns that — so we sniff the UA and produce
 * the marketing name the user will recognise on the system dialog.
 *
 * Best-practice references: Apple HIG (Passkeys), Google Identity Passkey
 * docs, FIDO Alliance UX guidelines. When in doubt: "this device".
 */

export type Platform = 'ios' | 'macos' | 'windows' | 'android' | 'linux' | 'other'

export const guessPlatform = (ua: string): Platform => {
  const u = ua.toLowerCase()
  if (/iphone|ipad|ipod/.test(u)) return 'ios'
  if (/mac os x/.test(u) && !/iphone|ipad/.test(u)) return 'macos'
  if (/windows/.test(u)) return 'windows'
  if (/android/.test(u)) return 'android'
  if (/linux/.test(u)) return 'linux'
  return 'other'
}

/** The phrase to show next to "Save passkey to ___". */
export const authenticatorLabel = (p: Platform, loc: 'es' | 'en'): string => {
  if (p === 'ios') return loc === 'es' ? 'Face ID / Touch ID' : 'Face ID / Touch ID'
  if (p === 'macos') return loc === 'es' ? 'Touch ID' : 'Touch ID'
  if (p === 'windows') return loc === 'es' ? 'Windows Hello' : 'Windows Hello'
  if (p === 'android') return loc === 'es' ? 'bloqueo del dispositivo' : 'screen lock'
  return loc === 'es' ? 'este dispositivo' : 'this device'
}

/** A human label saved alongside the credential so the user can recognise it
 *  in the /me/security panel later. Free-form, never shown on the OS dialog. */
export const credentialLabel = (ua: string): string => {
  const u = ua
  const browser = /Edg\//.test(u) ? 'Edge'
    : /Chrome\//.test(u) ? 'Chrome'
    : /Firefox\//.test(u) ? 'Firefox'
    : /Safari\//.test(u) ? 'Safari'
    : 'Browser'
  const platform = guessPlatform(u)
  const platLabel = platform === 'ios' ? 'iPhone'
    : platform === 'macos' ? 'Mac'
    : platform === 'windows' ? 'Windows'
    : platform === 'android' ? 'Android'
    : platform === 'linux' ? 'Linux'
    : 'Device'
  return `${browser} on ${platLabel}`
}

/** Cheap sync check before doing any work. */
export const passkeySupported = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.PublicKeyCredential === 'function' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.credentials?.create === 'function'

/** Async check — does the device have a platform authenticator (Touch ID etc)? */
export const platformAuthenticatorAvailable = async (): Promise<boolean> => {
  if (!passkeySupported()) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch { return false }
}

/** Async check — does the browser support Conditional UI (one-tap autofill)? */
export const conditionalUiAvailable = async (): Promise<boolean> => {
  if (!passkeySupported()) return false
  const Cls = window.PublicKeyCredential as unknown as { isConditionalMediationAvailable?: () => Promise<boolean> }
  if (typeof Cls.isConditionalMediationAvailable !== 'function') return false
  try { return await Cls.isConditionalMediationAvailable() } catch { return false }
}
