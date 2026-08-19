-- ============================================================================
-- MIGRATION: staff compensation type + check-in/check-out audit trail
-- ============================================================================
-- Adds:
--   platform_auth_tokens.comp_type — 'commission' (default, matches existing
--     behavior) or 'salary'. Only meaningful for role='manager': a salaried
--     manager never accrues a stayvibe_manager_commissions row on checkout,
--     and is blocked (server-side, not just hidden in the UI) from the
--     commission report even by calling the API directly.
--   stayvibe_stays.checked_in_by / checked_out_by — separate from the
--     generic updated_by (which later financial/detail edits overwrite),
--     these are stamped once, only by confirmCheckIn/checkOut, so "who
--     checked this guest in" stays accurate no matter what happens to the
--     stay afterward.
--
-- Both ALTERs are safe to run once; SQLite errors on re-adding an existing
-- column, so don't re-run this file if it already succeeded.
--
--   npx wrangler d1 execute bgindia-db --file=scripts/migrate-add-staff-comptype-and-checkin-audit.sql --remote
-- ============================================================================

ALTER TABLE platform_auth_tokens ADD COLUMN comp_type TEXT DEFAULT 'commission';
ALTER TABLE stayvibe_stays        ADD COLUMN checked_in_by  TEXT DEFAULT NULL;
ALTER TABLE stayvibe_stays        ADD COLUMN checked_out_by TEXT DEFAULT NULL;

-- Verify:
-- SELECT sql FROM sqlite_master WHERE name IN ('platform_auth_tokens','stayvibe_stays');
