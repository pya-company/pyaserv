-- 0009_spec_v1_profile_extensions — adds spec-v1 personal-profile columns,
-- Guarani (gn) translation companions, canonical service_areas reference,
-- and many-to-many link from specialist to areas.
--
-- See PyaEats/docs/pyaserv-spec-v1.md §3-A, §12 and ADR-0001 D1+D2.
--
-- All ALTERs add nullable columns so existing rows remain valid. The legacy
-- specialist_profiles.barrio (single TEXT) stays for backward compatibility;
-- multi-area selection lives in specialist_service_areas (TD-1 will retire it).

------------------------------------------------------------------------------
-- D1 — specialist_profiles extensions
------------------------------------------------------------------------------

ALTER TABLE specialist_profiles ADD COLUMN slug              TEXT;
ALTER TABLE specialist_profiles ADD COLUMN cover_url         TEXT;
ALTER TABLE specialist_profiles ADD COLUMN services_json     TEXT;
ALTER TABLE specialist_profiles ADD COLUMN portfolio_json    TEXT;
ALTER TABLE specialist_profiles ADD COLUMN schedule_json     TEXT;
ALTER TABLE specialist_profiles ADD COLUMN lead_filters_json TEXT;
ALTER TABLE specialist_profiles ADD COLUMN cedula_verified   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE specialist_profiles ADD COLUMN ruc_number        TEXT;
ALTER TABLE specialist_profiles ADD COLUMN headline_gn       TEXT;
ALTER TABLE specialist_profiles ADD COLUMN bio_gn            TEXT;

-- Unique slug index. NULL allowed (slug generated on next profile write).
CREATE UNIQUE INDEX ux_specialists_slug ON specialist_profiles(slug)
  WHERE slug IS NOT NULL;

------------------------------------------------------------------------------
-- listings / requests Guarani columns (mirror of 0007 pattern)
------------------------------------------------------------------------------

ALTER TABLE listings ADD COLUMN title_gn       TEXT;
ALTER TABLE listings ADD COLUMN description_gn TEXT;

ALTER TABLE requests ADD COLUMN title_gn       TEXT;
ALTER TABLE requests ADD COLUMN description_gn TEXT;

------------------------------------------------------------------------------
-- D2 — canonical service areas reference + link
------------------------------------------------------------------------------

