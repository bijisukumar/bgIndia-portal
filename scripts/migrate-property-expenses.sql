-- Migration: create property_expenses
--
-- Replaces rental_income's expense-side columns (electricity, water,
-- property_tax, land_tax, extra_maintenance) with a properly-named
-- table, now that rent + car_parking are moving to rent_transactions
-- (which can represent late fees and payment dates, which
-- rental_income never could). rental_income itself is NOT dropped --
-- existing historical rows stay there untouched, this just stops
-- writing to it going forward.
--
-- One row per property per month, same INSERT-OR-REPLACE-by-key
-- pattern as rental_income had, so editing a month overwrites that
-- month's single expense row rather than accumulating duplicates.
--
-- Used when there's no tenant (vacant period) or simply to record
-- property-level costs (taxes, utilities) that exist independent of
-- whether rent was collected that month.
--
-- Run via D1 Admin / D1 console. Plain sequential statements only.

CREATE TABLE IF NOT EXISTS property_expenses (
  record_id          TEXT PRIMARY KEY,   -- 'PE-{propId}-{year}-{month}', mirrors rental_income's record_id convention
  prop_id            TEXT NOT NULL,
  month              INTEGER NOT NULL,   -- 1-12
  year               INTEGER NOT NULL,
  electricity        REAL NOT NULL DEFAULT 0,
  water              REAL NOT NULL DEFAULT 0,
  property_tax       REAL NOT NULL DEFAULT 0,
  land_tax           REAL NOT NULL DEFAULT 0,
  extra_maintenance  REAL NOT NULL DEFAULT 0,
  total_expense      REAL NOT NULL DEFAULT 0,  -- sum of the 5 fields above, stored not recomputed (same reasoning as rent_transactions.total_due)
  notes              TEXT,
  created_by         TEXT DEFAULT 'owner',
  created_at         TEXT DEFAULT (datetime('now')),
  updated_by         TEXT DEFAULT 'owner',
  updated_at         TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_property_expenses_prop ON property_expenses(prop_id, year, month);

-- Verify after running:
-- PRAGMA table_info(property_expenses);
