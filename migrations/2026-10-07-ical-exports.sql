-- The calendar StayVibe publishes BACK to each booking platform.
--
-- Until now the channel calendar only read the platforms' calendars. This
-- table holds one private link per platform that the platform imports in turn:
-- everything booked anywhere else (direct bookings entered here, plus the
-- other platforms' blocks), never that platform's own bookings.
--
-- The link is /api/ical/<token>.ics and has no login: the platform's importer
-- cannot sign in, so the token IS the secret. It is long and random, shown only
-- to the villa's owner, and can be replaced at any time - the old one then
-- stops working at once. It is stored as is (not hashed) because the owner has
-- to be able to copy it again; the same trade as stayvibe_ical_feeds.ics_url
-- and stayvibe_checkin_links.token.
--
-- last_fetched_at / last_fetch_agent / fetch_count answer "is the platform
-- actually reading it?", which is otherwise invisible.
--
-- Applied to bgindia-db, which serves every host (dwarka, demo, ...); every
-- row is scoped by villa_id and a link only answers on its own villa's host.

CREATE TABLE IF NOT EXISTS stayvibe_ical_exports (
  export_id        TEXT PRIMARY KEY,
  villa_id         TEXT NOT NULL DEFAULT 'dwarka',
  channel          TEXT NOT NULL,             -- as the owner typed it, lower-cased: 'booking.com'
  channel_key      TEXT NOT NULL,             -- normalised for matching: 'bookingcom'
  token            TEXT NOT NULL,             -- the secret in the link
  last_fetched_at  TEXT,                      -- UTC 'YYYY-MM-DD HH:MM:SS'
  last_fetch_agent TEXT,                      -- the platform's User-Agent, trimmed
  fetch_count      INTEGER NOT NULL DEFAULT 0,
  created_by       TEXT DEFAULT 'owner',
  created_at       TEXT DEFAULT (datetime('now')),
  rotated_at       TEXT                       -- when the token was last replaced
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ical_exports_token         ON stayvibe_ical_exports(token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ical_exports_villa_channel ON stayvibe_ical_exports(villa_id, channel_key);
