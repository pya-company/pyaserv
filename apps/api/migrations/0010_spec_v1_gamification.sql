-- 0010_spec_v1_gamification — XP engine, badges catalog, quests, user game state.
--
-- See PyaEats/docs/pyaserv-spec-v1.md §4 (Gamification deep-dive) and ADR-0001 D3.
--
-- Event-sourced: xp_events is the immutable audit log; user_game_state is the
-- materialized projection (denormalized for read speed in /me/ HUD). Streak
-- date uses ISO YYYY-MM-DD in Asunción tz (UTC-3) for stable day boundaries.

------------------------------------------------------------------------------
-- Materialized game state (one row per specialist user)
------------------------------------------------------------------------------

CREATE TABLE user_game_state (
  user_id                    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp                         INTEGER NOT NULL DEFAULT 0,
  tier                       TEXT    NOT NULL DEFAULT 'aprendiz',
  profile_complete_pct       INTEGER NOT NULL DEFAULT 20,    -- Nunes 2006 endowed-progress start
  streak_current             INTEGER NOT NULL DEFAULT 0,
  streak_best                INTEGER NOT NULL DEFAULT 0,
  streak_last_active_date    TEXT,                            -- ISO YYYY-MM-DD (PY)
  streak_freezes_used_month  INTEGER NOT NULL DEFAULT 0,
  streak_paused_until        TEXT,                            -- ISO YYYY-MM-DD or NULL
  updated_at                 INTEGER NOT NULL
);

------------------------------------------------------------------------------
-- Append-only XP event log
------------------------------------------------------------------------------

CREATE TABLE xp_events (
  id         TEXT PRIMARY KEY,                                -- UUID v7
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,                                   -- 'lead_responded_1h', 'job_completed', ...
  xp         INTEGER NOT NULL,
  ctx_json   TEXT,                                            -- {inquiryId, reviewId, idempotencyKey, ...}
  at         INTEGER NOT NULL
);
CREATE INDEX ix_xp_events_user_at ON xp_events(user_id, at DESC);
CREATE INDEX ix_xp_events_type    ON xp_events(type, at DESC);

------------------------------------------------------------------------------
-- Badges — catalog + per-user earned
------------------------------------------------------------------------------

CREATE TABLE badges_catalog (
  code             TEXT PRIMARY KEY,                          -- 'milestone_10_jobs', 'velocista_mes', ...
  name_es          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  name_gn          TEXT,
  description_es   TEXT NOT NULL,
  description_en   TEXT NOT NULL,
  description_gn   TEXT,
  category         TEXT NOT NULL,                             -- 'milestone'|'superlative'|'collection'|'tier'
  rarity           TEXT NOT NULL,                             -- 'common'|'rare'|'epic'|'legendary'
  icon_slug        TEXT NOT NULL
);

CREATE TABLE user_badges (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL REFERENCES badges_catalog(code),
  earned_at  INTEGER NOT NULL,
  meta_json  TEXT,
  hidden     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, code)
);
CREATE INDEX ix_user_badges_earned ON user_badges(user_id, earned_at DESC);

------------------------------------------------------------------------------
-- Quests — daily & weekly
------------------------------------------------------------------------------

CREATE TABLE quests (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,                              -- 'daily'|'weekly'
  template_code   TEXT NOT NULL,                              -- 'respond_1_lead', ...
  goal_json       TEXT NOT NULL,                              -- {"count":3}
  progress_json   TEXT NOT NULL DEFAULT '{"current":0}',
  status          TEXT NOT NULL DEFAULT 'active',             -- 'active'|'done'|'expired'
  reward_xp       INTEGER NOT NULL,
  reward_boost_h  INTEGER NOT NULL DEFAULT 0,
  started_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  completed_at    INTEGER
);
CREATE INDEX ix_quests_user_status ON quests(user_id, status, expires_at);

------------------------------------------------------------------------------
-- Seed badges catalog (18 badges across 4 categories).
-- icon_slug points to apps/site/public/icons/badges/<slug>.svg (icons to be added).
------------------------------------------------------------------------------

