-- Migration: add missing rental_props columns
-- Run via D1 Admin / D1 console. Plain sequential statements only —
-- D1 console does not support BEGIN TRANSACTION / COMMIT.
--
-- Part A — columns the frontend (RentalAgreement.jsx) already sends on every
-- save, but which schema.sql never defined. Without these, saveRentalAgreement
-- (added in this same change) cannot persist tenant email, country, currency,
-- the drive folder path, or status — the exact fields visible on the form.
ALTER TABLE rental_props ADD COLUMN tenant_email     TEXT;
ALTER TABLE rental_props ADD COLUMN country          TEXT DEFAULT 'IN';
ALTER TABLE rental_props ADD COLUMN currency         TEXT DEFAULT 'INR';
ALTER TABLE rental_props ADD COLUMN drive_folder_url TEXT;
ALTER TABLE rental_props ADD COLUMN status           TEXT DEFAULT 'Active';

-- Part B — new fields requested: renewal reminders, early termination,
-- and a simple yes/no checklist of which documents have been captured
-- for this tenancy (actual files are stored remotely by the owner; this
-- just tracks completion status, not the files themselves).
ALTER TABLE rental_props ADD COLUMN next_renewal_date    TEXT;   -- YYYY-MM-DD, drives renewal reminders
ALTER TABLE rental_props ADD COLUMN early_terminated      INTEGER DEFAULT 0;  -- 0/1 flag
ALTER TABLE rental_props ADD COLUMN early_termination_date TEXT; -- YYYY-MM-DD, set only if early_terminated = 1

ALTER TABLE rental_props ADD COLUMN doc_contract_signed INTEGER DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN doc_id_captured     INTEGER DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN doc_move_in         INTEGER DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN doc_move_out        INTEGER DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN doc_damage_report   INTEGER DEFAULT 0;

-- Verify after running:
-- SELECT prop_id, name, tenant_name, status, next_renewal_date, early_terminated,
--        doc_contract_signed, doc_id_captured, doc_move_in, doc_move_out, doc_damage_report
-- FROM rental_props;
