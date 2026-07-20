/*
 * Shared E2E helpers. Single source of truth for "is the page settled?"
 * predicates so tests don't sprinkle waitForLoadState('networkidle') (which
 * is a hidden 500ms sleep that proves nothing) or arbitrary waitForTimeout.
 *
 * Stable signals available in the running app:
 *  · html[data-i18n-ready="1"]        — Base.astro initPage finished:
 *                                         applyI18n + applyContent + lang
 *                                         button aria-pressed updated +
 *                                         internal-link locale prefix rewrite.
 *  · #tab-profile[aria-selected="true"]
 *                                      — /me/ in-body module bound the tab
 *                                         click handlers and ran setTab(initial).
 *  · #login-dlg[open]                  — login dialog finished mounting.
 */
import type { Page, Locator } from '@playwright/test'

/**
 * Navigate to a path and wait until Base.astro initPage finishes its post-
 * hydration work. Resolves on the `html[data-i18n-ready="1"]` attribute
 * which is set unconditionally at the end of initPage() (and re-set after
 * every Astro view-transition swap).
 */
export const gotoStable = async (page: Page, path: string): Promise<void> => {
  await page.goto(path)
  await page.locator('html[data-i18n-ready="1"]').waitFor({ state: 'attached' })
}

/**
 * Wait for /me/ dashboard's in-body module to have bound the tab handlers.
 * Use ANY time you intend to click a #tab-* button — clicking before this
 * resolves is a no-op (the handler isn't attached yet).
 */
export const waitForMeHydrated = (page: Page): Promise<void> =>
  page.locator('#tab-profile[aria-selected="true"]').waitFor({ state: 'attached' })

/**
 * Click the lang switcher button for a given locale. Uses a JS-driven click
 * to bypass the viewport-specific visibility plumbing — desktop topbar nav
 * and mobile flying-menu both contain a .ps-lang-btn[data-lang="<code>"]
 * and the document-level click delegate dispatches regardless of which tree
 * the click came from. Waits for the resulting navigation to land on
 * /<locale>/...
 */
export const clickLang = async (
  page: Page,
  lang: 'es' | 'en' | 'de' | 'ru',
): Promise<void> => {
  await page.evaluate((l) => {
    const btn = document.querySelector<HTMLElement>(`.ps-lang-btn[data-lang="${l}"]`)
    if (!btn) throw new Error('lang button missing: ' + l)
    btn.click()
  }, lang)
  await page.waitForURL(new RegExp(`^[^?]*?/${lang}(?:/|$)`))
  await page.locator('html[data-i18n-ready="1"]').waitFor({ state: 'attached' })
}

/** Locator for the lang button — same selector across viewports. */
export const langBtn = (page: Page, lang: 'es' | 'en' | 'de' | 'ru'): Locator =>
  page.locator(`.ps-lang-btn[data-lang="${lang}"]`).first()
