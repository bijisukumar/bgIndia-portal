import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

const PRESET_QUERIES = [
  { key: 'total_stays',      label: '📊 Total stays in DB',           category: 'Villa' },
  { key: 'by_channel',       label: '📡 Revenue by booking channel',   category: 'Villa' },
  { key: 'by_year',          label: '📅 Bookings & revenue by year',   category: 'Villa' },
  { key: 'recent_5',         label: '🕐 5 most recent bookings',       category: 'Villa' },
  { key: 'top_guests',       label: '⭐ Repeat guests (2+ stays)',      category: 'Villa' },
  { key: 'avg_tariff_year',  label: '💰 Avg tariff & nights by year',  category: 'Villa' },
  { key: 'direct_conversion',label: '🔄 Direct vs OTA split',          category: 'Villa' },
  { key: 'raman_unpaid',     label: '⏳ Raman — unpaid commissions',   category: 'Raman' },
  { key: 'raman_summary',    label: '📋 Raman — paid vs unpaid total', category: 'Raman' },
  { key: 'inventory_stock',  label: '📦 Full inventory stock',         category: 'Inventory' },
  { key: 'low_stock',        label: '⚠️ Low stock items (≤3)',         category: 'Inventory' },
  { key: 'coconut_by_year',  label: '🌴 Coconut harvests by year',     category: 'Estates' },
  { key: 'rental_ytd',       label: '🏢 Rental income YTD',            category: 'Rental' },
]

const CATEGORIES = ['All', 'Villa', 'Raman', 'Inventory', 'Estates', 'Rental']

