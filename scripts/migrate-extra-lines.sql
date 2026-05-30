-- Store extra charge line items as JSON so they can be restored on screen reload
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-extra-lines.sql --remote
ALTER TABLE stays ADD COLUMN extra_lines TEXT DEFAULT NULL; -- JSON: [{label, amount}]
