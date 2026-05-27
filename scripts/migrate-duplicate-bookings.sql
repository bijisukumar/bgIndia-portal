-- MIGRATION: duplicate_bookings audit table
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-duplicate-bookings.sql --remote
-- Date: 2026-05-27
--
-- Stores every double-booking attempt for audit and channel sync analysis.
-- Ideal count: 0. Any entries indicate a channel partner calendar sync issue.

CREATE TABLE IF NOT EXISTS duplicate_bookings (
  dup_id              TEXT PRIMARY KEY,
  villa_id            TEXT NOT NULL DEFAULT 'dwarka',
  detected_at         TEXT DEFAULT (datetime('now')),

  -- Existing confirmed booking
  existing_stay_id    TEXT NOT NULL,
  existing_guest      TEXT,
  existing_checkin    TEXT,
  existing_checkout   TEXT,
  existing_source     TEXT,
  existing_booked_at  TEXT,

  -- New blocked booking attempt
  new_guest           TEXT,
  new_checkin         TEXT,
  new_checkout        TEXT,
  new_source          TEXT,
  new_airbnb_conf     TEXT,

  -- Analysis
  overlap_nights      INTEGER DEFAULT 0,
  notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_dup_detected ON duplicate_bookings(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_dup_source   ON duplicate_bookings(new_source, detected_at DESC);
