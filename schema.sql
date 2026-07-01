-- ============================================================
-- bgIndia Portal — Cloudflare D1 Schema (SQLite)
-- Deploy: wrangler d1 execute bgindia-db --file=schema.sql --remote
--
-- AUDIT COLUMNS — every table carries four audit fields:
--   created_by   TEXT  — who created the record
--   created_at   TEXT  — when it was created (UTC)
--   updated_by   TEXT  — who last modified it
--   updated_at   TEXT  — when it was last modified (UTC)
--
-- Allowed values for created_by / updated_by:
--   'owner'   — Biji (logged in as owner PIN)
--   'raman'   — RamananKutty (manager PIN)
--   'pradosh' — Pradosh (estate_manager PIN)
--   'auto'    — Automated / AI process (Airbnb poller, email trigger, etc.)
--   'system'  — Internal system operation (seed scripts, migrations)
--
-- Goal: as automation matures, ~80% of records should show 'auto'.
-- ============================================================

-- ── STAYS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stays (
  stay_id          TEXT PRIMARY KEY,
  villa_id         TEXT NOT NULL DEFAULT 'dwarka',
  source           TEXT NOT NULL DEFAULT 'direct',
  guest_name       TEXT NOT NULL,
  guest_phone      TEXT,
  guest_email      TEXT,
  checkin_date     TEXT,
  checkout_date    TEXT,
  nights           INTEGER DEFAULT 1,
  adults           INTEGER DEFAULT 1,
  children         INTEGER DEFAULT 0,
  tariff_per_night REAL DEFAULT 0,
  extra_charges    REAL DEFAULT 0,
  gross            REAL DEFAULT 0,
  commission_pct   REAL DEFAULT 0,
  commission_amt   REAL DEFAULT 0,
  net              REAL DEFAULT 0,
  status           TEXT DEFAULT 'confirmed',
  drive_folder_id  TEXT,             -- D1 folder ID (without full URL)
  drive_folder_url TEXT,             -- full Drive URL for quick access
  review_rating    INTEGER DEFAULT 0, -- star rating 1-5 (0 = no review yet)
  review_source    TEXT,             -- 'airbnb' | 'google'
  review_date      TEXT,             -- YYYY-MM-DD
  airbnb_conf      TEXT,             -- Airbnb confirmation code (for email matching)
  converted_to_direct INTEGER DEFAULT 0,
  -- Audit
  created_by  TEXT DEFAULT 'owner',   -- owner | raman | pradosh | auto | system
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'owner',
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── GUEST REQUESTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_requests (
  req_id      TEXT PRIMARY KEY,
  stay_id     TEXT REFERENCES stays(stay_id),
  type        TEXT,
  detail      TEXT,
  status      TEXT DEFAULT 'pending',
  -- Audit
  created_by  TEXT DEFAULT 'raman',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'raman',
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── STAY CARS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stay_cars (
  car_id      TEXT PRIMARY KEY,
  stay_id     TEXT REFERENCES stays(stay_id),
  plate_no    TEXT,
  photo_url   TEXT,
  -- Audit
  created_by  TEXT DEFAULT 'raman',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'raman',
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── INVENTORY ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  item_id        TEXT PRIMARY KEY,
  villa_id       TEXT NOT NULL DEFAULT 'dwarka',
  name           TEXT NOT NULL,
  unit           TEXT,
  category       TEXT,
  qty_in_stock   INTEGER DEFAULT 0,
  preferred_stock INTEGER DEFAULT 10,
  cost_price     REAL DEFAULT 0,
  sell_price     REAL DEFAULT 0,
  last_restocked TEXT,
  -- Audit
  created_by  TEXT DEFAULT 'system',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'owner',
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── INVENTORY RESTOCK LOG ───────────────────────────────────
-- Transaction history for inventory restocks (qty bought, total cost, date)
-- Separate from `inventory.qty_in_stock` which only holds the current snapshot.
CREATE TABLE IF NOT EXISTS inventory_restock_log (
  id             TEXT PRIMARY KEY,
  villa_id       TEXT NOT NULL DEFAULT 'dwarka',
  item_id        TEXT REFERENCES inventory(item_id),
  item_name      TEXT,
  qty_bought     REAL NOT NULL DEFAULT 0,
  total_cost     REAL NOT NULL DEFAULT 0,
  price_per_unit REAL DEFAULT 0,
  -- Audit
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_restock_log_villa_item
  ON inventory_restock_log(villa_id, item_id);

-- ── STAY INCIDENTALS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS stay_incidentals (
  item_id        TEXT PRIMARY KEY,
  stay_id        TEXT REFERENCES stays(stay_id),
  inv_item_id    TEXT REFERENCES inventory(item_id),
  name           TEXT,
  qty            INTEGER DEFAULT 1,
  price_per_unit REAL DEFAULT 0,
  total          REAL DEFAULT 0,
  -- Audit
  created_by  TEXT DEFAULT 'raman',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'raman',
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── RENTAL PROPERTIES (master / lease details) ─────────────
CREATE TABLE IF NOT EXISTS rental_props (
  prop_id         TEXT PRIMARY KEY,
  name            TEXT,
  location        TEXT,
  tenant_name     TEXT,
  tenant_phone    TEXT,
  deposit         REAL DEFAULT 0,       -- security deposit
  agreed_rent     REAL DEFAULT 0,       -- monthly agreed rent
  maintenance_fee REAL DEFAULT 0,       -- monthly maintenance fee
  lease_start     TEXT,                 -- YYYY-MM-DD
  lease_end       TEXT,                 -- YYYY-MM-DD (60-day renewal alert trigger)
  notes           TEXT,                 -- special terms, contact, parking slot etc.
  monthly_rent    REAL DEFAULT 0,       -- kept for backward compat; prefer agreed_rent
  -- Audit
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'owner',
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── RENTAL INCOME (monthly entries) ───────────────────────
CREATE TABLE IF NOT EXISTS rental_income (
  record_id         TEXT PRIMARY KEY,
  prop_id           TEXT REFERENCES rental_props(prop_id),
  month             INTEGER,
  year              INTEGER,
  rent              REAL DEFAULT 0,
  car_parking       REAL DEFAULT 0,
  maintenance       REAL DEFAULT 0,
  electricity       REAL DEFAULT 0,
  water             REAL DEFAULT 0,
  property_tax      REAL DEFAULT 0,
  land_tax          REAL DEFAULT 0,
  extra_maintenance REAL DEFAULT 0,
  net               REAL DEFAULT 0,
  notes             TEXT,
  -- Audit
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'owner',
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── COCONUT HARVESTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS coconut_harvests (
  harvest_id             TEXT PRIMARY KEY,
  estate_id              TEXT DEFAULT 'pollachi',
  harvester_name         TEXT,
  harvest_date           TEXT,
  final_payment_date     TEXT,
  total_nuts             INTEGER DEFAULT 0,
  net_good_nuts          INTEGER DEFAULT 0,
  nuts_rejected          INTEGER DEFAULT 0,
  additional_unaccounted INTEGER DEFAULT 0,
  total_weight_kg        REAL DEFAULT 0,
  price_per_kg           REAL DEFAULT 0,
  avg_weight_per_nut     REAL DEFAULT 0,
  earnings_main          REAL DEFAULT 0,
  nuts_rejected_b2       INTEGER DEFAULT 0,
  rejection_revenue      REAL DEFAULT 0,
  husk_count_sold        INTEGER DEFAULT 0,
  husk_cost_per_nut      REAL DEFAULT 0,
  husk_earnings          REAL DEFAULT 0,
  other_earnings         REAL DEFAULT 0,
  total_earnings         REAL DEFAULT 0,
  harvest_nuts           INTEGER DEFAULT 0,
  harvest_cost_nut       REAL DEFAULT 0,
  harvest_expense        REAL DEFAULT 0,
  dehusk_nuts            INTEGER DEFAULT 0,
  dehusk_cost_nut        REAL DEFAULT 0,
  dehusk_expense         REAL DEFAULT 0,
  tractor_expense        REAL DEFAULT 0,
  other_expense          REAL DEFAULT 0,
  total_expense          REAL DEFAULT 0,
  net_income             REAL DEFAULT 0,
  advance_payment        REAL DEFAULT 0,
  advance_date           TEXT,
  second_payment         REAL DEFAULT 0,
  final_settlement       REAL DEFAULT 0,
  balance_due            REAL DEFAULT 0,
  next_harvest_date      TEXT,
  notes                  TEXT,
  -- Audit
  created_by  TEXT DEFAULT 'pradosh',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'pradosh',
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── RUBBER HARVESTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rubber_harvests (
  harvest_id   TEXT PRIMARY KEY,
  estate_id    TEXT DEFAULT 'pavutumuri',
  harvest_date TEXT,
  weight_kg    REAL DEFAULT 0,
  price_per_kg REAL DEFAULT 0,
  gross        REAL DEFAULT 0,
  expense      REAL DEFAULT 0,
  net          REAL DEFAULT 0,
  notes        TEXT,
  -- Audit
  created_by  TEXT DEFAULT 'raman',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'raman',
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── RAMAN COMMISSIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS raman_commissions (
  comm_id      TEXT PRIMARY KEY,
  stay_id      TEXT,                   -- FK to stays
  guest_name   TEXT NOT NULL,
  checkin_date TEXT NOT NULL,
  nights       INTEGER DEFAULT 1,
  commission   REAL NOT NULL,
  is_paid      INTEGER DEFAULT 0,      -- 0=unpaid  1=paid
  paid_date    TEXT,
  -- Audit
  created_by  TEXT DEFAULT 'system',   -- auto-created at checkout by Worker
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'owner',    -- owner marks paid
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stays_checkin   ON stays(checkin_date);
CREATE INDEX IF NOT EXISTS idx_stays_status    ON stays(status);
CREATE INDEX IF NOT EXISTS idx_stays_guest     ON stays(guest_name);
CREATE INDEX IF NOT EXISTS idx_stays_source    ON stays(source);
CREATE INDEX IF NOT EXISTS idx_stays_audit     ON stays(created_by, updated_by);
CREATE INDEX IF NOT EXISTS idx_harvests_date   ON coconut_harvests(harvest_date);
CREATE INDEX IF NOT EXISTS idx_rental_income   ON rental_income(prop_id, year, month);
CREATE INDEX IF NOT EXISTS idx_raman_paid      ON raman_commissions(is_paid, checkin_date);
CREATE INDEX IF NOT EXISTS idx_incidentals_stay ON stay_incidentals(stay_id);

-- ── INVENTORY SEED (default items, qty=10 each) ────────────
INSERT OR IGNORE INTO inventory
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

-- Estate income/expense ledger
-- Covers both Pollachi (coconut) and Pavutumuri (rubber) estates
CREATE TABLE IF NOT EXISTS estate_transactions (
  txn_id       TEXT PRIMARY KEY,
  estate       TEXT NOT NULL,              -- 'pollachi' | 'pavutumuri'
  type         TEXT NOT NULL,              -- 'income' | 'expense'
  date         TEXT NOT NULL,             -- YYYY-MM-DD
  category     TEXT NOT NULL,
  amount       REAL NOT NULL,
  paid_to      TEXT,                      -- party name (payer or payee)
  description  TEXT,
  created_by   TEXT DEFAULT 'pradosh',
  updated_by   TEXT DEFAULT 'pradosh',
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_estate_txn_estate_date ON estate_transactions(estate, date DESC);
CREATE INDEX IF NOT EXISTS idx_estate_txn_type        ON estate_transactions(estate, type, date DESC);

-- ── DUPLICATE PROTECTION (added 2026-05-24) ─────────────────────────────
-- Prevents duplicate active bookings for same guest + checkin date per villa.
-- Excludes cancelled and closed stays so historical records are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_stay
  ON stays(villa_id, guest_name, checkin_date)
  WHERE status NOT IN ('cancelled', 'closed');

-- ════════════════════════════════════════════════════════════
-- GUEST ENQUIRY MANAGEMENT (CRM)
-- ════════════════════════════════════════════════════════════

-- ── GUESTS (master record) ──────────────────────────────────
-- One row per real person, matched primarily by phone, then email.
-- Backfilled once from `stays` (see scripts/backfill-guests-crm.sql);
-- new enquiries/bookings going forward write here directly so repeat-guest
-- detection no longer depends on exact guest_name string matches.
CREATE TABLE IF NOT EXISTS guests (
  guest_id      TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT,                 -- normalized (digits only, no +91/spaces) for matching
  email         TEXT,                 -- lowercased for matching
  address       TEXT,
  from_city     TEXT,
  state         TEXT,
  country       TEXT,
  total_stays   INTEGER DEFAULT 0,    -- denormalized counters, refreshed on each confirmed booking
  total_nights  INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at  TEXT DEFAULT (datetime('now')),
  -- Audit
  created_by  TEXT DEFAULT 'system',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'system',
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);

-- ── VILLA RATE CARD ──────────────────────────────────────────
-- Base per-night tariff by villa + billable guest count (adults+children; infants free).
-- Reusable beyond the enquiry screen — e.g. a future guest-facing quick-pricing page
-- can read the same table via getRateCard.
CREATE TABLE IF NOT EXISTS villa_rate_cards (
  villa_id      TEXT NOT NULL DEFAULT 'dwarka',
  guest_count   INTEGER NOT NULL,         -- 1..12 today; villa-specific curve, not assumed shared
  tariff_per_night REAL NOT NULL,
  -- Audit
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'owner',
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (villa_id, guest_count)
);

-- Seed: Dwarka rate card, guests 1-12 (per night, INR). Beyond 12 guests, the app
-- computes guest12Tariff + (extraGuests * 750)/night in code (villaPricing.js) rather
-- than storing every possible row — floor-bed overflow, recommended max 4 extra guests.
INSERT OR IGNORE INTO villa_rate_cards (villa_id, guest_count, tariff_per_night) VALUES
  ('dwarka', 1, 4896), ('dwarka', 2, 4896), ('dwarka', 3, 6037), ('dwarka', 4, 7178),
  ('dwarka', 5, 8319), ('dwarka', 6, 9460), ('dwarka', 7, 10601), ('dwarka', 8, 11743),
  ('dwarka', 9, 12884), ('dwarka', 10, 14025), ('dwarka', 11, 15166), ('dwarka', 12, 16307);

-- ── ENQUIRIES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiries (
  enquiry_id        TEXT PRIMARY KEY,
  villa_id          TEXT NOT NULL DEFAULT 'dwarka',
  guest_id          TEXT REFERENCES guests(guest_id),   -- set once matched/created
  date_received     TEXT DEFAULT (datetime('now')),
  guest_name        TEXT NOT NULL,
  phone             TEXT,
  email             TEXT,
  source            TEXT NOT NULL DEFAULT 'website',    -- website|airbnb|booking_com|whatsapp|phone|referral
  checkin_date      TEXT,
  checkout_date     TEXT,
  nights            INTEGER DEFAULT 0,                  -- recomputed from dates on save
  guests_count      INTEGER DEFAULT 1,                    -- adults + children + infants (kept for back-compat with reporting)
  adults            INTEGER DEFAULT 0,
  children          INTEGER DEFAULT 0,                    -- ages 1-12
  infants           INTEGER DEFAULT 0,                    -- 1 yr and under, free, excluded from pricing lookup
  purpose           TEXT,                                -- vacation|wedding|temple_visit|family_function|other
  quote_amount      REAL DEFAULT 0,
  extra_charges     REAL DEFAULT 0,                      -- sum of extra_lines; added on top of quote_amount, not discounted
  extra_lines       TEXT,                                -- JSON: [{label, amount}] e.g. Additional Guest, Floor Bed
  is_repeat_guest   INTEGER DEFAULT 0,
  previous_stays    INTEGER DEFAULT 0,
  repeat_discount_pct REAL DEFAULT 0,                     -- legacy field, kept as-is; not replaced by discount_category
  discount_category TEXT,                                 -- loyal_patron|elite_guest|platinum_guest|b2b_india|b2b_intl (mutually exclusive, optional)
  discount_pct      REAL DEFAULT 0,                       -- % tied to discount_category; defaults on category select, editable
  discount_amount   REAL DEFAULT 0,                      -- = quote_amount * discount_pct / 100 (falls back to repeat_discount_pct if no category set)
  final_offer_amount REAL DEFAULT 0,                      -- = quote_amount - discount_amount
  status            TEXT NOT NULL DEFAULT 'new',          -- new|quoted|follow_up_needed|negotiating|confirmed|lost|cancelled
  last_contact_date TEXT,
  follow_up_due     TEXT,
  booking_confirmed INTEGER DEFAULT 0,
  booking_value     REAL DEFAULT 0,
  lost_reason       TEXT,                                 -- price|dates_unavailable|chose_another|change_of_plans|no_response|other
  assigned_to       TEXT DEFAULT 'owner',
  notes             TEXT,
  -- Audit
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'owner',
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status   ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_guest    ON enquiries(guest_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_source   ON enquiries(source);
CREATE INDEX IF NOT EXISTS idx_enquiries_followup ON enquiries(follow_up_due);
CREATE INDEX IF NOT EXISTS idx_enquiries_received ON enquiries(date_received);

-- ── COMMUNICATION LOG ────────────────────────────────────────
-- Every interaction tied to an enquiry — quote sent, follow-up, call, note.
CREATE TABLE IF NOT EXISTS communication_log (
  comm_id      TEXT PRIMARY KEY,
  enquiry_id   TEXT NOT NULL REFERENCES enquiries(enquiry_id),
  type         TEXT NOT NULL,         -- email|whatsapp|phone_call|sms|internal_note|status_change
  notes        TEXT,
  occurred_at  TEXT DEFAULT (datetime('now')),
  -- Audit
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comm_log_enquiry ON communication_log(enquiry_id, occurred_at);

-- ── BOOKINGS (link table) ────────────────────────────────────
-- Created when an enquiry is marked Confirmed. Points at the stays row
-- that was auto-created so dashboard/calendar pick it up immediately —
-- this table does NOT duplicate stay financials, just the enquiry link.
CREATE TABLE IF NOT EXISTS bookings (
  booking_id   TEXT PRIMARY KEY,
  enquiry_id   TEXT NOT NULL REFERENCES enquiries(enquiry_id),
  guest_id     TEXT REFERENCES guests(guest_id),
  stay_id      TEXT REFERENCES stays(stay_id),
  booking_value REAL DEFAULT 0,
  confirmed_at TEXT DEFAULT (datetime('now')),
  -- Audit
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_enquiry ON bookings(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest   ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_stay    ON bookings(stay_id);

-- ── PROCESSING LOG ────────────────────────────────────────────
-- Generic error/event log written by the Worker. Two current writers:
--   1. submitGuestCheckIn's crash handler (stay_id='unknown' on parse errors)
--   2. logScriptEvent action (Apps Script execution logging — stay_id is
--      either a real enquiry_id/stay_id, or 'script:<function name>')
-- Confirmed missing in production via a sqlite_master check on 2026-06-24
-- (zero rows returned) despite being referenced since at least the
-- original submitGuestCheckIn implementation — created here and added to
-- tracked schema so this gap isn't rediscovered again later.
CREATE TABLE IF NOT EXISTS processing_log (
  log_id     TEXT PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'info',   -- info|success|warning|error
  stay_id    TEXT,
  note       TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_processing_log_created ON processing_log(created_at);
CREATE INDEX IF NOT EXISTS idx_processing_log_stay    ON processing_log(stay_id);
