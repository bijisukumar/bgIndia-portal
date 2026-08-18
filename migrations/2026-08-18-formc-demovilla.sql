-- demovilla-db never received the side tables from the column split, so KYC
-- and prefs writes had nowhere to land. Create them directly in the per-guest
-- Form C shape — there is no legacy 1:1 data here to migrate.
CREATE TABLE IF NOT EXISTS stayvibe_stay_kyc (
  kyc_id               INTEGER PRIMARY KEY AUTOINCREMENT,
  stay_id              TEXT NOT NULL,
  villa_id             TEXT,
  guest_seq            INTEGER NOT NULL DEFAULT 1,
  guest_name           TEXT,
  nationality          TEXT,
  dob                  TEXT,
  gender               TEXT,
  passport_number      TEXT,
  passport_issue_date  TEXT,
  passport_issue_place TEXT,
  passport_expiry      TEXT,
  visa_number          TEXT,
  visa_type            TEXT,
  visa_issue_date      TEXT,
  visa_issue_place     TEXT,
  arrival_date_india   TEXT,
  port_of_arrival      TEXT,
  next_destination     TEXT,
  home_country         TEXT,
  home_country_address TEXT,
  docs_later           INTEGER DEFAULT 0,
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_stay_seq ON stayvibe_stay_kyc(stay_id, guest_seq);
CREATE INDEX IF NOT EXISTS idx_kyc_stay ON stayvibe_stay_kyc(stay_id);

CREATE TABLE IF NOT EXISTS stayvibe_stay_prefs (
  stay_id            TEXT PRIMARY KEY,
  villa_id           TEXT,
  request_breakfast  INTEGER DEFAULT 0,
  breakfast_choice   TEXT,
  request_cab        INTEGER DEFAULT 0,
  request_extra_beds INTEGER DEFAULT 0,
  extra_beds_count   INTEGER DEFAULT 0,
  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT DEFAULT (datetime('now'))
);

ALTER TABLE stayvibe_guest_documents ADD COLUMN guest_seq INTEGER DEFAULT 1;
