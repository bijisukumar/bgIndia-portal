-- Creates processing_log — confirmed via:
--   SELECT name FROM sqlite_master WHERE type='table' AND name='processing_log';
-- (returned zero rows) that this table did NOT exist, despite being
-- referenced by two backend handlers already in functions/api/[[route]].js:
--   1. submitGuestCheckIn's crash handler (logs check-in submission errors)
--   2. logScriptEvent (new — Apps Script execution logging for the
--      enquiry follow-up reminder feature)
-- Both have been silently failing to log anything whenever they hit
-- this INSERT, since there was nowhere for it to land. This does not
-- mean submitGuestCheckIn itself was broken — only that crash details
-- weren't being recorded when something did go wrong.
--
-- Run via D1 Admin / D1 console. Plain statement, no transaction needed.

CREATE TABLE IF NOT EXISTS processing_log (
  log_id     TEXT PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'info',   -- info|success|warning|error
  stay_id    TEXT,                            -- a real stay_id/enquiry_id when applicable,
                                               -- 'unknown' or 'script:<name>' otherwise
  note       TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_processing_log_created ON processing_log(created_at);
CREATE INDEX IF NOT EXISTS idx_processing_log_stay    ON processing_log(stay_id);

-- Verify after running:
-- SELECT name FROM sqlite_master WHERE type='table' AND name='processing_log';
-- (should now return exactly one row)
