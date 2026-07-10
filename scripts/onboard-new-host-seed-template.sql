-- ============================================================================
-- NEW HOST ONBOARDING — platform_tenants / platform_auth_tokens seed template
-- ============================================================================
-- Copy this file (don't edit in place), fill in every <PLACEHOLDER>, then:
--   npx wrangler d1 execute <hostId>-db --file=scripts/onboard-<hostId>-seed.sql --remote
--
-- This is the DB-side half of onboarding (see docs/ONBOARDING.md §B.2).
-- The other half is hosts/<hostId>/config.js — that file holds the
-- static/branding config; this seed holds the values that must be
-- changeable WITHOUT a redeploy (rates, phone numbers, check-in/checkout
-- times) plus the auth token that maps a login to this tenant.
--
-- tenant_id below MUST exactly match the villa id used in
-- hosts/<hostId>/config.js's villas[].id AND the wrangler.toml
-- DEFAULT_VILLA_ID var for this host's Pages project — all three have to
-- agree or getTenantConfig/auth will silently resolve to the wrong tenant.
-- ============================================================================

INSERT INTO platform_tenants (
  tenant_id, villa_name, owner_email, owner_email_cc,
  drive_root_id, airbnb_email,
  phone1, phone2, guest_contact,
  address, checkin_time, checkout_time,
  breakfast_rate, raman_comm_pct,
  plan, active, created_at
) VALUES (
  '<TENANT_ID>',                    -- must match villas[].id in hosts/<hostId>/config.js
  '<VILLA_DISPLAY_NAME>',           -- e.g. 'Sunset Villa (Alibaug)'
  '<OWNER_EMAIL>',                  -- receives alerts + guest form notifications
  '<OWNER_EMAIL_CC>',               -- CC'd on all owner emails (can equal OWNER_EMAIL)
  '<GOOGLE_DRIVE_ROOT_FOLDER_ID>',
  '<AIRBNB_NOTIFICATION_EMAIL>',    -- inbox the Airbnb reservation poller watches
  '<PHONE_1>',                      -- villa landline / main
  '<PHONE_2>',                      -- owner mobile (operations)
  '<GUEST_CONTACT_PHONE>',          -- shown to guests for queries
  '<FULL_ADDRESS>',
  '<CHECKIN_TIME_24H>',             -- e.g. '16:00'
  '<CHECKOUT_TIME_24H>',            -- e.g. '11:00'
  <BREAKFAST_RATE_INR>,             -- integer, ₹ per person per day
  <MANAGER_COMMISSION_PCT>,         -- integer, % commission for on-site manager
  'starter',                        -- plan tier — adjust once plans are differentiated
  1,
  datetime('now')
);

-- One row per login credential this host needs (owner, manager, estate
-- manager, etc.). SYSTEM_TOKEN below is what scripts/GuestFormScript.gs
-- and the reservation pollers authenticate with — generate a fresh random
-- token per host, never reuse another host's.
INSERT INTO platform_auth_tokens (token, tenant_id, role, label, active, created_at)
VALUES
  ('<GENERATE_RANDOM_SYSTEM_TOKEN>', '<TENANT_ID>', 'system', 'Apps Script system token', 1, datetime('now'));

-- Optional additional owner/manager login tokens (PINs are separate — env
-- vars PIN_OWNER/PIN_RAMAN/PIN_PRADOSH per Pages project — these rows are
-- only needed if/when this host moves to token-based login instead of PINs):
-- INSERT INTO platform_auth_tokens (token, tenant_id, role, label, active, created_at)
-- VALUES ('<TOKEN>', '<TENANT_ID>', 'owner', '<Owner name> owner login', 1, datetime('now'));

-- Verify after running:
SELECT * FROM platform_tenants WHERE tenant_id = '<TENANT_ID>';
SELECT * FROM platform_auth_tokens WHERE tenant_id = '<TENANT_ID>';
