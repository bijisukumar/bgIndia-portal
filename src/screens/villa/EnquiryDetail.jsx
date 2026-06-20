import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { STATUS_META, SOURCES, LOST_REASONS } from './EnquiryTracker'

function fmt(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }
function fmtDateTime(d) { if (!d) return ''; return String(d).replace('T', ' ').slice(0, 16) }

const COMM_TYPES = [
  { id: 'whatsapp',      label: 'WhatsApp' },
  { id: 'email',         label: 'Email' },
  { id: 'phone_call',    label: 'Phone Call' },
  { id: 'sms',           label: 'SMS' },
  { id: 'internal_note', label: 'Internal Note' },
]

function buildQuote(e) {
  const nights = e.nights || 1
  const nightly = nights > 0 ? Math.round((e.final_offer_amount || e.quote_amount || 0) / nights) : 0
  const lines = [
    `🙏 Namaskaram ${e.guest_name}!`,
    ``,
    `Thank you for choosing Luxury Villas of Guruvayur. We would be delighted to host your family.`,
    ``,
    `📅 Check-in: ${e.checkin_date || '—'}`,
    `📅 Check-out: ${e.checkout_date || '—'}`,
    ``,
    `💰 Total Tariff: ₹${Number(e.final_offer_amount || e.quote_amount || 0).toLocaleString('en-IN')}`,
    `🏡 Rate: ₹${nightly.toLocaleString('en-IN')} per night`,
    `👥 Guests: ${e.guests_count || 1}`,
  ]
  if (e.repeat_discount_pct > 0) {
    lines.push(``, `🎁 Repeat Guest Discount: ${e.repeat_discount_pct}%`)
  }
  lines.push(
    ``,
    `If you would like to proceed, please confirm at your earliest convenience.`,
    ``,
    `💳 GPay: +91 99950 43283`,
    `👤 Biji Sukumar – Luxury Villas of Guruvayur`,
  )
  return lines.join('\n')
}

