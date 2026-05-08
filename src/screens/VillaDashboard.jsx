import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CUR_MONTH = new Date().getMonth()
const CUR_YEAR  = new Date().getFullYear()

function fmt(n) {
  if (!n && n !== 0) return '—'
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`
  if (n >= 1000)   return `₹${(n/1000).toFixed(1)}K`
  return `₹${n.toLocaleString('en-IN')}`
}

// Simple bar component — no external chart lib needed
function Bar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={styles.barRow}>
      <div style={styles.barLabel}>{label}</div>
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${pct}%`, background: color }} />
      </div>
      <div style={styles.barVal}>{fmt(value)}</div>
    </div>
  )
}

// Skeleton loader
function Skeleton({ h = 80 }) {
  return <div style={{ ...styles.skeleton, height: h }} />
}

export default function VillaDashboard() {
  const navigate  = useNavigate()
  const [month, setMonth] = useState(CUR_MONTH)
  const [year]    = useState(CUR_YEAR)
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getVillaDashboard('dwarka', year)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => {
        // Use mock data if API not yet live
        setData(MOCK)
        setLoading(false)
      })
  }, [year])

  const monthData = data?.months?.[month] || {}
  const breakdown = monthData.breakdown || {}
  const maxBreakdown = Math.max(...Object.values(breakdown).map(v => v || 0), 1)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Villa dashboard</div>
          <div className="topbar-sub">DWARKA · GVR · {year}</div>
        </div>
      </div>

      <div className="screen-body">

        {/* Month selector */}
        <div className="month-strip">
          {MONTHS.map((m, i) => (
            <button key={m} className={`month-pill${month === i ? ' active' : ''}`}
              onClick={() => setMonth(i)}>{m}</button>
          ))}
          <button className={`month-pill${month === 'q' ? ' active' : ''}`}
            onClick={() => setMonth('q')}>Q2</button>
          <button className={`month-pill${month === 'fy' ? ' active' : ''}`}
            onClick={() => setMonth('fy')}>FY</button>
        </div>

        {/* Snapshot stats */}
        <div className="card-section-label">{MONTHS[month] || 'ANNUAL'} {year} SNAPSHOT</div>
        {loading ? (
          <div className="stats-grid">
            <Skeleton /><Skeleton /><Skeleton /><Skeleton />
          </div>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total revenue</div>
              <div className="stat-val gold">{fmt(monthData.revenue)}</div>
              <div className="stat-sub">{monthData.bookings || 0} bookings</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Net profit</div>
              <div className="stat-val green">{fmt(monthData.profit)}</div>
              <div className="stat-sub">{monthData.margin || 0}% margin</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Fees paid out</div>
              <div className="stat-val red">{fmt(monthData.fees)}</div>
              <div className="stat-sub">Channel commissions</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Direct bookings</div>
              <div className="stat-val green">{monthData.directRatio || '—'}</div>
              <div className="stat-sub">Of total bookings</div>
            </div>
          </div>
        )}

        {/* Revenue breakdown */}
        <div className="card-section-label">WHAT BRINGS MONEY</div>
        <div className="card">
          {loading ? <Skeleton h={160} /> : (
            <>
              <Bar label="Room tariff"   value={breakdown.tariff}    max={maxBreakdown} color="#C8903A" />
              <Bar label="Car rental"    value={breakdown.carRental}  max={maxBreakdown} color="#3B6D11" />
              <Bar label="Kitchen items" value={breakdown.kitchen}    max={maxBreakdown} color="#3B6D11" />
              <Bar label="Breakfast"     value={breakdown.breakfast}  max={maxBreakdown} color="#3B6D11" />
              <Bar label="Wedding/event" value={breakdown.events}     max={maxBreakdown} color="#3B6D11" />
            </>
          )}
        </div>

        {/* Insights */}
        <div className="card-section-label">INSIGHTS</div>
        <div className="card" style={{ background: 'rgba(52,168,83,0.07)', border: '1px solid rgba(52,168,83,0.2)' }}>
          {loading ? <Skeleton h={80} /> : (
            <>
              <div className="net-row">
                <span className="net-label">Best month this year</span>
                <span className="net-val">{data?.bestMonth || '—'}</span>
              </div>
              <div className="net-row">
                <span className="net-label">Most booked channel</span>
                <span className="net-val">{data?.topChannel || '—'}</span>
              </div>
              <div className="net-row">
                <span className="net-label">Direct booking saving</span>
                <span className="net-val pos">+{fmt(data?.directSaving)}</span>
              </div>
              <div className="net-row">
                <span className="net-label">Avg nights per stay</span>
                <span className="net-val">{data?.avgNights || '—'} nights</span>
              </div>
            </>
          )}
        </div>

        {/* Quarterly profit */}
        <div className="card-section-label">QUARTERLY NET PROFIT</div>
        {loading ? <Skeleton h={80} /> : (
          <div style={styles.quarterRow}>
            {['Q1','Q2','Q3','Q4'].map(q => (
              <div key={q} style={styles.quarterCard}>
                <div style={styles.qLabel}>{q}</div>
                <div style={styles.qVal}>{fmt(data?.quarterly?.[q])}</div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

// Mock data — replaced by real API once Apps Script is updated
const MOCK = {
  bestMonth: 'March',
  topChannel: 'Airbnb',
  directSaving: 18400,
  avgNights: 3.2,
  quarterly: { Q1: 168000, Q2: 241000, Q3: 195000, Q4: 220000 },
  months: {
    4: { // May
      revenue: 124000, profit: 94200, fees: 18400, bookings: 4,
      margin: 76, directRatio: '2 / 4',
      breakdown: { tariff: 98000, carRental: 12400, kitchen: 6800, breakfast: 4500, events: 2200 },
    },
  },
}

const styles = {
  barRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  barLabel: { color: '#8A9BAE', fontSize: '0.8rem', width: '90px', flexShrink: 0 },
  barTrack: { flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px' },
  barFill: { height: '6px', borderRadius: '3px', transition: 'width 0.6s ease' },
  barVal: { color: '#EDF2F7', fontSize: '0.8rem', fontWeight: '600', width: '56px', textAlign: 'right', flexShrink: 0 },
  skeleton: { background: 'rgba(255,255,255,0.04)', borderRadius: '10px', marginBottom: '12px', animation: 'pulse 1.5s ease-in-out infinite' },
  quarterRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' },
  quarterCard: { background: '#1E2535', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', padding: '12px 8px', textAlign: 'center' },
  qLabel: { color: '#5C7080', fontSize: '0.7rem', letterSpacing: '1px', marginBottom: '6px' },
  qVal:   { color: '#C8903A', fontSize: '0.9rem', fontWeight: '700' },
}
