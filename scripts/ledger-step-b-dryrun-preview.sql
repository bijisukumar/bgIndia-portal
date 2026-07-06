-- ============================================================================
-- LEDGER STEP B — DRY-RUN PREVIEW (READ-ONLY, NO WRITES)
-- ============================================================================
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/ledger-step-b-dryrun-preview.sql --remote
--   (or paste each query into the SQL console individually)
--
-- Purpose: show exactly what booking_line_items the backfill WOULD create
-- for each stay, and prove the roll-up reproduces stored gross/commission/net,
-- BEFORE any INSERT runs. Nothing here writes.
--
-- Decode rules (spec v2, §4 — approved):
--   room_fee            <- night_fee when present (Airbnb-authoritative),
--                          else gross - cleaning_fee - extra_charges (derived)
--   cleaning_fee        <- cleaning_fee (inflow, if > 0)
--   extra_charge        <- extra_charges when POSITIVE (inflow)
--   discount            <- ABS(extra_charges) when NEGATIVE (outflow)
--                          *** surfaced explicitly as NEEDS-CONFIRM, never
--                          *** silently summed into gross
--   channel_commission  <- commission_amt (outflow)
--   guest_service_fee   <- guest_service_fee (passthrough; excluded from P&L)
--   guest_tax           <- no historical column; backfills as 0 (tax_amount
--                          column ships now, populated when Booking.com lands)
--
-- Roll-up (item_type-explicit):
--   gross      = SUM(room_fee + cleaning_fee + extra_charge) - SUM(discount)
--   commission = SUM(channel_commission)
--   net        = gross - commission
--   All amounts ROUND(x, 2) — mirrors Math.round(x*100)/100 on the JS write path.
--
-- Scope: status NOT IN ('cancelled','void') — same exclusion as backfill.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- QUERY 1 — Representative stays, exploded into the exact candidate line items
--   * Gulshan DWK-2026-22309 (direct + extras)
--   * Mithuna (clean Airbnb decomposition)
--   * every row with negative extra_charges (candidate `discount`, NEEDS-CONFIRM)
-- NOTE: built with json_each slots instead of UNION ALL — D1 caps
-- SQLITE_MAX_COMPOUND_SELECT well below stock SQLite.
-- ----------------------------------------------------------------------------
WITH base AS (
  SELECT
    stay_id, villa_id, guest_name, source, status,
    ROUND(COALESCE(gross,0), 2)            AS gross,
    ROUND(COALESCE(commission_amt,0), 2)   AS commission_amt,
    ROUND(COALESCE(net,0), 2)              AS net,
    ROUND(COALESCE(extra_charges,0), 2)    AS extra_charges,
    ROUND(COALESCE(cleaning_fee,0), 2)     AS cleaning_fee,
    ROUND(COALESCE(night_fee,0), 2)        AS night_fee,
    ROUND(COALESCE(guest_service_fee,0),2) AS guest_service_fee,
    ROUND(CASE
      WHEN COALESCE(night_fee,0) > 0 THEN night_fee
      ELSE COALESCE(gross,0) - COALESCE(cleaning_fee,0) - COALESCE(extra_charges,0)
    END, 2) AS room_fee_calc
  FROM stays
  WHERE status NOT IN ('cancelled','void')
    AND (
      stay_id = 'DWK-2026-22309'            -- Gulshan: direct + extras
      OR guest_name LIKE '%Mithuna%'         -- clean Airbnb
      OR COALESCE(extra_charges,0) < 0       -- every negative-extras row
    )
),
slots AS (SELECT CAST(value AS INTEGER) AS ord FROM json_each('[1,2,3,4,5,6]'))
SELECT
  b.stay_id, b.guest_name, b.source,
  CASE s.ord
    WHEN 1 THEN 'room_fee'
    WHEN 2 THEN 'cleaning_fee'
    WHEN 3 THEN 'extra_charge'
    WHEN 4 THEN 'discount'
    WHEN 5 THEN 'channel_commission'
    WHEN 6 THEN 'guest_service_fee'
  END AS item_type,
  CASE s.ord
    WHEN 1 THEN 'inflow' WHEN 2 THEN 'inflow' WHEN 3 THEN 'inflow'
    WHEN 4 THEN 'outflow' WHEN 5 THEN 'outflow'
    WHEN 6 THEN 'passthrough'
  END AS direction,
  CASE s.ord
    WHEN 1 THEN b.room_fee_calc
    WHEN 2 THEN b.cleaning_fee
    WHEN 3 THEN b.extra_charges
    WHEN 4 THEN ROUND(ABS(b.extra_charges), 2)
    WHEN 5 THEN b.commission_amt
    WHEN 6 THEN b.guest_service_fee
  END AS gross_amount,
  0 AS tax_amount,
  CASE s.ord
    WHEN 1 THEN CASE WHEN b.night_fee > 0 THEN 'from night_fee' ELSE 'derived' END
    WHEN 4 THEN '*** NEEDS-CONFIRM: negative extra_charges reclassified ***'
    WHEN 6 THEN 'excluded from P&L'
    ELSE ''
  END AS flag
FROM base b
CROSS JOIN slots s
WHERE (s.ord = 1 AND b.room_fee_calc != 0)
   OR (s.ord = 2 AND b.cleaning_fee > 0)
   OR (s.ord = 3 AND b.extra_charges > 0)
   OR (s.ord = 4 AND b.extra_charges < 0)
   OR (s.ord = 5 AND b.commission_amt > 0)
   OR (s.ord = 6 AND b.guest_service_fee > 0)
ORDER BY b.stay_id, s.ord;


