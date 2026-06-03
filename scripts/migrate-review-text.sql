-- Add review_text column to store the actual review content from Airbnb
-- Run: paste into D1 console at dash.cloudflare.com
ALTER TABLE stays ADD COLUMN review_text TEXT DEFAULT NULL;
