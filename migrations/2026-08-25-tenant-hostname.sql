-- platform_tenants.primary_hostname has existed unused since the table was
-- created. Populating it is what lets the worker answer "which host is this?"
-- from the request itself rather than from a per-deployment variable.
UPDATE platform_tenants SET primary_hostname = 'dwarka.stayvibe360.com'
 WHERE tenant_id = 'dwarka' AND (primary_hostname IS NULL OR primary_hostname = '');
CREATE INDEX IF NOT EXISTS idx_tenants_hostname ON platform_tenants(primary_hostname);