-- ----------------------------------------------------------------------------
-- QUERY 2 — Roll-up reconciliation for those same representative stays:
--   ledger-computed gross/commission/net vs stored columns, with delta + flag.
-- ----------------------------------------------------------------------------
WITH base AS (
  SELECT
    stay_id, guest_name, source,
    ROUND(COALESCE(gross,0), 2)          AS stored_gross,
    ROUND(COALESCE(commission_amt,0), 2) AS stored_commission,
    ROUND(COALESCE(net,0), 2)            AS stored_net,
    ROUND(COALESCE(extra_charges,0), 2)  AS ec,
    ROUND(COALESCE(cleaning_fee,0), 2)   AS cf,
    ROUND(CASE
      WHEN COALESCE(night_fee,0) > 0 THEN night_fee
      ELSE COALESCE(gross,0) - COALESCE(cleaning_fee,0) - COALESCE(extra_charges,0)
    END, 2) AS rf
  FROM stays
  WHERE status NOT IN ('cancelled','void')
    AND (stay_id = 'DWK-2026-22309'
         OR guest_name LIKE '%Mithuna%'
         OR COALESCE(extra_charges,0) < 0)
)
SELECT
  stay_id, guest_name, source,
  ROUND(rf + cf + MAX(ec,0) - MAX(-ec,0), 2)                     AS ledger_gross,
  stored_gross,
  ROUND(stored_commission, 2)                                    AS ledger_commission,
  ROUND(rf + cf + MAX(ec,0) - MAX(-ec,0) - stored_commission, 2) AS ledger_net,
  stored_net,
  ROUND(rf + cf + MAX(ec,0) - MAX(-ec,0) - stored_gross, 2)      AS gross_delta,
  ROUND((rf + cf + MAX(ec,0) - MAX(-ec,0) - stored_commission) - stored_net, 2) AS net_delta,
  CASE
    WHEN ABS(rf + cf + MAX(ec,0) - MAX(-ec,0) - stored_gross) <= 1
     AND ABS((rf + cf + MAX(ec,0) - MAX(-ec,0) - stored_commission) - stored_net) <= 1
    THEN 'OK'
    ELSE '*** DIFF — review before backfill ***'
  END AS reconcile
FROM base
ORDER BY reconcile DESC, stay_id;


-- ----------------------------------------------------------------------------
-- QUERY 3 — Full-table reconciliation summary (every in-scope stay).
--   Counts how many rows round-trip cleanly and lists every DIFF row.
--   Backfill (Step B writes) should not run until DIFF count is understood.
-- ----------------------------------------------------------------------------
WITH base AS (
  SELECT
    stay_id, guest_name, source,
    ROUND(COALESCE(gross,0), 2)          AS stored_gross,
    ROUND(COALESCE(commission_amt,0), 2) AS stored_commission,
    ROUND(COALESCE(net,0), 2)            AS stored_net,
    ROUND(COALESCE(extra_charges,0), 2)  AS ec,
    ROUND(COALESCE(cleaning_fee,0), 2)   AS cf,
    ROUND(CASE
      WHEN COALESCE(night_fee,0) > 0 THEN night_fee
      ELSE COALESCE(gross,0) - COALESCE(cleaning_fee,0) - COALESCE(extra_charges,0)
    END, 2) AS rf
  FROM stays
  WHERE status NOT IN ('cancelled','void')
),
calc AS (
  SELECT *,
    ROUND(rf + cf + MAX(ec,0) - MAX(-ec,0), 2) AS ledger_gross,
    ROUND(rf + cf + MAX(ec,0) - MAX(-ec,0) - stored_commission, 2) AS ledger_net
  FROM base
)
SELECT
  COUNT(*)                                                        AS stays_in_scope,
  SUM(CASE WHEN ABS(ledger_gross - stored_gross) <= 1
            AND ABS(ledger_net - stored_net) <= 1 THEN 1 ELSE 0 END) AS reconcile_ok,
  SUM(CASE WHEN ABS(ledger_gross - stored_gross) > 1
            OR ABS(ledger_net - stored_net) > 1 THEN 1 ELSE 0 END)   AS reconcile_diff,
  SUM(CASE WHEN ec < 0 THEN 1 ELSE 0 END)                            AS negative_extras_rows
FROM calc;

-- List every DIFF row for review:
WITH base AS (
  SELECT
    stay_id, guest_name, source, checkin_date,
    ROUND(COALESCE(gross,0), 2)          AS stored_gross,
    ROUND(COALESCE(commission_amt,0), 2) AS stored_commission,
    ROUND(COALESCE(net,0), 2)            AS stored_net,
    ROUND(COALESCE(extra_charges,0), 2)  AS ec,
    ROUND(COALESCE(cleaning_fee,0), 2)   AS cf,
    ROUND(CASE
      WHEN COALESCE(night_fee,0) > 0 THEN night_fee
      ELSE COALESCE(gross,0) - COALESCE(cleaning_fee,0) - COALESCE(extra_charges,0)
    END, 2) AS rf
  FROM stays
  WHERE status NOT IN ('cancelled','void')
),
calc AS (
  SELECT *,
    ROUND(rf + cf + MAX(ec,0) - MAX(-ec,0), 2) AS ledger_gross,
    ROUND(rf + cf + MAX(ec,0) - MAX(-ec,0) - stored_commission, 2) AS ledger_net
  FROM base
)
SELECT stay_id, guest_name, source, checkin_date,
       ledger_gross, stored_gross,
       ROUND(ledger_gross - stored_gross, 2) AS gross_delta,
       ledger_net, stored_net,
       ROUND(ledger_net - stored_net, 2)     AS net_delta
FROM calc
WHERE ABS(ledger_gross - stored_gross) > 1
   OR ABS(ledger_net - stored_net) > 1
ORDER BY ABS(ledger_gross - stored_gross) DESC;
