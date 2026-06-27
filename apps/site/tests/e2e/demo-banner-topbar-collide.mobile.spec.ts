/*
 * Regression: demo banner overlaps the sticky topbar on scroll (mobile).
 *
 * Bug id: demo-banner-overlaps-topbar-on-scroll-mobile
 *
 * Repro: visit a page with ?demo=1 on a mobile viewport, scroll down a bit.
 * The demo banner is position:fixed; top:0; z-index:9999 and the topbar is
 * position:sticky; top:0 — once scrolled, both pin to y=0 and the banner
 * fully overlays the topbar (brand + Sign-in disappear).
 *
 * Secondary assertion: at rest, body padding-top should equal the banner
 * height so the topbar is not clipped (banner is ~52 px tall but padding
 * is only 48 px — 4 px misalignment).
 *
 * We probe on /docs/?demo=1 because the home route can be too short to
 * scroll on a Pixel-7 viewport; the bug is in shared layout CSS so any
 * scrollable demo page reproduces it.
 */
import { expect, test } from '@playwright/test'

const DEMO_URL = '/docs/?demo=1'
const SCROLL_PX = 200

type Rect = { top: number; bottom: number; height: number; left: number; right: number }

const rectOf = async (page: import('@playwright/test').Page, selector: string): Promise<Rect> =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`missing ${sel}`)
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, height: r.height, left: r.left, right: r.right }
  }, selector)

const scrollAndWait = async (page: import('@playwright/test').Page, target: number) => {
  await page.evaluate((y) => {
    // Make sure there is enough content to scroll by padding the body if needed.
    if (document.body.scrollHeight < window.innerHeight + y + 200) {
      const spacer = document.createElement('div')
      spacer.style.height = `${y + 800}px`
      spacer.setAttribute('data-test-spacer', '1')
      document.body.appendChild(spacer)
    }
    window.scrollTo(0, y)
  }, target)
  await page.waitForFunction((y) => window.scrollY >= y - 1, target)
}

test.describe('Demo banner vs sticky topbar — mobile', () => {
  test('after scrolling, topbar is NOT overlapped by the fixed demo banner', async ({ page }) => {
    await page.goto(DEMO_URL)
    await expect(page.locator('#demo-banner')).toBeVisible()
    await expect(page.locator('#topbar')).toBeVisible()

    await scrollAndWait(page, SCROLL_PX)

    const banner = await rectOf(page, '#demo-banner')
    const topbar = await rectOf(page, '#topbar')

    // The banner must sit ABOVE the topbar (topbar top >= banner bottom),
    // not overlap it. Allow 1 px of subpixel slack.
    expect(
      topbar.top,
      `topbar.top (${topbar.top}) should be >= banner.bottom (${banner.bottom}) — overlap means brand/nav is hidden behind the banner`,
    ).toBeGreaterThanOrEqual(banner.bottom - 1)
  })

  test('topbar brand remains hit-testable at the top of the viewport after scrolling', async ({ page }) => {
    await page.goto(DEMO_URL)
    await expect(page.locator('#demo-banner')).toBeVisible()
    await expect(page.locator('.ps-topbar__brand')).toBeVisible()

    await scrollAndWait(page, SCROLL_PX)

    const brand = await page.locator('.ps-topbar__brand').boundingBox()
    expect(brand, 'brand should have a box').not.toBeNull()
    if (!brand) throw new Error('no brand box')

    // The element at the brand's centre should be the brand (or one of its
    // descendants), not the demo banner.
    const ownerSelector = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y) as HTMLElement | null
        if (!el) return 'NONE'
        if (el.closest('.ps-topbar__brand')) return 'brand'
        if (el.closest('#demo-banner')) return 'demo-banner'
        return el.tagName.toLowerCase()
      },
      { x: brand.x + brand.width / 2, y: brand.y + brand.height / 2 },
    )
    expect(
      ownerSelector,
      'the demo banner is covering the brand link — users cannot tap it during scroll',
    ).toBe('brand')
  })

  test('at rest, body padding-top matches the demo banner height (no 4 px gap)', async ({ page }) => {
    await page.goto(DEMO_URL)
    await expect(page.locator('#demo-banner')).toBeVisible()

    const { bannerH, padTop } = await page.evaluate(() => {
      const banner = document.querySelector('#demo-banner') as HTMLElement | null
      if (!banner) throw new Error('no banner')
      const bh = banner.getBoundingClientRect().height
      const pt = parseFloat(getComputedStyle(document.body).paddingTop) || 0
      return { bannerH: bh, padTop: pt }
    })

    expect(
      padTop,
      `body padding-top (${padTop}) should match banner height (${bannerH}) so the topbar isn't clipped`,
    ).toBeGreaterThanOrEqual(bannerH - 0.5)
  })
})
