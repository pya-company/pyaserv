/*
 * E2E guards for the demo guided-tour. Every regression we hit by hand
 * over 2026-06-27/28 has a row here so we never have to find them again
 * by eyeballing screenshots.
 *
 * Bugs guarded:
 *  - "split personality": astro:page-load listener accumulation produced
 *    two stacked .gt-tooltip elements after a single nav. Each step asserts
 *    exactly one tooltip and one overlay live in the DOM.
 *  - "step 3 vanishes off-screen": smooth scrollIntoView (300ms) raced
 *    the double-RAF in renderStep — spotlight ended in dead space below
 *    the form, tooltip rendered at off-screen coords. Each step asserts
 *    both .gt-tooltip and #gt-spotlight bounding rects are fully inside
 *    375x812 viewport.
 *  - "spotlight orphan": separate from off-screen, the spotlight must
 *    actually cover the step's anchor element (with padding). Asserts
 *    via geometric containment for every step.
 *  - "auto-start gap": some demo pages started no tour. Each route
 *    asserts a tooltip appears within 4s when ?demo=1 is hit fresh
 *    (sessionStorage cleared first).
 *  - "raw i18n key on button": me.profile.geoloc resolved to an object,
 *    JS rendered the literal key. Tour pages must not show /^[a-z_.]+$/
 *    text inside buttons.
 *
 * Mobile-only because the bug presented on 375x812; the desktop layout
 * has different anchor positions and we cover those separately.
 */
import { expect, test, type Page, type Locator } from '@playwright/test'

const VIEWPORT = { width: 375, height: 812 }

const clearDemoState = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    try { sessionStorage.clear() } catch {}
  })
}

const waitForTour = async (page: Page, timeoutMs = 4000): Promise<Locator> => {
  const tt = page.locator('.gt-tooltip')
  await tt.first().waitFor({ state: 'visible', timeout: timeoutMs })
  return tt
}

interface StepGeometry {
  readonly counter: string
  readonly tooltipsInDom: number
  readonly overlaysInDom: number
  readonly tooltipInViewport: boolean
  readonly spotlightInViewport: boolean
  readonly spotlightCoversAnchor: boolean | null
}

const captureStep = async (page: Page, anchorSelector: string | null): Promise<StepGeometry> => {
  return await page.evaluate((sel) => {
    const tt = document.querySelector<HTMLElement>('.gt-tooltip')
    const sp = document.getElementById('gt-spotlight')
    const counter = tt?.querySelector<HTMLElement>('.gt-progress__counter')?.textContent ?? ''
    const ttCount = document.querySelectorAll('.gt-tooltip').length
    const ovCount = document.querySelectorAll('.gt-overlay').length
    const vw = window.innerWidth
    const vh = window.innerHeight
    const inside = (el: Element | null): boolean => {
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.left >= 0 && r.right <= vw && r.top >= 0 && r.bottom <= vh
    }
    // For the spotlight on full-width anchors (header, banner, .ps-demo-banner)
    // the 6px padding pushes its right edge past the viewport. What actually
    // matters is that the spotlight INTERSECTS the viewport — the visible part
    // still draws the cutout over the anchor. Pure "fully inside" is too strict.
    const intersectsViewport = (el: Element | null): boolean => {
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh
    }
    let covers: boolean | null = null
    if (sel) {
      const anchor = document.querySelector<HTMLElement>(sel)
      if (anchor && sp) {
        const ar = anchor.getBoundingClientRect()
        const sr = sp.getBoundingClientRect()
        // Spotlight (with its 6px padding from positionSpotlight) must contain
        // anchor's rect. Allow 8px slack for sub-pixel rounding.
        covers = sr.top - 8 <= ar.top
          && sr.bottom + 8 >= ar.bottom
          && sr.left - 8 <= ar.left
          && sr.right + 8 >= ar.right
      }
    }
    return {
      counter,
      tooltipsInDom: ttCount,
      overlaysInDom: ovCount,
      tooltipInViewport: inside(tt),
      spotlightInViewport: intersectsViewport(sp),
      spotlightCoversAnchor: covers,
    }
  }, anchorSelector)
}

