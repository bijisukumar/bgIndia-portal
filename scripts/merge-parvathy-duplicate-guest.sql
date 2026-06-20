-- ── ONE-TIME MERGE: Parvathy Ramasamy duplicate guest record ────────────
-- Background: an enquiry was created for Parvathy through the app BEFORE
-- the corrected guests backfill ran, which created a fresh guests row
-- (GST-1781979633108-u4ru, total_stays=1 — only knows about the one live
-- booking). The corrected backfill then separately created
-- GST-BACKFILL-38 from her full stays history (total_stays=2 — correct).
-- This leaves her split across two guests rows. This script repoints her
-- enquiries/bookings to the correct backfilled record and removes the
-- stale duplicate.
--
-- SAFE: run as one transaction. If anything fails, nothing is committed.

BEGIN TRANSACTION;

UPDATE enquiries
SET guest_id = 'GST-BACKFILL-38'
WHERE guest_id = 'GST-1781979633108-u4ru';

UPDATE bookings
SET guest_id = 'GST-BACKFILL-38'
WHERE guest_id = 'GST-1781979633108-u4ru';

DELETE FROM guests
WHERE guest_id = 'GST-1781979633108-u4ru';

COMMIT;

-- Verify after running — should show exactly one Parvathy row, total_stays=2,
-- and her enquiry/booking pointing at GST-BACKFILL-38:
--   SELECT * FROM guests WHERE name LIKE '%Parvathy%';
--   SELECT enquiry_id, guest_id FROM enquiries WHERE guest_name LIKE '%Parvathy%';
--   SELECT booking_id, guest_id FROM bookings WHERE guest_id = 'GST-BACKFILL-38';
