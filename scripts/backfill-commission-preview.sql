-- Preview: shows what commission_amt and net WOULD be after backfill
-- Review this before running backfill-commission-apply.sql
SELECT
  stay_id,
  guest_name,
  strftime('%Y', checkin_date) as year,
  source as channel,
  gross,
  commission_amt as current_commission,
  net as current_net,
  CASE
    WHEN LOWER(source) = 'airbnb'      THEN 3
    WHEN LOWER(source) = 'direct'      THEN 0
    WHEN LOWER(source) = 'booking.com' THEN 15
    WHEN LOWER(source) = 'makemytrip'  THEN 18
    WHEN LOWER(source) = 'goibibo'     THEN 18
    WHEN LOWER(source) = 'expedia'     THEN 3
    ELSE 0
  END as new_pct,
  ROUND(gross * CASE
    WHEN LOWER(source) = 'airbnb'      THEN 0.03
    WHEN LOWER(source) = 'booking.com' THEN 0.15
    WHEN LOWER(source) = 'makemytrip'  THEN 0.18
    WHEN LOWER(source) = 'goibibo'     THEN 0.18
    WHEN LOWER(source) = 'expedia'     THEN 0.03
    ELSE 0
  END, 0) as new_commission,
  ROUND(gross - gross * CASE
    WHEN LOWER(source) = 'airbnb'      THEN 0.03
    WHEN LOWER(source) = 'booking.com' THEN 0.15
    WHEN LOWER(source) = 'makemytrip'  THEN 0.18
    WHEN LOWER(source) = 'goibibo'     THEN 0.18
    WHEN LOWER(source) = 'expedia'     THEN 0.03
    ELSE 0
  END, 0) as new_net
FROM stays
WHERE gross > 0
  AND (commission_amt = 0 OR commission_amt IS NULL)
  AND status != 'cancelled'
ORDER BY year DESC, checkin_date DESC;