CREATE TABLE service_areas (
  slug        TEXT PRIMARY KEY,           -- 'villa-morra', 'lambare', ...
  name        TEXT NOT NULL,              -- 'Villa Morra'
  type        TEXT NOT NULL,              -- 'barrio' | 'distrito'
  region      TEXT NOT NULL,              -- 'asuncion' | 'central'
  priority    INTEGER NOT NULL,           -- 0 = top
  lat         REAL,
  lng         REAL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX ix_service_areas_region_priority ON service_areas(region, priority);

CREATE TABLE specialist_service_areas (
  specialist_id TEXT NOT NULL REFERENCES specialist_profiles(id) ON DELETE CASCADE,
  area_slug     TEXT NOT NULL REFERENCES service_areas(slug),
  is_primary    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (specialist_id, area_slug)
);
CREATE INDEX ix_ssa_area ON specialist_service_areas(area_slug);

------------------------------------------------------------------------------
-- Seed: 40 service areas (25 Asunción barrios + 15 Central distritos)
-- Source: PyaServ spec §12. Coordinates omitted in v1 (deferred to TD).
------------------------------------------------------------------------------

INSERT INTO service_areas (slug, name, type, region, priority, created_at) VALUES
  -- Asunción barrios (25)
  ('villa-morra',          'Villa Morra',                'barrio', 'asuncion',  0, strftime('%s','now')),
  ('carmelitas',           'Carmelitas',                 'barrio', 'asuncion',  1, strftime('%s','now')),
  ('recoleta',             'Recoleta',                   'barrio', 'asuncion',  2, strftime('%s','now')),
  ('las-mercedes',         'Las Mercedes',               'barrio', 'asuncion',  3, strftime('%s','now')),
  ('manora',               'Manorá',                     'barrio', 'asuncion',  4, strftime('%s','now')),
  ('mariscal-lopez',       'Mariscal López',             'barrio', 'asuncion',  5, strftime('%s','now')),
  ('las-lomas',            'Las Lomas',                  'barrio', 'asuncion',  6, strftime('%s','now')),
  ('sajonia',              'Sajonia',                    'barrio', 'asuncion',  7, strftime('%s','now')),
  ('mburicao',             'Mburicaó',                   'barrio', 'asuncion',  8, strftime('%s','now')),
  ('centro',               'Centro / Casco Histórico',   'barrio', 'asuncion',  9, strftime('%s','now')),
  ('trinidad',             'Trinidad',                   'barrio', 'asuncion', 10, strftime('%s','now')),
  ('pinoza',               'Pinozá',                     'barrio', 'asuncion', 11, strftime('%s','now')),
  ('san-vicente',          'San Vicente',                'barrio', 'asuncion', 12, strftime('%s','now')),
  ('vista-alegre',         'Vista Alegre',               'barrio', 'asuncion', 13, strftime('%s','now')),
  ('bella-vista',          'Bella Vista',                'barrio', 'asuncion', 14, strftime('%s','now')),
  ('ciudad-nueva',         'Ciudad Nueva',               'barrio', 'asuncion', 15, strftime('%s','now')),
  ('santa-ana',            'Santa Ana',                  'barrio', 'asuncion', 16, strftime('%s','now')),
  ('pettirossi',           'Pettirossi',                 'barrio', 'asuncion', 17, strftime('%s','now')),
  ('jara',                 'Jara',                       'barrio', 'asuncion', 18, strftime('%s','now')),
  ('herrera',              'Herrera',                    'barrio', 'asuncion', 19, strftime('%s','now')),
  ('general-caballero',    'General Caballero',          'barrio', 'asuncion', 20, strftime('%s','now')),
  ('itay',                 'Itay',                       'barrio', 'asuncion', 21, strftime('%s','now')),
  ('loma-pyta',            'Loma Pytá',                  'barrio', 'asuncion', 22, strftime('%s','now')),
  ('san-pablo',            'San Pablo',                  'barrio', 'asuncion', 23, strftime('%s','now')),
  ('ricardo-brugada',      'Ricardo Brugada (Chacarita)','barrio', 'asuncion', 24, strftime('%s','now')),
  -- Departamento Central distritos (15)
  ('lambare',              'Lambaré',                    'distrito', 'central', 25, strftime('%s','now')),
  ('fernando-de-la-mora',  'Fernando de la Mora',        'distrito', 'central', 26, strftime('%s','now')),
  ('san-lorenzo',          'San Lorenzo',                'distrito', 'central', 27, strftime('%s','now')),
  ('luque',                'Luque',                      'distrito', 'central', 28, strftime('%s','now')),
  ('nemby',                'Ñemby',                      'distrito', 'central', 29, strftime('%s','now')),
  ('mariano-roque-alonso', 'Mariano Roque Alonso',       'distrito', 'central', 30, strftime('%s','now')),
  ('capiata',              'Capiatá',                    'distrito', 'central', 31, strftime('%s','now')),
  ('limpio',               'Limpio',                     'distrito', 'central', 32, strftime('%s','now')),
  ('villa-elisa',          'Villa Elisa',                'distrito', 'central', 33, strftime('%s','now')),
  ('san-antonio',          'San Antonio',                'distrito', 'central', 34, strftime('%s','now')),
  ('aregua',               'Areguá',                     'distrito', 'central', 35, strftime('%s','now')),
  ('itaugua',              'Itauguá',                    'distrito', 'central', 36, strftime('%s','now')),
  ('ypane',                'Ypané',                      'distrito', 'central', 37, strftime('%s','now')),
  ('ita',                  'Itá',                        'distrito', 'central', 38, strftime('%s','now')),
  ('villeta',              'Villeta',                    'distrito', 'central', 39, strftime('%s','now'));
