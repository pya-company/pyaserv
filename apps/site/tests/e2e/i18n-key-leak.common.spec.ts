/*
 * E2E: raw i18n keys must NEVER leak as visible labels.
 *
 * AC-ML2 mandates fallback chain locale → EN → ES → key, but the last
 * `?? key` step exists only so the page does not crash — production
 * should never actually display a raw dotted key. Today three pages do:
 *
 *   1) /          — <T k="login.email"/> in LoginDialog.astro:32. The YAML
 *                   leaf `login.email` is an OBJECT (only .placeholder is a
 *                   string), so T.astro falls back to the raw key for both
 *                   ES and EN.
 *   2) /specialists/ — <T k="specialists.filter.category"/> and
 *                   <T k="specialists.filter.barrio"/> in the filters form.
 *                   Same shape: both keys are objects in YAML.
 *   3) /me/      — me.astro lines 77/81/85/89/101 use
 *                   data-i18n="me.profile.<field>" but only .placeholder
 *                   leaves exist. SSR ships hardcoded Spanish text in
 *                   those spans; applyI18n then rewrites textContent to
 *                   the raw key (because t('me.profile.headline') falls
 *                   through to `?? key`).
 *
 * This file MUST be RED on current prod and GREEN after the YAML keys
 * gain real string leaves (e.g. `me.profile.headline.label`) and the
 * markup is updated to reference them.
 *
 * The /me/ check requires PYASERV_DEV_BYPASS_KEY because /me/ redirects
 * guests to /login/. The first two checks need no auth.
 */
import { expect, test } from '@playwright/test'

const BYPASS_KEY = process.env.PYASERV_DEV_BYPASS_KEY ?? ''
const API = process.env.PYASERV_API_URL ?? 'https://api.pyaserv.com'

const RAW_KEY_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,}$/

const provisionSession = async (): Promise<string> => {
  if (!BYPASS_KEY) throw new Error('PYASERV_DEV_BYPASS_KEY env var missing')
  const r = await fetch(`${API}/api/dev/login?email=e2e-i18n-leak@e2e.invalid`, {
    method: 'POST',
    headers: { 'X-Dev-Bypass-Key': BYPASS_KEY },
  })
  if (!r.ok) throw new Error(`dev login HTTP ${r.status}`)
  const body = await r.json() as { data: { sessionToken: string } }
  return body.data.sessionToken
}

test.describe('i18n raw-key leak guard', () => {
  test('LoginDialog email field label is localized, not the raw "login.email" key', async ({ page }) => {
    await page.goto('/')
    // The email label is the first <span> inside the first <label> of #dlg-start.
    // The <T> component renders both ES and EN <span lang="…"> siblings; we
    // assert NEITHER contains the raw dotted key.
    const esLabel = page.locator('#dlg-start label > span > span[lang="es"]').first()
    const enLabel = page.locator('#dlg-start label > span > span[lang="en"]').first()
    await expect(esLabel, 'ES email label must not be the raw key').not.toHaveText('login.email')
    await expect(enLabel, 'EN email label must not be the raw key').not.toHaveText('login.email')
    // Belt-and-braces: no element on the page should have the raw key as
    // its only textContent.
    const stillRaw = await page.locator('text=/^login\\.email$/').count()
    expect(stillRaw, 'no DOM node may display "login.email" as its text').toBe(0)
  })

  test('Specialists filter labels are localized, not "specialists.filter.category" / "specialists.filter.barrio"', async ({ page }) => {
    await page.goto('/specialists/')
    const categoryEs = page.locator('#filters label:has(select[name="category"]) > span > span[lang="es"]')
    const categoryEn = page.locator('#filters label:has(select[name="category"]) > span > span[lang="en"]')
    const barrioEs = page.locator('#filters label:has(input[name="barrio"]) > span > span[lang="es"]')
    const barrioEn = page.locator('#filters label:has(input[name="barrio"]) > span > span[lang="en"]')

    await expect(categoryEs).not.toHaveText('specialists.filter.category')
    await expect(categoryEn).not.toHaveText('specialists.filter.category')
    await expect(barrioEs).not.toHaveText('specialists.filter.barrio')
    await expect(barrioEn).not.toHaveText('specialists.filter.barrio')
  })

  test('/me/ profile tab field labels are localized after applyI18n hydration', async ({ page }) => {
    test.skip(!BYPASS_KEY, 'PYASERV_DEV_BYPASS_KEY required for /me/ authed scope')
    const sid = await provisionSession()
    await page.addInitScript((s) => {
      try { sessionStorage.setItem('pyaserv.token', s) } catch {}
    }, sid)

    await page.goto('/me/')
    // Wait for the /v1/me roundtrip so the profile form is populated and
    // applyI18n has run at least once.
    await page.waitForLoadState('networkidle')

    // These are the five fields that the bug report explicitly lists. Each
    // <span data-i18n="…"> is a child of a <label> inside the profile tab.
    // After hydration, t(key) returns the raw key (the YAML leaf is an
    // object), and applyI18n stamps that raw key into textContent.
    const fields = ['headline', 'phone', 'whatsapp', 'barrio', 'bio'] as const
    for (const field of fields) {
      const span = page.locator(`[data-i18n="me.profile.${field}"]`)
      // Element must exist (guards against unrelated markup churn).
      await expect(span, `[data-i18n="me.profile.${field}"] must exist`).toHaveCount(1)
      const text = (await span.textContent() ?? '').trim()
      expect(
        text,
        `me.profile.${field} label must not be the raw key (got "${text}")`,
      ).not.toBe(`me.profile.${field}`)
      // Defensive: no dotted-path string at all.
      expect(
        RAW_KEY_REGEX.test(text),
        `me.profile.${field} label looks like a raw i18n key: "${text}"`,
      ).toBe(false)
    }
  })
})
