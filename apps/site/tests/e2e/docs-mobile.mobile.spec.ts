/*
 * E2E (mobile only) — REGRESSION GUARD for bug
 * "docs-mobile-no-sidebar-collapse-duplicate-content".
 *
 * Two symptoms on mobile (≤820 px) /docs/:
 *   1) /docs/insignias/ — the .docs-sidebar (21+ rows) stacks above the
 *      article instead of collapsing to a drawer / <details> / jump-to.
 *      There is no toggle control of any kind, so the article body starts
 *      far below the fold. The mobile spec calls this out as
 *      "mobile-collapsing of sidebar".
 *   2) /docs/ index — the page renders the sidebar AND a main column with
 *      the exact same 15 entries (same hrefs). Wireframe §16.8 says the
 *      index should NOT mirror the sidebar — it should host TL;DRs,
 *      media previews, "Probar →" CTAs and an "Últimas novedades" block.
 *
 * These tests are intentionally red against current prod. After the fix
 * (drawer/accordion + index redesign) they should turn green.
 */
import { expect, test } from '@playwright/test'

// Selectors broad enough to accept any reasonable fix: a button with
// aria-controls pointing at the sidebar, a hook attribute, a BEM toggle,
// or a <details>/<summary> wrapping the sidebar.
const SIDEBAR_TOGGLE = [
  '[data-docs-sidebar-toggle]',
  'button[aria-controls*="sidebar"]',
  '.docs-sidebar__toggle',
  'details.docs-sidebar',
  '.docs-sidebar details > summary',
].join(', ')

test.describe('/docs/ on mobile — sidebar collapse + index layout', () => {
  test('article page exposes a sidebar collapse control (drawer / details / toggle)', async ({ page }) => {
    await page.goto('/docs/insignias/')

    const sidebar = page.locator('.docs-sidebar')
    await expect(sidebar).toBeVisible()

    // BUG: no collapse affordance exists on mobile — the sidebar just
    // stacks above the article. Any one of these would satisfy the spec.
    const toggle = page.locator(SIDEBAR_TOGGLE)
    await expect(toggle, 'mobile /docs/insignias/ must offer a sidebar collapse control').toHaveCount(1)
  })

  test('article on mobile starts near the top of the viewport (sidebar not pushing it off-fold)', async ({ page }) => {
    await page.goto('/docs/insignias/')

    const article = page.locator('article.docs-content, main.docs-content, .docpage').first()
    await expect(article).toBeVisible()

    const viewportHeight = page.viewportSize()?.height ?? 0
    expect(viewportHeight).toBeGreaterThan(0)

    const articleTop = await article.evaluate(el => el.getBoundingClientRect().top)

    // Sidebar has ~21 link rows × ~34 px ≈ 700 px stacked above the article.
    // After a fix (drawer/accordion), the article header should land well
    // within the first viewport. Threshold = half a viewport, very generous.
    expect(
      articleTop,
      `article top should be within first viewport (got ${articleTop}px, viewport=${viewportHeight}px)`
    ).toBeLessThan(viewportHeight / 2)
  })

  test('/docs/ index does NOT duplicate the sidebar entries in the main column', async ({ page }) => {
    await page.goto('/es/docs/')

    const sidebar = page.locator('.docs-sidebar')
    await expect(sidebar).toBeVisible()

    const sidebarHrefs = await page.locator('.docs-sidebar a[href*="/docs/"]').evaluateAll(
      anchors => anchors.map(a => (a as HTMLAnchorElement).getAttribute('href')).filter(Boolean) as string[]
    )

    const mainHrefs = await page
      .locator('main.docs-content a[href*="/docs/"], .docs-content > section a[href*="/docs/"]')
      .evaluateAll(
        anchors => anchors.map(a => (a as HTMLAnchorElement).getAttribute('href')).filter(Boolean) as string[]
      )

    expect(sidebarHrefs.length, 'sidebar should have items').toBeGreaterThan(0)

    // BUG: prod ships sidebarHrefs == mainHrefs (same 15 hrefs).
    // A correct index hosts curated content (TL;DRs / cards / latest
    // releases), so the main column must NOT be a verbatim mirror.
    const sidebarSet = new Set(sidebarHrefs)
    const overlap = mainHrefs.filter(h => sidebarSet.has(h)).length
    expect(
      overlap,
      `main column should not mirror the sidebar (overlap=${overlap}, sidebar=${sidebarHrefs.length}, main=${mainHrefs.length})`
    ).toBeLessThan(sidebarHrefs.length)
  })

  test('/docs/ index hosts curated content blocks (CTA + latest releases)', async ({ page }) => {
    await page.goto('/es/docs/')

    // /docs/ index needs at least one actionable CTA (now "Ver real →" /
    // "View →") and a "Últimas novedades" / Latest releases block. Demo
    // mode is gone, so CTAs route to realUrl-style targets only.
    const cta = page.locator('main.docs-content a, .docs-content a').filter({
      hasText: /Ver real\s*→|See live\s*→|Live ansehen\s*→|Открыть\s*→/i,
    })
    const latestBlock = page.locator('main.docs-content, .docs-content').getByText(
      /Últimas novedades|Latest releases|Latest updates|Neueste|Последние/i
    )

    await expect(cta.first(), '/docs/ index must surface an actionable CTA on at least one featured card').toBeVisible()
    await expect(latestBlock.first(), '/docs/ index must surface an "Últimas novedades" block').toBeVisible()
  })
})
