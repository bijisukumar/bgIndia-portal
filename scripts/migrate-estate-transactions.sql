-- Create estate_transactions table for Pollachi & Pavutumuri income/expense ledger
-- Run: npx wrangler d1 execute bgindia_db --file=scripts/migrate-estate-transactions.sql --remote

CREATE TABLE IF NOT EXISTS estate_transactions (
  txn_id       TEXT PRIMARY KEY,
  estate       TEXT NOT NULL,
  type         TEXT NOT NULL,
  date         TEXT NOT NULL,
  category     TEXT NOT NULL,
  amount       REAL NOT NULL,
  paid_to      TEXT,
  description  TEXT,
  created_by   TEXT DEFAULT 'pradosh',
  updated_by   TEXT DEFAULT 'pradosh',
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_estate_txn_estate_date ON estate_transactions(estate, date DESC);
CREATE INDEX IF NOT EXISTS idx_estate_txn_type        ON estate_transactions(estate, type, date DESC);

-- Verify
SELECT 'estate_transactions table ready' as status;
