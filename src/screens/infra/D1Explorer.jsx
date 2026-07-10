import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'

// ── PRESET QUERIES ────────────────────────────────────────
const PRESET_QUERIES = [
  { key: 'total_stays',       label: 'Total stays in DB',          cat: 'Villa' },
  { key: 'by_channel',        label: 'Revenue by booking channel',  cat: 'Villa' },
  { key: 'by_year',           label: 'Bookings & revenue by year',  cat: 'Villa' },
  { key: 'recent_5',          label: '5 most recent bookings',      cat: 'Villa' },
  { key: 'top_guests',        label: 'Repeat guests (2+ stays)',    cat: 'Villa' },
  { key: 'avg_tariff_year',   label: 'Avg tariff & nights by year', cat: 'Villa' },
  { key: 'direct_conversion', label: 'Direct vs OTA split',         cat: 'Villa' },
  { key: 'raman_unpaid',      label: 'Raman — unpaid commissions',  cat: 'Raman' },
  { key: 'raman_summary',     label: 'Raman — paid vs unpaid',      cat: 'Raman' },
  { key: 'inventory_stock',   label: 'Full inventory stock',        cat: 'Inventory' },
  { key: 'low_stock',         label: 'Low stock items (≤3)',         cat: 'Inventory' },
  { key: 'coconut_by_year',   label: 'Coconut harvests by year',    cat: 'Estates' },
  { key: 'rental_ytd',        label: 'Rental income YTD',           cat: 'Rental' },
]

const QUICK_SQL = [
  { label: 'All tables',         sql: `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name` },
  { label: 'manager commissions', sql: `SELECT * FROM stayvibe_manager_commissions ORDER BY checkin_date DESC LIMIT 50` },
  { label: 'stays (recent 20)',  sql: `SELECT stay_id, guest_name, checkin_date, nights, source, net, status FROM stayvibe_stays ORDER BY checkin_date DESC LIMIT 20` },
  { label: 'inventory',          sql: `SELECT * FROM stayvibe_inventory WHERE villa_id = '${DEFAULT_VILLA_ID}' ORDER BY category, name` },
  { label: 'unpaid commissions', sql: `SELECT guest_name, checkin_date, nights, commission FROM stayvibe_manager_commissions WHERE is_paid = 0 ORDER BY checkin_date DESC` },
  { label: 'revenue by year',    sql: `SELECT strftime('%Y', checkin_date) as year, COUNT(*) as stays, ROUND(SUM(gross),0) as gross, ROUND(SUM(net),0) as net FROM stayvibe_stays WHERE status != 'cancelled' GROUP BY year ORDER BY year DESC` },
  { label: 'stays by source',    sql: `SELECT source, COUNT(*) as bookings, ROUND(SUM(net),0) as total_net FROM stayvibe_stays WHERE status != 'cancelled' GROUP BY source ORDER BY total_net DESC` },
  { label: 'recent reviews',     sql: `SELECT stay_id, guest_name, checkin_date, review_rating, review_date, review_text, review_highlights FROM stayvibe_stays WHERE review_rating > 0 ORDER BY review_date DESC LIMIT 5` },
  // 'coconut harvests' quick query removed: that table lived only as a stale
  // copy in this DB (bgindia-db) — the real data is in bgindiadb-estates
  // (estate360_coconut_harvests), a different D1 binding this screen
  // doesn't query. See scripts/migrate-v2.1-drop-stale-estate-tables.sql.
  { label: 'rental income',      sql: `SELECT * FROM rev360_rental_income ORDER BY year DESC, month DESC LIMIT 30` },
]

const CATS = ['All', 'Villa', 'Raman', 'Inventory', 'Estates', 'Rental']

const SAVED_KEY = 'bgindia_saved_queries'

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') } catch { return [] }
}
function persistSaved(list) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(list))
}

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
      <div style={{ color: '#5C7080', fontSize: '0.68rem', marginBottom: '6px', padding: '8px 10px 0' }}>
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
                const v    = row[k]
                const num  = typeof v === 'number'
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

