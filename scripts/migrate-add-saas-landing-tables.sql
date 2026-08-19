-- ============================================================================
-- MIGRATION: platform_leads + platform_host_registrations
-- ============================================================================
-- Adds the two tables the new SaaS landing gateway writes to (Welcome /
-- RequestDemo / NewHostRegistration screens — see src/screens/Welcome.jsx).
-- Both statements are idempotent (IF NOT EXISTS), safe to re-run.
--
-- Run against dwarka's own DB (the SaaS landing page lives on
-- dwarka.stayvibe360.com, doubling as the marketing entry point):
--   npx wrangler d1 execute bgindia-db --file=scripts/migrate-add-saas-landing-tables.sql --remote
--
-- If the demo host is also expected to accept registrations/demo requests
-- through its own domain, run the same file against demovilla-db too:
--   npx wrangler d1 execute demovilla-db --file=scripts/migrate-add-saas-landing-tables.sql --remote
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_leads (
  lead_id     TEXT PRIMARY KEY,
  source      TEXT NOT NULL DEFAULT 'demo_request',
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  status      TEXT DEFAULT 'new',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_host_registrations (
  registration_id     TEXT PRIMARY KEY,
  status               TEXT DEFAULT 'new',
  brand_name           TEXT NOT NULL,
  short_name           TEXT,
  tagline              TEXT,
  brand_color          TEXT,
  custom_domains       TEXT,
  owner_name           TEXT NOT NULL,
  owner_email          TEXT NOT NULL,
  owner_whatsapp       TEXT,
  villa_code                 TEXT,
  villa_display_name         TEXT,
  villa_full_name             TEXT,
  address                     TEXT,
  maps_link                   TEXT,
  bedrooms                    INTEGER,
  bed_type_note                TEXT,
  checkin_time                 TEXT,
  checkout_time                 TEXT,
  max_guests                    INTEGER,
  rate_card_notes                TEXT,
  cleaning_fee                    REAL,
  extra_charge_menu_notes          TEXT,
  booking_channels_notes            TEXT,
  staff_notes                        TEXT,
  expense_categories_notes            TEXT,
  breakfast_rate                       REAL,
  additional_guest_rate                 REAL,
  channel_email                          TEXT,
  drive_folder_note                       TEXT,
  notes                                    TEXT,
  created_at                                TEXT DEFAULT (datetime('now'))
);

-- Verify after running:
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('platform_leads','platform_host_registrations');
