-- Mirrors rev360_incoming_tenants' deposit_paid/deposit_paid_date/
-- deposit_payment_mode columns onto rev360_rental_props. Without this,
-- Generate Deposit Receipt for an already-Active tenant has no real
-- payment date to read and always stamps today's date instead of when
-- the deposit was actually received.
ALTER TABLE rev360_rental_props ADD COLUMN deposit_paid INTEGER DEFAULT 0;
ALTER TABLE rev360_rental_props ADD COLUMN deposit_paid_date TEXT;
ALTER TABLE rev360_rental_props ADD COLUMN deposit_payment_mode TEXT;
