/*
 * Demo Mode v2 — E2E regression suite.
 *
 * Bugs we are guarding against (real user reports 2026-06-25 / 2026-06-26):
 *  1. Demo banner becomes "sticky forever" — appears even on URLs without
 *     ?demo=1 because of leftover sessionStorage from an older version.
 *  2. CSS `display: flex` on .ps-demo-banner overrode the UA stylesheet's
 *     `[hidden] { display: none }`, so the JS toggle of `banner.hidden`
 *     had no visible effect — banner stayed up.
 *  3. "Salir del demo" button click did nothing / banner stayed.
 *  4. Navigating to a non-demo route still showed the banner.
 *
 * We test on /docs/ (public, no auth) so the redirect-to-login on /me/
 * doesn't race with our assertions.
 */
import { expect, test } from '@playwright/test'

const seedDirtySession = async (page: import('@playwright/test').Page) => {
  // Simulate a regression: an older deploy that wrote sessionStorage flag.
  await page.addInitScript(() => {
    try { sessionStorage.setItem('pyaserv.demo.active', '1') } catch {}
  })
}

test.describe('Demo Mode banner — URL-only contract', () => {
  test('plain /docs/ shows NO demo banner', async ({ page }) => {
    await page.goto('/docs/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)
    const banner = page.locator('#demo-banner')
    await expect(banner).toBeHidden()
  })

  test('plain /releases/ shows NO demo banner', async ({ page }) => {
    await page.goto('/releases/')
    await page.waitForLoadState('networkidle')
    const banner = page.locator('#demo-banner')
    await expect(banner).toBeHidden()
  })

  test('/docs/?demo=1 shows the banner', async ({ page }) => {
    await page.goto('/docs/?demo=1')
    await page.waitForTimeout(500)
    const banner = page.locator('#demo-banner')
    await expect(banner).toBeVisible()
    await expect(banner.locator('[data-demo-exit]')).toBeVisible()
  })

  test('Exit button removes banner AND strips ?demo from URL', async ({ page }) => {
    await page.goto('/docs/?demo=1')
    await page.waitForTimeout(500)
    const banner = page.locator('#demo-banner')
    await expect(banner).toBeVisible()

    await banner.locator('[data-demo-exit]').click()

    // After click, the page navigates to the same path without ?demo
    await expect.poll(() => new URL(page.url()).searchParams.has('demo'), { timeout: 5000 }).toBe(false)
    await page.waitForLoadState('networkidle')
    await expect(banner).toBeHidden()
  })

  test('REGRESSION: leftover sessionStorage flag does NOT keep banner alive', async ({ page }) => {
    await seedDirtySession(page)
    await page.goto('/docs/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)
    const banner = page.locator('#demo-banner')
    await expect(banner).toBeHidden()
  })

  test('REGRESSION: navigating to /releases/ from demo removes banner', async ({ page }) => {
    // Start in demo on /docs/?demo=1
    await page.goto('/docs/?demo=1')
    await page.waitForTimeout(500)
    await expect(page.locator('#demo-banner')).toBeVisible()

    // Navigating to /releases/ (no ?demo=1) — banner must hide.
    await page.goto('/releases/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)
    await expect(page.locator('#demo-banner')).toBeHidden()
  })

  test('REGRESSION: in-demo /specialists/ links get ?demo=1 appended (sticky)', async ({ page }) => {
    await page.goto('/docs/?demo=1')
    await page.waitForTimeout(800)
    // After stickifyLinks runs, ANY internal /specialists/ link href contains demo=1
    const link = page.locator('a[href^="/specialists/"]').first()
    await expect(link).toBeAttached()
    const href = await link.getAttribute('href')
    expect(href, `expected ?demo=1 in href ${href}`).toMatch(/demo=1/)
  })

  test('REGRESSION: in-demo /docs/ links do NOT get ?demo=1 appended', async ({ page }) => {
    await page.goto('/docs/?demo=1')
    await page.waitForTimeout(800)
    // /docs/ is OUTSIDE demo-sticky allowlist; navigating there should exit demo.
    const links = page.locator('a[href^="/docs/"]')
    const count = await links.count()
    expect(count, '/docs/ links should exist on /docs/').toBeGreaterThan(0)
    // None should have ?demo=1
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href') ?? ''
      expect(href, `/docs/ link should NOT have demo=1 (got "${href}")`).not.toMatch(/demo=1/)
    }
  })

  test('Banner exit button is not blocked by any overlapping element', async ({ page }) => {
    await page.goto('/docs/?demo=1')
    await page.waitForTimeout(500)
    const exitBtn = page.locator('[data-demo-exit]')
    await expect(exitBtn).toBeVisible()
    const box = await exitBtn.boundingBox()
    expect(box).not.toBeNull()
    if (!box) throw new Error('no box')
    const hitsButton = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null
      return !!el?.closest('[data-demo-exit]')
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    expect(hitsButton).toBe(true)
  })
})
