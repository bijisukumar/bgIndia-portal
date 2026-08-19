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
-- ============================================================================

INSERT INTO platform_auth_tokens (token_hash, tenant_id, role, actor, label, comp_type, active, created_at)
VALUES ('<STAFF_PRADOSH_PIN_HASH>', 'dwarka', 'manager', 'staff-pradosh', 'Pradosh', 'salary', 1, datetime('now'));

-- Verify:
SELECT token_hash, tenant_id, role, actor, label, comp_type, active FROM platform_auth_tokens WHERE actor = 'staff-pradosh';
