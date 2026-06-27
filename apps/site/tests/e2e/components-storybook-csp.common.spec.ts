/*
 * Components Storybook — CSP must not block the per-page init script.
 *
 * Bug: storybook-csp-blocks-init-script (2026-06-27)
 * The component detail pages (/components/<id>/) ship the story bootstrap
 * as a raw inline `<script>(function(){ ... import * as molecules ... })()</script>`.
 * Prod CSP is `script-src 'self'` with no `unsafe-inline`, no hash, no nonce,
 * AND the script body contains literal ES `import` statements outside a module
 * — so even without CSP it would SyntaxError.
 *
 * Visible symptom: `#story-viewport` stays empty on every component page
 * (19 pages), the Props `<form id="story-knobs">` never gets populated, and
 * the locale `<select id="story-locale">` is inert.
 *
 * What this test asserts (any one of these failing proves the bug):
 *  1. No CSP violation is reported via `securitypolicyviolation` for an
 *     inline `<script>` source. (Direct evidence of the CSP block.)
 *  2. The `#story-viewport` is non-empty shortly after load — the init script
 *     should have rendered the component into it.
 *  3. The Props `<form id="story-knobs">` has at least one field — the init
 *     script should have populated knobs from `storyData.knobs`.
 *
 * Two routes are covered (an atom + an organism) to show the breakage is
 * page-wide, not story-specific.
 */
import { expect, test } from '@playwright/test'

interface CspViolation {
  readonly directive: string
  readonly blockedURI: string
  readonly sample: string
}

const COMPONENT_ROUTES = ['/components/button/', '/components/profile-public/']

const collectCspViolations = async (
  page: import('@playwright/test').Page,
): Promise<CspViolation[]> => {
  await page.addInitScript(() => {
    interface WithViolations extends Window {
      __cspViolations?: CspViolation[]
    }
    interface CspViolation {
      readonly directive: string
      readonly blockedURI: string
      readonly sample: string
    }
    const w = window as WithViolations
    w.__cspViolations = []
    window.addEventListener('securitypolicyviolation', (e) => {
      w.__cspViolations?.push({
        directive: e.violatedDirective,
        blockedURI: e.blockedURI,
        sample: e.sample ?? '',
      })
    })
  })
  return []
}

const readCspViolations = (page: import('@playwright/test').Page): Promise<CspViolation[]> =>
  page.evaluate(() => {
    interface WithViolations extends Window {
      __cspViolations?: CspViolation[]
    }
    return ((window as WithViolations).__cspViolations ?? []) as CspViolation[]
  })

for (const route of COMPONENT_ROUTES) {
  test(`storybook init runs on ${route} — no CSP block, viewport renders, knobs populate`, async ({
    page,
  }) => {
    await collectCspViolations(page)

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))

    await page.goto(route)
    // Give the init script a chance to execute (it's synchronous in the
    // page, but we also wait for the viewport to receive children).
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // 1) No CSP violation for an inline script-src block.
    const violations = await readCspViolations(page)
    const inlineScriptBlock = violations.filter(
      (v) => /script-src/.test(v.directive) && v.blockedURI === 'inline',
    )
    expect(
      inlineScriptBlock,
      `CSP blocked the inline init script on ${route}:\n` + JSON.stringify(violations, null, 2),
    ).toEqual([])

    // 2) The story viewport must contain rendered content.
    const viewport = page.locator('#story-viewport')
    await expect(viewport, `viewport empty on ${route}`).not.toBeEmpty()

    // 3) The knobs form must have been populated from stories.ts.
    const knobs = page.locator('#story-knobs *')
    await expect(
      knobs.first(),
      `knobs form not populated on ${route} (init script did not run)`,
    ).toBeVisible()

    // Bonus: any console errors that mention CSP or import-outside-module
    // are direct evidence of the same bug.
    const damning = consoleErrors.filter(
      (m) =>
        /Content Security Policy/i.test(m) ||
        /Cannot use import statement/i.test(m) ||
        /Unexpected token .*import/i.test(m),
    )
    expect(
      damning,
      `console errors prove the init script failed on ${route}:\n${damning.join('\n')}`,
    ).toEqual([])
  })
}
