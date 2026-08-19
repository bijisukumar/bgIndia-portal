-- ============================================================================
-- MIGRATION: staff compensation type + check-in/check-out audit trail
-- ============================================================================
-- Adds:
--   platform_auth_tokens.comp_type — one of:
--     'commission'             (default, matches existing behavior — Raman)
--     'salary'                 (fixed pay, no commission ever — e.g. Pradosh)
--     'salary_plus_commission' (fixed pay PLUS commission on stays — for
--                               future SaaS hosts; not used by anyone today)
--   platform_auth_tokens.base_salary — fixed pay amount. Only meaningful for
--     'salary'/'salary_plus_commission'. Storage only for now — there's no
--     payroll/salary-payment feature yet, this just captures the config
--     value so it exists when one is built.
--   platform_auth_tokens.commission_single_night / commission_multi_night —
--     THE commission rate itself, now a per-staff config value instead of
--     the hardcoded COMMISSION_SINGLE_NIGHT/COMMISSION_MULTI_NIGHT constants
--     in functions/api/[[route]].js. Defaults (1000/2000) exactly match
--     Raman's current rate, so this is a zero-behavior-change migration for
--     him — a future host's manager could be seeded with different numbers.
--     Only meaningful for 'commission'/'salary_plus_commission'.
--   stayvibe_stays.checked_in_by / checked_out_by — separate from the
--     generic updated_by (which later financial/detail edits overwrite),
--     these are stamped once, only by confirmCheckIn/checkOut, so "who
--     checked this guest in" stays accurate no matter what happens to the
--     stay afterward.
--
-- All ALTERs are safe to run once; SQLite errors on re-adding an existing
-- column, so don't re-run this file if it already succeeded.
--
--   npx wrangler d1 execute bgindia-db --file=scripts/migrate-add-staff-comptype-and-checkin-audit.sql --remote
-- ============================================================================

ALTER TABLE platform_auth_tokens ADD COLUMN comp_type                TEXT DEFAULT 'commission';
ALTER TABLE platform_auth_tokens ADD COLUMN base_salary              REAL DEFAULT 0;
ALTER TABLE platform_auth_tokens ADD COLUMN commission_single_night  REAL DEFAULT 1000;
ALTER TABLE platform_auth_tokens ADD COLUMN commission_multi_night   REAL DEFAULT 2000;
ALTER TABLE stayvibe_stays        ADD COLUMN checked_in_by  TEXT DEFAULT NULL;
ALTER TABLE stayvibe_stays        ADD COLUMN checked_out_by TEXT DEFAULT NULL;

-- Verify:
-- SELECT sql FROM sqlite_master WHERE name IN ('platform_auth_tokens','stayvibe_stays');
