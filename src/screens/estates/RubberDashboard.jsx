import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../hooks/useAuth'
import { parseLocalDate, localTodayStr } from '../../utils/dates'

const CUR_YEAR = new Date().getFullYear()
const YEARS    = [0, CUR_YEAR, CUR_YEAR - 1, CUR_YEAR - 2, CUR_YEAR - 3]

function fmtDate(d) {
  if (!d) return '—'
  const parsed = parseLocalDate(d)
  if (!parsed) return '—'
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Weight / revenue trend chart ──────────────────────────────
function WeightTrendChart({ harvests }) {
  if (!harvests?.length) return <div style={s.empty}>No data</div>
  const data    = [...harvests].reverse() // oldest → newest
  const maxKg   = Math.max(...data.map(h => h.weightKg), 1)
  const W = 320, H = 120, pad = 36, barW = Math.max(8, Math.floor((W - pad * 2) / data.length) - 2)

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width:'100%', display:'block' }}>
      {[0, 0.5, 1].map(f => {
        const y = pad + (1 - f) * (H - pad)
        return (
          <g key={f}>
            <line x1={pad} y1={y} x2={W - 8} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            <text x={pad - 4} y={y + 3} textAnchor="end" fill="#5C7080" fontSize="7">
              {Math.round(maxKg * f).toLocaleString('en-IN')}
            </text>
          </g>
        )
      })}
      {data.map((h, i) => {
        const barH = Math.max(3, (h.weightKg / maxKg) * (H - pad))
        const x    = pad + i * (barW + 2)
        return (
          <g key={i}>
            <rect x={x} y={H - barH} width={barW} height={barH} fill="#0F6E56" rx="2" opacity="0.85"/>
            <text x={x + barW / 2} y={H + 10} textAnchor="middle" fill="#5C7080" fontSize="6.5">
              {h.monthShort}
            </text>
            <text x={x + barW / 2} y={H + 19} textAnchor="middle" fill="#3C5060" fontSize="5.5">
              {h.year ? String(h.year).slice(2) : ''}
            </text>
          </g>
        )
      })}
      <rect x={pad} y={H + 25} width={8} height={6} fill="#0F6E56" rx="1"/>
      <text x={pad + 11} y={H + 30} fill="#8A9BAE" fontSize="7">Latex collected (kg)</text>
    </svg>
  )
}

