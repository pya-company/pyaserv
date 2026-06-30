-- 0011_spec_v1_tours_and_slug — Onboarding tour completion tracking
-- and lazy-fill slug for existing specialist_profiles rows.
--
-- See PyaEats/docs/pyaserv-spec-v1.md §14.4 (tour state model) and §3-A
-- (slug requirement for /p/<slug> public profile route).

------------------------------------------------------------------------------
-- Onboarding tour completion log
------------------------------------------------------------------------------

CREATE TABLE user_tours_completed (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tour_code    TEXT NOT NULL,                   -- 'T1', 'T2', ...
  status       TEXT NOT NULL,                   -- 'completed' | 'skipped'
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, tour_code)
);

------------------------------------------------------------------------------
-- Backfill slug for existing specialist_profiles rows.
-- Slug format: lowercase display_name with hyphens, suffixed by first 6
-- chars of the profile id to guarantee uniqueness. New rows will use the
-- same formula via the API layer.
------------------------------------------------------------------------------

UPDATE specialist_profiles
SET slug = lower(
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(display_name,
                'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n'), ' ','-'
  ) || '-' || substr(id, 1, 6)
)
WHERE slug IS NULL;
