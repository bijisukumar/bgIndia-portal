import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

// ── PRESET QUERIES ────────────────────────────────────────
const PRESET_QUERIES = [
  { key: 'total_stays',       label: 'Total stays in DB',          cat: 'Villa' },
  { key: 'by_channel',        label: 'Revenue by booking channel',  cat: 'Villa' },
  { key: 'by_year',           label: 'Bookings & revenue by year',  cat: 'Villa' },
  { key: 'recent_5',          label: '5 most recent bookings',      cat: 'Villa' },
  { key: 'top_guests',        label: 'Repeat guests (2+ stays)',    cat: 'Villa' },
  { key: 'avg_tariff_year',   label: 'Avg tariff & nights by year', cat: 'Villa' },
  { key: 'direct_conversion', label: 'Direct vs OTA split',        cat: 'Villa' },
  { key: 'raman_unpaid',      label: 'Raman — unpaid commissions',  cat: 'Raman' },
  { key: 'raman_summary',     label: 'Raman — paid vs unpaid',     cat: 'Raman' },
  { key: 'inventory_stock',   label: 'Full inventory stock',        cat: 'Inventory' },
  { key: 'low_stock',         label: 'Low stock items (≤3)',        cat: 'Inventory' },
  { key: 'coconut_by_year',   label: 'Coconut harvests by year',   cat: 'Estates' },
  { key: 'rental_ytd',        label: 'Rental income YTD',          cat: 'Rental' },
]

const QUICK_SQL = [
  { label: 'All tables',           sql: `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name` },
  { label: 'raman_commissions',    sql: `SELECT * FROM raman_commissions ORDER BY checkin_date DESC LIMIT 50` },
  { label: 'stays (recent 20)',    sql: `SELECT stay_id, guest_name, checkin_date, nights, source, net, status FROM stays ORDER BY checkin_date DESC LIMIT 20` },
  { label: 'inventory',            sql: `SELECT * FROM inventory WHERE villa_id = 'dwarka' ORDER BY category, name` },
  { label: 'unpaid commissions',   sql: `SELECT guest_name, checkin_date, nights, commission FROM raman_commissions WHERE is_paid = 0 ORDER BY checkin_date DESC` },
  { label: 'revenue by year',      sql: `SELECT strftime('%Y', checkin_date) as year, COUNT(*) as stays, ROUND(SUM(gross),0) as gross, ROUND(SUM(net),0) as net FROM stays WHERE status != 'cancelled' GROUP BY year ORDER BY year DESC` },
  { label: 'stays by source',      sql: `SELECT source, COUNT(*) as bookings, ROUND(SUM(net),0) as total_net FROM stays WHERE status != 'cancelled' GROUP BY source ORDER BY total_net DESC` },
  { label: 'coconut harvests',     sql: `SELECT * FROM coconut_harvests ORDER BY harvest_date DESC` },
  { label: 'rental income',        sql: `SELECT * FROM rental_income ORDER BY year DESC, month DESC LIMIT 30` },
]

const CATS = ['All', 'Villa', 'Raman', 'Inventory', 'Estates', 'Rental']

