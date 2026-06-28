-- Migration: add deposit payment tracking to incoming_tenants
--
-- The Incoming Tenant card already has a `deposit` field (the amount
-- DUE), but nothing tracking whether it's actually been PAID, or when/
-- how. Needed for two new buttons: "Mark Deposit Paid" and "Generate
-- Deposit Receipt" -- the receipt generator needs a real payment date
-- and mode, same fields the existing downloadDepositReceipt() already
-- expects via agreement._depositPaymentMode (see generateReceipt.js).
--
-- Run via D1 Admin / D1 console. Plain sequential statements only.

ALTER TABLE incoming_tenants ADD COLUMN deposit_paid        INTEGER DEFAULT 0;
ALTER TABLE incoming_tenants ADD COLUMN deposit_paid_date   TEXT;
ALTER TABLE incoming_tenants ADD COLUMN deposit_payment_mode TEXT;

-- Verify after running:
-- PRAGMA table_info(incoming_tenants);
