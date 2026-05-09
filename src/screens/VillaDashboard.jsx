import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

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

const YEARS = [CUR_YEAR, CUR_YEAR-1, CUR_YEAR-2, CUR_YEAR-3]

function fmt(n) {
  if (!n && n !== 0) return '—'
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`
  if (n >= 1000)   return `₹${(n/1000).toFixed(1)}K`
  return `₹${n.toLocaleString('en-IN')}`
}

function fmtDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date)) return String(d)
  return date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}

function calcNights(ci, co) {
  if (!ci || !co) return 0
  return Math.max(0, Math.round((new Date(co) - new Date(ci)) / (1000*60*60*24)))
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
  const [selMonth, setSelMonth] = useState(CUR_MONTH)

  const today = new Date()
  today.setHours(0,0,0,0)

  const parsed = (stays || []).map(s => ({
    ...s,
    checkInDate:  new Date(s.checkIn  || s.checkInDate  || ''),
    checkOutDate: new Date(s.checkOut || s.checkOutDate || ''),
  }))

  const upcoming   = parsed.filter(s => s.checkInDate > today && s.status !== 'cancelled').sort((a,b) => a.checkInDate - b.checkInDate)
  const active     = parsed.filter(s => s.status === 'active')
  const unclosed   = parsed.filter(s => !['checked_out','cancelled'].includes(s.status) && s.checkOutDate < today && !isNaN(s.checkOutDate))
  const byMonth    = parsed.filter(s => s.checkInDate.getMonth() === selMonth && s.checkInDate.getFullYear() === year)

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

      {/* Upcoming */}
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
                  {s.stayId} · {s.adults||0} adults · {s.phone||''}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* By month */}
      <div className="card-section-label">📋 BOOKINGS BY MONTH</div>
      <div className="month-strip" style={{ marginBottom:'12px' }}>
        {MONTHS.map((m, i) => (
          <button key={m} className={`month-pill${selMonth===i?' active':''}`} onClick={() => setSelMonth(i)}>{m}</button>
        ))}
      </div>
      {loading ? <Skeleton h={120} /> : byMonth.length === 0 ? (
        <div className="card" style={{ textAlign:'center', color:'var(--text-dim)', padding:'20px' }}>
          No bookings in {MONTHS_FULL[selMonth]} {year}
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:'8px', marginBottom:'8px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'0.75rem', color:'var(--text-dim)' }}>
              {byMonth.length} booking{byMonth.length>1?'s':''} · {byMonth.reduce((s,b)=>s+calcNights(b.checkIn||b.checkInDate,b.checkOut||b.checkOutDate),0)} total nights
            </span>
          </div>
          <div style={{ background:'var(--dark-card)', borderRadius:'12px', border:'1px solid var(--border-dim)', overflow:'hidden', marginBottom:'12px' }}>
            {byMonth.map((s, i) => (
              <div key={i} style={{ padding:'12px 16px', borderBottom: i<byMonth.length-1?'1px solid var(--border-dim)':'none' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'3px' }}>
                  <span style={{ color:'var(--text)', fontWeight:'600', fontSize:'0.88rem' }}>{s.guestName || s.bookerName}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>
                  {fmtDate(s.checkIn||s.checkInDate)} → {fmtDate(s.checkOut||s.checkOutDate)} · {s.channel||'Direct'} · {s.adults||0} adults
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'3px' }}>
                  <span style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>{s.stayId}</span>
                  {s.net ? <span style={{ color:'var(--green)', fontSize:'0.78rem', fontWeight:'600' }}>{fmt(s.net)}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* All stays summary */}
      <div className="card-section-label">YEAR SUMMARY — {year}</div>
      <div className="card">
        {loading ? <Skeleton h={80}/> : (
          <>
            {[
              { label:'Total bookings',    val: parsed.length },
              { label:'Checked out',       val: parsed.filter(s=>s.status==='checked_out').length },
              { label:'Active now',        val: active.length },
              { label:'Upcoming',          val: upcoming.length },
              { label:'Cancelled',         val: parsed.filter(s=>s.status==='cancelled').length },
              { label:'Unclosed (action)', val: unclosed.length, alert: unclosed.length > 0 },
            ].map((row, i) => (
              <div key={i} className="net-row">
                <span className="net-label">{row.label}</span>
                <span style={{ color: row.alert ? 'var(--red)' : 'var(--text)', fontWeight:'600' }}>{row.val}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── TAB: FINANCIALS ──────────────────────────────────────────────────────────

function FinancialsTab({ data, loading, month, onMonthChange, year, onYearChange }) {
  const monthData = data?.months?.[month] || {}
  const breakdown = monthData.breakdown || {}
  const maxBreakdown = Math.max(...Object.values(breakdown).map(v => v||0), 1)

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

      <div className="month-strip">
        {MONTHS.map((m, i) => (
          <button key={m} className={`month-pill${month===i?' active':''}`} onClick={() => onMonthChange(i)}>{m}</button>
        ))}
        <button className={`month-pill${month==='fy'?' active':''}`} onClick={() => onMonthChange('fy')}>FY</button>
      </div>

      <div className="card-section-label">{typeof month==='number'?MONTHS_FULL[month]:'Full Year'} {year}</div>
      {loading ? (
        <div className="stats-grid"><Skeleton/><Skeleton/><Skeleton/><Skeleton/></div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Revenue</div>
            <div className="stat-val gold">{fmt(monthData.revenue)}</div>
            <div className="stat-sub">{monthData.bookings||0} bookings</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Net profit</div>
            <div className="stat-val green">{fmt(monthData.profit)}</div>
            <div className="stat-sub">{monthData.margin||0}% margin</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Commissions</div>
            <div className="stat-val red">{fmt(monthData.fees)}</div>
            <div className="stat-sub">Paid to channels</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Direct ratio</div>
            <div className="stat-val green">{monthData.directRatio||'—'}</div>
            <div className="stat-sub">Direct / total</div>
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
      const ci = new Date(s.checkIn||s.checkInDate||'')
      return !isNaN(ci) && ci.getMonth()===m && ci.getFullYear()===year
    })
    const nights = monthStays.reduce((sum,s) => {
      return sum + Math.min(30, Math.max(0, Math.round((new Date(s.checkOut||s.checkOutDate) - new Date(s.checkIn||s.checkInDate)) / (1000*60*60*24))))
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

export default function VillaDashboard() {
  const navigate = useNavigate()
  const [tab,    setTab]    = useState('guests')
  const [month,  setMonth]  = useState(CUR_MONTH)
  const [year,   setYear]   = useState(CUR_YEAR)
  const [data,   setData]   = useState(null)
  const [stays,  setStays]  = useState([])
  const [loading, setLoading] = useState(true)

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
        {tab === 'financials' && <FinancialsTab  data={data}  loading={loading} month={month} onMonthChange={setMonth} year={year} onYearChange={setYear}/>}
        {tab === 'marketing'  && <MarketingTab   data={data}  stays={stays} loading={loading} year={year}/>}
      </div>
    </div>
  )
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
