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

    // Confirm modal (mech 7 / AC-L6) — click the "exit / Sí, salir / Yes, exit" CTA.
    await page.getByRole('button', { name: /s[ií],\s*salir|yes,\s*exit/i }).click()

    // After confirmation, the page navigates to the same path without ?demo.
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

/*
 * BUG: anon-demo-entry-redirects-to-home
 * --------------------------------------
 * /me/?demo=1 is the single CTA shipped on /docs/demo-mode/ ("Try demo →").
 * For an anonymous visitor (no session token) the guard in me.astro:278 fires:
 *     location.href = `${base}/login/?next=${encodeURIComponent(location.pathname)}`
 * `location.pathname` drops the search string, so `?demo=1` is silently lost.
 * Worse, on prod the end state is `/` with no banner — the documented entry
 * point for the marketing audience is broken.
 *
 * Spec §15.1 requires the marketing "Try demo" CTA to work anonymously, or
 * at minimum the demo flag must survive the auth redirect.
 *
 * This block MUST be RED on current prod and GREEN once the fix lands.
 */
test.describe('Demo Mode — anonymous entry via /me/?demo=1 (bug: anon-demo-entry-redirects-to-home)', () => {
  test('direct nav to /me/?demo=1 anonymously must NOT drop the ?demo=1 flag', async ({ page, context }) => {
    // Guarantee anonymous: no cookies, no storage.
    await context.clearCookies()
    await page.addInitScript(() => {
      try { sessionStorage.clear(); localStorage.clear() } catch {}
    })

    await page.goto('/me/?demo=1')
    // Allow the client guard + any subsequent redirects to settle.
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const finalUrl = new URL(page.url())
    const demoBanner = page.locator('#demo-banner')
    const bannerVisible = await demoBanner.isVisible().catch(() => false)

    // Either:
    //  (a) The visitor is still on /me/?demo=1 (CTA works anonymously), OR
    //  (b) The visitor was sent to /login/ but `next` preserves ?demo=1, OR
    //  (c) The banner is up somewhere (demo flag survived).
    // Current prod fails all three — lands on `/` with no banner.
    const onMeWithDemo = finalUrl.pathname === '/me/' && finalUrl.searchParams.get('demo') === '1'
    const onLoginWithDemoNext = finalUrl.pathname === '/login/'
      && /demo=1/.test(decodeURIComponent(finalUrl.searchParams.get('next') ?? ''))

    const demoSurvived = onMeWithDemo || onLoginWithDemoNext || bannerVisible
    expect(demoSurvived, `demo flag was dropped — finalUrl=${finalUrl.href}, bannerVisible=${bannerVisible}`).toBe(true)
  })

  test('"Try demo" CTA must exist on /docs/demo-mode/ and point at /me/?demo=1', async ({ page }) => {
    await page.goto('/docs/demo-mode/')
    await page.waitForLoadState('networkidle')
    const cta = page.locator('a[href="/me/?demo=1"]').first()
    await expect(cta, 'documented "Try demo" CTA must exist').toBeAttached()
    // Cross-check the bug story: this single CTA is the public entry point
    // for the marketing audience — clicking it follows the same code path as
    // the direct-nav test above and therefore inherits the same bug.
  })
})

/*
 * BUG: idle-timeout-and-exit-modal-dead-code
 * -----------------------------------------
 * Spec §15.2 mechanisms 7 and 8 require:
 *  • Mech 7 (AC-L6): clicking "Salir del demo" pops up an explicit
 *    confirmation modal ("Sí, salir" / "Seguir en demo"). Translated
 *    keys demo.exit_confirm_title / _yes / _no exist in all 4 locale
 *    YAMLs and the 2026-06-25 release notes literally advertise
 *    "Exit-Modal" as shipped.
 *  • Mech 8 (AC-L4): after 10 min idle, an idle-warning modal appears
 *    and (after a 30-s grace) the visitor is redirected out of demo.
 *  • Mech 10: demo_started / demo_exited / demo_idle_timeout audit
 *    events must be emitted as CustomEvent('pyaserv:demo') so other
 *    parts of the page can react.
 *
 * Reality (Base.astro:640-655, demo-mode.ts grepped 2026-06-27):
 *  • The "Salir del demo" click handler navigates immediately. An
 *    inline comment proudly says "No confirm — exit is reversible".
 *  • startIdleWatcher / exitDemo / emitAudit / initDemoState are
 *    defined in lib/demo-mode.ts but NEVER imported anywhere.
 *  • No 'pyaserv:demo' CustomEvent is ever dispatched.
 *  • No sessionStorage entry pyaserv.demo.<feature> is ever written.
 *
 * These tests MUST be RED on current prod and GREEN once the runtime
 * is actually wired into Base.astro.
 */
