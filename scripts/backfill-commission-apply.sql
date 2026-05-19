-- Apply commission backfill
-- ONLY run after reviewing backfill-commission-preview.sql output
-- Only updates stays where gross > 0 and commission_amt is currently 0

UPDATE stays
SET
  commission_pct = CASE
    WHEN LOWER(source) = 'airbnb'      THEN 3
    WHEN LOWER(source) = 'direct'      THEN 0
    WHEN LOWER(source) = 'booking.com' THEN 15
    WHEN LOWER(source) = 'makemytrip'  THEN 18
    WHEN LOWER(source) = 'goibibo'     THEN 18
    WHEN LOWER(source) = 'expedia'     THEN 3
    ELSE 0
  END,
  commission_amt = ROUND(gross * CASE
    WHEN LOWER(source) = 'airbnb'      THEN 0.03
    WHEN LOWER(source) = 'booking.com' THEN 0.15
    WHEN LOWER(source) = 'makemytrip'  THEN 0.18
    WHEN LOWER(source) = 'goibibo'     THEN 0.18
    WHEN LOWER(source) = 'expedia'     THEN 0.03
    ELSE 0
  END, 0),
  net = ROUND(gross - gross * CASE
    WHEN LOWER(source) = 'airbnb'      THEN 0.03
    WHEN LOWER(source) = 'booking.com' THEN 0.15
    WHEN LOWER(source) = 'makemytrip'  THEN 0.18
    WHEN LOWER(source) = 'goibibo'     THEN 0.18
    WHEN LOWER(source) = 'expedia'     THEN 0.03
    ELSE 0
  END, 0),
  updated_by = 'system',
  updated_at = datetime('now')
WHERE gross > 0
  AND (commission_amt = 0 OR commission_amt IS NULL)
  AND status != 'cancelled';
