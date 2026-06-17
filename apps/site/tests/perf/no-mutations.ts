// @ts-nocheck
// CI gate test: no DOM mutations to visible content after First Contentful Paint.
//
// User report: "text pops in after layout" on landing with English browser.
// Root cause was the JS i18n swap (applyI18n rewrote every data-i18n
// textContent post-paint). The fix is build-time dual-render via <T>
// component + CSS-based locale hide. This test guards against any future
// regression — if anyone re-introduces a JS-driven text/layout swap, the
// CI gate catches it.
//
// Method:
// - Launch headless Chrome via puppeteer-core (chrome-launcher gives us a port).
// - Set localStorage.pyaserv.locale = 'en' BEFORE navigation so the page
//   thinks the user prefers English.
// - Inject a MutationObserver before <html> parse via Page.addInitScript.
// - Navigate, wait for load + 2s settle.
// - Read the observer's collected mutations.
// - Filter to those after FCP that touch text or visible-content layout.
// - Assert the filtered count is 0.

import puppeteer from 'puppeteer-core'
import { launch } from 'chrome-launcher'

const BASE = process.env.PYASERV_BASE_URL ?? 'https://pyaserv.com'
const ROUTES = ['/', '/specialists/', '/clients/', '/login/']

const main = async (): Promise<void> => {
  const chrome = await launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  })

  const failures: string[] = []
  try {
    const browser = await puppeteer.connect({
      browserURL: `http://localhost:${chrome.port}`,
      defaultViewport: { width: 360, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    })

    for (const path of ROUTES) {
      const page = await browser.newPage()
      // Set EN locale via init script so the page renders for an English-browser user.
      await page.evaluateOnNewDocument(() => {
        try { localStorage.setItem('pyaserv.locale', 'en') } catch {}
      })
      // Install the observer at the earliest possible moment.
      await page.evaluateOnNewDocument(() => {
        window.__mutations = []
        const safe = (n) => n && (n.tagName || n.nodeName)
        const interesting = (target) => {
          const tag = safe(target)
          if (!tag) return false
          // Non-visible / non-content nodes.
          if (['SCRIPT', 'STYLE', 'LINK', 'META', '#text', 'TITLE', 'HEAD'].includes(tag)) return false
          // Select option lists are populated by JS in some pages; not visible
          // pre-paint and the dropdown is collapsed by default — no visual flash.
          if (['SELECT', 'OPTION'].includes(tag)) return false
          return true
        }
        const obs = new MutationObserver((records) => {
          for (const r of records) {
            const target = r.type === 'characterData' ? r.target.parentElement : r.target
            if (!interesting(target)) continue
            // Ignore stats-line text that legitimately injects later (it's
            // pre-reserved height; never shifts layout).
            const id = target.id || target.parentElement?.id
            // Loading-state status messages (Cargando… → "N profesionales")
            // live in containers with reserved height.
            if (id === 'status' || id === 'reviews-summary') continue
            // Theme button glyph is a single emoji char swap (🌓 → ☀️/🌙) of
            // identical width — no layout impact.
            if (id === 'theme-icon') continue
            // Ignore listing/results/reviews dynamic containers — they have
            // reserved min-heights via .ps-skeleton-block and are expected
            // to inject async content.
            const klass = target.className || target.parentElement?.className || ''
            if (typeof klass === 'string' && (
              klass.includes('ps-cards') ||
              klass.includes('ps-chat') ||
              klass.includes('ps-skeleton-block') ||
              klass.includes('reviews-list') ||
              klass.includes('ps-stat-card')
            )) continue

            window.__mutations.push({
              type: r.type,
              tag: safe(target),
              id: target.id || null,
              attr: r.attributeName || null,
              ts: performance.now(),
              text: r.type === 'characterData'
                ? { old: r.oldValue?.slice(0, 40), now: r.target.nodeValue?.slice(0, 40) }
                : null,
            })
          }
        })
        const start = () => obs.observe(document.documentElement, {
          childList: true, subtree: true,
          characterData: true, characterDataOldValue: true,
          attributes: true, attributeOldValue: true,
          attributeFilter: ['style', 'class', 'hidden'],
        })
        if (document.documentElement) start()
        else document.addEventListener('readystatechange', start, { once: true })
        // Capture FCP for filtering.
        try {
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
              if (e.name === 'first-contentful-paint') window.__fcp = e.startTime
            }
          }).observe({ type: 'paint', buffered: true })
        } catch {}
      })

      const url = `${BASE}${path}`
      console.log(`[mut] auditing ${url}`)
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
      // Wait 2s after networkidle for any deferred render to flush.
      await new Promise((r) => setTimeout(r, 2000))

      const result = await page.evaluate(() => {
        const fcp = window.__fcp || 0
        const mutations = window.__mutations || []
        const after = mutations.filter((m) => m.ts > fcp)
        return { fcp, total: mutations.length, after: after.length, sample: after.slice(0, 5) }
      })

      console.log(`  FCP=${Math.round(result.fcp)}ms  mutations after FCP=${result.after}`)
      if (result.after > 0) {
        failures.push(`${path}: ${result.after} mutation(s) after FCP — sample: ${JSON.stringify(result.sample)}`)
      }
      await page.close()
    }

    await browser.disconnect()
  } finally {
    try { chrome.kill() } catch {}
  }

  if (failures.length > 0) {
    console.error('\n❌ Post-FCP mutations detected:')
    for (const f of failures) console.error('  -', f)
    process.exit(1)
  }
  console.log('\n✅ No post-FCP visible-content mutations on any tested route.')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
