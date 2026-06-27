-- Migration: rental_props lifecycle model v2
--
-- Replaces the old flat 6-value `status` column (Active, Notice Given,
-- Delinquent, Evicted, Runaway, Completed) with a clearer 3-part model,
-- based directly on how tenancies actually work:
--
--   1. stage          — exactly ONE of: 'Signed Up', 'Active', 'Notice Given', 'Completed'
--                        ('Signed Up' = lease agreed, tenant hasn't moved in yet — a
--                        concept that didn't exist before this migration at all)
--   2. is_delinquent   — 0/1 FLAG that can sit on top of 'Active' or 'Notice Given'
--                        (behind on rent while still living there) — NOT its own stage
--   3. end_reason      — only meaningful when stage = 'Completed': one of
--                        'Lease Ended' / 'Early Termination' / 'Evicted' /
--                        'Runaway' / 'After Delinquency'. NULL otherwise.
--
-- Old `status` values 'Evicted' and 'Runaway' are no longer separate
-- stages — they become stage='Completed' + an end_reason, since they
-- describe HOW a tenancy ended, not an ongoing state distinct from
-- "no longer living here."
--
-- No data migration of existing rows is needed for this project: as of
-- this migration, no property has a saved agreement yet (confirmed with
-- the owner 2026-06-27) — every rental_props row is still at the
-- schema default. The UPDATE below is included anyway as a safety net
-- in case that changes before this runs, so old values aren't silently
-- left unmapped.
--
-- Run via D1 Admin / D1 console. Plain sequential statements only.

ALTER TABLE rental_props ADD COLUMN stage         TEXT DEFAULT 'Signed Up';
ALTER TABLE rental_props ADD COLUMN is_delinquent INTEGER DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN end_reason    TEXT;

-- Safety-net backfill from the old `status` column, in case any row
-- already had a non-default value before this ran.
UPDATE rental_props SET stage = 'Active'       WHERE status = 'Active';
UPDATE rental_props SET stage = 'Notice Given' WHERE status = 'Notice Given';
UPDATE rental_props SET stage = 'Active', is_delinquent = 1 WHERE status = 'Delinquent';
UPDATE rental_props SET stage = 'Completed', end_reason = 'Evicted'  WHERE status = 'Evicted';
UPDATE rental_props SET stage = 'Completed', end_reason = 'Runaway'  WHERE status = 'Runaway';
UPDATE rental_props SET stage = 'Completed', end_reason = 'Lease Ended' WHERE status = 'Completed';

-- `status` itself is deliberately NOT dropped — SQLite's ALTER TABLE
-- DROP COLUMN support varies by version/D1 runtime, and nothing should
-- still read `status` once the frontend switches to `stage`. Leaving
-- it in place, unused, is zero-risk; dropping it is not zero-risk.

-- Verify after running:
-- PRAGMA table_info(rental_props);
-- SELECT prop_id, name, status, stage, is_delinquent, end_reason FROM rental_props;
