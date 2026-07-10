-- ============================================================================
-- MULTI-TENANT FOUNDATION: tenant billing fields, platform_properties,
-- redesigned platform_auth_tokens (hashed PINs, not plaintext)
-- ============================================================================
-- Rollback point: git tag pre-multitenant-auth-2026-07-10 (commit 213237b)
-- Rollback script: scripts/rollback-multitenant-properties-auth.sql
--
-- Safe to run: platform_auth_tokens confirmed 0 rows in production
-- (verified 2026-07-10 immediately before writing this script). No data
-- loss — dropping and recreating it changes shape only, nothing to lose.
-- platform_tenants gets ADD COLUMN only (additive, no data at risk) —
-- confirmed 1 existing row (tenant_id='dwarka') stays untouched.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-multitenant-properties-auth.sql --remote
-- ============================================================================

-- ── platform_tenants: add billing/profile fields ────────────────────────
ALTER TABLE platform_tenants ADD COLUMN billing_contact_name TEXT;
ALTER TABLE platform_tenants ADD COLUMN billing_email TEXT;
ALTER TABLE platform_tenants ADD COLUMN primary_hostname TEXT;

-- ── platform_properties: new tenant<->property ownership table ─────────
-- property_id uses the SAME identifier values already used as villa_id
-- across stayvibe_* tables (e.g. property_id='dwarka' == villa_id='dwarka'
-- in stayvibe_stays) — this is the ownership/auth record, not a duplicate
-- of hosts/<id>/config.js's villas[] branding array.
CREATE TABLE IF NOT EXISTS platform_properties (
  property_id  TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES platform_tenants(tenant_id),
  name         TEXT,
  unit_type    TEXT DEFAULT 'villa',
  active       INTEGER DEFAULT 1,
  created_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_platform_properties_tenant ON platform_properties(tenant_id);

-- Seed dwarka's own property row NOW, as part of this migration — not a
-- later step. Without this, the worker's self-healing legacy-PIN login
-- path would match the PIN correctly but find zero properties for
-- tenant_id='dwarka', so assertPropertyAccess would then lock everyone
-- out on their very next real request. This has to land before the new
-- worker code goes live, not after.
INSERT OR IGNORE INTO platform_properties (property_id, tenant_id, name, unit_type, active, created_at)
VALUES ('dwarka', 'dwarka', 'Dwarka Villa', 'villa', 1, datetime('now'));

-- ── platform_auth_tokens: redesign to hashed PIN, not plaintext ─────────
-- Old shape had `token TEXT PRIMARY KEY` (the raw PIN itself, readable by
-- any DB-browsing tool like D1Explorer.jsx). Confirmed 0 rows in
-- production, so this is a clean drop+recreate, not a data migration.
DROP TABLE IF EXISTS platform_auth_tokens;
CREATE TABLE platform_auth_tokens (
  token_hash  TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES platform_tenants(tenant_id),
  role        TEXT NOT NULL,
  actor       TEXT NOT NULL,   -- short internal slug, e.g. 'raman', 'pradosh' (estate routing keys off this)
  label       TEXT,            -- display name, e.g. 'RamananKutty'
  active      INTEGER DEFAULT 1,
  created_at  TEXT
);

-- ── VERIFY ───────────────────────────────────────────────────────────────
SELECT tenant_id, villa_name, active, billing_contact_name, billing_email, primary_hostname
  FROM platform_tenants;
SELECT sql FROM sqlite_master WHERE name IN ('platform_properties', 'platform_auth_tokens');
