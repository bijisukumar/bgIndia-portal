-- ============================================================
-- HOA & Property Tax History Tables
-- Tracks changes over time — each rate change = new row
-- Run in D1 console: dash.cloudflare.com → D1 → bgindia-db → Console
-- ============================================================

CREATE TABLE IF NOT EXISTS hoa_history (
  id           TEXT PRIMARY KEY,
  prop_id      TEXT NOT NULL,
  effective_date TEXT NOT NULL,          -- YYYY-MM-DD when this rate took effect
  monthly_amount REAL NOT NULL DEFAULT 0,
  currency     TEXT DEFAULT 'INR',
  notes        TEXT,                     -- e.g. "Annual increase notice May 2024"
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hoa_history_prop ON hoa_history(prop_id, effective_date DESC);

CREATE TABLE IF NOT EXISTS tax_history (
  id             TEXT PRIMARY KEY,
  prop_id        TEXT NOT NULL,
  tax_year       INTEGER NOT NULL,       -- e.g. 2024
  annual_amount  REAL NOT NULL DEFAULT 0,
  currency       TEXT DEFAULT 'INR',
  parcel_id      TEXT,                   -- can change if reassessed
  tax_authority  TEXT,
  due_date       TEXT,                   -- YYYY-MM-DD when payment is due
  paid_date      TEXT,                   -- YYYY-MM-DD when actually paid
  paid_amount    REAL DEFAULT 0,
  receipt_ref    TEXT,                   -- receipt or confirmation number
  notes          TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tax_history_prop ON tax_history(prop_id, tax_year DESC);
