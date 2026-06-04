-- ============================================================
-- Irrigation zones + per-zone logging
-- Run against bgindiadb-estates
-- ============================================================

-- Zone master config per estate
CREATE TABLE IF NOT EXISTS irrigation_zones (
  zone_id       TEXT PRIMARY KEY,
  estate        TEXT NOT NULL,
  zone_name     TEXT NOT NULL,
  zone_label    TEXT,           -- short label e.g. 'Z1', 'North'
  expected_freq_days INTEGER DEFAULT 7,  -- how often this zone should be irrigated
  active        INTEGER DEFAULT 1,
  sort_order    INTEGER DEFAULT 0,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_zones_estate ON irrigation_zones(estate, active);

-- Per-zone irrigation log (replaces the Google Form approach)
ALTER TABLE irrigation_logs ADD COLUMN zone_id TEXT DEFAULT NULL;
ALTER TABLE irrigation_logs ADD COLUMN zone_name TEXT DEFAULT NULL;
ALTER TABLE irrigation_logs ADD COLUMN duration_mins INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_irrigation_zone ON irrigation_logs(estate, zone_id, logged_date DESC);
