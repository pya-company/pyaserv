/*
 * E2E: every interactive element must show a visible focus ring under
 * keyboard navigation. We Tab through the page (real keyboard input, so
 * :focus-visible activates) and assert every distinct interactive variant
 * shows a ring.
 *
 * Why keyboard Tab instead of `el.focus()`: programmatic focus does NOT
 * trigger :focus-visible in Chromium — the heuristic requires actual
 * keyboard interaction or `el.focus({focusVisible: true})` (still spotty).
 * Tab gives us the real :focus-visible CSS path the user sees.
 *
 * Per page we Tab up to MAX_TABS times; after each step we read the active
 * element's computed style and de-dupe by its tag+class signature so we
 * audit each visual variant once.
 */
import { expect, test } from '@playwright/test'

const ROUTES = ['/', '/specialists/', '/clients/', '/login/']
const MAX_TABS = 60

interface FocusResult {
  readonly selector: string
  readonly outlineWidth: string
  readonly outlineStyle: string
  readonly outlineColor: string
  readonly boxShadow: string
  readonly hasRing: boolean
}

const probeActive = async (
  page: import('@playwright/test').Page,
): Promise<FocusResult | null> => {
  return await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    const variant = `${el.tagName}.${[...el.classList].sort().join('.')}`
    const cs = getComputedStyle(el)
    const ow = parseFloat(cs.outlineWidth) || 0
    const hasOutline =
      ow >= 1.5 &&
      cs.outlineStyle !== 'none' &&
      cs.outlineStyle !== 'hidden' &&
      cs.outlineStyle !== ''
    const hasShadowRing = cs.boxShadow !== 'none' && /\d+px/.test(cs.boxShadow)
    return {
      selector: variant,
      outlineWidth: cs.outlineWidth,
      outlineStyle: cs.outlineStyle,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      hasRing: hasOutline || hasShadowRing,
    }
  })
}

for (const route of ROUTES) {
  test(`every interactive on ${route} shows a focus ring`, async ({ page }) => {
    await page.goto(route)
    // Start fresh — focus the body so the first Tab goes to the first interactive.
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())

    const seen = new Map<string, FocusResult>()
    for (let i = 0; i < MAX_TABS; i++) {
      await page.keyboard.press('Tab')
      const r = await probeActive(page)
      if (!r) continue
      if (!seen.has(r.selector)) seen.set(r.selector, r)
    }

    const broken = [...seen.values()].filter((r) => !r.hasRing)
    expect(
      broken,
      `${broken.length} interactive variant(s) lack a visible focus ring on ${route}:\n` +
        JSON.stringify(broken, null, 2),
    ).toEqual([])
  })
}
