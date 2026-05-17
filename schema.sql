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
  cost_price     REAL DEFAULT 0,
  sell_price     REAL DEFAULT 0,
  last_restocked TEXT,
  -- Audit
  created_by  TEXT DEFAULT 'system',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'owner',
  updated_at  TEXT DEFAULT (datetime('now'))
);

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
