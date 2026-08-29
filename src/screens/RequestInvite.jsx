import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

// "Request Your Invite" — the top of the soft-launch funnel. Deliberately
// short (backend: platform_invite_requests / submitInviteRequest) since this
// is screening, not onboarding: only enough to pick a diverse first batch of
// hosts and set up the 20-min demo call. Full intake happens on that call via
// NewHostRegistration if they're selected.
const PROPERTY_TYPES = ['Villa', 'Apartment / Serviced Apt', 'Homestay', 'Boutique Hotel', 'Farm Stay', 'Other']
const CHANNELS = ['Airbnb', 'Booking.com', 'MakeMyTrip', 'Agoda', 'Direct', 'Other']
const INTERESTS = [
  'P&L transparency',
  'More direct bookings / less OTA commission',
  'Guest experience & reviews',
  'Automating repetitive work',
  'Something else',
]
const EMPTY = {
  name: '', whatsapp: '', email: '',
  propertyName: '', location: '', propertyCount: '',
  propertyType: '', channels: [], airbnbLink: '',
  foreignGuests: '', onboard3m: '', interests: [],
  callSlot: '', notes: '',
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer',
        border: active ? '1px solid #C8903A' : '1px solid rgba(255,255,255,0.12)',
        background: active ? 'rgba(200,144,58,0.18)' : '#141820',
        color: active ? '#E8B86D' : '#9AA5B4', fontFamily: 'DM Sans, sans-serif',
      }}>
      {label}
    </button>
  )
}

export default function RequestInvite() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggle = (k, v) => setForm(f => ({
    ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v],
  }))

  const submit = async () => {
    if (!form.name.trim())     { setError('Please enter your name'); return }
    if (!form.whatsapp.trim()) { setError('A WhatsApp number is required so we can reach you'); return }
    setBusy(true); setError('')
    try {
      await api.submitInviteRequest(form)
      setDone(true)
    } catch (e) {
      setError(e?.message || 'Something went wrong — please try again')
    } finally {
      setBusy(false)
    }
  }

  if (done) return (
    <div style={styles.container}>
      <div style={{ ...styles.card, textAlign: 'center', padding: '40px 28px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🙏</div>
        <div style={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem', marginBottom: '8px' }}>You're on the list!</div>
        <div style={{ fontSize: '0.88rem', color: '#8A9BAE', lineHeight: 1.6, marginBottom: '20px' }}>
          Thanks, {form.name.split(' ')[0]}. We're picking a small first group of hosts for a quick 20-minute call —
          we'll reach out on WhatsApp shortly to set up a time.
        </div>
        <button style={styles.submitBtn} onClick={() => navigate('/')}>Back to home</button>
      </div>
    </div>
  )

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button style={styles.back} onClick={() => navigate('/')}>‹ Back</button>
        <h1 style={styles.title}>Request Your Invite</h1>
        <p style={styles.sub}>
          We're bringing on a small first group of Airbnb/OTA hosts to try StayVibe — automation, P&amp;L
          transparency, OTA-to-direct conversion tracking, and a lot less manual work. Takes two minutes;
          we'll follow up to set up a 20-minute demo call.
        </p>

        <label style={styles.label}>Your name *</label>
        <input style={styles.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name" autoFocus />

        <label style={styles.label}>WhatsApp number *</label>
        <input style={styles.input} value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="+91 …" inputMode="tel" />

        <label style={styles.label}>Email (optional)</label>
        <input style={styles.input} value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" type="email" />

        <label style={styles.label}>Property name</label>
        <input style={styles.input} value={form.propertyName} onChange={e => set('propertyName', e.target.value)} placeholder="e.g. Sunset Villa" />

        <label style={styles.label}>Location</label>
        <input style={styles.input} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Alibaug, Maharashtra" />

        <label style={styles.label}>How many properties do you host?</label>
        <input style={styles.input} value={form.propertyCount} onChange={e => set('propertyCount', e.target.value)} placeholder="e.g. 1" inputMode="numeric" />

        <label style={styles.label}>Property type</label>
        <div style={styles.chipRow}>
          {PROPERTY_TYPES.map(t => (
            <Chip key={t} label={t} active={form.propertyType === t} onClick={() => set('propertyType', form.propertyType === t ? '' : t)} />
          ))}
        </div>

        <label style={styles.label}>Where do you currently host? (select all that apply)</label>
        <div style={styles.chipRow}>
          {CHANNELS.map(c => (
            <Chip key={c} label={c} active={form.channels.includes(c)} onClick={() => toggle('channels', c)} />
          ))}
        </div>

        <label style={styles.label}>Airbnb listing link (if you have one)</label>
        <input style={styles.input} value={form.airbnbLink} onChange={e => set('airbnbLink', e.target.value)} placeholder="airbnb.co.in/rooms/…" />

        <label style={styles.label}>Do you host foreign guests?</label>
        <div style={styles.chipRow}>
          {['Rarely', 'Sometimes', 'Often'].map(o => (
            <Chip key={o} label={o} active={form.foreignGuests === o} onClick={() => set('foreignGuests', form.foreignGuests === o ? '' : o)} />
          ))}
        </div>

        <label style={styles.label}>What would help you most? (select all that apply)</label>
        <div style={styles.chipRow}>
          {INTERESTS.map(i => (
            <Chip key={i} label={i} active={form.interests.includes(i)} onClick={() => toggle('interests', i)} />
          ))}
        </div>

        <label style={styles.label}>Ready to onboard in the next 3 months?</label>
        <div style={styles.chipRow}>
          {['Yes', 'Maybe', 'Not yet'].map(o => (
            <Chip key={o} label={o} active={form.onboard3m === o} onClick={() => set('onboard3m', form.onboard3m === o ? '' : o)} />
          ))}
        </div>

        <label style={styles.label}>Best day/time for a quick call</label>
        <input style={styles.input} value={form.callSlot} onChange={e => set('callSlot', e.target.value)} placeholder="e.g. Weekday evenings" />

        <label style={styles.label}>Anything else? (optional)</label>
        <textarea style={{ ...styles.input, minHeight: '70px', resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Current pain points, questions, etc." />

        {error && <p style={styles.error}>{error}</p>}

        <button style={{ ...styles.submitBtn, ...(busy ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }} onClick={submit} disabled={busy}>
          {busy ? 'Sending…' : 'Request My Invite'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#111111', display: 'flex', justifyContent: 'center', padding: '24px 16px' },
  card: { width: '100%', maxWidth: '460px', background: '#1E2535', borderRadius: '20px', padding: '28px', border: '1px solid rgba(200,144,58,0.2)', fontFamily: 'DM Sans, sans-serif', height: 'fit-content' },
  back: { background: 'none', border: 'none', color: '#8A9BAE', fontSize: '0.85rem', cursor: 'pointer', padding: 0, marginBottom: '16px' },
  title: { color: '#fff', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 6px' },
  sub: { color: '#8A9BAE', fontSize: '0.82rem', lineHeight: 1.5, margin: '0 0 20px' },
  label: { display: 'block', fontSize: '0.65rem', color: '#8A9BAE', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px', marginTop: '14px' },
  input: { width: '100%', background: '#141820', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', fontSize: '0.9rem', color: '#fff', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  error: { color: '#EF9A9A', fontSize: '0.8rem', marginTop: '12px' },
  submitBtn: { width: '100%', marginTop: '22px', padding: '14px', background: '#C8903A', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '1px', cursor: 'pointer' },
}
