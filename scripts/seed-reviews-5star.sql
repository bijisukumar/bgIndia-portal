-- ============================================================
-- Bulk set all existing stays to 5-star Google review
-- Run once to reflect the historical Google reviews we received.
-- Only updates stays that don't already have a review rating.
-- ============================================================

UPDATE stays
SET review_rating  = 5,
    review_source  = 'google',
    review_date    = checkout_date,
    updated_by     = 'owner',
    updated_at     = datetime('now')
WHERE status NOT IN ('cancelled')
  AND (review_rating IS NULL OR review_rating = 0)
  AND checkout_date IS NOT NULL
  AND checkout_date != '';

-- Verify
SELECT COUNT(*) AS updated_stays,
       AVG(review_rating) AS avg_rating
FROM stays
WHERE review_rating = 5;
