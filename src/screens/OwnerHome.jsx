import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { CONFIG } from '../config'
import { logger } from '../utils/logger'

const SECTIONS = [
  {
    label: 'PEOPLE',
    color: '#8B5CF6',
    rows: [
      {
        id:    'guests',
        icon:  '👥',
        bg:    'rgba(139,92,246,0.08)',
        title: 'Guest Repository',
        sub:   'Contact list · Repeat guests · Marketing segments',
        arrow: '#8B5CF6',
        path:  '/owner/guests',
      },
      {
        id:    'rdashboard',
        icon:  '📊',
        bg:    'rgba(200,144,58,0.08)',
        title: 'R-Dashboard',
        sub:   'RamananKutty commission · Unpaid · History',
        arrow: '#C8903A',
        path:  '/owner/r-dashboard',
      },
    ],
  },
  {
    label: 'VILLAS',
    color: '#C8903A',
    rows: [
      {
        id:    'villa',
        icon:  '🏡',
        bg:    'rgba(200,144,58,0.08)',
        title: 'GVR Villa(s)',
        sub:   'Rental income · Dashboard',
        arrow: '#C8903A',
        path:  '/owner/villa',
      },
    ],
  },
  {
    label: 'RENTAL INCOME',
    color: '#185FA5',
    rows: [
      {
        id:    'rental',
        icon:  '🏢',
        bg:    'rgba(24,95,165,0.08)',
        title: 'Rental properties',
        sub:   '3 properties · Monthly tracker · Dashboard',
        arrow: '#185FA5',
        path:  '/owner/rental',
      },
    ],
  },
  {
    label: 'ESTATES',
    color: '#3B6D11',
    rows: [
      {
        id:    'pollachi',
        icon:  '🌴',
        bg:    'rgba(59,109,17,0.08)',
        title: 'Pollachi estate',
        sub:   'Coconut tracker · Irrigation · Income/Expense',
        arrow: '#3B6D11',
        path:  '/owner/pollachi',
      },
      {
        id:    'pavutumuri',
        icon:  '🌳',
        bg:    'rgba(15,110,86,0.08)',
        title: 'Pavutumuri estate',
        sub:   'Rubber tracker · Income/Expense',
        arrow: '#0F6E56',
        path:  '/owner/pavutumuri',
      },
    ],
  },
]

export default function OwnerHome() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="screen">
      {/* Header */}
      <div style={styles.header}>
        <img src="/icons/logo-black.png" alt="GE" style={styles.logo}
          onError={e => e.target.style.display = 'none'} />
        <div style={styles.headerText}>
          <div style={styles.brandName}>{CONFIG.brandName}</div>
          <div style={styles.tagline}>{CONFIG.tagline.toUpperCase()}</div>
        </div>
        <div style={styles.welcomeBadge}>
          <span style={styles.welcomeLabel}>OWNER</span>
        </div>
      </div>

      <div className="screen-body">
        {SECTIONS.map(section => (
          <div key={section.label}>
            <div className="card-section-label">{section.label}</div>
            <div className="menu-tile">
              {section.rows.map((row, i) => (
                <div
                  key={row.id}
                  className="menu-row"
                  onClick={() => navigate(row.path)}
                  style={i < section.rows.length - 1 ? {} : { borderBottom: 'none' }}
                >
                  <div className="menu-icon" style={{ background: row.bg }}>
                    {row.icon}
                  </div>
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

        <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
          <button className="logout-btn" style={{flex:1}} onClick={logout}>Log out</button>
          <button onClick={() => navigate('/debug')} style={{padding:'12px 16px',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.06)',background:'transparent',color:'var(--text-dim)',fontSize:'0.8rem',cursor:'pointer'}}>🔧</button>
        </div>
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
    letterSpacing: '0.5px',
  },
  tagline: {
    fontSize: '0.6rem',
    color: '#5C7080',
    letterSpacing: '2px',
    marginTop: '2px',
  },
  welcomeBadge: {
    background: 'rgba(200,144,58,0.12)',
    border: '1px solid rgba(200,144,58,0.2)',
    borderRadius: '20px',
    padding: '4px 12px',
  },
  welcomeLabel: {
    color: '#C8903A',
    fontSize: '0.65rem',
    fontWeight: '700',
    letterSpacing: '2px',
  },
}
