import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { STATUS_META, SOURCES, LOST_REASONS } from './EnquiryTracker'
import { parseLocalDate, localTodayStr } from '../../utils/dates'
import DatePicker from '../../components/DatePicker'
import {
  getTariffEstimate, FALLBACK_RATE_CARDS, DISCOUNT_CATEGORIES, getDefaultDiscountPct,
  OVERFLOW_PER_GUEST_PER_NIGHT, OVERFLOW_MAX_RECOMMENDED, RATE_CARD_MAX_GUESTS, getBedroomEstimate,
} from '../../utils/villaPricing'

function fmt(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }
function fmtDateTime(d) { if (!d) return ''; return String(d).replace('T', ' ').slice(0, 16) }

const COMM_TYPES = [
  { id: 'whatsapp',      label: 'WhatsApp' },
  { id: 'email',         label: 'Email' },
  { id: 'phone_call',    label: 'Phone Call' },
  { id: 'sms',           label: 'SMS' },
  { id: 'internal_note', label: 'Internal Note' },
]

// Statuses settable directly from this screen's dropdown. Deliberately excludes
// confirmed/lost/cancelled — those go through Confirm Booking / Mark Lost, which
// do extra work (create a stay record, capture booking value/lost reason) that a
// plain status change here would silently skip.
const MANUAL_STATUSES = ['new', 'quoted', 'follow_up_needed', 'negotiating']

