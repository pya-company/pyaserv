/*
 * REGRESSION GUARD: /me/ and /p/?slug=... must respect the active locale.
 *
 * Bug me-advanced-profile-hardcoded-spanish:
 *   - src/pages/me.astro hardcodes Spanish for:
 *       * tab labels "📄 Cotizaciones", "👥 Mis clientes", "🏆 Logros"
 *       * the "Perfil avanzado (…)" <details> block and its inner CTAs
 *         ("+ Agregar servicio", "+ Agregar foto", "Guardar perfil avanzado", …)
 *       * passkey/quests skeletons "Cargando passkeys…" / "Cargando misiones…"
 *   - src/pages/p/index.astro hardcodes Spanish for:
 *       * "Cargando…" placeholder, "Sobre mí", "Servicios", "Zonas de trabajo",
 *         "Trabajos", "Insignias", CTA "Contactar por WhatsApp", tier badge
 *         "aprendiz", WhatsApp template "Hola …, te contacto desde PyaServ.",
 *         error/no-slug states.
 *
 * Expected (AC-ML2): the entire UI of /me/ and /p/* must localize cleanly to
 * any of ES/EN/DE/RU. The strings listed above are baked into the Astro
 * markup as plain Spanish (no <T>, no data-i18n, no per-locale <span lang>
 * pairs) so an EN visitor will always see them.
 *
 * Strategy:
 *   - /me/ requires auth so a JS-only test redirects to /login/. The bug
 *     lives in the static markup itself, so we fetch the raw HTML and assert
 *     the offending literals are absent from the file. Once fixed, the
 *     strings will either disappear from SSR or live inside <span lang="es">
 *     pairs (the rest of the page already uses this pattern via <T>); both
 *     outcomes satisfy "no raw, unconditional ES literal in the markup".
 *     We assert on the precise hardcoded tokens, not generic substrings.
 *   - /p/?slug=… renders client-side from /v1/p/<slug>; we drive it through
 *     a real EN-locale browser session, including the bare loading state.
 *
 * Must be RED on current prod; GREEN once T/data-i18n covers the listed nodes.
 */
import { expect, test } from '@playwright/test'

const setLocaleEn = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('pyaserv.locale', 'en') } catch {}
  })
}

// A real, public specialist slug returned by the prod API. Used in the
// bug report's repro steps.
const PUBLIC_SLUG = '019ecf43-f9cf-760e-adb5-62f37461380c'

test.describe('/me/ markup — hardcoded Spanish leaks regardless of locale', () => {
  test('advanced-profile <details> summary + CTAs are not raw ES literals', async ({ request }) => {
    const res = await request.get('/me/')
    expect(res.status()).toBe(200)
    const html = await res.text()

    // Each of these strings sits in /src/pages/me.astro as a plain Spanish
    // literal with no localization wrapper. The fix should remove them from
    // the SSR'd markup (or wrap them in per-locale <span lang> pairs).
    expect(html, 'Perfil avanzado summary must not be a raw ES literal').not.toMatch(
      /<summary[^>]*>\s*Perfil avanzado/,
    )
    expect(html, 'Save button must not be hardcoded ES').not.toContain('Guardar perfil avanzado')
    expect(html, 'Add-service button must not be hardcoded ES').not.toContain('+ Agregar servicio')
    expect(html, 'Add-photo button must not be hardcoded ES').not.toContain('+ Agregar foto')
  })

  test('tab labels Cotizaciones / Mis clientes / Logros are not raw ES literals', async ({ request }) => {
    const res = await request.get('/me/')
    expect(res.status()).toBe(200)
    const html = await res.text()

    // Sibling tabs already use the <T>-emitted <span lang> pair pattern,
    // e.g.  <span lang="es">👤 Mi perfil</span><span lang="en">👤 My profile</span>.
    // The three below have only the ES variant inside the <button>.
    expect(html, 'Cotizaciones tab needs EN variant').not.toMatch(
      /data-tab="quotes"[^>]*>📄 Cotizaciones</,
    )
    expect(html, 'Mis clientes tab needs EN variant').not.toMatch(
      /data-tab="clients"[^>]*>👥 Mis clientes</,
    )
    expect(html, 'Logros tab needs EN variant').not.toMatch(
      /data-tab="game"[^>]*>🏆 Logros</,
    )
  })

  test('skeleton placeholders Cargando passkeys / Cargando misiones are not raw ES', async ({ request }) => {
    const res = await request.get('/me/')
    expect(res.status()).toBe(200)
    const html = await res.text()
    expect(html).not.toContain('Cargando passkeys')
    expect(html).not.toContain('Cargando misiones')
  })
})

test.describe('/p/?slug=… i18n — public profile must respect EN locale', () => {
  test.beforeEach(async ({ page }) => {
    await setLocaleEn(page)
  })

  test('section titles + CTA are translated, not hardcoded ES', async ({ page }) => {
    await page.goto(`/p/?slug=${PUBLIC_SLUG}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    // Wait for the client fetch to /v1/p/<slug> to settle so sections render.
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    // Section headings hardcoded in /p/index.astro markup.
    await expect(body).not.toContainText('Sobre mí')
    await expect(body).not.toContainText('Zonas de trabajo')
    await expect(body).not.toContainText('Trabajos')
    await expect(body).not.toContainText('Insignias')
    // CTA link text "Contactar por WhatsApp".
    await expect(body).not.toContainText('Contactar por WhatsApp')
  })

  test('initial "Cargando…" placeholder is not in ES on EN visitor', async ({ page }) => {
    // Block the API so the page stays on the loading placeholder long enough
    // to read it. This isolates the literal in markup from the post-fetch DOM.
    await page.route('**/v1/p/**', async () => {
      // Never resolve — keep the placeholder visible.
    })
    await page.goto(`/p/?slug=${PUBLIC_SLUG}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    const name = page.locator('#profile-name')
    await expect(name).toBeVisible()
    // Current bug: textContent === "Cargando…" regardless of locale.
    await expect(name).not.toHaveText(/Cargando/)
  })
})
