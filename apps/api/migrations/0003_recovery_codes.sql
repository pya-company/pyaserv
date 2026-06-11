-- Recovery codes — one-time fallback when both passkey AND email OTP fail
-- (lost device + lost mailbox + lost recovery key on the third device, etc).
--
-- A user enrolling a passkey for the first time gets 8 codes generated and
-- displayed ONCE. They store them outside the app (password manager, paper).
-- Redeeming a code:
--   • marks it used (`used_at`)
--   • invalidates ALL existing passkeys for that user (security best practice —
--     a leaked code means the account is compromised; force re-enrolment)
--   • mints a session
--
-- We store only the hash, never the plaintext. PBKDF2-SHA256 1-round w/
-- per-row salt is enough for short-lived (~years) high-entropy (64 bits)
-- secrets; we don't need Argon2 cost overhead. Salt + hash are both 32 bytes,
-- encoded as 64-char hex.
CREATE TABLE recovery_codes (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  salt_hex   TEXT NOT NULL,                 -- 32 bytes hex = 64 chars
  code_hash  TEXT NOT NULL,                 -- 32 bytes hex = 64 chars
  used_at    INTEGER,                       -- unix-seconds when redeemed
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, code_hash)
);
CREATE INDEX ix_recovery_codes_user ON recovery_codes(user_id, used_at);