export default function EnquiryDetail() {
  const navigate = useNavigate()
  const { enquiryId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [commType, setCommType] = useState('whatsapp')
  const [commNote, setCommNote] = useState('')
  const [followUpDue, setFollowUpDue] = useState('')
  const [bookingValue, setBookingValue] = useState('')
  const [lostReason, setLostReason] = useState('price')
  const [showLostPicker, setShowLostPicker] = useState(false)
  const [showConfirmPicker, setShowConfirmPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const load = () => {
    setLoading(true)
    api.getEnquiryDetail(enquiryId).then(d => {
      setData(d)
      setBookingValue(d?.enquiry?.final_offer_amount || d?.enquiry?.quote_amount || '')
    }).catch(() => showToast('Failed to load enquiry', 'error')).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [enquiryId])

  const e = data?.enquiry

  const handleLogComm = async () => {
    if (!commNote.trim()) { showToast('Add a note', 'error'); return }
    setBusy(true)
    try {
      await api.logCommunication({ enquiryId, type: commType, notes: commNote, followUpDue: followUpDue || undefined,
        status: e.status === 'new' ? 'quoted' : undefined })
      setCommNote(''); setFollowUpDue('')
      showToast('Logged ✓')
      load()
    } catch { showToast('Failed to log', 'error') }
    finally { setBusy(false) }
  }

  const handleConfirm = async () => {
    setBusy(true)
    try {
      const result = await api.confirmEnquiry({ enquiryId, bookingValue: parseFloat(bookingValue) || undefined })
      showToast(`Booking confirmed ✓ Stay ${result.stayId}`)
      setShowConfirmPicker(false)
      load()
    } catch (err) { showToast(err.message || 'Failed to confirm — check for date conflicts', 'error') }
    finally { setBusy(false) }
  }

  const handleMarkLost = async () => {
    setBusy(true)
    try {
      await api.markEnquiryLost({ enquiryId, lostReason })
      showToast('Marked as lost')
      setShowLostPicker(false)
      load()
    } catch { showToast('Failed to update', 'error') }
    finally { setBusy(false) }
  }

  const handleCopyQuote = () => {
    if (!e) return
    navigator.clipboard.writeText(buildQuote(e)).then(() => showToast('Quote copied — paste into WhatsApp ✓'))
  }

  if (loading || !e) {
    return (
      <div className="screen">
        <div className="topbar">
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          <div className="topbar-title">Loading…</div>
        </div>
      </div>
    )
  }

  const meta = STATUS_META[e.status] || STATUS_META.new
  const isFinal = e.status === 'confirmed' || e.status === 'lost' || e.status === 'cancelled'

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">{e.guest_name}</div>
          <div className="topbar-sub">{e.enquiry_id}</div>
        </div>
        <button onClick={() => navigate(`/owner/villa/enquiries/${enquiryId}/edit`)}
          style={{ background: 'transparent', border: '1px solid var(--border-dim)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.75rem', padding: '6px 10px', cursor: 'pointer' }}>
          Edit
        </button>
      </div>

      <div className="screen-body">
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ background: meta.bg, color: meta.color, fontSize: '0.72rem', fontWeight: '700', padding: '4px 10px', borderRadius: '10px' }}>{meta.label}</span>
            {!!e.is_repeat_guest && (
              <span style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', fontSize: '0.68rem', fontWeight: '700', padding: '3px 9px', borderRadius: '10px' }}>
                Repeat · {e.previous_stays}× stays
              </span>
            )}
          </div>
          <div style={{ color: '#5C7080', fontSize: '0.78rem', lineHeight: 1.7 }}>
            📞 {e.phone || '—'} {e.email && <>· ✉️ {e.email}</>}<br />
            📅 {e.checkin_date || '—'} → {e.checkout_date || '—'} ({e.nights || 0}n) · 👥 {e.guests_count || 1} guests<br />
            🎯 {e.purpose || '—'} · via {SOURCES.find(s => s.id === e.source)?.label || e.source}
          </div>
        </div>

        <div className="card-section-label" style={{ marginTop: '14px' }}>PRICING</div>
        <div className="card">
          <div className="net-box" style={{ margin: 0 }}>
            <div className="net-row"><span className="net-label">Quote amount</span><span className="net-val">{fmt(e.quote_amount)}</span></div>
            {e.discount_amount > 0 && (
              <div className="net-row"><span className="net-label">Repeat discount ({e.repeat_discount_pct}%)</span><span className="net-val">−{fmt(e.discount_amount)}</span></div>
            )}
            <div className="net-divider" />
            <div className="net-row"><span style={{ fontWeight: 700 }}>Final offer</span><span className="net-val big">{fmt(e.final_offer_amount)}</span></div>
            {e.status === 'confirmed' && (
              <div className="net-row"><span className="net-label">Booking value</span><span className="net-val pos">{fmt(e.booking_value)}</span></div>
            )}
          </div>
          <button onClick={handleCopyQuote} className="btn btn-teal" style={{ marginTop: '12px' }}>
            📋 Generate & copy WhatsApp quote
          </button>
        </div>

        {!isFinal && (
          <>
            <div className="card-section-label" style={{ marginTop: '14px' }}>ACTIONS</div>
            <div className="card">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button onClick={() => setShowConfirmPicker(s => !s)} className="btn" style={{ background: 'rgba(52,168,83,0.15)', color: '#34A853', border: '1px solid rgba(52,168,83,0.4)' }}>
                  ✓ Confirm Booking
                </button>
                <button onClick={() => setShowLostPicker(s => !s)} className="btn" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                  ✕ Mark Lost
                </button>
              </div>

              {showConfirmPicker && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-dim)' }}>
                  <div className="field">
                    <div className="field-label">Confirmed booking value (₹)</div>
                    <input type="number" className="field-input" value={bookingValue} onChange={e2 => setBookingValue(e2.target.value)} />
                  </div>
                  <button onClick={handleConfirm} disabled={busy} className="btn btn-gold">
                    {busy ? 'Confirming...' : 'Create stay & confirm →'}
                  </button>
                </div>
              )}
              {showLostPicker && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-dim)' }}>
                  <div className="field">
                    <div className="field-label">Reason lost</div>
                    <select className="field-input" value={lostReason} onChange={e2 => setLostReason(e2.target.value)}>
                      {LOST_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </div>
                  <button onClick={handleMarkLost} disabled={busy} className="btn" style={{ background: '#EF4444', color: '#fff' }}>
                    {busy ? 'Updating...' : 'Confirm — mark lost'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <div className="card-section-label" style={{ marginTop: '14px' }}>LOG COMMUNICATION</div>
        <div className="card">
          <div className="field">
            <div className="field-label">Type</div>
            <select className="field-input" value={commType} onChange={e2 => setCommType(e2.target.value)}>
              {COMM_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div className="field">
            <div className="field-label">Notes</div>
            <input className="field-input" value={commNote} onChange={e2 => setCommNote(e2.target.value)} placeholder="e.g. Guest requested ₹1,000 discount" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <div className="field-label">Follow-up due (optional)</div>
            <input type="date" className="field-input" value={followUpDue} onChange={e2 => setFollowUpDue(e2.target.value)} />
          </div>
          <button onClick={handleLogComm} disabled={busy} className="btn btn-gold" style={{ marginTop: '10px' }}>
            {busy ? 'Logging...' : 'Log entry →'}
          </button>
        </div>

        <div className="card-section-label" style={{ marginTop: '14px' }}>COMMUNICATION TIMELINE</div>
        <div className="card">
          {(!data.timeline || data.timeline.length === 0) && (
            <div style={{ color: '#5C7080', fontSize: '0.8rem', textAlign: 'center', padding: '10px' }}>No activity logged yet.</div>
          )}
          {(data.timeline || []).slice().reverse().map((t, i) => (
            <div key={t.comm_id} style={{
              paddingBottom: '10px', marginBottom: '10px',
              borderBottom: i < data.timeline.length - 1 ? '1px solid var(--border-dim)' : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--gold)', fontSize: '0.75rem', fontWeight: '600' }}>
                  {COMM_TYPES.find(c => c.id === t.type)?.label || t.type}
                </span>
                <span style={{ color: '#5C7080', fontSize: '0.68rem' }}>{fmtDateTime(t.occurred_at)}</span>
              </div>
              <div style={{ color: 'var(--text)', fontSize: '0.8rem', marginTop: '2px' }}>{t.notes}</div>
            </div>
          ))}
        </div>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
