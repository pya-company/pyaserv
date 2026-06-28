/*
 * Regression: topbar overflows and clips lang / theme / Sign-in at
 * 720–900 px desktop viewports — no fallback to the mobile flying-menu.
 *
 * Bug id: topbar-overflow-720-900px-desktop
 *
 * The mobile flying-menu breakpoint is `@media (max-width: 719.98px)` so
 * any viewport >= 720 px shows the desktop topbar. The nav row has no
 * flex-wrap / overflow handling, so at narrow desktop widths the rightmost
 * controls (DE / RU lang buttons + theme button) get pushed off-screen and
 * the "Ingresar / Sign in" button wraps to two lines — without any mobile
 * fallback to compensate.
 *
 * Expected: every topbar control sits inside the viewport, and the topbar
 * keeps its single-row height (no Sign-in line wrap).
 */
import { expect, test, type Page } from '@playwright/test'

/* Widths that reproduce the bug according to the manual probe. */
const NARROW_DESKTOP_WIDTHS = [720, 768, 800, 900] as const

/* Generous single-row height ceiling — real prod is ~73 px at 1366 px and
 * jumps to ~95 px once Sign-in wraps. 85 px catches the wrap reliably. */
const SINGLE_ROW_HEIGHT_CEILING_PX = 85

type Rect = {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}

const rectOf = (page: Page, selector: string): Promise<Rect> =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`missing ${sel}`)
    const r = el.getBoundingClientRect()
    return {
      left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      width: r.width, height: r.height,
    }
  }, selector)

for (const width of NARROW_DESKTOP_WIDTHS) {
  test.describe(`topbar at ${width} px desktop`, () => {
    test.use({ viewport: { width, height: 800 } })

    test(`rightmost controls (RU lang + theme button) stay inside the ${width} px viewport`, async ({ page }) => {
      await page.goto('/es/')
      await expect(page.locator('#topbar')).toBeVisible()
      // Desktop nav must be the active surface at this width — flying-menu
      // breakpoint is max-width:719.98px, so >=720 px should show the inline
      // nav. If it's display:none the test is being run in the wrong mode.
      await expect(page.locator('.ps-topbar__nav')).toBeVisible()

      const viewportWidth = page.viewportSize()?.width ?? width

      const ruRect = await rectOf(page, '.ps-lang-btn[data-lang="ru"]')
      const themeRect = await rectOf(page, '#theme-btn')

      expect(
        ruRect.right,
        `RU lang button right edge (${ruRect.right}) overflows viewport width (${viewportWidth}) at ${width} px — user cannot see/tap it`,
      ).toBeLessThanOrEqual(viewportWidth)

      expect(
        themeRect.right,
        `theme button right edge (${themeRect.right}) overflows viewport width (${viewportWidth}) at ${width} px — user cannot see/tap it`,
      ).toBeLessThanOrEqual(viewportWidth)
    })

    test(`topbar stays a single row at ${width} px (Sign-in must not wrap)`, async ({ page }) => {
      await page.goto('/es/')
      await expect(page.locator('#topbar')).toBeVisible()

      const topbar = await rectOf(page, '#topbar')

      expect(
        topbar.height,
        `topbar height (${topbar.height}) exceeds single-row ceiling (${SINGLE_ROW_HEIGHT_CEILING_PX}) at ${width} px — likely the Ingresar/Sign in button has wrapped to two lines`,
      ).toBeLessThanOrEqual(SINGLE_ROW_HEIGHT_CEILING_PX)
    })

    test(`nav inner content does not overflow the topbar at ${width} px`, async ({ page }) => {
      await page.goto('/es/')
      await expect(page.locator('.ps-topbar__nav')).toBeVisible()

      const { scrollWidth, clientWidth } = await page.evaluate(() => {
        const nav = document.querySelector('.ps-topbar__nav') as HTMLElement | null
        if (!nav) throw new Error('no .ps-topbar__nav')
        return { scrollWidth: nav.scrollWidth, clientWidth: nav.clientWidth }
      })

      expect(
        scrollWidth,
        `.ps-topbar__nav scrollWidth (${scrollWidth}) exceeds its clientWidth (${clientWidth}) at ${width} px — children overflow horizontally and get clipped/pushed off-screen`,
      ).toBeLessThanOrEqual(clientWidth + 1)
    })
  })
}