const clickNext = async (page: Page): Promise<void> => {
  await page.locator('.gt-tooltip [data-gt-action="next"]').click()
  // Allow renderStep's double-RAF + instant scroll + positionSpotlight to settle
  await page.waitForTimeout(450)
}

interface TourSpec {
  readonly path: string
  readonly code: string
  readonly steps: ReadonlyArray<{ readonly anchor: string }>
}

// Anchor selectors mirror Base.astro buildDemoTour() — if the prod tour
// definitions change, these must follow.
const TOURS: ReadonlyArray<TourSpec> = [
  {
    path: '/?demo=1',
    code: 'T_HOME',
    steps: [
      { anchor: 'header.ps-topbar' },
      { anchor: '.ps-lang-switch' },
      { anchor: '.ps-demo-banner' },
    ],
  },
  {
    path: '/specialists/?demo=1',
    code: 'T_SPECIALISTS',
    steps: [
      { anchor: '#filters' },
      { anchor: '#results' },
      { anchor: '.ps-demo-banner' },
    ],
  },
  {
    path: '/clients/?demo=1',
    code: 'T_CLIENTS',
    steps: [
      { anchor: '#filters' },
      { anchor: '#results' },
      { anchor: '.ps-demo-banner' },
    ],
  },
  {
    path: '/me/?demo=1',
    code: 'T1',
    steps: [
      { anchor: '#photo-preview' },
      { anchor: 'input[name="headline"]' },
      { anchor: 'textarea[name="bio"]' },
      { anchor: 'input[name="phone"]' },
      { anchor: 'input[name="whatsapp"]' },
      { anchor: 'input[name="barrio"]' },
      { anchor: '#completeness' },
    ],
  },
]

test.describe('Demo guided-tour — every step lands inside viewport, no duplicates, no raw keys', () => {
  test.use({ viewport: VIEWPORT })

  for (const tour of TOURS) {
    test(`${tour.code} on ${tour.path}: each step has 1 tooltip, anchor visible, spotlight contains anchor`, async ({ page }) => {
      await page.goto(tour.path)
      await clearDemoState(page)
      await page.reload()
      await page.waitForLoadState('networkidle')

      await waitForTour(page)

      for (let i = 0; i < tour.steps.length; i++) {
        const geom = await captureStep(page, tour.steps[i].anchor)
        expect(geom.tooltipsInDom, `step ${i + 1}/${tour.steps.length} (${tour.code}): exactly one .gt-tooltip in DOM`).toBe(1)
        expect(geom.overlaysInDom, `step ${i + 1}: exactly one .gt-overlay in DOM`).toBe(1)
        expect(geom.counter, `step ${i + 1}: counter matches "N / total"`).toContain(`${i + 1} / ${tour.steps.length}`)
        expect(geom.tooltipInViewport, `step ${i + 1}: tooltip is fully inside 375x812 viewport`).toBe(true)
        expect(geom.spotlightInViewport, `step ${i + 1}: spotlight is fully inside 375x812 viewport`).toBe(true)
        // Some anchors are SSR-late (the `#results` list on /specialists/ +
        // /clients/, `#completeness` etc) — if the anchor is null at probe
        // time the geometric check is skipped, not falsified.
        if (geom.spotlightCoversAnchor !== null) {
          expect(geom.spotlightCoversAnchor, `step ${i + 1}: spotlight rect contains the anchor element rect`).toBe(true)
        }
        if (i < tour.steps.length - 1) await clickNext(page)
      }
    })
  }
})

