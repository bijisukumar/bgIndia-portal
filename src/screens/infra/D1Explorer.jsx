import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SCHEMA_SQL = `-- ============================================================
-- bgIndia Portal — Cloudflare D1 Schema
-- Run once: wrangler d1 execute bgindia-db --file=schema.sql
-- ============================================================

-- STAYS (core StayID lifecycle)
CREATE TABLE IF NOT EXISTS stays (
  stay_id       TEXT PRIMARY KEY,        -- e.g. DWK-2026-0042
  villa_id      TEXT NOT NULL,           -- 'dwarka'
  source        TEXT NOT NULL,           -- 'airbnb'|'direct'|'booking_com'
  airbnb_conf   TEXT,
  guest_name    TEXT NOT NULL,
  guest_phone   TEXT,
  guest_email   TEXT,
  checkin_date  TEXT,                    -- ISO: 2026-05-12
  checkout_date TEXT,
  nights        INTEGER,
  adults        INTEGER DEFAULT 1,
  children      INTEGER DEFAULT 0,
  tariff_per_night REAL,
  extra_charges REAL DEFAULT 0,
  gross         REAL,
  commission_pct REAL DEFAULT 0,
  commission_amt REAL DEFAULT 0,
  net           REAL,
  status        TEXT DEFAULT 'confirmed', -- confirmed|checked_in|checked_out|closed|cancelled
  drive_folder_id TEXT,
  converted_to_direct INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- GUEST REQUESTS
CREATE TABLE IF NOT EXISTS guest_requests (
  req_id      TEXT PRIMARY KEY,
  stay_id     TEXT REFERENCES stays(stay_id),
  type        TEXT,                       -- 'breakfast'|'floor_bed'|'car'|'decor'|'other'
  detail      TEXT,
  status      TEXT DEFAULT 'pending',
  created_at  TEXT DEFAULT (datetime('now'))
);

-- STAY CARS (check-in photos)
CREATE TABLE IF NOT EXISTS stay_cars (
  car_id      TEXT PRIMARY KEY,
  stay_id     TEXT REFERENCES stays(stay_id),
  plate_no    TEXT,
  photo_url   TEXT,
  captured_at TEXT DEFAULT (datetime('now'))
);

-- INVENTORY
CREATE TABLE IF NOT EXISTS inventory (
  item_id         TEXT PRIMARY KEY,
  villa_id        TEXT NOT NULL,
  name            TEXT NOT NULL,
  unit            TEXT,
  category        TEXT,                   -- 'kitchen'|'bathroom'|'bedroom'
  qty_in_stock    INTEGER DEFAULT 0,
  cost_price      REAL DEFAULT 0,
  sell_price      REAL DEFAULT 0,
  last_restocked  TEXT
);

-- STAY INCIDENTALS (checkout billing)
CREATE TABLE IF NOT EXISTS stay_incidentals (
  item_id    TEXT PRIMARY KEY,
  stay_id    TEXT REFERENCES stays(stay_id),
  inv_item_id TEXT REFERENCES inventory(item_id),
  name       TEXT,
  qty        INTEGER,
  price_per_unit REAL,
  total      REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- RENTAL PROPERTIES
CREATE TABLE IF NOT EXISTS rental_props (
  prop_id     TEXT PRIMARY KEY,
  name        TEXT,
  location    TEXT,
  tenant_name TEXT,
  tenant_phone TEXT,
  lease_start TEXT,
  lease_end   TEXT,
  monthly_rent REAL
);

-- RENTAL INCOME LOG
CREATE TABLE IF NOT EXISTS rental_income (
  record_id   TEXT PRIMARY KEY,
  prop_id     TEXT REFERENCES rental_props(prop_id),
  month       INTEGER,
  year        INTEGER,
  rent        REAL DEFAULT 0,
  car_parking REAL DEFAULT 0,
  maintenance REAL DEFAULT 0,
  electricity REAL DEFAULT 0,
  water       REAL DEFAULT 0,
  property_tax REAL DEFAULT 0,
  land_tax    REAL DEFAULT 0,
  extra_maintenance REAL DEFAULT 0,
  net         REAL,
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- COCONUT HARVESTS
CREATE TABLE IF NOT EXISTS coconut_harvests (
  harvest_id        TEXT PRIMARY KEY,
  estate_id         TEXT DEFAULT 'pollachi',
  harvester_name    TEXT,
  harvest_date      TEXT,
  final_payment_date TEXT,
  total_nuts        INTEGER,
  net_good_nuts     INTEGER,
  nuts_rejected     INTEGER,
  additional_unaccounted INTEGER DEFAULT 0,
  total_weight_kg   REAL,
  price_per_kg      REAL,
  avg_weight_per_nut REAL,
  earnings_main     REAL,
  nuts_rejected_b2  INTEGER,
  rejection_revenue REAL DEFAULT 0,
  husk_count_sold   INTEGER DEFAULT 0,
  husk_cost_per_nut REAL DEFAULT 0,
  husk_earnings     REAL DEFAULT 0,
  other_earnings    REAL DEFAULT 0,
  total_earnings    REAL,
  harvest_nuts_exp  INTEGER,
  harvest_cost_nut  REAL DEFAULT 0,
  harvest_expense   REAL DEFAULT 0,
  dehusk_nuts       INTEGER,
  dehusk_cost_nut   REAL DEFAULT 0,
  dehusk_expense    REAL DEFAULT 0,
  tractor_expense   REAL DEFAULT 0,
  other_expense     REAL DEFAULT 0,
  total_expense     REAL,
  net_income        REAL,
  advance_payment   REAL DEFAULT 0,
  advance_date      TEXT,
  second_payment    REAL DEFAULT 0,
  final_settlement  REAL DEFAULT 0,
  balance_due       REAL,
  next_harvest_date TEXT,
  notes             TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);

-- RUBBER HARVESTS  
CREATE TABLE IF NOT EXISTS rubber_harvests (
  harvest_id    TEXT PRIMARY KEY,
  estate_id     TEXT DEFAULT 'pavutumuri',
  harvest_date  TEXT,
  weight_kg     REAL,
  price_per_kg  REAL,
  gross         REAL,
  expense       REAL DEFAULT 0,
  net           REAL,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_stays_villa    ON stays(villa_id, checkin_date);
CREATE INDEX IF NOT EXISTS idx_stays_guest    ON stays(guest_name);
CREATE INDEX IF NOT EXISTS idx_stays_status   ON stays(status);
CREATE INDEX IF NOT EXISTS idx_harvests_date  ON coconut_harvests(harvest_date);
CREATE INDEX IF NOT EXISTS idx_rental_income  ON rental_income(prop_id, year, month);
`