test.describe('Demo Mode — exit confirm modal + idle/audit wiring (bug: idle-timeout-and-exit-modal-dead-code)', () => {
  test('clicking "Salir del demo" shows the exit-confirm modal (mech 7 / AC-L6)', async ({ page }) => {
    // Pin Spanish locale so the assertion against the translated `demo.exit_confirm_*`
    // strings is deterministic across CI runners (which default to en-US).
    await page.addInitScript(() => {
      try { localStorage.setItem('pyaserv.locale', 'es') } catch {}
    })
    await page.goto('/docs/?demo=1')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const banner = page.locator('#demo-banner')
    await expect(banner).toBeVisible()

    // Snapshot URL before click — if a modal opens we must NOT have navigated yet.
    const urlBeforeClick = page.url()

    await banner.locator('[data-demo-exit]').click()

    // Give any modal a moment to render — but explicitly do NOT wait for
    // navigation, because that's exactly the bug (immediate nav, no modal).
    await page.waitForTimeout(400)

    // Spec wording (es): "Salir del modo demo" / "Sí, salir" / "Seguir en demo".
    // We don't pin the exact selector — any visible element carrying the
    // translated copy from demo.exit_confirm_* is acceptable.
    const confirmTitle = page.getByText(/salir del modo demo/i).first()
    const confirmYes = page.getByRole('button', { name: /s[ií],\s*salir/i })
    const confirmNo = page.getByRole('button', { name: /seguir en demo/i })

    // The URL must NOT have changed yet — the modal blocks navigation.
    expect(
      page.url(),
      'expected exit click to open a confirm modal, not navigate immediately',
    ).toBe(urlBeforeClick)

    await expect(confirmTitle, 'exit confirm modal title (demo.exit_confirm_title) is missing').toBeVisible()
    await expect(confirmYes, 'confirm "Sí, salir" button (demo.exit_confirm_yes) is missing').toBeVisible()
    await expect(confirmNo, 'cancel "Seguir en demo" button (demo.exit_confirm_no) is missing').toBeVisible()
  })

  test('entering demo writes the idle/state sentinel + dispatches demo_started audit (mech 5, 8, 10)', async ({ page }) => {
    // Listen for the audit CustomEvent before navigation so we don't miss it.
    await page.addInitScript(() => {
      ;(window as unknown as { __demoEvents: string[] }).__demoEvents = []
      window.addEventListener('pyaserv:demo', (e) => {
        const detail = (e as CustomEvent).detail as { event?: string } | undefined
        if (detail?.event) (window as unknown as { __demoEvents: string[] }).__demoEvents.push(detail.event)
      })
    })

    await page.goto('/docs/?demo=1')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)

    // Mech 5: any pyaserv.demo.<feature> sessionStorage sentinel must exist
    // (initDemoState writes one keyed by feature name). The "demo banner
    // visible" path proves we're in demo, so the runtime must have set it.
    const hasDemoStateKey = await page.evaluate(() => {
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i)
          if (k && k.startsWith('pyaserv.demo.')) return true
        }
      } catch {}
      return false
    })
    expect(
      hasDemoStateKey,
      'expected initDemoState() to write a pyaserv.demo.<feature> sessionStorage key when demo starts',
    ).toBe(true)

    // Mech 10: demo_started audit event must have fired as CustomEvent('pyaserv:demo').
    const events = await page.evaluate(() => (window as unknown as { __demoEvents: string[] }).__demoEvents)
    expect(
      events,
      'expected a "demo.demo_started" CustomEvent to be dispatched on demo entry',
    ).toContain('demo.demo_started')
  })

  test('idle activity events are wired so the 10-min auto-exit timer can fire (mech 8 / AC-L4)', async ({ page }) => {
    await page.goto('/docs/?demo=1')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // We can't burn 10 real minutes in CI. But startIdleWatcher bumps
    // lastActivity in the sessionStorage sentinel on every click/keydown/
    // pointermove/touchstart/scroll. If the watcher is wired:
    //   1) a sessionStorage sentinel already exists (covered above), and
    //   2) its lastActivity timestamp advances after a synthetic click.
    // If it isn't wired, lastActivity stays NaN/missing (no sentinel) and
    // this assertion fails — exactly the dead-code symptom we're guarding.
    const readSentinel = async (): Promise<{ lastActivity: number } | null> =>
      page.evaluate(() => {
        try {
          for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i)
            if (k && k.startsWith('pyaserv.demo.')) {
              const raw = sessionStorage.getItem(k)
              if (!raw) return null
              return JSON.parse(raw) as { lastActivity: number }
            }
          }
        } catch {}
        return null
      })

    const before = await readSentinel()
    expect(
      before,
      'expected a pyaserv.demo.<feature> sentinel after demo entry (startIdleWatcher requires it)',
    ).not.toBeNull()

    // Force the clock forward by ≥2 ms to avoid same-tick reads.
    await page.waitForTimeout(20)
    await page.mouse.click(10, 10)
    await page.waitForTimeout(50)

    const after = await readSentinel()
    expect(after, 'sentinel disappeared after activity').not.toBeNull()
    expect(
      (after?.lastActivity ?? 0) > (before?.lastActivity ?? 0),
      `expected lastActivity to advance after a click (bumpActivity should run on click). before=${before?.lastActivity}, after=${after?.lastActivity}`,
    ).toBe(true)
  })
})
