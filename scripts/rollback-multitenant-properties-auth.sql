-- ============================================================================
-- ROLLBACK for scripts/migrate-multitenant-properties-auth.sql
-- ============================================================================
-- SQLite can't DROP COLUMN in older versions cleanly via a single
-- statement here — D1 supports DROP COLUMN (SQLite >= 3.35), used below.
-- Only run this if the worker has ALREADY been reverted to the
-- pre-multitenant login/auth code (git tag pre-multitenant-auth-2026-07-10)
-- — running this while the new worker code is still live will break login.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/rollback-multitenant-properties-auth.sql --remote
-- ============================================================================

DROP TABLE IF EXISTS platform_properties;

DROP TABLE IF EXISTS platform_auth_tokens;
CREATE TABLE platform_auth_tokens (
  token       TEXT PRIMARY KEY,
  tenant_id   TEXT,
  role        TEXT,
  label       TEXT,
  active      INTEGER DEFAULT 1,
  created_at  TEXT
);

ALTER TABLE platform_tenants DROP COLUMN billing_contact_name;
ALTER TABLE platform_tenants DROP COLUMN billing_email;
ALTER TABLE platform_tenants DROP COLUMN primary_hostname;

-- ── VERIFY ───────────────────────────────────────────────────────────────
SELECT sql FROM sqlite_master WHERE name = 'platform_tenants';
SELECT name FROM sqlite_master WHERE name IN ('platform_properties', 'platform_auth_tokens');
