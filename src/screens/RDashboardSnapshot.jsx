/**
 * RDashboardSnapshot.jsx
 * Raman's quick earnings snapshot — accessible from RamanHome.
 * NO MONETARY VALUES ARE EVER SHOWN ON THIS SCREEN — owner-only policy.
 *
 * Shows:
 *   CURRENT YEAR (broken down by quarter -> month -> guest)
 *     Each guest shown with paid/pending status (checkmark, no amount)
 *     Pending count shown per quarter so Raman knows what's outstanding
 *
 *   PAST YEARS (2022 - last year) — single blanket bucket
 *     Just a total stay count, no breakdown, no money
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

function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) }
  catch { return d }
}

const MONTH_TO_Q = { 1:1,2:1,3:1, 4:2,5:2,6:2, 7:3,8:3,9:3, 10:4,11:4,12:4 }
const Q_RANGE = { 1:'Jan–Mar', 2:'Apr–Jun', 3:'Jul–Sep', 4:'Oct–Dec' }

function currentQuarter() {
  const now = new Date()
  return MONTH_TO_Q[now.getMonth() + 1]
}

function RDashboardSnapshotInner() {
  const navigate = useNavigate()
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [expandQ, setExpandQ] = useState({})
  const [expandM, setExpandM] = useState({})

  useEffect(() => {
    api.getRamanReport()
      .then(d => { setReport(d); setLoading(false) })
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

  if (error || !report) return (
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

  const curYear = new Date().getFullYear()
  const curQ    = currentQuarter()

  const years = report.years || []
  const curYearData  = years.find(y => y.year === curYear)
  const pastYearsData = years.filter(y => y.year !== curYear)

  // Group current year's months into quarters
  const quarters = { 1: [], 2: [], 3: [], 4: [] }
  ;(curYearData?.months || []).forEach(m => {
    const q = MONTH_TO_Q[m.month]
    quarters[q].push(m)
  })

  // Blanket past-years total (just stay count, no money, no breakdown)
  const pastTotalStays = pastYearsData.reduce((s, y) => s + (y.totalGuests || 0), 0)
  const pastYearRange = pastYearsData.length > 0
    ? (pastYearsData.length === 1
        ? String(pastYearsData[0].year)
        : `${Math.min(...pastYearsData.map(y=>y.year))}–${Math.max(...pastYearsData.map(y=>y.year))}`)
    : null

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

        {/* ── CURRENT YEAR — by quarter -> month -> guest ── */}
        <div className="card-section-label">{curYear}</div>

        {[1,2,3,4].map(q => {
          const months = quarters[q]
          const hasData = months.length > 0
          if (!hasData) return null // don't show future quarters with no data at all

          const totalGuests = months.reduce((s,m) => s + m.paidCount + m.unpaidCount, 0)
          const pendingGuests = months.reduce((s,m) => s + m.unpaidCount, 0)
          const isCurQ = q === curQ
          const qKey = `q${q}`
          const qOpen = expandQ[qKey] ?? isCurQ // current quarter open by default

          return (
            <div key={q} style={{marginBottom:'10px', background:'var(--dark-card)',
              border: pendingGuests > 0 ? '1px solid rgba(230,126,34,0.3)' : '1px solid var(--border-dim)',
              borderRadius:'12px', overflow:'hidden'}}>

              {/* Quarter header */}
              <div onClick={() => setExpandQ(prev => ({ ...prev, [qKey]: !qOpen }))}
                style={{padding:'12px 16px', display:'flex', justifyContent:'space-between',
                  alignItems:'center', cursor:'pointer',
                  borderBottom: qOpen ? '1px solid var(--border-dim)' : 'none'}}>
                <div>
                  <div style={{color: pendingGuests > 0 ? '#e67e22' : 'var(--text)', fontWeight:'700', fontSize:'0.92rem'}}>
                    Q{q} {curYear} ({Q_RANGE[q]})
                  </div>
                  <div style={{color:'var(--text-dim)', fontSize:'0.74rem', marginTop:'2px'}}>
                    {totalGuests} guest{totalGuests!==1?'s':''}
                    {pendingGuests > 0
                      ? <span style={{color:'#e67e22'}}> · {pendingGuests} pending</span>
                      : <span style={{color:'#34A853'}}> · all paid</span>}
                  </div>
                </div>
                <span style={{color:'var(--text-dim)'}}>{qOpen ? '▼' : '▶'}</span>
              </div>

              {/* Months within quarter */}
              {qOpen && months.map(m => {
                const mKey = `${qKey}-${m.key}`
                const mOpen = expandM[mKey] ?? (m.unpaidCount > 0)
                return (
                  <div key={m.key}>
                    <div onClick={() => setExpandM(prev => ({ ...prev, [mKey]: !mOpen }))}
                      style={{padding:'9px 16px 9px 24px', display:'flex', justifyContent:'space-between',
                        alignItems:'center', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                      <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                        <span style={{color:'var(--text-dim)', fontSize:'0.7rem'}}>{mOpen?'▾':'▸'}</span>
                        <span style={{color:'var(--text)', fontSize:'0.85rem', fontWeight:'600'}}>{m.monthName}</span>
                      </div>
                      <span style={{fontSize:'0.74rem', color: m.unpaidCount>0 ? '#e67e22':'#34A853', fontWeight:'600'}}>
                        {m.unpaidCount > 0 ? `${m.unpaidCount} pending` : '✓ all paid'}
                      </span>
                    </div>
                    {mOpen && m.guests.map((g,gi) => (
                      <div key={gi} style={{padding:'8px 16px 8px 40px',
                        borderBottom: gi<m.guests.length-1 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                        display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div>
                          <div style={{color:'var(--text)', fontSize:'0.8rem'}}>{g.guestName}</div>
                          <div style={{color:'var(--text-dim)', fontSize:'0.7rem', marginTop:'1px'}}>
                            {fmtDate(g.checkIn)} · {g.nights} night{g.nights!==1?'s':''}
                          </div>
                        </div>
                        <span style={{fontSize:'0.85rem', fontWeight:'700',
                          color: g.isPaid ? '#34A853' : '#e67e22'}}>
                          {g.isPaid ? '✓' : '⏳'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* No data yet for current year */}
        {!curYearData && (
          <div className="card" style={{textAlign:'center', color:'var(--text-dim)', padding:'24px', marginBottom:'14px'}}>
            No stays recorded yet for {curYear}
          </div>
        )}

        {/* ── PAST YEARS — single blanket bucket, no breakdown, no money ── */}
        {pastTotalStays > 0 && (
          <>
            <div className="card-section-label" style={{marginTop:'8px'}}>PAST YEARS</div>
            <div style={{background:'var(--dark-card)', borderRadius:'12px',
              border:'1px solid var(--border-dim)', padding:'16px', marginBottom:'14px'}}>
              <div style={{color:'var(--text-dim)', fontSize:'0.72rem', letterSpacing:'1px', marginBottom:'4px'}}>
                {pastYearRange}
              </div>
              <div style={{color:'var(--text)', fontSize:'1.6rem', fontWeight:'800'}}>
                {pastTotalStays} stay{pastTotalStays!==1?'s':''}
              </div>
              <div style={{color:'#34A853', fontSize:'0.78rem', marginTop:'4px', fontWeight:'600'}}>
                ✓ fully settled
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
