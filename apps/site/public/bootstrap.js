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
  var isLoc = function (v) { return v === 'es' || v === 'en' }
  var isTheme = function (v) { return v === 'light' || v === 'dark' || v === 'auto' }
  var loc = null
  var theme = null
  try {
    var s = localStorage.getItem('pyaserv.locale')
    if (isLoc(s)) loc = s
    var t = localStorage.getItem('pyaserv.theme')
    if (isTheme(t)) theme = t
  } catch (e) { /* SSR or private mode */ }
  if (!loc) {
    try {
      var qp = new URLSearchParams(location.search).get('lang')
      if (isLoc(qp)) loc = qp
    } catch (e) { /* */ }
  }
  if (!loc) loc = (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'es'
  if (!theme) theme = 'auto'
  document.documentElement.lang = loc
  document.documentElement.dataset.loc = loc
  document.documentElement.dataset.theme = theme
  try {
    document.documentElement.dataset.auth = sessionStorage.getItem('pyaserv.token') ? 'user' : 'guest'
  } catch (e) {
    document.documentElement.dataset.auth = 'guest'
  }
})()
