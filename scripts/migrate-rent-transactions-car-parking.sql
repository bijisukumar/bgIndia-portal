-- Migration: add car_parking to rent_transactions
--
-- Per explicit decision (2026-06-27): car parking income is part of the
-- tenant's monthly dues, tracked alongside rent/maintenance rather than
-- in the separate property_expenses table (even though "parking" sounds
-- expense-adjacent, it's actually income FROM the tenant, same as rent).
--
-- total_due is NOT recomputed by this migration for existing rows --
-- it already correctly equals base_rent + maintenance + late_fee for
-- everything posted so far (car_parking defaults to 0, so existing
-- totals stay correct). Only new postings going forward will include
-- a non-zero car_parking in the total.
--
-- Run via D1 Admin / D1 console. Plain sequential statements only.

ALTER TABLE rent_transactions ADD COLUMN car_parking REAL NOT NULL DEFAULT 0;

-- Verify after running:
-- PRAGMA table_info(rent_transactions);
