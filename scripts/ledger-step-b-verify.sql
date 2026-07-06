-- ============================================================================
-- LEDGER STEP B — VERIFY (READ-ONLY, run after ledger-step-b-apply.sql)
-- ============================================================================
-- Run each query via --command (the --file import path doesn't print SELECT
-- results). Expected: Query A -> 293 stays / diff_rows 0; Query B -> 0 rows;
-- Query C -> the two corrected stays; Query D -> invariant violations 0.
-- No compound SELECTs (D1 cap).

-- A) Summary: every in-scope stay's stored roll-up vs actual ledger sums
WITH roll AS (
  SELECT s.stay_id,
    ROUND(COALESCE(s.gross,0),2)          AS stored_gross,
    ROUND(COALESCE(s.commission_amt,0),2) AS stored_commission,
    ROUND(COALESCE(s.net,0),2)            AS stored_net,
    ROUND(COALESCE((SELECT SUM(CASE
      WHEN item_type IN ('room_fee','cleaning_fee','extra_charge') THEN gross_amount
      WHEN item_type = 'discount' THEN -gross_amount ELSE 0 END)
      FROM booking_line_items b WHERE b.stay_id = s.stay_id),0),2) AS ledger_gross,
    ROUND(COALESCE((SELECT SUM(CASE
      WHEN item_type = 'channel_commission' THEN gross_amount ELSE 0 END)
      FROM booking_line_items b WHERE b.stay_id = s.stay_id),0),2) AS ledger_commission
  FROM stays s
  WHERE s.status NOT IN ('cancelled','void')
)
SELECT COUNT(*) AS stays_in_scope,
  SUM(CASE WHEN ABS(stored_gross - ledger_gross) <= 0.01
            AND ABS(stored_commission - ledger_commission) <= 0.01
            AND ABS(stored_net - (ledger_gross - ledger_commission)) <= 0.01
           THEN 1 ELSE 0 END) AS rollup_ok,
  SUM(CASE WHEN ABS(stored_gross - ledger_gross) > 0.01
            OR ABS(stored_commission - ledger_commission) > 0.01
            OR ABS(stored_net - (ledger_gross - ledger_commission)) > 0.01
           THEN 1 ELSE 0 END) AS diff_rows
FROM roll;

-- B) Any remaining mismatches, listed (expect 0 rows)
WITH roll AS (
  SELECT s.stay_id, s.guest_name,
    ROUND(COALESCE(s.gross,0),2)          AS stored_gross,
    ROUND(COALESCE(s.commission_amt,0),2) AS stored_commission,
    ROUND(COALESCE(s.net,0),2)            AS stored_net,
    ROUND(COALESCE((SELECT SUM(CASE
      WHEN item_type IN ('room_fee','cleaning_fee','extra_charge') THEN gross_amount
      WHEN item_type = 'discount' THEN -gross_amount ELSE 0 END)
      FROM booking_line_items b WHERE b.stay_id = s.stay_id),0),2) AS ledger_gross,
    ROUND(COALESCE((SELECT SUM(CASE
      WHEN item_type = 'channel_commission' THEN gross_amount ELSE 0 END)
      FROM booking_line_items b WHERE b.stay_id = s.stay_id),0),2) AS ledger_commission
  FROM stays s
  WHERE s.status NOT IN ('cancelled','void')
)
SELECT * FROM roll
WHERE ABS(stored_gross - ledger_gross) > 0.01
   OR ABS(stored_commission - ledger_commission) > 0.01
   OR ABS(stored_net - (ledger_gross - ledger_commission)) > 0.01;

-- C) The two corrected stays — eyeball the new values
SELECT stay_id, guest_name, gross, commission_amt, net, updated_by, updated_at
FROM stays WHERE stay_id IN ('DWK-2026-22309','DWK-2026-8793');

-- D) Invariant net = gross - commission across all in-scope stays (expect 0)
SELECT COUNT(*) AS invariant_violations
FROM stays
WHERE status NOT IN ('cancelled','void')
  AND ABS(ROUND(COALESCE(net,0),2) -
          (ROUND(COALESCE(gross,0),2) - ROUND(COALESCE(commission_amt,0),2))) > 0.01;

-- E) Ledger line counts by item_type (sanity: room_fee ~293, no zero-amount rows)
SELECT item_type, direction, COUNT(*) AS lines,
       ROUND(SUM(gross_amount),2) AS total_amount
FROM booking_line_items
GROUP BY item_type, direction
ORDER BY item_type;
