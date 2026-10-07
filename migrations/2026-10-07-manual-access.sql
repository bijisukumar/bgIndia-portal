-- Access control for the public owner Training Manual (/Training-Manual).
--
-- The manual is open to anyone with the link until its owner switches it to
-- "passcode only". In that mode each outsider is given their own passcode with
-- a time limit, which the owner can extend or revoke.
--
-- Only a KEYED hash of a passcode is stored, never the passcode itself - the
-- same rule as staff PINs (platform_auth_tokens): the DB Explorer can read
-- every table, and a passcode is exactly what must not be readable there.
-- The key is the worker's JWT_SECRET, so a copy of this table alone cannot be
-- used to work a passcode out.
--
-- Applied to bgindia-db, which serves every host (dwarka, demo, ...): the
-- worker picks the tenant from the request's hostname, and every row here is
-- scoped by villa_id.

CREATE TABLE IF NOT EXISTS stayvibe_manual_passcodes (
  passcode_id  TEXT PRIMARY KEY,
  villa_id     TEXT NOT NULL DEFAULT 'dwarka',
  label        TEXT NOT NULL,             -- who it was made for, e.g. "Raj - Acme Travels"
  code_hash    TEXT NOT NULL,             -- HMAC-SHA256 of the passcode, hex
  expires_at   TEXT,                      -- UTC 'YYYY-MM-DD HH:MM:SS'; NULL = no time limit
  revoked_at   TEXT,                      -- UTC; once set the passcode no longer works
  created_by   TEXT DEFAULT 'owner',
  created_at   TEXT DEFAULT (datetime('now')),
  last_used_at TEXT,
  use_count    INTEGER DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_pc_hash  ON stayvibe_manual_passcodes(villa_id, code_hash);
CREATE INDEX        IF NOT EXISTS idx_manual_pc_villa ON stayvibe_manual_passcodes(villa_id, created_at);

-- One row per villa. No row means the default, 'open'. Kept in its own table
-- rather than stayvibe_villa_settings because that generic key/value store is
-- writable by any signed-in role, and this switch must be the owner's alone.
CREATE TABLE IF NOT EXISTS stayvibe_manual_settings (
  villa_id   TEXT PRIMARY KEY,
  mode       TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'passcode'
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