// ── RESULT TABLE ──────────────────────────────────────────
function ResultTable({ rows }) {
  if (!rows || rows.length === 0) return (
    <div style={{ color: '#5C7080', textAlign: 'center', padding: '24px', fontSize: '0.82rem' }}>
      No rows returned
    </div>
  )
  const keys = Object.keys(rows[0])
  const MONEY_KEYS = ['net','gross','total','total_net','commission','income','expense','earnings','amount','rent']
  const isMoney = (k) => MONEY_KEYS.some(m => k.toLowerCase().includes(m))

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ color: '#5C7080', fontSize: '0.68rem', marginBottom: '6px' }}>
        {rows.length} row{rows.length !== 1 ? 's' : ''}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
        <thead>
          <tr>
            {keys.map(k => (
              <th key={k} style={{
                textAlign: 'left', padding: '7px 10px',
                color: '#C8903A', fontWeight: '700', fontSize: '0.65rem',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                borderBottom: '1px solid rgba(200,144,58,0.25)',
                whiteSpace: 'nowrap', background: '#1A2030',
              }}>
                {k.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
              {keys.map(k => {
                const v   = row[k]
                const num = typeof v === 'number'
                const money = num && isMoney(k)
                const display = money
                  ? `₹${Math.abs(v).toLocaleString('en-IN')}${v < 0 ? ' (−)' : ''}`
                  : v === null || v === undefined ? '—' : String(v)
                return (
                  <td key={k} style={{
                    padding: '7px 10px',
                    color: money && v > 0 ? '#34A853' : money && v < 0 ? '#EF9A9A'
                         : k === 'status' && v === 'cancelled' ? '#EF9A9A'
                         : k === 'is_paid' ? (v ? '#34A853' : '#FFCC80')
                         : '#EDF2F7',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    whiteSpace: 'nowrap', fontFamily: num ? 'monospace' : 'inherit',
                  }}>
                    {k === 'is_paid' ? (v ? '✓ Paid' : '⏳ Unpaid') : display}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────
export default function D1Explorer() {
  const navigate = useNavigate()
  const [tab, setTab]           = useState('sql')        // 'sql' | 'presets' | 'schema'
  const [catFilter, setCatFilter] = useState('All')
  const [results, setResults]   = useState(null)
  const [running, setRunning]   = useState(false)
  const [queryError, setQueryError] = useState(null)
  const [lastQuery, setLastQuery]   = useState('')

  // SQL editor state
  const [sql, setSql] = useState('SELECT * FROM raman_commissions WHERE is_paid = 0 ORDER BY checkin_date DESC')

  const execute = async (queryStr) => {
    const q = (queryStr || sql).trim()
    if (!q) return
    setRunning(true)
    setQueryError(null)
    setResults(null)
    setLastQuery(q)
    try {
      const rows = await api.runSQL(q)
      setResults(rows)
    } catch (e) {
      setQueryError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const runPreset = async (key) => {
    setRunning(true)
    setQueryError(null)
    setResults(null)
    try {
      const rows = await api.runQuery(key)
      setResults(rows)
    } catch (e) {
      setQueryError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const tabStyle = (t) => ({
    flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer',
    fontSize: '0.78rem', fontWeight: '600', textAlign: 'center',
    background: tab === t ? 'rgba(200,144,58,0.1)' : 'transparent',
    color: tab === t ? '#C8903A' : '#5C7080',
    borderBottom: tab === t ? '2px solid #C8903A' : '2px solid transparent',
  })

  const SCHEMA_TABLES = [
    { name: 'stays',             cols: 'stay_id · villa_id · source · airbnb_conf · guest_name · checkin_date · checkout_date · nights · gross · commission_amt · net · status' },
    { name: 'raman_commissions', cols: 'comm_id · stay_id · guest_name · checkin_date · nights · commission · is_paid · paid_date' },
    { name: 'inventory',         cols: 'item_id · villa_id · name · category · qty_in_stock · cost_price · sell_price' },
    { name: 'stay_incidentals',  cols: 'item_id · stay_id · name · qty · price_per_unit · total' },
    { name: 'guest_requests',    cols: 'req_id · stay_id · type · detail · status' },
    { name: 'stay_cars',         cols: 'car_id · stay_id · plate_no · photo_url' },
    { name: 'rental_props',      cols: 'prop_id · name · tenant_name · lease_start · lease_end · monthly_rent' },
    { name: 'rental_income',     cols: 'record_id · prop_id · month · year · rent · car_parking · maintenance · electricity · water · net' },
    { name: 'coconut_harvests',  cols: 'harvest_id · estate_id · harvest_date · total_nuts · net_income · balance_due' },
    { name: 'rubber_harvests',   cols: 'harvest_id · estate_id · harvest_date · weight_kg · net' },
  ]

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">D1 Explorer</div>
          <div className="topbar-sub">bgindia-db · LIVE</div>
        </div>
        <div style={{ background: 'rgba(52,168,83,0.15)', border: '1px solid rgba(52,168,83,0.3)', borderRadius: '16px', padding: '3px 10px' }}>
          <span style={{ color: '#34A853', fontSize: '0.65rem', fontWeight: '700' }}>● LIVE</span>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111' }}>
        <button style={tabStyle('sql')}     onClick={() => setTab('sql')}>✍️ SQL Editor</button>
        <button style={tabStyle('presets')} onClick={() => setTab('presets')}>📊 Presets</button>
        <button style={tabStyle('schema')}  onClick={() => setTab('schema')}>🏗 Schema</button>
      </div>

      <div className="screen-body">

        {/* ── SQL EDITOR TAB ───────────────────────────── */}
        {tab === 'sql' && (
          <>
            {/* Quick-load buttons */}
            <div className="card-section-label">QUICK LOAD</div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '10px', scrollbarWidth: 'none' }}>
              {QUICK_SQL.map((q, i) => (
                <button key={i}
                  onClick={() => { setSql(q.sql); setResults(null); setQueryError(null) }}
                  style={{
                    flexShrink: 0, padding: '5px 11px', borderRadius: '16px', cursor: 'pointer',
                    fontSize: '0.72rem', fontWeight: '600', border: '1px solid rgba(255,255,255,0.1)',
                    background: sql === q.sql ? 'rgba(200,144,58,0.15)' : 'transparent',
                    color: sql === q.sql ? '#C8903A' : '#8A9BAE', whiteSpace: 'nowrap',
                  }}>
                  {q.label}
                </button>
              ))}
            </div>

            {/* SQL textarea */}
            <div className="card-section-label">SQL QUERY</div>
            <div style={{ background: '#0D1117', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '10px', overflow: 'hidden' }}>
              <textarea
                value={sql}
                onChange={e => setSql(e.target.value)}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault(); execute()
                  }
                }}
                spellCheck={false}
                style={{
                  width: '100%', minHeight: '100px', background: 'transparent',
                  border: 'none', color: '#79B8FF', fontFamily: 'monospace',
                  fontSize: '0.78rem', lineHeight: '1.6', padding: '12px',
                  resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                }}
                placeholder="SELECT * FROM stays LIMIT 10"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ color: '#3C5060', fontSize: '0.68rem' }}>Only SELECT queries · Ctrl+Enter to run</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setSql(''); setResults(null); setQueryError(null) }}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#5C7080', fontSize: '0.75rem', cursor: 'pointer' }}>
                    Clear
                  </button>
                  <button onClick={() => execute()}
                    disabled={running || !sql.trim()}
                    style={{
                      padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: running ? 'rgba(200,144,58,0.3)' : '#C8903A',
                      color: '#000', fontWeight: '700', fontSize: '0.78rem',
                    }}>
                    {running ? 'Running...' : '▶ Run'}
                  </button>
                </div>
              </div>
            </div>

            {/* Results */}
            {queryError && (
              <div style={{ background: 'rgba(198,40,40,0.1)', border: '1px solid rgba(198,40,40,0.3)', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                <div style={{ color: '#EF9A9A', fontWeight: '600', fontSize: '0.78rem', marginBottom: '4px' }}>❌ Query error</div>
                <div style={{ color: '#EF9A9A', fontSize: '0.72rem', fontFamily: 'monospace' }}>{queryError}</div>
              </div>
            )}
            {results && !running && (
              <div style={{ background: '#1E2535', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <ResultTable rows={results} />
              </div>
            )}
          </>
        )}

        {/* ── PRESETS TAB ─────────────────────────────── */}
        {tab === 'presets' && (
          <>
            <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '12px', scrollbarWidth: 'none' }}>
              {CATS.map(c => (
                <button key={c} onClick={() => setCatFilter(c)} style={{
                  flexShrink: 0, padding: '5px 12px', borderRadius: '20px', cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: '600', border: '1px solid',
                  borderColor: catFilter === c ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
                  background: catFilter === c ? 'rgba(200,144,58,0.15)' : 'transparent',
                  color: catFilter === c ? 'var(--gold)' : '#5C7080',
                }}>{c}</button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              {(catFilter === 'All' ? PRESET_QUERIES : PRESET_QUERIES.filter(q => q.cat === catFilter))
                .map(q => (
                  <button key={q.key} onClick={() => runPreset(q.key)}
                    style={{
                      padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                      color: '#EDF2F7', fontSize: '0.82rem', fontWeight: '500',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                    <span>{q.label}</span>
                    <span style={{ color: '#C8903A', fontSize: '0.75rem' }}>▶</span>
                  </button>
                ))}
            </div>

            {running && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', color: '#5C7080' }}>
                <div className="spinner" />Running...
              </div>
            )}
            {queryError && (
              <div style={{ background: 'rgba(198,40,40,0.1)', border: '1px solid rgba(198,40,40,0.3)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ color: '#EF9A9A', fontSize: '0.78rem' }}>❌ {queryError}</div>
              </div>
            )}
            {results && !running && (
              <div style={{ background: '#1E2535', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <ResultTable rows={results} />
              </div>
            )}
          </>
        )}

        {/* ── SCHEMA TAB ──────────────────────────────── */}
        {tab === 'schema' && (
          <>
            <div className="card-section-label">TABLES — click to browse</div>
            {SCHEMA_TABLES.map(t => (
              <button key={t.name}
                onClick={() => {
                  setTab('sql')
                  setSql(`SELECT * FROM ${t.name} LIMIT 50`)
                  setResults(null)
                }}
                style={{
                  width: '100%', background: '#1E2535', borderRadius: '10px', padding: '12px 14px',
                  marginBottom: '6px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
                  textAlign: 'left',
                }}>
                <div style={{ color: '#C8903A', fontWeight: '700', fontSize: '0.85rem', fontFamily: 'monospace', marginBottom: '3px' }}>
                  {t.name} →
                </div>
                <div style={{ color: '#5C7080', fontSize: '0.7rem', lineHeight: '1.4' }}>{t.cols}</div>
              </button>
            ))}
            <div style={{ background: 'rgba(24,95,165,0.08)', border: '1px solid rgba(24,95,165,0.2)', borderRadius: '10px', padding: '12px', marginTop: '4px' }}>
              <div style={{ color: '#85B7EB', fontSize: '0.78rem', marginBottom: '2px' }}>💡 Tap any table to browse it</div>
              <div style={{ color: '#5C7080', fontSize: '0.72rem' }}>Opens SQL Editor pre-filled with SELECT * — then edit the query as needed</div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
