import { useNavigate } from 'react-router-dom'
import { CONFIG } from '../config'

export default function VillaHub() {
  const navigate = useNavigate()

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
                { icon: '🏨', bg: 'rgba(200,144,58,0.08)',   arrow: '#C8903A', title: 'Villa rental income', sub: 'Bookings · tariffs · commissions',                    path: `/owner/villa/income` },
                { icon: '📊', bg: 'rgba(24,95,165,0.08)',    arrow: '#185FA5', title: 'Villa dashboard',    sub: 'Revenue · profit · breakdown',                          path: `/owner/villa/dashboard` },
              ].map((row, i, arr) => (
                <div key={row.title}
                  className="menu-row"
                  style={{ padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-dim)' : 'none' }}
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
}
