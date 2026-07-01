-- ============================================================
--  Rubber Tracker realign + Manager (Madhavan) settlement
--  Run against the ESTATES D1:
--    npx wrangler d1 execute bgindiadb-estates --file=scripts/migrate-rubber-realign.sql --remote
--
--  Adds two tables. Non-destructive — existing rubber_harvests,
--  estate_transactions, coconut_harvests are untouched.
-- ============================================================

-- ── DAILY RUBBER PRODUCTION (physical counts, per worker per day) ──
-- Replaces the latex/tapper harvest model for day-to-day entry.
-- Money is NOT recorded here — sales go through estate_transactions
-- (Income: Rubber Sheet / Ottupal / Coconut).
CREATE TABLE IF NOT EXISTS rubber_production (
  prod_id       TEXT PRIMARY KEY,
  estate_id     TEXT DEFAULT 'pavutumuri',
  worker_name   TEXT NOT NULL,
  prod_date     TEXT NOT NULL,            -- YYYY-MM-DD
  tree_count    INTEGER DEFAULT 0,        -- trees tapped that day (pay basis)
  sheet_count   INTEGER DEFAULT 0,        -- Rubber Sheet count
  ottupal_count INTEGER DEFAULT 0,        -- Ottupal (Otupallu) count
  notes         TEXT,
  created_by    TEXT DEFAULT 'raman',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_by    TEXT DEFAULT 'raman',
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- One row per worker per day — lets a whole week upsert safely on re-save.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rubber_prod_unique
  ON rubber_production(estate_id, worker_name, prod_date);
CREATE INDEX IF NOT EXISTS idx_rubber_prod_date
  ON rubber_production(estate_id, prod_date DESC);

-- ── MANAGER SETTLEMENTS (Raman → Madhavan payments) ──
-- Each row is one payment Raman sends the manager against the
-- estate's expenses. Balance owed = SUM(expenses) − SUM(payments),
-- carried forward across months.
CREATE TABLE IF NOT EXISTS manager_settlements (
  settlement_id TEXT PRIMARY KEY,
  estate_id     TEXT DEFAULT 'pavutumuri',
  manager_name  TEXT DEFAULT 'Madhavan',  -- who is owed / receives the money
  payer_name    TEXT DEFAULT 'Raman',     -- who sends the money
  payment_date  TEXT NOT NULL,            -- YYYY-MM-DD
  amount        REAL NOT NULL,
  method        TEXT DEFAULT 'cash',      -- cash | bank | upi | other
  note          TEXT,
  created_by    TEXT DEFAULT 'raman',
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mgr_settle_estate_date
  ON manager_settlements(estate_id, payment_date DESC);

-- Verify
SELECT 'rubber realign migration ready' AS status;
SELECT name FROM sqlite_master WHERE type='table'
  AND name IN ('rubber_production','manager_settlements') ORDER BY name;
