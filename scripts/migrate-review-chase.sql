-- Review chase columns — track WhatsApp nudges and auto-close logic
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-review-chase.sql --remote

ALTER TABLE stays ADD COLUMN review_chased_at TEXT DEFAULT NULL;  -- last WhatsApp sent timestamp
ALTER TABLE stays ADD COLUMN review_chase_count INTEGER DEFAULT 0; -- how many times chased
