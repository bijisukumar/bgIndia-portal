import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function RequestDemo() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim()) { setError('Please enter your name'); return }
    if (!form.phone.trim() && !form.email.trim()) { setError('Please share a phone number or email so we can reach you'); return }
    setBusy(true); setError('')
    try {
      await api.submitDemoRequest(form)
      setDone(true)
    } catch (e) {
      setError(e?.message || 'Something went wrong — please try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button style={styles.back} onClick={() => navigate('/')}>‹ Back</button>
        <h1 style={styles.title}>Request a Demo</h1>
        <p style={styles.sub}>See how StayVibe360 runs a villa's bookings, check-ins and P&amp;L in one place. No commitment.</p>

        {done ? (
          <div style={styles.doneBox}>
            <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>🙏</div>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Thank you!</div>
            <div style={{ fontSize: '0.85rem', color: '#8A9BAE' }}>We'll reach out shortly to set up a walkthrough.</div>
          </div>
        ) : (
          <>
            <label style={styles.label}>Name</label>
            <input style={styles.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name" autoFocus />

            <label style={styles.label}>Phone</label>
            <input style={styles.input} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 …" inputMode="tel" />

            <label style={styles.label}>Email</label>
            <input style={styles.input} value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" type="email" />

            <label style={styles.label}>Anything you'd like us to know? (optional)</label>
            <textarea style={{ ...styles.input, minHeight: '70px', resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Number of properties, current tools you use, etc." />

            {error && <p style={styles.error}>{error}</p>}

            <button style={{ ...styles.submitBtn, ...(busy ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }} onClick={submit} disabled={busy}>
              {busy ? 'Sending…' : 'Request Demo'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  card: { width: '100%', maxWidth: '420px', background: '#1E2535', borderRadius: '20px', padding: '28px', border: '1px solid rgba(200,144,58,0.2)', fontFamily: 'DM Sans, sans-serif' },
  back: { background: 'none', border: 'none', color: '#8A9BAE', fontSize: '0.85rem', cursor: 'pointer', padding: 0, marginBottom: '16px' },
  title: { color: '#fff', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 6px' },
  sub: { color: '#8A9BAE', fontSize: '0.82rem', lineHeight: 1.5, margin: '0 0 20px' },
  label: { display: 'block', fontSize: '0.65rem', color: '#8A9BAE', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px', marginTop: '14px' },
  input: { width: '100%', background: '#141820', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', fontSize: '0.9rem', color: '#fff', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' },
  error: { color: '#EF9A9A', fontSize: '0.8rem', marginTop: '12px' },
  submitBtn: { width: '100%', marginTop: '22px', padding: '14px', background: '#C8903A', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '1px', cursor: 'pointer' },
  doneBox: { textAlign: 'center', padding: '24px 8px' },
}
