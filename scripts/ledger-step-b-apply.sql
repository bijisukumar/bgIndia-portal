-- ============================================================================
-- LEDGER STEP B — APPLY (BACKFILL WRITES)
-- ============================================================================
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/ledger-step-b-apply.sql --remote
-- Then verify (read-only): scripts/ledger-step-b-verify.sql
--
-- Preconditions (all met, verified 2026-07-06 via ledger-step-b-dryrun-preview):
--   * Step A tables exist (scripts/ledger-step-a-create-tables.sql)
--   * Dry-run on live D1: 293 stays in scope, 291 reconcile OK, 2 expected
--     DIFFs (DWK-2026-22309 Gulshan +11,604.55; DWK-2026-8793 Gowtham +3,820)
--     — both confirmed as real directly-collected extras (floor bed,
--     extended checkout) that stored gross/net never included. Per spec v2
--     Sec-6 ("extras count as villa gross revenue") the roll-up update below
--     CORRECTS those two stays upward. 0 negative extra_charges rows exist.
--
-- Safety properties:
--   * IDEMPOTENT: line_id = stay_id || ':' || item_type, INSERT OR IGNORE —
--     re-running can never duplicate lines.
--   * Decode identical to the validated dry-run (same CASE logic).
--   * ROUND(x, 2) on every written amount (spec v2 Sec-4).
--   * Scope: status NOT IN ('cancelled','void').
--   * Roll-up UPDATE only touches stays that actually have ledger lines.
-- ============================================================================

-- 1) room_fee (inflow) — night_fee when present, else derived from gross
INSERT OR IGNORE INTO booking_line_items
  (line_id, stay_id, villa_id, item_type, direction, gross_amount, tax_amount, note)
SELECT
  stay_id || ':room_fee', stay_id, villa_id, 'room_fee', 'inflow',
  ROUND(CASE
    WHEN COALESCE(night_fee,0) > 0 THEN night_fee
    ELSE COALESCE(gross,0) - COALESCE(cleaning_fee,0) - COALESCE(extra_charges,0)
  END, 2),
  0,
  'backfill:B ' || CASE WHEN COALESCE(night_fee,0) > 0
                        THEN 'from night_fee' ELSE 'derived from gross' END
FROM stays
WHERE status NOT IN ('cancelled','void')
  AND ROUND(CASE
        WHEN COALESCE(night_fee,0) > 0 THEN night_fee
        ELSE COALESCE(gross,0) - COALESCE(cleaning_fee,0) - COALESCE(extra_charges,0)
      END, 2) != 0;

-- 2) cleaning_fee (inflow)
INSERT OR IGNORE INTO booking_line_items
  (line_id, stay_id, villa_id, item_type, direction, gross_amount, tax_amount, note)
SELECT stay_id || ':cleaning_fee', stay_id, villa_id, 'cleaning_fee', 'inflow',
       ROUND(cleaning_fee, 2), 0, 'backfill:B'
FROM stays
WHERE status NOT IN ('cancelled','void') AND COALESCE(cleaning_fee,0) > 0;

-- 3) extra_charge (inflow) — positive extra_charges only
INSERT OR IGNORE INTO booking_line_items
  (line_id, stay_id, villa_id, item_type, direction, gross_amount, tax_amount, note)
SELECT stay_id || ':extra_charge', stay_id, villa_id, 'extra_charge', 'inflow',
       ROUND(extra_charges, 2), 0, 'backfill:B'
FROM stays
WHERE status NOT IN ('cancelled','void') AND COALESCE(extra_charges,0) > 0;

-- 4) discount (outflow) — negative extra_charges reclassified positive.
--    Dry-run found 0 such rows today; rule kept for completeness/idempotent
--    re-runs on future data.
INSERT OR IGNORE INTO booking_line_items
  (line_id, stay_id, villa_id, item_type, direction, gross_amount, tax_amount, note)
SELECT stay_id || ':discount', stay_id, villa_id, 'discount', 'outflow',
       ROUND(ABS(extra_charges), 2), 0, 'backfill:B reclassified from negative extra_charges'
FROM stays
WHERE status NOT IN ('cancelled','void') AND COALESCE(extra_charges,0) < 0;

-- 5) channel_commission (outflow)
INSERT OR IGNORE INTO booking_line_items
  (line_id, stay_id, villa_id, item_type, direction, gross_amount, tax_amount, note)
SELECT stay_id || ':channel_commission', stay_id, villa_id, 'channel_commission', 'outflow',
       ROUND(commission_amt, 2), 0, 'backfill:B'
FROM stays
WHERE status NOT IN ('cancelled','void') AND COALESCE(commission_amt,0) > 0;

-- 6) guest_service_fee (passthrough — excluded from P&L roll-up)
INSERT OR IGNORE INTO booking_line_items
  (line_id, stay_id, villa_id, item_type, direction, gross_amount, tax_amount, note)
SELECT stay_id || ':guest_service_fee', stay_id, villa_id, 'guest_service_fee', 'passthrough',
       ROUND(guest_service_fee, 2), 0, 'backfill:B'
FROM stays
WHERE status NOT IN ('cancelled','void') AND COALESCE(guest_service_fee,0) > 0;

-- 7) Roll-up: stays.gross / commission_amt / net computed FROM the ledger
--    (item_type-explicit, spec v2 Sec-4). No-op where ledger == stored;
--    corrects DWK-2026-22309 (+11,604.55) and DWK-2026-8793 (+3,820).
UPDATE stays SET
  gross = ROUND((
    SELECT COALESCE(SUM(CASE
      WHEN item_type IN ('room_fee','cleaning_fee','extra_charge') THEN gross_amount
      WHEN item_type = 'discount' THEN -gross_amount
      ELSE 0 END), 0)
    FROM booking_line_items b WHERE b.stay_id = stays.stay_id
  ), 2),
  commission_amt = ROUND((
    SELECT COALESCE(SUM(CASE
      WHEN item_type = 'channel_commission' THEN gross_amount ELSE 0 END), 0)
    FROM booking_line_items b WHERE b.stay_id = stays.stay_id
  ), 2),
  net = ROUND((
    SELECT COALESCE(SUM(CASE
      WHEN item_type IN ('room_fee','cleaning_fee','extra_charge') THEN gross_amount
      WHEN item_type = 'discount' THEN -gross_amount
      WHEN item_type = 'channel_commission' THEN -gross_amount
      ELSE 0 END), 0)
    FROM booking_line_items b WHERE b.stay_id = stays.stay_id
  ), 2),
  updated_by = 'system',
  updated_at = datetime('now')
WHERE status NOT IN ('cancelled','void')
  AND EXISTS (SELECT 1 FROM booking_line_items b WHERE b.stay_id = stays.stay_id);
