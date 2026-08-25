-- demovilla schema parity. Generated, not hand-written: the column list
-- is the exact intersection of the two live schemas.
--
-- carried over : 77
-- dropped      : 23  (converted_to_direct, passport_number, passport_issue_date, passport_issue_place, passport_expiry, visa_number, visa_type, visa_issue_date, visa_issue_place, arrival_date_india, port_of_arrival, next_destination, home_country_address, request_breakfast, breakfast_choice, request_cab, special_requests, request_extra_beds, extra_beds_count, home_country, is_foreigner, cform_due_at, hold_confirmation)
-- gained       : 4  (home_address_line2, checked_in_by, checked_out_by, no_show)

-- Four tables carry a FK to stayvibe_stays. Defer the check to commit so
-- the drop/rename can happen; by commit the references resolve to the
-- rebuilt table. PRAGMA foreign_keys cannot be toggled inside D1's
-- transaction, but defer_foreign_keys can.

-- stayvibe_incidentals (32 rows) carries a FK to stayvibe_stays, so the DROP
-- below fails its implicit delete. PRAGMA defer_foreign_keys is not honoured
-- by D1 here, so park the rows instead: the stay_ids they reference all
-- survive the rebuild, so re-inserting afterwards restores every reference.
CREATE TABLE _incidentals_park AS SELECT * FROM stayvibe_incidentals;
DELETE FROM stayvibe_incidentals;

CREATE TABLE "stayvibe_stays_new" (

  stay_id       TEXT PRIMARY KEY,

  villa_id      TEXT NOT NULL DEFAULT 'dwarka',

  source        TEXT NOT NULL DEFAULT 'direct',

  airbnb_conf   TEXT,

  guest_name    TEXT NOT NULL,

  guest_phone   TEXT,

  guest_email   TEXT,

  checkin_date  TEXT,

  checkout_date TEXT,

  nights        INTEGER DEFAULT 1,

  adults        INTEGER DEFAULT 1,

  children      INTEGER DEFAULT 0,

  tariff_per_night REAL DEFAULT 0,

  extra_charges REAL DEFAULT 0,

  gross         REAL DEFAULT 0,

  commission_pct REAL DEFAULT 0,

  commission_amt REAL DEFAULT 0,

  net           REAL DEFAULT 0,

  status        TEXT DEFAULT 'confirmed',

  drive_folder_id TEXT,

  created_at    TEXT DEFAULT (datetime('now')),

  updated_at    TEXT DEFAULT (datetime('now'))

, created_by TEXT DEFAULT 'owner', updated_by TEXT DEFAULT 'owner', drive_folder_url TEXT, review_rating    INTEGER DEFAULT 0, review_source    TEXT, review_date      TEXT, home_address TEXT, city TEXT, state TEXT, country TEXT DEFAULT 'India', from_city TEXT, pincode TEXT, govt_id_type TEXT, govt_id_num TEXT, cleaning_fee REAL DEFAULT 0, host_service_fee REAL DEFAULT 0, you_earn REAL DEFAULT 0, guest_service_fee REAL DEFAULT 0, night_fee REAL DEFAULT 0, guest_paid_total REAL DEFAULT 0, dob TEXT, gender TEXT, nationality TEXT DEFAULT 'Indian', purpose_of_visit TEXT, mode_of_transport TEXT, vehicle_number TEXT, eta TEXT, guest_list TEXT, checkin_form_submitted INTEGER DEFAULT 0, checkin_form_submitted_at TEXT, request_early_checkin  INTEGER DEFAULT 0, request_late_checkout  INTEGER DEFAULT 0, folder_created_at TEXT, processing_log    TEXT, folder_created INTEGER DEFAULT 0, extra_lines TEXT DEFAULT NULL, review_text TEXT DEFAULT NULL, review_note TEXT DEFAULT NULL, review_highlights TEXT DEFAULT NULL, review_chased_at TEXT DEFAULT NULL, review_chase_count INTEGER DEFAULT 0, review_closed INTEGER DEFAULT 0, notes TEXT, booked_by_guest_id TEXT, booked_by_name TEXT, cform_status TEXT DEFAULT 'not_required', guest_id   TEXT, enquiry_id TEXT, early_checkin_time TEXT DEFAULT NULL, late_checkout_time TEXT DEFAULT NULL, checkout_email_sent_at TEXT DEFAULT NULL, actual_checkin_at TEXT DEFAULT NULL, actual_checkout_at TEXT DEFAULT NULL, expected_arrival_at TEXT DEFAULT NULL, expected_departure_at TEXT DEFAULT NULL, home_address_line2 TEXT, checked_in_by  TEXT DEFAULT NULL, checked_out_by TEXT DEFAULT NULL, no_show INTEGER DEFAULT 0);

