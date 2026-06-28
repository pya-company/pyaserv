/*
 * Regression guard for the flying-menu pre-upgrade CLS bug.
 *
 * The Lit element is registered from a deferred ES module. Until it upgrades
 * the browser renders <flying-menu>'s slotted light-DOM children (the trigger
 * button + the entire menu — nav links, sign-out, lang+theme controls) inline
 * at the top of <body>, pushing every page below it down and producing a
 * massive single-frame layout shift.
 *
 * Fix lives in global.css:
 *    flying-menu:not(:defined) { display: none; }
 *
 * This test simulates the pre-upgrade state by blocking the JS chunk that
 * registers the custom element, then asserts the element + its slotted
 * children take zero space. If someone removes the CSS rule, the trigger
 * button and menu div would render in normal flow and have non-zero rects.
 */
import { expect, test } from '@playwright/test'

test('<flying-menu> takes zero space before its module upgrades', async ({ page }) => {
  // Block any JS chunk that defines the custom element. The package name
  // (@igor-ganov/flying-menu) is bundled into hashed chunks under /_astro/,
  // so we match by content rather than URL — but the registration call
  // `customElements.define('flying-menu', ...)` will live in one of those.
  // Simplest reliable approach: short-circuit ALL deferred ES modules from
  // /_astro/ for this navigation, then read layout before lifting the block.
  await page.route('**/_astro/**.js', (route) => {
    // Respond with an empty module so the browser parses success but defines
    // nothing — flying-menu stays an unknown HTMLElement.
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
  })

  await page.goto('/es/')

  const probe = await page.evaluate(() => {
    const fm = document.querySelector('flying-menu')
    if (!fm) return { error: 'no <flying-menu> in DOM' }
    const cs = getComputedStyle(fm)
    const trigger = fm.querySelector('[slot="trigger"]') as HTMLElement | null
    const menu = fm.querySelector('[slot="menu"]') as HTMLElement | null
    return {
      defined: !!customElements.get('flying-menu'),
      display: cs.display,
      trigger_rect: trigger?.getBoundingClientRect(),
      menu_rect: menu?.getBoundingClientRect(),
    }
  })

  expect(probe.defined, 'precondition: element must NOT be upgraded for this test').toBe(false)
  expect(probe.display, 'flying-menu:not(:defined) must be display:none — missing CSS rule causes massive CLS').toBe('none')
  // Belt-and-suspenders: slotted children must also take zero space because
  // their parent is display:none.
  expect(probe.trigger_rect?.width, 'trigger button must not occupy space pre-upgrade').toBe(0)
  expect(probe.menu_rect?.width, 'menu div must not occupy space pre-upgrade').toBe(0)
})
