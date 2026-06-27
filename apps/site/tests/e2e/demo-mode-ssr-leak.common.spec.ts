/*
 * BUG: ssr-real-data-leaks-into-demo
 * ----------------------------------
 * /specialists/?demo=1 and /clients/?demo=1 render REAL production users in
 * the initial HTML because src/pages/specialists.astro:31-38 and
 * src/pages/clients.astro:30-37 do a raw build-time `fetch(API)` and embed
 * the response into the SSR'd markup. The client-side apiFetch interception
 * (demo-stubs.ts ROUTES) runs LATER, but no second fetch ever happens for
 * the initial unfiltered list, so the leaked cards are never replaced.
 *
 * /p/?slug=juan-perez-demo&demo=1 is the inverse symptom: src/pages/p/index.astro:79
 * also uses a raw `fetch`, bypassing the demoStub /v1/p/:slug route that
 * would return DEMO_PROFILE. The real API returns 404 for that slug, so the
 * page is stuck forever on "Cargando…".
 *
 * AC (spec §15 Demo Mode):
 *  - L2/L3: real page components render in demo, fed by demoStub data.
 *  - L5: every demo entity is prefixed `Demo:` / wears a DEMO badge.
 *  - /v1/specialists and /v1/requests both return wrap([]) in demo.
 *  - /v1/p/:slug returns DEMO_PROFILE (displayName "Demo: Juan Pérez").
 *
 * These tests MUST be RED on current prod and GREEN once SSR is gated on
 * demo mode (skip raw fetch when query has ?demo=1, or move the list to a
 * client-only render path that flows through apiFetch).
 */
import { expect, test, type Page } from '@playwright/test'

const REAL_USER_NAMES = ['E2E Verify', 'Test Profile', 'María González', 'Carlos QA Plomero'] as const

const assertNoRealNames = async (page: Page) => {
  const bodyText = await page.locator('#main-content').innerText()
  for (const name of REAL_USER_NAMES) {
    expect(bodyText, `real production name "${name}" leaked into demo view`).not.toContain(name)
  }
}

test.describe('Demo Mode SSR leak — /specialists/?demo=1', () => {
  test('does NOT render real production specialist cards in initial HTML', async ({ page }) => {
    await page.goto('/specialists/?demo=1')
    await page.waitForLoadState('networkidle')

    // Banner must be up (sanity — we ARE in demo).
    await expect(page.locator('#demo-banner')).toBeVisible()

    // Real names from prod must NOT appear anywhere in the main content.
    await assertNoRealNames(page)

    // demoStub returns wrap([]) for /v1/specialists, so either the empty-state
    // message is shown OR every card name is prefixed "Demo:" (if a future fix
    // seeds demo list data). Whatever a fix chooses, real cards must be gone.
    const cards = page.locator('#results .ps-card')
    const cardCount = await cards.count()
    if (cardCount > 0) {
      for (let i = 0; i < cardCount; i++) {
        const heading = (await cards.nth(i).locator('h2').first().innerText()).trim()
        expect(heading, `card #${i} heading "${heading}" must start with "Demo:"`).toMatch(/^Demo:/)
      }
    }
  })
})

test.describe('Demo Mode SSR leak — /clients/?demo=1', () => {
  test('does NOT render real production request cards in initial HTML', async ({ page }) => {
    await page.goto('/clients/?demo=1')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('#demo-banner')).toBeVisible()

    // Real production specialist names should never appear on the clients
    // page either (defensive — same SSR pattern, same leak class).
    await assertNoRealNames(page)

    // demoStub returns wrap([]) for /v1/requests. Either an empty state, or
    // every card title is "Demo:"-prefixed. The card count in the SSR'd HTML
    // should match what apiFetch (intercepted) would return — namely zero, or
    // a future demo-seeded set.
    const cards = page.locator('#results .ps-card')
    const cardCount = await cards.count()
    if (cardCount > 0) {
      for (let i = 0; i < cardCount; i++) {
        const heading = (await cards.nth(i).locator('h2').first().innerText()).trim()
        expect(heading, `card #${i} heading "${heading}" must start with "Demo:"`).toMatch(/^Demo:/)
      }
    }
  })
})

test.describe('Demo Mode SSR leak — /p/?slug=juan-perez-demo&demo=1', () => {
  test('does NOT hang on "Cargando…" — DEMO_PROFILE is rendered', async ({ page }) => {
    await page.goto('/p/?slug=juan-perez-demo&demo=1')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('#demo-banner')).toBeVisible()

    // The profile name span must NOT remain on the loading placeholder.
    const nameEl = page.locator('#profile-name')
    await expect(nameEl).toBeVisible()
    // DEMO_PROFILE.displayName === 'Demo: Juan Pérez'
    await expect(nameEl).toHaveText('Demo: Juan Pérez', { timeout: 8000 })

    // And the "Perfil no encontrado" error block must NOT have been shown —
    // the raw fetch path currently 404s on the real API; demoStub would 200.
    await expect(page.locator('#profile-error')).toBeHidden()
  })
})
