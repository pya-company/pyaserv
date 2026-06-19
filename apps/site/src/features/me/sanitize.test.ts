import { describe, expect, it } from 'bun:test'
import { escapeHtml } from './sanitize.ts'

describe('escapeHtml', () => {
  it('passes plain text through', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('escapes all five HTML-significant chars', () => {
    expect(escapeHtml('<script>alert("x&y")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;',
    )
  })

  it('escapes single quote with numeric entity', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('coerces null to empty', () => {
    expect(escapeHtml(null)).toBe('')
  })

  it('coerces undefined to empty', () => {
    expect(escapeHtml(undefined)).toBe('')
  })

  it('coerces numbers + booleans to their string repr', () => {
    expect(escapeHtml(42)).toBe('42')
    expect(escapeHtml(true)).toBe('true')
  })
})
