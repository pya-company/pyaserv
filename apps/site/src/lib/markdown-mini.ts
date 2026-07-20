/*
 * Tiny markdown subset shared between /docs/<slug>/ and /releases/.
 * Supports: paragraphs, "·" bullet lists, **bold**, `inline code`, links [text](url).
 * Safe for controlled content (we author it); not a sanitizer.
 */

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const inline = (s: string): string =>
  escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

export const renderReleaseBody = (md: string): string => {
  const lines = md.split('\n')
  const out: string[] = []
  let inList = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { if (inList) { out.push('</ul>'); inList = false } continue }
    if (line.startsWith('·')) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inline(line.slice(1).trim())}</li>`)
    } else {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  if (inList) out.push('</ul>')
  return out.join('\n')
}
