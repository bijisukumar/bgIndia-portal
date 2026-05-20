import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * TopBar — sticky header for Raman and Pradosh screens.
 * Always shows a "Sign off" button top-right so they can log out from any screen.
 * Props:
 *   title    — main heading
 *   sub      — small subtitle (optional)
 *   back     — show a back chevron on the left (default false = home icon)
 *   onBack   — override back action (default: navigate(-1))
 */
export default function TopBar({ title, sub, back = false, onBack }) {
  const { logout } = useAuth()
  const navigate   = useNavigate()

  const handleBack = () => {
    if (onBack) onBack()
    else navigate(-1)
  }

  return (
    <div style={s.bar}>
      {/* Left */}
      <div style={s.left}>
        {back
          ? <button style={s.backBtn} onClick={handleBack}>‹</button>
          : <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🏡</span>
        }
      </div>

      {/* Centre */}
      <div style={s.centre}>
        <div style={s.title}>{title}</div>
        {sub && <div style={s.sub}>{sub}</div>}
      </div>

      {/* Right — sign off */}
      <div style={s.right}>
        <button style={s.signOff} onClick={logout} title="Sign off">
          <span style={{ fontSize: '0.85rem' }}>⏏</span>
          <span style={s.signOffLabel}>SIGN OFF</span>
        </button>
      </div>
    </div>
  )
}

const s = {
  bar: {
    background: '#111111',
    borderBottom: '1px solid rgba(200,144,58,0.2)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  left:   { width: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexShrink: 0 },
  centre: { flex: 1, minWidth: 0, textAlign: 'center' },
  right:  { width: 70, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 },

  backBtn: {
    background: 'rgba(200,144,58,0.1)',
    border: '1px solid rgba(200,144,58,0.25)',
    borderRadius: 8,
    color: '#E8B86D',
    fontSize: '1.4rem',
    width: 34, height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', lineHeight: 1, padding: 0,
  },

  title: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.05rem',
    fontWeight: 600,
    color: '#E8B86D',
    letterSpacing: '0.3px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sub: {
    fontSize: '0.57rem',
    color: '#5C7080',
    letterSpacing: '2px',
    marginTop: 2,
  },

  signOff: {
    background: 'rgba(220,53,53,0.1)',
    border: '1px solid rgba(220,53,53,0.3)',
    borderRadius: 8,
    color: '#E05C5C',
    padding: '5px 7px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
    lineHeight: 1,
  },
  signOffLabel: { fontSize: '0.48rem', letterSpacing: '1px', fontWeight: 700, marginTop: 1 },
}
