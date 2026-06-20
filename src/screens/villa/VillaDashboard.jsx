import { useState, useEffect, Component } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { parseLocalDate } from '../../utils/dates'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(e, info) { console.error('Dashboard crash:', e, info) }
  render() {
    if (this.state.error) return (
      <div style={{padding:'20px',color:'#e74c3c',background:'#1a1a2e',minHeight:'100vh'}}>
        <h3>Dashboard Error</h3>
        <pre style={{fontSize:'0.75rem',wordBreak:'break-all',whiteSpace:'pre-wrap'}}>
          {this.state.error?.message}
          {this.state.error?.stack}
        </pre>
      </div>
    )
    return this.props.children
  }
}

const MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL= ['January','February','March','April','May','June','July','August','September','October','November','December']
const CUR_MONTH  = new Date().getMonth()
const CUR_YEAR   = new Date().getFullYear()

// Guruvayur peak seasons — temple festivals & holidays
const PEAK_SEASONS = [
  { months:[0],      label:'Guruvayur Ekadasi',     type:'peak',   icon:'🛕', desc:'Biggest festival. Book 3 months ahead.' },
  { months:[1],      label:'Shivaratri',             type:'peak',   icon:'🛕', desc:'Heavy temple crowd. Premium pricing.' },
  { months:[2,3],    label:'Vishu / Tamil New Year', type:'peak',   icon:'🎊', desc:'Family travel season. High demand.' },
  { months:[4],      label:'Summer holidays',        type:'high',   icon:'☀️', desc:'School holiday travel. Good occupancy.' },
  { months:[5,6],    label:'Monsoon / Low season',   type:'low',    icon:'🌧️', desc:'Low demand. Good for maintenance.' },
  { months:[7],      label:'Onam season',            type:'peak',   icon:'🌸', desc:'Kerala\'s biggest festival. Premium rates.' },
  { months:[8,9],    label:'Post-Onam / Navratri',   type:'high',   icon:'🎭', desc:'Steady demand. Temple visits peak.' },
  { months:[10],     label:'Diwali season',          type:'high',   icon:'🪔', desc:'Festival travel. Good for direct bookings.' },
  { months:[11],     label:'Christmas / New Year',   type:'peak',   icon:'🎄', desc:'Highest rates of year. Book 4 months ahead.' },
]

const SEASON_COLORS = { peak:'#C8903A', high:'#34A853', low:'#5C7080' }
const SEASON_BG     = { peak:'rgba(200,144,58,0.12)', high:'rgba(52,168,83,0.1)', low:'rgba(92,112,128,0.1)' }

const STATUS_COLORS = {
  booked:      '#185FA5',
  confirmed:   '#C8903A',
  registered:  '#8B5CF6',
  active:      '#34A853',
  checked_out: '#5C7080',
  cancelled:   '#E53935',
}

const YEARS = [CUR_YEAR, CUR_YEAR-1, CUR_YEAR-2, CUR_YEAR-3, CUR_YEAR-4, CUR_YEAR-5]

