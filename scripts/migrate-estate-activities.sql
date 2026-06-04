-- ============================================================
-- Estate activity tracking — fertilization schedule, mango harvest
-- Run against bgindiadb-estates
-- ============================================================

-- Fertilization log (planned + actual)
CREATE TABLE IF NOT EXISTS fertilization_log (
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
CREATE INDEX IF NOT EXISTS idx_fert_estate ON fertilization_log(estate, planned_date DESC);

-- Mango harvest log
CREATE TABLE IF NOT EXISTS mango_harvests (
  harvest_id    TEXT PRIMARY KEY,
  estate        TEXT NOT NULL DEFAULT 'pollachi',
  harvest_year  INTEGER NOT NULL,
  harvest_date  TEXT,
  quantity_tons REAL DEFAULT 0,
  quantity_units INTEGER DEFAULT 0,
  variety       TEXT,
  price_per_unit REAL DEFAULT 0,
  total_revenue  REAL DEFAULT 0,
  buyer         TEXT,
  notes         TEXT,
  created_by    TEXT DEFAULT 'system',
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mango_estate ON mango_harvests(estate, harvest_year DESC);

-- Seed: fertilization history for Pollachi
INSERT OR IGNORE INTO fertilization_log (log_id, estate, planned_date, actual_date, fertilizer_type, notes, created_by)
VALUES
  ('fert_2025_nov', 'pollachi', '2025-11-01', '2025-11-01', 'Mixed NPK', 'Completed Nov 2025', 'owner'),
  ('fert_2026_jun', 'pollachi', '2026-06-01', NULL, 'Mixed NPK', 'Next planned June 2026', 'owner');
