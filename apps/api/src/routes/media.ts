import { requireAuth } from '@pya-company/auth'
import { ValidationError, uuidV7 } from '@pya-company/shared'
import { Hono } from 'hono'

interface AppEnv {
  readonly Bindings: Env
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024

// POST /v1/media — accepts raw image body, stores in R2 (or KV fallback), returns the key.
// GET /v1/media/:key — serves the binary.
export const mediaRoutes = new Hono<AppEnv>()
  .post('/', requireAuth, async (c) => {
    const ctype = c.req.header('content-type') ?? ''
    if (!ALLOWED.has(ctype))
      throw new ValidationError({ issues: [{ path: 'content-type', message: 'jpeg, png or webp only' }] })
    const buf = await c.req.arrayBuffer()
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES)
      throw new ValidationError({ issues: [{ path: 'body', message: `image must be 1 byte to ${MAX_BYTES} bytes` }] })
    const ext = ctype.split('/')[1] ?? 'bin'
    const key = `${uuidV7()}.${ext}`
    const r2 = (c.env as Env & { MEDIA?: R2Bucket }).MEDIA
    if (r2) {
      await r2.put(key, buf, { httpMetadata: { contentType: ctype } })
    } else {
      // Fallback: store in KV (less ideal — KV value limit is 25MB but byte-cost is higher).
      const kv = (c.env as Env & { MEDIA_KV?: KVNamespace }).MEDIA_KV
      if (!kv) throw new ValidationError({ issues: [{ path: 'env', message: 'no media storage configured' }] })
      await kv.put(key, buf, { metadata: { contentType: ctype } })
    }
    return c.json({ data: { key } }, 201)
  })
  .get('/:key', async (c) => {
    const key = c.req.param('key')
    const r2 = (c.env as Env & { MEDIA?: R2Bucket }).MEDIA
    if (r2) {
      const obj = await r2.get(key)
      if (!obj) return c.notFound()
      return new Response(obj.body, {
        headers: {
          'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      })
    }
    const kv = (c.env as Env & { MEDIA_KV?: KVNamespace }).MEDIA_KV
    if (!kv) return c.notFound()
    const { value, metadata } = await kv.getWithMetadata<{ contentType: string }>(key, 'arrayBuffer')
    if (!value) return c.notFound()
    return new Response(value, {
      headers: {
        'content-type': metadata?.contentType ?? 'application/octet-stream',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    })
  })
