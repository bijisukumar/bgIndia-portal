import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

// New Host Registration — the intake form from docs/ONBOARDING.md section A.
// Submitting this does NOT provision anything (no new deployment, no new
// DB) — onboarding a real host is still the manual checklist in
// ONBOARDING.md section B. This form just captures everything that
// checklist needs up front, saved to platform_host_registrations for the
// team to work from instead of re-asking the host on a call.
// Defaults to StayVibe's own gold theme color — same value used throughout
// the rest of the app (var(--gold) / #C8903A) — but stays fully editable;
// a host with their own brand color just types over it.
const EMPTY = {
  brandName: '', shortName: '', tagline: '', brandColor: '#C8903A', customDomains: '',
  ownerName: '', ownerEmail: '', ownerWhatsapp: '',
  villaCode: '', villaDisplayName: '', villaFullName: '', address: '', mapsLink: '',
  bedrooms: '', bedTypeNote: '', checkinTime: '16:00', checkoutTime: '11:00', maxGuests: '',
  rateCardNotes: '', cleaningFee: '', extraChargeMenuNotes: '', bookingChannelsNotes: '',
  staffNotes: '', expenseCategoriesNotes: '', breakfastRate: '', additionalGuestRate: '',
  channelEmail: '', driveFolderNote: '', notes: '',
}

// Field-by-field guide with real example values — surfaced behind a "Help"
// toggle rather than as permanent on-page hints, since a full explanation
// for all ~28 fields would overwhelm the form itself. Integrations gets the
// most explanation deliberately: it's the section most likely to confuse
// whoever's filling this in (a host, or someone helping them) since it
// asks for infrastructure details, not villa details.
const HELP = [
  { section: 'Business', items: [
    ['Brand / business name', 'Your company or hosting brand — not the villa itself.', '"Guruvayur Estates"'],
    ['Short name', 'A short version used where space is tight.', '"GVR"'],
    ['Tagline', 'One line describing your hospitality style.', '"Your home away from home"'],
    ['Brand color', 'Sets your portal\'s accent color. Pre-filled with our default gold — change it to match your own brand, or leave it as-is.', '#C8903A'],
    ['Custom domain(s) you own', 'A domain you already own that you\'d like your portal reachable at, if any. Not required — we can also set you up on a stayvibe360.com subdomain.', '"portal.guruvayurestates.com"'],
    ['Owner name / email / WhatsApp', 'You — the person we\'ll set up as the account owner and reach out to.', '"Biji Sukumar", "biji@example.com", "+91 99999 00000"'],
  ]},
  { section: 'Property', items: [
    ['Villa code', 'A short internal code for this property — becomes part of internal URLs and logins. Lowercase, no spaces.', '"dwarka"'],
    ['Display name / Full marketing name', 'What guests see. Display name is short, full name is what you\'d put on a listing.', '"Sunset Villa" / "Sunset Villa (Alibaug)"'],
    ['Address / Google Maps link', 'Where the property actually is.', '"123 Beach Rd, Alibaug, Maharashtra"'],
    ['Bedrooms / Bed type notes / Max guests', 'How big the property is and how it sleeps guests.', '4 bedrooms, "2 king, 1 twin, 1 floor bed available", 12 guests'],
    ['Check-in / Check-out time', 'Your standard policy times — individual bookings can still request early/late.', '16:00 / 11:00'],
    ['Rate card', 'What you charge per night, by guest count or season — however you currently price it. One line per band, plain text is fine.', '"2 guests — ₹6,000/night" / "6 guests — ₹9,500/night"'],
    ['Cleaning fee', 'A flat fee charged per stay, if you have one.', '₹1,500'],
    ['Extra-charge menu', 'Add-ons guests can be charged for beyond the room rate.', '"Early check-in — ₹500" / "Floor bed — ₹750" / "Airport pickup — ₹1,200"'],
    ['Booking channels used', 'Where your bookings come from today, and what commission each one takes.', '"Airbnb — 3%" / "Booking.com — 15%" / "Direct — 0%"'],
  ]},
  { section: 'Operations', items: [
    ['Manager / staff', 'Anyone who works on-site — check-in/check-out, housekeeping, etc. — and how they\'re paid.', '"Raman — property manager — ₹1,000/night commission"'],
    ['Expense categories', 'How you like to bucket costs (electricity, repairs, etc.). Leave blank and we\'ll use sensible defaults.', '"Electricity, Water, Maintenance, Staff salaries"'],
    ['Breakfast rate / Additional-guest rate', 'Per-person or per-night charges if you offer these.', '₹275/person/day, ₹750/night'],
  ]},
  { section: 'Integrations — why we ask', items: [
    ['Gmail address for channel emails', 'Villas booked via Airbnb/Booking.com/etc. get reservation confirmation emails. We read that inbox automatically so new bookings show up in your portal without you re-typing them — this doesn\'t require your Gmail password, just the address so we can set up the connection with you.', '"reservations@guruvayurestates.com"'],
    ['Google Drive folder for guest docs', 'We store each guest\'s ID/registration documents in a Drive folder, organized by month and guest name. If you already use a specific Drive folder for this, tell us — otherwise we create one for you.', '"already have one" or leave blank'],
    ['Anything else', 'Anything about your setup we haven\'t asked about — a quirky policy, an existing tool you use, a specific concern.', '—'],
  ]},
]

