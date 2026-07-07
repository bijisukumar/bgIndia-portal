import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { STATUS_META, SOURCES, LOST_REASONS } from './EnquiryTracker'
import { parseLocalDate, localTodayStr } from '../../utils/dates'
import DatePicker from '../../components/DatePicker'
import {
  getTariffEstimate, FALLBACK_RATE_CARDS, DISCOUNT_CATEGORIES, getDefaultDiscountPct,
  OVERFLOW_PER_GUEST_PER_NIGHT, OVERFLOW_MAX_RECOMMENDED, RATE_CARD_MAX_GUESTS, getBedroomEstimate,
  EXTRA_ITEMS,
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

// Builds a wa.me deep-link pre-filled with the quote text, so the owner can
// open the guest's WhatsApp chat with it ready to send (not auto-sent).
// Uses the emoji-safe version — WhatsApp Desktop/Windows renders 4-byte
// (astral-plane) emoji as '�' when text arrives via this URI path.
function buildQuoteWaLink(e) {
  const phone = e.phone
  if (!phone) return null
  const raw = String(phone).replace(/\D/g, '')
  const num = raw.startsWith('91') ? raw : (raw.length === 10 ? `91${raw}` : raw)
  return `https://wa.me/${num}?text=${encodeURIComponent(buildQuote(e, false))}`
}

function fmtQuoteDate(d) {
  const parsed = parseLocalDate(d)
  if (!parsed) return '—'
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Shared pieces every quote variant needs, computed once.
function quoteCore(e) {
  const nights = e.nights || 1
  const billableGuests = (e.adults || 0) + (e.children || 0)
  return {
    nights,
    finalTotal: e.final_offer_amount || e.quote_amount || 0,
    quoteAmount: e.quote_amount || 0,
    discountAmount: e.discount_amount || 0,
    bedroomCount: getBedroomEstimate(e.villa_id || 'dwarka', billableGuests),
    firstName: (e.guest_name || '').trim().split(' ')[0] || 'there',
    fullName: (e.guest_name || '').trim() || 'there',
    guestCount: e.guests_count || billableGuests || 1,
    nightsLabel: nights === 1 ? 'the night' : `${nights} nights`,
  }
}

// rich=true (Generate & copy): full colorful emoji — safe for copy/paste,
// which doesn't go through the URI-decode path that corrupts them on
// WhatsApp Desktop/Windows. rich=false (Send quote in WhatsApp button):
// only BMP-safe symbols (❓ ✨ ✅ ☎), confirmed not to corrupt.
function icons(rich) {
  return {
    pray:      rich ? '🙏 ' : '',
    calendar:  rich ? '📅 ' : '',
    link:      rich ? '🔗 ' : '',
    villa:     rich ? '🏡 ' : '',
    guests:    rich ? '👨‍👩‍👧‍👦 ' : '',
    money:     rich ? '💰 ' : '',
    leaf:      rich ? '🌿 ' : '',
    camera:    rich ? '📸 ' : '',
    gift:      rich ? '🎁 ' : '',
    handshake: rich ? '🤝 ' : '',
    phone:     rich ? '📞 ' : '☎ ',
    sparkle:   '✨ ',
    check:     '✅ ',
    question:  '❓ ',
  }
}

function familiesBlock(ic) {
  return [
    `${ic.leaf}Why families choose us in Guruvayur`,
    `Luxury Villas of Guruvayur is designed specifically for families who want:`,
    ``,
    `* A peaceful, private villa close to the temple`,
    `* Comfortable shared spaces for large family groups`,
    `* A safe, homely environment (not a hotel crowd setup)`,
    `* Support for smooth local travel and Kerala experience planning`,
    ``,
    `We also help many families plan their Kerala stay beyond Guruvayur — Wildlife, Hill Station, Ayurvedic experiences, Kerala martial arts programs, temple visits, and curated local experiences through our trusted network.`,
    ``,
    `${ic.link}Explore Kerala experiences: https://www.luxuryvillasofguruvayur.com/KeralaVacay`,
  ]
}

function linksBlock(ic) {
  return [
    `${ic.camera}Villa details: https://luxuryvillasofguruvayur.com/villa`,
    `${ic.question}FAQs: https://luxuryvillasofguruvayur.com/faq.html`,
  ]
}

function signoffBlock(ic, closingLine) {
  return [
    ``,
    closingLine,
    ``,
    `സസ്നേഹം (Sasneham)`,
    `Biji Sukumar`,
    `Luxury Villas of Guruvayur`,
    `${ic.phone}+91 99950 43283  (GPay available)`,
  ]
}

// ── Default: no discount, no B2B — standard first-contact quote ──
function buildQuoteDefault(e, rich) {
  const c = quoteCore(e)
  const ic = icons(rich)
  return [
    `Namaskaram ${c.firstName},`,
    ``,
    `This is Biji from Luxury Villas of Guruvayur. Thank you for reaching out — we would be truly happy to host your family during your visit to Guruvayur.`,
    ``,
    `We have checked your dates and the villa is available:`,
    `${ic.calendar}Check-in: ${fmtQuoteDate(e.checkin_date)} (after 4:00 PM)`,
    `${ic.calendar}Check-out: ${fmtQuoteDate(e.checkout_date)} (by 11:00 AM)`,
    ``,
    `${ic.link}Timings: https://luxuryvillasofguruvayur.com/faq.html`,
    ``,
    `${ic.villa}Villa: ${c.bedroomCount} Bedrooms | Fully A/C | Private family villa`,
    `${ic.guests}Guests: ${c.guestCount}`,
    `${ic.money}Your Direct Booking Rate: ${fmt(c.finalTotal)} (all inclusive for ${c.nightsLabel})`,
    `(includes early check-in / late check-out flexibility where possible)`,
    ``,
    ...familiesBlock(ic),
    ``,
    ...linksBlock(ic),
    ...signoffBlock(ic, `If this works for your plans, I can go ahead and block the dates for you. We make every effort to respond to you with the best experience throughout your journey, so please respond to us with whatever decision you may make. We look forward to making your stay a memorable one.${rich ? ' 🙏' : ''}`),
  ].join('\n')
}

// ── Repeat / loyalty guest — lead with the discount, make it feel special ──
function buildQuoteRepeatDiscount(e, rich) {
  const c = quoteCore(e)
  const ic = icons(rich)
  const label = e.discount_category
    ? (DISCOUNT_CATEGORIES.find(cat => cat.id === e.discount_category)?.label || 'Valued Guest')
    : 'Returning Guest'
  const pct = e.discount_category ? e.discount_pct : e.repeat_discount_pct
  return [
    `Namaskaram ${c.firstName},`,
    ``,
    `This is Biji from Luxury Villas of Guruvayur. Wonderful to hear from you again — it's always a pleasure to welcome back our guests!`,
    ``,
    `We have checked your dates and the villa is available:`,
    `${ic.calendar}Check-in: ${fmtQuoteDate(e.checkin_date)} (after 4:00 PM)`,
    `${ic.calendar}Check-out: ${fmtQuoteDate(e.checkout_date)} (by 11:00 AM)`,
    ``,
    `${ic.link}Timings: https://luxuryvillasofguruvayur.com/faq.html`,
    ``,
    `${ic.villa}Villa: ${c.bedroomCount} Bedrooms | Fully A/C | Private family villa`,
    `${ic.guests}Guests: ${c.guestCount}`,
    ``,
    `${ic.gift}As a ${label}, we're delighted to offer you a special discounted rate this time!`,
    `${ic.money}Regular Tariff: ${fmt(c.quoteAmount)}`,
    `${ic.gift}${label} Discount (${pct}%): −${fmt(c.discountAmount)}`,
    `${ic.sparkle}Your Special Rate: ${fmt(c.finalTotal)} (all inclusive for ${c.nightsLabel})`,
    `(includes early check-in / late check-out flexibility where possible)`,
    ``,
    `Thank you for continuing to choose us — we truly value your loyalty and look forward to hosting you again.${rich ? ' 🌿' : ''}`,
    ``,
    ...linksBlock(ic),
    ...signoffBlock(ic, `If this works for your plans, I can go ahead and block the dates for you.`),
  ].join('\n')
}

// ── B2B / travel partner — call out the commission clearly and positively ──
function buildQuoteB2B(e, rich) {
  const c = quoteCore(e)
  const ic = icons(rich)
  const label = DISCOUNT_CATEGORIES.find(cat => cat.id === e.discount_category)?.label || 'Partner'
  return [
    `Namaskaram ${c.fullName},`,
    ``,
    `This is Biji from Luxury Villas of Guruvayur. Thank you for checking availability with us for your guest's stay in Guruvayur.`,
    ``,
    `We have checked the dates and the villa is available:`,
    `${ic.calendar}Check-in: ${fmtQuoteDate(e.checkin_date)} (after 4:00 PM)`,
    `${ic.calendar}Check-out: ${fmtQuoteDate(e.checkout_date)} (by 11:00 AM)`,
    ``,
    `${ic.link}Timings: https://luxuryvillasofguruvayur.com/faq.html`,
    ``,
    `${ic.villa}Villa: ${c.bedroomCount} Bedrooms | Fully A/C | Private family villa`,
    `${ic.guests}Guests: ${c.guestCount}`,
    ``,
    `${ic.handshake}As our valued ${label}, here's your special partner pricing:`,
    `${ic.money}Guest-facing Tariff: ${fmt(c.quoteAmount)}`,
    `${ic.handshake}Your Commission (${e.discount_pct}%): ${fmt(c.discountAmount)}`,
    `${ic.check}Net Payable to Us: ${fmt(c.finalTotal)} (all inclusive for ${c.nightsLabel})`,
    ``,
    `You're welcome to quote your guest up to ${fmt(c.quoteAmount)} — your margin is built right in. Looking forward to a great partnership on this booking!${rich ? ' 🌿' : ''}`,
    ``,
    ...linksBlock(ic),
    ...signoffBlock(ic, `If this works, let me know and I'll go ahead and block the dates.`),
  ].join('\n')
}

// rich=true for "Generate & copy" (colorful, safe for copy/paste),
// rich=false for the "Send quote in WhatsApp" wa.me link (BMP-safe only —
// see buildQuoteWaLink).
function buildQuote(e, rich = true) {
  const isB2B = e.discount_category === 'b2b_india' || e.discount_category === 'b2b_intl'
  const isRepeatDiscount = !isB2B && (
    ['loyal_patron', 'elite_guest', 'platinum_guest'].includes(e.discount_category) ||
    (!e.discount_category && (e.repeat_discount_pct || 0) > 0)
  )
  if (isB2B) return buildQuoteB2B(e, rich)
  if (isRepeatDiscount) return buildQuoteRepeatDiscount(e, rich)
  return buildQuoteDefault(e, rich)
}

export default function EnquiryDetail() {
  const navigate = useNavigate()
  const { enquiryId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [commType, setCommType] = useState('whatsapp')
  const [addingPhone, setAddingPhone] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState('')
  const [phoneBusy, setPhoneBusy] = useState(false)
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
  const [extraLines, setExtraLines] = useState([])             // [{label, amount}]
  const [extraBusy, setExtraBusy] = useState(false)

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
        try { setExtraLines(en.extra_lines ? JSON.parse(en.extra_lines) : []) }
        catch { setExtraLines([]) }
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
  const extraTotal = extraLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)

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
        extraCharges: e.extra_charges || 0, extraLines: e.extra_lines || null,
        status: e.status, notes: e.notes,
      })
      showToast('Discount updated ✓')
      load()
    } catch { showToast('Failed to update discount', 'error') }
    finally { setDiscountBusy(false) }
  }

  // Inline phone add — unlocks the 'Send quote in WhatsApp' button without
  // leaving the screen. Reuses saveEnquiry's update path (full payload, only
  // phone changes), which also normalizes and links the guest record.
  const handleSavePhone = async () => {
    const digits = String(phoneDraft).replace(/\D/g, '')
    if (digits.length < 10) { showToast('Enter a valid phone number (10+ digits)', 'error'); return }
    setPhoneBusy(true)
    try {
      await api.saveEnquiry({
        enquiryId, villaId: e.villa_id || 'dwarka', guestId: e.guest_id,
        guestName: e.guest_name, phone: phoneDraft.trim(), email: e.email, source: e.source,
        checkInDate: e.checkin_date, checkOutDate: e.checkout_date,
        adults: e.adults, children: e.children, infants: e.infants, guestsCount: e.guests_count,
        purpose: e.purpose, quoteAmount: e.quote_amount,
        repeatDiscountPct: e.repeat_discount_pct || 0,
        discountCategory: e.discount_category || null,
        discountPct: e.discount_pct || 0,
        extraCharges: e.extra_charges || 0, extraLines: e.extra_lines || null,
        status: e.status, notes: e.notes,
      })
      showToast('Phone added ✓ — WhatsApp send unlocked')
      setAddingPhone(false); setPhoneDraft('')
      load()
    } catch (err2) { showToast('Failed: ' + err2.message, 'error') }
    finally { setPhoneBusy(false) }
  }

  const handleSaveExtras = async () => {
    if (!e) return
    setExtraBusy(true)
    try {
      await api.saveEnquiry({
        enquiryId, villaId: e.villa_id || 'dwarka', guestId: e.guest_id,
        guestName: e.guest_name, phone: e.phone, email: e.email, source: e.source,
        checkInDate: e.checkin_date, checkOutDate: e.checkout_date,
        adults: e.adults, children: e.children, infants: e.infants, guestsCount: e.guests_count,
        purpose: e.purpose, quoteAmount: e.quote_amount,
        repeatDiscountPct: e.discount_category ? 0 : e.repeat_discount_pct,
        discountCategory: e.discount_category || null, discountPct: e.discount_category ? e.discount_pct : 0,
        extraCharges: extraTotal, extraLines: JSON.stringify(extraLines),
        status: e.status, notes: e.notes,
      })
      showToast('Extra charges updated ✓')
      load()
    } catch { showToast('Failed to update extra charges', 'error') }
    finally { setExtraBusy(false) }
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
        extraCharges: e.extra_charges || 0, extraLines: e.extra_lines || null,
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
        extraCharges: e.extra_charges || 0, extraLines: e.extra_lines || null,
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
                  <option value="">No category — use Repeat Guest % below</option>
                  {DISCOUNT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <div className="field-label">
                  {discountParams.discountCategory ? 'Discount %' : 'Repeat guest discount % (0 = no discount)'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" min="0" max="100" className="field-input" value={discountParams.discountPct}
                    onChange={e2 => setDiscountParams(p => ({ ...p, discountPct: e2.target.value }))} style={{ flex: 1, minWidth: 0 }} />
                  <button type="button" className="btn" onClick={handleSaveDiscount} disabled={discountBusy}
                    style={{ width: 'auto', flex: '0 0 auto', whiteSpace: 'nowrap', padding: '0 16px' }}>
                    {discountBusy ? 'Saving...' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Extra charge line items — e.g. Additional Guest, added on top of quote, not discounted */}
          <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-dim)' }}>
            <div className="field" style={{ marginBottom: extraLines.length ? '8px' : 0 }}>
              <div className="field-label">Add extra charge</div>
              <select className="field-input" value="" onChange={e2 => {
                if (!e2.target.value) return
                const item = EXTRA_ITEMS.find(x => x.label === e2.target.value)
                setExtraLines(prev => [...prev, { label: item.label, amount: item.amount }])
                e2.target.value = ''
              }}>
                <option value="">+ Add item… (e.g. Additional Guest)</option>
                {EXTRA_ITEMS.map(x => <option key={x.label} value={x.label}>{x.label}</option>)}
              </select>
            </div>
            {extraLines.map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text)' }}>{line.label}</span>
                <input type="number" value={line.amount} placeholder="0"
                  onChange={e2 => setExtraLines(prev => prev.map((l, j) => j === i ? { ...l, amount: e2.target.value } : l))}
                  style={{ width: '90px', padding: '5px 8px', borderRadius: '6px',
                    background: 'var(--dark-input)', border: '1px solid var(--border-dim)',
                    color: 'var(--gold)', fontWeight: '600', fontSize: '0.85rem', textAlign: 'right' }} />
                <button onClick={() => setExtraLines(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              </div>
            ))}
            {extraLines.length > 0 && (
              <button type="button" className="btn" onClick={handleSaveExtras} disabled={extraBusy} style={{ width: '100%', marginTop: '4px' }}>
                {extraBusy ? 'Saving...' : `Save extra charges (₹${extraTotal.toLocaleString('en-IN')})`}
              </button>
            )}
          </div>

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
            {e.extra_charges > 0 && (() => {
              let savedLines = []
              try { savedLines = e.extra_lines ? JSON.parse(e.extra_lines) : [] } catch { savedLines = [] }
              return savedLines.filter(l => (parseFloat(l.amount) || 0) > 0).map((l, i) => (
                <div key={i} className="net-row">
                  <span className="net-label">{l.label}</span>
                  <span className="net-val pos">+{fmt(l.amount)}</span>
                </div>
              ))
            })()}
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
          {e.phone ? (
            <a href={buildQuoteWaLink(e)} target="_blank" rel="noreferrer"
              className="btn"
              style={{
                marginTop: '8px', display: 'block', textAlign: 'center', textDecoration: 'none',
                background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)',
                color: '#25D366', fontWeight: '700',
              }}>
              💬 Send quote in WhatsApp
            </a>
          ) : (
            !addingPhone ? (
              <button onClick={() => { setAddingPhone(true); setPhoneDraft('+91') }} style={{
                marginTop: '8px', padding: '10px 14px', borderRadius: '10px', textAlign: 'center',
                background: 'rgba(37,211,102,0.08)', border: '1px dashed rgba(37,211,102,0.35)',
                color: '#25D366', fontSize: '0.78rem', fontWeight: 600, width: '100%', cursor: 'pointer',
              }}>
                💬 Add phone number to send via WhatsApp
              </button>
            ) : (
              <div style={{
                marginTop: '8px', padding: '10px 12px', borderRadius: '10px',
                background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.25)',
              }}>
                <div className="field-label" style={{ marginBottom: '4px' }}>Mobile / WhatsApp</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="tel" className="field-input" autoFocus placeholder="+91 98765 43210"
                    value={phoneDraft} onChange={ev => setPhoneDraft(ev.target.value)}
                    onKeyDown={ev => { if (ev.key === 'Enter') handleSavePhone() }}
                    style={{ flex: '1 1 auto', minWidth: 0, fontSize: '0.85rem', marginBottom: 0 }} />
                  <button className="btn btn-gold" disabled={phoneBusy} onClick={handleSavePhone}
                    style={{ flex: '0 0 auto', width: 'auto', padding: '8px 16px', fontSize: '0.8rem', marginBottom: 0 }}>
                    {phoneBusy ? '…' : 'Save'}
                  </button>
                  <button className="btn" disabled={phoneBusy} onClick={() => { setAddingPhone(false); setPhoneDraft('') }}
                    style={{ flex: '0 0 auto', width: 'auto', padding: '8px 12px', fontSize: '0.8rem', marginBottom: 0 }}>
                    ✕
                  </button>
                </div>
              </div>
            )
          )}

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
