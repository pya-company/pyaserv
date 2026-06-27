/*
 * E2E: /docs/ wiki must localize beyond ES.
 *
 * Bug: docs-no-en-de-ru-content-14-of-15.
 *  - Only en/content/docs/perfil.yaml exists; 14 other slugs (insignias,
 *    cotizador, multilingüe, …) ship only ES YAML. Per-slug H1, sidebar
 *    titles, breadcrumbs and section H2s are emitted as
 *    data-l10n-text='{"es":"…"}' — no EN key — so the client-side locale
 *    swap is a no-op and EN/DE/RU users keep reading Spanish with no
 *    "ES fallback" badge.
 *  - /docs/ index group H2s ("Herramientas", "Roadmap", …) ship as plain
 *    text with no data-l10n-text at all.
 *
 * Per spec §17, EN must be a first-class language with parity. This test
 * MUST be RED until at least EN translations land for every doc slug and
 * the index page H2s + per-card titles carry data-l10n-text with an "en".
 */
import { expect, test } from '@playwright/test'

const SLUGS_MISSING_EN = ['insignias', 'cotizador', 'multilingue', 'xp'] as const

test.describe('docs wiki — EN localization', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('pyaserv.locale', 'en') } catch {}
    })
  })

  for (const slug of SLUGS_MISSING_EN) {
    test(`/docs/${slug}/ H1 renders in English when lang=en`, async ({ page }) => {
      await page.goto(`/docs/${slug}/`)
      await expect(page.locator('html')).toHaveAttribute('lang', 'en')

      const h1 = page.locator('article.docpage h1')
      const h1Text = (await h1.textContent())?.trim() ?? ''

      // The H1's data-l10n-text must contain an "en" key — the bug is that
      // it ships only {"es":"…"}, so the locale swap cannot find an EN value.
      const l10n = await h1.getAttribute('data-l10n-text')
      expect(l10n, `${slug} H1 data-l10n-text missing`).toBeTruthy()
      const parsed = JSON.parse(l10n ?? '{}') as Record<string, string>
      expect(parsed.en, `${slug} H1 has no "en" translation: ${l10n}`).toBeTruthy()

      // And the rendered text must match the EN translation (i.e. swap ran).
      expect(h1Text).toBe(parsed.en)
    })
  }

  test('/docs/insignias/ section H2 ("Categorías") localizes on EN', async ({ page }) => {
    await page.goto('/docs/insignias/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    const h2 = page.locator('article.docpage section h2').first()
    const l10n = await h2.getAttribute('data-l10n-text')
    expect(l10n).toBeTruthy()
    const parsed = JSON.parse(l10n ?? '{}') as Record<string, string>
    expect(parsed.en, `section H2 has no "en" key: ${l10n}`).toBeTruthy()

    const visible = (await h2.textContent())?.trim() ?? ''
    // Must NOT be the Spanish "Categorías" — bug stays Spanish.
    expect(visible).not.toBe('Categorías')
    expect(visible).toBe(parsed.en)
  })

  test('/docs/ sidebar entry "Multilingüe per-perfil" localizes on EN', async ({ page }) => {
    await page.goto('/docs/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    const link = page.locator('.docs-sidebar__item a[href="/docs/multilingue/"] span').first()
    const l10n = await link.getAttribute('data-l10n-text')
    expect(l10n).toBeTruthy()
    const parsed = JSON.parse(l10n ?? '{}') as Record<string, string>
    expect(parsed.en, `sidebar title for /docs/multilingue/ has no "en" key: ${l10n}`).toBeTruthy()

    const visible = (await link.textContent())?.trim() ?? ''
    expect(visible).not.toContain('Multilingüe')
    expect(visible).toBe(parsed.en)
  })

  test('/docs/ index group H2 ("Herramientas") localizes on EN', async ({ page }) => {
    await page.goto('/docs/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    // Find the group H2 that, in ES, reads "Herramientas".
    const h2 = page.locator('main h2', { hasText: /Herramientas|Tools/ }).first()
    await expect(h2).toBeVisible()

    // Either the node localizes via data-l10n-text or its visible text is EN.
    const visible = (await h2.textContent())?.trim() ?? ''
    expect(visible, 'group H2 stayed Spanish ("Herramientas") on EN locale').not.toBe('Herramientas')
  })

  test('/docs/insignias/ breadcrumb tail localizes on EN', async ({ page }) => {
    await page.goto('/docs/insignias/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    const tail = page.locator('nav.docpage__crumbs span[data-l10n-text]').first()
    const l10n = await tail.getAttribute('data-l10n-text')
    expect(l10n).toBeTruthy()
    const parsed = JSON.parse(l10n ?? '{}') as Record<string, string>
    expect(parsed.en, `breadcrumb tail has no "en" key: ${l10n}`).toBeTruthy()

    const visible = (await tail.textContent())?.trim() ?? ''
    expect(visible).toBe(parsed.en)
  })
})
