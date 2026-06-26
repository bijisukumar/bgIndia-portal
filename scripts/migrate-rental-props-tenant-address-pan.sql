-- Migration: add tenant_address and tenant_pan to rental_props
-- Run via D1 Admin / D1 console. Plain sequential statements only.
--
-- Needed for the new Lease Deed generator (Tenant Agreement screen):
-- the lease document requires the tenant's full address and PAN/Aadhaar
-- number, neither of which was previously captured anywhere on the form.

ALTER TABLE rental_props ADD COLUMN tenant_address TEXT;
ALTER TABLE rental_props ADD COLUMN tenant_pan     TEXT;  -- PAN or Aadhaar number, free text

-- Verify after running:
-- SELECT prop_id, tenant_name, tenant_address, tenant_pan FROM rental_props;
