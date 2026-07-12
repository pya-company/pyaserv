import { t } from './i18n'

const API = (typeof import.meta.env.PUBLIC_API_URL === 'string' && import.meta.env.PUBLIC_API_URL) ||
  'https://api.pyaserv.com'

const TOKEN_KEY = 'pyaserv.token'
const AUTHED_KEY = 'pyaserv.authed'

// Auth model: the real session is the backend's httpOnly `pya_sid` cookie
// (Secure, SameSite=Lax, 30d — see @pya-company/auth). Because it is httpOnly
// AND scoped to api.pyaserv.com, page JS on pyaserv.com can neither read it nor
// forge it. We therefore keep a NON-sensitive boolean flag in localStorage just
// for synchronous UI state (guest redirect / auth badge); it is not a credential.
//
// `getToken()` still returns a legacy/fallback Bearer id when present — used
// only until adoptSession() confirms the cookie round-trips, then dropped so no
// session id lives in JS at all. On envs where the cookie can't stick (e.g.
// 3rd-party-cookie-blocked previews) the Bearer fallback keeps the user signed
// in. One-time migration adopts any legacy sessionStorage token on first read.
export const getToken = (): string | null => {
  if (typeof localStorage === 'undefined') return null
  const persisted = localStorage.getItem(TOKEN_KEY)
  if (persisted) return persisted
  const legacy = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY)
  if (legacy) localStorage.setItem(TOKEN_KEY, legacy)
  return legacy
}

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token)
}

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
  try { sessionStorage.removeItem(TOKEN_KEY) } catch {}
}

/** True when the client believes it has a live session — either the httpOnly
 *  cookie (flagged) or a legacy fallback token. Cheap + synchronous for the
 *  pre-paint guest redirect; a stale flag self-corrects on the next 401. */
export const isAuthed = (): boolean => {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(AUTHED_KEY) === '1' || Boolean(getToken())
}

const setAuthed = (): void => { try { localStorage.setItem(AUTHED_KEY, '1') } catch {} }
const clearAuthed = (): void => { try { localStorage.removeItem(AUTHED_KEY) } catch {} }

/**
 * Called right after a login endpoint returns its `sid`. The same response also
 * Set-Cookie'd the httpOnly session, so we probe it: a cookie-only /v1/me (no
 * Authorization header). If it succeeds the cookie works → we drop the JS token
 * entirely and rely on the cookie. If it fails (cookie blocked) we keep the
 * token as a Bearer fallback so the user is never locked out. Never throws.
 */
export const adoptSession = async (sid: string): Promise<void> => {
  setToken(sid)   // guarantees the user is authed via Bearer no matter what
  setAuthed()
  try {
    const probe = await fetch(`${API}/v1/me`, { credentials: 'include', headers: {} })
    if (probe.ok) clearToken()   // cookie confirmed → no session id in JS
  } catch { /* keep Bearer fallback */ }
}

/** Log out. Wipe local state FIRST (synchronous) so a caller that navigates
 *  away immediately is still logged out even if the request is cut short; the
 *  server revoke rides `keepalive` so the cookie is cleared regardless. */
export const endSession = async (): Promise<void> => {
  clearToken()
  clearAuthed()
  try {
    await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include', keepalive: true })
  } catch { /* local state already cleared; server session TTLs out */ }
}

export const apiFetch = async <T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  let res: Response
  try {
    // credentials:'include' sends + stores the httpOnly session cookie on every
    // call (requireAuth prefers cookie over Bearer).
    res = await fetch(`${API}${path}`, { ...init, headers, credentials: 'include' })
  } catch {
    throw new Error(t('error.network'))
  }
  if (res.status === 401) clearAuthed()
  const ctype = res.headers.get('content-type') ?? ''
  const body = ctype.includes('json') ? await res.json() : await res.text()
  if (!res.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body && typeof (body as { error: { message?: string } }).error.message === 'string'
        ? (body as { error: { message: string } }).error.message
        : `HTTP ${res.status}`
    throw new Error(message)
  }
  return (typeof body === 'object' && body !== null && 'data' in body
    ? (body as { data: T }).data
    : body) as T
}

