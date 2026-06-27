/*
 * Demo Mode banner — mobile truncation regression.
 *
 * Bug: demo-banner-text-truncated-mobile (high severity, mobile-ux).
 *
 * On mobile viewports (Pixel 7 = 412 px) the orange demo banner renders
 *   "MODO DEMO — los cambios no se guardan."
 * but the rest of the safety message
 *   "Estás viendo la app real con datos ficticios."
 * gets clipped because `.ps-demo-banner__text` uses
 *   white-space: nowrap; text-overflow: ellipsis; overflow: hidden;
 * The "Salir del demo" button eats the remaining row width, so the critical
 * "fake data" disclaimer is invisible — exactly where it matters most.
 *
 * Spec §15 / AC-L1 requires a non-dismissible *visible* warning. The full
 * sentence (including the "fake data" / "datos ficticios" half) MUST render
 * within the viewport. Truncation = bug.
 *
 * The same regression hits DE ("DEMO-MODUS — Änderungen ..." -> ellipsis
 * before "fiktiven Daten") and RU.
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO_SAFETY_PHRASES = {
  es: 'datos ficticios',
  en: 'fake data',
  de: 'fiktiven Daten',
} as const

const waitForBannerVisible = async (page: Page) => {
  const banner = page.locator('#demo-banner')
  await expect(banner).toBeVisible()
  return banner
}

const measureTextOverflow = async (page: Page) => {
  return page.evaluate(() => {
    const el = document.querySelector('.ps-demo-banner__text') as HTMLElement | null
    if (!el) return { found: false } as const
    const cs = getComputedStyle(el)
    return {
      found: true,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      visibleText: el.innerText,
      whiteSpace: cs.whiteSpace,
      textOverflow: cs.textOverflow,
      overflow: cs.overflow,
    } as const
  })
}

test.describe('Demo banner — mobile (≤412px) must show full safety message', () => {
  test('ES (/?demo=1&lang=es) — full "datos ficticios" disclaimer fits without ellipsis', async ({ page }) => {
    await page.goto('/?demo=1&lang=es')
    await waitForBannerVisible(page)
    const m = await measureTextOverflow(page)
    expect(m.found, 'banner text node missing').toBe(true)
    if (!m.found) return

    // 1. Visible (rendered) text must include the safety disclaimer.
    expect(
      m.visibleText,
      `banner visible text "${m.visibleText}" is missing the "datos ficticios" disclaimer`,
    ).toContain(DEMO_SAFETY_PHRASES.es)

    // 2. No horizontal clipping: scrollWidth must fit within clientWidth.
    expect(
      m.scrollWidth,
      `banner text is truncated by overflow:hidden — scrollWidth=${m.scrollWidth} > clientWidth=${m.clientWidth}; visible="${m.visibleText}"`,
    ).toBeLessThanOrEqual(m.clientWidth)

    // 3. The CSS combo that causes the truncation MUST NOT both apply.
    //    (nowrap + ellipsis is the smoking gun.)
    const isTruncatingCombo =
      m.whiteSpace === 'nowrap' && m.textOverflow === 'ellipsis' && m.overflow !== 'visible'
    expect(
      isTruncatingCombo,
      `text uses white-space:nowrap + text-overflow:ellipsis + overflow:${m.overflow} — guarantees mid-word clipping on narrow viewports`,
    ).toBe(false)
  })

  test('DE (/?demo=1&lang=de) — full "fiktiven Daten" disclaimer fits without ellipsis', async ({ page }) => {
    await page.goto('/?demo=1&lang=de')
    await waitForBannerVisible(page)
    const m = await measureTextOverflow(page)
    expect(m.found).toBe(true)
    if (!m.found) return

    expect(
      m.visibleText,
      `DE banner visible text "${m.visibleText}" is missing the "fiktiven Daten" disclaimer`,
    ).toContain(DEMO_SAFETY_PHRASES.de)

    expect(
      m.scrollWidth,
      `DE banner truncated: scrollWidth=${m.scrollWidth} > clientWidth=${m.clientWidth}; visible="${m.visibleText}"`,
    ).toBeLessThanOrEqual(m.clientWidth)
  })
})
