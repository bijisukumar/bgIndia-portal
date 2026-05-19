-- ============================================================
-- Close all historical stays (checkout date in the past)
-- ============================================================
-- Safe to run multiple times — only updates non-cancelled, non-closed stays.
-- Runs in 3 steps:
--   1. checked_out stays → closed
--   2. checked_in stays with past checkout → closed (data entry gap)
--   3. confirmed/booked stays with past checkout → closed (never checked in)

-- Step 1: checked_out → closed
UPDATE stays
SET status = 'closed',
    updated_by = 'system',
    updated_at = datetime('now')
WHERE status = 'checked_out'
  AND checkout_date < date('now');

-- Step 2: checked_in but checkout already passed → closed
UPDATE stays
SET status = 'closed',
    updated_by = 'system',
    updated_at = datetime('now')
WHERE status IN ('checked_in', 'ready_for_checkout')
  AND checkout_date < date('now', '-1 day');

-- Step 3: booked/confirmed/docs_uploaded with past checkout → closed
-- (bookings that were created but never progressed through check-in)
UPDATE stays
SET status = 'closed',
    updated_by = 'system',
    updated_at = datetime('now')
WHERE status IN ('booked','confirmed','docs_uploaded','ready_for_checkin')
  AND checkout_date < date('now', '-7 days');

-- Verify results
SELECT 
  strftime('%Y', checkin_date) as year,
  COUNT(*) as total,
  SUM(CASE WHEN status='closed'       THEN 1 ELSE 0 END) as closed,
  SUM(CASE WHEN status='checked_out'  THEN 1 ELSE 0 END) as checked_out,
  SUM(CASE WHEN status='cancelled'    THEN 1 ELSE 0 END) as cancelled,
  SUM(CASE WHEN status='checked_in'   THEN 1 ELSE 0 END) as checked_in,
  SUM(CASE WHEN status NOT IN ('closed','checked_out','cancelled','checked_in','confirmed','booked') THEN 1 ELSE 0 END) as other
FROM stays
GROUP BY year
ORDER BY year DESC;

-- Grand total
SELECT 
  COUNT(*) as grand_total,
  SUM(CASE WHEN status='closed'     THEN 1 ELSE 0 END) as total_closed,
  SUM(CASE WHEN status='cancelled'  THEN 1 ELSE 0 END) as total_cancelled,
  SUM(CASE WHEN status NOT IN ('closed','cancelled') AND checkout_date < date('now') THEN 1 ELSE 0 END) as still_open_past
FROM stays;