const WRANGLER_CONFIG = `# wrangler.toml — add these lines to your existing config
# ============================================================

[[d1_databases]]
binding = "DB"
database_name = "bgindia-db"
database_id = "YOUR_D1_DATABASE_ID"   # fill after: wrangler d1 create bgindia-db

# ============================================================
# SETUP STEPS:
# 1. npm install -g wrangler
# 2. wrangler login
# 3. wrangler d1 create bgindia-db     ← creates DB, note the database_id
# 4. Paste database_id above
# 5. wrangler d1 execute bgindia-db --file=schema.sql --remote
# 6. Deploy: wrangler pages deploy dist --project-name=bgindia-portal
#
# QUERY EXAMPLE (T-SQL style but SQLite):
# wrangler d1 execute bgindia-db --remote \\
#   --command "SELECT stay_id, guest_name, checkin_date, net FROM stays ORDER BY checkin_date DESC LIMIT 20"
#
# YES — you write standard SQL. D1 is SQLite so syntax is:
#   SELECT, INSERT, UPDATE, DELETE, JOIN, GROUP BY, ORDER BY, WHERE
#   DATE(), strftime(), LIKE, IN, BETWEEN — all work
#   No stored procedures, no window functions (limited support)
#
# FROM THE WORKER (Cloudflare Pages Function):
#   const { results } = await env.DB.prepare(
#     "SELECT * FROM stays WHERE status = ? ORDER BY checkin_date DESC"
#   ).bind('confirmed').all()
# ============================================================
`

const SAMPLE_QUERIES = [
  { label: 'All 2026 stays',           sql: "SELECT stay_id, guest_name, checkin_date, checkout_date, net, status\nFROM stays\nWHERE checkin_date LIKE '2026%'\nORDER BY checkin_date DESC" },
  { label: 'Airbnb vs Direct revenue', sql: "SELECT source, COUNT(*) as bookings, SUM(net) as total_net\nFROM stays\nWHERE status != 'cancelled'\nGROUP BY source\nORDER BY total_net DESC" },
  { label: 'Raman commission owed',    sql: "SELECT guest_name, checkin_date, nights,\n  CASE WHEN nights > 1 THEN 2000 ELSE 1000 END as raman_comm\nFROM stays\nWHERE status = 'checked_out'\nORDER BY checkin_date DESC" },
  { label: 'Coconut harvest summary',  sql: "SELECT strftime('%Y', harvest_date) as year,\n  COUNT(*) as harvests, SUM(total_nuts) as nuts,\n  SUM(total_earnings) as earnings, SUM(net_income) as net\nFROM coconut_harvests\nGROUP BY year ORDER BY year DESC" },
  { label: 'Rental income YTD',        sql: "SELECT p.name, SUM(r.rent + r.car_parking) as income,\n  SUM(r.maintenance + r.electricity + r.water) as expense,\n  SUM(r.net) as net\nFROM rental_income r\nJOIN rental_props p ON r.prop_id = p.prop_id\nWHERE r.year = 2026\nGROUP BY p.name" },
  { label: 'Low inventory alert',      sql: "SELECT name, category, qty_in_stock, sell_price\nFROM inventory\nWHERE villa_id = 'dwarka' AND qty_in_stock <= 3\nORDER BY qty_in_stock ASC" },
]

