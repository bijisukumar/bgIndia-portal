-- ============================================================
--  BGIndiaDB-Estates — D1 Schema
--  Run: npx wrangler d1 execute BGIndiaDB-Estates --file=schema-estates.sql --remote
--
--  Tables: coconut_harvests, rubber_harvests, estate_transactions
--  Covers: Pollachi (coconut) and Pavutumuri (rubber) estates
--  Access: owner, pradosh, raman (estate role only)
-- ============================================================

-- ── COCONUT HARVESTS (Pollachi) ───────────────────────────
CREATE TABLE IF NOT EXISTS coconut_harvests (
  harvest_id             TEXT PRIMARY KEY,
  estate_id              TEXT DEFAULT 'pollachi',
  harvester_name         TEXT,
  harvest_date           TEXT,
  final_payment_date     TEXT,
  total_nuts             INTEGER DEFAULT 0,
  net_good_nuts          INTEGER DEFAULT 0,
  nuts_rejected          INTEGER DEFAULT 0,
  additional_unaccounted INTEGER DEFAULT 0,
  total_weight_kg        REAL DEFAULT 0,
  price_per_kg           REAL DEFAULT 0,
  avg_weight_per_nut     REAL DEFAULT 0,
  earnings_main          REAL DEFAULT 0,
  nuts_rejected_b2       INTEGER DEFAULT 0,
  rejection_revenue      REAL DEFAULT 0,
  husk_count_sold        INTEGER DEFAULT 0,
  husk_cost_per_nut      REAL DEFAULT 0,
  husk_earnings          REAL DEFAULT 0,
  other_earnings         REAL DEFAULT 0,
  total_earnings         REAL DEFAULT 0,
  harvest_nuts           INTEGER DEFAULT 0,
  harvest_cost_nut       REAL DEFAULT 0,
  harvest_expense        REAL DEFAULT 0,
  dehusk_nuts            INTEGER DEFAULT 0,
  dehusk_cost_nut        REAL DEFAULT 0,
  dehusk_expense         REAL DEFAULT 0,
  tractor_expense        REAL DEFAULT 0,
  other_expense          REAL DEFAULT 0,
  total_expense          REAL DEFAULT 0,
  net_income             REAL DEFAULT 0,
  advance_payment        REAL DEFAULT 0,
  advance_date           TEXT,
  second_payment         REAL DEFAULT 0,
  final_settlement       REAL DEFAULT 0,
  balance_due            REAL DEFAULT 0,
  next_harvest_date      TEXT,             -- actual date of the next harvest (filled after it happens)
  scheduled_harvest_date TEXT,             -- harvest_date + 45 days (auto-calculated on save)
  notes                  TEXT,
  created_by  TEXT DEFAULT 'pradosh',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'pradosh',
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── RUBBER HARVESTS (Pavutumuri) ──────────────────────────
CREATE TABLE IF NOT EXISTS rubber_harvests (
  harvest_id   TEXT PRIMARY KEY,
  estate_id    TEXT DEFAULT 'pavutumuri',
  harvest_date TEXT,
  weight_kg    REAL DEFAULT 0,
  price_per_kg REAL DEFAULT 0,
  gross        REAL DEFAULT 0,
  expense      REAL DEFAULT 0,
  net          REAL DEFAULT 0,
  notes        TEXT,
  created_by  TEXT DEFAULT 'raman',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'raman',
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── ESTATE INCOME / EXPENSE LEDGER ───────────────────────
CREATE TABLE IF NOT EXISTS estate_transactions (
  txn_id      TEXT PRIMARY KEY,
  estate      TEXT NOT NULL,    -- 'pollachi' | 'pavutumuri'
  type        TEXT NOT NULL,    -- 'income' | 'expense'
  date        TEXT NOT NULL,
  category    TEXT NOT NULL,
  amount      REAL NOT NULL,
  paid_to     TEXT,
  description TEXT,
  created_by  TEXT DEFAULT 'pradosh',
  updated_by  TEXT DEFAULT 'pradosh',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coconut_date      ON coconut_harvests(harvest_date);
CREATE INDEX IF NOT EXISTS idx_coconut_estate    ON coconut_harvests(estate_id, harvest_date);
CREATE INDEX IF NOT EXISTS idx_rubber_date       ON rubber_harvests(harvest_date);
CREATE INDEX IF NOT EXISTS idx_rubber_estate     ON rubber_harvests(estate_id, harvest_date);
CREATE INDEX IF NOT EXISTS idx_estate_txn_date   ON estate_transactions(estate, date DESC);
CREATE INDEX IF NOT EXISTS idx_estate_txn_type   ON estate_transactions(estate, type, date DESC);

-- Verify
SELECT 'BGIndiaDB-Estates schema ready' as status;
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Irrigation log timestamps (tracks when Pradosh submits irrigation data)
-- Since the actual form is Google Forms, we record the tap/submit event here
CREATE TABLE IF NOT EXISTS irrigation_logs (
  log_id      TEXT PRIMARY KEY,
  estate      TEXT DEFAULT 'pollachi',
  logged_date TEXT NOT NULL,   -- YYYY-MM-DD when Pradosh logged irrigation
  notes       TEXT,
  created_by  TEXT DEFAULT 'pradosh',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_irrigation_date ON irrigation_logs(estate, logged_date DESC);
