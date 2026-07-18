import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'
import { useAuth } from '../../hooks/useAuth'
import { parseLocalDate, localTodayStr } from '../../utils/dates'

const CUR_YEAR = new Date().getFullYear()
const YEARS    = [0, CUR_YEAR, CUR_YEAR - 1, CUR_YEAR - 2, CUR_YEAR - 3]

const PAVUTUMURI = CONFIG.estates.find(e => e.id === 'pavutumuri')
const DEFAULT_SHEET_RATE    = String(PAVUTUMURI?.sheetRatePerKg ?? 200)
const DEFAULT_OTTUPAL_RATE  = String(PAVUTUMURI?.ottupalRatePerKg ?? 150)
const SHEET_WEIGHT_KG       = PAVUTUMURI?.sheetWeightKg ?? 0.6

function fmtDate(d) {
  if (!d) return '—'
  const parsed = parseLocalDate(d)
  if (!parsed) return '—'
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function addDaysStr(dateStr, n) {
  const d = parseLocalDate(dateStr)
  if (!d) return dateStr
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
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
  const [bfBusy, setBfBusy] = useState(false)
  const [bfMsg, setBfMsg]   = useState('')

  async function runWagesBackfill() {
    setBfBusy(true); setBfMsg('')
    try {
      const r = await api.backfillRubberWages('pavutumuri')
      setBfMsg(`Filed ${r.weeksProcessed} week(s) · ₹${(r.totalWages || 0).toLocaleString('en-IN')} total ✓`)
      api.getEstateDashboard('pavutumuri').then(setDash).catch(() => {})
    } catch (e) { setBfMsg('Failed: ' + (e?.message || 'error')) }
    finally { setBfBusy(false) }
  }

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

        {/* LAST 3 MONTHS — owner only, always visible */}
        {isOwner && dash && (() => {
          const nowYm = localTodayStr().slice(0, 7)
          const fmtShort = (v) => `₹${Math.abs(v) >= 100000 ? (Math.abs(v)/100000).toFixed(1)+'L' : Math.abs(v) >= 1000 ? (Math.abs(v)/1000).toFixed(1)+'K' : Math.abs(v).toLocaleString('en-IN')}`
          const months = [0, 1, 2].map(i => {
            const dt = parseLocalDate(nowYm + '-01'); dt.setMonth(dt.getMonth() - i)
            const ym = dt.toISOString().slice(0, 7)
            const m = (dash.monthly || []).find(x => x.ym === ym) || { income: 0, expense: 0, net: 0 }
            return { ym, label: dt.toLocaleDateString('en-IN', { month: 'short' }), current: i === 0, ...m }
          })
          return (
            <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
              {months.map(m => {
                const isLoss = m.net < 0
                return (
                  <div key={m.ym} style={{ flex:1, background: m.current ? 'rgba(200,144,58,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${m.current ? 'rgba(200,144,58,0.25)' : 'rgba(255,255,255,0.06)'}`, borderRadius:'12px', padding:'10px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:'0.58rem', color:'#5C7080', letterSpacing:'1px', marginBottom:'6px' }}>{m.label.toUpperCase()}</div>
                    <div className={isLoss ? 'loss-gleam' : ''} style={{ fontSize:'0.92rem', fontWeight:'700', color: isLoss ? '#EF4444' : '#C8903A', marginBottom:'4px' }}>
                      {m.net >= 0 ? '+' : '-'}{fmtShort(m.net)}
                    </div>
                    <div style={{ fontSize:'0.62rem', color:'#34A853' }}>+{fmtShort(m.income)}</div>
                    <div style={{ fontSize:'0.62rem', color:'#F59E0B' }}>-{fmtShort(m.expense)}</div>
                  </div>
                )
              })}
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
                            <div style={{ width:'70px' }}>
                              <div style={{ fontSize:'0.78rem', color:'#EDF2F7', fontWeight:'600' }}>{monthLabel}</div>
                              {(m.trees > 0 || m.sheets > 0) && (
                                <div style={{ fontSize:'0.6rem', color:'#5C7080', marginTop:'1px' }}>{m.sheets.toLocaleString('en-IN')}s / {m.trees.toLocaleString('en-IN')}t</div>
                              )}
                            </div>
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
                              {(m.weeks || []).length > 0 && (
                                <div style={{ marginBottom:'10px' }}>
                                  <div style={{ fontSize:'0.58rem', color:'#5FD0AE', letterSpacing:'1px', marginBottom:'6px' }}>WEEKLY PRODUCTION</div>
                                  {m.weeks.map(w => {
                                    const wEnd = addDaysStr(w.weekStart, 6)
                                    const shortFmt = (d) => { const p = parseLocalDate(d); return p ? p.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : d }
                                    return (
                                      <div key={w.weekStart} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'4px 0', fontSize:'0.7rem' }}>
                                        <span style={{ color:'#9AA5B4', width:'92px', flexShrink:0 }}>{shortFmt(w.weekStart)}–{shortFmt(wEnd)}</span>
                                        <span style={{ color:'#EDF2F7' }}>{w.sheets.toLocaleString('en-IN')} sheets</span>
                                        <span style={{ color:'#5C7080' }}>·</span>
                                        <span style={{ color:'#EDF2F7' }}>{w.trees.toLocaleString('en-IN')} trees</span>
                                        {w.ottupal > 0 && <><span style={{ color:'#5C7080' }}>·</span><span style={{ color:'#EDF2F7' }}>{w.ottupal.toLocaleString('en-IN')} ottupal</span></>}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
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

        {/* Wages backfill — always visible for owners, not tucked behind the
            collapsed YTD panel (files missing "Rubber Labour" expenses for
            every past week in one click, idempotent) */}
        {isOwner && dash && (
          <div style={{ marginBottom:'14px', padding:'10px 14px', borderRadius:'10px', background:'rgba(95,208,174,0.05)', border:'1px solid rgba(95,208,174,0.2)' }}>
            <button onClick={runWagesBackfill} disabled={bfBusy} style={{ background:'transparent', border:'1px solid rgba(95,208,174,0.4)', color:'#5FD0AE', borderRadius:'8px', padding:'8px 12px', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', width:'100%' }}>
              {bfBusy ? 'Filing past wages…' : '⚙ Backfill past wages into P&L'}
            </button>
            {bfMsg && <div style={{ fontSize:'0.7rem', color:'#9AA5B4', marginTop:'8px', textAlign:'center' }}>{bfMsg}</div>}
          </div>
        )}

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

        <MonthlyRegister />
      </div>
    </div>
  )
}

// ── MONTHLY REGISTER + P&L (paper-register parity) ────────────────────────
// Day classification: rain / tapping / maintenance (trees worked, no sheets).
// P&L: estate_transactions income vs expense for the month. Includes a
// structured "record rubber sale" calculator (sheets -> kg -> Rs and
// ottupal kg -> Rs) that saves as two income transactions.
function MonthlyRegister() {
  const thisMonth = localTodayStr().slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saleOpen, setSaleOpen] = useState(false)
  const [expOpen, setExpOpen] = useState(false)
  const [sale, setSale] = useState({ sheets: '', weightKg: '', ratePerKg: DEFAULT_SHEET_RATE, ottupalKg: '', ottupalRate: DEFAULT_OTTUPAL_RATE })
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const load = () => api.getRubberMonthly({ estate: 'pavutumuri', month }).then(setData).catch(() => setData(null))
  useEffect(() => { setData(null); load() }, [month]) // eslint-disable-line

  const setS = (k, v) => setSale(f => {
    const n = { ...f, [k]: v }
    // Sheet weight default (CONFIG.estates) — auto-fill weight from sheet
    // count unless the user has typed a weight themselves (only overwrite
    // when it tracks)
    if (k === 'sheets') {
      const auto = Math.round((parseFloat(v) || 0) * SHEET_WEIGHT_KG * 100) / 100
      const prevAuto = Math.round((parseFloat(f.sheets) || 0) * SHEET_WEIGHT_KG * 100) / 100
      if (!f.weightKg || parseFloat(f.weightKg) === prevAuto) n.weightKg = auto ? String(auto) : ''
    }
    return n
  })
  const incomeA = Math.round((parseFloat(sale.weightKg) || 0) * (parseFloat(sale.ratePerKg) || 0) * 100) / 100
  const incomeB = Math.round((parseFloat(sale.ottupalKg) || 0) * (parseFloat(sale.ottupalRate) || 0) * 100) / 100

  async function saveSale() {
    if (incomeA <= 0 && incomeB <= 0) { showToast('Enter sheets/weight or ottupal kg', 'error'); return }
    setBusy(true)
    try {
      const date = `${month}-15` <= localTodayStr() ? `${month}-15` : localTodayStr()
      if (incomeA > 0) await api.saveEstateTransaction({
        estate: 'pavutumuri', type: 'income', date, category: 'Rubber Sheet', amount: incomeA,
        description: `${sale.sheets || '?'} sheets · ${sale.weightKg} kg @ ₹${sale.ratePerKg}/kg`,
      })
      if (incomeB > 0) await api.saveEstateTransaction({
        estate: 'pavutumuri', type: 'income', date, category: 'Ottupal', amount: incomeB,
        description: `${sale.ottupalKg} kg loose rubber @ ₹${sale.ottupalRate}/kg`,
      })
      showToast(`Sale recorded — ₹${(incomeA + incomeB).toLocaleString('en-IN')} ✓`)
      setSale({ sheets: '', weightKg: '', ratePerKg: DEFAULT_SHEET_RATE, ottupalKg: '', ottupalRate: DEFAULT_OTTUPAL_RATE })
      setSaleOpen(false); load()
    } catch (e) { showToast('Failed: ' + e.message, 'error') }
    setBusy(false)
  }

  const inp = { width: '100%', padding: '9px 6px', textAlign: 'center', borderRadius: 8, border: '1px solid var(--border-dim)', background: 'var(--dark-input)', color: '#EDF2F7', fontSize: '0.85rem' }
  const dayPill = (label, n, color, labelBright) => (
    <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33` }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color }}>{n}</div>
      <div style={labelBright
        ? { fontSize: '0.78rem', fontWeight: 700, color, letterSpacing: '0.3px', marginTop: '2px' }
        : { fontSize: '0.58rem', color: '#5C7080', letterSpacing: '0.6px', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
  // 0.5 kg per sheet — display weight, switching to tonnes above 1000 kg
  const sheetWeightLabel = (sheets) => {
    const kg = Math.round((sheets || 0) * 0.5 * 100) / 100
    return kg >= 1000 ? `${(kg / 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} t` : `${kg.toLocaleString('en-IN')} kg`
  }
  const d = data
  return (
    <>
      <div className="card-section-label" style={{ marginTop: 20 }}>MONTHLY REGISTER &amp; P&amp;L</div>
      <div className="card">
        <input className="field-input gold" type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ marginBottom: 12 }} />
        {!d ? <div style={{ color: '#5C7080', fontSize: '0.8rem', textAlign: 'center', padding: 12 }}>Loading…</div> : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {dayPill('Tapping days', d.days.tapping, '#5FD0AE')}
              {dayPill('Maintenance', d.days.maintenance, '#C8903A')}
              {dayPill('Rain — no tap', d.days.rain, '#5B8DBE')}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {dayPill(sheetWeightLabel(d.production.sheets), d.production.sheets, '#34A853', true)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9AA5B4', marginBottom: 12 }}>
              {d.production.trees.toLocaleString('en-IN')} trees · {d.production.sheets.toLocaleString('en-IN')} sheets · {d.production.ottupal.toLocaleString('en-IN')} ottupal · tapper wages ₹{d.production.wages.toLocaleString('en-IN')}
            </div>
            <div className="net-row"><span className="net-label">Income</span><span className="net-val pos">₹{d.pnl.totalIncome.toLocaleString('en-IN')}</span></div>
            {d.pnl.income.map(t => (
              <div key={'i' + t.category} className="net-row" style={{ paddingLeft: 14 }}>
                <span className="net-label" style={{ fontSize: '0.72rem' }}>{t.category}</span>
                <span className="net-val" style={{ fontSize: '0.78rem' }}>₹{t.total.toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="net-row" onClick={() => d.pnl.expense.length > 0 && setExpOpen(o => !o)} style={{ cursor: d.pnl.expense.length > 0 ? 'pointer' : 'default' }}>
              <span className="net-label">Expenses {d.pnl.expense.length > 0 && <span style={{ fontSize: '0.65rem', color: '#5C7080' }}>{expOpen ? '∧' : '›'}</span>}</span>
              <span className="net-val" style={{ color: '#E06C5A' }}>−₹{d.pnl.totalExpense.toLocaleString('en-IN')}</span>
            </div>
            {expOpen && d.pnl.expense.map(t => (
              <div key={'e' + t.category} className="net-row" style={{ paddingLeft: 14 }}>
                <span className="net-label" style={{ fontSize: '0.72rem' }}>{t.category}</span>
                <span className="net-val" style={{ fontSize: '0.78rem', color: '#E06C5A' }}>−₹{t.total.toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="net-row" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6, paddingTop: 8 }}>
              <span className="net-label" style={{ fontWeight: 600 }}>Month net</span>
              <span className="net-val big" style={{ color: d.pnl.net >= 0 ? '#5FD0AE' : '#E06C5A' }}>₹{d.pnl.net.toLocaleString('en-IN')}</span>
            </div>
          </>
        )}

        {!saleOpen ? (
          <button className="btn" style={{ marginTop: 12, background: 'rgba(15,110,86,0.15)', color: '#5FD0AE', border: '1px solid rgba(15,110,86,0.4)' }} onClick={() => setSaleOpen(true)}>
            + Record rubber sale (sheets / ottupal)
          </button>
        ) : (
          <div style={{ marginTop: 12, padding: '12px', borderRadius: 10, border: '1px solid rgba(15,110,86,0.35)', background: 'rgba(15,110,86,0.06)' }}>
            <div style={{ fontSize: '0.62rem', color: '#5C7080', letterSpacing: '0.6px', marginBottom: 6 }}>INCOME A — SHEETS (600 g/sheet auto)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 4 }}>
              <input style={inp} type="number" inputMode="numeric" placeholder="Sheets" value={sale.sheets} onChange={e => setS('sheets', e.target.value)} />
              <input style={inp} type="number" inputMode="decimal" placeholder="Weight kg" value={sale.weightKg} onChange={e => setS('weightKg', e.target.value)} />
              <input style={inp} type="number" inputMode="decimal" placeholder="₹/kg" value={sale.ratePerKg} onChange={e => setS('ratePerKg', e.target.value)} />
            </div>
            <div style={{ fontSize: '0.72rem', color: '#5FD0AE', textAlign: 'right', marginBottom: 10 }}>Income A: ₹{incomeA.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.62rem', color: '#5C7080', letterSpacing: '0.6px', marginBottom: 6 }}>INCOME B — OTTUPAL / LOOSE RUBBER</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 4 }}>
              <input style={inp} type="number" inputMode="decimal" placeholder="Kg" value={sale.ottupalKg} onChange={e => setS('ottupalKg', e.target.value)} />
              <input style={inp} type="number" inputMode="decimal" placeholder="₹/kg" value={sale.ottupalRate} onChange={e => setS('ottupalRate', e.target.value)} />
            </div>
            <div style={{ fontSize: '0.72rem', color: '#5FD0AE', textAlign: 'right', marginBottom: 10 }}>Income B: ₹{incomeB.toLocaleString('en-IN')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-teal" style={{ flex: 2 }} disabled={busy} onClick={saveSale}>{busy ? 'Saving…' : `Save sale — ₹${(incomeA + incomeB).toLocaleString('en-IN')}`}</button>
              <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => setSaleOpen(false)}>✕</button>
            </div>
          </div>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
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
