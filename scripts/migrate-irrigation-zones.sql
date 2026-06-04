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

-- Seed Pollachi zones from estate map
-- All zones on 7-day irrigation cycle
INSERT OR IGNORE INTO irrigation_zones (zone_id, estate, zone_name, zone_label, expected_freq_days, sort_order, notes) VALUES
  ('pollachi_z1', 'pollachi', 'Zone 1 — Colony NW',  '1', 7, 1, '20 coconut trees · 5HP Box · Colony boundary'),
  ('pollachi_z2', 'pollachi', 'Zone 2 — West Mid',   '2', 7, 2, '49 coconut trees · 10 holes · 7HP Box'),
  ('pollachi_z3', 'pollachi', 'Zone 3 — West South', '3', 7, 3, '80 coconut trees · 34 holes'),
  ('pollachi_z4', 'pollachi', 'Zone 4 — Center N',   '4', 7, 4, '23 coconut trees · 2 holes · 7HP Box'),
  ('pollachi_z5', 'pollachi', 'Zone 5 — Center Mid', '5', 7, 5, '110 coconut trees · 114 holes'),
  ('pollachi_z6', 'pollachi', 'Zone 6 — Center S',   '6', 7, 6, '49 coconut trees · 51 holes'),
  ('pollachi_z7', 'pollachi', 'Zone 7 — Colony NE',  '7', 7, 7, '49 coconut trees · 18 holes · Colony boundary'),
  ('pollachi_z8', 'pollachi', 'Zone 8 — East Mid',   '8', 7, 8, '200 coconut trees · 149 holes'),
  ('pollachi_z9', 'pollachi', 'Zone 9 — East South', '9', 7, 9, '214 coconut trees · 81 holes · 7HP Box · 10HP Motor');
