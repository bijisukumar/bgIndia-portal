import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CONFIG } from '../../config'
import { api } from '../../api'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'

const STATUS_COLOR = {
  confirmed:          { bg: 'rgba(52,168,83,0.12)',   text: '#34A853', label: 'Confirmed' },
  pending_review:     { bg: 'rgba(200,144,58,0.12)',  text: '#C8903A', label: 'Pending' },
  docs_uploaded:      { bg: 'rgba(24,95,165,0.12)',   text: '#185FA5', label: 'Docs in' },
  ready_for_checkin:  { bg: 'rgba(88,166,255,0.12)',  text: '#58A6FF', label: 'Ready' },
  checked_in:         { bg: 'rgba(15,110,86,0.12)',   text: '#0F6E56', label: 'In-house' },
  ready_for_checkout: { bg: 'rgba(200,144,58,0.12)',  text: '#C8903A', label: 'Checkout' },
}

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function daysUntil(d) {
  if (!d) return null
  return Math.ceil((new Date(d + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 86400000)
}

export default function VillaHub() {
  const navigate = useNavigate()
  const [allUpcoming, setAllUpcoming] = useState([])
  const [days, setDays] = useState(60)
  const [loadingGuests, setLoadingGuests] = useState(true)

  useEffect(() => {
    api.getUpcomingStays(DEFAULT_VILLA_ID)
      .then(res => {
        const all = Array.isArray(res) ? res : (res?.data || [])
        setAllUpcoming(all)
      })
      .catch(() => {})
      .finally(() => setLoadingGuests(false))
  }, [])

  const upcoming = days === 0
    ? allUpcoming
    : allUpcoming.filter(s => {
        if (!s.checkin_date) return false
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() + days)
        return new Date(s.checkin_date + 'T00:00:00') <= cutoff
      })

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate('/')}>‹</button>
        <div>
          <div className="topbar-title">Serviced Villas</div>
          <div className="topbar-sub">OWNER VIEW · {CONFIG.villas.length} PROPERT{CONFIG.villas.length === 1 ? 'Y' : 'IES'}</div>
        </div>
        <div style={{ width: 34 }} />
      </div>

      <div className="screen-body">
        <div className="card-section-label">ACTIVE PROPERTIES</div>

        {CONFIG.villas.map(villa => (
          <div key={villa.id} style={styles.propCard}>
            <div style={styles.propHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Per-villa logo placeholder */}
                {villa.logoUrl ? (
                  <img src={villa.logoUrl} alt={villa.name}
                    style={{ height: 36, width: 36, borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(200,144,58,0.3)' }}
                    onError={e => e.target.style.display = 'none'} />
                ) : (
                  <div style={{ height: 36, width: 36, borderRadius: '8px', background: 'rgba(200,144,58,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🏡</div>
                )}
                <div>
                  <div style={styles.propName}>{villa.full || villa.name}</div>
                  <div style={styles.propLoc}>{villa.location}</div>
                </div>
              </div>
              <span className="tag tag-green">Active</span>
            </div>

            <div style={{ padding: '4px 0' }}>
              {[
                { icon: '📋', bg: 'rgba(52,168,83,0.08)',    arrow: '#34A853', title: 'New booking',       sub: 'Record booking · assign Stay ID · create Drive folder', path: `/owner/villa/booking` },
                { icon: '📨', bg: 'rgba(139,92,246,0.08)',   arrow: '#8B5CF6', title: 'Guest enquiries',   sub: 'Track leads · conversion · repeat guests',              path: `/owner/villa/enquiries` },
                { icon: '🏨', bg: 'rgba(200,144,58,0.08)',   arrow: '#C8903A', title: 'Complete booking', sub: 'Financials · docs · ready for check-in',              path: `/owner/villa/income` },
                { icon: '📊', bg: 'rgba(24,95,165,0.08)',    arrow: '#185FA5', title: 'Dashboard',    sub: 'Revenue · profit · breakdown',                          path: `/owner/villa/dashboard` },
            { icon: '📦', bg: 'rgba(15,110,86,0.08)',    arrow: '#0F6E56', title: 'Inventory',          sub: 'Stock levels · sell prices · restock log',               path: `/owner/villa/inventory` },
                { icon: '🧾', bg: 'rgba(239,68,68,0.08)',    arrow: '#EF4444', title: 'Expenses',      sub: 'Electricity · maintenance · repairs · recurring costs', path: `/owner/villa/expenses` },
                { icon: '🔔', bg: 'rgba(139,92,246,0.08)',   arrow: '#8B5CF6', title: 'Notification settings', sub: 'Owner alert email · per-villa config',                path: `/owner/villa/notifications` },
                { icon: '🔧', bg: 'rgba(92,112,128,0.08)', arrow: '#5C7080', title: 'Maintenance',         sub: 'Schema validation · alert settings · system health',       path: `/owner/maintenance` },
              ].map((row, i, arr) => (
                <div key={row.title}
                  className="menu-row"
                  style={{ padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-dim)' : 'none' }}
                  onClick={() => navigate(row.path)}
                >
                  <div className="menu-icon" style={{ background: row.bg }}>{row.icon}</div>
                  <div className="menu-label">
                    <div className="menu-title">{row.title}</div>
                    <div className="menu-sub">{row.sub}</div>
                  </div>
                  <div className="menu-arrow" style={{ background: row.arrow }}>›</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── UPCOMING GUESTS ─────────────────────────────── */}
        <div style={styles.guestCard}>
          <div style={styles.guestHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem' }}>🗓️</span>
              <span style={styles.guestTitle}>Upcoming Guests</span>
            </div>
            <div style={styles.dayPills}>
              {[30, 60, 90, 120, 0].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  style={{ ...styles.dayPill, ...(days === d ? styles.dayPillActive : {}) }}>
                  {d === 0 ? 'All' : `${d}d`}
                </button>
              ))}
            </div>
          </div>

          {loadingGuests ? (
            <div style={styles.emptyRow}>Loading…</div>
          ) : upcoming.length === 0 ? (
            <div style={styles.emptyRow}>No bookings in the {days === 0 ? 'pipeline' : `next ${days} days`}</div>
          ) : (
            upcoming.map((s, i) => {
              const days   = daysUntil(s.checkin_date)
              const sc     = STATUS_COLOR[s.status] || { bg: 'rgba(92,112,128,0.12)', text: '#5C7080', label: s.status }
              const isLast = i === upcoming.length - 1
              const inHouse = s.status === 'checked_in' || s.status === 'ready_for_checkout'
              return (
                <div key={s.stay_id}
                  style={{ ...styles.guestRow, borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)' }}
                  onClick={() => navigate('/owner/villa/income')}
                >
                  <div style={styles.dateBadge}>
                    <div style={styles.dateDay}>{fmtDate(s.checkin_date).split(' ')[0]}</div>
                    <div style={styles.dateMon}>{fmtDate(s.checkin_date).split(' ')[1]}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.guestName}>{s.guest_name}</div>
                    <div style={styles.guestMeta}>
                      {s.nights} night{s.nights !== 1 ? 's' : ''}
                      {(s.adults || 0) + (s.children || 0) > 0 ? ` · ${(s.adults || 0) + (s.children || 0) === 1 ? '1 guest' : `${(s.adults || 0) + (s.children || 0)} guests`}` : ''}
                      {s.from_city ? ` · ${s.from_city}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                    <span style={{ ...styles.statusPill, background: sc.bg, color: sc.text }}>{sc.label}</span>
                    <span style={styles.daysChip}>
                      {inHouse ? '🏠 In-house' : days === 0 ? 'Today' : days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Add another villa */}
        <div className="card-dashed" onClick={() => {}}>
          <div className="card-dashed-icon">+</div>
          <div className="card-dashed-text">
            <strong>Add another villa / property</strong>
            <span>Onboard a new property — gets its own Stay IDs, logo & tracking</span>
          </div>
        </div>

        <div style={{ background: 'rgba(24,95,165,0.06)', border: '1px solid rgba(24,95,165,0.15)', borderRadius: '10px', padding: '10px 14px', marginTop: '4px' }}>
          <div style={{ color: '#85B7EB', fontSize: '0.75rem', fontWeight: '600' }}>💡 SaaS ready</div>
          <div style={{ color: '#5C7080', fontSize: '0.72rem', marginTop: '2px' }}>
            Each property gets its own logo, branding, and Stay ID sequence. Operators can manage their own villas under their profile.
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  propCard:   { background: '#1E2535', borderRadius: '14px', border: '1px solid rgba(200,144,58,0.2)', overflow: 'hidden', marginBottom: '12px' },
  propHeader: { background: 'rgba(200,144,58,0.06)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(200,144,58,0.15)' },
  propName:   { color: '#E8B86D', fontSize: '1rem', fontWeight: '700', fontFamily: "'Cormorant Garamond',serif" },
  propLoc:    { color: '#5C7080', fontSize: '0.75rem', marginTop: '2px' },

  // Upcoming guests card
  guestCard:   { background: '#1E2535', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: '12px' },
  guestHeader: { background: 'rgba(255,255,255,0.03)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  guestTitle:  { color: '#C9D1D9', fontSize: '0.85rem', fontWeight: '700', letterSpacing: '0.03em' },
  guestSub:    { color: '#5C7080', fontSize: '0.72rem' },
  guestRow:    { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', transition: 'background 0.15s' },
  dateBadge:   { width: '38px', minWidth: '38px', background: 'rgba(200,144,58,0.1)', borderRadius: '8px', padding: '5px 4px', textAlign: 'center', border: '1px solid rgba(200,144,58,0.2)' },
  dateDay:     { color: '#E8B86D', fontSize: '1rem', fontWeight: '700', lineHeight: 1 },
  dateMon:     { color: '#A07840', fontSize: '0.62rem', fontWeight: '600', textTransform: 'uppercase', marginTop: '2px' },
  guestName:   { color: '#C9D1D9', fontSize: '0.88rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  guestMeta:   { color: '#5C7080', fontSize: '0.72rem', marginTop: '2px' },
  statusPill:  { fontSize: '0.65rem', fontWeight: '700', padding: '2px 7px', borderRadius: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' },
  daysChip:    { color: '#8B949E', fontSize: '0.68rem' },
  emptyRow:     { padding: '18px 16px', color: '#5C7080', fontSize: '0.8rem', textAlign: 'center' },
  dayPills:     { display: 'flex', gap: '4px' },
  dayPill:      { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', color: '#8B949E', fontSize: '0.68rem', fontWeight: '600', padding: '3px 7px', cursor: 'pointer' },
  dayPillActive:{ background: 'rgba(200,144,58,0.18)', border: '1px solid rgba(200,144,58,0.4)', color: '#E8B86D' },
}
// cache bust Wed Jun 11 2026 — upcoming guests block
