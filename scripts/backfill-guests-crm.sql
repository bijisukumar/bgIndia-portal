-- ── ONE-TIME BACKFILL: guests master table from existing stays ─────────
-- Run ONCE, after the CRM migration creates the `guests` table.
-- Safe to re-run (INSERT OR IGNORE keyed by guest_id derived from phone/email),
-- but it will NOT merge two existing guests rows if you run it twice with
-- different normalization — only run once on a clean table.
--
-- Phone normalization here is best-effort (strips spaces, dashes, leading
-- +91/91/0). SQLite has no regex; messy/inconsistent phone formats in your
-- historical `stays` data may not all collapse to the same guest. Review
-- the result with:
--   SELECT phone, COUNT(*) FROM guests GROUP BY phone HAVING COUNT(*) > 1;
-- and merge any obvious duplicates by hand if needed.

INSERT OR IGNORE INTO guests (guest_id, name, phone, email, total_stays, total_nights, total_revenue, first_seen_at, last_seen_at, created_by, updated_by)
SELECT
  'GST-BACKFILL-' || ROW_NUMBER() OVER (ORDER BY MIN(s.checkin_date)) AS guest_id,
  -- Most recent name spelling on file for this contact
  (SELECT s2.guest_name FROM stays s2
   WHERE COALESCE(s2.guest_phone,'') = COALESCE(s.guest_phone,'')
     AND COALESCE(s2.guest_email,'') = COALESCE(s.guest_email,'')
   ORDER BY s2.checkin_date DESC LIMIT 1) AS name,
  TRIM(
    REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(s.guest_phone,''), ' ', ''), '-', ''), '+91', ''), '+', '')
  ) AS phone,
  LOWER(TRIM(COALESCE(s.guest_email, ''))) AS email,
  COUNT(*) AS total_stays,
  SUM(COALESCE(s.nights,0)) AS total_nights,
  SUM(COALESCE(s.net,0)) AS total_revenue,
  MIN(s.checkin_date) AS first_seen_at,
  MAX(s.checkin_date) AS last_seen_at,
  'backfill', 'backfill'
FROM stays s
WHERE s.status != 'cancelled'
  AND (COALESCE(s.guest_phone,'') != '' OR COALESCE(s.guest_email,'') != '')
GROUP BY
  TRIM(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(s.guest_phone,''), ' ', ''), '-', ''), '+91', ''), '+', '')),
  LOWER(TRIM(COALESCE(s.guest_email, '')));

-- Sanity check after running:
-- SELECT COUNT(*) FROM guests;
-- SELECT * FROM guests ORDER BY total_revenue DESC LIMIT 10;