export default function D1Explorer() {
  const navigate = useNavigate()
  const [tab, setTab]       = useState('overview')
  const [copiedIdx, setCopied] = useState(null)
  const [showFull, setShowFull] = useState(false)

  const copy = (text, idx) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(idx); setTimeout(() => setCopied(null), 2000) })
  }

  const tabBar = { display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111' }
  const tabBase = { flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.3px', transition: 'all 0.2s', textAlign: 'center' }
  const tabA = (t) => tab === t
    ? { ...tabBase, background: 'rgba(200,144,58,0.1)', color: '#C8903A', borderBottom: '2px solid #C8903A' }
    : { ...tabBase, background: 'transparent', color: '#5C7080', borderBottom: '2px solid transparent' }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">D1 Database</div>
          <div className="topbar-sub">CLOUDFLARE D1 · SETUP & EXPLORER</div>
        </div>
      </div>

      <div style={tabBar}>
        <button style={tabA('overview')} onClick={() => setTab('overview')}>📋 Overview</button>
        <button style={tabA('schema')}   onClick={() => setTab('schema')}>🏗 Schema</button>
        <button style={tabA('queries')}  onClick={() => setTab('queries')}>🔍 Queries</button>
        <button style={tabA('setup')}    onClick={() => setTab('setup')}>⚙️ Setup</button>
      </div>

      <div className="screen-body">

        {tab === 'overview' && (
          <>
            <div className="card-section-label">WHY D1 NOW (not later)</div>
            <div className="card">
              <div style={{ color: '#EDF2F7', fontSize: '0.85rem', lineHeight: '1.6' }}>
                You're right — test it now, not after onboarding a client. Setting up D1 takes ~30 minutes and gives you:
              </div>
              {[
                ['✅ Free forever', 'Cloudflare free tier: 5GB, 25M reads/day. Same account as Pages.'],
                ['✅ Real SQL', 'Standard SQLite SQL — SELECT, JOIN, GROUP BY, everything you know.'],
                ['✅ Multi-tenant ready', 'Add a tenant_id column to any table. Isolation is a WHERE clause.'],
                ['✅ Test before ship', 'Local dev DB + remote prod DB — test isolation without touching live data.'],
                ['✅ StayID as PK', 'Proper primary keys, foreign keys, indexes — no more messy sheet columns.'],
              ].map(([title, desc]) => (
                <div key={title} style={{ marginTop: '10px' }}>
                  <div style={{ color: '#34A853', fontWeight: '600', fontSize: '0.82rem' }}>{title}</div>
                  <div style={{ color: '#8A9BAE', fontSize: '0.78rem' }}>{desc}</div>
                </div>
              ))}
            </div>

            <div className="card-section-label" style={{ marginTop: '16px' }}>TABLES</div>
            {[
              { name: 'stays',             desc: 'StayID lifecycle — every booking from creation to close-out' },
              { name: 'guest_requests',    desc: 'Breakfast, floor bed, car, wedding decor — linked to stay' },
              { name: 'stay_cars',         desc: 'Check-in car photos (plate + Drive URL)' },
              { name: 'stay_incidentals',  desc: 'Kitchen/checkout billing — qty × sell_price from inventory' },
              { name: 'inventory',         desc: 'Per-villa stock levels, cost price, sell price' },
              { name: 'rental_props',      desc: 'Rental property master + lease dates for renewal alerts' },
              { name: 'rental_income',     desc: 'Monthly income/expense per property' },
              { name: 'coconut_harvests',  desc: 'Full harvest lifecycle — earnings, expenses, payments' },
              { name: 'rubber_harvests',   desc: 'Rubber estate harvests' },
            ].map(t => (
              <div key={t.name} style={{ background: '#1E2535', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#C8903A', fontWeight: '600', fontSize: '0.85rem', fontFamily: 'monospace' }}>{t.name}</div>
                  <div style={{ color: '#5C7080', fontSize: '0.72rem', marginTop: '2px' }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'schema' && (
          <>
            <div className="card-section-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              SCHEMA.SQL
              <button onClick={() => copy(SCHEMA_SQL, 'schema')}
                style={{ background: copiedIdx === 'schema' ? 'rgba(52,168,83,0.15)' : 'rgba(200,144,58,0.12)', border: '1px solid rgba(200,144,58,0.25)', borderRadius: '8px', color: copiedIdx === 'schema' ? '#34A853' : 'var(--gold)', fontSize: '0.72rem', padding: '2px 10px', cursor: 'pointer' }}>
                {copiedIdx === 'schema' ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
            <div style={{ background: '#0D1117', borderRadius: '12px', padding: '12px', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)' }}>
              <pre style={{ color: '#79B8FF', fontSize: '0.68rem', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {showFull ? SCHEMA_SQL : SCHEMA_SQL.slice(0, 1200) + '\n...'}
              </pre>
              <button onClick={() => setShowFull(f => !f)}
                style={{ background: 'transparent', border: 'none', color: '#C8903A', fontSize: '0.75rem', cursor: 'pointer', marginTop: '8px' }}>
                {showFull ? '▲ Show less' : '▼ Show full schema'}
              </button>
            </div>
          </>
        )}

        {tab === 'queries' && (
          <>
            <div className="card-section-label">SAMPLE QUERIES (copy & run in terminal)</div>
            <div style={{ color: '#5C7080', fontSize: '0.75rem', marginBottom: '10px' }}>
              Run these with: <code style={{ color: '#C8903A', background: 'rgba(200,144,58,0.08)', padding: '1px 5px', borderRadius: '4px' }}>wrangler d1 execute bgindia-db --remote --command "..."</code>
            </div>
            {SAMPLE_QUERIES.map((q, i) => (
              <div key={i} style={{ background: '#1E2535', borderRadius: '10px', padding: '12px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ color: '#E8B86D', fontWeight: '600', fontSize: '0.82rem' }}>{q.label}</div>
                  <button onClick={() => copy(q.sql, i)}
                    style={{ background: copiedIdx === i ? 'rgba(52,168,83,0.15)' : 'rgba(200,144,58,0.08)', border: '1px solid rgba(200,144,58,0.2)', borderRadius: '6px', color: copiedIdx === i ? '#34A853' : '#C8903A', fontSize: '0.7rem', padding: '2px 8px', cursor: 'pointer' }}>
                    {copiedIdx === i ? '✓' : '📋'}
                  </button>
                </div>
                <pre style={{ color: '#79B8FF', fontSize: '0.68rem', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap', background: '#0D1117', borderRadius: '6px', padding: '8px' }}>
                  {q.sql}
                </pre>
              </div>
            ))}
          </>
        )}

        {tab === 'setup' && (
          <>
            <div className="card-section-label">SETUP STEPS (one-time, ~30 min)</div>
            {[
              { step: '1', title: 'Install Wrangler CLI', code: 'npm install -g wrangler\nwrangler login' },
              { step: '2', title: 'Create the D1 database', code: 'wrangler d1 create bgindia-db\n# Note the database_id from the output' },
              { step: '3', title: 'Add to wrangler.toml', code: WRANGLER_CONFIG.slice(0, 400) },
              { step: '4', title: 'Run the schema', code: 'wrangler d1 execute bgindia-db \\\n  --file=schema.sql --remote' },
              { step: '5', title: 'Seed from Airbnb CSV', code: 'node scripts/seed-from-airbnb.js\n# Run the seeder script to import all 153 bookings' },
              { step: '6', title: 'Verify in terminal', code: 'wrangler d1 execute bgindia-db --remote \\\n  --command "SELECT COUNT(*) FROM stays"' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#1E2535', borderRadius: '10px', padding: '12px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(200,144,58,0.2)', color: '#C8903A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.8rem', flexShrink: 0 }}>{s.step}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#EDF2F7', fontWeight: '600', fontSize: '0.85rem', marginBottom: '6px' }}>{s.title}</div>
                    <pre style={{ color: '#79B8FF', fontSize: '0.68rem', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap', background: '#0D1117', borderRadius: '6px', padding: '8px' }}>
                      {s.code}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ background: 'rgba(52,168,83,0.08)', border: '1px solid rgba(52,168,83,0.2)', borderRadius: '10px', padding: '12px', marginTop: '8px' }}>
              <div style={{ color: '#34A853', fontWeight: '600', fontSize: '0.82rem', marginBottom: '4px' }}>✅ Yes — it's regular SQL</div>
              <div style={{ color: '#8A9BAE', fontSize: '0.78rem', lineHeight: '1.5' }}>
                D1 is SQLite. You write standard SQL: SELECT, INSERT, UPDATE, DELETE, JOIN, GROUP BY, WHERE, LIKE, IN, BETWEEN, aggregates (SUM, COUNT, AVG). No stored procs. wrangler CLI lets you run any query from terminal. From the app, it's <code style={{ color: '#C8903A' }}>env.DB.prepare("...").bind(...).all()</code>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
