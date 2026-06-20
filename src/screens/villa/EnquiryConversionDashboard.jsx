import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { SOURCES, LOST_REASONS } from './EnquiryTracker'

function fmt(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }

function KpiCard({ label, value, color }) {
  return (
    <div className="card" style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
      <div style={{ color: '#5C7080', fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: color || 'var(--text)', fontWeight: '700', fontSize: '1.1rem' }}>{value}</div>
    </div>
  )
}

export default function EnquiryConversionDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [followUps, setFollowUps] = useState([])
  const [loading, setLoading] = useState(true)
  const year = new Date().getFullYear()

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.getEnquiryDashboard('dwarka', year),
      api.getEnquiryFollowUps('dwarka'),
    ]).then(([dash, fu]) => {
      if (cancelled) return
      setData(dash)
      setFollowUps(Array.isArray(fu) ? fu : [])
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading || !data) {
    return (
      <div className="screen">
        <div className="topbar">
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          <div className="topbar-title">Loading…</div>
        </div>
      </div>
    )
  }

  const maxSourceEnq = Math.max(1, ...Object.values(data.bySource || {}).map(s => s.enquiries))

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Conversion Dashboard</div>
          <div className="topbar-sub">DWARKA · ENQUIRIES {year}</div>
        </div>
      </div>

      <div className="screen-body">
        {followUps.length > 0 && (
          <div className="card" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.3)', marginBottom: '14px' }}>
            <div style={{ color: '#FB923C', fontWeight: '700', fontSize: '0.85rem', marginBottom: '8px' }}>
              ⏰ {followUps.length} Enquir{followUps.length === 1 ? 'y' : 'ies'} Requiring Follow-Up
            </div>
            {followUps.slice(0, 5).map(f => (
              <div key={f.enquiry_id} onClick={() => navigate(`/owner/villa/enquiries/${f.enquiry_id}`)}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', cursor: 'pointer', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text)' }}>{f.guest_name}</span>
                <span style={{ color: '#FB923C' }}>due {String(f.follow_up_due).slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="card-section-label">SUMMARY</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <KpiCard label="Total Enquiries" value={data.totalEnquiries} />
          <KpiCard label="Confirmed" value={data.confirmedCount} color="#34A853" />
          <KpiCard label="Lost" value={data.lostCount} color="#EF4444" />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <KpiCard label="Conversion Rate" value={`${data.conversionRate}%`} color="#C8903A" />
          <KpiCard label="Revenue Won" value={fmt(data.revenueWon)} color="#34A853" />
          <KpiCard label="Revenue Lost" value={fmt(data.revenueLost)} color="#EF4444" />
        </div>

        <div className="card-section-label">SOURCE ANALYSIS</div>
        <div className="card">
          {Object.entries(data.bySource || {}).sort((a, b) => b[1].enquiries - a[1].enquiries).map(([src, s]) => (
            <div key={src} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text)', fontWeight: '600' }}>{SOURCES.find(x => x.id === src)?.label || src}</span>
                <span style={{ color: '#5C7080' }}>{s.bookings}/{s.enquiries} · <span style={{ color: '#C8903A', fontWeight: '700' }}>{s.conversionPct}%</span></span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(s.enquiries / maxSourceEnq) * 100}%`, background: '#C8903A', borderRadius: '3px' }} />
              </div>
            </div>
          ))}
          {Object.keys(data.bySource || {}).length === 0 && (
            <div style={{ color: '#5C7080', fontSize: '0.8rem', textAlign: 'center', padding: '10px' }}>No enquiries yet this year.</div>
          )}
        </div>

        <div className="card-section-label" style={{ marginTop: '14px' }}>REPEAT GUEST METRICS</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <KpiCard label="Repeat Guests" value={data.repeatGuestsThisYear} color="#8B5CF6" />
          <KpiCard label="Repeat Revenue" value={fmt(data.repeatGuestRevenue)} color="#8B5CF6" />
          <KpiCard label="Avg Discount" value={`${data.avgRepeatDiscount}%`} color="#8B5CF6" />
        </div>

        {Object.keys(data.lostReasons || {}).length > 0 && (
          <>
            <div className="card-section-label">WHY ENQUIRIES ARE LOST</div>
            <div className="card">
              {Object.entries(data.lostReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                <div key={reason} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text)' }}>{LOST_REASONS.find(r => r.id === reason)?.label || reason}</span>
                  <span style={{ color: '#EF4444', fontWeight: '700' }}>{count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
