-- ============================================================================
-- RESET DEMO STAYS — wipes every generated-demo-data row for villa_id
-- 'demovilla', so generate-demo-stays.js can be re-run for a fresh 3-year
-- history before the next prospect meeting.
--
-- Safe specifically because demovilla-db only ever holds generated demo
-- data — never run this pattern against a real tenant's database.
--
-- Run: npx wrangler d1 execute demovilla-db --file=scripts/demo-data/reset-demo-stays.sql --remote
-- ============================================================================

DELETE FROM stayvibe_booking_line_items WHERE villa_id = 'demovilla';
DELETE FROM stayvibe_incidentals WHERE stay_id IN (SELECT stay_id FROM stayvibe_stays WHERE villa_id = 'demovilla');
DELETE FROM stayvibe_manager_commissions WHERE stay_id IN (SELECT stay_id FROM stayvibe_stays WHERE villa_id = 'demovilla');
DELETE FROM stayvibe_villa_expenses WHERE villa_id = 'demovilla';
DELETE FROM stayvibe_inventory WHERE villa_id = 'demovilla';
DELETE FROM stayvibe_stays WHERE villa_id = 'demovilla';

-- Verify — every count below should be 0:
SELECT
  (SELECT COUNT(*) FROM stayvibe_stays WHERE villa_id = 'demovilla')              AS stays,
  (SELECT COUNT(*) FROM stayvibe_booking_line_items WHERE villa_id = 'demovilla') AS line_items,
  (SELECT COUNT(*) FROM stayvibe_villa_expenses WHERE villa_id = 'demovilla')     AS expenses,
  (SELECT COUNT(*) FROM stayvibe_inventory WHERE villa_id = 'demovilla')          AS inventory;
