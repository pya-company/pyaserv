#!/usr/bin/env bun
/**
 * One-shot onboarding: `bun run setup`.
 *
 * Our @pya-company/* packages live in private GitHub Packages, so `bun install`
 * needs a token with `read:packages` scope. This script writes it into
 * .env.local — bun auto-loads .env.local before resolving deps, so the
 * `${NODE_AUTH_TOKEN}` placeholder in .npmrc interpolates transparently.
 *
 * Token source (first hit wins):
 *   1. Existing NODE_AUTH_TOKEN env → done (CI path: workflow passes
 *      secrets.GITHUB_TOKEN there).
 *   2. `gh auth token` — prefer this when gh is installed; it tracks the
 *      currently-active gh account, so scope refreshes (gh auth refresh)
 *      take effect immediately.
 *   3. `git credential fill host=github.com` — fallback for setups without
 *      gh (Windows Credential Manager / Keychain / libsecret / GCM).
 *      Note: this returns whatever token your credential helper cached the
 *      last time you authenticated to github.com — may be stale.
 *
 * Then validates the token's OAuth scopes against api.github.com/user.
 * If `read:packages` is missing, prints the exact `gh auth refresh` line
 * and exits non-zero — onboarding failure is loud, not silent.
 *
 * No preinstall hook because bun runs lifecycle scripts AFTER dependency
 * resolution — at that point the 401 has already fired.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ENV_PATH = join(process.cwd(), '.env.local')

if (process.env['NODE_AUTH_TOKEN']) {
  console.log('[setup] NODE_AUTH_TOKEN already in env — nothing to do.')
  process.exit(0)
}

const fromGitCredential = (): string => {
  try {
    const out = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).toString()
    return out.match(/^password=(.+)$/m)?.[1]?.trim() ?? ''
  } catch {
    return ''
  }
}

const fromGhCli = (): string => {
  try {
    return execSync('gh auth token', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

const checkScopes = async (token: string): Promise<ReadonlyArray<string>> => {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return (res.headers.get('x-oauth-scopes') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const token = fromGhCli() || fromGitCredential()

if (!token) {
  console.error('[setup] No GitHub token found in git credential helper or gh CLI.')
  console.error('[setup] Either:')
  console.error('[setup]   • git clone https://github.com/anything — seeds the credential helper')
  console.error('[setup]   • gh auth login                         — installs gh + logs in')
  process.exit(1)
}

const scopes = await checkScopes(token)
const hasPackages =
  scopes.includes('read:packages') ||
  scopes.includes('write:packages') ||
  scopes.length === 0 // fine-grained PATs report empty x-oauth-scopes; trust them
if (!hasPackages) {
  console.error(`[setup] Token works but lacks 'read:packages' (has: ${scopes.join(', ')}).`)
  console.error('[setup] One-time fix:')
  console.error('[setup]   gh auth refresh -h github.com -s read:packages')
  console.error("[setup] Then re-run 'bun run setup'.")
  process.exit(1)
}

const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : ''
const stripped = existing
  .split(/\r?\n/)
  .filter((line) => !line.startsWith('NODE_AUTH_TOKEN='))
  .join('\n')
  .replace(/\n+$/, '')
const next = (stripped ? `${stripped}\n` : '') + `NODE_AUTH_TOKEN=${token}\n`
writeFileSync(ENV_PATH, next, { mode: 0o600 })

console.log('[setup] Wrote NODE_AUTH_TOKEN to .env.local.')
console.log('[setup] Now run: bun install')
