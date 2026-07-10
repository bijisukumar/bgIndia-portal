-- ============================================================================
-- CLEANUP: TestRunner test data created 2026-07-10 (post Release 2.1 deploy)
-- ============================================================================
-- Tests #6/#7/#8 (Kitchen/Breakfast/Car Rental) attach to whatever
-- getActiveStay() returns at test time, NOT to the test's own synthetic
-- booking — that was Gulshan Raj Vulli's real active stay (DWK-2026-22309)
-- in this run. So cleanup matches by content marker (test amounts/names
-- that never occur in real entries), not by stay_id — this must not touch
-- any of Gulshan's real entries on that same stay.
--
-- Run the PREVIEW block first (uncommented below). Only run the DELETE
-- block once every row it shows is one you recognize as test data.
-- ============================================================================

-- ── PREVIEW — run this first ────────────────────────────────────────────
SELECT 'stayvibe_stays' AS tbl, stay_id, guest_name, checkin_date, gross, net, created_at
  FROM stayvibe_stays WHERE guest_name = 'Test Guest (DELETE ME)';

SELECT 'stayvibe_incidentals' AS tbl, item_id, stay_id, name, qty, price_per_unit, total, created_at
  FROM stayvibe_incidentals
  WHERE name = 'Water' AND qty = 2 AND price_per_unit = 1 AND total = 2
    AND created_at >= '2026-07-10';

SELECT 'stayvibe_guest_requests (breakfast)' AS tbl, req_id, stay_id, type, detail, created_at
  FROM stayvibe_guest_requests
  WHERE type = 'breakfast' AND detail LIKE '%"ratePerPerson":1%' AND detail LIKE '%"total":1%'
    AND created_at >= '2026-07-10';

SELECT 'stayvibe_guest_requests (car_rental)' AS tbl, req_id, stay_id, type, detail, created_at
  FROM stayvibe_guest_requests
  WHERE type = 'car_rental' AND detail LIKE '%Test Destination%'
    AND created_at >= '2026-07-10';

SELECT 'stayvibe_villa_expenses' AS tbl, txn_id, villa_id, category, amount, created_at
  FROM stayvibe_villa_expenses WHERE category = 'TEST-EXPENSE-DELETE-ME';

-- ── DELETE — only after the preview above looks right ───────────────────
-- DELETE FROM stayvibe_stays WHERE guest_name = 'Test Guest (DELETE ME)';
--
-- DELETE FROM stayvibe_incidentals
--   WHERE name = 'Water' AND qty = 2 AND price_per_unit = 1 AND total = 2
--     AND created_at >= '2026-07-10';
--
-- DELETE FROM stayvibe_guest_requests
--   WHERE type = 'breakfast' AND detail LIKE '%"ratePerPerson":1%' AND detail LIKE '%"total":1%'
--     AND created_at >= '2026-07-10';
--
-- DELETE FROM stayvibe_guest_requests
--   WHERE type = 'car_rental' AND detail LIKE '%Test Destination%'
--     AND created_at >= '2026-07-10';
--
-- DELETE FROM stayvibe_villa_expenses WHERE category = 'TEST-EXPENSE-DELETE-ME';
