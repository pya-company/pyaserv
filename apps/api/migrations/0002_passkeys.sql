-- 0004_passkeys — WebAuthn credential storage for spec 011.
-- Applied via `wrangler d1 migrations apply pyaeats-preview --remote`.

CREATE TABLE passkeys (
  credential_id     TEXT PRIMARY KEY,                          -- base64url
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key        TEXT NOT NULL,                              -- base64url-encoded COSE key bytes
  sign_count        INTEGER NOT NULL DEFAULT 0,
  transports        TEXT,                                       -- JSON array, e.g. ["internal","hybrid"]
  label             TEXT,                                       -- user-friendly device label
  created_at        INTEGER NOT NULL,                           -- unix seconds
  last_used_at      INTEGER NOT NULL,
  backup_eligible   INTEGER NOT NULL DEFAULT 0,                 -- 0/1
  backup_state      INTEGER NOT NULL DEFAULT 0                  -- 0/1
);

CREATE INDEX ix_passkeys_user ON passkeys(user_id);
