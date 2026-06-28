/* Bootstrap script — runs before <body> paint via <script src> in <head>.
   Two responsibilities:
   1. Register a Trusted Types "default" policy that pass-throughs HTML strings.
      Required by CSP `require-trusted-types-for 'script'`. Without it,
      innerHTML = string throws at every sink.
   2. Apply locale + theme + auth marker to <html> before first paint so the
      CSS pre-paint rules in global.css (data-auth, data-loc, data-theme)
      catch on the first frame — no FOUC for nav, lang switcher, theme.
   Stays small (no imports) so the network cost is minimal.
*/
(function () {
  if (typeof window === 'undefined') return
  // 1. Trusted Types default policy
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    try {
      window.trustedTypes.createPolicy('default', {
        createHTML: function (s) { return s },
        createScriptURL: function (s) { return s },
        createScript: function (s) { return s },
      })
    } catch (e) { /* policy already exists */ }
  }

  // 2. Locale + theme + auth pre-paint
  // Locale is derived ONLY from URL path: /en/foo → en, /de/foo → de,
  // /ru/foo → ru, /foo → es (default). No ?lang query param. No localStorage
  // for locale — the URL IS the source of truth. The lang switcher emits
  // <a> links that navigate to the same path under a different locale prefix.
  var isLoc = function (v) { return v === 'es' || v === 'en' || v === 'de' || v === 'ru' || v === 'gn' }
  var isTheme = function (v) { return v === 'light' || v === 'dark' || v === 'auto' }
  var loc = 'es'
  try {
    var seg = location.pathname.split('/').filter(Boolean)[0]
    if (isLoc(seg)) loc = seg
  } catch (e) { /* */ }
  var theme = null
  try {
    var t = localStorage.getItem('pyaserv.theme')
    if (isTheme(t)) theme = t
  } catch (e) { /* SSR or private mode */ }
  if (!theme) theme = 'auto'
  document.documentElement.lang = loc
  document.documentElement.dataset.loc = loc
  document.documentElement.dataset.theme = theme
  // Flag for dev-only UI affordances (storybook nav link, debug toggles).
  // Treat localhost + *.pages.dev preview as dev; the bare pyaserv.com prod
  // domain stays clean.
  var h = location.hostname
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.pages.dev')) {
    document.documentElement.dataset.dev = '1'
  }
  try {
    document.documentElement.dataset.auth = sessionStorage.getItem('pyaserv.token') ? 'user' : 'guest'
  } catch (e) {
    document.documentElement.dataset.auth = 'guest'
  }

  // 3. /me/ active-tab pre-paint. Without this the dashboard SSRs panel-profile
  //    visible regardless of ?tab=X, then JS hides it and reveals the requested
  //    panel — which causes a ~900px footer jump on every direct deep-link
  //    load (Slow 4G: CLS 0.18). Reading ?tab=X here and exposing it as
  //    html[data-me-tab=...] lets the CSS in global.css pick the right panel
  //    on the FIRST FRAME — no swap, no shift.
  try {
    if (/\/me\/?$/.test(location.pathname)) {
      var qpTab = new URLSearchParams(location.search).get('tab')
      var TABS = ['profile', 'listings', 'requests', 'inquiries', 'stats']
      document.documentElement.dataset.meTab = TABS.indexOf(qpTab) >= 0 ? qpTab : 'profile'
    }
  } catch (e) { /* */ }
})()
