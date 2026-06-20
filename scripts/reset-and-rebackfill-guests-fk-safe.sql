-- ════════════════════════════════════════════════════════════
-- RESET + RE-BACKFILL (FK-SAFE VERSION) — guests master table from
-- existing stays. Use this INSTEAD of the original
-- scripts/reset-and-rebackfill-guests.sql now that live CRM activity
-- (enquiries/bookings) has started linking to guests.guest_id.
--
-- WHY THIS VERSION EXISTS: running the original script today failed
-- with a FOREIGN KEY constraint error, because GST-BACKFILL-38
-- ("Parvathy Ramasamy") is now referenced by a live booking + enquiry
-- created via WhatsApp on 2026-06-20. The plain DELETE in the original
-- script can't run while that reference exists.
--
-- THE FIX: before deleting, temporarily null out any guest_id columns
-- in bookings/enquiries that point at a GST-BACKFILL-* row. Run the
-- exact same rebuild logic as before. Then re-point those bookings/
-- enquiries to whichever NEW guest_id the same guest_name landed on
-- after rebuild (matched by name — the rebuild is deterministic per
-- name, so this is safe).
--
-- SAFE TO RE-RUN. Tested against a synthetic SQLite DB reproducing
-- this exact scenario (Parvathy Ramasamy with a live booking+enquiry)
-- before being handed over — confirmed both the unrelated "Parvathy
-- Ramasamy" guest and the newly-backfilled "Parvathy Hemant" guest
-- rebuild correctly side by side, and the booking/enquiry links survive
-- pointing at the right (new) guest_id afterward.
-- ════════════════════════════════════════════════════════════

-- ── STEP 1: remember which stays/CRM-table rows are about to lose
-- their guest_id, by capturing the guest NAME for each one first
-- (we'll use the name to re-link after rebuild, since rebuild is
-- grouped by exact guest_name).
-- ════════════════════════════════════════════════════════════

-- (No separate temp table needed — we look the name up live in the
--  UPDATE statements below via a join back through guests before
--  it's deleted... but since guests is about to be deleted, we must
--  do the lookup and store the name FIRST.  D1/SQLite doesn't support
--  multi-statement temp tables cleanly across this console, so instead
--  we add a temporary plain-text column to carry the name through.)

ALTER TABLE bookings ADD COLUMN _tmp_guest_name TEXT;
ALTER TABLE enquiries ADD COLUMN _tmp_guest_name TEXT;

UPDATE bookings SET _tmp_guest_name = (SELECT name FROM guests WHERE guests.guest_id = bookings.guest_id)
WHERE guest_id LIKE 'GST-BACKFILL-%';

UPDATE enquiries SET _tmp_guest_name = (SELECT name FROM guests WHERE guests.guest_id = enquiries.guest_id)
WHERE guest_id LIKE 'GST-BACKFILL-%';

-- ── STEP 2: null out the FK columns so the delete below won't fail ──

UPDATE bookings SET guest_id = NULL WHERE guest_id LIKE 'GST-BACKFILL-%';
UPDATE enquiries SET guest_id = NULL WHERE guest_id LIKE 'GST-BACKFILL-%';

-- ── STEP 3: the original rebuild logic, unchanged ──

DELETE FROM guests WHERE guest_id LIKE 'GST-BACKFILL-%';

INSERT INTO guests (guest_id, name, phone, email, total_stays, total_nights, total_revenue, first_seen_at, last_seen_at, created_by, updated_by)
SELECT
  'GST-BACKFILL-' || ROW_NUMBER() OVER (ORDER BY MIN(s.checkin_date)) AS guest_id,
  s.guest_name AS name,
  (SELECT TRIM(REPLACE(REPLACE(REPLACE(REPLACE(s2.guest_phone, ' ', ''), '-', ''), '+91', ''), '+', ''))
   FROM stays s2 WHERE s2.guest_name = s.guest_name AND COALESCE(s2.guest_phone,'') != ''
   ORDER BY s2.checkin_date DESC LIMIT 1) AS phone,
  (SELECT LOWER(TRIM(s3.guest_email))
   FROM stays s3 WHERE s3.guest_name = s.guest_name AND COALESCE(s3.guest_email,'') != ''
   ORDER BY s3.checkin_date DESC LIMIT 1) AS email,
  COUNT(*) AS total_stays,
  SUM(COALESCE(s.nights,0)) AS total_nights,
  SUM(COALESCE(s.net,0)) AS total_revenue,
  MIN(s.checkin_date) AS first_seen_at,
  MAX(s.checkin_date) AS last_seen_at,
  'backfill', 'backfill'
FROM stays s
WHERE s.status != 'cancelled'
GROUP BY s.guest_name;

-- ── STEP 4: re-point bookings/enquiries to the NEW guest_id for the
-- same guest_name, using the name we stashed in step 1 ──

UPDATE bookings
SET guest_id = (SELECT guest_id FROM guests WHERE guests.name = bookings._tmp_guest_name)
WHERE _tmp_guest_name IS NOT NULL;

UPDATE enquiries
SET guest_id = (SELECT guest_id FROM guests WHERE guests.name = enquiries._tmp_guest_name)
WHERE _tmp_guest_name IS NOT NULL;

-- ── STEP 5: drop the temporary helper columns ──

ALTER TABLE bookings DROP COLUMN _tmp_guest_name;
ALTER TABLE enquiries DROP COLUMN _tmp_guest_name;

-- ── SANITY CHECKS — run these after the script completes ──
-- 1. Confirm no booking/enquiry was left pointing at a dead guest_id:
--      SELECT * FROM bookings WHERE guest_id IS NULL;
--      SELECT * FROM enquiries WHERE guest_id IS NULL;
--    (should return 0 rows — if not, the guest_name on that booking/
--     enquiry didn't exactly match any guest_name in stays, which
--     would mean the guest_name was edited/typo'd between when the
--     enquiry was created and now — investigate manually if so)
--
-- 2. Confirm Parvathy Hemant merged correctly:
--      SELECT * FROM guests WHERE name = 'Parvathy Hemant';
--    (should show total_stays = 3)
--
-- 3. Confirm the unrelated Parvathy Ramasamy still has her live booking:
--      SELECT g.name, b.booking_id, e.enquiry_id
--      FROM guests g
--      LEFT JOIN bookings b ON b.guest_id = g.guest_id
--      LEFT JOIN enquiries e ON e.guest_id = g.guest_id
--      WHERE g.name = 'Parvathy Ramasamy';
