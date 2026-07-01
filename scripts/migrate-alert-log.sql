-- Persistent record of every outbound owner-alert email attempt (success or
-- failure) so you can check whether emails are actually being sent without
-- needing live Cloudflare Logs / wrangler tail access — browsable via the
-- D1 Explorer screen like any other table.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-alert-log.sql --remote
CREATE TABLE IF NOT EXISTS alert_log (
  log_id       TEXT PRIMARY KEY,
  villa_id     TEXT,
  subject      TEXT,
  to_email     TEXT,
  success      INTEGER NOT NULL,
  status_code  INTEGER,
  error_detail TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_log_created ON alert_log(created_at DESC);
