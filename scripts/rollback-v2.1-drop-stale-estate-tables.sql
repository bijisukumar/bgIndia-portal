-- ============================================================================
-- ROLLBACK — RELEASE 2.1 — DROP STALE ESTATE TABLE COPIES
-- ============================================================================
-- Recreates the 5 tables EMPTY, with their original (pre-2.1, un-prefixed)
-- schema. This does NOT restore any rows — the forward migration only ever
-- runs after confirming these were 0 rows, so there should be nothing to
-- restore. If that safety check was skipped and rows existed, this rollback
-- is insufficient and a D1 point-in-time restore is the real recovery path.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/rollback-v2.1-drop-stale-estate-tables.sql --remote
-- ============================================================================

CREATE TABLE IF NOT EXISTS coconut_harvests (
  harvest_id TEXT PRIMARY KEY,
  estate_id TEXT DEFAULT 'pollachi',
  harvest_date TEXT NOT NULL,
  nut_count INTEGER DEFAULT 0,
  notes TEXT,
  created_by TEXT DEFAULT 'owner',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_harvests_date ON coconut_harvests(harvest_date);

CREATE TABLE IF NOT EXISTS estate_transactions (
  txn_id TEXT PRIMARY KEY,
  estate TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_by TEXT DEFAULT 'owner',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_estate_txn_estate_date ON estate_transactions(estate, date DESC);
CREATE INDEX IF NOT EXISTS idx_estate_txn_type ON estate_transactions(estate, type, date DESC);

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

CREATE TABLE IF NOT EXISTS rubber_harvests (
  harvest_id TEXT PRIMARY KEY,
  estate_id TEXT DEFAULT 'pavutumuri',
  harvest_date TEXT NOT NULL,
  notes TEXT,
  created_by TEXT DEFAULT 'owner',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rubber_date ON rubber_harvests(harvest_date);
CREATE INDEX IF NOT EXISTS idx_rubber_estate ON rubber_harvests(estate_id, harvest_date);

CREATE TABLE IF NOT EXISTS rubber_production (
  prod_id       TEXT PRIMARY KEY,
  estate_id     TEXT DEFAULT 'pavutumuri',
  worker_name   TEXT NOT NULL,
  prod_date     TEXT NOT NULL,
  tree_count    INTEGER DEFAULT 0,
  sheet_count   INTEGER DEFAULT 0,
  ottupal_count INTEGER DEFAULT 0,
  block         TEXT,
  rain          INTEGER DEFAULT 0,
  tapping_rate  REAL DEFAULT 0,
  notes         TEXT,
  created_by    TEXT DEFAULT 'raman',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_by    TEXT DEFAULT 'raman',
  updated_at    TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rubber_prod_unique ON rubber_production(estate_id, worker_name, prod_date);
CREATE INDEX IF NOT EXISTS idx_rubber_prod_date ON rubber_production(estate_id, prod_date DESC);

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT name FROM sqlite_master WHERE type='table'
  AND name IN ('coconut_harvests','estate_transactions','manager_settlements','rubber_harvests','rubber_production')
  ORDER BY name;
