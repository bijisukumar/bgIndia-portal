-- ============================================================
-- Run in D1 console: bgindia-db (main DB)
-- Adds estate_managers config table — decouples manager name
-- from code. Tomorrow Pradosh can be replaced by John with
-- zero code changes — just update this table.
-- ============================================================

CREATE TABLE IF NOT EXISTS estate_managers (
  manager_id   TEXT PRIMARY KEY,
  actor        TEXT NOT NULL UNIQUE,  -- matches JWT actor from login (e.g. 'pradosh', 'john')
  manager_name TEXT NOT NULL,         -- display name (e.g. 'Pradosh', 'John')
  estate_id    TEXT NOT NULL,         -- e.g. 'pollachi', 'pavutumuri'
  estate_type  TEXT NOT NULL DEFAULT 'coconut', -- 'coconut' | 'rubber' | 'mixed'
  phone        TEXT,
  email        TEXT,
  active       INTEGER DEFAULT 1,
  notes        TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- Seed current managers
INSERT OR IGNORE INTO estate_managers (manager_id, actor, manager_name, estate_id, estate_type, active)
VALUES
  ('mgr_pradosh', 'pradosh', 'Pradosh',      'pollachi',   'coconut', 1),
  ('mgr_raman',   'raman',   'RamananKutty', 'pavutumuri', 'rubber',  1);