function fmt(n) {
  if (!n && n !== 0) return '—'
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`
  if (n >= 1000)   return `₹${(n/1000).toFixed(1)}K`
  return `₹${n.toLocaleString('en-IN')}`
}

function fmtDate(d) {
  if (!d) return '—'
  const date = parseLocalDate(d)
  if (!date || isNaN(date)) return String(d)
  return date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}

function calcNights(ci, co) {
  if (!ci || !co) return 0
  return Math.max(0, Math.round((parseLocalDate(co) - parseLocalDate(ci)) / (1000*60*60*24)))
}

function Bar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={S.barRow}>
      <div style={S.barLabel}>{label}</div>
      <div style={S.barTrack}><div style={{ ...S.barFill, width:`${pct}%`, background:color }}/></div>
      <div style={S.barVal}>{fmt(value)}</div>
    </div>
  )
}

function Skeleton({ h=80 }) {
  return <div style={{ ...S.skeleton, height:h }}/>
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#5C7080'
  return (
    <span style={{ padding:'2px 8px', borderRadius:'12px', fontSize:'0.7rem', fontWeight:'600',
      background:`${color}22`, color, border:`1px solid ${color}44`, whiteSpace:'nowrap' }}>
      {status?.replace('_',' ') || 'unknown'}
    </span>
  )
}

// ── TAB: GUESTS ─────────────────────────────────────────────────────────────

function GuestsTab({ stays, loading, year, onYearChange }) {
  const [filter, setFilter] = useState('all')
  const [selMonth, setSelMonth] = useState('all')

  const today = new Date()
  today.setHours(0,0,0,0)

  const parsed = (stays || []).map(s => ({
    ...s,
    checkInDate:  parseLocalDate(s.checkIn  || s.checkInDate  || '') || new Date(NaN),
    checkOutDate: parseLocalDate(s.checkOut || s.checkOutDate || '') || new Date(NaN),
  }))

  // Year-filtered for summary stats
  const parsedYear = parsed.filter(s => !isNaN(s.checkInDate) && s.checkInDate.getFullYear() === year)

  const upcoming   = parsed.filter(s => s.checkInDate > today && s.status !== 'cancelled').sort((a,b) => a.checkInDate - b.checkInDate)
  const active     = parsed.filter(s => s.status === 'active')
  const unclosed   = parsed.filter(s => !['closed','checked_out','cancelled'].includes(s.status) && s.checkOutDate < today && !isNaN(s.checkOutDate))
  const byMonth    = parsed.filter(s => {
    if (selMonth === 'all') return s.checkInDate.getFullYear() === year
    return s.checkInDate.getMonth() === selMonth && s.checkInDate.getFullYear() === year
  })

  return (
    <div>
      {/* Year selector */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {YEARS.map(y => (
          <button key={y} onClick={() => onYearChange(y)}
            style={{ padding:'6px 14px', borderRadius:'20px', border:`1px solid ${year===y?'var(--gold)':'rgba(255,255,255,0.08)'}`,
              background: year===y ? 'rgba(200,144,58,0.15)' : 'transparent',
              color: year===y ? 'var(--gold)' : 'var(--text-dim)', fontSize:'0.8rem', cursor:'pointer' }}>
            {y}
          </button>
        ))}
      </div>

      {/* Alert: unclosed stays */}
      {unclosed.length > 0 && (
        <>
          <div className="card-section-label" style={{ color:'var(--red)' }}>⚠️ NEEDS ATTENTION — UNCLOSED STAYS</div>
          <div style={{ background:'rgba(229,57,53,0.08)', border:'1px solid rgba(229,57,53,0.25)', borderRadius:'12px', marginBottom:'12px', overflow:'hidden' }}>
            {unclosed.map((s, i) => (
              <div key={i} style={{ padding:'12px 16px', borderBottom: i<unclosed.length-1?'1px solid rgba(229,57,53,0.15)':'none' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                  <span style={{ color:'var(--text)', fontWeight:'600', fontSize:'0.9rem' }}>{s.guestName || s.bookerName}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div style={{ color:'var(--text-dim)', fontSize:'0.78rem' }}>
                  {s.stayId} · Checked out {fmtDate(s.checkOut || s.checkOutDate)} · {calcNights(s.checkIn, s.checkOut)} nights
                </div>
                <div style={{ color:'#E53935', fontSize:'0.75rem', marginTop:'4px' }}>
                  ← Check out not recorded. Update status to close this stay.
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Active stays */}
      {active.length > 0 && (
        <>
          <div className="card-section-label" style={{ color:'var(--green)' }}>🏠 CURRENTLY STAYING</div>
          <div style={{ background:'rgba(52,168,83,0.06)', border:'1px solid rgba(52,168,83,0.2)', borderRadius:'12px', marginBottom:'12px', overflow:'hidden' }}>
            {active.map((s, i) => (
              <div key={i} style={{ padding:'12px 16px', borderBottom: i<active.length-1?'1px solid rgba(52,168,83,0.12)':'none' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                  <span style={{ color:'var(--text)', fontWeight:'600', fontSize:'0.9rem' }}>{s.guestName || s.bookerName}</span>
                  <StatusBadge status="active" />
                </div>
                <div style={{ color:'var(--text-dim)', fontSize:'0.78rem' }}>
                  {s.stayId} · Checks out {fmtDate(s.checkOut || s.checkOutDate)} · {s.adults || 0} adults
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Upcoming — only show for current year */}
      {year >= CUR_YEAR && (
        <>
          <div className="card-section-label">📅 UPCOMING BOOKINGS</div>
          {loading ? <Skeleton h={100} /> : upcoming.length === 0 ? (
            <div className="card" style={{ textAlign:'center', color:'var(--text-dim)', padding:'24px' }}>
              No upcoming bookings for {year}
            </div>
          ) : (
            <div style={{ background:'var(--dark-card)', borderRadius:'12px', border:'1px solid var(--border-dim)', overflow:'hidden', marginBottom:'12px' }}>
              {upcoming.slice(0,10).map((s, i) => {
                const daysAway = Math.round((s.checkInDate - today) / (1000*60*60*24))
                return (
                  <div key={i} style={{ padding:'12px 16px', borderBottom: i<Math.min(upcoming.length,10)-1?'1px solid var(--border-dim)':'none' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                      <span style={{ color:'var(--text)', fontWeight:'600', fontSize:'0.9rem' }}>{s.guestName || s.bookerName}</span>
                      <StatusBadge status={s.status} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'var(--text-dim)', fontSize:'0.78rem' }}>
                        {fmtDate(s.checkIn || s.checkInDate)} · {calcNights(s.checkIn||s.checkInDate, s.checkOut||s.checkOutDate)} nights · {s.channel||'Direct'}
                      </span>
                      <span style={{ fontSize:'0.72rem', color: daysAway<=7?'#E53935':daysAway<=14?'#C8903A':'#5C7080', fontWeight:'600' }}>
                        {daysAway===0?'TODAY':daysAway===1?'Tomorrow':`${daysAway}d away`}
                      </span>
                    </div>
                    <div style={{ color:'var(--text-dim)', fontSize:'0.72rem', marginTop:'2px' }}>
                      {s.stayId} · {s.adults||0} adults{s.children>0?` · ${s.children} children`:''} · {s.channel||'Direct'}
                      {(s.bookedDate||s.bookeddate) ? ` · Booked: ${fmtDate(s.bookedDate||s.bookeddate)}` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* By month */}
      <div className="card-section-label">📋 BOOKINGS BY MONTH</div>
      <div className="month-strip" style={{ marginBottom:'12px', overflowX:'auto', flexWrap:'nowrap', WebkitOverflowScrolling:'touch' }}>
          <button className={`month-pill${selMonth==='all'?' active':''}`} onClick={() => setSelMonth('all')}>All</button>
          {MONTHS.map((m, i) => (
            <button key={m} className={`month-pill${selMonth===i?' active':''}`} onClick={() => setSelMonth(i)}>{m}</button>
          ))}
        </div>
      {loading ? <Skeleton h={120} /> : byMonth.length === 0 ? (
          <div className="card" style={{textAlign:'center',color:'var(--text-dim)',padding:'20px'}}>
            No bookings in {selMonth==='all' ? String(year) : `${MONTHS_FULL[selMonth]} ${year}`}
          </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:'8px', marginBottom:'8px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'0.75rem', color:'var(--text-dim)' }}>
              {byMonth.length} booking{byMonth.length>1?'s':''} · {byMonth.reduce((s,b)=>s+calcNights(b.checkIn||b.checkInDate,b.checkOut||b.checkOutDate),0)} total nights
              {selMonth === 'all' ? ` · Full year ${year}` : ` · ${MONTHS_FULL[selMonth]} ${year}`}
            </span>
          </div>
          <div style={{ background:'var(--dark-card)', borderRadius:'12px', border:'1px solid var(--border-dim)', overflow:'hidden', marginBottom:'12px' }}>
            {byMonth.map((s, i) => {
              const bd = s.bookedDate || s.bookeddate || ''
              const leadDays = bd && (s.checkIn||s.checkInDate)
                ? Math.round((parseLocalDate(s.checkIn||s.checkInDate) - parseLocalDate(bd)) / (1000*60*60*24))
                : null
              return (
              <div key={i} style={{ padding:'12px 16px', borderBottom: i<byMonth.length-1?'1px solid var(--border-dim)':'none' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'3px' }}>
                  <span style={{ color:'var(--text)', fontWeight:'600', fontSize:'0.88rem' }}>{s.guestName || s.bookerName}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>
                  {fmtDate(s.checkIn||s.checkInDate)} → {fmtDate(s.checkOut||s.checkOutDate)} · {s.channel||'Direct'} · {s.adults||0} adults
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'3px', flexWrap:'wrap', gap:'4px' }}>
                  <span style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>{s.stayId}</span>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    {bd && (
                      <span style={{ fontSize:'0.72rem', color:'var(--text-dim)' }}>
                        📅 Booked {fmtDate(bd)}
                        {leadDays !== null && leadDays >= 0 && (
                          <span style={{ marginLeft:'4px', color: leadDays < 7 ? '#E53935' : leadDays < 30 ? '#C8903A' : 'var(--green)', fontWeight:'600' }}>
                            ({leadDays}d ahead)
                          </span>
                        )}
                      </span>
                    )}
                    {s.net ? <span style={{ color:'var(--green)', fontSize:'0.78rem', fontWeight:'600' }}>{fmt(s.net)}</span> : null}
                  </div>
                </div>
              </div>
              )
            })}
          </div>
        </>
      )}

      {/* All stays summary */}
      <div className="card-section-label">YEAR SUMMARY — {year}</div>
      <div className="card">
        {loading ? <Skeleton h={80}/> : (
          <>
            {[
              { label:'Total bookings',    val: parsedYear.length },
              { label:'Checked out',       val: parsedYear.filter(s=>s.status==='checked_out').length },
              { label:'Active now',        val: parsedYear.filter(s=>s.status==='active').length },
              { label:'Upcoming',          val: parsedYear.filter(s=>s.checkInDate > today && s.status !== 'cancelled').length },
              { label:'Cancelled',         val: parsedYear.filter(s=>s.status==='cancelled').length },
              { label:'Unclosed (action)', val: parsedYear.filter(s=>!['closed','checked_out','cancelled'].includes(s.status) && s.checkOutDate < today && !isNaN(s.checkOutDate)).length, alert: true },
            ].map((row, i) => (
              <div key={i} className="net-row">
                <span className="net-label">{row.label}</span>
                <span style={{ color: row.alert && row.val > 0 ? 'var(--red)' : 'var(--text)', fontWeight:'600' }}>{row.val}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── BOOKING LEAD TIME CHART ──────────────────────────────────────────────────

function BookingLeadTimeChart({ allStays }) {
  const [view, setView] = useState('heatmap') // 'heatmap' | 'bars'

  // Calculate lead times from all stays that have bookedDate
  const monthlyLead = Array.from({length:12}, () => [])

  ;(allStays || []).forEach(s => {
    // Use created_at as booking date proxy (D1 has no separate booked_date)
    const bd = s.bookedDate || s.bookeddate || s.created_at || s.createdAt || ''
    const ci = s.checkIn || s.checkInDate || s.checkin_date || ''
    if (!bd || !ci) return
    try {
      const d1 = parseLocalDate(bd), d2 = parseLocalDate(ci)
      if (!d1 || !d2) return
      const lead = Math.round((d2 - d1) / (1000*60*60*24))
      if (lead >= 0 && lead <= 365) {
        monthlyLead[d2.getMonth()].push(lead)
      }
    } catch {}
  })

  const stats = monthlyLead.map(leads => {
    if (!leads.length) return null
    const sorted = [...leads].sort((a,b)=>a-b)
    const avg  = Math.round(leads.reduce((s,v)=>s+v,0)/leads.length)
    const med  = sorted[Math.floor(sorted.length/2)]
    const u7   = leads.filter(l=>l<7).length
    const u30  = leads.filter(l=>l>=7&&l<30).length
    const u90  = leads.filter(l=>l>=30&&l<90).length
    const o90  = leads.filter(l=>l>=90).length
    const n    = leads.length
    return { avg, med, n,
      u7pct: Math.round(u7/n*100), u30pct: Math.round(u30/n*100),
      u90pct: Math.round(u90/n*100), o90pct: Math.round(o90/n*100) }
  })

  const maxAvg = Math.max(...stats.filter(Boolean).map(s=>s.avg), 1)
  const mostImpulsive = stats.reduce((best, s, i) => s && s.u7pct > (stats[best]?.u7pct||0) ? i : best, 0)
  const mostPlanned   = stats.reduce((best, s, i) => s && s.avg > (stats[best]?.avg||0) ? i : best, 0)

  const SEGMENTS = [
    { key:'u7pct',   label:'< 7 days',   color:'#E53935', desc:'Impulsive' },
    { key:'u30pct',  label:'7–30 days',  color:'#C8903A', desc:'Short notice' },
    { key:'u90pct',  label:'30–90 days', color:'#185FA5', desc:'Planned' },
    { key:'o90pct',  label:'90+ days',   color:'#34A853', desc:'Far ahead' },
  ]

  return (
    <>
      <div className="card-section-label">⏱ BOOKING LEAD TIME BY MONTH</div>

      {/* Summary badges */}
      <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap'}}>
        <div style={{background:'rgba(229,57,53,0.1)',border:'1px solid rgba(229,57,53,0.3)',
          borderRadius:'10px',padding:'8px 12px',flex:1,minWidth:'120px'}}>
          <div style={{fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px'}}>MOST IMPULSIVE</div>
          <div style={{color:'#E53935',fontWeight:'700',fontSize:'0.95rem'}}>{MONTHS[mostImpulsive]}</div>
          <div style={{fontSize:'0.72rem',color:'var(--text-dim)'}}>{stats[mostImpulsive]?.u7pct}% booked &lt;7 days out</div>
        </div>
        <div style={{background:'rgba(52,168,83,0.08)',border:'1px solid rgba(52,168,83,0.25)',
          borderRadius:'10px',padding:'8px 12px',flex:1,minWidth:'120px'}}>
          <div style={{fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px'}}>MOST PLANNED</div>
          <div style={{color:'var(--green)',fontWeight:'700',fontSize:'0.95rem'}}>{MONTHS[mostPlanned]}</div>
          <div style={{fontSize:'0.72rem',color:'var(--text-dim)'}}>avg {stats[mostPlanned]?.avg} days ahead</div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{display:'flex',gap:'6px',marginBottom:'10px'}}>
        {[{k:'heatmap',l:'Stacked %'},{k:'bars',l:'Avg days'}].map(v=>(
          <button key={v.k} onClick={()=>setView(v.k)}
            style={{padding:'5px 12px',borderRadius:'20px',border:`1px solid ${view===v.k?'var(--gold)':'rgba(255,255,255,0.08)'}`,
              background:view===v.k?'rgba(200,144,58,0.15)':'transparent',
              color:view===v.k?'var(--gold)':'var(--text-dim)',fontSize:'0.75rem',cursor:'pointer'}}>
            {v.l}
          </button>
        ))}
      </div>

      <div className="card" style={{padding:'12px'}}>
        {view === 'heatmap' ? (
          <>
            {/* Stacked bar chart — % of each bucket per month */}
            {MONTHS.map((m, mi) => {
              const s = stats[mi]
              if (!s) return (
                <div key={m} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                  <div style={{width:'28px',fontSize:'0.72rem',color:'var(--text-dim)',flexShrink:0}}>{m}</div>
                  <div style={{flex:1,height:'18px',background:'rgba(255,255,255,0.03)',borderRadius:'4px'}}/>
                  <div style={{width:'40px',fontSize:'0.68rem',color:'var(--text-dim)',textAlign:'right'}}>—</div>
                </div>
              )
              const isImp = mi === mostImpulsive
              const isPln = mi === mostPlanned
              return (
                <div key={m} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                  <div style={{width:'28px',fontSize:'0.72rem',
                    color:isImp?'#E53935':isPln?'var(--green)':'var(--text-dim)',
                    fontWeight:isImp||isPln?'700':'400',flexShrink:0}}>
                    {m}
                  </div>
                  {/* Stacked bar */}
                  <div style={{flex:1,height:'18px',borderRadius:'4px',overflow:'hidden',display:'flex'}}>
                    {SEGMENTS.map(seg => (
                      <div key={seg.key} title={`${seg.label}: ${s[seg.key]}%`}
                        style={{width:`${s[seg.key]}%`,background:seg.color,
                          transition:'width 0.4s ease',height:'100%'}}/>
                    ))}
                  </div>
                  <div style={{width:'40px',fontSize:'0.68rem',color:'var(--text-dim)',textAlign:'right'}}>
                    {s.n} bkgs
                  </div>
                </div>
              )
            })}
            {/* Legend */}
            <div style={{display:'flex',gap:'10px',marginTop:'10px',flexWrap:'wrap'}}>
              {SEGMENTS.map(seg=>(
                <div key={seg.key} style={{display:'flex',alignItems:'center',gap:'4px'}}>
                  <div style={{width:'10px',height:'10px',borderRadius:'2px',background:seg.color}}/>
                  <span style={{fontSize:'0.68rem',color:'var(--text-dim)'}}>{seg.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Average lead time bar chart */}
            {MONTHS.map((m, mi) => {
              const s = stats[mi]
              const pct = s ? (s.avg / maxAvg) * 100 : 0
              const isImp = mi === mostImpulsive
              const isPln = mi === mostPlanned
              return (
                <div key={m} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                  <div style={{width:'28px',fontSize:'0.72rem',
                    color:isImp?'#E53935':isPln?'var(--green)':'var(--text-dim)',
                    fontWeight:isImp||isPln?'700':'400',flexShrink:0}}>{m}</div>
                  <div style={{flex:1,height:'18px',background:'rgba(255,255,255,0.04)',borderRadius:'4px',overflow:'hidden'}}>
                    <div style={{width:`${pct}%`,height:'100%',borderRadius:'4px',
                      background:isImp?'#E53935':isPln?'var(--green)':'#185FA5',
                      transition:'width 0.4s ease'}}/>
                  </div>
                  <div style={{width:'60px',fontSize:'0.72rem',color:'var(--text)',textAlign:'right'}}>
                    {s ? `${s.avg}d avg` : '—'}
                  </div>
                </div>
              )
            })}
            <div style={{marginTop:'10px',fontSize:'0.72rem',color:'var(--text-dim)',lineHeight:'1.6'}}>
              <span style={{color:'#E53935',fontWeight:'600'}}>Red</span> = most impulsive · {' '}
              <span style={{color:'var(--green)',fontWeight:'600'}}>Green</span> = most planned ahead
            </div>
          </>
        )}
      </div>

      {stats.some(Boolean) && (
        <div style={{background:'rgba(200,144,58,0.06)',border:'1px solid rgba(200,144,58,0.2)',
          borderRadius:'10px',padding:'12px 14px',marginBottom:'12px'}}>
          <div style={{color:'var(--gold)',fontSize:'0.75rem',fontWeight:'700',marginBottom:'6px'}}>
            🎯 MARKETING IMPLICATION (from your booking data)
          </div>
          <div style={{color:'var(--text-dim)',fontSize:'0.78rem',lineHeight:'1.7'}}>
            {stats[mostImpulsive] && <>
              <strong style={{color:'var(--text)'}}>{MONTHS[mostImpulsive]}</strong> has the most last-minute bookings ({stats[mostImpulsive].u7pct}% booked &lt;7 days out) — run WhatsApp flash offers this month.{' '}
            </>}
            {stats[mostPlanned] && <>
              <strong style={{color:'var(--text)'}}>{MONTHS[mostPlanned]}</strong> guests plan {stats[mostPlanned].avg} days ahead on average — send early-bird packages 2–3 months before.
            </>}
          </div>
        </div>
      )}
    </>
  )
}

// ── EARNINGS COMPARISON CHART ────────────────────────────────────────────────

function EarningsComparisonChart({ allStays, selectedYears }) {
  const [compareYears, setCompareYears] = useState(selectedYears.slice(0, 2))

  const COLORS = ['#C8903A', '#8B5CF6', '#34A853', '#185FA5', '#E53935']

  // Build month × year revenue from all stays
  const byYearMonth = {}
  ;(allStays || []).forEach(s => {
    const ci = parseLocalDate(s.checkIn || s.checkInDate || '')
    if (!ci || isNaN(ci)) return
    const y = ci.getFullYear()
    const m = ci.getMonth()
    const rev = parseFloat(s.gross || 0)
    if (!byYearMonth[y]) byYearMonth[y] = Array(12).fill(0)
    byYearMonth[y][m] += rev
  })

  const availableYears = Object.keys(byYearMonth).map(Number).sort((a,b) => b-a)
  const maxVal = Math.max(...compareYears.flatMap(y => byYearMonth[y] || []), 1)

  const toggleYear = (y) => {
    setCompareYears(prev =>
      prev.includes(y) ? prev.filter(p => p !== y) : prev.length < 3 ? [...prev, y] : prev
    )
  }

  return (
    <>
      <div className="card-section-label">📈 EARNINGS COMPARISON</div>
      {/* Year selector */}
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'12px' }}>
        {availableYears.map((y, yi) => (
          <button key={y} onClick={() => toggleYear(y)}
            style={{ padding:'5px 12px', borderRadius:'20px', cursor:'pointer',
              border: `1px solid ${compareYears.includes(y) ? COLORS[compareYears.indexOf(y)] : 'rgba(255,255,255,0.08)'}`,
              background: compareYears.includes(y) ? `${COLORS[compareYears.indexOf(y)]}22` : 'transparent',
              color: compareYears.includes(y) ? COLORS[compareYears.indexOf(y)] : 'var(--text-dim)',
              fontSize:'0.78rem', fontWeight: compareYears.includes(y)?'700':'400' }}>
            {y}
          </button>
        ))}
        <span style={{ fontSize:'0.7rem', color:'var(--text-dim)', alignSelf:'center' }}>Pick up to 3</span>
      </div>

      {/* Chart */}
      <div className="card" style={{ padding:'12px' }}>
        {/* Y-axis labels + bars */}
        <div style={{ display:'flex', gap:'4px', alignItems:'flex-end', height:'160px', marginBottom:'6px' }}>
          {MONTHS.map((m, mi) => (
            <div key={m} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', height:'100%', justifyContent:'flex-end' }}>
              {compareYears.map((y, yi) => {
                const rev = (byYearMonth[y] || [])[mi] || 0
                const pct = maxVal > 0 ? (rev / maxVal) * 100 : 0
                return (
                  <div key={y} title={`${m} ${y}: ${rev > 0 ? '₹'+Math.round(rev).toLocaleString('en-IN') : 'No data'}`}
                    style={{ width:'100%', height:`${Math.max(pct, rev > 0 ? 2 : 0)}%`,
                      background: COLORS[yi], borderRadius:'3px 3px 0 0', minHeight: rev > 0 ? '3px' : '0',
                      transition:'height 0.4s ease', cursor:'pointer' }}/>
                )
              })}
            </div>
          ))}
        </div>
        {/* X-axis */}
        <div style={{ display:'flex', gap:'4px' }}>
          {MONTHS.map(m => (
            <div key={m} style={{ flex:1, textAlign:'center', fontSize:'0.58rem', color:'var(--text-dim)' }}>{m}</div>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display:'flex', gap:'12px', marginTop:'10px', flexWrap:'wrap' }}>
          {compareYears.map((y, yi) => {
            const total = ((byYearMonth[y] || [])).reduce((s,v)=>s+v,0)
            return (
              <div key={y} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <div style={{ width:'12px', height:'12px', borderRadius:'3px', background:COLORS[yi] }}/>
                <span style={{ fontSize:'0.75rem', color:COLORS[yi], fontWeight:'600' }}>
                  {y} — {total > 0 ? `₹${(total/1000).toFixed(0)}K` : 'No data'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── MONTHLY TREND CHART (10 years) ───────────────────────────────────────────

function MonthlyTrendChart({ stays, currentYear }) {
  const allYears = Array.from({ length: 10 }, (_, i) => currentYear - i).reverse()

  // Build month × year revenue matrix from all stays
  const matrix = {}
  MONTHS.forEach(m => { matrix[m] = {} })

  ;(stays || []).forEach(s => {
    const ci = parseLocalDate(s.checkIn || s.checkInDate || '')
    if (!ci || isNaN(ci)) return
    const m   = MONTHS[ci.getMonth()]
    const y   = ci.getFullYear()
    const rev = parseFloat(s.gross || 0)
    if (!matrix[m][y]) matrix[m][y] = { revenue: 0, bookings: 0 }
    matrix[m][y].revenue  += rev
    matrix[m][y].bookings += 1
  })

  // Find best and worst months across all years
  const monthTotals = MONTHS.map(m => ({
    month: m,
    total: Object.values(matrix[m]).reduce((s, v) => s + (v.revenue||0), 0),
    avg:   Object.keys(matrix[m]).length > 0
      ? Object.values(matrix[m]).reduce((s,v) => s+(v.revenue||0), 0) / Object.keys(matrix[m]).length
      : 0,
  }))

  const maxAvg   = Math.max(...monthTotals.map(m => m.avg), 1)
  const bestMonth  = [...monthTotals].sort((a,b) => b.avg - a.avg)[0]
  const worstMonth = [...monthTotals].filter(m => m.avg > 0).sort((a,b) => a.avg - b.avg)[0]

  // Max revenue across entire matrix for colour scaling
  const allRevValues = MONTHS.flatMap(m => Object.values(matrix[m]).map(v => v.revenue||0))
  const maxRev = Math.max(...allRevValues, 1)

  const getColor = (rev) => {
    if (!rev) return 'rgba(255,255,255,0.04)'
    const pct = rev / maxRev
    if (pct > 0.75) return 'rgba(200,144,58,0.85)'
    if (pct > 0.50) return 'rgba(200,144,58,0.55)'
    if (pct > 0.25) return 'rgba(200,144,58,0.30)'
    return 'rgba(200,144,58,0.12)'
  }

  return (
    <>
      <div className="card-section-label">📊 MONTHLY TREND — LAST 10 YEARS</div>
      <div style={{ background:'rgba(52,168,83,0.06)', border:'1px solid rgba(52,168,83,0.2)', borderRadius:'10px', padding:'10px 12px', marginBottom:'12px', display:'flex', gap:'16px', flexWrap:'wrap' }}>
        <div>
          <div style={{ color:'var(--text-dim)', fontSize:'0.68rem', letterSpacing:'1px' }}>BEST MONTH</div>
          <div style={{ color:'var(--gold)', fontWeight:'700', fontSize:'0.9rem' }}>{bestMonth?.month} <span style={{ color:'var(--text-dim)', fontWeight:'400', fontSize:'0.75rem' }}>avg {fmt(Math.round(bestMonth?.avg||0))}/yr</span></div>
        </div>
        {worstMonth && (
          <div>
            <div style={{ color:'var(--text-dim)', fontSize:'0.68rem', letterSpacing:'1px' }}>LOWEST MONTH</div>
            <div style={{ color:'#5C7080', fontWeight:'700', fontSize:'0.9rem' }}>{worstMonth?.month} <span style={{ color:'var(--text-dim)', fontWeight:'400', fontSize:'0.75rem' }}>avg {fmt(Math.round(worstMonth?.avg||0))}/yr</span></div>
          </div>
        )}
      </div>

      {/* Heatmap grid */}
      <div className="card" style={{ padding:'10px', overflowX:'auto' }}>
        <div style={{ minWidth:'340px' }}>
          {/* Year headers */}
          <div style={{ display:'grid', gridTemplateColumns:`50px repeat(${allYears.length}, 1fr)`, gap:'3px', marginBottom:'3px' }}>
            <div/>
            {allYears.map(y => (
              <div key={y} style={{ fontSize:'0.6rem', color: y===currentYear?'var(--gold)':'var(--text-dim)', textAlign:'center', fontWeight: y===currentYear?'700':'400' }}>
                {String(y).slice(2)}
              </div>
            ))}
          </div>
          {/* Month rows */}
          {MONTHS.map((m, mi) => {
            const isB = m === bestMonth?.month
            const isW = m === worstMonth?.month
            return (
              <div key={m} style={{ display:'grid', gridTemplateColumns:`50px repeat(${allYears.length}, 1fr)`, gap:'3px', marginBottom:'3px' }}>
                <div style={{ fontSize:'0.72rem', color: isB?'var(--gold)':isW?'#5C7080':'var(--text-dim)',
                  fontWeight: isB||isW?'700':'400', display:'flex', alignItems:'center' }}>
                  {m}{isB?' 🏆':isW?' 📉':''}
                </div>
                {allYears.map(y => {
                  const cell = matrix[m][y]
                  const rev  = cell?.revenue || 0
                  return (
                    <div key={y} title={rev > 0 ? `${m} ${y}: ${fmt(Math.round(rev))} · ${cell?.bookings} booking(s)` : `${m} ${y}: No data`}
                      style={{ height:'22px', borderRadius:'4px', background: getColor(rev),
                        border: y===currentYear ? '1px solid rgba(200,144,58,0.3)' : 'none',
                        cursor: rev > 0 ? 'pointer' : 'default' }}/>
                  )
                })}
              </div>
            )
          })}
          {/* Legend */}
          <div style={{ display:'flex', gap:'8px', marginTop:'10px', alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:'0.68rem', color:'var(--text-dim)' }}>Revenue:</span>
            {[
              { label:'No data', color:'rgba(255,255,255,0.04)' },
              { label:'Low',     color:'rgba(200,144,58,0.12)' },
              { label:'Mid',     color:'rgba(200,144,58,0.30)' },
              { label:'High',    color:'rgba(200,144,58,0.55)' },
              { label:'Peak',    color:'rgba(200,144,58,0.85)' },
            ].map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                <div style={{ width:'14px', height:'14px', borderRadius:'3px', background:l.color }}/>
                <span style={{ fontSize:'0.65rem', color:'var(--text-dim)' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Month avg bar chart */}
      <div className="card-section-label">AVG MONTHLY REVENUE (ALL YEARS)</div>
      <div className="card">
        {monthTotals.map((m, i) => (
          <div key={i} style={S.barRow}>
            <div style={{ ...S.barLabel, color: m.month===bestMonth?.month?'var(--gold)':m.month===worstMonth?.month?'#5C7080':'var(--text-dim)',
              fontWeight: m.month===bestMonth?.month||m.month===worstMonth?.month?'700':'400' }}>
              {m.month}
            </div>
            <div style={S.barTrack}>
              <div style={{ ...S.barFill, width:`${(m.avg/maxAvg)*100}%`,
                background: m.month===bestMonth?.month?'#C8903A':m.month===worstMonth?.month?'#5C7080':'#185FA5' }}/>
            </div>
            <div style={{ ...S.barVal, color: m.month===bestMonth?.month?'var(--gold)':'var(--text)' }}>
              {m.avg > 0 ? fmt(Math.round(m.avg)) : '—'}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── TAB: FINANCIALS ──────────────────────────────────────────────────────────

function FinancialsTab({ data, loading, month, onMonthChange, year, onYearChange, stays }) {
  // When month==='fy', aggregate all months
  const monthData = month === 'fy'
    ? Object.values(data?.months || {}).reduce((acc, m) => ({
        revenue:   (acc.revenue||0)   + (m.revenue||0),
        fees:      (acc.fees||0)      + (m.fees||0),
        bookings:  (acc.bookings||0)  + (m.bookings||0),
        direct:    (acc.direct||0)    + (m.direct||0),
        profit:    (acc.profit||0)    + (m.profit||0),
        breakdown: {
          tariff:    (acc.breakdown?.tariff||0)    + (m.breakdown?.tariff||0),
          carRental: (acc.breakdown?.carRental||0) + (m.breakdown?.carRental||0),
          kitchen:   (acc.breakdown?.kitchen||0)   + (m.breakdown?.kitchen||0),
          breakfast: (acc.breakdown?.breakfast||0) + (m.breakdown?.breakfast||0),
          events:    (acc.breakdown?.events||0)    + (m.breakdown?.events||0),
        }
      }), { revenue:0, fees:0, bookings:0, profit:0, breakdown:{} })
    : (data?.months?.[month] || {})

  const totalBookings = month === 'fy'
    ? Object.values(data?.months || {}).reduce((s,m) => s+(m.bookings||0), 0)
    : (monthData.bookings || 0)

  const totalDirect = month === 'fy'
    ? Object.values(data?.months || {}).reduce((s,m) => s+(m.direct||0), 0)
    : (monthData.direct || 0)

  const totalNights = month === 'fy'
    ? Object.values(data?.months || {}).reduce((s,m) => s+(m.nights||0), 0)
    : (monthData.nights || 0)

  const directRatio = totalBookings > 0 ? `${totalDirect} / ${totalBookings}` : '—'
  const gross4margin = monthData.revenue || monthData.gross || 0
  const net4margin   = monthData.net || monthData.profit || 0
  const margin = gross4margin > 0 ? Math.round((net4margin / gross4margin) * 100) : 0

  const breakdown = monthData.breakdown || {}
  const breakdownVals = Object.values(breakdown).map(v => parseFloat(v)||0).filter(v => !isNaN(v))
  const maxBreakdown = breakdownVals.length > 0 ? Math.max(...breakdownVals, 1) : 1

  return (
    <div>
      {/* Year + Month selectors */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'10px', flexWrap:'wrap' }}>
        {YEARS.map(y => (
          <button key={y} onClick={() => onYearChange(y)}
            style={{ padding:'5px 12px', borderRadius:'20px', border:`1px solid ${year===y?'var(--gold)':'rgba(255,255,255,0.08)'}`,
              background: year===y?'rgba(200,144,58,0.15)':'transparent',
              color: year===y?'var(--gold)':'var(--text-dim)', fontSize:'0.78rem', cursor:'pointer' }}>
            {y}
          </button>
        ))}
      </div>

      <div className="month-strip" style={{ overflowX:'auto', flexWrap:'nowrap', WebkitOverflowScrolling:'touch' }}>
        <button className={`month-pill${month==='fy'?' active':''}`} onClick={() => onMonthChange('fy')}>All</button>
        {MONTHS.map((m, i) => (
          <button key={m} className={`month-pill${month===i?' active':''}`} onClick={() => onMonthChange(i)}>{m}</button>
        ))}
      </div>

      <div className="card-section-label">{typeof month==='number'?MONTHS_FULL[month]:'Full Year'} {year}</div>
      {/* Notice for years with no revenue */}
      {!loading && (monthData.revenue||0) === 0 && totalBookings > 0 && (
        <div style={{ background:'rgba(92,112,128,0.08)', border:'1px solid rgba(92,112,128,0.2)', borderRadius:'10px', padding:'12px 14px', marginBottom:'12px' }}>
          <div style={{ color:'var(--text-dim)', fontSize:'0.82rem' }}>
            ℹ️ {totalBookings} bookings found but <strong style={{color:'var(--text)'}}>no tariff amounts recorded</strong> for this period.
            Historical bookings imported from Airbnb CSV may not have tariff data.
          </div>
        </div>
      )}
      {loading ? (
        <div className="stats-grid"><Skeleton/><Skeleton/><Skeleton/><Skeleton/></div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Gross revenue</div>
            <div className="stat-val gold">{fmt(monthData.revenue || monthData.gross)}</div>
            <div className="stat-sub">{totalBookings} bookings · {totalNights} nights</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Net to owner</div>
            <div className="stat-val green">{fmt(monthData.net || monthData.profit)}</div>
            <div className="stat-sub">{margin}% of gross</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Commissions</div>
            <div className="stat-val red">{fmt(monthData.fees)}</div>
            <div className="stat-sub">Paid to channels</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Direct ratio</div>
            <div className="stat-val green">{directRatio}</div>
            <div className="stat-sub">Direct / total bookings</div>
          </div>
        </div>
      )}

      <div className="card-section-label">REVENUE BREAKDOWN</div>
      <div className="card">
        {loading ? <Skeleton h={160}/> : (
          <>
            <Bar label="Room tariff"   value={breakdown.tariff}    max={maxBreakdown} color="#C8903A"/>
            <Bar label="Car rental"    value={breakdown.carRental}  max={maxBreakdown} color="#185FA5"/>
            <Bar label="Kitchen"       value={breakdown.kitchen}    max={maxBreakdown} color="#34A853"/>
            <Bar label="Breakfast"     value={breakdown.breakfast}  max={maxBreakdown} color="#8B5CF6"/>
            <Bar label="Events"        value={breakdown.events}     max={maxBreakdown} color="#0F6E56"/>
          </>
        )}
      </div>

      <div className="card-section-label">QUARTERLY NET PROFIT — {year}</div>
      {loading ? <Skeleton h={80}/> : (
        <div style={S.quarterRow}>
          {['Q1','Q2','Q3','Q4'].map(q => (
            <div key={q} style={S.quarterCard}>
              <div style={S.qLabel}>{q}</div>
              <div style={S.qVal}>{fmt(data?.quarterly?.[q])}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card-section-label">KEY INSIGHTS</div>
      <div className="card" style={{ background:'rgba(52,168,83,0.06)', border:'1px solid rgba(52,168,83,0.18)' }}>
        {loading ? <Skeleton h={100}/> : (
          <>
            <div className="net-row"><span className="net-label">Best month</span><span className="net-val">{data?.bestMonth||'—'}</span></div>
            <div className="net-row"><span className="net-label">Top channel</span><span className="net-val">{data?.topChannel||'—'}</span></div>
            <div className="net-row"><span className="net-label">Direct booking savings</span><span className="net-val pos">+{fmt(data?.directSaving)}</span></div>
            <div className="net-row"><span className="net-label">Avg nights / stay</span><span className="net-val">{data?.avgNights||'—'} nights</span></div>
          </>
        )}
      </div>

      <MonthlyTrendChart stays={stays} currentYear={year} />
      <EarningsComparisonChart allStays={stays} selectedYears={YEARS.slice(0,2)} />
      <BookingLeadTimeChart allStays={stays} />
    </div>
  )
}

// ── TAB: MARKETING ───────────────────────────────────────────────────────────

function MarketingTab({ data, stays, loading, year }) {
  const today      = new Date()
  const curMonth   = today.getMonth()
  const nextMonths = [0,1,2].map(i => (curMonth + i) % 12)

  // Occupancy: booked nights / 30 per month
  const occupancy = Array.from({length:12}, (_,m) => {
    const monthStays = (stays||[]).filter(s => {
      const ci = parseLocalDate(s.checkIn||s.checkInDate||'')
      return ci && !isNaN(ci) && ci.getMonth()===m && ci.getFullYear()===year
    })
    const nights = monthStays.reduce((sum,s) => {
      return sum + Math.min(30, Math.max(0, Math.round((parseLocalDate(s.checkOut||s.checkOutDate) - parseLocalDate(s.checkIn||s.checkInDate)) / (1000*60*60*24))))
    }, 0)
    return Math.min(100, Math.round((nights/30)*100))
  })

  const maxOcc = Math.max(...occupancy, 1)

  return (
    <div>
      {/* 3-month ahead planning */}
      <div className="card-section-label">🗓️ PLAN AHEAD — NEXT 3 MONTHS</div>
      {nextMonths.map(m => {
        const season = PEAK_SEASONS.find(p => p.months.includes(m))
        const occ    = occupancy[m]
        return (
          <div key={m} style={{ background:'var(--dark-card)', border:`1px solid ${season?SEASON_COLORS[season.type]+'44':'var(--border-dim)'}`,
            borderRadius:'12px', padding:'14px 16px', marginBottom:'8px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
              <div style={{ fontWeight:'700', fontSize:'0.95rem', color:'var(--text)' }}>
                {season?.icon} {MONTHS_FULL[m]}
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                {season && (
                  <span style={{ padding:'2px 8px', borderRadius:'12px', fontSize:'0.7rem', fontWeight:'700',
                    background: SEASON_BG[season.type], color: SEASON_COLORS[season.type] }}>
                    {season.type.toUpperCase()}
                  </span>
                )}
                <span style={{ fontSize:'0.78rem', color: occ>70?'var(--green)':occ>40?'var(--gold)':'var(--text-dim)', fontWeight:'600' }}>
                  {occ}% booked
                </span>
              </div>
            </div>
            {season && <div style={{ color:'var(--text-dim)', fontSize:'0.8rem', marginBottom:'8px' }}>{season.label} — {season.desc}</div>}
            {/* Occupancy bar */}
            <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:'4px', height:'6px', overflow:'hidden' }}>
              <div style={{ height:'6px', width:`${occ}%`, borderRadius:'4px',
                background: season ? SEASON_COLORS[season.type] : '#5C7080', transition:'width 0.6s' }}/>
            </div>
            {occ < 60 && season?.type === 'peak' && (
              <div style={{ marginTop:'8px', color:'#E53935', fontSize:'0.75rem', fontWeight:'600' }}>
                ⚠️ Peak month with low occupancy — consider marketing push now
              </div>
            )}
          </div>
        )
      })}

      {/* Full year calendar */}
      <div className="card-section-label">📊 OCCUPANCY — {year}</div>
      <div className="card">
        {MONTHS.map((m, i) => {
          const season = PEAK_SEASONS.find(p => p.months.includes(i))
          const occ    = occupancy[i]
          const color  = season ? SEASON_COLORS[season.type] : '#5C7080'
          return (
            <div key={m} style={S.barRow}>
              <div style={{ ...S.barLabel, color: i===curMonth?'var(--gold)':'var(--text-dim)',
                fontWeight: i===curMonth?'700':'400' }}>{m}</div>
              <div style={S.barTrack}>
                <div style={{ ...S.barFill, width:`${(occ/100)*100}%`, background:color }}/>
              </div>
              <div style={{ ...S.barVal, color }}>{occ}%</div>
            </div>
          )
        })}
        <div style={{ display:'flex', gap:'12px', marginTop:'10px', flexWrap:'wrap' }}>
          {Object.entries(SEASON_COLORS).map(([type, color]) => (
            <div key={type} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
              <div style={{ width:'10px', height:'10px', borderRadius:'2px', background:color }}/>
              <span style={{ fontSize:'0.7rem', color:'var(--text-dim)', textTransform:'capitalize' }}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Peak season calendar */}
      <div className="card-section-label">🛕 GURUVAYUR PEAK SEASONS</div>
      {PEAK_SEASONS.map((season, i) => (
        <div key={i} style={{ background: SEASON_BG[season.type],
          border:`1px solid ${SEASON_COLORS[season.type]}44`,
          borderRadius:'10px', padding:'12px 14px', marginBottom:'8px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
            <div style={{ fontWeight:'600', color:'var(--text)', fontSize:'0.88rem' }}>
              {season.icon} {season.label}
            </div>
            <span style={{ padding:'2px 8px', borderRadius:'12px', fontSize:'0.68rem', fontWeight:'700',
              color: SEASON_COLORS[season.type], background:`${SEASON_COLORS[season.type]}22` }}>
              {season.months.map(m => MONTHS[m]).join(' · ')}
            </span>
          </div>
          <div style={{ color:'var(--text-dim)', fontSize:'0.78rem' }}>{season.desc}</div>
        </div>
      ))}

      {/* Marketing budget guide */}
      <div className="card-section-label">💡 MARKETING PLAYBOOK</div>
      <div className="card">
        {[
          { timing:'4 months before peak', action:'List on Airbnb + MakeMyTrip. Set premium rates.' },
          { timing:'3 months before peak', action:'WhatsApp blast to past guests. Offer early-bird discount.' },
          { timing:'2 months before peak', action:'Instagram posts with temple festival content.' },
          { timing:'6 weeks before',       action:'Google Ads targeting "Guruvayur villa" keywords.' },
          { timing:'2 weeks before',       action:'Final price check. Fill remaining nights at slight discount.' },
          { timing:'During low season',    action:'Deep maintenance. Renovate. Photograph updates for next season.' },
        ].map((item, i) => (
          <div key={i} style={{ display:'flex', gap:'12px', paddingBottom:'10px', marginBottom:'10px',
            borderBottom: i<5?'1px solid var(--border-dim)':'none' }}>
            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--gold)',
              marginTop:'6px', flexShrink:0 }}/>
            <div>
              <div style={{ color:'var(--gold)', fontSize:'0.72rem', fontWeight:'700', letterSpacing:'0.5px', marginBottom:'2px' }}>
                {item.timing.toUpperCase()}
              </div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.82rem' }}>{item.action}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

function VillaDashboardInner() {
  const navigate = useNavigate()
  const [tab,    setTab]    = useState('guests')
  const [month,  setMonth]  = useState('fy')
  const [year,   setYear]   = useState(CUR_YEAR)
  const [data,     setData]     = useState(null)
  const [stays,    setStays]    = useState([])
  const [allStays, setAllStays] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getVillaDashboard('dwarka', year).catch(() => MOCK),
      api.getStays('dwarka', year).catch(() => []),
    ]).then(([dashData, staysData]) => {
      setData(dashData)
      setStays(Array.isArray(staysData) ? staysData : [])
      setLoading(false)
    })
  }, [year])

  // Load all stays for multi-year charts (now supported via year=all)
  useEffect(() => {
    api.getStays('dwarka', 'all').catch(() => []).then(all => {
      setAllStays(Array.isArray(all) ? all : [])
    })
  }, [])

  const TABS = [
    { key:'guests',     label:'Guests',     icon:'👥' },
    { key:'financials', label:'Financials', icon:'💰' },
    { key:'marketing',  label:'Marketing',  icon:'📣' },
  ]

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Villa dashboard</div>
          <div className="topbar-sub">DWARKA · GVR · {year}</div>
        </div>
        <div style={{width:34}}/>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', background:'var(--dark-card)', borderBottom:'1px solid var(--border-dim)', flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex:1, padding:'12px 4px', border:'none', background:'transparent', cursor:'pointer',
              color: tab===t.key ? 'var(--gold)' : 'var(--text-dim)',
              borderBottom: tab===t.key ? '2px solid var(--gold)' : '2px solid transparent',
              fontSize:'0.75rem', fontWeight: tab===t.key?'700':'400',
              letterSpacing:'0.5px', transition:'all 0.2s' }}>
            <div style={{ fontSize:'1rem', marginBottom:'2px' }}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      <div className="screen-body">
        {tab === 'guests'     && <GuestsTab     stays={stays} loading={loading} year={year} onYearChange={setYear}/>}
        {tab === 'financials' && <FinancialsTab  data={data}  loading={loading} month={month} onMonthChange={setMonth} year={year} onYearChange={setYear} stays={allStays}/>}
        {tab === 'marketing'  && <MarketingTab   data={data}  stays={stays} loading={loading} year={year}/>}
      </div>
    </div>
  )
}

export default function VillaDashboard() {
  return <ErrorBoundary><VillaDashboardInner /></ErrorBoundary>
}

const MOCK = {
  bestMonth:'March', topChannel:'Airbnb', directSaving:18400, avgNights:3.2,
  quarterly:{ Q1:168000, Q2:241000, Q3:195000, Q4:220000 },
  months:{ 4:{ revenue:124000, profit:94200, fees:18400, bookings:4, margin:76, directRatio:'2 / 4',
    breakdown:{ tariff:98000, carRental:12400, kitchen:6800, breakfast:4500, events:2200 } } },
}

const S = {
  barRow:     { display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' },
  barLabel:   { color:'#8A9BAE', fontSize:'0.8rem', width:'80px', flexShrink:0 },
  barTrack:   { flex:1, height:'6px', background:'rgba(255,255,255,0.06)', borderRadius:'3px' },
  barFill:    { height:'6px', borderRadius:'3px', transition:'width 0.6s ease' },
  barVal:     { color:'#EDF2F7', fontSize:'0.8rem', fontWeight:'600', width:'42px', textAlign:'right', flexShrink:0 },
  skeleton:   { background:'rgba(255,255,255,0.04)', borderRadius:'10px', marginBottom:'12px' },
  quarterRow: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'12px' },
  quarterCard:{ background:'#1E2535', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.06)', padding:'12px 8px', textAlign:'center' },
  qLabel:     { color:'#5C7080', fontSize:'0.7rem', letterSpacing:'1px', marginBottom:'6px' },
  qVal:       { color:'#C8903A', fontSize:'0.9rem', fontWeight:'700' },
}
