-- Migration: add month-to-month tracking to rental_props
--
-- Real scenario: a fixed-term lease ends and rather than signing a new
-- fixed term, owner and tenant informally continue on a rolling monthly
-- basis. Today that just looks like an "expired" lease forever, which
-- wrongly keeps the red expiry/renewal-overdue warnings showing on a
-- tenancy that's actually fine — just not on a fixed term anymore.
--
-- is_month_to_month: 0/1 flag. While set, BOTH the lease-expiry warning
-- AND the renewal-overdue warning are suppressed on the Tenant
-- Agreement screen (explicit decision, 2026-06-27) -- this is treated
-- as "this tenancy doesn't have an end date to track" rather than a
-- softer version of the same warnings.
--
-- month_to_month_since: the date the tenancy actually went rolling,
-- for reference (distinct from lease_end, which stays as the original
-- fixed term's end date and is NOT overwritten by this).
--
-- Run via D1 Admin / D1 console. Plain sequential statements only.

ALTER TABLE rental_props ADD COLUMN is_month_to_month     INTEGER DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN month_to_month_since  TEXT;

-- Verify after running:
-- PRAGMA table_info(rental_props);
