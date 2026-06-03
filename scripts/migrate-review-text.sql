-- Add review content columns for showcase page
-- Run: paste each line separately into D1 console
ALTER TABLE stays ADD COLUMN review_text TEXT DEFAULT NULL;
ALTER TABLE stays ADD COLUMN review_note TEXT DEFAULT NULL;
ALTER TABLE stays ADD COLUMN review_highlights TEXT DEFAULT NULL;
