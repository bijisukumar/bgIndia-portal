-- ============================================================
-- MIGRATION: checkin_links table
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-checkin-links.sql --remote
-- Date: 2026-05-24
-- ============================================================

CREATE TABLE IF NOT EXISTS checkin_links (
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

CREATE INDEX IF NOT EXISTS idx_checkin_links_villa ON checkin_links(villa_id, is_active);

-- Seed default links for Dwarka
INSERT OR IGNORE INTO checkin_links (token, villa_id, partner, label, created_by)
VALUES
  ('gvr-direct',      'dwarka', 'direct',     'Direct Booking',  'system'),
  ('gvr-airbnb',      'dwarka', 'airbnb',      'Airbnb',          'system'),
  ('gvr-mmt',         'dwarka', 'makemytrip',  'MakeMyTrip',      'system'),
  ('gvr-booking',     'dwarka', 'booking',     'Booking.com',     'system'),
  ('gvr-goibibo',     'dwarka', 'goibibo',     'Goibibo',         'system');