INSERT INTO stayvibe_stays_new (stay_id, villa_id, source, airbnb_conf, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, adults, children, tariff_per_night, extra_charges, gross, commission_pct, commission_amt, net, status, drive_folder_id, created_at, updated_at, created_by, updated_by, drive_folder_url, review_rating, review_source, review_date, home_address, city, state, country, from_city, pincode, govt_id_type, govt_id_num, cleaning_fee, host_service_fee, you_earn, guest_service_fee, night_fee, guest_paid_total, dob, gender, nationality, purpose_of_visit, mode_of_transport, vehicle_number, eta, guest_list, checkin_form_submitted, checkin_form_submitted_at, request_early_checkin, request_late_checkout, folder_created_at, processing_log, folder_created, extra_lines, review_text, review_note, review_highlights, review_chased_at, review_chase_count, review_closed, notes, booked_by_guest_id, booked_by_name, cform_status, guest_id, enquiry_id, early_checkin_time, late_checkout_time, checkout_email_sent_at, actual_checkin_at, actual_checkout_at, expected_arrival_at, expected_departure_at)
  SELECT stay_id, villa_id, source, airbnb_conf, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, adults, children, tariff_per_night, extra_charges, gross, commission_pct, commission_amt, net, status, drive_folder_id, created_at, updated_at, created_by, updated_by, drive_folder_url, review_rating, review_source, review_date, home_address, city, state, country, from_city, pincode, govt_id_type, govt_id_num, cleaning_fee, host_service_fee, you_earn, guest_service_fee, night_fee, guest_paid_total, dob, gender, nationality, purpose_of_visit, mode_of_transport, vehicle_number, eta, guest_list, checkin_form_submitted, checkin_form_submitted_at, request_early_checkin, request_late_checkout, folder_created_at, processing_log, folder_created, extra_lines, review_text, review_note, review_highlights, review_chased_at, review_chase_count, review_closed, notes, booked_by_guest_id, booked_by_name, cform_status, guest_id, enquiry_id, early_checkin_time, late_checkout_time, checkout_email_sent_at, actual_checkin_at, actual_checkout_at, expected_arrival_at, expected_departure_at FROM stayvibe_stays;

DROP TABLE stayvibe_stays;
ALTER TABLE stayvibe_stays_new RENAME TO stayvibe_stays;

CREATE INDEX stayvibe_idx_stays_audit ON stayvibe_stays(created_by, updated_by);
CREATE INDEX stayvibe_idx_stays_checkin ON stayvibe_stays(checkin_date);
CREATE INDEX stayvibe_idx_stays_enquiry ON stayvibe_stays(enquiry_id);
CREATE INDEX stayvibe_idx_stays_guest ON stayvibe_stays(guest_name);
CREATE INDEX stayvibe_idx_stays_guest_id ON stayvibe_stays(guest_id);
CREATE INDEX stayvibe_idx_stays_source ON stayvibe_stays(source);
CREATE INDEX stayvibe_idx_stays_status ON stayvibe_stays(status);

-- tables demovilla never received
CREATE TABLE stayvibe_flex_requests (request_id TEXT PRIMARY KEY, villa_id TEXT NOT NULL DEFAULT 'dwarka', guest_name TEXT NOT NULL, contact TEXT, booking_channel TEXT, checkin_date TEXT, checkout_date TEXT, need_type TEXT, details TEXT, status TEXT DEFAULT 'new', quoted_pct INTEGER, owner_note TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), priority TEXT, wants_direct INTEGER DEFAULT 0, requested_checkin_time TEXT, requested_checkout_time TEXT);
CREATE TABLE stayvibe_stay_ext (stay_id TEXT PRIMARY KEY, villa_id TEXT, late_checkout_nights INTEGER DEFAULT 0, occupancy_tax REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), refund_amount REAL DEFAULT 0, refund_reason TEXT, refunded_at TEXT, refunded_by TEXT);
CREATE TABLE stayvibe_ical_feeds (
  feed_id          TEXT PRIMARY KEY,
  villa_id         TEXT NOT NULL DEFAULT 'dwarka',
  channel          TEXT NOT NULL,
  label            TEXT,
  ics_url          TEXT NOT NULL,
  is_active        INTEGER DEFAULT 1,
  last_synced_at   TEXT,
  last_sync_status TEXT,
  last_sync_error  TEXT,
  last_sync_count  INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'owner', created_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT DEFAULT 'owner', updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE stayvibe_ical_blocks (
  block_id      TEXT PRIMARY KEY,
  feed_id       TEXT NOT NULL,
  villa_id      TEXT NOT NULL,
  channel       TEXT NOT NULL,
  uid           TEXT NOT NULL,
  checkin_date  TEXT NOT NULL,
  checkout_date TEXT NOT NULL,
  summary       TEXT,
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at  TEXT DEFAULT (datetime('now')),
  removed_at    TEXT
);

-- restore the parked rows now that stayvibe_stays exists again
INSERT INTO stayvibe_incidentals SELECT * FROM _incidentals_park;
DROP TABLE _incidentals_park;
