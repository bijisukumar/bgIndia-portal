import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { CONFIG } from '../config'

export default function PradoshHome() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const rows = [
    {
      icon: '🌴', bg: 'rgba(59,109,17,0.08)', arrow: '#3B6D11',
      title: 'Irrigation log', sub: 'Daily zone tracking',
      action: () => window.open('https://docs.google.com/forms/d/e/1FAIpQLSep04wSbC-NThiPvnREMzm4-ICShVtQ_Po1vE1zf2b5Z98buQ/viewform', '_blank'),
    },
    {
      icon: '🌿', bg: 'rgba(59,109,17,0.08)', arrow: '#3B6D11',
      title: 'Income / expense', sub: 'Monthly ledger',
      action: () => navigate('/pollachi/ledger'),
    },
    {
      icon: '🥥', bg: 'rgba(59,109,17,0.08)', arrow: '#3B6D11',
      title: 'Coconut tracker', sub: 'Harvest · count · weight · revenue',
      action: () => navigate('/pollachi/coconut'),
    },
    {
      icon: '📊', bg: 'rgba(59,109,17,0.08)', arrow: '#3B6D11',
      title: 'Pollachi dashboard', sub: 'Harvest history · income · expenses',
      action: () => navigate('/pollachi/dashboard'),
    },
  ]

  return (
    <div className="screen">
      <div style={styles.header}>
        <img src="/icons/logo-black.png" alt="GE" style={styles.logo}
          onError={e => e.target.style.display = 'none'} />
        <div style={styles.headerText}>
          <div style={styles.brandName}>{CONFIG.brandName}</div>
          <div style={styles.tagline}>PROPERTY MANAGEMENT PORTAL</div>
        </div>
        <div style={styles.welcomeBadge}>
          <span style={styles.welcomeLabel}>PRADOSH</span>
        </div>
      </div>

      <div className="screen-body">
        <div className="card-section-label">POLLACHI COCONUT ESTATE</div>

        <div style={styles.estateCard}>
          <div style={styles.estateHeader}>
            <span style={styles.estateName}>Pollachi Estate</span>
            <span style={styles.estateTag}>Active</span>
          </div>
          <div className="menu-tile" style={{ marginBottom: 0, borderRadius: 0, border: 'none', background: 'transparent' }}>
            {rows.map((row, i) => (
              <div
                key={i}
                className="menu-row"
                onClick={row.action}
                style={i === rows.length - 1 ? { borderBottom: 'none' } : {}}
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

        {/* Quick stats strip */}
        <div className="card-section-label" style={{ marginTop: 20 }}>QUICK INFO</div>
        <div style={styles.infoStrip}>
          <div style={styles.infoItem}>
            <div style={styles.infoVal}>~45 days</div>
            <div style={styles.infoLabel}>Next harvest</div>
          </div>
          <div style={styles.infoDivider} />
          <div style={styles.infoItem}>
            <div style={styles.infoVal}>₹1.50</div>
            <div style={styles.infoLabel}>Dehusk rate</div>
          </div>
          <div style={styles.infoDivider} />
          <div style={styles.infoItem}>
            <div style={styles.infoVal}>₹28/kg</div>
            <div style={styles.infoLabel}>Last price</div>
          </div>
        </div>

        <button className="logout-btn" onClick={logout}>Log out</button>
      </div>
    </div>
  )
}

const styles = {
  header: {
    background: '#111111',
    padding: '16px 16px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    borderBottom: '1px solid rgba(200,144,58,0.18)',
  },
  logo: {
    height: '52px',
    width: '52px',
    borderRadius: '10px',
    objectFit: 'cover',
    border: '1px solid rgba(200,144,58,0.3)',
    boxShadow: '0 4px 12px rgba(200,144,58,0.15)',
  },
  headerText: { flex: 1 },
  brandName: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.15rem',
    fontWeight: '600',
    color: '#E8B86D',
  },
  tagline: {
    fontSize: '0.6rem',
    color: '#5C7080',
    letterSpacing: '2px',
    marginTop: '2px',
  },
  welcomeBadge: {
    background: 'rgba(59,109,17,0.12)',
    border: '1px solid rgba(59,109,17,0.3)',
    borderRadius: '20px',
    padding: '4px 12px',
  },
  welcomeLabel: {
    color: '#81C995',
    fontSize: '0.65rem',
    fontWeight: '700',
    letterSpacing: '2px',
  },
  estateCard: {
    background: '#1E2535',
    borderRadius: '14px',
    border: '1px solid rgba(59,109,17,0.2)',
    overflow: 'hidden',
    marginBottom: '4px',
  },
  estateHeader: {
    background: 'rgba(59,109,17,0.08)',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(59,109,17,0.15)',
  },
  estateName: { color: '#81C995', fontSize: '0.85rem', fontWeight: '700' },
  estateTag: {
    fontSize: '0.7rem',
    padding: '2px 10px',
    borderRadius: '10px',
    background: 'rgba(52,168,83,0.15)',
    color: '#81C995',
    fontWeight: '700',
  },
  infoStrip: {
    background: '#1E2535',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
  },
  infoItem: { flex: 1, textAlign: 'center' },
  infoVal: { color: '#C8903A', fontSize: '1rem', fontWeight: '700' },
  infoLabel: { color: '#5C7080', fontSize: '0.7rem', marginTop: '2px' },
  infoDivider: { width: '1px', height: '36px', background: 'rgba(255,255,255,0.06)' },
}
