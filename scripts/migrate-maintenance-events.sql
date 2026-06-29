-- Migration: create maintenance_events
--
-- Replaces property_expenses.extra_maintenance (a single number per
-- property per month) with a proper one-to-many log: a property can
-- have multiple separate maintenance events in the same month (e.g.
-- a fridge repair AND a plumbing fix), each with its own category,
-- amount, and description of what was actually done.
--
-- Per explicit decision (2026-06-29): this REPLACES the manual
-- "Add. maintenance" number entirely -- that field becomes
-- auto-calculated server-side as SUM(amount) from this table for the
-- given property/month/year, rather than entered by hand. See
-- savePropertyExpense in functions/api/[[route]].js, updated
-- alongside this migration to stop accepting a manual extraMaintenance
-- value and compute it from here instead.
--
-- category is constrained to a fixed list (Plumbing / Electrical /
-- Appliance Repair / Painting / Pest Control / Cleaning / Carpentry /
-- Other), confirmed with owner -- not a free-text field, so the
-- categories stay consistent for any future reporting/filtering.
--
-- Run via D1 Admin / D1 console. Plain sequential statements only.

CREATE TABLE IF NOT EXISTS maintenance_events (
  event_id     TEXT PRIMARY KEY,
  prop_id      TEXT NOT NULL,
  month        INTEGER NOT NULL,   -- 1-12, matches property_expenses.month
  year         INTEGER NOT NULL,
  category     TEXT NOT NULL,      -- Plumbing / Electrical / Appliance Repair / Painting / Pest Control / Cleaning / Carpentry / Other
  amount       REAL NOT NULL DEFAULT 0,
  description  TEXT,               -- free text: what was actually done, e.g. "Fridge fan repair by Bob"
  event_date   TEXT,               -- date the work was done (defaults to today if not given)
  created_by   TEXT DEFAULT 'owner',
  created_at   TEXT DEFAULT (datetime('now')),
  updated_by   TEXT DEFAULT 'owner',
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_maintenance_events_prop_period ON maintenance_events(prop_id, year, month);

-- Verify after running:
-- PRAGMA table_info(maintenance_events);
