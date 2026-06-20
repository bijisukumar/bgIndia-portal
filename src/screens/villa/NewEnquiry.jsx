import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { SOURCES, PURPOSES, STATUS_META } from './EnquiryTracker'
import { parseLocalDate } from '../../utils/dates'

function fmt(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }

export default function NewEnquiry() {
  const navigate = useNavigate()
  const { enquiryId } = useParams()   // present when editing
  const isEdit = !!enquiryId

  const [form, setForm] = useState({
    guestName: '', phone: '', email: '', source: 'website',
    checkInDate: '', checkOutDate: '', guestsCount: 2, purpose: 'Vacation',
    quoteAmount: '', repeatDiscountPct: 0, status: 'new', notes: '',
  })
  const [match, setMatch] = useState(null)       // result of findGuestMatch
  const [matchChecked, setMatchChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const debounceRef = useRef(null)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  // Load existing enquiry if editing
  useEffect(() => {
    if (!isEdit) return
    api.getEnquiryDetail(enquiryId).then(d => {
      const e = d?.enquiry
      if (!e) return
      setForm({
        guestName: e.guest_name || '', phone: e.phone || '', email: e.email || '',
        source: e.source || 'website', checkInDate: e.checkin_date || '', checkOutDate: e.checkout_date || '',
        guestsCount: e.guests_count || 1, purpose: e.purpose || 'Vacation',
        quoteAmount: e.quote_amount || '', repeatDiscountPct: e.repeat_discount_pct || 0,
        status: e.status || 'new', notes: e.notes || '',
      })
    }).catch(() => {})
  }, [isEdit, enquiryId])

  // Live repeat-guest lookup, debounced, whenever phone or email looks complete
  useEffect(() => {
    if (isEdit) return  // don't re-trigger matching while editing an existing enquiry
    const phoneOk = form.phone.replace(/\D/g, '').length >= 10
    const emailOk = /\S+@\S+\.\S+/.test(form.email)
    if (!phoneOk && !emailOk) { setMatch(null); setMatchChecked(false); return }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      api.findGuestMatch(form.phone, form.email).then(d => {
        setMatch(d || null)
        setMatchChecked(true)
        if (d?.guest) {
          // Pre-fill a sensible repeat-guest discount if none entered yet
          setForm(f => f.repeatDiscountPct ? f : { ...f, repeatDiscountPct: 10 })
        }
      }).catch(() => setMatchChecked(true))
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [form.phone, form.email, isEdit])

  const nights = form.checkInDate && form.checkOutDate
    ? Math.max(0, Math.round((parseLocalDate(form.checkOutDate) - parseLocalDate(form.checkInDate)) / 86400000))
    : 0
  const quote = parseFloat(form.quoteAmount) || 0
  const discountPct = parseFloat(form.repeatDiscountPct) || 0
  const discountAmount = Math.round(quote * discountPct) / 100
  const finalOffer = quote - discountAmount

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.guestName.trim()) { showToast('Guest name required', 'error'); return }
    setSaving(true)
    try {
      const result = await api.saveEnquiry({
        enquiryId: isEdit ? enquiryId : undefined,
        villaId: 'dwarka',
        guestId: match?.guest?.guest_id,
        guestName: form.guestName, phone: form.phone, email: form.email,
        source: form.source, checkInDate: form.checkInDate, checkOutDate: form.checkOutDate,
        guestsCount: form.guestsCount, purpose: form.purpose,
        quoteAmount: quote, repeatDiscountPct: discountPct,
        status: form.status, notes: form.notes,
      })
      showToast(isEdit ? 'Enquiry updated ✓' : 'Enquiry created ✓')
      setTimeout(() => navigate(`/owner/villa/enquiries/${result.enquiryId}`), 600)
    } catch { showToast('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">{isEdit ? 'Edit Enquiry' : 'New Enquiry'}</div>
          <div className="topbar-sub">DWARKA · GUEST ENQUIRY</div>
        </div>
      </div>

      <div className="screen-body">
        <div className="card-section-label">GUEST INFORMATION</div>
        <div className="card">
          <div className="field">
            <div className="field-label">Full name</div>
            <input className="field-input" value={form.guestName} onChange={e => set('guestName', e.target.value)} placeholder="Guest name" />
          </div>
          <div className="field">
            <div className="field-label">Mobile / WhatsApp</div>
            <input className="field-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <div className="field-label">Email</div>
            <input className="field-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="guest@example.com" />
          </div>
        </div>

        {matchChecked && match?.guest && (
          <div className="card" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', marginTop: '-2px' }}>
            <div style={{ color: '#8B5CF6', fontWeight: '700', fontSize: '0.85rem', marginBottom: '6px' }}>
              🟣 Repeat Guest – Stayed {match.guest.total_stays} time{match.guest.total_stays === 1 ? '' : 's'}
            </div>
            <div style={{ color: '#5C7080', fontSize: '0.75rem', lineHeight: 1.6 }}>
              Total revenue: <strong style={{ color: 'var(--text)' }}>{fmt(match.guest.total_revenue)}</strong><br />
              {match.pastStays?.[0] && <>Last stay: {match.pastStays[0].checkin_date} ({match.pastStays[0].source})</>}
            </div>
          </div>
        )}
        {matchChecked && !match?.guest && (form.phone || form.email) && (
          <div style={{ color: '#5C7080', fontSize: '0.72rem', padding: '4px 4px 0' }}>No matching guest history found — first-time enquiry.</div>
        )}

        <div className="card-section-label" style={{ marginTop: '14px' }}>STAY REQUEST</div>
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="field">
              <div className="field-label">Check-in</div>
              <input type="date" className="field-input" value={form.checkInDate} onChange={e => set('checkInDate', e.target.value)} />
            </div>
            <div className="field">
              <div className="field-label">Check-out</div>
              <input type="date" className="field-input" value={form.checkOutDate} onChange={e => set('checkOutDate', e.target.value)} />
            </div>
          </div>
          {nights > 0 && <div style={{ color: '#5C7080', fontSize: '0.72rem', margin: '-6px 0 10px' }}>{nights} night{nights === 1 ? '' : 's'}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="field">
              <div className="field-label">Guests</div>
              <input type="number" min="1" className="field-input" value={form.guestsCount} onChange={e => set('guestsCount', parseInt(e.target.value) || 1)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <div className="field-label">Purpose</div>
              <select className="field-input" value={form.purpose} onChange={e => set('purpose', e.target.value)}>
                {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: '10px', marginBottom: 0 }}>
            <div className="field-label">Source</div>
            <select className="field-input" value={form.source} onChange={e => set('source', e.target.value)}>
              {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="card-section-label" style={{ marginTop: '14px' }}>PRICING</div>
        <div className="card">
          <div className="field">
            <div className="field-label">Quote amount (₹)</div>
            <input type="number" className="field-input" value={form.quoteAmount} onChange={e => set('quoteAmount', e.target.value)} placeholder="0" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <div className="field-label">Repeat guest discount %</div>
            <input type="number" min="0" max="100" className="field-input" value={form.repeatDiscountPct} onChange={e => set('repeatDiscountPct', e.target.value)} />
          </div>
          {quote > 0 && (
            <div className="net-box" style={{ marginTop: '10px' }}>
              <div className="net-row"><span className="net-label">Quote</span><span className="net-val">{fmt(quote)}</span></div>
              {discountAmount > 0 && <div className="net-row"><span className="net-label">Discount</span><span className="net-val">−{fmt(discountAmount)}</span></div>}
              <div className="net-divider" />
              <div className="net-row"><span style={{ fontWeight: 700 }}>Final offer</span><span className="net-val big">{fmt(finalOffer)}</span></div>
            </div>
          )}
        </div>

        <div className="card-section-label" style={{ marginTop: '14px' }}>STATUS & NOTES</div>
        <div className="card">
          <div className="field">
            <div className="field-label">Status</div>
            <select className="field-input" value={form.status} onChange={e => set('status', e.target.value)}>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <div className="field-label">Notes</div>
            <input className="field-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Quick notes…" />
          </div>
        </div>

        <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save changes →' : 'Create enquiry →'}
        </button>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
