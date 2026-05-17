-- ============================================================
-- bgIndia Portal — Test Data Rollback Script
-- ============================================================
-- Removes all test records created by TestRunner.
-- Safe to run multiple times.
--
-- Usage:
--   wrangler d1 execute bgindia-db \
--     --file=scripts/rollback-test-data.sql --remote
--
-- NOTE: Google Drive folders must be deleted manually.
--   Go to Drive → root folder → sort by date → trash test folders.
-- ============================================================

DELETE FROM stay_incidentals WHERE stay_id IN (SELECT stay_id FROM stays WHERE guest_name LIKE '%Test%' OR guest_name LIKE '%TESTER%');

DELETE FROM guest_requests WHERE stay_id IN (SELECT stay_id FROM stays WHERE guest_name LIKE '%Test%' OR guest_name LIKE '%TESTER%');

DELETE FROM stay_cars WHERE stay_id IN (SELECT stay_id FROM stays WHERE guest_name LIKE '%Test%' OR guest_name LIKE '%TESTER%');

DELETE FROM raman_commissions WHERE stay_id IN (SELECT stay_id FROM stays WHERE guest_name LIKE '%Test%' OR guest_name LIKE '%TESTER%');

DELETE FROM stays WHERE guest_name LIKE '%Test%' OR guest_name LIKE '%TESTER%';

DELETE FROM rental_income WHERE notes LIKE '%TEST%' OR notes LIKE '%test%';

DELETE FROM coconut_harvests WHERE notes LIKE '%TEST%' OR notes LIKE '%test%';

DELETE FROM rubber_harvests WHERE notes LIKE '%TEST%' OR notes LIKE '%test%';

DELETE FROM guest_requests WHERE type = 'villa_expense' AND detail LIKE '%TEST-EXPENSE%';
