-- Add irrigation_logs table to bgindiadb-estates
-- Run: npx wrangler d1 execute bgindiadb-estates --file=scripts/migrate-irrigation-logs.sql --remote

CREATE TABLE IF NOT EXISTS irrigation_logs (
  log_id      TEXT PRIMARY KEY,
  estate      TEXT DEFAULT 'pollachi',
  logged_date TEXT NOT NULL,
  notes       TEXT,
  created_by  TEXT DEFAULT 'pradosh',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_irrigation_date ON irrigation_logs(estate, logged_date DESC);

SELECT 'irrigation_logs table ready' as status;
