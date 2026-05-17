import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

const TODAY    = new Date().toISOString().split('T')[0]
const CHANNELS = ['Direct', 'Airbnb', 'MakeMyTrip', 'Booking.com', 'Goibibo', 'Other']
const COMM     = { Direct: 0, Airbnb: 15, MakeMyTrip: 18, 'Booking.com': 15, Goibibo: 18, Other: 10 }

const STATUS_FLOW = [
  { key: 'booked',      label: 'Booked',      color: '#185FA5', desc: 'Booking received, not yet confirmed' },
  { key: 'confirmed',   label: 'Confirmed',   color: '#C8903A', desc: 'Booking confirmed with guest' },
  { key: 'registered',  label: 'Registered',  color: '#8B5CF6', desc: 'Guest filled online registration' },
  { key: 'active',      label: 'Checked In',  color: '#34A853', desc: 'Guest currently staying' },
  { key: 'checked_out', label: 'Checked Out', color: '#5C7080', desc: 'Stay completed' },
]

function fmt(n) {
  return isNaN(n) || n === '' ? '—' : `₹${Number(n).toLocaleString('en-IN')}`
}

export default function NewBooking() {
  const navigate = useNavigate()
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState(null)
  const [result, setResult]   = useState(null) // { stayId, folderUrl }
  const [form, setForm]       = useState({
    bookerName:   '',
    guestCount:   '',
    checkInDate:  TODAY,
    checkOutDate: '',
    channel:      'Direct',
    tariffPerNight: '',
    extraCharges: '0',
    notes:        '',
    status:       'booked',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const nights  = form.checkInDate && form.checkOutDate
    ? Math.max(0, (new Date(form.checkOutDate) - new Date(form.checkInDate)) / (1000 * 60 * 60 * 24)) : 0
  const tariff  = parseFloat(form.tariffPerNight) || 0
  const extra   = parseFloat(form.extraCharges) || 0
  const gross   = (tariff * nights) + extra
  const commPct = COMM[form.channel] || 0
  const commAmt = Math.round(gross * commPct / 100)
  const net     = gross - commAmt

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleSave = async () => {
    // Explicit validation — tariff of ₹0 is valid (e.g. complimentary stays)
    if (!form.bookerName.trim())   { showToast('Enter the booker name', 'error'); return }
    if (!form.checkInDate)         { showToast('Enter a check-in date', 'error'); return }
    if (!form.checkOutDate)        { showToast('Enter a check-out date', 'error'); return }
    if (form.tariffPerNight === '') { showToast('Enter the tariff (0 is valid for complimentary stays)', 'error'); return }
    setSaving(true)
    try {
      // Map form fields to what the Worker / D1 schema expects
      const res = await api.createBooking({
        villaId:        'dwarka',
        source:         form.channel,
        guestName:      form.bookerName,       // Worker expects guestName (not bookerName)
        guestPhone:     form.guestPhone || null,
        guestEmail:     form.guestEmail || null,
        checkInDate:    form.checkInDate,
        checkOutDate:   form.checkOutDate,
        nights,
        adults:         parseInt(form.guestCount) || 1,
        children:       0,
        tariffPerNight: parseFloat(form.tariffPerNight) || 0,
        extraCharges:   parseFloat(form.extraCharges) || 0,
        gross,
        commissionPct:  commPct,               // Worker expects commissionPct (not commPct)
        commissionAmt:  commAmt,               // Worker expects commissionAmt (not commAmt)
        net,
        notes:          form.notes,
        status:         form.status,
      })
      setResult(res)
      showToast('Booking created! Stay ID: ' + res?.stayId)
    } catch (e) {
      const msg = e?.message || 'Unknown error'
      // Check for 409 conflict response embedded in error message
      if (msg.toLowerCase().includes('date conflict') || msg.toLowerCase().includes('already booked')) {
        showToast(`⚠️ ${msg}`, 'error')
      } else {
        showToast(`Save failed: ${msg}`, 'error')
      }
      console.error('[NewBooking] createBooking failed:', e)
    } finally {
      setSaving(false)
    }
  }

  // Success state — show Stay ID and Drive folder link
  if (result) {
    return (
      <div className="screen">
        <div className="topbar">
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          <div>
            <div className="topbar-title">Booking created</div>
            <div className="topbar-sub">GVR DWARKA VILLA</div>
          </div>
          <div style={{ width: 34 }} />
        </div>
        <div className="screen-body">
          <div className="banner-green" style={{ marginBottom: '20px' }}>
            <div className="banner-dot" />
            <div>
              <div className="banner-title">Booking successfully created</div>
              <div className="banner-sub">Stay ID assigned · Drive folder created · Email sent</div>
            </div>
          </div>

          <div className="card-section-label">STAY DETAILS</div>
          <div className="card">
            <div className="grid-2">
              <div className="field">
                <div className="field-label">Stay ID</div>
                <div className="field-input" style={{ color: 'var(--gold)', fontWeight: '800', fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '2px' }}>
                  {result.stayId}
                </div>
              </div>
              <div className="field">
                <div className="field-label">Status</div>
                <div className="field-input">
                  <span className="tag tag-gold">{form.status}</span>
                </div>
              </div>
              <div className="field">
                <div className="field-label">Booker</div>
                <div className="field-input auto-filled">{form.bookerName}</div>
              </div>
              <div className="field">
                <div className="field-label">Channel</div>
                <div className="field-input auto-filled">{form.channel}</div>
              </div>
              <div className="field">
                <div className="field-label">Check-in</div>
                <div className="field-input gold">{form.checkInDate}</div>
              </div>
              <div className="field">
                <div className="field-label">Check-out</div>
                <div className="field-input gold">{form.checkOutDate}</div>
              </div>
              <div className="field">
                <div className="field-label">Nights</div>
                <div className="field-input" style={{ color: '#85B7EB', fontWeight: '600' }}>{nights}</div>
              </div>
              <div className="field">
                <div className="field-label">Net to owner</div>
                <div className="field-input" style={{ color: '#34A853', fontWeight: '700' }}>{fmt(net)}</div>
              </div>
            </div>
          </div>

          <div className="card-section-label">DRIVE FOLDER</div>
          <div className="card">
            <div className="field" style={{ marginBottom: 0 }}>
              <div className="field-label">Guest documents folder</div>
              <a href={result.folderUrl} target="_blank" rel="noreferrer"
                style={{ display: 'block', padding: '10px 12px', background: 'var(--dark-input)', borderRadius: '8px', color: '#85B7EB', fontSize: '0.8rem', wordBreak: 'break-all', textDecoration: 'none' }}>
                📁 Open Drive folder →
              </a>
            </div>
          </div>

          <div className="card-section-label">NEXT STEPS</div>
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { icon: '📋', text: 'Share guest registration form link with booker', done: false },
                { icon: '✅', text: 'Guest fills online registration (Aadhaar, names, dates)', done: false },
                { icon: '🚗', text: 'RamananKutty does check-in on portal', done: false },
                { icon: '🏠', text: 'Record villa rental income for this stay', done: false },
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.1rem' }}>{step.icon}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{step.text}</span>
                </div>
              ))}
            </div>
          </div>

          <button className="btn btn-gold" onClick={() => navigate('/owner/villa')}>
            Back to Villa Hub
          </button>
        </div>
        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">New booking</div>
          <div className="topbar-sub">GVR DWARKA VILLA</div>
        </div>
        <div style={{ width: 34 }} />
      </div>

      <div className="screen-body">

        {/* Booking status */}
        <div className="card-section-label">BOOKING STATUS</div>
        <div className="card">
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {STATUS_FLOW.map(s => (
              <div key={s.key}
                onClick={() => set('status', s.key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: `1px solid ${form.status === s.key ? s.color : 'rgba(255,255,255,0.08)'}`,
                  background: form.status === s.key ? `${s.color}22` : 'transparent',
                  color: form.status === s.key ? s.color : 'var(--text-dim)',
                  fontSize: '0.78rem',
                  fontWeight: form.status === s.key ? '700' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                {s.label}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '8px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
            {STATUS_FLOW.find(s => s.key === form.status)?.desc}
          </div>
        </div>

        {/* Guest & booking details */}
        <div className="card-section-label">BOOKING DETAILS</div>
        <div className="card">
          <div className="field">
            <label className="field-label">Booker name</label>
            <input className="field-input" placeholder="e.g. Vikram Ramasubramanian"
              value={form.bookerName} onChange={e => set('bookerName', e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="field-label">Check-in date</label>
              <input className="field-input gold" type="date"
                value={form.checkInDate} onChange={e => set('checkInDate', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Check-out date</label>
              <input className="field-input gold" type="date"
                value={form.checkOutDate} onChange={e => set('checkOutDate', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Nights (auto)</label>
              <div className="field-input" style={{ color: '#85B7EB', fontWeight: '600' }}>{nights || '—'}</div>
            </div>
            <div className="field">
              <label className="field-label">Est. guest count</label>
              <input className="field-input" type="number" min="1" placeholder="e.g. 4"
                value={form.guestCount} onChange={e => set('guestCount', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Channel & tariff */}
        <div className="card-section-label">CHANNEL & TARIFF</div>
        <div className="card">
          <div className="field">
            <label className="field-label">Booking channel</label>
            <select className="field-input" value={form.channel} onChange={e => set('channel', e.target.value)}>
              {CHANNELS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="field-label">Tariff / night (₹)</label>
              <input className="field-input gold" type="number" placeholder="0"
                value={form.tariffPerNight} onChange={e => set('tariffPerNight', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Extra charges (₹)</label>
              <input className="field-input" type="number" placeholder="0"
                value={form.extraCharges} onChange={e => set('extraCharges', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Revenue summary */}
        {nights > 0 && tariff > 0 && (
          <>
            <div className="card-section-label">REVENUE PREVIEW</div>
            <div className="net-box">
              <div className="net-row">
                <span className="net-label">Gross ({nights} nights × {fmt(tariff)})</span>
                <span className="net-val pos">{fmt(gross)}</span>
              </div>
              {commPct > 0 && (
                <div className="net-row">
                  <span className="net-label">{form.channel} commission ({commPct}%)</span>
                  <span className="net-val neg">−{fmt(commAmt)}</span>
                </div>
              )}
              <div className="net-divider" />
              <div className="net-row">
                <span style={{ color: '#EDF2F7', fontWeight: '600', fontSize: '1rem' }}>Net to owner</span>
                <span className="net-val big">{fmt(net)}</span>
              </div>
            </div>
          </>
        )}

        {/* Notes */}
        <div className="card">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Notes (optional)</label>
            <textarea className="field-input" rows="2"
              placeholder="Special requests, source of booking, etc."
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        {/* What happens on save */}
        <div className="card" style={{ background: 'rgba(200,144,58,0.04)', border: '1px solid rgba(200,144,58,0.15)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: '1.6' }}>
            <div style={{ color: 'var(--gold)', fontWeight: '600', marginBottom: '6px', fontSize: '0.8rem' }}>ON SAVE:</div>
            🔑 Stay ID assigned (e.g. DWK-XXXXX)<br />
            📁 Drive folder created under Guests/<br />
            📊 Booking recorded in Master Sheet<br />
            📧 Email notification sent to owner
          </div>
        </div>

        <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
          {saving ? 'Creating booking...' : 'Create booking → Assign Stay ID'}
        </button>
        <p className="btn-email-note">📧 Email notification sent to owner on save</p>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
