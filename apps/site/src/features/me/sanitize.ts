/*
 * HTML-escape primitive. Used everywhere we concatenate user-provided
 * strings into innerHTML templates. Single source so the regex isn't
 * re-implemented (incorrectly) on every page.
 */
const ENTITY: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export const escapeHtml = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (m) => ENTITY[m] ?? m)
