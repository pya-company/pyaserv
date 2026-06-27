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
  var isLoc = function (v) { return v === 'es' || v === 'en' || v === 'de' || v === 'ru' || v === 'gn' }
  var isTheme = function (v) { return v === 'light' || v === 'dark' || v === 'auto' }
  // ?lang=<code> wins over stored preference so a deep-link in any locale
  // takes effect on the first paint (and is then persisted to localStorage so
  // a reload keeps the language).
  var loc = null
  var theme = null
  try {
    var qp = new URLSearchParams(location.search).get('lang')
    if (isLoc(qp)) {
      loc = qp
      try { localStorage.setItem('pyaserv.locale', qp) } catch (e) { /* */ }
    }
  } catch (e) { /* */ }
  try {
    if (!loc) {
      var s = localStorage.getItem('pyaserv.locale')
      if (isLoc(s)) loc = s
    }
    var t = localStorage.getItem('pyaserv.theme')
    if (isTheme(t)) theme = t
  } catch (e) { /* SSR or private mode */ }
  if (!loc) {
    var nav = (navigator.language || '').toLowerCase()
    if (nav.indexOf('de') === 0) loc = 'de'
    else if (nav.indexOf('ru') === 0) loc = 'ru'
    else if (nav.indexOf('es') === 0) loc = 'es'
    else if (nav.indexOf('gn') === 0) loc = 'gn'
    else loc = 'en'
  }
  if (!theme) theme = 'auto'
  document.documentElement.lang = loc
  document.documentElement.dataset.loc = loc
  document.documentElement.dataset.theme = theme
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