-- Tier badges (5) — automatically granted on level-up
INSERT INTO badges_catalog (code, name_es, name_en, name_gn, description_es, description_en, description_gn, category, rarity, icon_slug) VALUES
  ('tier_aprendiz',      'Aprendiz',       'Apprentice',      'Aprendiz',
   'Iniciaste tu camino en PyaServ.',
   'Started your PyaServ journey.',
   'Reiniciar mba''e ñepyrũ PyaServ-pe.',
   'tier', 'common', 'tier-aprendiz'),

  ('tier_oficial',       'Oficial',         'Journeyman',     'Oficial',
   'Acumulaste 100 XP. Tu tiempo de respuesta es visible al público.',
   'Earned 100 XP. Your response time is publicly visible.',
   NULL,
   'tier', 'common', 'tier-oficial'),

  ('tier_maestro',       'Maestro',         'Master',         'Maestro',
   'Acumulaste 500 XP. Insignia visible en el listado, 1 día de Boost gratis al mes.',
   'Earned 500 XP. Tier badge visible on listings, 1 free Boost day per month.',
   NULL,
   'tier', 'rare', 'tier-maestro'),

  ('tier_maestro_mayor', 'Maestro Mayor',   'Grand Master',   'Maestro Mayor',
   '2000 XP. Tag "Recomendado por PyaServ", 3 días de Boost gratis al mes.',
   '2000 XP. "Recommended by PyaServ" tag, 3 free Boost days per month.',
   NULL,
   'tier', 'epic', 'tier-maestro-mayor'),

  ('tier_patron',        'Patrón del Oficio','Patron of the Craft','Patrón',
   '5000 XP. Verified blue equivalent, slot destacado curado.',
   '5000 XP. Verified-blue equivalent, hand-curated featured slot.',
   NULL,
   'tier', 'legendary', 'tier-patron');

-- Milestone badges (5)
INSERT INTO badges_catalog (code, name_es, name_en, name_gn, description_es, description_en, description_gn, category, rarity, icon_slug) VALUES
  ('milestone_first_job',  'Primer trabajo', 'First job',     NULL,
   'Completaste tu primer trabajo.',
   'You completed your first job.',
   NULL,
   'milestone', 'common', 'milestone-first-job'),

  ('milestone_10_jobs',    '10 trabajos',    '10 jobs',       NULL,
   'Diez trabajos completados — ya sos parte del barrio.',
   'Ten jobs completed — you''re part of the neighborhood.',
   NULL,
   'milestone', 'common', 'milestone-10-jobs'),

  ('milestone_50_jobs',    '50 trabajos',    '50 jobs',       NULL,
   '50 trabajos. Veterano del oficio.',
   '50 jobs. Trade veteran.',
   NULL,
   'milestone', 'rare', 'milestone-50-jobs'),

  ('milestone_100_jobs',   '100 trabajos',   '100 jobs',      NULL,
   '100 trabajos completados. Maestro veterano.',
   '100 jobs completed. Veteran master.',
   NULL,
   'milestone', 'epic', 'milestone-100-jobs'),

  ('milestone_first_5star','Primer 5★',      'First 5-star',  NULL,
   'Recibiste tu primera reseña de 5 estrellas.',
   'You got your first 5-star review.',
   NULL,
   'milestone', 'common', 'milestone-first-5star');

-- Superlative badges (3) — monthly evaluation
INSERT INTO badges_catalog (code, name_es, name_en, name_gn, description_es, description_en, description_gn, category, rarity, icon_slug) VALUES
  ('velocista_mes', 'Velocista del mes', 'Speedster of the month', NULL,
   'Top 10% por tiempo de respuesta en tu oficio.',
   'Top 10% by response time in your trade.',
   NULL,
   'superlative', 'rare', 'velocista'),

  ('estrella_barrio', 'Estrella del barrio', 'Star of the neighborhood', NULL,
   'Top 3 por reseñas en tu barrio + oficio este mes.',
   'Top 3 by reviews in your neighborhood + trade this month.',
   NULL,
   'superlative', 'epic', 'estrella-barrio'),

  ('maestro_de_barrio', 'Maestro del barrio', 'Master of the neighborhood', NULL,
   '#1 por reseñas en tu barrio + oficio este mes.',
   '#1 by reviews in your neighborhood + trade this month.',
   NULL,
   'superlative', 'legendary', 'maestro-de-barrio');

-- Collection badges (5)
INSERT INTO badges_catalog (code, name_es, name_en, name_gn, description_es, description_en, description_gn, category, rarity, icon_slug) VALUES
  ('perfil_maestro', 'Perfil Maestro', 'Master Profile', NULL,
   'Completaste el 100% de tu perfil. 7 días de Boost gratis.',
   'You filled your profile to 100%. 7 free Boost days.',
   NULL,
   'collection', 'common', 'perfil-maestro'),

  ('multilingue', 'Multilingüe', 'Multilingual', NULL,
   'Tu perfil está disponible en español y guaraní.',
   'Your profile is available in Spanish and Guarani.',
   NULL,
   'collection', 'rare', 'multilingue'),

  ('constructor', 'Constructor', 'Builder', NULL,
   'Subiste 10 o más fotos de trabajos completados.',
   'You uploaded 10 or more photos of completed work.',
   NULL,
   'collection', 'common', 'constructor'),

  ('equipo', 'Equipo', 'Squad', NULL,
   'Tres colegas se sumaron por tu invitación.',
   'Three colleagues joined through your referral.',
   NULL,
   'collection', 'rare', 'equipo'),

  ('verificado_completo', 'Verificado completo', 'Fully verified', NULL,
   'WhatsApp + Cédula verificados. Confianza máxima.',
   'WhatsApp + Cédula verified. Maximum trust.',
   NULL,
   'collection', 'epic', 'verificado-completo');
