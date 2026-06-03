-- ============================================================
-- Run against bgindiadb-estates
-- Moves estate_managers config to the correct DB
-- ============================================================

CREATE TABLE IF NOT EXISTS estate_managers (
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

INSERT OR IGNORE INTO estate_managers (manager_id, actor, manager_name, estate_id, estate_type, active)
VALUES
  ('mgr_pradosh', 'pradosh', 'Pradosh',      'pollachi',   'coconut', 1),
  ('mgr_raman',   'raman',   'RamananKutty', 'pavutumuri', 'rubber',  1);
