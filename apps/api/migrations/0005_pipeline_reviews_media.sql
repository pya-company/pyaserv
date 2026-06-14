-- 0005 — work-status pipeline, two-way reviews, profile photo, email opt-out.

-- Work status machine on inquiries.
-- negotiating → in_progress → both confirm → done
-- or → cancelled at any point.
ALTER TABLE inquiries ADD COLUMN work_status TEXT NOT NULL DEFAULT 'negotiating';
ALTER TABLE inquiries ADD COLUMN client_confirmed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inquiries ADD COLUMN specialist_confirmed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inquiries ADD COLUMN closed_at INTEGER;
CREATE INDEX ix_inquiries_status ON inquiries(work_status);

-- Two-way reviews. One row per (inquiry, rater_role).
CREATE TABLE reviews (
  id              TEXT PRIMARY KEY,
  inquiry_id      TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  rater_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ratee_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,                -- 'client' = rater is client; 'specialist' = rater is specialist
  stars           INTEGER NOT NULL,             -- 1..5
  body            TEXT NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL,
  UNIQUE(inquiry_id, role)
);
CREATE INDEX ix_reviews_ratee ON reviews(ratee_user_id, created_at DESC);

-- Email-opt-out flag on users.
ALTER TABLE users ADD COLUMN email_notifications INTEGER NOT NULL DEFAULT 1;

-- Throttle table: outbound email rate limit (1 per (recipient, kind) per hour).
CREATE TABLE email_throttle (
  recipient   TEXT NOT NULL,
  kind        TEXT NOT NULL,   -- 'inquiry_new' | 'message_new'
  last_sent   INTEGER NOT NULL,
  PRIMARY KEY (recipient, kind)
);
