-- Per-villa configurable settings — key/value, so future SaaS tenants
-- (new villa onboarding) are configured by changing rows here, never by
-- touching code. First key: 'owner_email_alert'.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-villa-settings.sql --remote
CREATE TABLE IF NOT EXISTS villa_settings (
  villa_id     TEXT NOT NULL,
  key          TEXT NOT NULL,
  value        TEXT,
  updated_by   TEXT,
  updated_at   TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (villa_id, key)
);

INSERT OR REPLACE INTO villa_settings (villa_id, key, value, updated_by, updated_at)
VALUES ('dwarka', 'owner_email_alert', 'bijits@hotmail.com', 'system', datetime('now'));
