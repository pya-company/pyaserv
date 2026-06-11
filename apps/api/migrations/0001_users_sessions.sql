-- 0001_init — identity & audit foundations.
-- Migrations are applied via `wrangler d1 migrations apply` per environment.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,                       -- UUID v7
  email         TEXT NOT NULL,                          -- normalised lowercase
  email_verified INTEGER NOT NULL DEFAULT 0,            -- 0/1
  display_name  TEXT,
  locale        TEXT NOT NULL DEFAULT 'es-PY',
  created_at    INTEGER NOT NULL,                       -- unix seconds
  status        TEXT NOT NULL DEFAULT 'active'          -- active | suspended | deleted
);

CREATE UNIQUE INDEX ux_users_email_active ON users(email) WHERE status != 'deleted';

CREATE TABLE user_identities (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,                          -- google | apple | facebook
  subject        TEXT NOT NULL,                          -- provider 'sub' claim
  email_at_link  TEXT,
  linked_at      INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
);

CREATE INDEX ix_identities_user ON user_identities(user_id);

CREATE TABLE roles (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,                              -- customer | store_owner | store_staff | courier | admin | super_admin
  store_id    TEXT,                                       -- NULL for global roles
  granted_by  TEXT REFERENCES users(id),
  granted_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, role, store_id)
);

CREATE INDEX ix_roles_user ON roles(user_id);
CREATE INDEX ix_roles_store ON roles(store_id, role);

CREATE TABLE audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts              INTEGER NOT NULL,
  actor_user_id   TEXT,
  actor_role      TEXT NOT NULL,
  actor_ip_hash   TEXT,                                   -- HMAC-SHA256(ip, SESSION_PEPPER)
  action          TEXT NOT NULL,
  target_type     TEXT,
  target_id       TEXT,
  store_id        TEXT,
  details_json    TEXT,
  prev_hash       TEXT NOT NULL,
  row_hash        TEXT NOT NULL
);

CREATE INDEX ix_audit_ts ON audit_log(ts);
CREATE INDEX ix_audit_actor ON audit_log(actor_user_id, ts);

-- RUM events from web-vitals beacons.
CREATE TABLE rum_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  value       REAL NOT NULL,
  rating      TEXT,
  url         TEXT NOT NULL,
  ua          TEXT,
  ts          INTEGER NOT NULL,
  session_id  TEXT
);

CREATE INDEX ix_rum_name_ts ON rum_events(name, ts);
CREATE INDEX ix_rum_url ON rum_events(url, ts);
