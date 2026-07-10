-- ============================================================================
-- ROLLBACK — RELEASE 2.1 — TABLE NAMESPACE: platform_
-- ============================================================================
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/rollback-v2.1-namespace-platform.sql --remote
-- ============================================================================

ALTER TABLE platform_tenants     RENAME TO tenants;
ALTER TABLE platform_auth_tokens RENAME TO auth_tokens;

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'platform_%';  -- should be empty