// ── SAVED QUERY EDITOR MODAL ──────────────────────────────
function SavedQueryModal({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [sql,  setSql]  = useState(initial?.sql  || '')
  const [cat,  setCat]  = useState(initial?.cat  || 'My Queries')

  const MY_CATS = ['My Queries', 'Villa', 'Raman', 'Cleanup', 'Migrations', 'Debug']

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 1000, padding: '0 0 0 0',
    }}>
      <div style={{
        width: '100%', maxWidth: '640px',
        background: '#1A2030', borderRadius: '16px 16px 0 0',
        padding: '20px 16px 32px', border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#C8903A' }}>
            {initial ? '✏️ Edit saved query' : '💾 Save new query'}
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#5C7080', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.68rem', color: '#5C7080', letterSpacing: '1px', marginBottom: '6px' }}>QUERY NAME</div>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Overdue stays, Bharat cleanup..."
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)',
              color: '#EDF2F7', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
            }} />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.68rem', color: '#5C7080', letterSpacing: '1px', marginBottom: '6px' }}>CATEGORY</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {MY_CATS.map(c => (
              <button key={c} onClick={() => setCat(c)} style={{
                padding: '4px 10px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.72rem',
                border: `1px solid ${cat === c ? 'rgba(200,144,58,0.5)' : 'rgba(255,255,255,0.1)'}`,
                background: cat === c ? 'rgba(200,144,58,0.15)' : 'transparent',
                color: cat === c ? '#C8903A' : '#5C7080',
              }}>{c}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.68rem', color: '#5C7080', letterSpacing: '1px', marginBottom: '6px' }}>SQL</div>
          <textarea value={sql} onChange={e => setSql(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', minHeight: '120px', background: '#0D1117',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
              color: '#79B8FF', fontFamily: 'monospace', fontSize: '0.78rem',
              lineHeight: '1.6', padding: '10px 12px', resize: 'vertical',
              outline: 'none', boxSizing: 'border-box',
            }}
            placeholder="SELECT * FROM stayvibe_stays WHERE ..." />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '12px', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
            color: '#5C7080', fontSize: '0.85rem', cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={() => name.trim() && sql.trim() && onSave({ name: name.trim(), sql: sql.trim(), cat })}
            disabled={!name.trim() || !sql.trim()}
            style={{
              flex: 2, padding: '12px', borderRadius: '10px', border: 'none',
              background: name && sql ? '#C8903A' : 'rgba(200,144,58,0.3)',
              color: '#000', fontWeight: '700', fontSize: '0.85rem',
              cursor: name && sql ? 'pointer' : 'default',
            }}>
            💾 Save query
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────
export default function D1Explorer() {
  const navigate = useNavigate()
  const [tab, setTab]               = useState('saved')
  const [catFilter, setCatFilter]   = useState('All')
  const [results, setResults]       = useState(null)
  const [running, setRunning]       = useState(false)
  const [queryError, setQueryError] = useState(null)
  const [sql, setSql]               = useState('SELECT stay_id, guest_name, checkin_date, checkout_date, status FROM stayvibe_stays ORDER BY checkin_date DESC LIMIT 20')
  const [savedQueries, setSavedQueries] = useState(loadSaved)
  const [editingQuery, setEditingQuery] = useState(null)   // null | 'new' | {id,name,sql,cat}
  const [activeQueryId, setActiveQueryId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // id to delete
  const [liveSchema, setLiveSchema] = useState(null)        // null = not loaded yet
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [schemaGeneratedAt, setSchemaGeneratedAt] = useState(null)

  const persistAndSet = (list) => { setSavedQueries(list); persistSaved(list) }

  const execute = async (queryStr) => {
    const q = (queryStr || sql).trim()
    if (!q) return
    setRunning(true); setQueryError(null); setResults(null)
    const isWrite = /^(DELETE|UPDATE|INSERT|ALTER|CREATE|DROP)/i.test(q)
    try {
      if (isWrite) {
        const result = await api.runSQLWrite(q)
        setResults([{ '✅ rows affected': result?.changes ?? 0, duration_ms: result?.duration ?? 0 }])
      } else {
        const rows = await api.runSQL(q)
        setResults(rows)
      }
    } catch (e) { setQueryError(e.message) }
    finally { setRunning(false) }
  }

  const runPreset = async (key) => {
    setRunning(true); setQueryError(null); setResults(null)
    try {
      const rows = await api.runQuery(key)
      setResults(rows)
    } catch (e) { setQueryError(e.message) }
    finally { setRunning(false) }
  }

  const runSaved = (q) => {
    setActiveQueryId(q.id)
    setResults(null); setQueryError(null)
    execute(q.sql)
  }

  const saveNew = ({ name, sql: s, cat }) => {
    const entry = { id: Date.now().toString(), name, sql: s, cat, createdAt: new Date().toISOString() }
    persistAndSet([...savedQueries, entry])
    setEditingQuery(null)
  }

  const updateExisting = ({ name, sql: s, cat }) => {
    persistAndSet(savedQueries.map(q => q.id === editingQuery.id ? { ...q, name, sql: s, cat } : q))
    setEditingQuery(null)
  }

  const deleteQuery = (id) => {
    persistAndSet(savedQueries.filter(q => q.id !== id))
    setConfirmDelete(null)
    if (activeQueryId === id) { setResults(null); setActiveQueryId(null) }
  }

  const loadToEditor = (q) => {
    setSql(q.sql)
    setTab('sql')
    setResults(null)
    setQueryError(null)
  }

  const tabStyle = (t) => ({
    flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer',
    fontSize: '0.75rem', fontWeight: '600', textAlign: 'center',
    background: tab === t ? 'rgba(200,144,58,0.1)' : 'transparent',
    color: tab === t ? '#C8903A' : '#5C7080',
    borderBottom: tab === t ? '2px solid #C8903A' : '2px solid transparent',
  })

  const SCHEMA_TABLES = [
    { name: 'stayvibe_stays',              cols: 'stay_id · villa_id · source · airbnb_conf · guest_name · checkin_date · checkout_date · nights · gross · commission_amt · net · status · extra_lines' },
    { name: 'stayvibe_manager_commissions', cols: 'comm_id · stay_id · guest_name · checkin_date · nights · commission · is_paid · paid_date' },
    { name: 'stayvibe_inventory',           cols: 'item_id · villa_id · name · category · qty_in_stock · cost_price · sell_price' },
    { name: 'stayvibe_incidentals',         cols: 'item_id · stay_id · name · qty · price_per_unit · total' },
    { name: 'stayvibe_guest_requests',      cols: 'req_id · stay_id · type · detail · status' },
    { name: 'stayvibe_cars',                cols: 'car_id · stay_id · plate_no · photo_url' },
    { name: 'rev360_rental_props',          cols: 'prop_id · name · tenant_name · lease_start · lease_end · monthly_rent' },
    { name: 'rev360_rental_income',         cols: 'record_id · prop_id · month · year · rent · car_parking · maintenance · electricity · water · net' },
    // coconut_harvests/rubber_harvests removed: those live in bgindiadb-estates
    // (estate360_coconut_harvests/estate360_rubber_harvests), a different D1
    // binding this screen doesn't query — see D1Explorer's 'coconut harvests'
    // quick-query removal note above for the same reason.
  ]
  // Fallback list shown only if the live schema fetch hasn't completed/failed —
  // kept as a static reference so the tab never renders fully empty, but the
  // live snapshot (fetched fresh from sqlite_master/PRAGMA table_info via
  // getSchemaSnapshot) is what's actually shown once loaded. This is what was
  // missing before: SCHEMA_TABLES was hand-maintained and never updated when
  // new tables (guests, enquiries, communication_log, bookings,
  // inventory_restock_log, etc.) were added — there was no way to see them
  // here without editing this file and redeploying.

  async function loadLiveSchema() {
    setSchemaLoading(true)
    try {
      const data = await api.getSchemaSnapshot()
      if (data?.snapshot) {
        const tables = Object.entries(data.snapshot).map(([name, cols]) => ({
          name,
          cols: cols.map(c => c.name).join(' · '),
        })).sort((a, b) => a.name.localeCompare(b.name))
        setLiveSchema(tables)
        setSchemaGeneratedAt(data.generatedAt)
      }
    } catch { /* keep showing whatever we had before (or the static fallback) */ }
    finally { setSchemaLoading(false) }
  }

  useEffect(() => { if (tab === 'schema' && liveSchema === null) loadLiveSchema() }, [tab])



  // Group saved queries by cat
  const savedCats = [...new Set(savedQueries.map(q => q.cat))]

  const ResultPanel = () => (
    <>
      {queryError && (
        <div style={{ background: 'rgba(198,40,40,0.1)', border: '1px solid rgba(198,40,40,0.3)', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
          <div style={{ color: '#EF9A9A', fontWeight: '600', fontSize: '0.78rem', marginBottom: '4px' }}>❌ Query error</div>
          <div style={{ color: '#EF9A9A', fontSize: '0.72rem', fontFamily: 'monospace' }}>{queryError}</div>
        </div>
      )}
      {running && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', color: '#5C7080' }}>
          <div className="spinner" />Running...
        </div>
      )}
      {results && !running && (
        <div style={{ background: '#1E2535', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '16px' }}>
          <ResultTable rows={results} />
        </div>
      )}
    </>
  )

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">DB Admin</div>
          <div className="topbar-sub">bgindia-db · LIVE</div>
        </div>
        <div style={{ background: 'rgba(52,168,83,0.15)', border: '1px solid rgba(52,168,83,0.3)', borderRadius: '16px', padding: '3px 10px' }}>
          <span style={{ color: '#34A853', fontSize: '0.65rem', fontWeight: '700' }}>● LIVE</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111' }}>
        <button style={tabStyle('saved')}   onClick={() => setTab('saved')}>💾 Saved</button>
        <button style={tabStyle('sql')}     onClick={() => setTab('sql')}>✍️ SQL</button>
        <button style={tabStyle('presets')} onClick={() => setTab('presets')}>📊 Presets</button>
        <button style={tabStyle('schema')}  onClick={() => setTab('schema')}>🏗 Schema</button>
      </div>

      <div className="screen-body">

        {/* ── SAVED QUERIES TAB ──────────────────────── */}
        {tab === 'saved' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="card-section-label" style={{ marginBottom: 0 }}>YOUR SAVED QUERIES</div>
              <button onClick={() => setEditingQuery('new')} style={{
                padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(200,144,58,0.4)',
                background: 'rgba(200,144,58,0.1)', color: '#C8903A',
                fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer',
              }}>+ New query</button>
            </div>

            {savedQueries.length === 0 ? (
              <div style={{
                background: 'rgba(92,112,128,0.08)', border: '1px dashed rgba(92,112,128,0.3)',
                borderRadius: '12px', padding: '28px 16px', textAlign: 'center', marginBottom: '16px',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>💾</div>
                <div style={{ color: '#8A9BAE', fontSize: '0.85rem', marginBottom: '4px' }}>No saved queries yet</div>
                <div style={{ color: '#5C7080', fontSize: '0.75rem' }}>Save your frequent cleanup and maintenance queries here</div>
              </div>
            ) : (
              savedCats.map(cat => (
                <div key={cat} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#5C7080', letterSpacing: '1.2px', marginBottom: '6px' }}>{cat.toUpperCase()}</div>
                  <div style={{ background: '#1E2535', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    {savedQueries.filter(q => q.cat === cat).map((q, i, arr) => (
                      <div key={q.id} style={{
                        borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        background: activeQueryId === q.id ? 'rgba(200,144,58,0.06)' : 'transparent',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: '10px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: activeQueryId === q.id ? '#C8903A' : '#EDF2F7', marginBottom: '3px' }}>
                              {q.name}
                            </div>
                            <div style={{
                              fontSize: '0.68rem', color: '#5C7080', fontFamily: 'monospace',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {q.sql}
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => runSaved(q)}
                              style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#C8903A', color: '#000', fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer' }}>
                              ▶ Run
                            </button>
                            <button onClick={() => loadToEditor(q)}
                              title="Load into SQL editor"
                              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#8A9BAE', fontSize: '0.72rem', cursor: 'pointer' }}>
                              ✍️
                            </button>
                            <button onClick={() => setEditingQuery(q)}
                              title="Edit"
                              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#8A9BAE', fontSize: '0.72rem', cursor: 'pointer' }}>
                              ✏️
                            </button>
                            <button onClick={() => setConfirmDelete(q.id)}
                              title="Delete"
                              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#EF9A9A', fontSize: '0.72rem', cursor: 'pointer' }}>
                              🗑
                            </button>
                          </div>
                        </div>
                        {/* Inline results for this query */}
                        {activeQueryId === q.id && (running || results || queryError) && (
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '0 14px 14px' }}>
                            <ResultPanel />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* Starter queries suggestion */}
            {savedQueries.length === 0 && (
              <div style={{ marginTop: '8px' }}>
                <div className="card-section-label">SUGGESTED STARTERS — tap to save</div>
                {[
                  { name: 'Overdue open stays',       cat: 'Villa',   sql: `SELECT stay_id, guest_name, checkin_date, checkout_date, status FROM stayvibe_stays WHERE checkout_date < date('now') AND status NOT IN ('closed','cancelled','checked_out') ORDER BY checkout_date DESC` },
                  { name: 'Cleanup test records',     cat: 'Cleanup', sql: `SELECT stay_id, guest_name, checkin_date, status FROM stayvibe_stays WHERE guest_name LIKE '%test%' OR guest_name LIKE '%AAB%' OR guest_name LIKE '%Biju%' ORDER BY created_at DESC LIMIT 20` },
                  { name: 'All stays this year',      cat: 'Villa',   sql: `SELECT stay_id, guest_name, checkin_date, checkout_date, nights, net, status FROM stayvibe_stays WHERE strftime('%Y', checkin_date) = strftime('%Y', 'now') ORDER BY checkin_date DESC` },
                  { name: 'Review chase candidates',  cat: 'Villa',   sql: `SELECT stay_id, guest_name, checkout_date, status, review_rating FROM stayvibe_stays WHERE status IN ('checked_out','pending_review') AND checkout_date < date('now') AND (review_rating IS NULL OR review_rating = 0) ORDER BY checkout_date DESC` },
                  { name: 'Raman quarterly summary',  cat: 'Raman',   sql: `SELECT strftime('%Y-Q', checkin_date) || CAST((CAST(strftime('%m', checkin_date) AS INTEGER) + 2) / 3 AS TEXT) as quarter, COUNT(*) as stays, SUM(commission) as total_comm, SUM(CASE WHEN is_paid THEN commission ELSE 0 END) as paid FROM stayvibe_manager_commissions GROUP BY quarter ORDER BY quarter DESC` },
                  { name: 'Check extra_lines column', cat: 'Debug',   sql: `SELECT stay_id, guest_name, extra_charges, extra_lines FROM stayvibe_stays WHERE extra_lines IS NOT NULL ORDER BY updated_at DESC LIMIT 20` },
                ].map((s, i) => (
                  <button key={i} onClick={() => persistAndSet([...savedQueries, { id: Date.now().toString() + i, ...s, createdAt: new Date().toISOString() }])}
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: '10px', cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                      color: '#EDF2F7', fontSize: '0.82rem', textAlign: 'left', marginBottom: '6px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>{s.name}</span>
                      <span style={{ marginLeft: '8px', fontSize: '0.68rem', color: '#5C7080', padding: '2px 6px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>{s.cat}</span>
                    </div>
                    <span style={{ color: '#C8903A', fontSize: '0.75rem' }}>+ Save</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── SQL EDITOR TAB ────────────────────────── */}
        {tab === 'sql' && (
          <>
            <div className="card-section-label">QUICK LOAD</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {QUICK_SQL.map((q, i) => (
                <button key={i} onClick={() => { setSql(q.sql); setResults(null); setQueryError(null) }}
                  style={{
                    padding: '5px 11px', borderRadius: '16px', cursor: 'pointer',
                    fontSize: '0.72rem', fontWeight: '600', border: '1px solid rgba(255,255,255,0.1)',
                    background: sql === q.sql ? 'rgba(200,144,58,0.15)' : 'transparent',
                    color: sql === q.sql ? '#C8903A' : '#8A9BAE', whiteSpace: 'nowrap',
                  }}>
                  {q.label}
                </button>
              ))}
            </div>

            <div className="card-section-label">SQL QUERY</div>
            <div style={{ background: '#0D1117', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '10px', overflow: 'hidden' }}>
              <textarea value={sql} onChange={e => setSql(e.target.value)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); execute() } }}
                spellCheck={false}
                style={{
                  width: '100%', minHeight: '100px', background: 'transparent',
                  border: 'none', color: '#79B8FF', fontFamily: 'monospace',
                  fontSize: '0.78rem', lineHeight: '1.6', padding: '12px',
                  resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                }}
                placeholder="SELECT * FROM stayvibe_stays LIMIT 10"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ color: '#3C5060', fontSize: '0.68rem' }}>Ctrl+Enter to run</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setEditingQuery({ sql, name: '', cat: 'My Queries' })}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(200,144,58,0.3)', background: 'transparent', color: '#C8903A', fontSize: '0.72rem', cursor: 'pointer' }}>
                    💾 Save
                  </button>
                  <button onClick={() => { setSql(''); setResults(null); setQueryError(null) }}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#5C7080', fontSize: '0.75rem', cursor: 'pointer' }}>
                    Clear
                  </button>
                  <button onClick={() => execute()} disabled={running || !sql.trim()}
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
            <ResultPanel />
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
            <ResultPanel />
          </>
        )}

        {/* ── SCHEMA TAB ──────────────────────────────── */}
        {tab === 'schema' && (
          <>
            <div className="card-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>TABLES — tap to browse{schemaGeneratedAt && !schemaLoading && (
                <span style={{ color: '#5C7080', fontWeight: 400, textTransform: 'none', marginLeft: '6px' }}>
                  · live as of {new Date(schemaGeneratedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}</span>
              <button onClick={loadLiveSchema} disabled={schemaLoading}
                style={{ background: 'transparent', border: '1px solid rgba(200,144,58,0.3)', borderRadius: '8px', color: '#C8903A', fontSize: '0.68rem', fontWeight: '600', padding: '4px 10px', cursor: 'pointer' }}>
                {schemaLoading ? '⟳ Loading…' : '⟳ Refresh schema'}
              </button>
            </div>
            {(liveSchema || SCHEMA_TABLES).map(t => (
              <button key={t.name} onClick={() => { setTab('sql'); setSql(`SELECT * FROM ${t.name} LIMIT 50`); setResults(null) }}
                style={{
                  width: '100%', background: '#1E2535', borderRadius: '10px', padding: '12px 14px',
                  marginBottom: '6px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'left',
                }}>
                <div style={{ color: '#C8903A', fontWeight: '700', fontSize: '0.85rem', fontFamily: 'monospace', marginBottom: '3px' }}>{t.name} →</div>
                <div style={{ color: '#5C7080', fontSize: '0.7rem', lineHeight: '1.4' }}>{t.cols}</div>
              </button>
            ))}
          </>
        )}

      </div>

      {/* ── SAVE/EDIT MODAL ─────────────────────────── */}
      {editingQuery && (
        <SavedQueryModal
          initial={editingQuery === 'new' ? null : editingQuery}
          onSave={editingQuery === 'new' || !editingQuery.id ? saveNew : updateExisting}
          onCancel={() => setEditingQuery(null)}
        />
      )}

      {/* ── DELETE CONFIRM ──────────────────────────── */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1A2030', borderRadius: '16px', padding: '24px', maxWidth: '320px', width: '100%', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '12px' }}>🗑️</div>
            <div style={{ color: '#EDF2F7', fontWeight: '600', marginBottom: '8px' }}>Delete this query?</div>
            <div style={{ color: '#5C7080', fontSize: '0.8rem', marginBottom: '20px' }}>This can't be undone.</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#5C7080', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteQuery(confirmDelete)} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: '#EF4444', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
