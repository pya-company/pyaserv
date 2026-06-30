-- 0012_spec_v1_quotes_clients_releases — quote builder, lite-CRM, release
-- subscriptions. Closes Features E (Quotes), I (Lite-CRM), part of M
-- (Release Notes subscription channel).
--
-- See PyaEats/docs/pyaserv-spec-v1.md §3-E, §3-I, §16.6.

------------------------------------------------------------------------------
-- Quote builder
------------------------------------------------------------------------------

CREATE TABLE quote_templates (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oficio       TEXT NOT NULL,                   -- category slug
  title        TEXT NOT NULL,                   -- 'Cambio de calentador'
  items_json   TEXT NOT NULL,                   -- JSON [{name, qty, unitPrice}]
  is_default   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX ix_quote_templates_user_oficio ON quote_templates(user_id, oficio);

CREATE TABLE quotes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name   TEXT,
  client_phone  TEXT,
  items_json    TEXT NOT NULL,
  subtotal_gs   INTEGER NOT NULL,
  iva_included  INTEGER NOT NULL DEFAULT 1,
  iva_gs        INTEGER NOT NULL DEFAULT 0,
  total_gs      INTEGER NOT NULL,
  pdf_key       TEXT,                            -- R2 key if PDF generated
  sent_at       INTEGER,                         -- when sent via WA
  created_at    INTEGER NOT NULL
);
CREATE INDEX ix_quotes_user_created ON quotes(user_id, created_at DESC);

------------------------------------------------------------------------------
-- Lite-CRM "Mis clientes"
------------------------------------------------------------------------------

CREATE TABLE client_records (
  id                  TEXT PRIMARY KEY,
  specialist_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name        TEXT,                      -- snapshot at first contact
  phone               TEXT,
  barrio              TEXT,
  notes               TEXT,
  job_count           INTEGER NOT NULL DEFAULT 0,
  last_job_at         INTEGER,
  last_job_oficio     TEXT,
  next_pitch_at       INTEGER,                   -- nullable; computed at job completion
  opt_out             INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  UNIQUE(specialist_user_id, client_user_id)
);
CREATE INDEX ix_client_records_spec_updated ON client_records(specialist_user_id, updated_at DESC);
CREATE INDEX ix_client_records_pitch ON client_records(specialist_user_id, next_pitch_at)
  WHERE next_pitch_at IS NOT NULL AND opt_out = 0;

------------------------------------------------------------------------------
-- Release notes subscription (email digest)
------------------------------------------------------------------------------

CREATE TABLE release_subscriptions (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  last_sent_at   INTEGER,
  created_at     INTEGER NOT NULL
);

-- track which release each user has seen (for in-app toast on next login)
ALTER TABLE users ADD COLUMN last_seen_release_at INTEGER;

------------------------------------------------------------------------------
-- Subscription / paywall (Sprint 5/6 monetization)
------------------------------------------------------------------------------

CREATE TABLE user_subscriptions (
  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan             TEXT NOT NULL DEFAULT 'free',     -- 'free' | 'pro'
  current_period_start INTEGER NOT NULL,
  current_period_end   INTEGER NOT NULL,
  inquiry_count_period INTEGER NOT NULL DEFAULT 0,
  cap_hit_at       INTEGER,                          -- timestamp when first hit cap in this period
  pagopar_subscription_id TEXT,
  status           TEXT NOT NULL DEFAULT 'active',   -- 'active'|'cancelled'|'past_due'
  updated_at       INTEGER NOT NULL
);

------------------------------------------------------------------------------
-- Cap helper view: how many distinct clients hit each specialist this period.
-- Computed in API logic, this table just stores aggregates updated by hooks.
------------------------------------------------------------------------------
