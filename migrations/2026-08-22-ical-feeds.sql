-- Channel calendar sync: OTA iCal feed config + the blocked date-ranges
-- pulled from them. See schema.sql for column-by-column comments.
CREATE TABLE IF NOT EXISTS stayvibe_ical_feeds (
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
CREATE INDEX IF NOT EXISTS idx_ical_feeds_villa ON stayvibe_ical_feeds(villa_id, is_active);

CREATE TABLE IF NOT EXISTS stayvibe_ical_blocks (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_ical_blocks_feed_uid ON stayvibe_ical_blocks(feed_id, uid);
CREATE INDEX IF NOT EXISTS idx_ical_blocks_villa_dates ON stayvibe_ical_blocks(villa_id, checkin_date, checkout_date);
