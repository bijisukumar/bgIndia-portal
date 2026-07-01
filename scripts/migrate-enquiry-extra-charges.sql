-- Adds a generic "extra charges" line-item system to enquiries, mirroring
-- the one already used on stays (see migrate-extra-lines.sql). Lets the owner
-- add ad-hoc priced line items to a quote (e.g. "Additional Guest: ₹750")
-- on top of the rate-card quote_amount, independent of the B2B/loyalty
-- discount_pct override.
--
-- final_offer_amount is now: quote_amount - discount_amount + extra_charges
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-enquiry-extra-charges.sql --remote
ALTER TABLE enquiries ADD COLUMN extra_charges REAL DEFAULT 0;
ALTER TABLE enquiries ADD COLUMN extra_lines   TEXT DEFAULT NULL; -- JSON: [{label, amount}]
