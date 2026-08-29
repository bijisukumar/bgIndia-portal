-- getTenantConfig never actually returned a bedroomCount field, so
-- GuestFormScript.gs's `resp.data.bedroomCount || 4` fallback fired on
-- every single run for every tenant, not just when the API call failed —
-- happened to be correct for dwarka only because 4 is also dwarka's real
-- bedroom count. A second tenant with a different count would have
-- silently gotten the wrong number in guest confirmation emails.
ALTER TABLE platform_tenants ADD COLUMN bedroom_count INTEGER DEFAULT 4;
UPDATE platform_tenants SET bedroom_count = 4 WHERE tenant_id = 'dwarka';