function ResultTable({ rows }) {
  if (!rows || rows.length === 0) return (
    <div style={{color:'#5C7080',textAlign:'center',padding:'20px',fontSize:'0.82rem'}}>No results</div>
  )
  const keys = Object.keys(rows[0])
  return (
    <div style={{overflowX:'auto',marginTop:'10px'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.72rem'}}>
        <thead>
          <tr>
            {keys.map(k => (
              <th key={k} style={{textAlign:'left',padding:'6px 8px',color:'#C8903A',fontWeight:'700',
                borderBottom:'1px solid rgba(200,144,58,0.25)',whiteSpace:'nowrap',letterSpacing:'0.5px',
                fontSize:'0.65rem',textTransform:'uppercase'}}>
                {k.replace(/_/g,' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{background: i%2===0 ? 'rgba(255,255,255,0.02)' : 'transparent'}}>
              {keys.map(k => {
                const v = row[k]
                const isNum = typeof v === 'number'
                const isMoney = isNum && (k.includes('net') || k.includes('total') || k.includes('comm') || k.includes('income') || k.includes('spent') || k.includes('gross'))
                const display = isMoney ? `₹${Number(v).toLocaleString('en-IN')}` : v ?? '—'
                return (
                  <td key={k} style={{padding:'7px 8px',color: isMoney && v > 0 ? '#34A853' : isMoney && v < 0 ? '#EF9A9A' : '#EDF2F7',
                    borderBottom:'1px solid rgba(255,255,255,0.03)',whiteSpace:'nowrap'}}>
                    {String(display)}
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

export default function D1Explorer() {
  const navigate = useNavigate()
  const [tab, setTab]         = useState('queries')
  const [catFilter, setCatFilter] = useState('All')
  const [selectedKey, setSelectedKey] = useState('')
  const [results, setResults]  = useState(null)
  const [sqlShown, setSqlShown] = useState('')
  const [loading, setLoading]  = useState(false)
  const [error, setError]      = useState(null)
  const [copied, setCopied]    = useState(false)

  const filtered = catFilter === 'All' ? PRESET_QUERIES : PRESET_QUERIES.filter(q => q.category === catFilter)

  const runQuery = async (key) => {
    setSelectedKey(key)
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const data = await api.runQuery(key)
      // api.runQuery returns { data: rows, sql } — but our api layer returns data.data
      // Worker returns { success, data: rows, sql } — api.get returns data.data = rows
      // We need both rows and sql, so let's handle both
      if (Array.isArray(data)) {
        setResults(data)
      } else if (data?.rows) {
        setResults(data.rows); setSqlShown(data.sql || '')
      } else {
        setResults(data ? [data] : [])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const tabStyle = (t) => ({
    flex:1, padding:'10px 4px', border:'none', cursor:'pointer',
    fontSize:'0.75rem', fontWeight:'600', letterSpacing:'0.3px', textAlign:'center',
    background: tab===t ? 'rgba(200,144,58,0.1)' : 'transparent',
    color: tab===t ? '#C8903A' : '#5C7080',
    borderBottom: tab===t ? '2px solid #C8903A' : '2px solid transparent',
  })

  const SCHEMA_TABLES = [
    {name:'stays',            cols:'stay_id · villa_id · source · guest_name · checkin_date · checkout_date · nights · gross · net · status'},
    {name:'raman_commissions',cols:'comm_id · guest_name · checkin_date · nights · commission · is_paid · paid_date'},
    {name:'inventory',        cols:'item_id · villa_id · name · category · qty_in_stock · cost_price · sell_price'},
    {name:'stay_incidentals', cols:'item_id · stay_id · name · qty · price_per_unit · total'},
    {name:'rental_props',     cols:'prop_id · name · tenant_name · lease_start · lease_end · monthly_rent'},
    {name:'rental_income',    cols:'record_id · prop_id · month · year · rent · net'},
    {name:'coconut_harvests', cols:'harvest_id · estate_id · harvest_date · total_nuts · net_income · balance_due'},
    {name:'rubber_harvests',  cols:'harvest_id · estate_id · harvest_date · weight_kg · net'},
    {name:'guest_requests',   cols:'req_id · stay_id · type · detail · status'},
    {name:'stay_cars',        cols:'car_id · stay_id · plate_no · photo_url'},
  ]

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">D1 Database</div>
          <div className="topbar-sub">CLOUDFLARE D1 · bgindia-db</div>
        </div>
        <div style={{background:'rgba(52,168,83,0.15)',border:'1px solid rgba(52,168,83,0.3)',borderRadius:'16px',padding:'3px 10px'}}>
          <span style={{color:'#34A853',fontSize:'0.65rem',fontWeight:'700'}}>● LIVE</span>
        </div>
      </div>

      <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'#111'}}>
        <button style={tabStyle('queries')} onClick={()=>setTab('queries')}>🔍 Queries</button>
        <button style={tabStyle('schema')}  onClick={()=>setTab('schema')}>🏗 Schema</button>
        <button style={tabStyle('setup')}   onClick={()=>setTab('setup')}>⚙️ Setup</button>
      </div>

      <div className="screen-body">

        {/* ── QUERIES TAB ─────────────────────────────── */}
        {tab === 'queries' && (
          <>
            {/* Category filter */}
            <div style={{display:'flex',gap:'5px',overflowX:'auto',paddingBottom:'4px',marginBottom:'12px',scrollbarWidth:'none'}}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={()=>setCatFilter(c)} style={{
                  flexShrink:0, padding:'5px 12px', borderRadius:'20px', cursor:'pointer',
                  fontSize:'0.75rem', fontWeight:'600', border:'1px solid',
                  borderColor: catFilter===c ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
                  background: catFilter===c ? 'rgba(200,144,58,0.15)' : 'transparent',
                  color: catFilter===c ? 'var(--gold)' : '#5C7080',
                }}>{c}</button>
              ))}
            </div>

            {/* Query dropdown */}
            <div className="card-section-label">SELECT A QUERY</div>
            <div className="card" style={{marginBottom:'12px'}}>
              <select className="field-input" value={selectedKey}
                onChange={e => { if(e.target.value) runQuery(e.target.value) }}>
                <option value="">— pick a query to run —</option>
                {filtered.map(q => (
                  <option key={q.key} value={q.key}>{q.label}</option>
                ))}
              </select>
              <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginTop:'10px'}}>
                {filtered.map(q => (
                  <button key={q.key}
                    onClick={()=>runQuery(q.key)}
                    style={{
                      padding:'6px 12px', borderRadius:'20px', cursor:'pointer', fontSize:'0.72rem',
                      fontWeight:'600', border:'1px solid', whiteSpace:'nowrap',
                      borderColor: selectedKey===q.key ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
                      background: selectedKey===q.key ? 'rgba(200,144,58,0.12)' : 'transparent',
                      color: selectedKey===q.key ? 'var(--gold)' : '#8A9BAE',
                    }}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results */}
            {loading && (
              <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'16px',color:'#5C7080',fontSize:'0.82rem'}}>
                <div className="spinner"/>Running query...
              </div>
            )}
            {error && (
              <div style={{background:'rgba(198,40,40,0.1)',border:'1px solid rgba(198,40,40,0.3)',borderRadius:'10px',padding:'12px',color:'#EF9A9A',fontSize:'0.8rem'}}>
                ❌ {error}
              </div>
            )}
            {results && !loading && (
              <div style={{background:'#1E2535',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.06)',overflow:'hidden'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                  <div style={{color:'#C8903A',fontWeight:'600',fontSize:'0.82rem'}}>
                    {PRESET_QUERIES.find(q=>q.key===selectedKey)?.label}
                  </div>
                  <span style={{color:'#5C7080',fontSize:'0.72rem'}}>{results.length} row{results.length!==1?'s':''}</span>
                </div>
                <div style={{padding:'0 8px 8px'}}>
                  <ResultTable rows={results} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── SCHEMA TAB ──────────────────────────────── */}
        {tab === 'schema' && (
          <>
            <div className="card-section-label">TABLES IN bgindia-db</div>
            {SCHEMA_TABLES.map(t => (
              <div key={t.name} style={{background:'#1E2535',borderRadius:'10px',padding:'12px 14px',marginBottom:'8px',border:'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{color:'#C8903A',fontWeight:'700',fontSize:'0.85rem',fontFamily:'monospace',marginBottom:'4px'}}>{t.name}</div>
                <div style={{color:'#5C7080',fontSize:'0.72rem',lineHeight:'1.5'}}>{t.cols}</div>
              </div>
            ))}
            <div style={{background:'rgba(24,95,165,0.08)',border:'1px solid rgba(24,95,165,0.2)',borderRadius:'10px',padding:'12px',marginTop:'4px'}}>
              <div style={{color:'#85B7EB',fontWeight:'600',fontSize:'0.78rem',marginBottom:'4px'}}>💡 Full schema</div>
              <div style={{color:'#5C7080',fontSize:'0.72rem'}}>View <code style={{color:'#C8903A'}}>schema.sql</code> in the repo root for complete column definitions, indexes and inventory seed data.</div>
            </div>
          </>
        )}

        {/* ── SETUP TAB ───────────────────────────────── */}
        {tab === 'setup' && (
          <>
            <div className="card-section-label">CONNECTION STATUS</div>
            <div className="card" style={{marginBottom:'12px'}}>
              {[
                {label:'D1 database',   value:'bgindia-db',                          ok:true},
                {label:'Database ID',   value:'6047aa03-9893-4fd9-8ba2-b3d7f5264ed1',ok:true},
                {label:'Worker route',  value:'/api/[[route]].js',                   ok:true},
                {label:'Binding name',  value:'bgindia_db',                          ok:true},
                {label:'Total stays',   value:'240 (run query to verify)',            ok:true},
              ].map(row => (
                <div key={row.label} style={{display:'flex',justifyContent:'space-between',marginBottom:'8px',alignItems:'center'}}>
                  <span style={{color:'#8A9BAE',fontSize:'0.78rem'}}>{row.label}</span>
                  <span style={{color:row.ok?'#34A853':'#EF9A9A',fontSize:'0.75rem',fontFamily:'monospace',maxWidth:'55%',textAlign:'right'}}>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="card-section-label">USEFUL TERMINAL COMMANDS</div>
            {[
              {title:'Run any SQL',    code:'wrangler d1 execute bgindia-db --remote \\\n  --command "SELECT COUNT(*) FROM stays"'},
              {title:'Add new table',  code:'wrangler d1 execute bgindia-db --remote \\\n  --file=schema.sql'},
              {title:'Seed Raman data',code:'wrangler d1 execute bgindia-db --remote \\\n  --file=scripts/seed-raman.sql'},
              {title:'Local dev with D1',code:'wrangler pages dev dist \\\n  --d1 bgindia_db=bgindia-db'},
            ].map((item,i) => (
              <div key={i} style={{background:'#1E2535',borderRadius:'10px',padding:'12px',marginBottom:'8px',border:'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{color:'#EDF2F7',fontWeight:'600',fontSize:'0.82rem',marginBottom:'6px'}}>{item.title}</div>
                <pre style={{color:'#79B8FF',fontSize:'0.68rem',margin:0,whiteSpace:'pre-wrap',background:'#0D1117',borderRadius:'6px',padding:'8px'}}>
                  {item.code}
                </pre>
              </div>
            ))}
          </>
        )}

      </div>
    </div>
  )
}
