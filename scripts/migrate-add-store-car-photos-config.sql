-- ============================================================================
-- MIGRATION: platform_tenants.store_car_photos
-- ============================================================================
-- Default OFF (0) — most hosts don't need car/plate PHOTOS kept
-- permanently once the plate number itself is on record as text; storing
-- images in Drive forever adds up in storage cost across many hosts for
-- little benefit. When off, processPendingDocumentUploads
-- (scripts/GuestFormScript.gs) skips uploading car_photo/plate_photo docs
-- entirely — they just expire from D1 on the existing 5-day sweep, same
-- as before either feature existed. Flip a host's row to 1 if they want
-- theirs kept:
--   UPDATE platform_tenants SET store_car_photos = 1 WHERE tenant_id = 'dwarka';
--
--   npx wrangler d1 execute bgindia-db --file=scripts/migrate-add-store-car-photos-config.sql --remote
-- ============================================================================

ALTER TABLE platform_tenants ADD COLUMN store_car_photos INTEGER DEFAULT 0;

-- Verify:
-- SELECT tenant_id, store_car_photos FROM platform_tenants;
