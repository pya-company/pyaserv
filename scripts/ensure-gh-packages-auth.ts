#!/usr/bin/env bun
/**
 * Runs before `bun install` via the `preinstall` lifecycle hook.
 *
 * Goal: make `bun install` "just work" without the dev manually exporting
 * NODE_AUTH_TOKEN or hand-editing ~/.npmrc. We consume @undeadliner/pya-*
 * packages from GitHub Packages, which require auth even for read.
 *
 * Resolution order:
 *  1. NODE_AUTH_TOKEN already in env → done (this is the CI path).
 *  2. ~/.npmrc already has a non-placeholder token for npm.pkg.github.com → done.
 *  3. `gh auth token` works → write that token to ~/.npmrc (user-level).
 *  4. Otherwise print actionable instructions and exit 0 (don't block install
 *     — local devs may be working off sibling overrides and not need the registry).
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

let token = ''
try {
  token = execSync('gh auth token', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
} catch {
  console.warn('[pya-auth] `gh auth token` failed.')
  console.warn('[pya-auth] If your local @undeadliner/pya-* deps resolve via the')
  console.warn('[pya-auth] sibling pya-platform checkout (bun overrides), you can ignore this.')
  console.warn('[pya-auth] Otherwise: install gh CLI, then run')
  console.warn('[pya-auth]   gh auth login && gh auth refresh -s read:packages')
  process.exit(0)
}

if (!token) process.exit(0)

const stripped = existing
  .split(/\r?\n/)
  .filter((line) => !line.startsWith(REGISTRY_LINE))
  .join('\n')
  .replace(/\n+$/, '')

const next = (stripped ? `${stripped}\n` : '') + `${REGISTRY_LINE}${token}\n`
writeFileSync(NPMRC_PATH, next, { mode: 0o600 })
console.log('[pya-auth] Wrote GitHub Packages auth token to ~/.npmrc (from gh CLI).')
