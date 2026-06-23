-- Read-only diagnostic — run this first via D1 Admin / D1 console before anything else.
-- Checks whether any rubber_harvests rows were saved with the pre-fix field-name bug
-- (harvest_date NULL, or weight_kg/gross/net all zero despite a real entry existing).
-- This does NOT modify anything.

SELECT harvest_id, estate_id, harvest_date, weight_kg, price_per_kg, gross, expense, net,
       notes, created_at
FROM rubber_harvests
ORDER BY created_at DESC;

-- If any rows show harvest_date = NULL (or blank) and weight_kg/gross/net = 0,
-- those are casualties of the bug — they were saved with the wrong field names
-- and the real values (tapping date, latex kg, price, etc.) were silently dropped.
-- There is no way to recover the original values from these rows alone, since they
-- were never written to the database in the first place. If this happened, the
-- affected harvest(s) will need to be re-entered through the Rubber Tracker screen
-- now that the save bug is fixed.
