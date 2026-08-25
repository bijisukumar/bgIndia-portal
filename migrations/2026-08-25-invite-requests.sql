-- Soft-launch invite requests from www.stayvibe360.com. Deliberately separate
-- from platform_host_registrations: that is the heavy onboarding intake for a
-- host who has already said yes. This is the two-minute "I'm interested" form
-- that comes before the call.
CREATE TABLE IF NOT EXISTS platform_invite_requests (
  request_id      TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  whatsapp        TEXT NOT NULL,
  email           TEXT,
  property_name   TEXT,
  location        TEXT,
  property_count  TEXT,
  channels        TEXT,          -- comma separated, from tap-chips
  foreign_guests  TEXT,          -- Yes / Sometimes / No  (Form C qualifier)
  call_slot       TEXT,          -- rough preferred window, improves show-up
  notes           TEXT,
  status          TEXT DEFAULT 'new',
  created_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invite_requests_created ON platform_invite_requests(created_at);
