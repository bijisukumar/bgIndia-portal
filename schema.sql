-- ============================================================
-- bgIndia Portal — Cloudflare D1 Schema (SQLite), bgindia-db
-- Deploy: wrangler d1 execute bgindia-db --file=schema.sql --remote
--
-- RELEASE 2.1: table names carry an app-scoped prefix —
-- stayvibe_ (villa hospitality), rev360_ (rental), infra_ (cross-cutting).
-- Estate tables live entirely in bgindiadb-estates (schema-estates.sql) —
-- the 5 stale pre-split copies that used to live here
-- (coconut_harvests/estate_transactions/manager_settlements/
-- rubber_harvests/rubber_production) have been removed; see
-- scripts/migrate-v2.1-drop-stale-estate-tables.sql.
--
-- This file was regenerated from the live production schema (2026-07)
-- rather than hand-maintained — the previous version of this file had
-- drifted significantly out of sync with production (many columns and
-- 12 whole tables added via scripts/migrate-*.sql over time were never
-- back-filled here). Column bodies below are the live, exact definitions.
--
-- AUDIT COLUMNS — most tables carry created_by/created_at/updated_by/
-- updated_at. Allowed values for created_by / updated_by:
--   'owner' | 'raman' | 'pradosh' | 'auto' | 'system'
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- stayvibe_ — villa hospitality (24 tables)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stayvibe_stays (
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
  converted_to_direct INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
, created_by TEXT DEFAULT 'owner', updated_by TEXT DEFAULT 'owner', drive_folder_url TEXT, review_rating    INTEGER DEFAULT 0, review_source    TEXT, review_date      TEXT, home_address TEXT, city TEXT, state TEXT, country TEXT DEFAULT 'India', from_city TEXT, pincode TEXT, govt_id_type TEXT, govt_id_num TEXT, cleaning_fee REAL DEFAULT 0, host_service_fee REAL DEFAULT 0, you_earn REAL DEFAULT 0, guest_service_fee REAL DEFAULT 0, night_fee REAL DEFAULT 0, guest_paid_total REAL DEFAULT 0, dob TEXT, gender TEXT, nationality TEXT DEFAULT 'Indian', purpose_of_visit TEXT, mode_of_transport TEXT, vehicle_number TEXT, eta TEXT, guest_list TEXT, passport_number TEXT, passport_issue_date TEXT, passport_issue_place TEXT, passport_expiry TEXT, visa_number TEXT, visa_type TEXT, visa_issue_date TEXT, visa_issue_place TEXT, arrival_date_india TEXT, port_of_arrival TEXT, next_destination TEXT, home_country_address TEXT, checkin_form_submitted INTEGER DEFAULT 0, checkin_form_submitted_at TEXT, request_early_checkin  INTEGER DEFAULT 0, request_late_checkout  INTEGER DEFAULT 0, request_breakfast      INTEGER DEFAULT 0, breakfast_choice       TEXT, request_cab            INTEGER DEFAULT 0, special_requests       TEXT, folder_created_at TEXT, processing_log    TEXT, folder_created INTEGER DEFAULT 0, request_extra_beds INTEGER DEFAULT 0, extra_beds_count   INTEGER DEFAULT 0, extra_lines TEXT DEFAULT NULL, review_text TEXT DEFAULT NULL, review_note TEXT DEFAULT NULL, review_highlights TEXT DEFAULT NULL, review_chased_at TEXT DEFAULT NULL, review_chase_count INTEGER DEFAULT 0, review_closed INTEGER DEFAULT 0, notes TEXT, home_country TEXT, booked_by_guest_id TEXT, booked_by_name TEXT, is_foreigner INTEGER DEFAULT 0, cform_status TEXT DEFAULT 'not_required', cform_due_at TEXT, guest_id   TEXT, enquiry_id TEXT, hold_confirmation INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS stayvibe_guests (
  guest_id      TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  from_city     TEXT,
  state         TEXT,
  country       TEXT,
  total_stays   INTEGER DEFAULT 0,
  total_nights  INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at  TEXT DEFAULT (datetime('now')),
  created_by  TEXT DEFAULT 'system',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'system',
  updated_at  TEXT DEFAULT (datetime('now'))
, pincode TEXT);

CREATE TABLE IF NOT EXISTS stayvibe_enquiries (
  enquiry_id        TEXT PRIMARY KEY,
  villa_id          TEXT NOT NULL DEFAULT 'dwarka',
  guest_id          TEXT REFERENCES stayvibe_guests(guest_id),
  date_received     TEXT DEFAULT (datetime('now')),
  guest_name        TEXT NOT NULL,
  phone             TEXT,
  email             TEXT,
  source            TEXT NOT NULL DEFAULT 'website',
  checkin_date      TEXT,
  checkout_date     TEXT,
  nights            INTEGER DEFAULT 0,
  guests_count      INTEGER DEFAULT 1,
  purpose           TEXT,
  quote_amount      REAL DEFAULT 0,
  is_repeat_guest   INTEGER DEFAULT 0,
  previous_stays    INTEGER DEFAULT 0,
  repeat_discount_pct REAL DEFAULT 0,
  discount_amount   REAL DEFAULT 0,
  final_offer_amount REAL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'new',
  last_contact_date TEXT,
  follow_up_due     TEXT,
  booking_confirmed INTEGER DEFAULT 0,
  booking_value     REAL DEFAULT 0,
  lost_reason       TEXT,
  assigned_to       TEXT DEFAULT 'owner',
  notes             TEXT,
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'owner',
  updated_at  TEXT DEFAULT (datetime('now'))
, reminder_2day_sent_at TEXT, reminder_5day_sent_at TEXT, adults            INTEGER DEFAULT 0, children          INTEGER DEFAULT 0, infants           INTEGER DEFAULT 0, discount_category TEXT, discount_pct      REAL DEFAULT 0, extra_charges REAL DEFAULT 0, extra_lines   TEXT DEFAULT NULL, purpose_other TEXT DEFAULT NULL);

CREATE TABLE IF NOT EXISTS stayvibe_bookings (
  booking_id   TEXT PRIMARY KEY,
  enquiry_id   TEXT NOT NULL REFERENCES stayvibe_enquiries(enquiry_id),
  guest_id     TEXT REFERENCES stayvibe_guests(guest_id),
  stay_id      TEXT REFERENCES stayvibe_stays(stay_id),
  booking_value REAL DEFAULT 0,
  confirmed_at TEXT DEFAULT (datetime('now')),
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stayvibe_manager_commissions (
  comm_id       TEXT PRIMARY KEY,
  stay_id       TEXT,
  guest_name    TEXT NOT NULL,
  checkin_date  TEXT NOT NULL,
  nights        INTEGER DEFAULT 1,
  commission    REAL NOT NULL,
  is_paid       INTEGER DEFAULT 0,
  paid_date     TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
, created_by TEXT DEFAULT 'system', updated_by TEXT DEFAULT 'owner', updated_at TEXT);

CREATE TABLE IF NOT EXISTS stayvibe_inventory (
  item_id         TEXT PRIMARY KEY,
  villa_id        TEXT NOT NULL DEFAULT 'dwarka',
  name            TEXT NOT NULL,
  unit            TEXT,
  category        TEXT,
  qty_in_stock    INTEGER DEFAULT 0,
  cost_price      REAL DEFAULT 0,
  sell_price      REAL DEFAULT 0,
  last_restocked  TEXT
, created_by TEXT DEFAULT 'system', created_at TEXT, updated_by TEXT DEFAULT 'owner', updated_at TEXT, preferred_stock INTEGER DEFAULT 10, active INTEGER DEFAULT 1);

CREATE TABLE IF NOT EXISTS stayvibe_inventory_restock_log (
  id             TEXT PRIMARY KEY,
  villa_id       TEXT NOT NULL DEFAULT 'dwarka',
  item_id        TEXT REFERENCES stayvibe_inventory(item_id),
  item_name      TEXT,
  qty_bought     REAL NOT NULL DEFAULT 0,
  total_cost     REAL NOT NULL DEFAULT 0,
  price_per_unit REAL DEFAULT 0,
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stayvibe_cars (
  car_id      TEXT PRIMARY KEY,
  stay_id     TEXT REFERENCES stayvibe_stays(stay_id),
  plate_no    TEXT,
  photo_url   TEXT,
  captured_at TEXT DEFAULT (datetime('now'))
, created_by TEXT DEFAULT 'raman', created_at TEXT, updated_by TEXT DEFAULT 'raman', updated_at TEXT);

CREATE TABLE IF NOT EXISTS stayvibe_incidentals (
  item_id       TEXT PRIMARY KEY,
  stay_id       TEXT REFERENCES stayvibe_stays(stay_id),
  inv_item_id   TEXT REFERENCES stayvibe_inventory(item_id),
  name          TEXT,
  qty           INTEGER DEFAULT 1,
  price_per_unit REAL DEFAULT 0,
  total         REAL DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
, created_by TEXT DEFAULT 'raman', updated_by TEXT DEFAULT 'raman', updated_at TEXT);

CREATE TABLE IF NOT EXISTS stayvibe_guest_requests (
  req_id      TEXT PRIMARY KEY,
  stay_id     TEXT REFERENCES stayvibe_stays(stay_id),
  type        TEXT,
  detail      TEXT,
  status      TEXT DEFAULT 'pending',
  created_at  TEXT DEFAULT (datetime('now'))
, created_by TEXT DEFAULT 'raman', updated_by TEXT DEFAULT 'raman', updated_at TEXT);

CREATE TABLE IF NOT EXISTS stayvibe_guest_documents (
  doc_id TEXT PRIMARY KEY, stay_id TEXT NOT NULL, doc_type TEXT, file_name TEXT, file_b64 TEXT,
  created_at TEXT DEFAULT (datetime('now')), expires_at TEXT, folder_created INTEGER DEFAULT 0, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS stayvibe_villa_settings (
  villa_id     TEXT NOT NULL,
  key          TEXT NOT NULL,
  value        TEXT,
  updated_by   TEXT,
  updated_at   TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (villa_id, key)
);

CREATE TABLE IF NOT EXISTS stayvibe_villa_expenses (
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

CREATE TABLE IF NOT EXISTS stayvibe_villa_rate_cards (
  villa_id      TEXT NOT NULL DEFAULT 'dwarka',
  guest_count   INTEGER NOT NULL,
  tariff_per_night REAL NOT NULL,
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'owner',
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (villa_id, guest_count)
);

CREATE TABLE IF NOT EXISTS stayvibe_marketing_campaigns (
  id            TEXT PRIMARY KEY,
  campaign_name TEXT NOT NULL,
  unique_token  TEXT NOT NULL UNIQUE,
  channel       TEXT DEFAULT 'whatsapp',
  villa_id      TEXT DEFAULT 'dwarka',
  is_active     INTEGER DEFAULT 1,
  notes         TEXT,
  created_by    TEXT DEFAULT 'owner',
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stayvibe_campaign_analytics (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES stayvibe_marketing_campaigns(id),
  event_type  TEXT NOT NULL CHECK(event_type IN ('click','inquiry','booking')),
  country     TEXT,
  region      TEXT,
  city        TEXT,
  user_agent  TEXT,
  referrer    TEXT,
  ts          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stayvibe_booking_line_items (
  line_id      TEXT PRIMARY KEY,
  stay_id      TEXT NOT NULL,
  villa_id     TEXT,
  item_type    TEXT NOT NULL,
  direction    TEXT NOT NULL,
  gross_amount REAL NOT NULL DEFAULT 0,
  tax_amount   REAL NOT NULL DEFAULT 0,
  note         TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stayvibe_channels (
  channel_id  TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  is_direct   INTEGER DEFAULT 0,
  default_commission_pct REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stayvibe_payouts (
  payout_id       TEXT PRIMARY KEY,
  channel_id      TEXT,
  payout_ref      TEXT,
  payout_date     TEXT,
  amount_received REAL DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stayvibe_payout_map (
  map_id           TEXT PRIMARY KEY,
  payout_id        TEXT NOT NULL,
  stay_id          TEXT NOT NULL,
  line_id          TEXT,
  allocated_amount REAL DEFAULT 0,
  created_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stayvibe_checkin_links (
  token      TEXT PRIMARY KEY,
  villa_id   TEXT NOT NULL DEFAULT 'dwarka',
  partner    TEXT NOT NULL DEFAULT 'direct',
  label      TEXT,
  is_active  INTEGER DEFAULT 1,
  use_count  INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'owner',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Self-serve quote links for travel agents / sales partners (stayvibe only).
-- Same shape as stayvibe_checkin_links (a per-partner token gating access
-- without a full account) but for the public quote calculator at
-- /quote/:token instead of the guest check-in form.
CREATE TABLE IF NOT EXISTS stayvibe_agent_links (
  token        TEXT PRIMARY KEY,
  villa_id     TEXT NOT NULL DEFAULT 'dwarka',
  agent_name   TEXT NOT NULL,
  discount_pct INTEGER DEFAULT 0,
  is_active    INTEGER DEFAULT 1,
  use_count    INTEGER DEFAULT 0,
  created_by   TEXT DEFAULT 'owner',
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stayvibe_duplicate_bookings (
  dup_id              TEXT PRIMARY KEY,
  villa_id            TEXT NOT NULL DEFAULT 'dwarka',
  detected_at         TEXT DEFAULT (datetime('now')),
  existing_stay_id    TEXT NOT NULL,
  existing_guest      TEXT,
  existing_checkin    TEXT,
  existing_checkout   TEXT,
  existing_source     TEXT,
  existing_booked_at  TEXT,
  new_guest           TEXT,
  new_checkin         TEXT,
  new_checkout        TEXT,
  new_source          TEXT,
  new_airbnb_conf     TEXT,
  overlap_nights      INTEGER DEFAULT 0,
  notes               TEXT
, resolved    INTEGER DEFAULT 0, resolved_by TEXT, resolved_at TEXT, resolution  TEXT);

CREATE TABLE IF NOT EXISTS stayvibe_communication_log (
  comm_id      TEXT PRIMARY KEY,
  enquiry_id   TEXT NOT NULL REFERENCES stayvibe_enquiries(enquiry_id),
  type         TEXT NOT NULL,
  notes        TEXT,
  occurred_at  TEXT DEFAULT (datetime('now')),
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stayvibe_cform_filings (
  filing_id  TEXT PRIMARY KEY,
  stay_id    TEXT NOT NULL,
  villa_id   TEXT,
  phase      TEXT NOT NULL,     -- 'checkin' | 'checkout'
  ack_number TEXT,
  filed_by   TEXT,
  filed_at   TEXT DEFAULT (datetime('now')),
  notes      TEXT
);

-- ── stayvibe_ indexes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS stayvibe_idx_stays_checkin ON stayvibe_stays(checkin_date);
CREATE INDEX IF NOT EXISTS stayvibe_idx_stays_status ON stayvibe_stays(status);
CREATE INDEX IF NOT EXISTS stayvibe_idx_stays_guest ON stayvibe_stays(guest_name);
CREATE INDEX IF NOT EXISTS stayvibe_idx_stays_source ON stayvibe_stays(source);
CREATE INDEX IF NOT EXISTS stayvibe_idx_stays_audit ON stayvibe_stays(created_by, updated_by);
CREATE INDEX IF NOT EXISTS stayvibe_idx_stays_guest_id ON stayvibe_stays(guest_id);
CREATE INDEX IF NOT EXISTS stayvibe_idx_stays_enquiry ON stayvibe_stays(enquiry_id);
CREATE UNIQUE INDEX IF NOT EXISTS stayvibe_idx_unique_stay ON stayvibe_stays(villa_id, guest_name, checkin_date) WHERE status NOT IN ('cancelled', 'closed');
CREATE INDEX IF NOT EXISTS stayvibe_idx_guests_phone ON stayvibe_guests(phone);
CREATE INDEX IF NOT EXISTS stayvibe_idx_guests_email ON stayvibe_guests(email);
CREATE INDEX IF NOT EXISTS stayvibe_idx_enquiries_status ON stayvibe_enquiries(status);
CREATE INDEX IF NOT EXISTS stayvibe_idx_enquiries_guest ON stayvibe_enquiries(guest_id);
CREATE INDEX IF NOT EXISTS stayvibe_idx_enquiries_source ON stayvibe_enquiries(source);
CREATE INDEX IF NOT EXISTS stayvibe_idx_enquiries_followup ON stayvibe_enquiries(follow_up_due);
CREATE INDEX IF NOT EXISTS stayvibe_idx_enquiries_received ON stayvibe_enquiries(date_received);
CREATE INDEX IF NOT EXISTS stayvibe_idx_bookings_enquiry ON stayvibe_bookings(enquiry_id);
CREATE INDEX IF NOT EXISTS stayvibe_idx_bookings_guest ON stayvibe_bookings(guest_id);
CREATE INDEX IF NOT EXISTS stayvibe_idx_bookings_stay ON stayvibe_bookings(stay_id);
CREATE INDEX IF NOT EXISTS stayvibe_idx_manager_commissions_paid ON stayvibe_manager_commissions(is_paid, checkin_date);
CREATE INDEX IF NOT EXISTS stayvibe_idx_restock_log_villa_item ON stayvibe_inventory_restock_log(villa_id, item_id);
CREATE INDEX IF NOT EXISTS stayvibe_idx_incidentals_stay ON stayvibe_incidentals(stay_id);
CREATE INDEX IF NOT EXISTS stayvibe_idx_campaigns_token ON stayvibe_marketing_campaigns(unique_token);
CREATE INDEX IF NOT EXISTS stayvibe_idx_campaigns_villa ON stayvibe_marketing_campaigns(villa_id, is_active);
CREATE INDEX IF NOT EXISTS stayvibe_idx_analytics_campaign ON stayvibe_campaign_analytics(campaign_id, event_type);
CREATE INDEX IF NOT EXISTS stayvibe_idx_analytics_ts ON stayvibe_campaign_analytics(ts);
CREATE INDEX IF NOT EXISTS stayvibe_idx_bli_stay ON stayvibe_booking_line_items(stay_id);
CREATE INDEX IF NOT EXISTS stayvibe_idx_bli_type ON stayvibe_booking_line_items(item_type);
CREATE INDEX IF NOT EXISTS stayvibe_idx_bli_villa ON stayvibe_booking_line_items(villa_id);
CREATE INDEX IF NOT EXISTS stayvibe_idx_pmap_payout ON stayvibe_payout_map(payout_id);
CREATE INDEX IF NOT EXISTS stayvibe_idx_pmap_stay ON stayvibe_payout_map(stay_id);
CREATE INDEX IF NOT EXISTS stayvibe_idx_checkin_links_villa ON stayvibe_checkin_links(villa_id, is_active);
CREATE INDEX IF NOT EXISTS stayvibe_idx_dup_detected ON stayvibe_duplicate_bookings(detected_at DESC);
CREATE INDEX IF NOT EXISTS stayvibe_idx_dup_source ON stayvibe_duplicate_bookings(new_source, detected_at DESC);
CREATE INDEX IF NOT EXISTS stayvibe_idx_duplicate_bookings_resolved ON stayvibe_duplicate_bookings(resolved);
CREATE INDEX IF NOT EXISTS stayvibe_idx_comm_log_enquiry ON stayvibe_communication_log(enquiry_id, occurred_at);
CREATE INDEX IF NOT EXISTS stayvibe_idx_cform_filings_stay ON stayvibe_cform_filings(stay_id);
CREATE INDEX IF NOT EXISTS stayvibe_idx_villa_expenses_villa_date ON stayvibe_villa_expenses(villa_id, date DESC);

-- ── stayvibe_ seed data ─────────────────────────────────────────
INSERT OR IGNORE INTO stayvibe_inventory
  (item_id, villa_id, name, unit, category, qty_in_stock, cost_price, sell_price, created_by, updated_by)
VALUES
  ('water_bottle',    'dwarka', 'Water bottles',      'bottle', 'kitchen',  10, 18, 30, 'system', 'system'),
  ('soft_drink',      'dwarka', 'Soft drinks',         'can',    'kitchen',  10, 40, 60, 'system', 'system'),
  ('chocolate',       'dwarka', 'Chocolates',          'bar',    'kitchen',  10, 45, 70, 'system', 'system'),
  ('chips',           'dwarka', 'Chips',               'packet', 'kitchen',  10, 30, 50, 'system', 'system'),
  ('milk_packet',     'dwarka', 'Milk packets',        'packet', 'kitchen',  10, 30, 45, 'system', 'system'),
  ('tea_coffee',      'dwarka', 'Tea / Coffee',        'cup',    'kitchen',  10, 15, 25, 'system', 'system'),
  ('eggs',            'dwarka', 'Eggs',                'egg',    'kitchen',  10,  8, 12, 'system', 'system'),
  ('bread',           'dwarka', 'Bread',               'loaf',   'kitchen',  10, 35, 45, 'system', 'system'),
  ('shampoo',         'dwarka', 'Shampoo',             'bottle', 'bathroom', 10, 80,  0, 'system', 'system'),
  ('body_wash',       'dwarka', 'Body wash',           'bottle', 'bathroom', 10, 90,  0, 'system', 'system'),
  ('bathroom_cleaner','dwarka', 'Bathroom cleaner',    'bottle', 'bathroom', 10, 60,  0, 'system', 'system'),
  ('tissue',          'dwarka', 'Tissue/toilet paper', 'roll',   'bathroom', 10, 25,  0, 'system', 'system'),
  ('bed_essential',   'dwarka', 'Bedroom essentials',  'set',    'bedroom',  10,  0,  0, 'system', 'system');

INSERT OR IGNORE INTO stayvibe_villa_rate_cards (villa_id, guest_count, tariff_per_night) VALUES
  ('dwarka', 1, 4896), ('dwarka', 2, 4896), ('dwarka', 3, 6037), ('dwarka', 4, 7178),
  ('dwarka', 5, 8319), ('dwarka', 6, 9460), ('dwarka', 7, 10601), ('dwarka', 8, 11743),
  ('dwarka', 9, 12884), ('dwarka', 10, 14025), ('dwarka', 11, 15166), ('dwarka', 12, 16307);

-- ════════════════════════════════════════════════════════════
-- rev360_ — rental property management (12 tables)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rev360_rental_props (
  prop_id      TEXT PRIMARY KEY,
  name         TEXT,
  location     TEXT,
  tenant_name  TEXT,
  tenant_phone TEXT,
  lease_start  TEXT,
  lease_end    TEXT,
  monthly_rent REAL DEFAULT 0
, deposit         REAL DEFAULT 0, agreed_rent     REAL DEFAULT 0, maintenance_fee REAL DEFAULT 0, notes           TEXT, created_by      TEXT DEFAULT 'owner', created_at      TEXT, updated_by      TEXT DEFAULT 'owner', updated_at      TEXT, status TEXT DEFAULT 'Active', country TEXT DEFAULT 'IN', currency TEXT DEFAULT 'INR', tenant_email TEXT DEFAULT NULL, drive_folder_url TEXT DEFAULT NULL, next_renewal_date    TEXT, early_terminated      INTEGER DEFAULT 0, early_termination_date TEXT, doc_contract_signed INTEGER DEFAULT 0, doc_id_captured     INTEGER DEFAULT 0, doc_move_in         INTEGER DEFAULT 0, doc_move_out        INTEGER DEFAULT 0, doc_damage_report   INTEGER DEFAULT 0, tenant_address TEXT, tenant_pan     TEXT, stage         TEXT DEFAULT 'Signed Up', is_delinquent INTEGER DEFAULT 0, end_reason    TEXT, is_month_to_month     INTEGER DEFAULT 0, month_to_month_since  TEXT, parking_tenant_name  TEXT, parking_tenant_phone TEXT, parking_fee          REAL DEFAULT 0, parking_deposit      REAL DEFAULT 0, parking_lease_start  TEXT, parking_lease_end    TEXT, parking_currency     TEXT DEFAULT 'INR', has_separate_parking INTEGER DEFAULT 0, parking_paid_in_full INTEGER DEFAULT 0, move_out_doc_shared INTEGER DEFAULT 0, move_out_docs_received INTEGER DEFAULT 0, damage_charges_deducted REAL DEFAULT 0, deposit_refunded REAL DEFAULT 0);

CREATE TABLE IF NOT EXISTS rev360_rental_income (
  record_id    TEXT PRIMARY KEY,
  prop_id      TEXT REFERENCES rev360_rental_props(prop_id),
  month        INTEGER,
  year         INTEGER,
  rent         REAL DEFAULT 0,
  car_parking  REAL DEFAULT 0,
  maintenance  REAL DEFAULT 0,
  electricity  REAL DEFAULT 0,
  water        REAL DEFAULT 0,
  property_tax REAL DEFAULT 0,
  land_tax     REAL DEFAULT 0,
  extra_maintenance REAL DEFAULT 0,
  net          REAL DEFAULT 0,
  notes        TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
, created_by TEXT DEFAULT 'owner', updated_by TEXT DEFAULT 'owner', updated_at TEXT);

CREATE TABLE IF NOT EXISTS rev360_rent_transactions (
  txn_id        TEXT PRIMARY KEY,
  prop_id       TEXT NOT NULL,
  period_month  TEXT NOT NULL,
  base_rent     REAL NOT NULL DEFAULT 0,
  maintenance   REAL NOT NULL DEFAULT 0,
  late_fee      REAL NOT NULL DEFAULT 0,
  total_due     REAL NOT NULL DEFAULT 0,
  is_exception  INTEGER NOT NULL DEFAULT 0,
  paid_date     TEXT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'INR',
  notes         TEXT,
  created_by    TEXT DEFAULT 'owner',
  created_at    TEXT DEFAULT (datetime('now'))
, car_parking REAL NOT NULL DEFAULT 0, unit_type TEXT NOT NULL DEFAULT 'main');

CREATE TABLE IF NOT EXISTS rev360_tenancy_history (
  history_id      TEXT PRIMARY KEY,
  prop_id         TEXT NOT NULL,
  tenant_name     TEXT NOT NULL,
  tenant_email    TEXT,
  tenant_phone    TEXT,
  tenant_address  TEXT,
  tenant_pan      TEXT,
  deposit         REAL DEFAULT 0,
  agreed_rent     REAL DEFAULT 0,
  maintenance_fee REAL DEFAULT 0,
  lease_start     TEXT,
  lease_end       TEXT,
  country         TEXT DEFAULT 'IN',
  currency        TEXT DEFAULT 'INR',
  status          TEXT DEFAULT 'Completed',
  end_reason      TEXT,
  early_terminated INTEGER DEFAULT 0,
  early_termination_date TEXT,
  notes           TEXT,
  drive_folder_url TEXT,
  doc_contract_signed INTEGER DEFAULT 0,
  doc_id_captured     INTEGER DEFAULT 0,
  doc_move_in         INTEGER DEFAULT 0,
  doc_move_out        INTEGER DEFAULT 0,
  doc_damage_report   INTEGER DEFAULT 0,
  move_out_doc_shared     INTEGER DEFAULT 0,
  move_out_docs_received  INTEGER DEFAULT 0,
  damage_charges_deducted REAL DEFAULT 0,
  deposit_refunded        REAL DEFAULT 0,
  created_by      TEXT DEFAULT 'owner',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_by      TEXT DEFAULT 'owner',
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rev360_incoming_tenants (
  incoming_id     TEXT PRIMARY KEY,
  prop_id         TEXT NOT NULL,
  tenant_name     TEXT NOT NULL,
  tenant_email    TEXT,
  tenant_phone    TEXT,
  tenant_address  TEXT,
  tenant_pan      TEXT,
  deposit         REAL DEFAULT 0,
  agreed_rent     REAL DEFAULT 0,
  maintenance_fee REAL DEFAULT 0,
  lease_start     TEXT,
  lease_end       TEXT,
  country         TEXT DEFAULT 'IN',
  currency        TEXT DEFAULT 'INR',
  notes           TEXT,
  doc_contract_signed INTEGER DEFAULT 0,
  doc_id_captured     INTEGER DEFAULT 0,
  created_by      TEXT DEFAULT 'owner',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_by      TEXT DEFAULT 'owner',
  updated_at      TEXT DEFAULT (datetime('now'))
, deposit_paid        INTEGER DEFAULT 0, deposit_paid_date   TEXT, deposit_payment_mode TEXT);

CREATE TABLE IF NOT EXISTS rev360_property_details (
  prop_id TEXT PRIMARY KEY,
  address_line1 TEXT, address_line2 TEXT, city TEXT,
  state_province TEXT, postal_code TEXT, country TEXT DEFAULT 'IN',
  elec_provider TEXT, elec_consumer_id TEXT, elec_account_number TEXT,
  elec_portal_url TEXT, elec_monthly_avg REAL DEFAULT 0,
  water_provider TEXT, water_consumer_id TEXT, water_account_number TEXT,
  water_portal_url TEXT, water_monthly_avg REAL DEFAULT 0,
  gas_provider TEXT, gas_consumer_id TEXT, gas_account_number TEXT,
  gas_portal_url TEXT, gas_monthly_avg REAL DEFAULT 0,
  internet_provider TEXT, internet_account TEXT, internet_monthly REAL DEFAULT 0,
  hoa_name TEXT, hoa_account TEXT, hoa_monthly REAL DEFAULT 0,
  other_utility_name TEXT, other_utility_id TEXT, other_utility_monthly REAL DEFAULT 0,
  tax_parcel_id TEXT, tax_authority TEXT, tax_annual REAL DEFAULT 0, tax_portal_url TEXT,
  loan_lender TEXT, loan_account TEXT, loan_original REAL DEFAULT 0,
  loan_outstanding REAL DEFAULT 0, loan_monthly_emi REAL DEFAULT 0,
  loan_interest_rate REAL DEFAULT 0, loan_start_date TEXT, loan_end_date TEXT, loan_portal_url TEXT,
  purchase_price REAL DEFAULT 0, purchase_date TEXT,
  estimated_value REAL DEFAULT 0, estimated_value_date TEXT, currency TEXT DEFAULT 'INR',
  insurance_provider TEXT, insurance_policy_no TEXT,
  insurance_annual REAL DEFAULT 0, insurance_expiry TEXT,
  notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
, unit_no       TEXT, floor         TEXT, building_name TEXT, has_parking   INTEGER DEFAULT 0, furnishing    TEXT);

CREATE TABLE IF NOT EXISTS rev360_property_documents (
  doc_id TEXT PRIMARY KEY, prop_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other', doc_name TEXT NOT NULL,
  drive_url TEXT, drive_folder_url TEXT, file_type TEXT,
  doc_date TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rev360_property_expenses (
  record_id          TEXT PRIMARY KEY,
  prop_id            TEXT NOT NULL,
  month              INTEGER NOT NULL,
  year               INTEGER NOT NULL,
  electricity        REAL NOT NULL DEFAULT 0,
  water              REAL NOT NULL DEFAULT 0,
  property_tax       REAL NOT NULL DEFAULT 0,
  land_tax           REAL NOT NULL DEFAULT 0,
  extra_maintenance  REAL NOT NULL DEFAULT 0,
  total_expense      REAL NOT NULL DEFAULT 0,
  notes              TEXT,
  created_by         TEXT DEFAULT 'owner',
  created_at         TEXT DEFAULT (datetime('now')),
  updated_by         TEXT DEFAULT 'owner',
  updated_at         TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rev360_maintenance_events (
  event_id     TEXT PRIMARY KEY,
  prop_id      TEXT NOT NULL,
  month        INTEGER NOT NULL,
  year         INTEGER NOT NULL,
  category     TEXT NOT NULL,
  amount       REAL NOT NULL DEFAULT 0,
  description  TEXT,
  event_date   TEXT,
  created_by   TEXT DEFAULT 'owner',
  created_at   TEXT DEFAULT (datetime('now')),
  updated_by   TEXT DEFAULT 'owner',
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rev360_lease_losses (
  loss_id            TEXT PRIMARY KEY,
  prop_id            TEXT REFERENCES rev360_rental_props(prop_id),
  lease_snapshot     TEXT,
  item_category      TEXT NOT NULL CHECK(item_category IN ('Rent','Damage','Cleaning','Legal','Other')),
  description        TEXT NOT NULL,
  amount             REAL NOT NULL DEFAULT 0,
  currency           TEXT DEFAULT 'INR',
  evidence_file_name TEXT,
  evidence_drive_url TEXT,
  evidence_timestamp TEXT,
  status             TEXT DEFAULT 'Estimated' CHECK(status IN ('Estimated','Claimed','Recovered','Unrecoverable')),
  created_by         TEXT DEFAULT 'owner',
  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rev360_hoa_history (
  id TEXT PRIMARY KEY, prop_id TEXT NOT NULL,
  effective_date TEXT NOT NULL, monthly_amount REAL NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR', notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rev360_tax_history (
  id TEXT PRIMARY KEY, prop_id TEXT NOT NULL,
  tax_year INTEGER NOT NULL, annual_amount REAL NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR', parcel_id TEXT, tax_authority TEXT,
  due_date TEXT, paid_date TEXT, paid_amount REAL DEFAULT 0,
  receipt_ref TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── rev360_ indexes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS rev360_idx_rental_income ON rev360_rental_income(prop_id, year, month);
CREATE INDEX IF NOT EXISTS rev360_idx_rent_txn_period ON rev360_rent_transactions(period_month);
CREATE INDEX IF NOT EXISTS rev360_idx_rent_txn_prop ON rev360_rent_transactions(prop_id, period_month);
CREATE UNIQUE INDEX IF NOT EXISTS rev360_idx_rent_txn_unique_period ON rev360_rent_transactions(prop_id, period_month, unit_type);
CREATE INDEX IF NOT EXISTS rev360_idx_tenancy_history_prop ON rev360_tenancy_history(prop_id, lease_end);
CREATE UNIQUE INDEX IF NOT EXISTS rev360_idx_incoming_tenant_one_per_prop ON rev360_incoming_tenants(prop_id);
CREATE INDEX IF NOT EXISTS rev360_idx_property_docs_prop ON rev360_property_documents(prop_id, category);
CREATE INDEX IF NOT EXISTS rev360_idx_property_expenses_prop ON rev360_property_expenses(prop_id, year, month);
CREATE INDEX IF NOT EXISTS rev360_idx_maintenance_events_prop_period ON rev360_maintenance_events(prop_id, year, month);
CREATE INDEX IF NOT EXISTS rev360_idx_lease_losses_prop ON rev360_lease_losses(prop_id, status);
CREATE INDEX IF NOT EXISTS rev360_idx_hoa_history_prop ON rev360_hoa_history(prop_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS rev360_idx_tax_history_prop ON rev360_tax_history(prop_id, tax_year DESC);

-- ════════════════════════════════════════════════════════════
-- infra_ — cross-cutting logs (3 tables)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS infra_alert_log (
  log_id       TEXT PRIMARY KEY,
  villa_id     TEXT,
  subject      TEXT,
  to_email     TEXT,
  success      INTEGER NOT NULL,
  status_code  INTEGER,
  error_detail TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS infra_processing_log (
  log_id     TEXT PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'info',
  stay_id    TEXT,
  note       TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS infra_deletion_log (
  del_id TEXT PRIMARY KEY, stay_id TEXT, villa_id TEXT, action TEXT,
  guest_name TEXT, checkin_date TEXT, checkout_date TEXT, reason TEXT,
  snapshot TEXT, actor TEXT, created_at TEXT DEFAULT (datetime('now'))
);

-- ── infra_ indexes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS infra_idx_alert_log_created ON infra_alert_log(created_at DESC);
CREATE INDEX IF NOT EXISTS infra_idx_processing_log_created ON infra_processing_log(created_at);
CREATE INDEX IF NOT EXISTS infra_idx_processing_log_stay ON infra_processing_log(stay_id);
CREATE INDEX IF NOT EXISTS infra_idx_deletion_log_stay ON infra_deletion_log(stay_id);
CREATE INDEX IF NOT EXISTS infra_idx_deletion_log_villa ON infra_deletion_log(villa_id);

-- ════════════════════════════════════════════════════════════
-- platform_ — SaaS tenancy + auth (2 tables)
-- ════════════════════════════════════════════════════════════

-- Cross-cutting SaaS tenancy + auth — used by every app AND by the
-- externally-deployed scripts/GuestFormScript.gs (via the worker's
-- getTenantConfig action, not directly — confirmed the .gs file itself
-- needs no change).
CREATE TABLE IF NOT EXISTS platform_tenants (
  tenant_id            TEXT PRIMARY KEY,
  villa_name           TEXT,
  owner_email          TEXT,
  owner_email_cc       TEXT,
  drive_root_id        TEXT,
  airbnb_email         TEXT,
  phone1               TEXT,
  phone2               TEXT,
  guest_contact        TEXT,
  address              TEXT,
  logo_url             TEXT,
  checkin_time         TEXT DEFAULT '16:00',
  checkout_time        TEXT DEFAULT '11:00',
  breakfast_rate       INTEGER DEFAULT 275,
  raman_comm_pct       INTEGER DEFAULT 10,
  plan                 TEXT DEFAULT 'starter',
  active               INTEGER DEFAULT 1,
  created_at           TEXT,
  billing_contact_name TEXT,
  billing_email        TEXT,
  primary_hostname     TEXT
);

-- Tenant<->property ownership record (auth/billing layer). property_id
-- uses the same identifier values already used as villa_id across
-- stayvibe_* tables — this is the ownership record, not a replacement for
-- hosts/<id>/config.js's villas[] branding array. unit_type distinguishes
-- a whole villa from a single room; display-only, nothing else depends on it.
CREATE TABLE IF NOT EXISTS platform_properties (
  property_id  TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES platform_tenants(tenant_id),
  name         TEXT,
  unit_type    TEXT DEFAULT 'villa',
  active       INTEGER DEFAULT 1,
  created_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_platform_properties_tenant ON platform_properties(tenant_id);

-- token_hash = SHA-256 hex of the PIN (never store PINs in plaintext —
-- this table is readable by debug tools like D1Explorer.jsx). actor is
-- the short internal slug ('raman', 'pradosh') that estate-routing logic
-- keys off; label is the display name ('RamananKutty').
CREATE TABLE IF NOT EXISTS platform_auth_tokens (
  token_hash  TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES platform_tenants(tenant_id),
  role        TEXT NOT NULL,
  actor       TEXT NOT NULL,
  label       TEXT,
  active      INTEGER DEFAULT 1,
  created_at  TEXT
);
