-- ============================================================
-- bgIndia Portal — Cloudflare D1 Schema (SQLite), bgindiadb-estates
-- Deploy: wrangler d1 execute bgindiadb-estates --file=schema-estates.sql --remote
--
-- RELEASE 2.1: all tables carry the estate360_ prefix. rubber_production
-- and manager_settlements were fixed into this DB 2026-07-09 (they existed
-- only as stale, 0-row copies in bgindia-db before that; ActiveDB routing
-- in the worker already targeted this DB for these two).
--
-- This file was regenerated from the live production schema (2026-07)
-- rather than hand-maintained — see schema.sql's header for the same note.
-- ============================================================

CREATE TABLE IF NOT EXISTS estate360_coconut_harvests (
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
  notes                  TEXT,
  created_by  TEXT DEFAULT 'pradosh',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'pradosh',
  updated_at  TEXT DEFAULT (datetime('now'))
, scheduled_harvest_date TEXT);

CREATE TABLE IF NOT EXISTS estate360_mango_harvests (
  harvest_id      TEXT PRIMARY KEY,
  estate          TEXT NOT NULL DEFAULT 'pollachi',
  harvest_date    TEXT NOT NULL,
  box_type        TEXT NOT NULL CHECK(box_type IN ('Normal','Small')),
  alphonsa        INTEGER DEFAULT 0,
  neelam          INTEGER DEFAULT 0,
  malgova         INTEGER DEFAULT 0,
  banganapally    INTEGER DEFAULT 0,
  kilimooku       INTEGER DEFAULT 0,
  sindooram       INTEGER DEFAULT 0,
  mix             INTEGER DEFAULT 0,
  total_boxes     INTEGER DEFAULT 0,
  buyer           TEXT,
  price_per_box   REAL DEFAULT 0,
  total_revenue   REAL DEFAULT 0,
  notes           TEXT,
  created_by      TEXT DEFAULT 'system',
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estate360_rubber_harvests (
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

-- Physical daily counts per worker (Rubber Sheet + Ottupal), plus the
-- paper-register-parity columns (block/rain/tapping_rate) added 2026-07.
-- Money is recorded separately in estate360_estate_transactions at sale time.
CREATE TABLE IF NOT EXISTS estate360_rubber_production (
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

CREATE TABLE IF NOT EXISTS estate360_estate_transactions (
  txn_id      TEXT PRIMARY KEY,
  estate      TEXT NOT NULL,
  type        TEXT NOT NULL,
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

-- Raman -> Madhavan settlements. Balance owed = SUM(expenses) - SUM(payments).
CREATE TABLE IF NOT EXISTS estate360_manager_settlements (
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

CREATE TABLE IF NOT EXISTS estate360_estate_contacts (
  contact_id    TEXT PRIMARY KEY,
  estate        TEXT NOT NULL DEFAULT 'pollachi',
  category      TEXT NOT NULL,
  name          TEXT NOT NULL,
  location      TEXT,
  phone         TEXT,
  email         TEXT,
  payment_info  TEXT,
  notes         TEXT,
  active        INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estate360_estate_managers (
  manager_id   TEXT PRIMARY KEY,
  actor        TEXT NOT NULL UNIQUE,
  manager_name TEXT NOT NULL,
  estate_id    TEXT NOT NULL,
  estate_type  TEXT NOT NULL DEFAULT 'coconut',
  phone        TEXT,
  email        TEXT,
  active       INTEGER DEFAULT 1,
  notes        TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estate360_fertilization_log (
  log_id        TEXT PRIMARY KEY,
  estate        TEXT NOT NULL DEFAULT 'pollachi',
  planned_date  TEXT NOT NULL,
  actual_date   TEXT,
  fertilizer_type TEXT,
  quantity_kg   REAL DEFAULT 0,
  cost          REAL DEFAULT 0,
  done_by       TEXT,
  notes         TEXT,
  created_by    TEXT DEFAULT 'system',
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estate360_irrigation_logs (
  log_id      TEXT PRIMARY KEY,
  estate      TEXT DEFAULT 'pollachi',
  logged_date TEXT NOT NULL,
  notes       TEXT,
  created_by  TEXT DEFAULT 'pradosh',
  created_at  TEXT DEFAULT (datetime('now'))
, zone_id TEXT DEFAULT NULL, zone_name TEXT DEFAULT NULL, duration_mins INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS estate360_irrigation_zones (
  zone_id TEXT PRIMARY KEY, estate TEXT NOT NULL,
  zone_name TEXT NOT NULL, zone_label TEXT,
  expected_freq_days INTEGER DEFAULT 7,
  coconut_trees INTEGER DEFAULT 0, new_holes INTEGER DEFAULT 0,
  motor TEXT, mango_trees INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
  notes TEXT, created_at TEXT DEFAULT (datetime('now'))
);

-- ── estate360_ indexes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS estate360_idx_coconut_date ON estate360_coconut_harvests(harvest_date);
CREATE INDEX IF NOT EXISTS estate360_idx_coconut_estate ON estate360_coconut_harvests(estate_id, harvest_date);
CREATE INDEX IF NOT EXISTS estate360_idx_mango_date ON estate360_mango_harvests(estate, harvest_date DESC);
CREATE INDEX IF NOT EXISTS estate360_idx_rubber_date ON estate360_rubber_harvests(harvest_date);
CREATE INDEX IF NOT EXISTS estate360_idx_rubber_estate ON estate360_rubber_harvests(estate_id, harvest_date);
CREATE UNIQUE INDEX IF NOT EXISTS estate360_idx_rubber_prod_unique ON estate360_rubber_production(estate_id, worker_name, prod_date);
CREATE INDEX IF NOT EXISTS estate360_idx_rubber_prod_date ON estate360_rubber_production(estate_id, prod_date DESC);
-- Note: two indexes with identical definitions exist on estate_transactions
-- in production today (pre-existing duplicate, out of scope to fix here) —
-- both carried forward.
CREATE INDEX IF NOT EXISTS estate360_idx_estate_txn ON estate360_estate_transactions(estate, date DESC);
CREATE INDEX IF NOT EXISTS estate360_idx_estate_txn_date ON estate360_estate_transactions(estate, date DESC);
CREATE INDEX IF NOT EXISTS estate360_idx_estate_txn_type ON estate360_estate_transactions(estate, type, date DESC);
CREATE INDEX IF NOT EXISTS estate360_idx_mgr_settle_estate_date ON estate360_manager_settlements(estate_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS estate360_idx_contacts_estate ON estate360_estate_contacts(estate, category);
-- estate_managers has no indexes today (verified live).
CREATE INDEX IF NOT EXISTS estate360_idx_fert_estate ON estate360_fertilization_log(estate, planned_date DESC);
CREATE INDEX IF NOT EXISTS estate360_idx_irrigation_date ON estate360_irrigation_logs(estate, logged_date DESC);
CREATE INDEX IF NOT EXISTS estate360_idx_irrigation_zone ON estate360_irrigation_logs(estate, zone_id, logged_date DESC);
CREATE INDEX IF NOT EXISTS estate360_idx_zones_estate ON estate360_irrigation_zones(estate, active);
