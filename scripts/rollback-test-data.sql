-- ============================================================
-- bgIndia Portal — Test Data Rollback Script
-- ============================================================
-- PURPOSE:
--   Remove ALL test data inserted during workflow testing.
--   Run after each test session to restore clean state.
--
-- USAGE:
--   wrangler d1 execute bgindia-db \
--     --file=scripts/rollback-test-data.sql --remote
--
-- NAMING CONVENTION FOR TEST DATA:
--   Guest name: "Test Guest" or any name containing "TESTER"
--   Notes: include "TEST" in any notes field
--   The rollback script matches on these patterns.
--
-- ⚠️  GOOGLE DRIVE FOLDERS cannot be deleted via SQL.
--   MANUAL STEP: Go to Drive → root folder → sort by date
--   → find folders from test date → Right-click → Trash
-- ============================================================

-- ── PREVIEW first (safe — no deletes yet) ─────────────────
SELECT 'Stays to be rolled back:' AS info;
SELECT stay_id, guest_name, checkin_date, status
FROM stays
WHERE guest_name LIKE '%Test%' OR guest_name LIKE '%TESTER%'
   OR stay_id LIKE 'DWK-TEST%'
ORDER BY created_at DESC;

-- ── 1. Kitchen incidentals for test stays ─────────────────
DELETE FROM stay_incidentals
WHERE stay_id IN (
  SELECT stay_id FROM stays
  WHERE guest_name LIKE '%Test%' OR guest_name LIKE '%TESTER%'
     OR stay_id LIKE 'DWK-TEST%'
);

-- ── 2. Guest requests for test stays ──────────────────────
DELETE FROM guest_requests
WHERE stay_id IN (
  SELECT stay_id FROM stays
  WHERE guest_name LIKE '%Test%' OR guest_name LIKE '%TESTER%'
     OR stay_id LIKE 'DWK-TEST%'
);

-- ── 3. Car photos for test stays ──────────────────────────
DELETE FROM stay_cars
WHERE stay_id IN (
  SELECT stay_id FROM stays
  WHERE guest_name LIKE '%Test%' OR guest_name LIKE '%TESTER%'
     OR stay_id LIKE 'DWK-TEST%'
);

-- ── 4. Raman commissions for test stays ───────────────────
DELETE FROM raman_commissions
WHERE stay_id IN (
  SELECT stay_id FROM stays
  WHERE guest_name LIKE '%Test%' OR guest_name LIKE '%TESTER%'
     OR stay_id LIKE 'DWK-TEST%'
);

-- ── 5. Test stays themselves ───────────────────────────────
DELETE FROM stays
WHERE guest_name LIKE '%Test%' OR guest_name LIKE '%TESTER%'
   OR stay_id LIKE 'DWK-TEST%';

-- ── 6. Test rental income entries ─────────────────────────
DELETE FROM rental_income
WHERE notes LIKE '%TEST%' OR notes LIKE '%test%';

-- ── 7. Test coconut harvests ──────────────────────────────
DELETE FROM coconut_harvests
WHERE notes LIKE '%TEST%' OR notes LIKE '%test%';

-- ── 8. Test rubber harvests ───────────────────────────────
DELETE FROM rubber_harvests
WHERE notes LIKE '%TEST%' OR notes LIKE '%test%';

-- ── 9. Test rental agreements ─────────────────────────────
DELETE FROM rental_props
WHERE tenant_name LIKE '%TEST%' OR notes LIKE '%TEST%';

-- ── VERIFY — all should show 0 ────────────────────────────
SELECT 'VERIFICATION — should all be 0:' AS check_label;
SELECT 'stays'             AS tbl, COUNT(*) AS remaining FROM stays WHERE guest_name LIKE '%Test%'
UNION ALL
SELECT 'raman_commissions', COUNT(*) FROM raman_commissions WHERE stay_id IN (SELECT stay_id FROM stays WHERE guest_name LIKE '%Test%')
UNION ALL
SELECT 'stay_incidentals',  COUNT(*) FROM stay_incidentals  WHERE stay_id LIKE 'DWK-TEST%'
UNION ALL
SELECT 'coconut_harvests',  COUNT(*) FROM coconut_harvests  WHERE notes LIKE '%test%'
UNION ALL
SELECT 'rubber_harvests',   COUNT(*) FROM rubber_harvests   WHERE notes LIKE '%test%'
UNION ALL
SELECT 'rental_income',     COUNT(*) FROM rental_income     WHERE notes LIKE '%test%';

-- ============================================================
-- ALL ZEROS = clean rollback. Non-zero = delete manually.
-- REMINDER: Delete test Drive folders manually.
-- ============================================================
