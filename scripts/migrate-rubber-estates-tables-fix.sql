-- ============================================================================
-- FIX: rubber_production + manager_settlements were never created in the
-- ESTATES database. Both actions (saveRubberProduction, saveManagerSettlement,
-- etc.) route through ActiveDB -> DB_ESTATES for these action names
-- (functions/api/[[route]].js ESTATE_ACTIONS set), but the tables only ever
-- existed in bgindia-db (stale, 0 rows -- confirmed empty, nothing to
-- backfill). scripts/migrate-rubber-register.sql assumed the base table
-- already existed in the estates DB and only ALTERed it -- it doesn't, and
-- that script's own header also has a typo'd DB name (bgindia-estates-db,
-- which doesn't exist; the real one is bgindiadb-estates). This script
-- supersedes it: creates both tables with their FINAL schema (base columns +
-- the block/rain/tapping_rate register-parity columns) directly.
--
-- Run: npx wrangler d1 execute bgindiadb-estates --file=scripts/migrate-rubber-estates-tables-fix.sql --remote
-- ============================================================================

CREATE TABLE IF NOT EXISTS rubber_production (
  prod_id       TEXT PRIMARY KEY,
  estate_id     TEXT DEFAULT 'pavutumuri',
  worker_name   TEXT NOT NULL,
  prod_date     TEXT NOT NULL,
  tree_count    INTEGER DEFAULT 0,        -- trees tapped that day (pay basis)
  sheet_count   INTEGER DEFAULT 0,
  ottupal_count INTEGER DEFAULT 0,
  block         TEXT,                     -- 'A' | 'B' | 'AB' | NULL
  rain          INTEGER DEFAULT 0,        -- 1 = rain-affected, no tapping
  tapping_rate  REAL DEFAULT 0,           -- Rs per tree, e.g. 2.75 (stamped per row, rate changes over time)
  notes         TEXT,
  created_by    TEXT DEFAULT 'raman',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_by    TEXT DEFAULT 'raman',
  updated_at    TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rubber_prod_unique ON rubber_production(estate_id, worker_name, prod_date);
CREATE INDEX IF NOT EXISTS idx_rubber_prod_date ON rubber_production(estate_id, prod_date DESC);

CREATE TABLE IF NOT EXISTS manager_settlements (
  settlement_id TEXT PRIMARY KEY,
  estate_id     TEXT DEFAULT 'pavutumuri',
  manager_name  TEXT DEFAULT 'Madhavan',
  payer_name    TEXT DEFAULT 'Raman',
  payment_date  TEXT NOT NULL,
  amount        REAL NOT NULL,
  method        TEXT DEFAULT 'cash',
  note          TEXT,
  created_by    TEXT DEFAULT 'raman',
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mgr_settle_estate_date ON manager_settlements(estate_id, payment_date DESC);

-- Verify after running:
SELECT name FROM sqlite_master WHERE type='table'
  AND name IN ('rubber_production','manager_settlements') ORDER BY name;
PRAGMA table_info(rubber_production);
PRAGMA table_info(manager_settlements);
