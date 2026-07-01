-- Recurring villa operating expenses (electricity, maintenance, repairs,
-- laundry, deep cleaning, pest control, appliance/AC service, landscaping,
-- painting, water systems, bulk supplies, etc.), available to Owner and Raman.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-villa-expenses.sql --remote
CREATE TABLE IF NOT EXISTS villa_expenses (
  txn_id       TEXT PRIMARY KEY,
  villa_id     TEXT NOT NULL DEFAULT 'dwarka',
  date         TEXT NOT NULL,
  category     TEXT NOT NULL,
  amount       REAL NOT NULL,
  paid_to      TEXT,
  description  TEXT,
  created_by   TEXT,
  updated_by   TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_villa_expenses_villa_date ON villa_expenses(villa_id, date DESC);
