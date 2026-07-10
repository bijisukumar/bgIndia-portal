-- ============================================================================
-- RELEASE 2.1 — TABLE NAMESPACE: platform_ (SaaS tenancy + auth, 2 tables)
-- ============================================================================
-- *** DO NOT RUN until the worker SQL rewrite (functions/api/[[route]].js)
-- *** targeting these new names has landed and deployed.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-v2.1-namespace-platform.sql --remote
-- Rollback: scripts/rollback-v2.1-namespace-platform.sql
--
-- tenants/auth_tokens are the cross-cutting SaaS tenancy + auth mechanism
-- used by every app AND by the externally-deployed scripts/GuestFormScript.gs
-- (via the worker's getTenantConfig action, not directly — confirmed the
-- .gs file itself needs no change). Given their own platform_ namespace,
-- distinct from infra_ (shared logging/audit tables), since they represent
-- SaaS-tenancy identity rather than infrastructure logging.
-- ============================================================================

-- ── TABLE RENAMES ──────────────────────────────────────────────
ALTER TABLE tenants     RENAME TO platform_tenants;
ALTER TABLE auth_tokens RENAME TO platform_auth_tokens;

-- tenants/auth_tokens have no indexes today (verified live) — none to rename.

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'platform_%' ORDER BY name;
