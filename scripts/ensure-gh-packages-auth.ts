#!/usr/bin/env bun
/**
 * Runs before `bun install` via the `preinstall` lifecycle hook.
 *
 * Goal: make `bun install` "just work" without the dev manually exporting
 * NODE_AUTH_TOKEN or hand-editing ~/.npmrc. We consume @undeadliner/pya-*
 * packages from GitHub Packages, which require auth even for read.
 *
 * Resolution order (first hit wins):
 *  1. NODE_AUTH_TOKEN already in env (this is the CI path — actions pass GITHUB_TOKEN here).
 *  2. ~/.npmrc already has a real (non-placeholder) token for npm.pkg.github.com.
 *  3. `git credential fill host=github.com` — reuses whatever git push uses
 *     (Windows Credential Manager / macOS Keychain / Linux libsecret / GCM).
 *  4. `gh auth token` — fallback for setups that aren't using a git credential helper.
 *
 * If none of those produce a token we exit 0 (don't block install — devs may be
 * resolving everything via the sibling `pya-platform` checkout through bun overrides).
 *
 * NOTE on scopes: GitHub Packages read needs `read:packages` on the PAT. A token
 * minted by git's helper for HTTPS clone typically has `repo` only. If `bun install`
 * then 401s on a registry fetch, the dev needs to refresh the token's scopes once.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const REGISTRY_LINE = '//npm.pkg.github.com/:_authToken='
const NPMRC_PATH = join(homedir(), '.npmrc')

const existing = existsSync(NPMRC_PATH) ? readFileSync(NPMRC_PATH, 'utf8') : ''

const hasRealToken = existing
  .split(/\r?\n/)
  .some((line) => {
    if (!line.startsWith(REGISTRY_LINE)) return false
    const value = line.slice(REGISTRY_LINE.length).trim()
    return value.length > 0 && !value.includes('${')
  })

if (process.env['NODE_AUTH_TOKEN'] || hasRealToken) process.exit(0)

const fromGitCredential = (): string => {
  try {
    const out = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).toString()
    const match = out.match(/^password=(.+)$/m)
    return match?.[1]?.trim() ?? ''
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

const token = fromGitCredential() || fromGhCli()

if (!token) {
  console.warn('[pya-auth] No GitHub credential found (git credential / gh CLI both empty).')
  console.warn('[pya-auth] If local @undeadliner/pya-* deps resolve via the sibling')
  console.warn('[pya-auth] pya-platform checkout (bun overrides), you can ignore this.')
  console.warn('[pya-auth] Otherwise: `git clone` something from github.com first (to seed')
  console.warn('[pya-auth] the credential helper), or install gh CLI + `gh auth login`.')
  process.exit(0)
}

const stripped = existing
  .split(/\r?\n/)
  .filter((line) => !line.startsWith(REGISTRY_LINE))
  .join('\n')
  .replace(/\n+$/, '')

const next = (stripped ? `${stripped}\n` : '') + `${REGISTRY_LINE}${token}\n`
writeFileSync(NPMRC_PATH, next, { mode: 0o600 })
console.log('[pya-auth] Wrote GitHub Packages auth token to ~/.npmrc (from git credential helper).')
