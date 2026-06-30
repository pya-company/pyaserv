export const escapeHtml = (s: unknown): string => {
  if (s === null || s === undefined) return ''
  return String(s).replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }
    return map[c] ?? c
  })
}

export const escapeAttr = (s: unknown): string => escapeHtml(s)
