// ============================================================
//  REV360 HOME — Passive Rental Income only
//  Serves: rev360.luxuryvillasofguruvayur.com
// ============================================================
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { CONFIG } from '../config'

export default function Rev360Home() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="screen">
      <div style={styles.header}>
        <img src="/icons/logo-black.png" alt="GE" style={styles.logo}
          onError={e => e.target.style.display = 'none'} />
        <div style={styles.headerText}>
          <div style={styles.brandName}>{CONFIG.brandName}</div>
          <div style={styles.tagline}>REV360 — RENTAL MANAGEMENT</div>
        </div>
        <div style={styles.welcomeBadge}>
          <span style={styles.welcomeLabel}>OWNER</span>
        </div>
      </div>

      <div className="screen-body">
        <div className="card-section-label" style={{ color: '#185FA5' }}>
          PASSIVE RENTAL INCOME
        </div>
        <div className="menu-tile">
          <div
            className="menu-row"
            onClick={() => navigate('/owner/rental')}
            style={{ borderBottom: 'none' }}
          >
            <div className="menu-icon" style={{ background: 'rgba(24,95,165,0.08)' }}>🏢</div>
            <div className="menu-label">
              <div className="menu-title">Passive rental income</div>
              <div className="menu-sub">Monthly tracker · Dashboard · Renewal alerts</div>
            </div>
            <div className="menu-arrow" style={{ background: '#185FA5' }}>›</div>
          </div>
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
  header: { background: '#111111', padding: '16px 16px 14px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid rgba(24,95,165,0.25)' },
  logo:   { height: '52px', width: '52px', borderRadius: '10px', objectFit: 'cover', border: '1px solid rgba(24,95,165,0.3)', boxShadow: '0 4px 12px rgba(24,95,165,0.15)' },
  headerText: { flex: 1 },
  brandName:  { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: '600', color: '#85B7EB', letterSpacing: '0.5px' },
  tagline:    { fontSize: '0.6rem', color: '#5C7080', letterSpacing: '2px', marginTop: '2px' },
  welcomeBadge: { background: 'rgba(24,95,165,0.12)', border: '1px solid rgba(24,95,165,0.2)', borderRadius: '20px', padding: '4px 12px' },
  welcomeLabel: { color: '#185FA5', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '2px' },
}
