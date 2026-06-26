-- Migration: create rent_transactions — monthly rent ledger for Rev360
--
-- Backs the Quick-Post Billing feature on the Tenant Agreement screen:
--   - "Paid on Time" button: one-click insert using the agreement's own
--     agreed_rent + maintenance_fee, late_fee = 0, paid_date = today.
--   - "Post Late / Exception" drawer: same insert, but with a non-zero
--     late_fee and a manually-picked paid_date.
--
-- Distinct from existing tables:
--   - lease_losses / claims (ClaimsLedger.jsx) tracks damage/loss claims,
--     NOT routine monthly rent collection — a different domain entirely.
--   - estate_transactions (Pollachi/Pavutumuri) is unrelated farm-estate
--     income/expense, not rental property rent.
-- Confirmed via direct schema search (2026-06-26) that no rent-payment
-- ledger existed anywhere in this database before this migration.
--
-- Run via D1 Admin / D1 console. Plain sequential statements.

CREATE TABLE IF NOT EXISTS rent_transactions (
  txn_id        TEXT PRIMARY KEY,
  prop_id       TEXT NOT NULL,
  period_month  TEXT NOT NULL,   -- 'YYYY-MM' — the rent period this payment covers
  base_rent     REAL NOT NULL DEFAULT 0,
  maintenance   REAL NOT NULL DEFAULT 0,
  late_fee      REAL NOT NULL DEFAULT 0,
  total_due     REAL NOT NULL DEFAULT 0,   -- base_rent + maintenance + late_fee, stored (not recomputed) so historical rows are immune to later CONFIG changes
  is_exception  INTEGER NOT NULL DEFAULT 0, -- 0 = standard "Paid on Time" click, 1 = late-fee exception path
  paid_date     TEXT NOT NULL,    -- date actually received, YYYY-MM-DD
  currency      TEXT NOT NULL DEFAULT 'INR',
  notes         TEXT,
  created_by    TEXT DEFAULT 'owner',
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rent_txn_prop   ON rent_transactions(prop_id, period_month);
CREATE INDEX IF NOT EXISTS idx_rent_txn_period ON rent_transactions(period_month);

-- One payment posted per property per period — prevents an accidental
-- double-click on "Paid on Time" (or a late-fee save right after it)
-- from creating two rows for the same month.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rent_txn_unique_period ON rent_transactions(prop_id, period_month);

-- Verify after running:
-- SELECT name FROM sqlite_master WHERE type='table' AND name='rent_transactions';
-- PRAGMA table_info(rent_transactions);
