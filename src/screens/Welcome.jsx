import { useNavigate } from 'react-router-dom'

// This gateway pitches the StayVibe PLATFORM, not the tenant currently
// serving this domain — deliberately not CONFIG.brandName/tagline (that's
// this specific villa's own branding, e.g. "Guruvayur Estates"), since a
// prospective host reading "join Guruvayur Estates" would be misled.

// Public landing gateway — shown instead of dropping straight into the PIN
// screen. Three doors: an existing tenant logs in, a prospective host
// registers interest, or a curious visitor asks for a demo. This is the
// SaaS pitch's front door (dwarka.stayvibe360.com doubles as both a real
// tenant's portal and the marketing entry point until there's a dedicated
// marketing domain).
export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div style={styles.container}>
      <div style={styles.bgPattern} />

      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img
            src="/icons/StayVibe360Logo.png"
            alt="StayVibe"
            style={styles.logo}
          />
        </div>

        <div style={styles.goldLine} />
        <p style={styles.tagline}>VILLA MANAGEMENT, SIMPLIFIED</p>

        <button style={{ ...styles.optionBtn, ...styles.primaryBtn }} onClick={() => navigate('/invite')}>
          <span style={styles.optionTitle}>Request Your Invite</span>
          <span style={styles.optionSub}>Join our first group of hosts — 2 min, no commitment</span>
        </button>

        <button style={styles.optionBtn} onClick={() => navigate('/login')}>
          <span style={styles.optionTitle}>Login</span>
          <span style={styles.optionSub}>Existing owner or manager</span>
        </button>

        <button style={styles.optionBtn} onClick={() => navigate('/NewHost')}>
          <span style={styles.optionTitle}>New Host Registration</span>
          <span style={styles.optionSub}>Bring your villa onto StayVibe</span>
        </button>

        <button style={styles.optionBtn} onClick={() => navigate('/demo')}>
          <span style={styles.optionTitle}>Request a Demo</span>
          <span style={styles.optionSub}>See StayVibe in action, no commitment</span>
        </button>
      </div>

      <p style={styles.footer}>
        StayVibe © {new Date().getFullYear()} · All rights reserved
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
