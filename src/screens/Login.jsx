import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { CONFIG } from '../config'

export default function Login() {
  const { login }     = useAuth()
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState('')
  const [shake, setShake]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [locked, setLocked]   = useState(false)   // rate limited
  const [retryMins, setRetryMins] = useState(15)

  const handleLogin = async () => {
    if (!pin || loading || locked) return
    setLoading(true)
    setError('')

    const result = await login(pin)
    setLoading(false)

    if (result.ok) return // AuthProvider sets user, App re-renders to correct screen

    if (result.reason === 'rate_limited') {
      setLocked(true)
      setRetryMins(result.retryAfter || 15)
      setError(`Too many attempts. Try again in ${result.retryAfter || 15} minutes.`)
    } else {
      setError('Invalid PIN. Please try again.')
      setShake(true)
      setPin('')
      setTimeout(() => setShake(false), 600)
    }
  }

  return (
    <div style={styles.container}>
      {/* Background texture */}
      <div style={styles.bgPattern} />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <img
            src="/icons/logo-black.png"
            alt="Guruvayur Estates"
            style={styles.logo}
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>

        <div style={styles.goldLine} />

        <p style={styles.tagline}>{CONFIG.tagline.toUpperCase()}</p>

        {/* PIN input */}
        <p style={styles.pinLabel}>ENTER YOUR PIN</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={e => { setPin(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          maxLength={6}
          placeholder="••••"
          autoFocus
          disabled={loading || locked}
          style={{
            ...styles.pinInput,
            ...(shake ? styles.shake : {}),
            ...(error ? styles.pinInputError : {}),
            ...(loading || locked ? { opacity: 0.5 } : {}),
          }}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button
          style={{
            ...styles.loginBtn,
            ...(loading || locked ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
          }}
          onClick={handleLogin}
          disabled={loading || locked}
        >
          {loading ? 'CHECKING…' : locked ? `LOCKED · ${retryMins}m` : 'ENTER'}
        </button>
      </div>

      <p style={styles.footer}>
        {CONFIG.brandName} © {new Date().getFullYear()} · All rights reserved
      </p>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
        .shake { animation: shake 0.5s ease; }
      `}</style>
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
    maxWidth: '360px',
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
  },
  logo: {
    height: '160px',
    width: '160px',
    objectFit: 'cover',
    display: 'block',
  },
  goldLine: {
    width: '48px',
    height: '2px',
    background: '#C8903A',
    borderRadius: '2px',
    marginBottom: '12px',
  },
  tagline: {
    fontSize: '0.65rem',
    color: '#5C7080',
    letterSpacing: '3px',
    marginBottom: '28px',
    textAlign: 'center',
  },
  pinLabel: {
    fontSize: '0.65rem',
    color: '#8A9BAE',
    letterSpacing: '3px',
    marginBottom: '12px',
  },
  pinInput: {
    width: '100%',
    background: '#141820',
    border: '1px solid rgba(200,144,58,0.3)',
    borderRadius: '10px',
    padding: '14px 16px',
    fontSize: '1.6rem',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: '8px',
    outline: 'none',
    marginBottom: '8px',
    fontFamily: 'DM Sans, sans-serif',
    transition: 'border-color 0.2s',
  },
  pinInputError: {
    borderColor: 'rgba(229,57,53,0.5)',
  },
  shake: {
    animation: 'shake 0.5s ease',
  },
  error: {
    color: '#EF9A9A',
    fontSize: '0.8rem',
    marginBottom: '8px',
    textAlign: 'center',
  },
  loginBtn: {
    width: '100%',
    marginTop: '8px',
    padding: '14px',
    background: '#C8903A',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: '700',
    letterSpacing: '2px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    transition: 'opacity 0.2s',
  },
  footer: {
    position: 'absolute',
    bottom: '20px',
    fontSize: '0.7rem',
    color: '#3D4A5C',
    zIndex: 1,
  },
}