// API contract — `value` is the canonical English enum sent to/received from the server.
// User-facing label/emoji come from i18n at render time.
export interface CategoryDef {
  readonly value: string
  readonly emoji: string
}

export const CATEGORIES: ReadonlyArray<CategoryDef> = [
  { value: 'plumbing', emoji: '🔧' },
  { value: 'electrical', emoji: '💡' },
  { value: 'cleaning', emoji: '🧽' },
  { value: 'repair', emoji: '🛠️' },
  { value: 'beauty', emoji: '💇' },
  { value: 'teaching', emoji: '📚' },
  { value: 'photography', emoji: '📷' },
  { value: 'translation', emoji: '🌐' },
  { value: 'events', emoji: '🎉' },
  { value: 'other', emoji: '✨' },
]

export const categoryLabel = (value: string): string => t(`category.${value}`)

export const categoryEmoji = (value: string): string =>
  CATEGORIES.find((c) => c.value === value)?.emoji ?? '•'

// Re-export i18n-aware formatters for backwards compatibility with the script blocks.
export { formatGs, formatRelativeTime } from './i18n'

const ALLOWED_IMG_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMG_BYTES = 5 * 1024 * 1024

// Upload a single image file to /v1/media and return its storage key.
// Throws Error(<i18n message>) for invalid type / oversize. Reuses the same auth token via fetch headers.
export const uploadImage = async (file: File): Promise<string> => {
  if (!ALLOWED_IMG_TYPES.has(file.type)) throw new Error(t('media.bad_type'))
  if (file.size > MAX_IMG_BYTES) throw new Error(t('media.too_big'))
  const token = getToken()
  const headers = new Headers()
  headers.set('Content-Type', file.type)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API}/v1/media`, { method: 'POST', headers, body: file, credentials: 'include' })
  if (!res.ok) {
    const errBody = await res.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(errBody?.error?.message ?? `HTTP ${res.status}`)
  }
  const body = await res.json() as { data: { key: string } }
  return body.data.key
}

// Build a fully-qualified URL to a media object (R2/KV) served by the API.
export const mediaUrl = (key: string): string => `${API}/v1/media/${key}`

// Initials avatar fallback — first letter of the first two words, uppercased.
// Used when a profile has no photo (or the photo 404s) so we render a stable
// colored circle instead of a broken thumbnail.
export const initials = (displayName: string): string => {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase()
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
}

// Curated list of common Asunción + Gran Asunción barrios used in
// autocomplete <datalist> on every barrio input. Order alphabetical to
// match user expectations when scrolling the dropdown.
export const BARRIOS: ReadonlyArray<string> = [
  'Areguá',
  'Asunción Centro',
  'Barrio Obrero',
  'Barrio San Pablo',
  'Bañado Norte',
  'Bañado Sur',
  'Botánico',
  'Capiatá',
  'Carmelitas',
  'Catedral',
  'Encarnación',
  'Fernando de la Mora',
  'Hipódromo',
  'Itá Enramada',
  'Itauguá',
  'Lambaré',
  'Las Mercedes',
  'Las Carmelitas',
  'Loma Pytã',
  'Luque',
  'Mariscal Estigarribia',
  'Mariscal López',
  'Mburicaó',
  'Mburucuyá',
  'Mcal. López',
  'Ñemby',
  'Pinozá',
  'Recoleta',
  'Sajonia',
  'San Antonio',
  'San Lorenzo',
  'San Pablo',
  'San Roque',
  'San Vicente',
  'Tablada Nueva',
  'Tembetary',
  'Trinidad',
  'Vista Alegre',
  'Villa Aurelia',
  'Villa Morra',
]
