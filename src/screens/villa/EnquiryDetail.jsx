/**
 * EnquiryDetail.jsx   (route /owner/villa/enquiries/:enquiryId)
 *
 * What it is: everything for ONE enquiry: pricing from the rate card, seasons and discounts, extra charges (with the early check-in / late check-out
 * hours), the WhatsApp quote (copy it or send it), the communication log, status changes, and Confirm Booking (make the stay, or link the enquiry to
 * the guest's existing one). The words of the quote are in src/utils/enquiryQuote.js.
 *
 * WHAT CHANGED (newest first)
 *   2026-11-27  The quote text moved out to src/utils/enquiryQuote.js so the Complete booking "Go direct?" card sends the same quote. Nothing an
 *               enquiry's quote says has changed (checked word for word against the old code).
 *   2026-11-23  The quote says the early check-in / late check-out hour the guest asked for; a "Not saved yet" note for typed-but-unsaved extras;
 *               the Save button stays when the last extra line is removed (5e095a9).
 *   2026-11-08  Website visit card: where a website guest was, what they used and what they checked first (9f3f94f).
 *   2026-11-07  "Started by" label next to names; the owner's email links straight to the enquiry (47d5a23).
 *   2026-10-30  No platform rule in the code: one config file per booking platform (b46b346).
 *   2026-10-28  Busy-season prices night by night in every quote; the regular price beside a season's (df0dea2, c817620).
 *   2026-10-15  The "not available" reply also lives here, and sending it is logged (3c01caa).
 *   2026-10-05  The quote leads with the villa-pictures link (f1b54b0).
 *   Older history: git log --follow src/screens/villa/EnquiryDetail.jsx
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBack } from '../../utils/navTrail'
import { api } from '../../api'
import { STATUS_META, enquirySourceLabel, LOST_REASONS } from './EnquiryTracker'
import { parseLocalDate, localTodayStr, fmtStampYear } from '../../utils/dates'
import DatePicker from '../../components/DatePicker'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'
import { addDays } from '../../utils/stayHolds'
import AvailabilityNote from '../../components/AvailabilityNote'
import InitiatorBadge, { initiatedBy } from '../../components/InitiatorBadge'
import { groupNights } from '../../utils/seasonRates'
import { buildQuote, buildQuoteWaLink } from '../../utils/enquiryQuote'
import {
  getSeasonalEstimate, estimateNotes, describeEstimate, FALLBACK_RATE_CARDS, DISCOUNT_CATEGORIES, getDefaultDiscountPct,
  EXTRA_ITEMS,
} from '../../utils/villaPricing'

function fmt(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }
// occurred_at is a stored moment (UTC): shown as the clock at the property (utils/tz.js)
function fmtDateTime(d) { return d ? fmtStampYear(d) : '' }

// Same loose word-containment check as the worker's getEnquiryMatchCandidates —
// "Karthikeyan" is fully contained in "Karthikeyan Dhanasekaran". Used here to
// decide whether a same-dates double-booking conflict is actually the same
// guest under a different name/contact, not a real stranger conflict.
function namesOverlap(a, b) {
  const words = n => (n || '').toLowerCase().trim().split(/\s+/).filter(Boolean)
  const wa = words(a), wb = words(b)
  if (!wa.length || !wb.length) return false
  const [shorter, longer] = wa.length <= wb.length ? [wa, wb] : [wb, wa]
  return shorter.every(w => longer.includes(w))
}

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

export default function EnquiryDetail() {
  const navigate = useNavigate()
  const goBack = useBack()
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
  const [seasons, setSeasons] = useState([])   // the busy seasons (Rates page); none until the owner adds one
  const [pricingParams, setPricingParams] = useState(null)   // { checkInDate, checkOutDate, adults, children, infants }
  const [pricingNote, setPricingNote] = useState(null)
  const [pricingBusy, setPricingBusy] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [discountParams, setDiscountParams] = useState(null)   // { discountCategory, discountPct }
  const [discountBusy, setDiscountBusy] = useState(false)
  const [extraLines, setExtraLines] = useState([])             // [{label, amount, earlyCheckinTime?, lateCheckoutTime?}]
  const [extraBusy, setExtraBusy] = useState(false)
  const [turnaroundInfo, setTurnaroundInfo] = useState(null)
  const [avail, setAvail] = useState(undefined)   // checkAvailability for this enquiry's dates (see below)

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
    api.getRateCard(DEFAULT_VILLA_ID).then(d => {
      if (d?.rateCard?.length) setRateCard(d.rateCard)
      if (Array.isArray(d?.seasons)) setSeasons(d.seasons)
    }).catch(() => {})
  }, [])

  const e = data?.enquiry
  const webVisit = data?.webVisit || null   // where the guest was, what they used and what they checked first (enquiries from the website's estimate page)
  const extraTotal = extraLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const earlyLine = extraLines.find(l => (l.label || '').includes('Early Check-in'))
  const lateLine  = extraLines.find(l => (l.label || '').includes('Late Check-out'))
  const requestedEarlyTime = earlyLine?.earlyCheckinTime || ''
  const requestedLateTime  = lateLine?.lateCheckoutTime || ''
  // Charges and times typed on this screen reach the quote only once they are SAVED: the quote is built from the saved enquiry.
  const savedExtraJson = (() => { try { return JSON.stringify(e?.extra_lines ? JSON.parse(e.extra_lines) : []) } catch { return '[]' } })()
  const extrasDirty = !!e && JSON.stringify(extraLines) !== savedExtraJson

  // Live cleaning-turnaround check as soon as a specific time is set on an
  // Early Check-in / Late Check-out line — flags whether there's enough
  // buffer against whoever checks out/in on the adjacent date, per the
  // villa's configured turnaround-hours setting.
  useEffect(() => {
    if (!e || (!requestedEarlyTime && !requestedLateTime)) { setTurnaroundInfo(null); return }
    let alive = true
    api.checkTurnaroundGap({
      villaId: e.villa_id || DEFAULT_VILLA_ID,
      checkinDate: e.checkin_date, checkoutDate: e.checkout_date,
      earlyCheckinTime: requestedEarlyTime || undefined, lateCheckoutTime: requestedLateTime || undefined,
    }).then(r => { if (alive) setTurnaroundInfo(r) }).catch(() => { if (alive) setTurnaroundInfo(null) })
    return () => { alive = false }
  }, [requestedEarlyTime, requestedLateTime, e?.checkin_date, e?.checkout_date])

  // Are this enquiry's dates still free? A saved enquiry can be overtaken by a booking or a
  // platform block after it came in; when they are not, a reply card offers other dates and a
  // "not available" message. Not asked for a settled enquiry (confirmed, lost, cancelled: a
  // confirmed one would meet its own booking) nor for dates that have passed.
  useEffect(() => {
    const ci = e?.checkin_date ? String(e.checkin_date).slice(0, 10) : ''
    const co = e?.checkout_date ? String(e.checkout_date).slice(0, 10) : ''
    const open = !!e && !['confirmed', 'lost', 'cancelled'].includes(e.status)
    if (!open || !ci || !co || co <= ci || co < localTodayStr()) { setAvail(undefined); return }
    let alive = true
    api.checkAvailability({ villaId: e.villa_id || DEFAULT_VILLA_ID, checkIn: ci, checkOut: co })
      .then(d => { if (alive) setAvail(d || undefined) })
      .catch(() => { if (alive) setAvail(undefined) })
    return () => { alive = false }
  }, [e?.status, e?.checkin_date, e?.checkout_date])

  // The "not available" reply was opened in WhatsApp: log it as a communication (which also
  // restarts the "days since contact" clock), set a follow-up for two days on, and move a New
  // enquiry to Follow-Up Needed.
  const handleReplySent = async ({ note }) => {
    try {
      await api.logCommunication({ enquiryId, type: 'whatsapp', notes: note,
        followUpDue: addDays(localTodayStr(), 2),
        status: e.status === 'new' ? 'follow_up_needed' : undefined })
      showToast('Reply logged ✓')
      load()
    } catch { showToast('WhatsApp opened, but the reply could not be logged', 'error') }
  }

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
    } catch (err) {
      // This guest already has a real stay — created directly via New
      // Booking or the online check-in form, bypassing this enquiry
      // entirely (the actual cause of enquiries stuck on "Quoted" forever
      // even after the guest's stay is long confirmed/checked-in). Offer
      // to link this enquiry to that existing stay instead of blocking.
      if (err.code === 'same_guest_existing_stay' && err.existingStayId) {
        const ok = window.confirm(
          `${e?.guest_name || 'This guest'} already has a stay on record (${err.existingStayId}) — ` +
          `probably booked directly instead of through this enquiry.\n\n` +
          `Mark this enquiry Confirmed and link it to that existing stay?`
        )
        if (ok) {
          try {
            await api.linkEnquiryToExistingStay({ enquiryId, stayId: err.existingStayId })
            showToast(`Linked to existing stay ${err.existingStayId} ✓`)
            setShowConfirmPicker(false)
            load()
          } catch (linkErr) { showToast(linkErr.message || 'Failed to link', 'error') }
        }
      } else if (err.code === 'double_booking' && err.conflict) {
        // The server's strict same-guest check (guest_id/phone/email/exact
        // name) missed this one — e.g. enquiry came in on a family member's
        // phone, guest checked in on their own, or (the case that motivated
        // dropping the namesOverlap gate here) the enquiry's guest_name is
        // actually an agent/OTA business name rather than the traveler's own
        // name, so it shares no words with the guest who later checked in
        // directly. Always offer the link-instead-of-block resolution — never
        // silently dead-end — but scale the wording to how confident the
        // word-overlap heuristic is, so a genuine stranger conflict still
        // reads as a real warning rather than a routine "same person" ask.
        const c = err.conflict
        const likelySamePerson = namesOverlap(e?.guest_name, c.guest_name)
        const ok = window.confirm(
          likelySamePerson
            ? `${e?.guest_name || 'This guest'} didn't exactly match, but "${c.guest_name}" already has a stay ` +
              `on these same dates (${c.stay_id}: ${c.checkin_date} → ${c.checkout_date}) — likely the same guest, ` +
              `enquired and checked in with different contact details.\n\n` +
              `Mark this enquiry Confirmed and link it to that existing stay?`
            : `The villa is already booked ${c.checkin_date} → ${c.checkout_date} for "${c.guest_name}" — a ` +
              `different name from this enquiry's "${e?.guest_name || 'guest'}", so this may be an agent/OTA ` +
              `booking recorded under the agent's name rather than the traveler's.\n\n` +
              `If "${c.guest_name}" IS the same person who made this enquiry (e.g. via ${e?.guest_name || 'an agent'}), ` +
              `press OK to mark this enquiry Confirmed and link it to that existing stay.\n\n` +
              `If these are genuinely two different guests, press Cancel — proceeding would double-book the villa.`
        )
        if (ok) {
          try {
            await api.linkEnquiryToExistingStay({ enquiryId, stayId: c.stay_id })
            showToast(`Linked to existing stay ${c.stay_id} ✓`)
            setShowConfirmPicker(false)
            load()
          } catch (linkErr) { showToast(linkErr.message || 'Failed to link', 'error') }
        }
      } else {
        showToast(err.message || 'Failed to confirm — check for date conflicts', 'error')
      }
    }
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

  // A confirmed booking can still fall through afterward (couldn't
  // accommodate, guest cancelled, refunded, etc.) — there's otherwise no
  // way back out of "Confirmed" from this screen. Also cancels the linked
  // stay if it's still active, so the two don't drift out of sync.
  const handleCancelBooking = async () => {
    const reason = window.prompt(`Cancel ${e?.guest_name || 'this'}'s confirmed booking? The enquiry (and its linked stay, if still active) will be marked cancelled. Reason:`, 'refunded / could not accommodate')
    if (reason === null) return
    setBusy(true)
    try {
      const result = await api.cancelConfirmedEnquiry({ enquiryId, reason: reason || 'booking cancelled' })
      showToast(result?.stayAlsoCancelled ? `Cancelled — stay ${result.stayId} also cancelled ✓` : 'Booking cancelled ✓')
      load()
    } catch (err) { showToast(err.message || 'Failed to cancel', 'error') }
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
        enquiryId, villaId: e.villa_id || DEFAULT_VILLA_ID, guestId: e.guest_id,
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
        enquiryId, villaId: e.villa_id || DEFAULT_VILLA_ID, guestId: e.guest_id,
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
        enquiryId, villaId: e.villa_id || DEFAULT_VILLA_ID, guestId: e.guest_id,
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
        enquiryId, villaId: e.villa_id || DEFAULT_VILLA_ID, guestId: e.guest_id,
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

  // The saved quote with its season breakdown, when that quote IS the seasonal estimate for these dates and party (an amount typed by
  // hand has no breakdown to show, so it is quoted as a plain rate like before).
  const withSeasons = (en) => {
    if (!en || !seasons.length) return en
    const est = getSeasonalEstimate(rateCard, seasons, { adults: en.adults, children: en.children, checkIn: en.checkin_date, checkOut: en.checkout_date })
    return est.seasonal && Math.round(Number(en.quote_amount) || 0) === est.total ? { ...en, _seasonGroups: groupNights(est.perNight) } : en
  }

  const handleCopyQuote = () => {
    if (!e) return
    navigator.clipboard.writeText(buildQuote(withSeasons(e))).then(() => showToast('Quote copied — paste into WhatsApp ✓'))
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

    // night by night: a stay that runs into a busy season pays that season's price for those nights (Rates page)
    const estimate = getSeasonalEstimate(rateCard, seasons, { adults: adultsNum, children: childrenNum, checkIn: pricingParams.checkInDate, checkOut: pricingParams.checkOutDate })
    setPricingNote(estimateNotes(estimate))

    setPricingBusy(true)
    try {
      // Re-save the full enquiry with updated dates/guest-counts/quote, preserving
      // everything else (discount category, notes, status, etc.) exactly as-is.
      const discountPct = e.discount_category ? (e.discount_pct || 0) : (e.repeat_discount_pct || 0)
      const discountAmount = Math.round(estimate.total * discountPct) / 100
      await api.saveEnquiry({
        enquiryId, villaId: e.villa_id || DEFAULT_VILLA_ID, guestId: e.guest_id,
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
      showToast(estimate.seasonal
        ? `Estimated ${fmt(estimate.total)}: ${describeEstimate(estimate)} — saved ✓`
        : `Estimated ₹${estimate.tariffPerNight.toLocaleString('en-IN')}/night × ${nights} night${nights === 1 ? '' : 's'} — saved ✓`)
      load()
    } catch { showToast('Failed to save pricing', 'error') }
    finally { setPricingBusy(false) }
  }

  if (loading || !e) {
    return (
      <div className="screen">
        <div className="topbar">
          <button className="back-btn" onClick={goBack}>‹</button>
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
        <button className="back-btn" onClick={goBack}>‹</button>
        <div>
          <div className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{e.guest_name} <InitiatorBadge createdBy={e.created_by} /></div>
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
            🎯 {e.purpose === 'Other' && e.purpose_other ? e.purpose_other : (e.purpose || '—')} · via {enquirySourceLabel(e.source)} · started by {initiatedBy(e.created_by)?.label || '—'}
          </div>
        </div>

        {webVisit && (
          <>
            <div className="card-section-label" style={{ marginTop: '14px' }}>WEBSITE VISIT</div>
            <div className="card" style={{ padding: '12px 14px' }} data-testid="web-visit">
              {webVisit.facts.map(f => (
                <div key={f.key} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.78rem', lineHeight: 1.6, marginBottom: '4px' }}>
                  <span style={{ width: '18px', flex: '0 0 auto', textAlign: 'center' }}>{f.icon}</span>
                  <span style={{ color: '#5C7080', flex: '0 0 auto', minWidth: '92px' }}>{f.label}</span>
                  <span style={{ color: 'var(--text)', flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                    {f.value}
                    {f.warn ? <strong style={{ color: '#EF4444' }}> · {f.warn}</strong> : null}
                    {f.lines && f.lines.length > 0 ? <div style={{ color: '#5C7080', marginTop: '2px' }}>{f.lines.map((l, i) => <div key={i}>{l}</div>)}</div> : null}
                  </span>
                </div>
              ))}
              <div style={{ color: '#5C7080', fontSize: '0.66rem', marginTop: '6px' }}>
                The place comes from the guest's internet connection, not their phone's GPS, so treat the city as a good guess.
              </div>
            </div>
          </>
        )}

        {!isFinal && avail && avail !== 'loading' && avail.available === false && (
          <div className="card" style={{ padding: '12px 14px', marginTop: '10px' }}>
            <AvailabilityNote quiet avail={avail} checkIn={e.checkin_date} checkOut={e.checkout_date}
              guestName={e.guest_name} phone={e.phone}
              onReplySent={handleReplySent} onToast={showToast} style={{ margin: 0 }} />
          </div>
        )}

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
            {(e.nights || 0) > 0 && (() => {
              const perNight = Math.round(((e.quote_amount || 0) - (e.discount_amount || 0)) / e.nights)
              return (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px',
                  padding: '8px 10px', borderRadius: '8px', background: 'rgba(200,144,58,0.06)',
                  border: '1px solid rgba(200,144,58,0.15)', fontSize: '0.72rem', color: 'var(--text-dim)',
                }}>
                  <span>Per night: <strong style={{ color: 'var(--gold)' }}>{fmt(perNight)}</strong></span>
                  <span>25%: <strong style={{ color: 'var(--gold)' }}>{fmt(Math.round(perNight * 0.25))}</strong></span>
                  <span>50%: <strong style={{ color: 'var(--gold)' }}>{fmt(Math.round(perNight * 0.5))}</strong></span>
                </div>
              )
            })()}
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
            {extraLines.map((line, i) => {
              const isEarly = (line.label || '').includes('Early Check-in')
              const isLate  = (line.label || '').includes('Late Check-out')
              return (
                <div key={i} style={{ marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text)' }}>{line.label}</span>
                    <input type="number" value={line.amount} placeholder="0"
                      onChange={e2 => setExtraLines(prev => prev.map((l, j) => j === i ? { ...l, amount: e2.target.value } : l))}
                      style={{ width: '90px', padding: '5px 8px', borderRadius: '6px',
                        background: 'var(--dark-input)', border: '1px solid var(--border-dim)',
                        color: 'var(--gold)', fontWeight: '600', fontSize: '0.85rem', textAlign: 'right' }} />
                    <button onClick={() => setExtraLines(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                  </div>
                  {(isEarly || isLate) && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px', paddingLeft: '2px' }}>
                      {isEarly && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                          Arrival time
                          <input type="time" value={line.earlyCheckinTime || ''}
                            onChange={e2 => setExtraLines(prev => prev.map((l, j) => j === i ? { ...l, earlyCheckinTime: e2.target.value } : l))}
                            style={{ padding: '4px 6px', borderRadius: '6px', background: 'var(--dark-input)',
                              border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.78rem' }} />
                        </label>
                      )}
                      {isLate && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                          Departure time
                          <input type="time" value={line.lateCheckoutTime || ''}
                            onChange={e2 => setExtraLines(prev => prev.map((l, j) => j === i ? { ...l, lateCheckoutTime: e2.target.value } : l))}
                            style={{ padding: '4px 6px', borderRadius: '6px', background: 'var(--dark-input)',
                              border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.78rem' }} />
                        </label>
                      )}
                    </div>
                  )}
                  {(() => {
                    // The hour is what the quote and the booking will say; without it the quote can only name the fee.
                    const missing = [isEarly && !line.earlyCheckinTime && 'arrival', isLate && !line.lateCheckoutTime && 'departure'].filter(Boolean)
                    return missing.length ? (
                      <div style={{ fontSize: '0.68rem', color: '#C8903A', marginTop: '3px', paddingLeft: '2px' }}>
                        Add the {missing.join(' and ')} time{missing.length > 1 ? 's' : ''} and press Save: the quote then says it, and the booking keeps it.
                      </div>
                    ) : null
                  })()}
                </div>
              )
            })}
            {turnaroundInfo && (turnaroundInfo.early?.tooClose || turnaroundInfo.late?.tooClose) && (
              <div style={{ fontSize: '0.75rem', padding: '8px 10px', borderRadius: '8px', marginBottom: '10px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>
                {turnaroundInfo.early?.tooClose && (
                  <div>⚠️ Only {Math.max(0, Math.round(turnaroundInfo.early.gapMinutes))} min after {turnaroundInfo.early.adjacentGuest}'s check-out ({turnaroundInfo.early.departTime}) — less than the {turnaroundInfo.turnaroundHours}h cleaning window.</div>
                )}
                {turnaroundInfo.late?.tooClose && (
                  <div>⚠️ Only {Math.max(0, Math.round(turnaroundInfo.late.gapMinutes))} min before {turnaroundInfo.late.adjacentGuest}'s check-in ({turnaroundInfo.late.arriveTime}) — less than the {turnaroundInfo.turnaroundHours}h cleaning window.</div>
                )}
              </div>
            )}
            {(extraLines.length > 0 || extrasDirty) && (
              <>
                {extrasDirty && (
                  <div style={{ fontSize: '0.7rem', color: '#C8903A', margin: '2px 0 4px' }}>
                    Not saved yet: the quote is built from what is saved, so press Save before you copy or send it.
                  </div>
                )}
                <button type="button" className="btn" onClick={handleSaveExtras} disabled={extraBusy} style={{ width: '100%', marginTop: '4px' }}>
                  {extraBusy ? 'Saving...' : `Save extra charges (₹${extraTotal.toLocaleString('en-IN')})`}
                </button>
              </>
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
                <span className="net-label">Per Night Rate ({e.nights}n)</span>
                <span className="net-val">{fmt(Math.round(((e.quote_amount || 0) - (e.discount_amount || 0)) / e.nights))}</span>
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
            <a href={buildQuoteWaLink(withSeasons(e))} target="_blank" rel="noreferrer"
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

        {e.status === 'confirmed' && (
          <>
            <div className="card-section-label" style={{ marginTop: '14px' }}>ACTIONS</div>
            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '10px' }}>
                Booking fell through after confirming — couldn't accommodate, guest cancelled, refunded, etc.
              </div>
              <button onClick={handleCancelBooking} disabled={busy} className="btn"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                {busy ? 'Cancelling...' : '🚫 Cancel booking'}
              </button>
            </div>
          </>
        )}

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
