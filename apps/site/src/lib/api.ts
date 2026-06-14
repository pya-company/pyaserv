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

export const CATEGORIES = [
  { value: 'plumbing', label: 'Plomería' },
  { value: 'electrical', label: 'Electricidad' },
  { value: 'cleaning', label: 'Limpieza' },
  { value: 'repair', label: 'Reparaciones' },
  { value: 'beauty', label: 'Belleza' },
  { value: 'teaching', label: 'Clases' },
  { value: 'photography', label: 'Fotografía' },
  { value: 'translation', label: 'Traducción' },
  { value: 'events', label: 'Eventos' },
  { value: 'other', label: 'Otro' },
] as const

export const categoryLabel = (value: string): string =>
  CATEGORIES.find((c) => c.value === value)?.label ?? value