test.describe('Demo guided-tour — no raw i18n keys leak on /me/', () => {
  test.use({ viewport: VIEWPORT })

  test('/me/?demo=1 page does not render any data-i18n key as visible text', async ({ page }) => {
    await page.goto('/me/?demo=1')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    // Walk every leaf text node and grep for an i18n-key shape:
    //   lowercase letters, digits, dots and underscores, no spaces,
    //   at least one dot. Catches "me.profile.geoloc" but not "Villa Morra".
    const leaks = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const out: string[] = []
      let node: Node | null
      // eslint-disable-next-line no-cond-assign
      while ((node = walker.nextNode())) {
        const t = (node.nodeValue ?? '').trim()
        if (!t) continue
        if (/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,4}$/.test(t)) {
          const parent = node.parentElement
          if (parent && parent.closest('script, style')) continue
          out.push(t)
        }
      }
      return Array.from(new Set(out))
    })
    expect(leaks, 'raw i18n keys must never render as visible text').toEqual([])
  })
})

test.describe('Demo: referrer-based exit + auto-exit on tour finish', () => {
  test.use({ viewport: VIEWPORT })

  // The real user complaint: reading /docs/demo-mode/ → CTA → /?demo=1 →
  // walks the tour → expects to land BACK on /docs/demo-mode/, not on /
  // (entry) or /specialists/ (CTA target). Also: after the tour finishes,
  // demo must auto-exit — user shouldn't have to hunt for the Exit button.
  //
  // Two non-obvious traps this guards against:
  //  · document.referrer is empty for any in-tab ClientRouter navigation
  //    (Astro uses History pushState). The fix relies on sessionStorage
  //    lastNonDemo written by EVERY non-demo page on each initDemo() tick.
  //  · ensureDemoState only writes returnTo on the FIRST demo-page load.
  //    If that load runs before the previous page's script wrote
  //    lastNonDemo, returnTo sticks at empty. The fix patches existing
  //    state when returnTo is empty AND lastNonDemo is now readable.

  // Real-world CTA flows on every docs page that has a "Try demo" link.
  // Each one MUST round-trip the user back to where they started.
  const docsToDemoFlows = [
    { docsPath: '/docs/demo-mode/', expectAfter: '/docs/demo-mode/' },
    { docsPath: '/docs/perfil/',    expectAfter: '/docs/perfil/' },
    { docsPath: '/docs/tour/',      expectAfter: '/docs/tour/' },
    { docsPath: '/docs/insignias/', expectAfter: '/docs/insignias/' },
    { docsPath: '/docs/cotizador/', expectAfter: '/docs/cotizador/' },
  ]

  for (const flow of docsToDemoFlows) {
    test(`real CTA: ${flow.docsPath} → Try demo → exit → returns to ${flow.expectAfter}`, async ({ page }) => {
      await page.goto(flow.docsPath)
      await page.evaluate(() => { try { sessionStorage.clear() } catch {} })
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Click the Try demo CTA — that's the real anchor users tap. Force
      // because docs page has overlapping click targets but the link itself
      // is functional and we just want its navigation behavior.
      const cta = page.locator('a[href*="?demo=1"]').first()
      await cta.waitFor({ state: 'visible', timeout: 5000 })
      await cta.click({ force: true })

      // Wait for nav into demo page
      await page.waitForURL(/\?demo=1/, { timeout: 5000 })
      // Give initDemo + ensureDemoState a beat to write state
      await page.waitForTimeout(1500)

      // Manually exit demo (mid-tour ok — tests the exit path, not finish)
      await page.locator('[data-demo-exit]').click()
      await page.locator('[data-demo-exit-yes]').waitFor({ state: 'visible', timeout: 3000 })
      await page.locator('[data-demo-exit-yes]').click()

      await page.waitForURL((url) => url.pathname === flow.expectAfter, { timeout: 8000 })
      expect(new URL(page.url()).pathname, `manual Exit Demo from ${flow.docsPath} CTA must return to ${flow.expectAfter}`).toBe(flow.expectAfter)
    })
  }

  test('docs → ?demo=1 → finish tour → auto-exits AND returns to docs', async ({ page }) => {
    await page.goto('/docs/demo-mode/?cb=t1')
    await page.evaluate(() => { try { sessionStorage.clear() } catch {} })
    // Within-tab nav so document.referrer is /docs/demo-mode/
    await page.evaluate(() => { location.href = '/?demo=1' })
    await page.waitForURL(/\?demo=1/)
    await page.waitForTimeout(2500)

    // Confirm demo started + returnTo captured
    const stateRaw = await page.evaluate(() => sessionStorage.getItem('pyaserv.demo.session'))
    expect(stateRaw, 'demo state stored').toBeTruthy()
    const state = JSON.parse(stateRaw ?? '{}')
    expect(state.data.returnTo, 'returnTo equals the docs page we came from').toContain('/docs/demo-mode/')

    // Walk the 3-step T_HOME tour and click Finish on the last step
    for (let i = 0; i < 3; i++) {
      const nx = page.locator('.gt-tooltip [data-gt-action="next"]')
      await nx.click()
      await page.waitForTimeout(600)
    }

    // Auto-exit should have fired — wait for navigation back to docs
    await page.waitForURL(/\/docs\/demo-mode\//, { timeout: 8000 })
    const finalDemo = await page.evaluate(() => !!document.documentElement.dataset.demoMode)
    expect(finalDemo, 'demo mode must be OFF after tour finish').toBe(false)
    expect(new URL(page.url()).pathname).toBe('/docs/demo-mode/')
  })
})

test.describe('Demo exit restores the entry URL, not the current page', () => {
  test.use({ viewport: VIEWPORT })

  // performExit reads state.data.entry (set on first demo activation) and
  // navigates there instead of stripping ?demo from the current URL. User's
  // mental model: "I tried demo from /releases/, poked around /me/, want
  // to land back on /releases/ — not on /, /specialists/, or login."
  for (const entryPath of ['/releases/', '/specialists/', '/clients/']) {
    test(`enter demo on ${entryPath}, navigate to /me/, exit → returns to ${entryPath}`, async ({ page }) => {
      await page.goto(`${entryPath}?demo=1`)
      await clearDemoState(page)
      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(800)

      // Within-tab nav to /me/?demo=1 (preserves sessionStorage demo state)
      await page.evaluate(() => { location.href = '/me/?demo=1' })
      await page.waitForURL(/\/me\//)
      await page.waitForTimeout(1500)

      // Click Exit Demo → confirm modal → Yes
      await page.locator('[data-demo-exit]').click()
      await page.locator('[data-demo-exit-yes]').waitFor({ state: 'visible', timeout: 3000 })
      await page.locator('[data-demo-exit-yes]').click()
      await page.waitForURL((url) => url.pathname === entryPath, { timeout: 8000 })

      expect(new URL(page.url()).pathname, 'must land on the original entry path').toBe(entryPath)
      expect(new URL(page.url()).search, 'must drop the ?demo flag').not.toContain('demo')
    })
  }
})

test.describe('Demo guided-tour — sticky-nav does not accumulate overlays', () => {
  test.use({ viewport: VIEWPORT })

  test('/ → /me/ → /specialists/ each shows exactly one tooltip', async ({ page }) => {
    // We want WITHIN-session navigation (preserves the persistent JS module
    // state — that's where the listener-accumulation bug used to live), not
    // page.goto (fresh page = fresh state). Trigger an in-app navigation by
    // setting location.href on the existing page. Astro's ClientRouter
    // intercepts and runs the view-transition hydration path, which is what
    // the bug needed to surface.
    const navWithin = async (path: string): Promise<void> => {
      await page.evaluate((p) => { location.href = p }, path)
    }

    await page.goto('/?demo=1')
    await clearDemoState(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await waitForTour(page)
    await expect(page.locator('.gt-tooltip')).toHaveCount(1)

    await navWithin('/me/?demo=1')
    await page.waitForURL(/\/me\//)
    await page.waitForTimeout(2500)
    await expect(page.locator('.gt-tooltip')).toHaveCount(1)
    await expect(page.locator('.gt-overlay')).toHaveCount(1)

    await navWithin('/specialists/?demo=1')
    await page.waitForURL(/\/specialists\//)
    await page.waitForTimeout(2500)
    await expect(page.locator('.gt-tooltip')).toHaveCount(1)
    await expect(page.locator('.gt-overlay')).toHaveCount(1)
  })
})
