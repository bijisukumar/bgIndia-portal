-- Form C is filed per foreign national, not per booking. The old table was
-- keyed stay_id PRIMARY KEY, which structurally allowed only one. Rebuild it
-- as one row per guest, keyed (stay_id, guest_seq); seq 1 is the person who
-- filled the form, 2..N are the companions they added.
CREATE TABLE stayvibe_stay_kyc_new (
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

INSERT INTO stayvibe_stay_kyc_new (
  stay_id, villa_id, guest_seq, guest_name, nationality, dob, gender,
  passport_number, passport_issue_date, passport_issue_place, passport_expiry,
  visa_number, visa_type, visa_issue_date, visa_issue_place,
  arrival_date_india, port_of_arrival, next_destination,
  home_country, home_country_address, created_at, updated_at)
SELECT k.stay_id, k.villa_id, 1, s.guest_name, s.nationality, s.dob, s.gender,
  k.passport_number, k.passport_issue_date, k.passport_issue_place, k.passport_expiry,
  k.visa_number, k.visa_type, k.visa_issue_date, k.visa_issue_place,
  k.arrival_date_india, k.port_of_arrival, k.next_destination,
  k.home_country, k.home_country_address, k.created_at, k.updated_at
FROM stayvibe_stay_kyc k
LEFT JOIN stayvibe_stays s ON s.stay_id = k.stay_id;

DROP TABLE stayvibe_stay_kyc;
ALTER TABLE stayvibe_stay_kyc_new RENAME TO stayvibe_stay_kyc;
CREATE UNIQUE INDEX idx_kyc_stay_seq ON stayvibe_stay_kyc(stay_id, guest_seq);
CREATE INDEX idx_kyc_stay ON stayvibe_stay_kyc(stay_id);

-- Documents are per guest too: guest 2's passport scan is a different file.
ALTER TABLE stayvibe_guest_documents ADD COLUMN guest_seq INTEGER DEFAULT 1;
