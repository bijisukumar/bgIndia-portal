-- Log of every estimate lookup and quote request from the website's estimate page.
-- The worker creates this on first use (ensureWebLeadTable), so running this is optional;
-- it is here so the schema is written down. kind: 'search' | 'request'.
-- status: received | ok | created | duplicate | invalid | spam | rate_limited | failed
CREATE TABLE IF NOT EXISTS stayvibe_web_leads (
  log_id TEXT PRIMARY KEY, villa_id TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT,
  visitor_id TEXT, ip TEXT, country TEXT, region TEXT, city TEXT, postal_code TEXT, timezone TEXT,
  asn TEXT, as_org TEXT, colo TEXT, user_agent TEXT, referer TEXT, origin TEXT, language TEXT,
  checkin_date TEXT, checkout_date TEXT, adults INTEGER, children INTEGER, infants INTEGER,
  available INTEGER, approx_total REAL,
  guest_name TEXT, phone TEXT, email TEXT, message TEXT, enquiry_id TEXT, error TEXT);
CREATE INDEX IF NOT EXISTS stayvibe_idx_web_leads_created ON stayvibe_web_leads(villa_id, created_at DESC);
