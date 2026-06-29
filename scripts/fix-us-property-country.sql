-- Fix: US property (309 N Main, Randolph, TX 75475) had country defaulting
-- to 'IN' instead of 'US' -- the migrate-rental-props-columns migration
-- added the column with DEFAULT 'IN' and never backfilled this property.
-- This causes it to appear under the India tab instead of USA tab.

UPDATE rental_props
SET country = 'US', currency = 'USD', updated_by = 'owner', updated_at = datetime('now')
WHERE prop_id = 'rental_1782751858127';

UPDATE property_details
SET country = 'US'
WHERE prop_id = 'rental_1782751858127';

-- Verify:
-- SELECT prop_id, name, country, currency FROM rental_props WHERE prop_id = 'rental_1782751858127';