export default function RubberDashboard() {
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const isOwner    = user?.role === 'owner'
  const [year, setYear]         = useState(0)  // 0 = All
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [dash, setDash]         = useState(null)
  const [plOpen, setPlOpen]             = useState(false)
  const [drillMonth, setDrillMonth]     = useState(null)
  const [drillCategory, setDrillCategory] = useState(null)   // 'YYYY-MM::Category' currently expanded to line items
  const [harvestLogOpen, setHarvestLogOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.getRubberHarvests(year === 0 ? 'all' : year, 'pavutumuri')
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [year])

  useEffect(() => {
    if (user?.role === 'owner') {
      api.getEstateDashboard('pavutumuri')
        .then(d => setDash(d))
        .catch(() => {})
    }
  }, [user])

  const harvests = data?.harvests || []

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Rubber Dashboard</div>
          <div className="topbar-sub">PAVUTUMURI ESTATE</div>
        </div>
      </div>

      <div className="screen-body">

        {/* THIS MONTH — owner only, always visible */}
        {isOwner && dash && (() => {
          const nowYm = localTodayStr().slice(0, 7)
          const thisMonth = (dash.monthly || []).find(m => m.ym === nowYm)
            || { income: 0, expense: 0, net: 0 }
          const monthLabel = parseLocalDate(nowYm + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
          const fmtShort = (v) => `₹${Math.abs(v) >= 100000 ? (Math.abs(v)/100000).toFixed(1)+'L' : Math.abs(v) >= 1000 ? (Math.abs(v)/1000).toFixed(1)+'K' : Math.abs(v).toLocaleString('en-IN')}`
          const isLoss = thisMonth.net < 0
          return (
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'12px', padding:'12px 14px', marginBottom:'14px' }}>
              <div style={{ fontSize:'0.58rem', color:'#5C7080', letterSpacing:'1.5px', marginBottom:'8px' }}>{monthLabel.toUpperCase()}</div>
              <div style={{ display:'flex', gap:'10px', marginBottom:'4px' }}>
                <span style={{ fontSize:'0.78rem', color:'#34A853' }}>+{fmtShort(thisMonth.income)}</span>
                <span style={{ fontSize:'0.78rem', color:'#F59E0B' }}>-{fmtShort(thisMonth.expense)}</span>
              </div>
              <div className={isLoss ? 'loss-gleam' : ''} style={{ fontSize:'1rem', fontWeight:'700', color: isLoss ? '#EF4444' : '#C8903A' }}>
                {thisMonth.net >= 0 ? '+' : '-'}{fmtShort(thisMonth.net)}{isLoss && ' (loss)'}
              </div>
            </div>
          )
        })()}

        {/* YEAR-TO-DATE P&L SUMMARY — owner only */}
        {isOwner && dash && (() => {
          const expEntries = Object.entries(dash.expBreakdown || {}).filter(([,v]) => v > 0).sort(([,a],[,b]) => b - a)
          const isLoss = dash.netProfit < 0
          const rangeLabel = (dash.rangeFrom && dash.rangeTo)
            ? `${parseLocalDate(dash.rangeFrom).toLocaleDateString('en-IN',{month:'short',year:'numeric'})} – ${parseLocalDate(dash.rangeTo).toLocaleDateString('en-IN',{month:'short',day:'2-digit',year:'numeric'})}`
            : ''
          return (
          <div style={{ background:'rgba(200,144,58,0.06)', border:'1px solid rgba(200,144,58,0.2)', borderRadius:'14px', marginBottom:'14px', overflow:'hidden' }}>
            <div onClick={()=>setPlOpen(o=>!o)} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 16px', cursor:'pointer' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'0.62rem', color:'#C8903A', letterSpacing:'2px', marginBottom:'2px' }}>YEAR TO DATE · {CUR_YEAR}</div>
                {rangeLabel && <div style={{ fontSize:'0.6rem', color:'#5C7080', marginBottom:'6px' }}>{rangeLabel}</div>}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
                  {[
                    { label:'INCOME',  val: dash.totalIncome,  color:'#34A853' },
                    { label:'EXPENSE', val: dash.totalExpense, color:'#F59E0B' },
                    { label:'NET PROFIT', val: dash.netProfit, color: isLoss ? '#EF4444' : '#C8903A', gleam: isLoss },
                  ].map(k => (
                    <div key={k.label}>
                      <div style={{ fontSize:'0.58rem', color:'#5C7080', letterSpacing:'1px', marginBottom:'3px' }}>{k.label}</div>
                      <div className={k.gleam ? 'loss-gleam' : ''} style={{ fontWeight:'700', color: k.color, fontSize:'1rem' }}>
                        {k.label === 'NET PROFIT' && isLoss ? '−' : ''}₹{Math.abs(k.val) >= 100000 ? (Math.abs(k.val)/100000).toFixed(1)+'L' : Math.abs(k.val) >= 1000 ? (Math.abs(k.val)/1000).toFixed(1)+'K' : Math.abs(k.val).toLocaleString('en-IN')}
                        {k.label === 'NET PROFIT' && isLoss && <span style={{ fontSize:'0.62rem', fontWeight:600, marginLeft:'4px' }}>LOSS</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ color:'#5C7080', fontSize:'1.1rem' }}>{plOpen ? '∧' : '∨'}</div>
            </div>

            {plOpen && (
              <div style={{ borderTop:'1px solid rgba(200,144,58,0.15)', padding:'12px 16px' }}>
                {expEntries.length > 0 && (
                  <div style={{ marginBottom:'14px' }}>
                    <div style={{ fontSize:'0.62rem', color:'#F59E0B', letterSpacing:'1.5px', marginBottom:'8px' }}>EXPENSE BREAKDOWN</div>
                    {expEntries.map(([cat, amt]) => {
                        const pct = Math.round((amt / dash.totalExpense) * 100)
                        const barColor = pct > 10 ? '#EF4444' : '#F59E0B'
                        return (
                          <div key={cat} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
                            <div style={{ fontSize:'0.72rem', color:'#9AA5B4', width:'120px', flexShrink:0 }}>{cat}</div>
                            <div style={{ flex:1, height:'4px', background:'rgba(255,255,255,0.06)', borderRadius:'2px' }}>
                              <div style={{ height:'4px', width:`${pct}%`, background: barColor, borderRadius:'2px' }}/>
                            </div>
                            <div style={{ fontSize:'0.72rem', color: barColor, fontWeight:'600', width:'48px', textAlign:'right' }}>
                              ₹{amt >= 1000 ? (amt/1000).toFixed(1)+'K' : amt}
                            </div>
                            <div style={{ fontSize:'0.65rem', color:'#5C7080', width:'30px', textAlign:'right' }}>{pct}%</div>
                          </div>
                        )
                      })
                    }
                  </div>
                )}

                {(dash.monthly || []).length > 0 && (
                  <div>
                    <div style={{ fontSize:'0.62rem', color:'#C8903A', letterSpacing:'1.5px', marginBottom:'8px' }}>MONTHLY BREAKDOWN</div>
                    {dash.monthly.map(m => {
                      const isOpen = drillMonth === m.ym
                      const monthLabel = parseLocalDate(m.ym + '-01').toLocaleDateString('en-IN', { month:'short', year:'numeric' })
                      const monthIsLoss = m.net < 0
                      const monthExpEntries = Object.entries(m.expBreakdown || {}).filter(([,v]) => v > 0).sort(([,a],[,b]) => b - a)
                      return (
                        <div key={m.ym} style={{ marginBottom:'6px', background:'rgba(255,255,255,0.02)', borderRadius:'8px', overflow:'hidden', border:'1px solid rgba(255,255,255,0.05)' }}>
                          <div onClick={()=>setDrillMonth(isOpen ? null : m.ym)}
                            style={{ display:'flex', alignItems:'center', padding:'8px 10px', cursor:'pointer', gap:'10px' }}>
                            <div style={{ fontSize:'0.78rem', color:'#EDF2F7', fontWeight:'600', width:'70px' }}>{monthLabel}</div>
                            <div style={{ flex:1, display:'flex', gap:'12px' }}>
                              <span style={{ fontSize:'0.72rem', color:'#34A853' }}>+₹{m.income >= 1000 ? (m.income/1000).toFixed(1)+'K' : m.income}</span>
                              <span style={{ fontSize:'0.72rem', color:'#F59E0B' }}>-₹{m.expense >= 1000 ? (m.expense/1000).toFixed(1)+'K' : m.expense}</span>
                            </div>
                            <div style={{ fontSize:'0.78rem', fontWeight:'700', color: monthIsLoss ? '#EF4444' : '#C8903A' }}>
                              {m.net >= 0 ? '+' : '−'}₹{Math.abs(m.net) >= 1000 ? (Math.abs(m.net)/1000).toFixed(1)+'K' : Math.abs(m.net)}
                            </div>
                            <div style={{ fontSize:'0.7rem', color:'#5C7080' }}>{isOpen ? '∧' : '›'}</div>
                          </div>
                          {isOpen && (
                            <div style={{ padding:'8px 10px 10px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ display:'flex', gap:'16px', marginBottom: monthExpEntries.length > 0 ? '10px' : 0 }}>
                                <div><div style={{ fontSize:'0.6rem', color:'#5C7080' }}>INCOME</div><div style={{ color:'#34A853', fontWeight:'600', fontSize:'0.82rem' }}>₹{m.income.toLocaleString('en-IN')}</div></div>
                                <div><div style={{ fontSize:'0.6rem', color:'#5C7080' }}>EXPENSE</div><div style={{ color:'#F59E0B', fontWeight:'600', fontSize:'0.82rem' }}>₹{m.expense.toLocaleString('en-IN')}</div></div>
                                <div><div style={{ fontSize:'0.6rem', color:'#5C7080' }}>NET</div><div style={{ color: monthIsLoss?'#EF4444':'#C8903A', fontWeight:'700', fontSize:'0.82rem' }}>₹{m.net.toLocaleString('en-IN')}</div></div>
                              </div>
                              {monthExpEntries.length > 0 && (
                                <div>
                                  <div style={{ fontSize:'0.58rem', color:'#5C7080', letterSpacing:'1px', marginBottom:'6px' }}>EXPENSE COMPONENTS</div>
                                  {monthExpEntries.map(([cat, amt]) => {
                                    const pct = Math.round((amt / m.expense) * 100)
                                    const barColor = pct > 10 ? '#EF4444' : '#F59E0B'
                                    const catKey = `${m.ym}::${cat}`
                                    const catOpen = drillCategory === catKey
                                    const lines = (m.expLines || {})[cat] || []
                                    return (
                                      <div key={cat}>
                                        <div onClick={()=>setDrillCategory(catOpen ? null : catKey)}
                                          style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px', cursor: lines.length ? 'pointer' : 'default' }}>
                                          <div style={{ fontSize:'0.68rem', color:'#9AA5B4', width:'100px', flexShrink:0 }}>{cat}</div>
                                          <div style={{ flex:1, height:'3px', background:'rgba(255,255,255,0.06)', borderRadius:'2px' }}>
                                            <div style={{ height:'3px', width:`${pct}%`, background: barColor, borderRadius:'2px' }}/>
                                          </div>
                                          <div style={{ fontSize:'0.66rem', color: barColor, fontWeight:'600', width:'44px', textAlign:'right' }}>
                                            ₹{amt >= 1000 ? (amt/1000).toFixed(1)+'K' : amt}
                                          </div>
                                          {lines.length > 0 && (
                                            <div style={{ fontSize:'0.6rem', color:'#5C7080', width:'12px', textAlign:'right' }}>{catOpen ? '∧' : '›'}</div>
                                          )}
                                        </div>
                                        {catOpen && lines.length > 0 && (
                                          <div style={{ margin:'2px 0 10px 0', padding:'6px 8px', background:'rgba(255,255,255,0.02)', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.05)' }}>
                                            {lines.map((ln, i) => (
                                              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:'8px', padding:'3px 0', borderBottom: i < lines.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                                <div style={{ minWidth:0 }}>
                                                  <span style={{ fontSize:'0.66rem', color:'#9AA5B4' }}>{fmtDate(ln.date)}</span>
                                                  {(ln.paidTo || ln.description) && (
                                                    <span style={{ fontSize:'0.64rem', color:'#5C7080', marginLeft:'6px' }}>
                                                      {[ln.paidTo, ln.description].filter(Boolean).join(' — ')}
                                                    </span>
                                                  )}
                                                </div>
                                                <div style={{ fontSize:'0.68rem', color:'#EDF2F7', fontWeight:'600', flexShrink:0 }}>
                                                  ₹{Math.round(ln.amount).toLocaleString('en-IN')}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          )
        })()}

        {/* HARVEST LOG — collapsible, year filter pills inside */}
        <div style={{ background:'rgba(15,110,86,0.05)', border:'1px solid rgba(15,110,86,0.18)', borderRadius:'14px', marginBottom:'14px', overflow:'hidden' }}>
          <div onClick={()=>setHarvestLogOpen(o=>!o)} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 16px', cursor:'pointer' }}>
            <div style={{ flex:1, fontSize:'0.62rem', color:'#0F6E56', letterSpacing:'2px' }}>
              🌳 HARVEST LOG · {harvests.length} RECORDS
            </div>
            <div style={{ color:'#5C7080', fontSize:'1.1rem' }}>{harvestLogOpen ? '∧' : '∨'}</div>
          </div>
          {harvestLogOpen && (
            <div style={{ borderTop:'1px solid rgba(15,110,86,0.12)', padding:'12px 16px' }}>
              <div className="month-strip" style={{ marginBottom: '12px' }}>
                <button className={`month-pill${year === 0 ? ' active' : ''}`} onClick={() => setYear(0)}>All</button>
                {YEARS.slice(1).map(y => (
                  <button key={y} className={`month-pill${year === y ? ' active' : ''}`} onClick={() => setYear(y)}>{y}</button>
                ))}
              </div>

              {loading ? (
                <div className="loading"><div className="spinner"/>Loading...</div>
              ) : harvests.length === 0 ? (
                <div style={s.empty}>No rubber harvests recorded{year !== 0 ? ` for ${year}` : ''}</div>
              ) : harvests.map((h, i) => (
                <div key={i} style={s.harvestCard}>
                  <div style={s.cardHeader}>
                    <span style={s.harvestDate}>{fmtDate(h.date)}</span>
                    <span style={{ fontSize:'0.72rem', color: h.net >= 0 ? '#4CAF50' : '#EF9A9A', fontWeight:'700' }}>
                      {h.net >= 0 ? '+' : ''}₹{h.net.toLocaleString('en-IN')} net
                    </span>
                  </div>
                  <div style={s.metricGrid}>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>HARVEST #</div>
                      <div style={s.metricVal}>{harvests.length - i}</div>
                    </div>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>LATEX (KG)</div>
                      <div style={s.metricVal}>{h.weightKg.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>₹/KG</div>
                      <div style={{ ...s.metricVal, color: '#C8903A' }}>₹{h.pricePerKg}</div>
                    </div>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>GROSS</div>
                      <div style={{ ...s.metricVal, color: '#4CAF50' }}>₹{h.gross.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>EXPENSES</div>
                      <div style={{ ...s.metricVal, color: '#EF9A9A' }}>₹{h.expense.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>NET</div>
                      <div style={{ ...s.metricVal, color: h.net >= 0 ? '#C8903A' : '#EF9A9A', fontWeight:'700' }}>₹{h.net.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                  {h.notes && (
                    <div style={{ fontSize:'0.68rem', color:'#5C7080', marginTop:'8px', paddingTop:'8px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                      {h.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="loading"><div className="spinner"/>Loading...</div>
        ) : harvests.length > 0 && (
          <>
            {/* WEIGHT TREND */}
            <div className="card-section-label" style={{ marginTop: 20 }}>
              TREND — LATEX COLLECTED BY HARVEST
            </div>
            <div className="card" style={{ padding: '16px 8px' }}>
              <WeightTrendChart harvests={harvests} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  harvestCard: {
    background: '#1A1F24',
    borderRadius: 10,
    border: '1px solid rgba(15,110,86,0.15)',
    padding: '12px 14px',
    marginBottom: 8,
  },
  cardHeader:  { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 },
  harvestDate: { color: '#0F6E56', fontWeight: 700, fontSize: '0.88rem' },

  metricGrid:  { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'10px 6px' },
  metric:      {},
  metricLabel: { fontSize: '0.57rem', color: '#5C7080', letterSpacing: '1px', marginBottom: 2 },
  metricVal:   { fontSize: '0.82rem', fontWeight: 600, color: '#EDF2F7' },

  empty: { color: '#5C7080', textAlign: 'center', padding: '32px', fontSize: '0.85rem' },
}
