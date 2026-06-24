# ADR-0001 — Spec v1 Foundation (profile extensions, gamification skeleton, service areas)

**Date:** 2026-06-24
**Status:** Accepted
**Spec reference:** `PyaEats/docs/pyaserv-spec-v1.md` (sections 3–7, 12)

## Context

Spec v1 introduces a set of value-pull features (personal micro-page, analytics, badges, quotes, gamification, multi-area) and a freemium volume-cap monetization model. The repo already has a solid MVP foundation (8 migrations, `specialist_profiles`, `analytics_events`, ES/EN i18n via `apps/site/src/lib/i18n.ts`).

We need a foundation pass that:
- Extends `specialist_profiles` without breaking existing columns.
- Introduces canonical service areas (40 entries: 25 Asunción barrios + 15 Central distritos) as a reference table, replacing the freetext `barrio` for new flows while keeping it for backward compatibility.
- Lays down the gamification engine tables (XP, badges, quests, streaks) so feature work in Sprints 2-4 can plug into them.
- Adds Guaraní (`gn`) as a third locale alongside `es` and `en`, with companion `*_gn` translation columns and `Locale` type extension.

## Decisions

### D1 — `specialist_profiles` extensions (migration 0009)

Add columns (all nullable for back-compat):

| Column | Type | Purpose |
|---|---|---|
| `slug` | TEXT UNIQUE | Public URL slug for `/p/<slug>` (gen on profile create) |
| `cover_url` | TEXT | Cover image (16:9) |
| `services_json` | TEXT | JSON array `[{name, priceMin, priceMax, currency}]` |
| `portfolio_json` | TEXT | JSON array `[{url, caption, order}]` |
| `schedule_json` | TEXT | JSON `{weekly: {mon: [hh:mm-hh:mm], ...}, vacationUntil?}` |
| `lead_filters_json` | TEXT | JSON `{minBudget?, maxDistanceKm?, hideNewAccounts?, ...}` |
| `cedula_verified` | INTEGER 0/1 | Identity verification flag |
| `ruc_number` | TEXT | Optional RUC for IVA/SIFEN |
| `headline_gn` | TEXT | Guaraní translation |
| `bio_gn` | TEXT | Guaraní translation |

The existing `barrio` (single TEXT) stays as **primary barrio** for legacy queries; multi-area selection lives in the new join table (D2). `barrio` value MUST be one of `service_areas.slug` for new writes; old freetext values stay readable.

### D2 — `service_areas` reference table + many-to-many link (migration 0009)

```
service_areas (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,    -- 'barrio' | 'distrito'
  region       TEXT NOT NULL,    -- 'asuncion' | 'central'
  priority     INTEGER NOT NULL,
  lat          REAL,
  lng          REAL,
  created_at   INTEGER NOT NULL
)

specialist_service_areas (
  specialist_id TEXT NOT NULL REFERENCES specialist_profiles(id) ON DELETE CASCADE,
  area_slug     TEXT NOT NULL REFERENCES service_areas(slug),
  is_primary    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (specialist_id, area_slug)
)
```