function HelpPanel({ onClose }) {
  return (
    <div style={styles.helpPanel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>What does each field mean?</div>
        <button onClick={onClose} style={styles.helpClose}>✕</button>
      </div>
      <p style={{ color: '#8A9BAE', fontSize: '0.78rem', lineHeight: 1.5, marginBottom: '16px' }}>
        A quick guide with example values for every field below — especially useful for the Integrations section, which asks about infrastructure rather than the villa itself.
      </p>
      {HELP.map(sec => (
        <div key={sec.section} style={{ marginBottom: '16px' }}>
          <div style={{ color: 'var(--gold, #C8903A)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>{sec.section}</div>
          {sec.items.map(([label, desc, example]) => (
            <div key={label} style={{ marginBottom: '10px' }}>
              <div style={{ color: '#EDF2F7', fontSize: '0.8rem', fontWeight: 600 }}>{label}</div>
              <div style={{ color: '#9AA5B4', fontSize: '0.75rem', lineHeight: 1.4, margin: '2px 0' }}>{desc}</div>
              <div style={{ color: '#5FD0AE', fontSize: '0.73rem' }}>e.g. {example}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={styles.label}>{label}</label>
      {hint && <div style={styles.hint}>{hint}</div>}
      {children}
    </div>
  )
}

function Section({ n, title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHead}><span style={styles.sectionNum}>{n}</span>{title}</div>
      {children}
    </div>
  )
}

export default function NewHostRegistration() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inp = (k, props = {}) => (
    <input style={styles.input} value={form[k]} onChange={e => set(k, e.target.value)} {...props} />
  )
  const ta = (k, props = {}) => (
    <textarea style={{ ...styles.input, minHeight: '70px', resize: 'vertical' }} value={form[k]} onChange={e => set(k, e.target.value)} {...props} />
  )

  const submit = async () => {
    if (!form.brandName.trim() || !form.ownerName.trim() || !form.ownerEmail.trim()) {
      setError('Brand name, owner name and owner email are required — everything else can come later')
      return
    }
    setBusy(true); setError('')
    try {
      await api.submitHostRegistration(form)
      setDone(true)
    } catch (e) {
      setError(e?.message || 'Something went wrong — please try again')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, textAlign: 'center', padding: '40px 28px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏡</div>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem', marginBottom: '8px' }}>Registration received!</div>
          <div style={{ fontSize: '0.88rem', color: '#8A9BAE', lineHeight: 1.5, marginBottom: '20px' }}>
            Thank you for registering {form.brandName}. Our team will review your details and reach out to walk through setup.
          </div>
          <button style={styles.submitBtn} onClick={() => navigate('/')}>Back to home</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <button style={styles.back} onClick={() => navigate('/')}>‹ Back</button>
          <button style={styles.helpToggle} onClick={() => setHelpOpen(o => !o)}>{helpOpen ? '✕ Close help' : '❓ Help — what does each field mean?'}</button>
        </div>
        <h1 style={styles.title}>New Host Registration</h1>
        <p style={styles.sub}>Tell us about your property — this is everything we need to set you up on StayVibe360. Only brand name, owner name and email are required; fill in as much of the rest as you can now, the rest can follow on our onboarding call.</p>

        {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}

        <Section n="1" title="Business">
          <Field label="Brand / business name *"><input style={styles.input} value={form.brandName} onChange={e => set('brandName', e.target.value)} placeholder="e.g. Guruvayur Estates" /></Field>
          <Field label="Short name">{inp('shortName', { placeholder: 'e.g. GVR' })}</Field>
          <Field label="Tagline">{inp('tagline', { placeholder: 'e.g. Your home away from home' })}</Field>
          <Field label="Brand color" hint="Pre-filled with our default gold — edit if you have your own">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '8px', flexShrink: 0, background: /^#[0-9a-fA-F]{3,8}$/.test(form.brandColor) ? form.brandColor : 'transparent', border: '1px solid rgba(255,255,255,0.15)' }} />
              {inp('brandColor', { placeholder: 'e.g. #C8903A' })}
            </div>
          </Field>
          <Field label="Custom domain(s) you own" hint="e.g. portal.yourbrand.com">{inp('customDomains')}</Field>
          <Field label="Owner name *">{inp('ownerName', { placeholder: 'Your name' })}</Field>
          <Field label="Owner email *">{inp('ownerEmail', { type: 'email', placeholder: 'you@example.com' })}</Field>
          <Field label="Owner WhatsApp number" hint="Guest-facing contact number">{inp('ownerWhatsapp', { placeholder: '+91 …' })}</Field>
        </Section>

        <Section n="2" title="Property">
          <Field label="Villa code" hint="Short, e.g. 'dwarka' — becomes part of your login/URLs">{inp('villaCode')}</Field>
          <Field label="Display name">{inp('villaDisplayName', { placeholder: 'e.g. Sunset Villa' })}</Field>
          <Field label="Full marketing name">{inp('villaFullName', { placeholder: 'e.g. Sunset Villa (Alibaug)' })}</Field>
          <Field label="Address">{ta('address')}</Field>
          <Field label="Google Maps link">{inp('mapsLink')}</Field>
          <Field label="Bedrooms">{inp('bedrooms', { type: 'number', inputMode: 'numeric' })}</Field>
          <Field label="Bed type notes" hint="e.g. 2 king, 1 twin, 1 floor bed available">{inp('bedTypeNote')}</Field>
          <Field label="Check-in time">{inp('checkinTime', { type: 'time' })}</Field>
          <Field label="Check-out time">{inp('checkoutTime', { type: 'time' })}</Field>
          <Field label="Max guests">{inp('maxGuests', { type: 'number', inputMode: 'numeric' })}</Field>
          <Field label="Rate card" hint="Nightly tariff bands — one per line, e.g. '2 guests — ₹6000/night'">{ta('rateCardNotes')}</Field>
          <Field label="Cleaning fee (₹)">{inp('cleaningFee', { type: 'number', inputMode: 'decimal' })}</Field>
          <Field label="Extra-charge menu" hint="e.g. Early check-in — ₹500, Floor bed — ₹750 — one per line">{ta('extraChargeMenuNotes')}</Field>
          <Field label="Booking channels used" hint="e.g. Airbnb — 3% commission, Direct — 0% — one per line">{ta('bookingChannelsNotes')}</Field>
        </Section>

        <Section n="3" title="Operations">
          <Field label="Manager / staff" hint="Name, role, commission basis — one per line">{ta('staffNotes')}</Field>
          <Field label="Expense categories" hint="Leave blank to use our defaults">{ta('expenseCategoriesNotes')}</Field>
          <Field label="Breakfast rate (₹/person/day)">{inp('breakfastRate', { type: 'number', inputMode: 'decimal' })}</Field>
          <Field label="Additional-guest rate (₹/night)">{inp('additionalGuestRate', { type: 'number', inputMode: 'decimal' })}</Field>
        </Section>

        <Section n="4" title="Integrations">
          <Field label="Gmail address for channel emails" hint="The inbox that receives Airbnb/Booking.com reservation emails">{inp('channelEmail', { type: 'email' })}</Field>
          <Field label="Google Drive folder for guest docs" hint="We'll create the folder structure — just note if you already have one">{inp('driveFolderNote')}</Field>
          <Field label="Anything else we should know?">{ta('notes')}</Field>
        </Section>

        {error && <p style={styles.error}>{error}</p>}

        <button style={{ ...styles.submitBtn, ...(busy ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }} onClick={submit} disabled={busy}>
          {busy ? 'Submitting…' : 'Submit Registration'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#111111', display: 'flex', justifyContent: 'center', padding: '24px 16px' },
  card: { width: '100%', maxWidth: '540px', background: '#1E2535', borderRadius: '20px', padding: '28px', border: '1px solid rgba(200,144,58,0.2)', fontFamily: 'DM Sans, sans-serif', height: 'fit-content' },
  back: { background: 'none', border: 'none', color: '#8A9BAE', fontSize: '0.85rem', cursor: 'pointer', padding: 0, marginBottom: '16px' },
  title: { color: '#fff', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 6px' },
  sub: { color: '#8A9BAE', fontSize: '0.82rem', lineHeight: 1.5, margin: '0 0 24px' },
  section: { marginBottom: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  sectionHead: { color: 'var(--gold, #C8903A)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' },
  sectionNum: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(200,144,58,0.15)', fontSize: '0.65rem' },
  label: { display: 'block', fontSize: '0.65rem', color: '#8A9BAE', letterSpacing: '0.5px', marginBottom: '5px' },
  hint: { fontSize: '0.68rem', color: '#5C7080', marginBottom: '5px' },
  input: { width: '100%', background: '#141820', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 13px', fontSize: '0.88rem', color: '#fff', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' },
  error: { color: '#EF9A9A', fontSize: '0.8rem', marginBottom: '4px' },
  submitBtn: { width: '100%', marginTop: '8px', padding: '14px', background: '#C8903A', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '1px', cursor: 'pointer' },
  helpToggle: { background: 'rgba(200,144,58,0.1)', border: '1px solid rgba(200,144,58,0.3)', borderRadius: '20px', color: 'var(--gold, #C8903A)', fontSize: '0.72rem', fontWeight: 600, padding: '7px 12px', cursor: 'pointer', marginBottom: '16px', whiteSpace: 'nowrap' },
  helpPanel: { background: '#141820', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '16px', marginBottom: '24px', maxHeight: '420px', overflowY: 'auto' },
  helpClose: { background: 'none', border: 'none', color: '#8A9BAE', fontSize: '0.9rem', cursor: 'pointer', padding: '2px 6px' },
}
