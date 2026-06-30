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
  // Locale is derived ONLY from URL path. Every page lives under /<code>/ —
  // /es/foo, /en/foo, /de/foo, /ru/foo. The bare root and bare /foo/ paths
  // ship a tiny client-side negotiator that picks the user's best locale
  // and redirects (see scripts/mirror-es-and-negotiate.ts). No ?lang query
  // param. No localStorage for locale. The URL IS the source of truth.
  var isLoc = function (v) { return v === 'es' || v === 'en' || v === 'de' || v === 'ru' || v === 'gn' }
  var isTheme = function (v) { return v === 'light' || v === 'dark' || v === 'auto' }
  // Default 'en' is just a safety net for pages that briefly load BEFORE
  // the negotiator redirects — should never persist as a final locale.
  var loc = 'en'
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
  var hasToken = false
  try {
    hasToken = !!sessionStorage.getItem('pyaserv.token')
    document.documentElement.dataset.auth = hasToken ? 'user' : 'guest'
  } catch (e) {
    document.documentElement.dataset.auth = 'guest'
  }

  // Guest hitting any /me/* route — redirect BEFORE the dashboard SSR paints.
  // This kills the ~150ms flash of the (gated) dashboard before the in-body
  // JS would have done its own redirect. Uses location.replace so the
  // back button doesn't carry the user back into the flash.
  try {
    if (!hasToken && /^\/(?:[a-z]{2}\/)?me(?:\/|$)/.test(location.pathname)) {
      var target = '/?login=1&next=' + encodeURIComponent(location.pathname + location.search) + '&reason=dashboard'
      location.replace(target)
    }
  } catch (e) { /* */ }

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
