# 002 — Mobile Rebrush Design Analysis

## Four Critical Visual Sins (from m2 screenshots)

1. **Zero surface contrast in dark mode.** `--ps-surface` (#1e293b) on `--ps-bg` (#0f172a) delta-L is ~5 points — cards dissolve into the background. Users cannot distinguish card boundaries at a glance.
2. **Dual high-saturation accents at once.** Electric cyan (#22d3ee) for primary + amber (#f59e0b) for secondary compete for visual dominance. Neither reads as a clear hierarchy anchor.
3. **Mobile nav drawer overflow.** At 360 px the dropdown panel clips card content underneath; the dashed empty-state border sits half off-screen in the specialists screenshot.
4. **Empty states have no visual elevation.** The `ps-empty` dashed box shares the same dark background as the page — the user cannot tell it is a distinct feedback element.

## Fix Strategy

Switch to a light-first palette. One authoritative accent (indigo-600). Amber demoted to warnings only. Empty states gain a clear elevated white surface in light mode. Dark mode retains brand coherence at significantly higher surface contrast (~15 L* delta).

## New Token Summary

| Token | Light | Dark |
|---|---|---|
| `--ps-bg` | #f7f8fa | #111827 |
| `--ps-surface` | #ffffff | #1f2937 |
| `--ps-acc` | #4f46e5 | #818cf8 |
| `--ps-acc-soft` | #eef2ff | #1e1b4b |
| `--ps-warn` | #d97706 | #fbbf24 |
| `--ps-text` | #111827 | #f9fafb |
| `--ps-text-muted` | #6b7280 | #9ca3af |

Font: system-ui stack unchanged. Base 16px, line-height 1.55.
Spacing: unchanged (--ps-space-1 through --ps-space-8).
