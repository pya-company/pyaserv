-- S22 — drop redundant source columns now that *_es / *_en pairs are
-- fully populated and the API reads from the locale columns first.
-- Saves ~33% storage on translatable rows + removes the synchronization
-- footgun of having a third copy of the same text per row.

ALTER TABLE specialist_profiles DROP COLUMN headline;
ALTER TABLE specialist_profiles DROP COLUMN bio;

ALTER TABLE listings DROP COLUMN title;
ALTER TABLE listings DROP COLUMN description;

ALTER TABLE requests DROP COLUMN title;
ALTER TABLE requests DROP COLUMN description;
