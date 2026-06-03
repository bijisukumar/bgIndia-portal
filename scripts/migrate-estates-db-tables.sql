-- ============================================================
-- Run in D1 console: bgindiadb-estates (estates DB)
-- Creates missing tables that the estate360 app needs
-- ============================================================

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
  next_harvest_date      TEXT,
  scheduled_harvest_date TEXT,
  notes                  TEXT,
  created_by  TEXT DEFAULT 'system',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'system',
  updated_at  TEXT DEFAULT (datetime('now'))
);

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
  created_by  TEXT DEFAULT 'system',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'system',
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estate_transactions (
  txn_id      TEXT PRIMARY KEY,
  estate      TEXT NOT NULL,
  type        TEXT NOT NULL,
  date        TEXT NOT NULL,
  category    TEXT NOT NULL,
  amount      REAL NOT NULL,
  notes       TEXT,
  created_by  TEXT DEFAULT 'system',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS irrigation_logs (
  log_id      TEXT PRIMARY KEY,
  estate      TEXT DEFAULT 'pollachi',
  logged_date TEXT NOT NULL,
  notes       TEXT,
  created_by  TEXT DEFAULT 'system',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_coconut_estate   ON coconut_harvests(estate_id, harvest_date DESC);
CREATE INDEX IF NOT EXISTS idx_rubber_estate    ON rubber_harvests(estate_id, harvest_date DESC);
CREATE INDEX IF NOT EXISTS idx_estate_txn       ON estate_transactions(estate, date DESC);
CREATE INDEX IF NOT EXISTS idx_irrigation_date  ON irrigation_logs(estate, logged_date DESC);
