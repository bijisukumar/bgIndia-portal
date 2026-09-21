-- Move-in/move-out photo links (OneDrive, clickable in generated
-- documents) and a proper expense ledger for what the owner spends
-- preparing a property for a new tenant or after one leaves (deep
-- cleaning, AC service, electrician, plumbing, realty commission, etc).
-- All additive -- no table rebuild needed.

ALTER TABLE rev360_rental_props ADD COLUMN move_in_photos_url TEXT;
ALTER TABLE rev360_rental_props ADD COLUMN move_out_photos_url TEXT;

ALTER TABLE rev360_tenancy_history ADD COLUMN move_in_photos_url TEXT;
ALTER TABLE rev360_tenancy_history ADD COLUMN move_out_photos_url TEXT;

CREATE TABLE IF NOT EXISTS rev360_move_expenses (
  expense_id      TEXT PRIMARY KEY,
  prop_id         TEXT NOT NULL REFERENCES rev360_rental_props(prop_id),
  event_type      TEXT NOT NULL CHECK(event_type IN ('move_in','move_out')),
  tenant_snapshot TEXT,
  category        TEXT NOT NULL CHECK(category IN ('Realty Commission','Deep Cleaning','AC Service','Electrician','Plumbing','Painting','Pest Control','Other')),
  description     TEXT,
  amount          REAL NOT NULL DEFAULT 0,
  currency        TEXT DEFAULT 'INR',
  vendor_name     TEXT,
  paid_date       TEXT,
  evidence_url    TEXT,
  created_by      TEXT DEFAULT 'owner',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS rev360_idx_move_expenses_prop ON rev360_move_expenses(prop_id, event_type);
