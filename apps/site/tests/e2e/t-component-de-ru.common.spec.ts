/*
 * Regression guard: T.astro must emit per-locale spans for DE and RU.
 *
 * Bug (t-component-de-ru-shows-both-es-and-en):
 *   apps/site/src/components/T.astro line 31 only renders
 *     <span lang="es">{es}</span><span lang="en">{en}</span>
 *   and global.css:675-676 only carries the ES↔EN hide rules. So when
 *   html[lang="de"] (or "ru") wins, neither hide rule fires and BOTH
 *   the Spanish and the English spans paint on every <T>-rendered node
 *   site-wide. Hero h1 reads "Servicios en Paraguay, sin
 *   intermediarios.Services in Paraguay, no middlemen." Nav reads
 *   "ProfesionalesSpecialists". Page is unusable in DE / RU.
 *
 * AC-ML2/ML4: a DE/RU visitor sees DE/RU text (or at minimum, a single
 * language renders per element — never two concatenated).
 *
 * Trigger: bootstrap.js currently rejects DE/RU from localStorage and the
 * ?lang= query, so we flip html[lang] directly after the document loads to
 * exercise the CSS pre-paint path the bug lives on. The defect is in the
 * SSR markup + CSS, not in the bootstrap; this test isolates it from the
 * separate lang-url-param bootstrap bug.
 */
import { expect, test } from '@playwright/test'

const forceHtmlLang = async (page: import('@playwright/test').Page, lang: 'de' | 'ru') => {
  await page.evaluate((l) => {
    document.documentElement.lang = l
    document.documentElement.dataset.loc = l
  }, lang)
}

const HERO = 'main h1'
const NAV_SPECIALISTS = '.ps-topbar__nav a[href="/specialists/"], #topnav a[href="/specialists/"]'

test.describe('T component — DE/RU must not concatenate ES + EN', () => {
  test('DE: hero h1 does not contain both Spanish and English text', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await forceHtmlLang(page, 'de')

    const hero = page.locator(HERO).first()
    const text = (await hero.innerText()).trim()

    // Bug: "Servicios en Paraguay, sin intermediarios.Services in Paraguay, no middlemen."
    // The Spanish substring and the English substring MUST NOT both be visible.
    const hasEs = /Servicios en Paraguay/i.test(text)
    const hasEn = /Services in Paraguay/i.test(text)
    expect(
      hasEs && hasEn,
      `Hero rendered BOTH ES and EN concatenated under html[lang=de]: "${text}"`,
    ).toBe(false)
  })

  test('RU: hero h1 does not contain both Spanish and English text', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await forceHtmlLang(page, 'ru')

    const hero = page.locator(HERO).first()
    const text = (await hero.innerText()).trim()

    const hasEs = /Servicios en Paraguay/i.test(text)
    const hasEn = /Services in Paraguay/i.test(text)
    expect(
      hasEs && hasEn,
      `Hero rendered BOTH ES and EN concatenated under html[lang=ru]: "${text}"`,
    ).toBe(false)
  })

  test('DE: primary nav link does not show "ProfesionalesSpecialists"', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await forceHtmlLang(page, 'de')

    const link = page.locator(NAV_SPECIALISTS).first()
    const text = (await link.innerText()).trim()

    // Bug rendering: "ProfesionalesSpecialists"
    expect(text).not.toMatch(/Profesionales\s*Specialists/i)
    expect(text).not.toMatch(/ProfesionalesSpecialists/i)
  })

  test('RU: primary nav link does not show "ProfesionalesSpecialists"', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await forceHtmlLang(page, 'ru')

    const link = page.locator(NAV_SPECIALISTS).first()
    const text = (await link.innerText()).trim()

    expect(text).not.toMatch(/Profesionales\s*Specialists/i)
    expect(text).not.toMatch(/ProfesionalesSpecialists/i)
  })

  test('DE: SSR markup contains DE spans for T components (not just nav aria buttons)', async ({ page }) => {
    // Pure HTML probe — no JS. T.astro must emit <span lang="de"> content
    // beyond the four <button data-lang="de"> aria-labels in the nav.
    const response = await page.request.get('/?lang=de')
    expect(response.ok()).toBeTruthy()
    const html = await response.text()

    // Count occurrences of lang="de" on actual content spans (not the
    // <button data-lang="de" aria-label="…"> in the lang switcher).
    const allDe = (html.match(/lang="de"/g) ?? []).length
    // Today: prod ships exactly 2 (the two button aria-labels). Fix must
    // raise this dramatically — at least every <T> hero / nav / card / footer.
    expect(
      allDe,
      `Expected DE content spans in SSR HTML; got ${allDe} (only nav-button aria-labels).`,
    ).toBeGreaterThan(10)
  })
})
