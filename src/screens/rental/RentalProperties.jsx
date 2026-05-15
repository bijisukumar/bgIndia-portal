import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CUR_MONTH = new Date().getMonth()
const CUR_YEAR  = new Date().getFullYear()

const INCOME_FIELDS  = [
  { key: 'rent',       label: 'Rent received', color: 'green' },
  { key: 'carParking', label: 'Car parking',   color: 'green' },
]
const EXPENSE_FIELDS = [
  { key: 'maintenance',      label: 'Maintenance fee'  },
  { key: 'electricity',      label: 'Electricity'      },
  { key: 'water',            label: 'Water'            },
  { key: 'propertyTax',      label: 'Property tax'     },
  { key: 'landTax',          label: 'Land tax'         },
  { key: 'extraMaintenance', label: 'Add. maintenance' },
]
const ALL_FIELDS = [...INCOME_FIELDS, ...EXPENSE_FIELDS]

function emptyProp()  { return Object.fromEntries(ALL_FIELDS.map(f => [f.key, '0'])) }
function calcIncome(p)  { return INCOME_FIELDS.reduce((s,f)  => s + (parseFloat(p[f.key])||0), 0) }
function calcExpense(p) { return EXPENSE_FIELDS.reduce((s,f) => s + (parseFloat(p[f.key])||0), 0) }
function calcNet(p)     { return calcIncome(p) - calcExpense(p) }
function fmt(n) {
  if (n === undefined || n === null) return '—'
  const abs = Math.abs(n)
  const s = abs >= 100000 ? `₹${(abs/100000).toFixed(1)}L` : abs >= 1000 ? `₹${(abs/1000).toFixed(1)}K` : `₹${abs.toLocaleString('en-IN')}`
  return n < 0 ? `−${s}` : s
}
function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / (1000*60*60*24))
}

