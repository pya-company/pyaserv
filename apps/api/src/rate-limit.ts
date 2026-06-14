import { RateLimitedError } from '@pya-company/shared'

// Cheap rate limit on top of the SESSIONS KV namespace.
// Key shape: `rl:<bucket>:<identifier>` — value is just a counter; KV TTL handles the
// reset window so we don't need a heartbeat or sweep. Last-write-wins on race, which
// is acceptable for these limits (counter may undercount briefly but never overcount
// past the next put).
//
// Cost note: every check is 1 KV read + 1 KV write. KV puts are ~$0.5/1M, so 10 puts
// per user-day on inquiries is ~$0.0000005 per user-day — irrelevant.

export interface RateLimitOpts {
  readonly bucket: string
  readonly id: string
  readonly limit: number
  readonly windowSec: number
}

/**
 * Throws RateLimitError when the bucket has been hit `limit` times in the last
 * `windowSec`. KV does the reset for us via expirationTtl on first write.
 */
export const checkRateLimit = async (
  kv: KVNamespace,
  opts: RateLimitOpts,
): Promise<void> => {
  const key = `rl:${opts.bucket}:${opts.id}`
  const current = await kv.get(key, { type: 'text' })
  const n = current === null ? 0 : Number(current)
  if (n >= opts.limit) {
    throw new RateLimitedError({ retryAfterSec: opts.windowSec })
  }
  // First write seeds the window; subsequent writes do not reset the TTL (KV
  // preserves the existing expiration on `put` without an explicit option).
  // To keep the window stable we re-issue the expirationTtl every time —
  // KV will round-trip the new TTL, which slightly extends the window but
  // never below `windowSec`. Acceptable for spam/abuse limits.
  await kv.put(key, String(n + 1), { expirationTtl: opts.windowSec })
}
