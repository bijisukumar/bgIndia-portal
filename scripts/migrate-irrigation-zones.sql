-- ============================================================
-- Irrigation zones — run against bgindiadb-estates
-- Safe to re-run: uses CREATE IF NOT EXISTS + INSERT OR IGNORE
-- ============================================================

-- Drop and recreate zones table cleanly (safe — just config data)
DROP TABLE IF EXISTS irrigation_zones;

CREATE TABLE IF NOT EXISTS irrigation_zones (
  zone_id            TEXT PRIMARY KEY,
  estate             TEXT NOT NULL,
  zone_name          TEXT NOT NULL,
  zone_label         TEXT,
  expected_freq_days INTEGER DEFAULT 7,
  coconut_trees      INTEGER DEFAULT 0,
  new_holes          INTEGER DEFAULT 0,
  motor              TEXT,
  mango_trees        INTEGER DEFAULT 0,
  active             INTEGER DEFAULT 1,
  sort_order         INTEGER DEFAULT 0,
  notes              TEXT,
  created_at         TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_zones_estate ON irrigation_zones(estate, active);

-- Add zone columns to irrigation_logs if not already there
-- SQLite doesn't support IF NOT EXISTS on ALTER, so wrap in separate statements
-- Run each separately if one fails due to column already existing
ALTER TABLE irrigation_logs ADD COLUMN zone_id TEXT DEFAULT NULL;
ALTER TABLE irrigation_logs ADD COLUMN zone_name TEXT DEFAULT NULL;
ALTER TABLE irrigation_logs ADD COLUMN duration_mins INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_irrigation_zone ON irrigation_logs(estate, zone_id, logged_date DESC);

-- Seed Pollachi zones
INSERT OR IGNORE INTO irrigation_zones
  (zone_id, estate, zone_name, zone_label, expected_freq_days, sort_order,
   coconut_trees, new_holes, motor, notes)
VALUES
  ('pollachi_z1','pollachi','Zone 1 — Colony NW', '1',7,1, 20,  0,'5HP',  'Colony NW · 5HP Box · Mango motor area'),
  ('pollachi_z2','pollachi','Zone 2 — West Mid',  '2',7,2, 49, 10,'7HP',  'West Mid · 7HP Box'),
  ('pollachi_z3','pollachi','Zone 3 — West South','3',7,3, 80, 34, NULL,  'West South'),
  ('pollachi_z4','pollachi','Zone 4 — Center N',  '4',7,4, 23,  2,'7HP',  'Center North · 7HP Box'),
  ('pollachi_z5','pollachi','Zone 5 — Center Mid','5',7,5,110,114, NULL,  'Center Mid · 114 new planting holes'),
  ('pollachi_z6','pollachi','Zone 6 — Center S',  '6',7,6, 49, 51, NULL,  'Center South · 51 new planting holes'),
  ('pollachi_z7','pollachi','Zone 7 — Colony NE', '7',7,7, 49, 18, NULL,  'Colony NE · Colony boundary'),
  ('pollachi_z8','pollachi','Zone 8 — East Mid',  '8',7,8,200,149, NULL,  'East Mid · 149 new planting holes'),
  ('pollachi_z9','pollachi','Zone 9 — East South','9',7,9,214, 81,'7HP',  'East South · 7HP Box · 10HP Motor');
