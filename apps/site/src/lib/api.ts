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

  const res = await fetch(`${API}${path}`, { ...init, headers })
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

export interface CategoryDef {
  readonly value: string
  readonly label: string
  readonly emoji: string
}

export const CATEGORIES: ReadonlyArray<CategoryDef> = [
  { value: 'plumbing', label: 'Plomería', emoji: '🔧' },
  { value: 'electrical', label: 'Electricidad', emoji: '💡' },
  { value: 'cleaning', label: 'Limpieza', emoji: '🧽' },
  { value: 'repair', label: 'Reparaciones', emoji: '🛠️' },
  { value: 'beauty', label: 'Belleza', emoji: '💇' },
  { value: 'teaching', label: 'Clases', emoji: '📚' },
  { value: 'photography', label: 'Fotografía', emoji: '📷' },
  { value: 'translation', label: 'Traducción', emoji: '🌐' },
  { value: 'events', label: 'Eventos', emoji: '🎉' },
  { value: 'other', label: 'Otro', emoji: '✨' },
]

export const categoryLabel = (value: string): string =>
  CATEGORIES.find((c) => c.value === value)?.label ?? value

export const categoryEmoji = (value: string): string =>
  CATEGORIES.find((c) => c.value === value)?.emoji ?? '•'

export const formatGs = (gs: number | null | undefined): string => {
  if (gs === null || gs === undefined) return 'A coordinar'
  return `${new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(gs)} Gs`
}

export const formatRelativeTime = (unixSeconds: number): string => {
  const now = Math.floor(Date.now() / 1000)
  const delta = now - unixSeconds
  if (delta < 60) return 'ahora'
  if (delta < 3600) return `hace ${Math.floor(delta / 60)} min`
  if (delta < 86400) return `hace ${Math.floor(delta / 3600)} h`
  if (delta < 604800) return `hace ${Math.floor(delta / 86400)} d`
  return new Date(unixSeconds * 1000).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })
}
