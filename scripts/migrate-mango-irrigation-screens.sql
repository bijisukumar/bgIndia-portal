-- ============================================================
-- Run against bgindiadb-estates
-- Mango harvest (per-variety) + estate contacts + irrigation zones
-- ============================================================

-- Drop old simple mango_harvests, replace with proper per-variety structure
DROP TABLE IF EXISTS mango_harvests;

CREATE TABLE IF NOT EXISTS mango_harvests (
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
CREATE INDEX IF NOT EXISTS idx_mango_date ON mango_harvests(estate, harvest_date DESC);

-- Estate contacts (vendors, workers)
CREATE TABLE IF NOT EXISTS estate_contacts (
  contact_id    TEXT PRIMARY KEY,
  estate        TEXT NOT NULL DEFAULT 'pollachi',
  category      TEXT NOT NULL, -- Coconut, Mango, Fencing, JCB, Motor Repair, Mason, Wood, Other
  name          TEXT NOT NULL,
  location      TEXT,
  phone         TEXT,
  email         TEXT,
  payment_info  TEXT,
  notes         TEXT,
  active        INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contacts_estate ON estate_contacts(estate, category);

-- Seed contacts from spreadsheet
INSERT OR IGNORE INTO estate_contacts (contact_id, estate, category, name, location, phone) VALUES
  ('cnt_prithvi',  'pollachi', 'Coconut harvester', 'Prithvi',   'Pollachi',          '8870286018'),
  ('cnt_gopi',     'pollachi', 'Coconut harvester', 'Gopi',      'Chemanampaty',      '9446323580'),
  ('cnt_sidiq',    'pollachi', 'Mango buyer',       'Sidiq',     'Kambrath chella',   '9495172623'),
  ('cnt_hari',     'pollachi', 'Fencing',           'Hari',      'Pollachi',          '9842211380'),
  ('cnt_mohammad_wood', 'pollachi', 'Wood',         'Mohammad',  'Kambrath chella',   '9447216318'),
  ('cnt_prakashan','pollachi', 'Motor repair',      'Prakashan', 'Chemanampaty',      '9995949686'),
  ('cnt_mohammad_mason','pollachi','Mason',          'Mohammad',  'Chemanampaty',      '8891577684'),
  ('cnt_ganesh',   'pollachi', 'JCB',               'Ganesh',    'Chemanampaty',      '9497708445');

-- Seed mango harvest data from spreadsheet (2026 season)
INSERT OR IGNORE INTO mango_harvests (harvest_id, estate, harvest_date, box_type, banganapally, kilimooku, sindooram, mix, total_boxes, created_by) VALUES
  ('mango_20260211_n','pollachi','2026-02-11','Normal', 7,2,2,0,11,'import'),
  ('mango_20260211_s','pollachi','2026-02-11','Small',  0,0,0,3,3,'import'),
  ('mango_20260219_n','pollachi','2026-02-19','Normal', 8,2,8,0,18,'import'),
  ('mango_20260219_s','pollachi','2026-02-19','Small',  0,0,0,13,13,'import'),
  ('mango_20260220_n','pollachi','2026-02-20','Normal', 10,2,5,0,17,'import'),
  ('mango_20260220_s','pollachi','2026-02-20','Small',  0,0,0,8,8,'import'),
  ('mango_20260303_n','pollachi','2026-03-03','Normal', 15,0,5,0,20,'import'),
  ('mango_20260303_s','pollachi','2026-03-03','Small',  0,0,0,10,10,'import'),
  ('mango_20260311_n','pollachi','2026-03-11','Normal', 38,0,10,0,48,'import'),
  ('mango_20260319_n','pollachi','2026-03-19','Normal', 12,0,0,0,12,'import'),
  ('mango_20260325_n','pollachi','2026-03-25','Normal', 3,0,13,0,22,'import'),
  ('mango_20260331_s','pollachi','2026-03-31','Small',  2,0,12,14,28,'import'),
  ('mango_20260401_s','pollachi','2026-04-01','Small',  0,0,0,35,35,'import'),
  ('mango_20260402_s','pollachi','2026-04-02','Small',  0,0,13,15,28,'import'),
  ('mango_20260413_n','pollachi','2026-04-13','Normal', 0,0,0,8,8,'import'),
  ('mango_20260413_s','pollachi','2026-04-13','Small',  0,0,12,10,22,'import'),
  ('mango_20260414_n','pollachi','2026-04-14','Normal', 0,0,0,7,7,'import'),
  ('mango_20260414_s','pollachi','2026-04-14','Small',  0,0,10,10,20,'import'),
  ('mango_20260417_n','pollachi','2026-04-17','Normal', 0,0,7,8,15,'import'),
  ('mango_20260417_s','pollachi','2026-04-17','Small',  0,0,8,12,20,'import');