40 areas seeded inline (see spec §12). Cap per specialist enforced at API level (max 8 areas) — not in DB (D1 doesn't enforce row limits per group efficiently).

### D3 — Gamification core (migration 0010)

Event-sourced design: every XP grant is an immutable row in `xp_events`; `user_game_state` is the materialized projection (denormalized for read speed).

```
user_game_state (
  user_id              TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp                   INTEGER NOT NULL DEFAULT 0,
  tier                 TEXT NOT NULL DEFAULT 'aprendiz',  -- aprendiz|oficial|maestro|maestro_mayor|patron
  profile_complete_pct INTEGER NOT NULL DEFAULT 20,        -- endowed start (Nunes 2006)
  streak_current       INTEGER NOT NULL DEFAULT 0,
  streak_best          INTEGER NOT NULL DEFAULT 0,
  streak_last_active_date TEXT,                            -- ISO YYYY-MM-DD (PY tz)
  streak_freezes_used_month INTEGER NOT NULL DEFAULT 0,
  streak_paused_until  TEXT,
  updated_at           INTEGER NOT NULL
)

xp_events (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,         -- e.g. 'lead_responded_1h', 'job_completed', ...
  xp          INTEGER NOT NULL,
  ctx_json    TEXT,                  -- contextual ids, idempotency keys
  at          INTEGER NOT NULL
)
CREATE INDEX ix_xp_events_user_at ON xp_events(user_id, at DESC);
CREATE INDEX ix_xp_events_type ON xp_events(type, at DESC);
```

**Badges:**

```
badges_catalog (
  code         TEXT PRIMARY KEY,             -- 'milestone_10_jobs', 'velocista_mes', ...
  name_es      TEXT NOT NULL,
  name_en      TEXT NOT NULL,
  name_gn      TEXT,
  description_es TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_gn TEXT,
  category     TEXT NOT NULL,                -- 'milestone'|'superlative'|'collection'|'tier'
  rarity       TEXT NOT NULL,                -- 'common'|'rare'|'epic'|'legendary'
  icon_slug    TEXT NOT NULL                 -- maps to /icons/badges/<slug>.svg
)

user_badges (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code         TEXT NOT NULL REFERENCES badges_catalog(code),
  earned_at    INTEGER NOT NULL,
  meta_json    TEXT,                          -- e.g. {"month":"2026-06","barrio":"villa-morra"}
  hidden       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, code)
)
CREATE INDEX ix_user_badges_earned ON user_badges(user_id, earned_at DESC);
```

**Quests:**

```
quests (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,             -- 'daily'|'weekly'
  template_code   TEXT NOT NULL,             -- 'respond_1_lead', 'add_portfolio_photo', ...
  goal_json       TEXT NOT NULL,             -- {"count":3}
  progress_json   TEXT NOT NULL DEFAULT '{"current":0}',
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active'|'done'|'expired'
  reward_xp       INTEGER NOT NULL,
  reward_boost_h  INTEGER NOT NULL DEFAULT 0,
  started_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  completed_at    INTEGER
)
CREATE INDEX ix_quests_user_status ON quests(user_id, status, expires_at);
```

### D4 — Locale extension to `gn`

Update `apps/site/src/lib/i18n.ts`:
- `Locale = 'es' | 'en' | 'gn'`
- `LOCALES = ['es', 'en', 'gn']`
- Add `GN` dictionary skeleton (sparse — only key emotional/CTA strings filled now; rest falls back to ES via the `??` operator in `tFor`)

Astro routing already supports adding locales; we'll add `/gn/...` prefix in a follow-up migration when GN-translated pages are ready. For now, locale toggle in UI shows GN, content uses GN dict where present.

### D5 — Analytics extension (NO new table)

`analytics_events` already covers `profile_view`, `phone_click`, `whatsapp_click`. We will add new event types (no schema change needed — `event` is TEXT):
- `wa_share` — user shared their profile via WhatsApp Status
- `badge_unlock` — badge unlock modal shown
- `quest_complete`
- `recap_view` — Sunday recap modal viewed

Daily rollup table `profile_events_daily` deferred to Sprint 3 (we won't need it until analytics dashboard query volume exceeds raw-table cost).

## Consequences

### Positive
- All changes additive — existing `/me/`, listings, requests untouched.
- Gamification engine ready before features (Sprints 2-4 just emit XP events and read state).
- Service areas canonical from day one → SEO landing pages (Sprint 3) can pre-compute slug-based URLs.
- Endowed-progress baseline of 20% requires no extra logic: `profile_complete_pct DEFAULT 20`.

### Negative
- 11 new tables/columns at once — review burden on PR. Mitigation: this PR is FOUNDATION ONLY; no new endpoints, no UI changes (those come in feature PRs).
- `barrio` (single, legacy) coexists with `specialist_service_areas` (multi). Until we migrate `/specialists` filter and the SEO landings to use the new table, both must stay in sync at the API layer. Tech-debt note added below.

### Tech debt registered
- **TD-1:** Drop legacy `specialist_profiles.barrio` column once all queries migrated to `specialist_service_areas`. Target: Sprint 5.
- **TD-2:** Add `profile_events_daily` rollup if `analytics_events` row count exceeds 1M (likely Sprint 6+).
- **TD-3:** `services_json` and `portfolio_json` as TEXT means D1 cannot index nested keys. Acceptable for ≤8 entries; if we hit search-by-service-name, normalize into a separate table.

## Alternatives considered

### Alt A — Use one giant migration for everything
**Rejected.** Too large to review, harder to roll forward partially.

### Alt B — Hard-replace `barrio` with `service_areas` link in migration 0009
**Rejected.** Existing data uses freetext; we'd need a data-migration step (mapping `'Villa Morra'` → `'villa-morra'`) and 27 callsites in `apps/api` and `apps/site` reading `.barrio`. Deferred to TD-1.

### Alt C — Store XP as a single `users.xp INTEGER` column (no event log)
**Rejected.** Audit trail matters for badges that depend on history (e.g., «100 trabajos»), refunds (streak repair), and debugging users who claim «I lost XP». Event-sourced is cheap insurance.

### Alt D — Defer gamification to Sprint 2
**Rejected.** Schema-first lets Sprint 1 feature work emit XP events (e.g., profile completion) without a second migration round.

## Migration sequence

1. `0009_spec_v1_profile_extensions.sql` — D1 + D2 (specialist columns + service_areas + link + seed 40 areas)
2. `0010_spec_v1_gamification.sql` — D3 (game state + xp_events + badges_catalog + seed 18 badges + user_badges + quests)

i18n change is code-only (no migration).

## Open questions resolved by this ADR

- ✅ Multi-area vs single-area on specialist: multi via link table, capped at 8.
- ✅ Gamification storage shape: event-sourced + materialized projection.
- ✅ Locale enum: ES + EN + GN.
- ✅ Service area canonical reference: yes, by slug.

## Still open (NOT decided here)

- SIFEN factura generation flow → ADR-0002 after legal consultation (Sprint 5).
- Pagopar integration shape → ADR-0003 after sales call (Sprint 4).
- WA Business API smart-matching → ADR-0004 after Meta approval (Sprint 4).
