-- 0004_mvp_domain — specialist profiles, listings, client requests, inquiries, messages.

CREATE TABLE specialist_profiles (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name   TEXT NOT NULL,
  headline       TEXT NOT NULL,
  bio            TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL,
  whatsapp       TEXT,
  barrio         TEXT NOT NULL,
  lat            REAL,
  lng            REAL,
  photo          TEXT,
  verified       INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX ix_specialists_status ON specialist_profiles(status);
CREATE INDEX ix_specialists_barrio ON specialist_profiles(barrio, status);

CREATE TABLE listings (
  id             TEXT PRIMARY KEY,
  specialist_id  TEXT NOT NULL REFERENCES specialist_profiles(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  price_from_gs  INTEGER,
  price_unit     TEXT,
  photo          TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX ix_listings_category ON listings(category, status);
CREATE INDEX ix_listings_specialist ON listings(specialist_id);

CREATE TABLE requests (
  id             TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  budget_gs      INTEGER,
  barrio         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open',
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX ix_requests_category ON requests(category, status);
CREATE INDEX ix_requests_barrio ON requests(barrio, status);
CREATE INDEX ix_requests_client ON requests(client_id);

CREATE TABLE inquiries (
  id                    TEXT PRIMARY KEY,
  subject_type          TEXT NOT NULL,           -- 'listing' | 'request'
  subject_id            TEXT NOT NULL,
  client_user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialist_user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at       INTEGER NOT NULL,
  created_at            INTEGER NOT NULL,
  UNIQUE(subject_type, subject_id, client_user_id, specialist_user_id)
);
CREATE INDEX ix_inquiries_client ON inquiries(client_user_id, last_message_at DESC);
CREATE INDEX ix_inquiries_specialist ON inquiries(specialist_user_id, last_message_at DESC);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  inquiry_id      TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  sender_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);
CREATE INDEX ix_messages_inquiry ON messages(inquiry_id, created_at);
