-- The Apps Script (GuestFormScript.gs) expects getTenantConfig to return
-- ownerEmail, ownerEmailCC, and driveRootId per tenant -- but the tenants
-- table never had these columns, and getTenantConfig never selected them.
-- Every tenant was silently falling back to the SAME hardcoded values
-- (kerala.luxuryvillas@gmail.com, bijisukumar@gmail.com, one specific
-- Drive folder) regardless of which tenant's config was requested --
-- meaning a second SaaS customer's guest documents would have gone into
-- the FIRST customer's inbox and Drive folder. Fixing before that ever
-- ships to a second tenant.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-tenants-drive-email.sql --remote
ALTER TABLE tenants ADD COLUMN owner_email TEXT;
ALTER TABLE tenants ADD COLUMN owner_email_cc TEXT;
ALTER TABLE tenants ADD COLUMN drive_root_id TEXT;

UPDATE tenants SET
  owner_email    = 'kerala.luxuryvillas@gmail.com',
  owner_email_cc = 'bijisukumar@gmail.com',
  drive_root_id  = '1NglE0BgsxS4wULHuO2N0ydFIErk6rrf2'
WHERE tenant_id = 'dwarka';
