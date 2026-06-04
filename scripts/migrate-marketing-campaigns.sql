-- ============================================================
-- Marketing Campaigns & Analytics
-- Run against bgindia-db
-- ============================================================

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id            TEXT PRIMARY KEY,
  campaign_name TEXT NOT NULL,
  unique_token  TEXT NOT NULL UNIQUE,
  channel       TEXT DEFAULT 'whatsapp',
  villa_id      TEXT DEFAULT 'dwarka',
  is_active     INTEGER DEFAULT 1,
  notes         TEXT,
  created_by    TEXT DEFAULT 'owner',
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campaigns_token  ON marketing_campaigns(unique_token);
CREATE INDEX IF NOT EXISTS idx_campaigns_villa  ON marketing_campaigns(villa_id, is_active);

CREATE TABLE IF NOT EXISTS campaign_analytics (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES marketing_campaigns(id),
  event_type  TEXT NOT NULL CHECK(event_type IN ('click','inquiry','booking')),
  country     TEXT,
  region      TEXT,
  city        TEXT,
  user_agent  TEXT,
  referrer    TEXT,
  ts          TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_analytics_campaign ON campaign_analytics(campaign_id, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_ts        ON campaign_analytics(ts);
