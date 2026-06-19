-- User-content translation columns. Each translatable field gains a
-- companion *_es / *_en column (the source-locale column is filled from
-- the original field value at write time, the other-locale column is filled
-- by a CF Workers AI translation hook). Source column remains for backcompat
-- with anything still reading the raw value.

ALTER TABLE specialist_profiles ADD COLUMN headline_es TEXT;
ALTER TABLE specialist_profiles ADD COLUMN headline_en TEXT;
ALTER TABLE specialist_profiles ADD COLUMN bio_es      TEXT;
ALTER TABLE specialist_profiles ADD COLUMN bio_en      TEXT;

ALTER TABLE listings ADD COLUMN title_es       TEXT;
ALTER TABLE listings ADD COLUMN title_en       TEXT;
ALTER TABLE listings ADD COLUMN description_es TEXT;
ALTER TABLE listings ADD COLUMN description_en TEXT;

ALTER TABLE requests ADD COLUMN title_es       TEXT;
ALTER TABLE requests ADD COLUMN title_en       TEXT;
ALTER TABLE requests ADD COLUMN description_es TEXT;
ALTER TABLE requests ADD COLUMN description_en TEXT;
