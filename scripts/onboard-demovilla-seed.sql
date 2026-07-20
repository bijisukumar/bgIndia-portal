-- ============================================================================
-- DEMOVILLA — sales-demo tenant seed (filled from
-- scripts/onboard-new-host-seed-template.sql)
--
-- Run once against demovilla-db (a dedicated D1 database, separate from
-- production bgindia-db — no isolation risk to Dwarka's real data):
--   npx wrangler d1 execute demovilla-db --file=scripts/onboard-demovilla-seed.sql --remote
--
-- PINs are hashed below, never stored in plaintext (same convention the
-- worker itself follows — see functions/api/[[route]].js hashPin()). The
-- actual PIN values are known to Biji out of band, not recorded in git.
-- Hashes computed via:
--   node -e "console.log(require('crypto').createHash('sha256').update('<PIN>').digest('hex'))"
-- ============================================================================

INSERT INTO platform_tenants (
  tenant_id, villa_name, owner_email, owner_email_cc,
  drive_root_id, airbnb_email,
  phone1, phone2, guest_contact,
  address, checkin_time, checkout_time,
  breakfast_rate, raman_comm_pct,
  plan, active, created_at,
  billing_contact_name, billing_email, primary_hostname
) VALUES (
  'demovilla',
  'Demo Villa — Simulation Host',
  'demo-owner@example.test',
  'demo-owner@example.test',
  'demo-drive-root-id',
  'demo-airbnb@example.test',
  '+1 900 000 0001',
  '+1 900 000 0002',
  '+1 900 000 0003',
  '123 Demo Street, Test City, Kerala 680000',
  '16:00',
  '11:00',
  300,
  10,
  'demo',
  1,
  datetime('now'),
  'Demo Owner',
  'demo-owner@example.test',
  'demo.stayvibe360.com'
);

INSERT INTO platform_properties (property_id, tenant_id, name, unit_type, active, created_at)
VALUES ('demovilla', 'demovilla', 'Demo Villa — Simulation Host', 'villa', 1, datetime('now'));

INSERT INTO platform_auth_tokens (token_hash, tenant_id, role, actor, label, active, created_at)
VALUES
  ('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'demovilla', 'owner',   'owner',   'Demo Owner',   1, datetime('now')),
  ('f8638b979b2f4f793ddb6dbd197e0ee25a7a6ea32b0ae22f5e3c5d119d839e75', 'demovilla', 'manager', 'manager', 'Demo Manager', 1, datetime('now'));

SELECT * FROM platform_tenants WHERE tenant_id = 'demovilla';
SELECT * FROM platform_properties WHERE tenant_id = 'demovilla';
SELECT token_hash, tenant_id, role, actor, label, active FROM platform_auth_tokens WHERE tenant_id = 'demovilla';
