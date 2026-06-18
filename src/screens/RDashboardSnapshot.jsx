/**
 * RDashboardSnapshot.jsx
 * Raman's quick revenue snapshot — accessible from RamanHome.
 *
 * Shows:
 *   CURRENT YEAR
 *     Paid to date (current year)
 *     Current quarter: unpaid guest names + dates
 *     Previous quarters of current year: paid total
 *
 *   PAST YEARS
 *     Each year: total paid
 *
 *   GRAND TOTAL (all-time paid + unpaid outstanding)
 *
 * Route: /raman/dashboard
 * Access: Raman (manager role)
 */

import { useState, useEffect, Component } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

class EB extends Component {
  constructor(p){super(p);this.state={err:null}}
  static getDerivedStateFromError(e){return{err:e}}
  render(){
    if(this.state.err) return(
      <div style={{padding:'20px',color:'#e74c3c',background:'#0d0d1a',minHeight:'100vh'}}>
        <div style={{fontWeight:'700',marginBottom:'8px'}}>My Earnings Error</div>
        <div style={{fontSize:'0.8rem',wordBreak:'break-all'}}>{this.state.err?.message}</div>
        <pre style={{fontSize:'0.65rem',color:'#888',marginTop:'8px',whiteSpace:'pre-wrap'}}>{this.state.err?.stack}</pre>
        <button onClick={()=>window.history.back()} style={{marginTop:'12px',padding:'8px 16px',background:'#e74c3c',color:'white',border:'none',borderRadius:'6px',cursor:'pointer'}}>← Back</button>
      </div>
    )
    return this.props.children
  }
}


export default function RDashboardSnapshot(){return <EB><RDashboardSnapshotInner/></EB>}

function fmt(n) {
  if (!n && n !== 0) return '—'
  return `₹${Number(n).toLocaleString('en-IN')}`
}
function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) }
  catch { return d }
}
function currentQuarterKey() {
  const now = new Date()
  return `${now.getFullYear()}-Q${Math.floor(now.getMonth()/3)+1}`
}
const Q_MONTHS = { Q1:'Jan–Mar', Q2:'Apr–Jun', Q3:'Jul–Sep', Q4:'Oct–Dec' }
function qLabel(key) {
  // key = "2026-Q1" → "Q1 2026 (Jan–Mar)"
  const parts = key.split('-')
  const q = parts[1], yr = parts[0]
  return `${q} ${yr} (${Q_MONTHS[q]||''})`
}
function quarterHasPassed(key) {
  const parts = key.split('-')
  const yr = parseInt(parts[0]), q = parseInt(parts[1].replace('Q',''))
  const now = new Date()
  const curYr = now.getFullYear()
  const curQ  = Math.floor(now.getMonth()/3) + 1
  if (yr < curYr) return true
  if (yr === curYr && q < curQ) return true
  return false
}

