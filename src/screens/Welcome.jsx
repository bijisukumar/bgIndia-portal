import { useNavigate } from 'react-router-dom'
import { isAcquisitionHost } from '../utils/hostContext'

// This gateway pitches the StayVibe PLATFORM, not the tenant currently
// serving this domain — deliberately not CONFIG.brandName/tagline (that's
// this specific villa's own branding, e.g. "Guruvayur Estates"), since a
// prospective host reading "join Guruvayur Estates" would be misled.

// Public landing gateway — shown instead of dropping straight into the PIN
// screen. Two doors: a prospective host registers, or an existing owner or
// manager logs in. On a non-acquisition host (a tenant's own portal) the
// registration door is hidden and login is all that remains.
//
// It used to carry four. "Request Your Invite" did nothing but `location.href`
// to www.stayvibe360.com/#invite — two doors onto one form, and this was the
// worse one, since the form and all its copy live on the marketing site.
// "Request a Demo" was removed to move that ask onto www. as well, next to the
// invite form: the same prospect was otherwise being captured in two places
// and landing in two different tables. The /demo route still exists and still
// works by direct link; nothing here points at it.
export default function Welcome() {
  const navigate = useNavigate()
  const acquisition = isAcquisitionHost()

  return (
    <div style={styles.container}>
      <div style={styles.bgPattern} />

      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img
            src="/icons/StayVibe360Logo.png"
            alt="StayVibe360"
            style={styles.logo}
          />
        </div>

        <div style={styles.goldLine} />
        <p style={styles.tagline}>VILLA MANAGEMENT, SIMPLIFIED</p>

        {acquisition && (
          <button style={{ ...styles.optionBtn, ...styles.primaryBtn }} onClick={() => navigate('/NewHost')}>
            <span style={styles.optionTitle}>New Host Registration</span>
            <span style={styles.optionSub}>Bring your villa onto StayVibe360</span>
          </button>
        )}

        <button style={acquisition ? styles.optionBtn : { ...styles.optionBtn, ...styles.primaryBtn }} onClick={() => navigate('/login')}>
          <span style={styles.optionTitle}>Login</span>
          <span style={styles.optionSub}>Existing owner or manager</span>
        </button>
      </div>

      <p style={styles.footer}>
        StayVibe360 © {new Date().getFullYear()} · All rights reserved
      </p>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#111111',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
  },
  bgPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `radial-gradient(circle at 20% 80%, rgba(200,144,58,0.06) 0%, transparent 50%),
                      radial-gradient(circle at 80% 20%, rgba(200,144,58,0.04) 0%, transparent 40%)`,
    pointerEvents: 'none',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    background: '#1E2535',
    borderRadius: '20px',
    padding: '36px 28px',
    border: '1px solid rgba(200,144,58,0.2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
    position: 'relative',
    zIndex: 1,
  },
  logoWrap: {
    marginBottom: '20px',
    borderRadius: '16px',
    overflow: 'hidden',
    border: '1px solid rgba(200,144,58,0.3)',
    boxShadow: '0 8px 32px rgba(200,144,58,0.2)',
    background: '#000000',
  },
  logo: { height: '120px', width: '120px', objectFit: 'cover', display: 'block' },
  goldLine: { width: '48px', height: '2px', background: '#C8903A', borderRadius: '2px', marginBottom: '12px' },
  tagline: { fontSize: '0.65rem', color: '#5C7080', letterSpacing: '3px', marginBottom: '28px', textAlign: 'center' },
  optionBtn: {
    width: '100%',
    textAlign: 'left',
    padding: '16px 18px',
    marginBottom: '12px',
    borderRadius: '12px',
    background: '#141820',
    border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    fontFamily: 'DM Sans, sans-serif',
  },
  primaryBtn: {
    background: 'rgba(200,144,58,0.1)',
    border: '1px solid rgba(200,144,58,0.4)',
  },
  optionTitle: { fontSize: '0.95rem', fontWeight: 700, color: '#fff' },
  optionSub: { fontSize: '0.72rem', color: '#8A9BAE' },
  footer: { position: 'absolute', bottom: '20px', fontSize: '0.7rem', color: '#3D4A5C', zIndex: 1 },
}
