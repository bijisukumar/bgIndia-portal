-- Migration: Add review and drive folder columns to stays table
-- Run once:
--   wrangler d1 execute bgindia-db --file=scripts/migrate-review-columns.sql --remote

ALTER TABLE stays ADD COLUMN drive_folder_url TEXT;
ALTER TABLE stays ADD COLUMN review_rating    INTEGER DEFAULT 0;
ALTER TABLE stays ADD COLUMN review_source    TEXT;
ALTER TABLE stays ADD COLUMN review_date      TEXT;

-- Verify
SELECT 'review columns added' AS info;
SELECT stay_id, review_rating, review_source, drive_folder_url FROM stays LIMIT 3;
