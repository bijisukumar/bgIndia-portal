-- ============================================================
-- Property Details Table
-- Stores static property metadata: utilities, loan, address, taxes
-- Run in D1 console: dash.cloudflare.com → D1 → bgindia-db → Console
-- ============================================================

CREATE TABLE IF NOT EXISTS property_details (
  prop_id              TEXT PRIMARY KEY REFERENCES rental_props(prop_id),

  -- ── ADDRESS ─────────────────────────────────────────────
  address_line1        TEXT,
  address_line2        TEXT,
  city                 TEXT,
  state_province       TEXT,
  postal_code          TEXT,
  country              TEXT DEFAULT 'IN',

  -- ── ELECTRICITY ─────────────────────────────────────────
  elec_provider        TEXT,
  elec_consumer_id     TEXT,
  elec_account_number  TEXT,
  elec_portal_url      TEXT,
  elec_monthly_avg     REAL DEFAULT 0,

  -- ── WATER ───────────────────────────────────────────────
  water_provider       TEXT,
  water_consumer_id    TEXT,
  water_account_number TEXT,
  water_portal_url     TEXT,
  water_monthly_avg    REAL DEFAULT 0,

  -- ── GAS ─────────────────────────────────────────────────
  gas_provider         TEXT,
  gas_consumer_id      TEXT,
  gas_account_number   TEXT,
  gas_portal_url       TEXT,
  gas_monthly_avg      REAL DEFAULT 0,

  -- ── INTERNET / HOA / OTHER ──────────────────────────────
  internet_provider    TEXT,
  internet_account     TEXT,
  internet_monthly     REAL DEFAULT 0,

  hoa_name             TEXT,
  hoa_account          TEXT,
  hoa_monthly          REAL DEFAULT 0,

  other_utility_name   TEXT,
  other_utility_id     TEXT,
  other_utility_monthly REAL DEFAULT 0,

  -- ── PROPERTY TAX ────────────────────────────────────────
  tax_parcel_id        TEXT,
  tax_authority        TEXT,
  tax_annual           REAL DEFAULT 0,
  tax_portal_url       TEXT,

  -- ── LOAN / MORTGAGE ─────────────────────────────────────
  loan_lender          TEXT,
  loan_account         TEXT,
  loan_original        REAL DEFAULT 0,
  loan_outstanding     REAL DEFAULT 0,
  loan_monthly_emi     REAL DEFAULT 0,
  loan_interest_rate   REAL DEFAULT 0,
  loan_start_date      TEXT,
  loan_end_date        TEXT,
  loan_portal_url      TEXT,

  -- ── PROPERTY VALUE ──────────────────────────────────────
  purchase_price       REAL DEFAULT 0,
  purchase_date        TEXT,
  estimated_value      REAL DEFAULT 0,
  estimated_value_date TEXT,
  currency             TEXT DEFAULT 'INR',

  -- ── INSURANCE ───────────────────────────────────────────
  insurance_provider   TEXT,
  insurance_policy_no  TEXT,
  insurance_annual     REAL DEFAULT 0,
  insurance_expiry     TEXT,

  -- ── AUDIT ───────────────────────────────────────────────
  notes                TEXT,
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_property_details_prop ON property_details(prop_id);
