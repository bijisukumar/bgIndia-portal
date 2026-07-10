import { useAuth } from '../hooks/useAuth'

// Shown when a logged-in user's role isn't allowed into the app they've
// landed on (e.g. a tenant manager PIN used on the master-owner-only
// manage.* console, or a role this per-host app doesn't have a route
// block for at all). Replaces silently redirecting to "/" with no
// matching route, which just loops.
export default function AccessDenied() {
  const { logout } = useAuth()
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>🔒</div>
        <p style={styles.title}>Access denied</p>
        <p style={styles.body}>You don't have permission to view this application.</p>
        <button style={styles.btn} onClick={logout}>Sign off</button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#111111',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '360px',
    background: '#1E2535',
    borderRadius: '20px',
    padding: '32px 24px',
    border: '1px solid rgba(200,144,58,0.2)',
    boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
    textAlign: 'center',
  },
  icon: { fontSize: '2rem', marginBottom: '12px' },
  title: { fontSize: '1rem', fontWeight: '700', color: '#F0F0F0', marginBottom: '8px' },
  body: { fontSize: '0.85rem', color: '#8A9BAE', marginBottom: '20px', lineHeight: 1.5 },
  btn: {
    width: '100%',
    padding: '12px',
    background: '#C8903A',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: '700',
    letterSpacing: '1px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
}
