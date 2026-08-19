-- ============================================================================
-- NEW STAFF LOGIN — Pradosh (villa check-in/check-out staff, salaried)
-- ============================================================================
-- Run scripts/migrate-add-staff-comptype-and-checkin-audit.sql FIRST — this
-- seed needs the comp_type column to exist.
--
-- Distinct from the EXISTING 'pradosh' actor already used for the estate
-- app (role 'estate_manager', Pollachi coconut estate) — that's a different
-- login for a different purpose. This is a NEW, separate PIN for the villa
-- app specifically, using actor 'staff-pradosh' so the two never collide.
--
-- ── STEP 1: pick a PIN and hash it ─────────────────────────────────────
--   node -e "console.log(require('crypto').createHash('sha256').update('<CHOSEN_PIN>').digest('hex'))"
--
-- comp_type 'salary' means he never accrues commission — commission_single_
-- night/commission_multi_night are irrelevant for him and left at their
-- defaults. base_salary is optional (defaults to 0) — no payroll feature
-- reads it yet, it's just captured for whenever one exists; set it below
-- if you want the figure on record now.
-- ============================================================================

INSERT INTO platform_auth_tokens (token_hash, tenant_id, role, actor, label, comp_type, base_salary, active, created_at)
VALUES ('<STAFF_PRADOSH_PIN_HASH>', 'dwarka', 'manager', 'staff-pradosh', 'Pradosh', 'salary', 0, 1, datetime('now'));
-- Replace the 0 above with a monthly figure if you want it on record, e.g. 15000

-- Verify:
SELECT token_hash, tenant_id, role, actor, label, comp_type, base_salary, active FROM platform_auth_tokens WHERE actor = 'staff-pradosh';
