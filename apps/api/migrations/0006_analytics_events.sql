-- Analytics events for specialist dashboard
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,            -- profile_view | phone_click | whatsapp_click
  subject_id TEXT NOT NULL,       -- specialist_profile id the event targets
  ts INTEGER NOT NULL
);
CREATE INDEX ix_analytics_subject_event_ts
  ON analytics_events (subject_id, event, ts DESC);
