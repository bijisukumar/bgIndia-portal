// ============================================================
//  REV360 HOME — Portfolio KPIs + alerts + navigation
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api'

const STATUS_COLOR = {
  'Active':       '#34A853',
  'Notice Given': '#F59E0B',
  'Delinquent':   '#EF4444',
  'Evicted':      '#EF4444',
  'Runaway':      '#EF4444',
  'Completed':    '#5C7080',
}

function fmtCurrency(amount, currency) {
  if (!amount && amount !== 0) return '—'
  const abs = Math.abs(amount)
  if (currency === 'USD') {
    return (amount < 0 ? '−' : '') + '$' + (abs >= 1000 ? (abs/1000).toFixed(1) + 'K' : abs.toLocaleString())
  }
  const s = abs >= 100000 ? `₹${(abs/100000).toFixed(1)}L` : abs >= 1000 ? `₹${(abs/1000).toFixed(1)}K` : `₹${abs.toLocaleString('en-IN')}`
  return (amount < 0 ? '−' : '') + s
}

export default function Rev360Home() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [dash, setDash] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getRev360Dashboard()
      .then(d => { if (d?.data) setDash(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalNOI = dash?.income?.reduce((s, r) => s + (r.net || 0), 0) || 0
  const totalLosses = dash?.losses?.reduce((s, r) => s + (r.total_written_off || 0), 0) || 0
  const totalClaimed = dash?.losses?.reduce((s, r) => s + (r.total_claimed || 0), 0) || 0
  const activeCount = dash?.properties?.filter(p => p.status === 'Active').length || 0
  const alertCount = dash?.properties?.filter(p => ['Delinquent','Evicted','Runaway'].includes(p.status)).length || 0
  const renewals = (dash?.renewalAlerts || []).filter(r => r.days_left <= 60)

  return (
    <div className="screen">
      <div style={styles.header}>
        <div style={styles.headerText}>
          <div style={styles.brandName}>Rev360</div>
          <div style={styles.tagline}>RENTAL PORTFOLIO MANAGEMENT</div>
        </div>
        <div style={styles.welcomeBadge}><span style={styles.welcomeLabel}>OWNER</span></div>
      </div>

      <div className="screen-body">

        {/* Delinquency alerts */}
        {alertCount > 0 && (
          <div style={styles.alertBanner}>
            <span style={{ color: '#EF4444', fontWeight: '700', fontSize: '0.82rem' }}>
              🚨 {alertCount} propert{alertCount > 1 ? 'ies' : 'y'} need attention
            </span>
            {dash.properties.filter(p => ['Delinquent','Evicted','Runaway'].includes(p.status)).map(p => (
              <div key={p.prop_id} style={{ fontSize: '0.78rem', color: '#EDF2F7', marginTop: '4px' }}>
                {p.name} — <span style={{ color: STATUS_COLOR[p.status] }}>{p.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Renewal alerts */}
        {renewals.length > 0 && (
          <div style={styles.renewalBanner}>
            <div style={{ color: '#F59E0B', fontWeight: '700', fontSize: '0.82rem', marginBottom: '6px' }}>
              📅 {renewals.length} lease{renewals.length > 1 ? 's' : ''} expiring soon
            </div>
            {renewals.map(r => (
              <div key={r.prop_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
                <span style={{ color: '#EDF2F7' }}>{r.name} — {r.tenant_name}</span>
                <span style={{ color: r.days_left < 0 ? '#EF9A9A' : r.days_left < 30 ? '#FFCC80' : '#F59E0B' }}>
                  {r.days_left < 0 ? `Expired ${Math.abs(r.days_left)}d ago` : `${r.days_left}d left`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* KPI cards */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>YTD NET INCOME</div>
              <div style={{ ...styles.kpiVal, color: totalNOI >= 0 ? '#34A853' : '#EF4444' }}>
                {fmtCurrency(totalNOI, 'INR')}
              </div>
              <div style={styles.kpiSub}>{new Date().getFullYear()} all properties</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>ACTIVE LEASES</div>
              <div style={{ ...styles.kpiVal, color: '#185FA5' }}>{activeCount}</div>
              <div style={styles.kpiSub}>of {dash?.properties?.length || 0} properties</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>TOTAL CLAIMED</div>
              <div style={{ ...styles.kpiVal, color: '#F59E0B' }}>
                {fmtCurrency(totalClaimed, 'INR')}
              </div>
              <div style={styles.kpiSub}>across all leases</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>WRITTEN OFF</div>
              <div style={{ ...styles.kpiVal, color: '#EF4444' }}>
                {fmtCurrency(totalLosses, 'INR')}
              </div>
              <div style={styles.kpiSub}>unrecoverable losses</div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="card-section-label" style={{ color: '#185FA5' }}>RENTAL MANAGEMENT</div>
        <div className="menu-tile">
          {[
            { icon: '📋', title: 'Monthly tracker', sub: 'Enter income & expenses', path: '/owner/rental', arrow: '#34A853' },
            { icon: '📄', title: 'Agreements', sub: 'Tenant & lease details', path: '/owner/rental/agreement', arrow: '#185FA5' },
            { icon: '⚖️', title: 'Claims ledger', sub: 'Damage & loss tracking', path: '/owner/rental/claims', arrow: '#E24B4A' },
            { icon: '📊', title: 'Portfolio dashboard', sub: 'Annual NOI & analytics', path: '/owner/rental/dashboard', arrow: '#8B5CF6' },
          ].map((item, i, arr) => (
            <div key={item.path} className="menu-row"
              onClick={() => navigate(item.path)}
              style={{ borderBottom: i < arr.length - 1 ? undefined : 'none' }}>
              <div className="menu-icon" style={{ background: `${item.arrow}14` }}>{item.icon}</div>
              <div className="menu-label">
                <div className="menu-title">{item.title}</div>
                <div className="menu-sub">{item.sub}</div>
              </div>
              <div className="menu-arrow" style={{ background: item.arrow }}>›</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button className="logout-btn" style={{ flex: 1 }} onClick={logout}>Log out</button>
          <button onClick={() => navigate('/infra/d1')}
            style={{ padding:'12px 16px', borderRadius:'12px', border:'1px solid rgba(24,95,165,0.3)',
              background:'rgba(24,95,165,0.08)', color:'#85B7EB', fontSize:'0.8rem', cursor:'pointer' }}>
            🗄
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  header: { background: '#0D1117', padding: '16px 16px 14px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid rgba(24,95,165,0.25)' },
  headerText: { flex: 1 },
  brandName: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', fontWeight: '600', color: '#85B7EB', letterSpacing: '0.5px' },
  tagline: { fontSize: '0.58rem', color: '#5C7080', letterSpacing: '2px', marginTop: '2px' },
  welcomeBadge: { background: 'rgba(24,95,165,0.12)', border: '1px solid rgba(24,95,165,0.2)', borderRadius: '20px', padding: '4px 12px' },
  welcomeLabel: { color: '#185FA5', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '2px' },
  alertBanner: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' },
  renewalBanner: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' },
  kpiCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px' },
  kpiLabel: { fontSize: '0.62rem', color: '#5C7080', letterSpacing: '1.5px', marginBottom: '6px' },
  kpiVal: { fontSize: '1.4rem', fontWeight: '700', lineHeight: 1 },
  kpiSub: { fontSize: '0.68rem', color: '#5C7080', marginTop: '4px' },
}
