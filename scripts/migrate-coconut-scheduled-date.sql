-- Add scheduled_harvest_date to coconut_harvests in bgindiadb-estates
-- This is harvest_date + 45 days, auto-calculated on every save
-- next_harvest_date = actual date of next harvest (entered after it happens)
-- scheduled_harvest_date = expected date (harvest_date + 45)
-- Difference = delay indicator for Pradosh

ALTER TABLE coconut_harvests ADD COLUMN scheduled_harvest_date TEXT;

-- Backfill existing records: scheduled = harvest_date + 45 days
UPDATE coconut_harvests
SET scheduled_harvest_date = date(harvest_date, '+45 days')
WHERE harvest_date IS NOT NULL;

-- Verify
SELECT harvest_id, harvest_date, scheduled_harvest_date, next_harvest_date
FROM coconut_harvests
ORDER BY harvest_date DESC
LIMIT 10;
