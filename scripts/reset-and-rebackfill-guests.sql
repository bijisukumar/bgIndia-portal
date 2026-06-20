-- ── RESET + RE-BACKFILL: guests master table from existing stays ────────
-- Use this INSTEAD of the original backfill-guests-crm.sql if you already
-- ran that one and it under-counted repeat guests (e.g. showing total_stays=1
-- for guests you know stayed multiple times, like "Romala Arunava Sarker"
-- or "Parvathy Ramasamy").
--
-- ROOT CAUSE OF THE UNDER-COUNT: the original backfill grouped stays by
-- phone/email only, and skipped any stay with BOTH fields blank. Early
-- bookings (pre-~2024) often have no phone/email on file at all, so a guest
-- with 4 stays — 3 with no contact info, 1 with contact info — ended up
-- split: the 3 contactless stays were invisible to the guests table
-- entirely, and the 1 contact-having stay became its own guests row with
-- total_stays=1.
--
-- FIX: group by exact guest_name instead. Confirmed against real data that
-- this correctly unifies historical same-person stays (verified manually
-- for Romala Arunava Sarker and Parvathy Ramasamy, both of whom have stays
-- with and without contact info on file, and are real repeat guests).
--
-- KNOWN LIMITATION: two genuinely different people who happen to share an
-- exact guest_name string will be incorrectly merged into one guest row.
-- For pre-CRM historical data, this is judged less harmful than the
-- under-counting it replaces. If guest_name has known typos/variants for
-- the same person (e.g. "Romala Sarker" vs "Romala Arunava Sarker"), those
-- will NOT be merged by this script — check for likely variants with:
--   SELECT DISTINCT guest_name FROM stays ORDER BY guest_name;
-- and merge any obvious near-duplicates by hand afterward using the merge
-- query at the bottom.
--
-- SAFE TO RUN: wipes prior GST-BACKFILL-* rows first, so this fully
-- replaces whatever the previous backfill produced. Do NOT run this after
-- live enquiries/bookings have already linked to guests.guest_id, since
-- those rows will be deleted and the links broken.

DELETE FROM guests WHERE guest_id LIKE 'GST-BACKFILL-%';

INSERT INTO guests (guest_id, name, phone, email, total_stays, total_nights, total_revenue, first_seen_at, last_seen_at, created_by, updated_by)
SELECT
  'GST-BACKFILL-' || ROW_NUMBER() OVER (ORDER BY MIN(s.checkin_date)) AS guest_id,
  s.guest_name AS name,
  -- Most recent non-blank phone on file for this name, normalized
  (SELECT TRIM(REPLACE(REPLACE(REPLACE(REPLACE(s2.guest_phone, ' ', ''), '-', ''), '+91', ''), '+', ''))
   FROM stays s2 WHERE s2.guest_name = s.guest_name AND COALESCE(s2.guest_phone,'') != ''
   ORDER BY s2.checkin_date DESC LIMIT 1) AS phone,
  -- Most recent non-blank email on file for this name
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

-- Spot-check candidates for manual merge (near-duplicate names that
-- probably refer to the same person but won't auto-merge):
--   SELECT DISTINCT guest_name FROM stays ORDER BY guest_name;

-- Example manual merge, if you find e.g. "Romala Sarker" should really be
-- the same guest as "Romala Arunava Sarker" (adjust names/ids before running):
--   UPDATE stays SET guest_name = 'Romala Arunava Sarker' WHERE guest_name = 'Romala Sarker';
--   -- then re-run this whole script to rebuild guests from the corrected names

-- Sanity check after running:
-- SELECT COUNT(*) FROM guests;
-- SELECT name, phone, email, total_stays, total_revenue FROM guests WHERE total_stays > 1 ORDER BY total_stays DESC;
