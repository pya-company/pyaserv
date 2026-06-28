/*
 * Lang switcher buttons in the mobile flying-menu must meet WCAG 2.5.5 AAA /
 * Apple HIG / Material Design tappable-target sizing: at least 44×44 px.
 *
 * Bug (2026-06): .ps-lang-btn { min-height: 32px; min-width: 36px } in
 * apps/site/src/styles/global.css:344-353 leaves the four buttons at
 * roughly 36×32 / 38×32 / 39×32 — narrow, short, and shoulder-to-shoulder
 * which makes mis-taps routine.
 */
import { expect, test } from '@playwright/test'

const MIN_TAPPABLE_PX = 44

test.describe('mobile flying-menu lang buttons — touch target', () => {
  test('every ES/EN/DE/RU button is ≥44×44 px after menu opens', async ({ page }) => {
    await page.goto('/es/')

    // Open the floating menu (bottom-right hamburger).
    const fly = page.locator('flying-menu')
    await expect(fly).not.toHaveAttribute('open', '')
    await fly.locator('[slot="trigger"]').tap()
    await expect(fly).toHaveAttribute('open', '', { timeout: 2000 })

    // Buttons live inside the flying-menu slot, not in the (hidden) topbar.
    const buttons = page.locator('.ps-fly__menu .ps-lang-btn')
    await expect(buttons).toHaveCount(4)

    const sizes = await buttons.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return { lang: el.getAttribute('data-lang'), width: r.width, height: r.height }
      }),
    )

    for (const s of sizes) {
      expect.soft(s.width, `lang=${s.lang} width`).toBeGreaterThanOrEqual(MIN_TAPPABLE_PX)
      expect.soft(s.height, `lang=${s.lang} height`).toBeGreaterThanOrEqual(MIN_TAPPABLE_PX)
    }

    // Make sure no soft assertion failed.
    expect(test.info().errors).toHaveLength(0)
  })
})
