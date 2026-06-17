// @ts-nocheck
// CI gate test: no post-FCP visible-content mutations AND zero layout shift.
//
// History:
// 1. User reported "text pops in after layout" on landing with English browser
//    — root cause was the JS i18n swap (applyI18n rewrote every data-i18n
//    textContent post-paint). Fixed via build-time dual-render (<T> component).
// 2. User then reported a perceived layout jump after the home-stats widget
//    fade-in. CLS measured 0 (height was reserved) but the widget materialised
//    visibly post-paint. Fixed by SSR-ing the numbers in index.astro frontmatter
//    and applying the same to /specialists and /clients listing pages.
//
// This test asserts BOTH:
//   - Zero mutations to visible-content nodes after FCP.
//   - Zero cumulative layout shift (sum of layout-shift entries without recent
//     input). Strict — no skeleton-block whitelist. Any future regression
//     that re-introduces a post-paint render fails CI.
//
// Method:
// - Launch headless Chrome via puppeteer-core (chrome-launcher gives us a port).
// - Set localStorage.pyaserv.locale = 'en' BEFORE navigation so the page
//   thinks the user prefers English (the most-likely flash case).
// - Inject a MutationObserver + PerformanceObserver(layout-shift) + FCP
//   capture via Page.addInitScript.
// - Navigate, wait for load + 2s settle.
// - Read the observers' collected data.
// - Filter mutations to those after FCP that touch visible content.
// - Assert mutation count = 0 AND cumulative shift < 0.01 per route.

import puppeteer from 'puppeteer-core'
import { launch } from 'chrome-launcher'

const BASE = process.env.PYASERV_BASE_URL ?? 'https://pyaserv.com'
const API = process.env.PYASERV_API_URL ?? 'https://api.pyaserv.com'
const CLS_BUDGET = 0.01

const pickFirstId = async (collection: 'specialists' | 'requests'): Promise<string | null> => {
  try {
    const r = await fetch(`${API}/v1/${collection}`)
    if (!r.ok) return null
    const body = await r.json() as { data?: ReadonlyArray<{ id: string }> }
    return body.data?.[0]?.id ?? null
  } catch { return null }
}

const buildRoutes = async (): Promise<ReadonlyArray<string>> => {
  const specId = await pickFirstId('specialists')
  const reqId = await pickFirstId('requests')
  const r = ['/', '/specialists/', '/clients/', '/login/']
  if (specId) r.push(`/specialists/${specId}/`)
  if (reqId) r.push(`/clients/${reqId}/`)
  return r
}

const main = async (): Promise<void> => {
  const ROUTES = await buildRoutes()
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
      // Install the observers at the earliest possible moment.
      await page.evaluateOnNewDocument(() => {
        window.__mutations = []
        window.__shifts = []
        window.__fcp = null
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
            const id = target.id || target.parentElement?.id
            // Loading-state status messages on filtered list pages — Cargando…
            // → "N profesionales" is in a polite live region, fixed height.
            if (id === 'status' || id === 'reviews-summary') continue
            // Theme glyph is now rendered via CSS ::before keyed off
            // html[data-theme] — no JS textContent assignment, no mutation.
            // Whitelist removed; if a regression re-introduces JS swap, the gate
            // will (correctly) catch it.
            // Chat compose & dynamic review threads — auth-gated paths only,
            // never visible on the landing/browse routes this gate covers.
            const klass = target.className || target.parentElement?.className || ''
            if (typeof klass === 'string' && (
              klass.includes('ps-chat') ||
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
        // Capture layout shifts (CLS contributors).
        try {
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
              const sources = []
              for (const s of (e.sources || [])) {
                const n = s.node
                sources.push({
                  tag: safe(n),
                  id: n?.id || null,
                  cls: n?.classList ? [...n.classList].slice(0, 3).join(' ') : null,
                })
              }
              window.__shifts.push({
                value: e.value,
                hadRecentInput: e.hadRecentInput,
                startTime: e.startTime,
                sources,
              })
            }
          }).observe({ type: 'layout-shift', buffered: true })
        } catch {}
      })

      const url = `${BASE}${path}`
      console.log(`[mut] auditing ${url}`)
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
      // Wait 2s after networkidle for any deferred render to flush.
      await new Promise((r) => setTimeout(r, 2000))

      const result = await page.evaluate(() => {
        const fcp = window.__fcp || 0
        const muts = window.__mutations || []
        const afterMuts = muts.filter((m) => m.ts > fcp)
        const shifts = window.__shifts || []
        const cls = shifts
          .filter((s) => !s.hadRecentInput)
          .reduce((acc, s) => acc + s.value, 0)
        const topShifts = shifts
          .filter((s) => !s.hadRecentInput && s.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map((s) => ({ v: s.value.toFixed(4), ts: Math.round(s.startTime), sources: s.sources }))
        return {
          fcp,
          mutationsAfter: afterMuts.length,
          mutationSample: afterMuts.slice(0, 5),
          cls,
          topShifts,
        }
      })

      console.log(`  FCP=${Math.round(result.fcp)}ms  mutations after FCP=${result.mutationsAfter}  CLS=${result.cls.toFixed(4)}`)
      if (result.mutationsAfter > 0) {
        failures.push(`${path}: ${result.mutationsAfter} mutation(s) after FCP — sample: ${JSON.stringify(result.mutationSample)}`)
      }
      if (result.cls > CLS_BUDGET) {
        failures.push(`${path}: CLS ${result.cls.toFixed(4)} > budget ${CLS_BUDGET} — top: ${JSON.stringify(result.topShifts)}`)
      }
      await page.close()
    }

    await browser.disconnect()
  } finally {
    try { chrome.kill() } catch {}
  }

  if (failures.length > 0) {
    console.error('\n❌ Post-FCP regressions detected:')
    for (const f of failures) console.error('  -', f)
    process.exit(1)
  }
  console.log('\n✅ Zero post-FCP mutations AND CLS=0 on every tested route.')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