function buildQuote(e) {
  const nights = e.nights || 1
  const finalTotal = e.final_offer_amount || e.quote_amount || 0
  const nightly = nights > 0 ? Math.round(finalTotal / nights) : 0
  const billableGuests = (e.adults || 0) + (e.children || 0)
  const overflowGuests = Math.max(0, billableGuests - RATE_CARD_MAX_GUESTS)
  const isB2B = e.discount_category === 'b2b_india' || e.discount_category === 'b2b_intl'

  const guestLine = overflowGuests > 0
    ? `${e.guests_count || 1} (${RATE_CARD_MAX_GUESTS} + ${overflowGuests} on floor beds)`
    : `${e.guests_count || 1}`
  const bedroomCount = getBedroomEstimate(e.villa_id || 'dwarka', billableGuests)

  const lines = [
    `🙏 Namaskaram ${e.guest_name}!`,
    ``,
    `Thank you for choosing Luxury Villas of Guruvayur. We would be delighted to host your family.`,
    ``,
    `📅 Check-in: ${e.checkin_date || '—'} - check-in after 4:00 PM`,
    `📅 Check-out: ${e.checkout_date || '—'} - check-out by 11:00 AM`,
    `Check-in/Check-out timings for Villa - https://luxuryvillasofguruvayur.com/faq.html`,
    ``,
  ]

  // Show the pre-discount quote, the saved amount (labeled by what it actually is —
  // a guest-facing discount for repeat guests, or a partner commission for B2B), and
  // the resulting total — rather than only the final number, so it's clear at a
  // glance what was reduced and why.
  const discountAmount = e.discount_amount || 0
  if (discountAmount > 0) {
    lines.push(`💰 Tariff: ₹${Number(e.quote_amount || 0).toLocaleString('en-IN')}`)
    if (e.discount_category) {
      const label = DISCOUNT_CATEGORIES.find(c => c.id === e.discount_category)?.label || e.discount_category
      const savedLabel = isB2B ? `${label} Commission` : `${label} Discount`
      lines.push(`${isB2B ? '🤝' : '🎁'} ${savedLabel} (${e.discount_pct}%): −₹${Math.round(discountAmount).toLocaleString('en-IN')}`)
    } else if (e.repeat_discount_pct > 0) {
      lines.push(`🎁 Repeat Guest Discount (${e.repeat_discount_pct}%): −₹${Math.round(discountAmount).toLocaleString('en-IN')}`)
    }
    lines.push(`💰 Total Tariff: ₹${Math.round(finalTotal).toLocaleString('en-IN')}`)
  } else {
    lines.push(`💰 Total Tariff: ₹${Math.round(finalTotal).toLocaleString('en-IN')}`)
  }

  lines.push(
    `🏡 Rate: ₹${nightly.toLocaleString('en-IN')} per night`,
    `👥 Guests: ${guestLine}`,
    `🛏 Bedrooms: ${bedroomCount}`,
    ``,
    `💡 Why book directly with us?`,
    `When you book through our official portal, we can offer flexible options like early check-in or late check-out to better suit your travel plans—a premium perk we cannot offer through third-party major channel partners.`,
    `Plus, direct booking ensures you get the most cost-effective rates!`,
    `Secure your dates and enjoy these direct booking benefits here:`,
    `🌐 Book Direct: https://www.luxuryvillasofguruvayur.com`,
    `FAQ: https://luxuryvillasofguruvayur.com/faq.html`,
    `📸 Villa Photos: https://luxuryvillasofguruvayur.com/villa`,
  )

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
  const [rateCard, setRateCard] = useState(FALLBACK_RATE_CARDS.dwarka)
  const [pricingParams, setPricingParams] = useState(null)   // { checkInDate, checkOutDate, adults, children, infants }
  const [pricingNote, setPricingNote] = useState(null)
  const [pricingBusy, setPricingBusy] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [discountParams, setDiscountParams] = useState(null)   // { discountCategory, discountPct }
  const [discountBusy, setDiscountBusy] = useState(false)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const load = () => {
    setLoading(true)
    api.getEnquiryDetail(enquiryId).then(d => {
      setData(d)
      setBookingValue(d?.enquiry?.final_offer_amount || d?.enquiry?.quote_amount || '')
      const en = d?.enquiry
      if (en) {
        setPricingParams({
          checkInDate: en.checkin_date || '', checkOutDate: en.checkout_date || '',
          adults: en.adults || en.guests_count || 1, children: en.children || 0, infants: en.infants || 0,
        })
        setDiscountParams({
          discountCategory: en.discount_category || '',
          discountPct: en.discount_category ? (en.discount_pct || 0) : (en.repeat_discount_pct || 0),
        })
      }
    }).catch(() => showToast('Failed to load enquiry', 'error')).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [enquiryId])

  useEffect(() => {
    api.getRateCard('dwarka').then(d => {
      if (d?.rateCard?.length) setRateCard(d.rateCard)
    }).catch(() => {})
  }, [])

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

  const handleDiscountCategoryChange = (categoryId) => {
    setDiscountParams({
      discountCategory: categoryId,
      discountPct: categoryId ? getDefaultDiscountPct(categoryId) : 0,
    })
  }

  const handleSaveDiscount = async () => {
    if (!e || !discountParams) return
    setDiscountBusy(true)
    try {
      const isCategory = !!discountParams.discountCategory
      await api.saveEnquiry({
        enquiryId, villaId: e.villa_id || 'dwarka', guestId: e.guest_id,
        guestName: e.guest_name, phone: e.phone, email: e.email, source: e.source,
        checkInDate: e.checkin_date, checkOutDate: e.checkout_date,
        adults: e.adults, children: e.children, infants: e.infants, guestsCount: e.guests_count,
        purpose: e.purpose, quoteAmount: e.quote_amount,
        repeatDiscountPct: isCategory ? 0 : (discountParams.discountPct || 0),
        discountCategory: discountParams.discountCategory || null,
        discountPct: isCategory ? (discountParams.discountPct || 0) : 0,
        status: e.status, notes: e.notes,
      })
      showToast('Discount updated ✓')
      load()
    } catch { showToast('Failed to update discount', 'error') }
    finally { setDiscountBusy(false) }
  }

  const handleStatusChange = async (newStatus) => {
    if (!e || newStatus === e.status) return
    setStatusBusy(true)
    try {
      // saveEnquiry needs the full payload — re-send everything as-is, only status changes.
      await api.saveEnquiry({
        enquiryId, villaId: e.villa_id || 'dwarka', guestId: e.guest_id,
        guestName: e.guest_name, phone: e.phone, email: e.email, source: e.source,
        checkInDate: e.checkin_date, checkOutDate: e.checkout_date,
        adults: e.adults, children: e.children, infants: e.infants, guestsCount: e.guests_count,
        purpose: e.purpose, quoteAmount: e.quote_amount,
        repeatDiscountPct: e.discount_category ? 0 : e.repeat_discount_pct,
        discountCategory: e.discount_category || null, discountPct: e.discount_category ? e.discount_pct : 0,
        status: newStatus, notes: e.notes,
      })
      showToast(`Status updated to ${STATUS_META[newStatus]?.label || newStatus} ✓`)
      load()
    } catch { showToast('Failed to update status', 'error') }
    finally { setStatusBusy(false) }
  }

  const handleCopyQuote = () => {
    if (!e) return
    navigator.clipboard.writeText(buildQuote(e)).then(() => showToast('Quote copied — paste into WhatsApp ✓'))
  }

  const handleGetPricing = async () => {
    if (!e || !pricingParams) return
    const adultsNum = parseInt(pricingParams.adults, 10) || 0
    const childrenNum = parseInt(pricingParams.children, 10) || 0
    const infantsNum = parseInt(pricingParams.infants, 10) || 0
    const totalGuests = adultsNum + childrenNum + infantsNum
    const nights = pricingParams.checkInDate && pricingParams.checkOutDate
      ? Math.max(0, Math.round((parseLocalDate(pricingParams.checkOutDate) - parseLocalDate(pricingParams.checkInDate)) / 86400000))
      : 0

    if (totalGuests === 0) { showToast('Add guest counts first', 'error'); return }
    if (nights === 0) { showToast('Add check-in and check-out dates first', 'error'); return }

    const estimate = getTariffEstimate(rateCard, { adults: adultsNum, children: childrenNum, nights })

    if (estimate.overflowGuests > 0) {
      const msg = estimate.withinRecommended
        ? `${estimate.overflowGuests} extra guest${estimate.overflowGuests === 1 ? '' : 's'} beyond ${RATE_CARD_MAX_GUESTS} added at ₹${OVERFLOW_PER_GUEST_PER_NIGHT}/guest/night (floor beds)`
        : `${estimate.overflowGuests} extra guests beyond ${RATE_CARD_MAX_GUESTS} — exceeds the recommended max of ${OVERFLOW_MAX_RECOMMENDED} extra guests on floor beds`
      setPricingNote({ msg, level: estimate.withinRecommended ? 'info' : 'warn' })
    } else {
      setPricingNote(null)
    }

    setPricingBusy(true)
    try {
      // Re-save the full enquiry with updated dates/guest-counts/quote, preserving
      // everything else (discount category, notes, status, etc.) exactly as-is.
      const discountPct = e.discount_category ? (e.discount_pct || 0) : (e.repeat_discount_pct || 0)
      const discountAmount = Math.round(estimate.total * discountPct) / 100
      await api.saveEnquiry({
        enquiryId, villaId: e.villa_id || 'dwarka', guestId: e.guest_id,
        guestName: e.guest_name, phone: e.phone, email: e.email, source: e.source,
        checkInDate: pricingParams.checkInDate, checkOutDate: pricingParams.checkOutDate,
        adults: adultsNum, children: childrenNum, infants: infantsNum, guestsCount: totalGuests,
        purpose: e.purpose,
        quoteAmount: estimate.total,
        repeatDiscountPct: e.discount_category ? 0 : discountPct,
        discountCategory: e.discount_category || null, discountPct: e.discount_category ? discountPct : 0,
        status: e.status, notes: e.notes,
      })
      showToast(`Estimated ₹${estimate.tariffPerNight.toLocaleString('en-IN')}/night × ${nights} night${nights === 1 ? '' : 's'} — saved ✓`)
      load()
    } catch { showToast('Failed to save pricing', 'error') }
    finally { setPricingBusy(false) }
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
            📅 {e.checkin_date || '—'} → {e.checkout_date || '—'} ({e.nights || 0}n) · 👥 {e.guests_count || 1} guests
            {(e.adults || e.children || e.infants) ? <> ({e.adults || 0}A{e.children ? ` + ${e.children}C` : ''}{e.infants ? ` + ${e.infants}I` : ''})</> : null}<br />
            🎯 {e.purpose || '—'} · via {SOURCES.find(s => s.id === e.source)?.label || e.source}
          </div>
        </div>

        <div className="card-section-label" style={{ marginTop: '14px' }}>PRICING</div>
        <div className="card">
          {discountParams && (
            <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-dim)' }}>
              <div className="field">
                <div className="field-label">Discount type</div>
                <select className="field-input" value={discountParams.discountCategory} onChange={e2 => handleDiscountCategoryChange(e2.target.value)}>
                  <option value="">None / Repeat guest (legacy)</option>
                  {DISCOUNT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <div className="field-label">{discountParams.discountCategory ? 'Discount %' : 'Repeat guest discount %'}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" min="0" max="100" className="field-input" value={discountParams.discountPct}
                    onChange={e2 => setDiscountParams(p => ({ ...p, discountPct: e2.target.value }))} style={{ flex: 1 }} />
                  <button type="button" className="btn" onClick={handleSaveDiscount} disabled={discountBusy} style={{ whiteSpace: 'nowrap', padding: '0 14px' }}>
                    {discountBusy ? 'Saving...' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="net-box" style={{ margin: 0 }}>
            <div className="net-row"><span className="net-label">Quote amount</span><span className="net-val">{fmt(e.quote_amount)}</span></div>
            {e.discount_amount > 0 && (
              <div className="net-row">
                <span className="net-label">
                  {e.discount_category
                    ? `${DISCOUNT_CATEGORIES.find(c => c.id === e.discount_category)?.label || e.discount_category} (${e.discount_pct}%)`
                    : `Repeat discount (${e.repeat_discount_pct}%)`}
                </span>
                <span className="net-val">−{fmt(e.discount_amount)}</span>
              </div>
            )}
            <div className="net-divider" />
            <div className="net-row"><span style={{ fontWeight: 700 }}>Final offer</span><span className="net-val big">{fmt(e.final_offer_amount)}</span></div>
            {(e.nights || 0) > 0 && (
              <div className="net-row">
                <span className="net-label">≈ per night ({e.nights}n)</span>
                <span className="net-val">{fmt(Math.round((e.final_offer_amount || e.quote_amount || 0) / e.nights))}</span>
              </div>
            )}
            {e.status === 'confirmed' && (
              <div className="net-row"><span className="net-label">Booking value</span><span className="net-val pos">{fmt(e.booking_value)}</span></div>
            )}
          </div>
          <button onClick={handleCopyQuote} className="btn btn-teal" style={{ marginTop: '12px' }}>
            📋 Generate & copy WhatsApp quote
          </button>

          {pricingParams && (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-dim)' }}>
              <div style={{ color: '#5C7080', fontSize: '0.72rem', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.03em' }}>
                ADJUST & GET PRICING
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="field">
                  <div className="field-label">Check-in</div>
                  <input type="date" className="field-input" value={pricingParams.checkInDate}
                    onChange={e2 => setPricingParams(p => ({ ...p, checkInDate: e2.target.value }))} />
                </div>
                <div className="field">
                  <div className="field-label">Check-out</div>
                  <input type="date" className="field-input" value={pricingParams.checkOutDate}
                    onChange={e2 => setPricingParams(p => ({ ...p, checkOutDate: e2.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div className="field">
                  <div className="field-label">Adults</div>
                  <input type="number" min="0" className="field-input" value={pricingParams.adults}
                    onChange={e2 => setPricingParams(p => ({ ...p, adults: parseInt(e2.target.value) || 0 }))} />
                </div>
                <div className="field">
                  <div className="field-label">Children (1–12y)</div>
                  <input type="number" min="0" className="field-input" value={pricingParams.children}
                    onChange={e2 => setPricingParams(p => ({ ...p, children: parseInt(e2.target.value) || 0 }))} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <div className="field-label">Infants (≤1y)</div>
                  <input type="number" min="0" className="field-input" value={pricingParams.infants}
                    onChange={e2 => setPricingParams(p => ({ ...p, infants: parseInt(e2.target.value) || 0 }))} />
                </div>
              </div>

              {pricingNote && (
                <div style={{
                  fontSize: '0.72rem', padding: '8px 10px', borderRadius: '8px', margin: '10px 0 0',
                  background: pricingNote.level === 'warn' ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
                  border: `1px solid ${pricingNote.level === 'warn' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`,
                  color: pricingNote.level === 'warn' ? '#EF4444' : '#3B82F6',
                }}>
                  {pricingNote.level === 'warn' ? '⚠️ ' : 'ℹ️ '}{pricingNote.msg}
                </div>
              )}

              <button onClick={handleGetPricing} disabled={pricingBusy} className="btn" style={{ marginTop: '10px' }}>
                {pricingBusy ? 'Calculating...' : '💰 Get pricing'}
              </button>
            </div>
          )}
        </div>

        {!isFinal && (
          <>
            <div className="card-section-label" style={{ marginTop: '14px' }}>ACTIONS</div>
            <div className="card">
              <div className="field">
                <div className="field-label">Status</div>
                <select className="field-input" value={e.status} disabled={statusBusy}
                  onChange={e2 => handleStatusChange(e2.target.value)}>
                  {MANUAL_STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
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
            <DatePicker value={followUpDue} onChange={setFollowUpDue} placeholder="Select follow-up date" min={localTodayStr()} />
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
