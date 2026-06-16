import { t } from './i18n'

const API = (typeof import.meta.env.PUBLIC_API_URL === 'string' && import.meta.env.PUBLIC_API_URL) ||
  'https://api.pyaserv.com'

const TOKEN_KEY = 'pyaserv.token'

export const getToken = (): string | null =>
  typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY)

export const setToken = (token: string): void => {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export const clearToken = (): void => {
  sessionStorage.removeItem(TOKEN_KEY)
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
    res = await fetch(`${API}${path}`, { ...init, headers })
  } catch {
    throw new Error(t('error.network'))
  }
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
  const res = await fetch(`${API}/v1/media`, { method: 'POST', headers, body: file })
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