function RDashboardSnapshotInner() {
  const navigate    = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    api.getRamanDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div><div className="topbar-title">My earnings</div></div>
      </div>
      <div className="screen-body">
        <div className="loading"><div className="spinner"/>Loading…</div>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div><div className="topbar-title">My earnings</div></div>
      </div>
      <div className="screen-body">
        <div style={{background:'rgba(198,40,40,0.1)',border:'1px solid rgba(198,40,40,0.3)',
          borderRadius:'10px',padding:'14px',color:'#EF9A9A',fontSize:'0.85rem',marginTop:'16px'}}>
          {error || 'No earnings data yet. Commissions are recorded when a guest checks out.'}
        </div>
      </div>
    </div>
  )

  const curYear  = String(new Date().getFullYear())
  const curQKey  = currentQuarterKey()

  // Split byYear into current vs past
  const curYearData = data?.byYear?.find(y => y.year === curYear)
  const pastYears   = data?.byYear?.filter(y => y.year !== curYear) || []

  // Split unpaidByQ into current year vs past
  const unpaidCurYear = (data?.unpaidByQ || []).filter(q => String(q.year) === curYear)
  const unpaidPast    = (data?.unpaidByQ || []).filter(q => String(q.year) !== curYear)

  // For current year: split quarters into current (show detail) vs others (show total)
  const curQ    = unpaidCurYear.find(q => q.key === curQKey)
  const otherQs = unpaidCurYear.filter(q => q.key !== curQKey)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">My earnings</div>
          <div className="topbar-sub">COMMISSION SNAPSHOT</div>
        </div>
        <div style={{width:34}}/>
      </div>

      <div className="screen-body">

        {error && (
          <div style={{color:'#EF9A9A',background:'rgba(198,40,40,0.1)',padding:'10px 14px',
            borderRadius:'8px',marginBottom:'12px',fontSize:'0.85rem'}}>
            ⚠️ {error}
          </div>
        )}

        {/* ── CURRENT YEAR ── */}
        <div className="card-section-label">CURRENT · {curYear}</div>

        {/* Settled stays this year — no monetary amounts shown to Raman */}
        <div style={{background:'rgba(200,144,58,0.06)',border:'1px solid rgba(200,144,58,0.25)',
          borderRadius:'14px',padding:'16px',marginBottom:'12px'}}>
          <div style={{color:'var(--text-dim)',fontSize:'0.7rem',letterSpacing:'1px',marginBottom:'4px'}}>
            SETTLED · {curYear}
          </div>
          <div style={{color:'var(--gold)',fontSize:'2rem',fontWeight:'800',fontFamily:'monospace'}}>
            {curYearData?.staysPaid || 0}
          </div>
          <div style={{color:'var(--text-dim)',fontSize:'0.75rem',marginTop:'4px'}}>
            stay{(curYearData?.staysPaid||0)!==1?'s':''} settled this year
          </div>
        </div>

        {/* All quarters of current year — show each with correct status */}
        {['Q1','Q2','Q3','Q4'].map(q => {
          const key     = `${curYear}-${q}`
          const isCurQ  = key === curQKey
          const isPast  = quarterHasPassed(key)
          const unpaidQ = unpaidCurYear.find(uq => uq.key === key)
          const isFuture = !isPast && !isCurQ

          if (isFuture) return null  // Don't show future quarters at all

          if (unpaidQ) return (
            <div key={key} style={{marginBottom:'12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'6px 2px',marginBottom:'6px'}}>
                <span style={{color:'#e67e22',fontWeight:'700',fontSize:'0.82rem'}}>
                  ⏳ {qLabel(key)} — UNPAID
                </span>
                <span style={{color:'#e67e22',fontWeight:'600',fontSize:'0.82rem'}}>
                  {unpaidQ.stays.length} guest{unpaidQ.stays.length!==1?'s':''}
                </span>
              </div>
              <div style={{background:'var(--dark-card)',borderRadius:'12px',
                border:'1px solid rgba(230,126,34,0.25)',overflow:'hidden'}}>
                {unpaidQ.stays.map((s,i) => (
                  <div key={i} style={{padding:'10px 16px',
                    borderBottom:i<unpaidQ.stays.length-1?'1px solid var(--border-dim)':'none',
                    display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontWeight:'600',fontSize:'0.88rem',color:'var(--text)'}}>
                        {s.guestName}
                      </div>
                      <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginTop:'1px'}}>
                        {fmtDate(s.checkIn)} · {s.nights} night{s.nights!==1?'s':''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )

          if (isPast && !unpaidQ) return (
            <div key={key} style={{display:'flex',justifyContent:'space-between',
              padding:'8px 14px',marginBottom:'6px'}}>
              <span style={{color:'var(--text-dim)',fontSize:'0.82rem'}}>{qLabel(key)}</span>
              <span style={{color:'#34A853',fontSize:'0.82rem',fontWeight:'600'}}>✓ Paid</span>
            </div>
          )

          if (isCurQ && !unpaidQ) return (
            <div key={key} style={{background:'rgba(52,168,83,0.06)',border:'1px solid rgba(52,168,83,0.2)',
              borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',
              color:'#34A853',fontSize:'0.85rem',fontWeight:'600'}}>
              ✅ {qLabel(key)} — All paid
            </div>
          )

          return null
        })}

        {/* ── PAST YEARS ── */}
        {(pastYears.length > 0 || unpaidPast.length > 0) && (
          <>
            <div className="card-section-label" style={{marginTop:'8px'}}>PAST YEARS</div>
            <div style={{background:'var(--dark-card)',borderRadius:'12px',
              border:'1px solid var(--border-dim)',overflow:'hidden',marginBottom:'14px'}}>
              {pastYears.map((y,i) => (
                <div key={y.year} style={{padding:'12px 16px',
                  borderBottom:i<pastYears.length-1?'1px solid var(--border-dim)':'none',
                  display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:'700',fontSize:'0.9rem'}}>{y.year}</div>
                    <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginTop:'1px'}}>
                      {y.staysPaid} stay{y.staysPaid!==1?'s':''} · fully settled
                    </div>
                  </div>
                  <div style={{color:'#34A853',fontWeight:'700',fontSize:'0.85rem'}}>
                    ✓ Settled
                  </div>
                </div>
              ))}
              {unpaidPast.map((q,i) => (
                <div key={q.key} style={{padding:'12px 16px',
                  borderBottom:'1px solid var(--border-dim)',
                  display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:'700',fontSize:'0.9rem',color:'#EF9A9A'}}>{q.label}</div>
                    <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginTop:'1px'}}>
                      {q.stays.length} stay{q.stays.length!==1?'s':''} · pending
                    </div>
                  </div>
                  <div style={{color:'#EF9A9A',fontWeight:'700',fontSize:'0.85rem'}}>⏳ Pending</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── SUMMARY — guest counts only, no monetary amounts ── */}
        <div className="card-section-label">ALL TIME</div>
        <div style={{background:'var(--dark-card)',borderRadius:'12px',
          border:'1px solid var(--border-dim)',padding:'16px',marginBottom:'14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            marginBottom:'10px',paddingBottom:'10px',borderBottom:'1px solid var(--border-dim)'}}>
            <span style={{color:'var(--text-dim)',fontSize:'0.82rem'}}>Stays settled</span>
            <span style={{color:'#34A853',fontWeight:'700',fontSize:'1rem'}}>
              {(data?.byYear || []).reduce((s,y)=>s+(y.staysPaid||0),0)}
            </span>
          </div>
          {(data?.totalUnpaid > 0) && (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{color:'var(--text-dim)',fontSize:'0.82rem'}}>Stays pending</span>
              <span style={{color:'#e67e22',fontWeight:'700',fontSize:'1rem'}}>
                {(data?.unpaidByQ || []).reduce((s,q)=>s+(q.stays?.length||0),0)}
              </span>
            </div>
          )}
        </div>



      </div>
    </div>
  )
}