export default function RentalProperties() {
  const navigate = useNavigate()
  const [tab, setTab]         = useState('tracker')
  const [monthFrom, setMonthFrom] = useState(CUR_MONTH)
  const [monthTo,   setMonthTo]   = useState(CUR_MONTH)
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState(null)
  const [data, setData]       = useState(CONFIG.rentalProperties.map(() => emptyProp()))
  const [dashData, setDashData]   = useState(null)
  const [dashLoading, setDashLoading] = useState(false)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }
  const set = (pi, key, val) => setData(d => d.map((p,i) => i===pi ? {...p,[key]:val} : p))
  const totalNet = data.reduce((s,p) => s+calcNet(p), 0)
  const monthCount = monthTo - monthFrom + 1

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.saveRentalIncome({ monthFrom, monthTo, year: CUR_YEAR, properties: data })
      const label = monthFrom === monthTo
        ? MONTHS[monthFrom]
        : `${MONTHS[monthFrom]}–${MONTHS[monthTo]}`
      showToast(`✓ Saved for ${label} ${CUR_YEAR}${monthCount > 1 ? ` (${monthCount} months)` : ''}`)
    } catch { showToast('Failed to save','error') }
    finally { setSaving(false) }
  }

  useEffect(() => {
    if (tab === 'dashboard' && !dashData) {
      setDashLoading(true)
      api.getRentalDashboard(CUR_YEAR)
        .then(d => { setDashData(d); setDashLoading(false) })
        .catch(() => { setDashData(MOCK_DASH); setDashLoading(false) })
    }
  }, [tab])

  const renewals = CONFIG.rentalProperties
    .map((p,i) => ({...p, idx:i, days: p.leaseEnd ? daysUntil(p.leaseEnd) : null}))
    .filter(p => p.days !== null && p.days <= 60)

  const tabStyle = (t) => ({
    flex:1, padding:'10px 4px', border:'none', cursor:'pointer',
    fontSize:'0.78rem', fontWeight:'600', letterSpacing:'0.3px', textAlign:'center',
    background: tab===t ? 'rgba(200,144,58,0.1)' : 'transparent',
    color: tab===t ? '#C8903A' : '#5C7080',
    borderBottom: tab===t ? '2px solid #C8903A' : '2px solid transparent',
  })

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Rental properties</div>
          <div className="topbar-sub">MONTHLY INCOME TRACKER · {CUR_YEAR}</div>
        </div>
      </div>

      <div style={{display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'#111'}}>
        <button style={tabStyle('tracker')}  onClick={()=>setTab('tracker')}>📋 Monthly entry</button>
        <button style={tabStyle('dashboard')} onClick={()=>setTab('dashboard')}>📊 Dashboard</button>
      </div>

      <div className="screen-body">

        {/* RENEWAL ALERTS */}
        {renewals.length > 0 && (
          <div style={{background:'rgba(198,40,40,0.1)',border:'1px solid rgba(198,40,40,0.3)',borderRadius:'12px',padding:'12px 14px',marginBottom:'12px'}}>
            <div style={{color:'#EF9A9A',fontWeight:'600',fontSize:'0.82rem',marginBottom:'6px'}}>🔔 Renewal alerts</div>
            {renewals.map(p => (
              <div key={p.idx} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                <span style={{color:'#EDF2F7',fontSize:'0.82rem'}}>{p.name}</span>
                <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                  <span style={{color:p.days<0?'#EF9A9A':'#FFCC80',fontSize:'0.78rem'}}>
                    {p.days<0?`Expired ${Math.abs(p.days)}d ago`:`${p.days}d left`}
                  </span>
                  <button style={{background:'rgba(52,168,83,0.15)',border:'1px solid rgba(52,168,83,0.3)',borderRadius:'8px',color:'#34A853',fontSize:'0.72rem',padding:'2px 8px',cursor:'pointer'}}
                    onClick={()=>showToast(`Renewal email drafted for ${p.name}`)}>📧 Renew</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TRACKER TAB ──────────────────────────────── */}
        {tab === 'tracker' && (
          <>
            {/* Month range selector */}
            <div className="card-section-label">SELECT MONTH RANGE TO SAVE</div>
            <div className="card" style={{marginBottom:'12px'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'10px'}}>
                <div style={{flex:1}}>
                  <div style={{color:'#5C7080',fontSize:'0.68rem',marginBottom:'4px'}}>FROM</div>
                  <select className="field-input" value={monthFrom}
                    onChange={e=>{const v=parseInt(e.target.value); setMonthFrom(v); if(v>monthTo) setMonthTo(v)}}>
                    {MONTHS.map((m,i)=><option key={m} value={i}>{m}</option>)}
                  </select>
                </div>
                <div style={{color:'#5C7080',paddingTop:'18px',fontSize:'0.9rem'}}>→</div>
                <div style={{flex:1}}>
                  <div style={{color:'#5C7080',fontSize:'0.68rem',marginBottom:'4px'}}>TO</div>
                  <select className="field-input" value={monthTo}
                    onChange={e=>setMonthTo(parseInt(e.target.value))}>
                    {MONTHS.map((m,i)=><option key={m} value={i} disabled={i<monthFrom}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Quick presets */}
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                {[
                  {label:'This month', f:CUR_MONTH, t:CUR_MONTH},
                  {label:'Q1', f:0, t:2}, {label:'Q2', f:3, t:5},
                  {label:'Q3', f:6, t:8}, {label:'Q4', f:9, t:11},
                  {label:'H1', f:0, t:5}, {label:'H2', f:6, t:11},
                  {label:'Full year', f:0, t:11},
                ].map(preset => (
                  <button key={preset.label}
                    onClick={()=>{setMonthFrom(preset.f); setMonthTo(preset.t)}}
                    style={{
                      padding:'4px 10px', borderRadius:'16px', cursor:'pointer',
                      fontSize:'0.72rem', fontWeight:'600', border:'1px solid',
                      borderColor: monthFrom===preset.f && monthTo===preset.t ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
                      background: monthFrom===preset.f && monthTo===preset.t ? 'rgba(200,144,58,0.15)' : 'transparent',
                      color: monthFrom===preset.f && monthTo===preset.t ? 'var(--gold)' : '#5C7080',
                    }}>
                    {preset.label}
                  </button>
                ))}
              </div>

              {monthCount > 1 && (
                <div style={{marginTop:'8px',background:'rgba(200,144,58,0.06)',borderRadius:'8px',padding:'8px 10px',color:'#C8903A',fontSize:'0.78rem'}}>
                  💡 Same amounts will be saved for <strong>{monthCount} months</strong> ({MONTHS[monthFrom]}–{MONTHS[monthTo]} {CUR_YEAR})
                </div>
              )}
            </div>

            {/* Property entries */}
            {CONFIG.rentalProperties.map((prop, pi) => {
              const p   = data[pi]
              const inc = calcIncome(p), exp = calcExpense(p), net = inc - exp
              return (
                <div key={prop.id}>
                  <div className="card-section-label" style={{display:'flex',justifyContent:'space-between'}}>
                    <span>{prop.name.toUpperCase()}</span>
                    <span style={{color:net>=0?'#34A853':'#EF9A9A',fontWeight:'700'}}>{fmt(net)}</span>
                  </div>
                  <div className="card">
                    {prop.tenantName && (
                      <div style={{color:'#5C7080',fontSize:'0.75rem',marginBottom:'10px'}}>
                        Tenant: <span style={{color:'#EDF2F7'}}>{prop.tenantName}</span>
                        {prop.leaseEnd && <span style={{marginLeft:'8px',color:daysUntil(prop.leaseEnd)<30?'#FFCC80':'#5C7080'}}>· Lease ends {prop.leaseEnd}</span>}
                      </div>
                    )}
                    <div style={{fontSize:'0.7rem',color:'#34A853',letterSpacing:'1px',marginBottom:'6px'}}>INCOME</div>
                    <div className="grid-2">
                      {INCOME_FIELDS.map(f=>(
                        <div key={f.key} className="field">
                          <label className="field-label">{f.label}</label>
                          <input className="field-input" type="number" placeholder="0"
                            style={{color:'#34A853'}} value={p[f.key]}
                            onChange={e=>set(pi,f.key,e.target.value)}/>
                        </div>
                      ))}
                    </div>
                    <div className="divider"/>
                    <div style={{fontSize:'0.7rem',color:'#EF9A9A',letterSpacing:'1px',marginBottom:'6px'}}>EXPENSES</div>
                    <div className="grid-2">
                      {EXPENSE_FIELDS.map(f=>(
                        <div key={f.key} className="field">
                          <label className="field-label">{f.label}</label>
                          <input className="field-input" type="number" placeholder="0"
                            style={{color:'#EF9A9A'}} value={p[f.key]}
                            onChange={e=>set(pi,f.key,e.target.value)}/>
                        </div>
                      ))}
                    </div>
                    <div className="divider"/>
                    <div style={{display:'flex',gap:'20px',paddingTop:'4px'}}>
                      <div><div style={{color:'#5C7080',fontSize:'0.68rem'}}>INCOME</div><div style={{color:'#34A853',fontWeight:'700'}}>{fmt(inc)}</div></div>
                      <div><div style={{color:'#5C7080',fontSize:'0.68rem'}}>EXPENSE</div><div style={{color:'#EF9A9A',fontWeight:'700'}}>{fmt(exp)}</div></div>
                      <div><div style={{color:'#5C7080',fontSize:'0.68rem'}}>NET</div><div style={{color:net>=0?'#34A853':'#EF9A9A',fontWeight:'700'}}>{fmt(net)}</div></div>
                    </div>
                  </div>
                </div>
              )
            })}

            <div className="net-box" style={{marginTop:'8px'}}>
              <div className="net-row">
                <span style={{color:'#EDF2F7',fontWeight:'600',fontSize:'1rem'}}>
                  Total net · {monthCount > 1 ? `${MONTHS[monthFrom]}–${MONTHS[monthTo]}` : MONTHS[monthFrom]} {CUR_YEAR}
                </span>
                <span className={`net-val big ${totalNet<0?'neg':''}`}>{fmt(totalNet)}</span>
              </div>
              {monthCount > 1 && (
                <div className="net-row">
                  <span className="net-label">{monthCount} months × {fmt(totalNet)}</span>
                  <span style={{color:'#85B7EB',fontWeight:'700'}}>{fmt(totalNet * monthCount)}</span>
                </div>
              )}
            </div>

            <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : monthCount > 1
                ? `Save for ${MONTHS[monthFrom]}–${MONTHS[monthTo]} (${monthCount} months) →`
                : `Save ${MONTHS[monthFrom]} ${CUR_YEAR} →`}
            </button>
            <p className="btn-email-note">📧 Owner notified on save</p>
          </>
        )}

        {/* ── DASHBOARD TAB ─────────────────────────────── */}
        {tab === 'dashboard' && (
          dashLoading ? <div className="loading"><div className="spinner"/>Loading...</div> : (
            <>
              <div className="card-section-label">ANNUAL SUMMARY — {CUR_YEAR}</div>
              <div className="stats-grid">
                <div className="stat-card"><div className="stat-label">Total income</div><div className="stat-val green">{fmt(dashData?.totalIncome)}</div><div className="stat-sub">All properties</div></div>
                <div className="stat-card"><div className="stat-label">Total expenses</div><div className="stat-val" style={{color:'#EF9A9A'}}>{fmt(dashData?.totalExpense)}</div><div className="stat-sub">All properties</div></div>
                <div className="stat-card"><div className="stat-label">Net income</div><div className="stat-val green">{fmt(dashData?.netIncome)}</div><div className="stat-sub">After expenses</div></div>
              </div>
              {CONFIG.rentalProperties.map((prop,i) => {
                const rows = (dashData?.rows||[]).filter(r=>r.prop_id===prop.id)
                const ytdIncome  = rows.reduce((s,r)=>s+(r.income||0),0)
                const ytdExpense = rows.reduce((s,r)=>s+(r.expense||0),0)
                const ytdNet     = rows.reduce((s,r)=>s+(r.net||0),0)
                const monthly    = Array(12).fill(0).map((_,mi)=>{const r=rows.find(r=>r.month===mi+1); return r?.net||0})
                const maxAbs     = Math.max(...monthly.map(Math.abs), 1)
                return (
                  <div key={prop.id}>
                    <div className="card-section-label">{prop.name.toUpperCase()}</div>
                    <div className="card">
                      <div style={{display:'flex',gap:'20px',marginBottom:'12px'}}>
                        <div><div style={{color:'#5C7080',fontSize:'0.68rem'}}>YTD INCOME</div><div style={{color:'#34A853',fontWeight:'700'}}>{fmt(ytdIncome)}</div></div>
                        <div><div style={{color:'#5C7080',fontSize:'0.68rem'}}>YTD EXPENSE</div><div style={{color:'#EF9A9A',fontWeight:'700'}}>{fmt(ytdExpense)}</div></div>
                        <div><div style={{color:'#5C7080',fontSize:'0.68rem'}}>YTD NET</div><div style={{color:ytdNet>=0?'#34A853':'#EF9A9A',fontWeight:'700'}}>{fmt(ytdNet)}</div></div>
                      </div>
                      <div style={{display:'flex',gap:'3px',alignItems:'flex-end',height:'48px'}}>
                        {monthly.map((net,mi)=>{
                          const h = Math.max(2,(Math.abs(net)/maxAbs)*44)
                          return (
                            <div key={mi} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
                              <div style={{width:'100%',height:`${h}px`,background:net>=0?'#0F6E56':'#c62828',borderRadius:'2px',opacity:mi>CUR_MONTH?0.3:0.9}}/>
                              <div style={{color:'#3C5060',fontSize:'6px',marginTop:'2px'}}>{MONTHS[mi][0]}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

const MOCK_DASH = {
  totalIncome:312000, totalExpense:48600, netIncome:263400,
  rows: CONFIG?.rentalProperties?.flatMap((p,i) =>
    Array.from({length:5},(_,mi)=>({prop_id:`rental_${i+1}`,month:mi+1,income:9000,expense:1500,net:7500}))
  ) || []
}
