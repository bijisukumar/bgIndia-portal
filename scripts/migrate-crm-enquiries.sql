-- ════════════════════════════════════════════════════════════
-- GUEST ENQUIRY MANAGEMENT (CRM) — migration for the LIVE D1 DB
-- Run this once against bgindia-db. Safe to re-run (IF NOT EXISTS everywhere).
-- After this, run scripts/backfill-guests-crm.sql once to populate `guests`
-- from existing `stays` history.
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
  guests_count      INTEGER DEFAULT 1,
  purpose           TEXT,                                -- vacation|wedding|temple_visit|family_function|other
  quote_amount      REAL DEFAULT 0,
  is_repeat_guest   INTEGER DEFAULT 0,
  previous_stays    INTEGER DEFAULT 0,
  repeat_discount_pct REAL DEFAULT 0,
  discount_amount   REAL DEFAULT 0,                      -- = quote_amount * repeat_discount_pct / 100
  final_offer_amount REAL DEFAULT 0,                      -- = quote_amount - discount_amount
  status            TEXT NOT NULL DEFAULT 'new',          -- new|quoted|follow_up_needed|negotiating|confirmed|lost|cancelled
  last_contact_date TEXT,
  follow_up_due     TEXT,
  booking_confirmed INTEGER DEFAULT 0,
  booking_value     REAL DEFAULT 0,
  lost_reason       TEXT,                                 -- price|dates_unavailable|chose_another|no_response|other
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
