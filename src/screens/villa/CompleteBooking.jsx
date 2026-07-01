/**
 * CompleteBooking.jsx
 * Renamed from VillaRentalIncome.
 *
 * Purpose: Owner reviews upcoming bookings, updates financial details,
 * confirms documents are uploaded, and marks guest as Ready for Check-in.
 *
 * Lifecycle this screen manages:
 *   booked / confirmed → [owner reviews + adds financials] → docs_uploaded → ready_for_checkin
 *
 * After ready_for_checkin: Raman's CheckIn screen takes over.
 *
 * Route: /owner/villa/income  (kept same route so no App.jsx change needed)
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { parseLocalDate } from '../../utils/dates'
import { buildArrivalWaLink } from '../../utils/arrivalMessage'

const CHANNELS   = ['Direct','Airbnb','MakeMyTrip','Booking.com','Goibibo','Expedia','VRBO','Other']

// Extra charge line items — each has a label and default amount
const EXTRA_ITEMS = [
  { label: 'Early Check-in',              amount: 500  },
  { label: 'Late Check-out',              amount: 500  },
  { label: 'Early Check-in + Late Check-out', amount: 1000 },
  { label: 'Breakfast',                   amount: 0    },
  { label: 'Floor Bed',                   amount: 750  },
  { label: 'Additional Guest',            amount: 0    },
  { label: 'Taxi Pick-up',                amount: 0    },
  { label: 'Drop-off & Pick-up',          amount: 0    },
  { label: 'Cleaning Fee',                amount: 1000 },
  { label: 'Other',                       amount: 0    },
]

// Airbnb-specific fee structure (from confirmation email)
const EMPTY_AIRBNB = {
  nightFee: '', nights: 1, cleaningFee: '', hostServiceFee: '',
  guestServiceFee: '', youEarn: '', guestPaid: '',
}
// Airbnb: 3% HOST fee only (guest pays 15% separately — not your deduction)
// Host-side commission % only (what OTA deducts from your payout)
// Airbnb: 3% host fee. Booking.com: 15%. MakeMyTrip/Goibibo: 18%. Expedia/VRBO: 3% (similar to Airbnb)
const COMMISSION = { Direct:0, Airbnb:3, MakeMyTrip:18, 'Booking.com':15, Goibibo:18, Expedia:3, VRBO:3, Other:10 }

// Status badge config
const STATUS_META = {
  booked:             { label:'Booked',              color:'#185FA5', bg:'rgba(24,95,165,0.15)'   },
  confirmed:          { label:'Confirmed',           color:'#C8903A', bg:'rgba(200,144,58,0.15)'  },
  docs_uploaded:      { label:'Docs Uploaded',       color:'#8B5CF6', bg:'rgba(139,92,246,0.15)'  },
  ready_for_checkin:  { label:'Ready for Check-in',  color:'#34A853', bg:'rgba(52,168,83,0.15)'   },
  checked_in:         { label:'Checked In',          color:'#34A853', bg:'rgba(52,168,83,0.15)'   },
  ready_for_checkout: { label:'Ready for Check-out', color:'#F59E0B', bg:'rgba(245,158,11,0.15)'  },
  checked_out:        { label:'Checked Out',         color:'#5C7080', bg:'rgba(92,112,128,0.15)'  },
  closed:             { label:'Closed',              color:'#3C5060', bg:'rgba(60,80,96,0.15)'    },
  cancelled:          { label:'Cancelled',           color:'#c62828', bg:'rgba(198,40,40,0.15)'   },
}

function fmt(n) { return isNaN(n)||n===''?'—':`₹${Number(n).toLocaleString('en-IN')}` }
function fmtDate(d) {
  if (!d) return '—'
  try { return parseLocalDate(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) }
  catch { return d }
}
function daysFromNow(d) {
  if (!d) return null
  const parsed = parseLocalDate(d)
  if (!parsed) return null
  const today = new Date()
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((parsed - todayLocal) / (1000*60*60*24))
}

const EMPTY_FORM = { channel:'Direct', tariffPerNight:'', extraCharges:'0', notes:'' }

export default function CompleteBooking() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [stays, setStays]       = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [extraLines, setExtraLines] = useState([])      // [{label, amount}]
  const [airbnb, setAirbnb]         = useState(EMPTY_AIRBNB) // Airbnb fee breakdown
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [toast, setToast]       = useState(null)

  // ── Booked By picker (links a stay to a different enquiry/booking contact
  // when the person who actually checks in isn't the one who booked & paid) ──
  const [bookedByOpen,    setBookedByOpen]    = useState(false)
  const [bookedByQuery,   setBookedByQuery]   = useState('')
  const [bookedByResults, setBookedByResults] = useState([])
  const [bookedBySearching, setBookedBySearching] = useState(false)

  // ── Merge/Link mode: tick 2+ guests in the list, then link them in one
  // step instead of typing a name to search (most useful when both stays
  // are already visible in the same list, e.g. an enquiry's placeholder
  // stay sitting right next to the real stay someone else checked into) ──
  const [mergeMode,     setMergeMode]     = useState(false)
  const [mergeChecked,  setMergeChecked]  = useState([])   // array of stay_id
  const [mergePromptOpen, setMergePromptOpen] = useState(false)
  const [mergeContactId,  setMergeContactId]  = useState(null) // which checked stay_id is the "booked by" contact
  const [mergeGuestMatches, setMergeGuestMatches] = useState({}) // stay_id -> {guest_id, name} | null (not found) | undefined (loading)

  const showToast = (msg, type='success') => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3500)
  }

  useEffect(() => { loadStays() }, [])

  async function loadStays() {
    setLoading(true)
    try {
      const data = await api.getUpcomingStays('dwarka')
      const list = Array.isArray(data) ? data : []
      setStays(list)
      if (list.length > 0) {
        // Deep-link support: if arriving via ?stayId=DWK-... (e.g. from the
        // owner dashboard's "Needs Attention" list), select that exact stay
        // instead of always defaulting to the soonest one.
        const wantedId = searchParams.get('stayId')
        const wanted = wantedId ? list.find(s => s.stay_id === wantedId) : null
        selectStay(wanted || list[0])
      }
    } catch(e) {
      showToast('Could not load bookings: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  function selectStay(stay) {
    setSelected(stay)
    setBookedByOpen(false); setBookedByQuery(''); setBookedByResults([])
    const ch = stay.source
      ? stay.source.charAt(0).toUpperCase() + stay.source.slice(1).replace('_','.')
      : 'Direct'

    const isAirbnb = ch === 'Airbnb'

    // night_fee in DB is the TOTAL night fee (e.g. ₹9,650 for 2 nights).
    // tariff_per_night is the per-night rate (e.g. ₹4,825).
    // Prefer tariff_per_night from DB; if missing, derive from night_fee / nights.
    const stayNights  = stay.checkout_date
      ? Math.max(1, Math.round((parseLocalDate(stay.checkout_date)-parseLocalDate(stay.checkin_date))/(1000*60*60*24)))
      : (parseInt(stay.nights) || 1)
    const totalNightFee = parseFloat(stay.night_fee || stay.nightFee || 0)
    const perNightFromFee = totalNightFee && stayNights ? Math.round(totalNightFee / stayNights) : 0
    const tariffPerNight  = parseFloat(stay.tariff_per_night || stay.tariffPerNight || 0) || perNightFromFee || 0

    setForm({
      channel:        ch,
      tariffPerNight: String(tariffPerNight || ''),
      extraCharges:   stay.extra_charges || stay.extraCharges || '0',
      notes:          stay.notes || '',
    })

    // Restore saved extra charge lines
    try {
      const saved = stay.extra_lines || stay.extraLines
      if (saved) {
        const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved
        setExtraLines(Array.isArray(parsed) && parsed.length > 0 ? parsed : [])
      } else {
        setExtraLines([])
      }
    } catch { setExtraLines([]) }

    // Pre-fill Airbnb breakdown from DB values (written by email poller)
    if (isAirbnb) {
      setAirbnb({
        nightFee:        String(totalNightFee || ''),
        cleaningFee:     String(stay.cleaning_fee      || stay.cleaningFee     || ''),
        hostServiceFee:  String(stay.host_service_fee  || stay.hostServiceFee  || ''),
        youEarn:         String(stay.you_earn          || stay.youEarn         || ''),
        guestServiceFee: String(stay.guest_service_fee || stay.guestServiceFee || ''),
        guestPaid:       String(stay.guest_paid_total  || stay.guestPaidTotal  || ''),
      })
    }
  }

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  // Derived financials
  // Use checkout_date diff if available, else fall back to stay.nights from DB
  const nights  = selected
    ? (selected.checkout_date
        ? Math.max(1, Math.round((parseLocalDate(selected.checkout_date)-parseLocalDate(selected.checkin_date))/(1000*60*60*24)))
        : (parseInt(selected.nights) || 1))
    : 0
  const tariff     = parseFloat(form.tariffPerNight)||0
  const extraTotal = extraLines.reduce((s,l) => s + (parseFloat(l.amount)||0), 0)
  const commPct    = COMMISSION[form.channel]||0
  // Airbnb: gross = nightFee + cleaningFee, commAmt = hostServiceFee, net = youEarn
  // Other:  gross = tariff * nights + extras, commAmt = gross * commPct%, net = gross - commAmt
  const isAirbnb   = form.channel === 'Airbnb'
  const nightFeeAmt   = parseFloat(airbnb.nightFee) || 0
  const cleanFeeAmt   = parseFloat(airbnb.cleaningFee) || 0
  const hostSvcAmt    = parseFloat(airbnb.hostServiceFee) || 0
  const youEarnAmt    = parseFloat(airbnb.youEarn) || tariff
  const gross      = isAirbnb
    ? (nightFeeAmt * nights) + cleanFeeAmt + extraTotal
    : (tariff * nights) + extraTotal
  const commAmt    = isAirbnb
    ? (hostSvcAmt || Math.round(gross * 0.03))
    : Math.round(gross * commPct / 100)
  const net        = isAirbnb
    ? youEarnAmt + extraTotal          // youEarn already has 3% deducted
    : gross - commAmt

  // Save financial details (updates stay record)
  async function handleSaveFinancials() {
    if (!selected) return
    if (form.tariffPerNight === '' || form.tariffPerNight === null || form.tariffPerNight === undefined) {
      set('tariffPerNight', '0')
    }
    setSaving(true)
    try {
      await api.saveVillaRentalIncome({
        stayId:      selected.stay_id,
        villaId:     'dwarka',
        guestName:   selected.guest_name,
        checkInDate:  selected.checkin_date,
        checkOutDate: selected.checkout_date,
        channel:     form.channel,
        tariffPerNight: tariff,
        extraCharges:   extraTotal,
        extraLines:     JSON.stringify(extraLines),
        airbnbFees:     form.channel === 'Airbnb' ? JSON.stringify(airbnb) : null,
        nights, gross, commPct, commAmt, net,
        notes: form.notes,
      })
      showToast('Financials saved ✓')
      await loadStays()
    } catch(e) { showToast('Save failed: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  // Transition status
  async function handleStatusChange(newStatus) {
    if (!selected) return
    setTransitioning(true)
    try {
      await api.updateStayStatus({ stayId: selected.stay_id, status: newStatus })
      showToast(STATUS_META[newStatus]?.label + ' ✓')
      await loadStays()
    } catch(e) { showToast('Failed: ' + e.message, 'error') }
    finally { setTransitioning(false) }
  }

  // Debounced type-ahead search for the Booked By picker
  useEffect(() => {
    if (!bookedByOpen) return
    const q = bookedByQuery.trim()
    if (q.length < 2) { setBookedByResults([]); return }
    setBookedBySearching(true)
    const t = setTimeout(async () => {
      try {
        const results = await api.searchGuestsByName(q)
        setBookedByResults(results || [])
      } catch (e) { /* silent — search box just shows no results */ }
      finally { setBookedBySearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [bookedByQuery, bookedByOpen])

  async function handleLinkBookedBy(guestId) {
    if (!selected) return
    try {
      await api.linkBookedBy({ stayId: selected.stay_id, guestId })
      showToast(guestId ? 'Linked ✓' : 'Unlinked ✓')
      setBookedByOpen(false); setBookedByQuery(''); setBookedByResults([])
      await loadStays()
    } catch (e) { showToast('Failed: ' + e.message, 'error') }
  }

  function toggleMergeCheck(stayId) {
    setMergeChecked(prev =>
      prev.includes(stayId) ? prev.filter(id => id !== stayId)
        : prev.length >= 2 ? prev  // cap at 2 — linking is always pairwise
        : [...prev, stayId]
    )
  }

  function exitMergeMode() {
    setMergeMode(false); setMergeChecked([]); setMergePromptOpen(false)
    setMergeContactId(null); setMergeGuestMatches({})
  }

  // The "booked by" contact must already have a guests-table row (that's
  // literally what booked_by_guest_id points at) — but checking in (the
  // OTHER stay) never requires one. So as soon as both names are picked,
  // look both up right away and only let the owner choose whichever one(s)
  // actually resolve, instead of letting them pick freely and finding out
  // it fails afterwards (which is exactly what happened the first time
  // this shipped — Venkittaswamy was picked as contact, but only Parvathy
  // had a guests row yet, so the link silently couldn't be made).
  async function openMergePrompt() {
    setMergePromptOpen(true)
    setMergeContactId(null)   // always start fresh — a stale selection from a
                              // previous attempt must never carry over, since
                              // it would render as "selected" before the new
                              // lookup has even finished checking who's valid
    setMergeGuestMatches({}) // marks both as "loading" (undefined) while we check
    for (const stayId of mergeChecked) {
      const stay = stays.find(s => s.stay_id === stayId)
      if (!stay) continue
      try {
        const matches = await api.searchGuestsByName(stay.guest_name)
        const exact = (matches || []).find(g => g.name === stay.guest_name)
        setMergeGuestMatches(prev => ({ ...prev, [stayId]: exact || null }))
      } catch {
        setMergeGuestMatches(prev => ({ ...prev, [stayId]: null }))
      }
    }
  }

  async function handleConfirmMerge() {
    if (mergeChecked.length !== 2 || !mergeContactId) return
    const stayToUpdate = mergeChecked.find(id => id !== mergeContactId)
    const contactGuest = mergeGuestMatches[mergeContactId]
    // Defensive check, even though the UI shouldn't allow selecting an
    // unresolved contact — if this ever fires it means mergeContactId got
    // set some other way (e.g. stale state from a prior attempt), so fail
    // loudly instead of silently doing nothing.
    if (!contactGuest) {
      showToast('That guest has no history yet — pick the other one', 'error')
      setMergeContactId(null)
      return
    }
    try {
      const res = await api.linkBookedBy({ stayId: stayToUpdate, guestId: contactGuest.guest_id })
      const otherName = stays.find(s => s.stay_id === stayToUpdate)?.guest_name || 'the other guest'
      showToast(res?.backfilledGuestId ? `Linked ✓ — ${otherName} added to guest history for next time` : 'Linked ✓')
      exitMergeMode()
      await loadStays()
    } catch (e) { showToast('Failed: ' + e.message, 'error') }
  }

  const s = selected
  const meta = s ? (STATUS_META[s.status] || STATUS_META.booked) : null
  const days = s ? daysFromNow(s.checkin_date) : null

  // What action buttons to show based on current status
  const canMarkDocsUploaded   = s && ['booked','confirmed'].includes(s.status)
  const canMarkReadyForCheckin = s && ['booked','confirmed','docs_uploaded','pending_review'].includes(s.status)
  const canCancel             = s && !['closed','cancelled','checked_out'].includes(s.status)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Complete booking</div>
          <div className="topbar-sub">DWARKA · UPCOMING STAYS</div>
        </div>
        <div style={{width:34}}/>
      </div>

      <div className="screen-body">

        {loading && <div className="loading"><div className="spinner"/>Loading bookings…</div>}

        {!loading && stays.length === 0 && (
          <div className="card" style={{textAlign:'center',padding:'32px 16px'}}>
            <div style={{fontSize:'2rem',marginBottom:'12px'}}>🏠</div>
            <div style={{color:'var(--gold)',fontWeight:'600',marginBottom:'6px'}}>No upcoming stays</div>
            <div style={{color:'var(--text-dim)',fontSize:'0.85rem'}}>
              Create a booking first, then come here to add financial details and prepare for check-in.
            </div>
            <button className="btn btn-gold" style={{marginTop:'16px'}}
              onClick={()=>navigate('/owner/villa/booking')}>
              + New Booking
            </button>
          </div>
        )}

        {!loading && stays.length > 0 && (
          <>
            {/* Guest selector */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div className="card-section-label">SELECT GUEST</div>
              {stays.length >= 2 && (
                <button onClick={() => mergeMode ? exitMergeMode() : setMergeMode(true)}
                  style={{fontSize:'0.72rem',color: mergeMode ? '#EF4444' : '#85B7EB',
                    background:'none',border:'none',cursor:'pointer',textDecoration:'underline',
                    marginBottom:'6px'}}>
                  {mergeMode ? 'Cancel' : '🔗 Merge bookings'}
                </button>
              )}
            </div>
            {mergeMode && (
              <div style={{fontSize:'0.74rem',color:'var(--text-dim)',marginBottom:'8px'}}>
                Tick the booking contact and the guest who actually checked in (2 guests),
                then confirm who booked.
              </div>
            )}
            <div style={{background:'var(--dark-card)',borderRadius:'12px',border:'1px solid var(--border-dim)',overflow:'hidden',marginBottom:'14px'}}>
              {stays.map((stay, i) => {
                const m   = STATUS_META[stay.status] || STATUS_META.booked
                const d   = daysFromNow(stay.checkin_date)
                const sel = selected?.stay_id === stay.stay_id
                const checked = mergeChecked.includes(stay.stay_id)
                return (
                  <div key={stay.stay_id}
                    onClick={() => mergeMode ? toggleMergeCheck(stay.stay_id) : selectStay(stay)}
                    style={{
                      padding:'12px 16px', cursor:'pointer',
                      borderBottom: i < stays.length-1 ? '1px solid var(--border-dim)' : 'none',
                      background: mergeMode ? (checked ? 'rgba(133,183,235,0.1)' : 'transparent')
                        : (sel ? 'rgba(200,144,58,0.07)' : 'transparent'),
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                    }}>
                    {mergeMode && (
                      <input type="checkbox" checked={checked} readOnly
                        style={{marginRight:'10px', width:'16px', height:'16px', accentColor:'#85B7EB', flexShrink:0}} />
                    )}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px'}}>
                        {!mergeMode && sel && <span style={{color:'var(--gold)'}}>✓</span>}
                        <span style={{fontWeight:'600',fontSize:'0.9rem',
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {stay.guest_name}
                        </span>
                        {stay.booked_by_name && (
                          <span style={{fontSize:'0.65rem',color:'#85B7EB',flexShrink:0}}>
                            🔗 booked by {stay.booked_by_name}
                          </span>
                        )}
                      </div>
                      <div style={{fontSize:'0.73rem',color:'var(--text-dim)'}}>
                        {fmtDate(stay.checkin_date)} → {fmtDate(stay.checkout_date)}
                        {d !== null && (
                          <span style={{marginLeft:'8px',color: d<0?'#e74c3c':d<=2?'#e67e22':'var(--text-dim)'}}>
                            {d<0?`${Math.abs(d)}d ago`:`in ${d}d`}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{
                      fontSize:'0.68rem',fontWeight:'700',padding:'2px 8px',borderRadius:'10px',
                      background:m.bg, color:m.color, flexShrink:0, marginLeft:'8px',
                    }}>
                      {m.label}
                    </span>
                  </div>
                )
              })}
            </div>
            {mergeMode && mergeChecked.length === 2 && !mergePromptOpen && (
              <button className="btn btn-gold" style={{width:'100%',marginBottom:'14px'}}
                onClick={openMergePrompt}>
                🔗 Link these 2 bookings
              </button>
            )}
            {mergePromptOpen && (
              <div style={{background:'var(--dark-card)',border:'1px solid rgba(200,144,58,0.3)',
                borderRadius:'12px',padding:'14px 16px',marginBottom:'14px'}}>
                <div style={{fontSize:'0.85rem',fontWeight:'600',marginBottom:'4px'}}>
                  Which one booked & is paying?
                </div>
                <div style={{fontSize:'0.7rem',color:'var(--text-dim)',marginBottom:'10px'}}>
                  Only a guest with existing history can be the booking contact —
                  the other guest's check-in stay isn't touched either way.
                </div>
                {mergeChecked.map(stayId => {
                  const stay = stays.find(s => s.stay_id === stayId)
                  if (!stay) return null
                  const match = mergeGuestMatches[stayId]       // undefined=loading, null=not found, object=found
                  const resolvable = match !== undefined && match !== null
                  const loading = !(stayId in mergeGuestMatches)
                  return (
                    <div key={stayId}
                      onClick={() => resolvable && setMergeContactId(stayId)}
                      style={{padding:'10px 12px', marginBottom:'8px', borderRadius:'8px',
                        cursor: resolvable ? 'pointer' : 'default',
                        opacity: resolvable ? 1 : 0.5,
                        border: mergeContactId===stayId ? '1px solid var(--gold)' : '1px solid var(--border-dim)',
                        background: mergeContactId===stayId ? 'rgba(200,144,58,0.08)' : 'transparent',
                        display:'flex', alignItems:'center', gap:'8px'}}>
                      {mergeContactId===stayId && <span style={{color:'var(--gold)'}}>✓</span>}
                      <span style={{fontSize:'0.85rem',fontWeight:'500',flex:1}}>{stay.guest_name}</span>
                      {loading && <span style={{fontSize:'0.7rem',color:'var(--text-dim)'}}>checking…</span>}
                      {!loading && match === null && (
                        <span style={{fontSize:'0.68rem',color:'#e67e22'}}>no guest history yet</span>
                      )}
                    </div>
                  )
                })}
                {mergeChecked.every(id => mergeGuestMatches[id] === null) && Object.keys(mergeGuestMatches).length === mergeChecked.length && (
                  <div style={{fontSize:'0.72rem',color:'#e67e22',marginTop:'4px',marginBottom:'8px'}}>
                    Neither guest has history yet — link isn't possible until at least one
                    of them has a completed stay on record. Try again after their next stay closes.
                  </div>
                )}
                <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                  <button className="btn btn-gold" style={{flex:1}} disabled={!mergeContactId}
                    onClick={handleConfirmMerge}>
                    Confirm link
                  </button>
                  <button style={{flex:1,padding:'10px',borderRadius:'10px',border:'1px solid var(--border-dim)',
                    background:'transparent',color:'var(--text-dim)',cursor:'pointer'}}
                    onClick={() => { setMergePromptOpen(false); setMergeContactId(null); setMergeGuestMatches({}) }}>
                    Back
                  </button>
                </div>
              </div>
            )}

            {s && (
              <>
                {/* Status banner */}
                <div style={{
                  background:meta.bg, border:`1px solid ${meta.color}55`,
                  borderRadius:'10px', padding:'10px 14px', marginBottom:'14px',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                  <div>
                    <div style={{color:meta.color,fontWeight:'700',fontSize:'0.85rem'}}>
                      {meta.label}
                    </div>
                    <div style={{color:'var(--text-dim)',fontSize:'0.75rem',marginTop:'2px'}}>
                      {s.stay_id} · {nights} night{nights!==1?'s':''}
                      {days !== null && ` · check-in ${days<0?`${Math.abs(days)}d ago`:`in ${days}d`}`}
                    </div>
                  </div>
                  <div style={{fontSize:'1.4rem'}}>
                    {s.status==='booked'?'📋':s.status==='confirmed'?'✅':
                     s.status==='docs_uploaded'?'📁':s.status==='ready_for_checkin'?'🔑':
                     s.status==='checked_in'?'🏠':'📄'}
                  </div>
                </div>

                {/* Drive folder — show link or create prompt */}
                {s.drive_folder_id ? (
                  <a href={`https://drive.google.com/drive/folders/${s.drive_folder_id}`}
                    target="_blank" rel="noreferrer"
                    style={{display:'block',padding:'10px 14px',background:'var(--dark-card)',
                      border:'1px solid var(--border-dim)',borderRadius:'10px',marginBottom:'14px',
                      color:'#85B7EB',fontSize:'0.82rem',textDecoration:'none'}}>
                    📁 Open guest Drive folder → verify ID + registration docs uploaded
                  </a>
                ) : (
                  <div style={{marginBottom:'14px'}}>
                    <div style={{padding:'10px 14px',background:'rgba(200,144,58,0.06)',
                      border:'1px dashed rgba(200,144,58,0.3)',borderRadius:'10px',
                      fontSize:'0.78rem',color:'var(--text-dim)',textAlign:'center'}}>
                      📁 No Drive folder yet — will be created automatically when
                      guest submits the check-in form, or via the Apps Script poller.
                    </div>
                  </div>
                )}

                {/* Directions & arrival steps — WhatsApp, framed as from Raman */}
                {s.status === 'ready_for_checkin' && (() => {
                  const phone = selected?.guest_phone || selected?.phone
                  if (!phone) return (
                    <div style={{
                      padding:'10px 14px', borderRadius:'10px', marginBottom:'14px',
                      background:'rgba(37,211,102,0.05)', border:'1px dashed rgba(37,211,102,0.2)',
                      color:'rgba(37,211,102,0.45)', fontSize:'0.78rem', textAlign:'center',
                    }}>
                      📍 Directions & arrival steps available once guest phone is captured
                    </div>
                  )
                  const link = buildArrivalWaLink(selected)
                  return (
                    <a href={link} target="_blank" rel="noreferrer"
                      style={{
                        display:'block', padding:'12px', borderRadius:'10px', textAlign:'center',
                        background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.3)',
                        color:'#25D366', fontWeight:'700', fontSize:'0.85rem',
                        textDecoration:'none', marginBottom:'14px',
                      }}>
                      📍 Send directions & arrival steps (from Raman)
                    </a>
                  )
                })()}

                {/* Guest Info */}
                <div className="card-section-label">GUEST INFO</div>
                <div className="card" style={{marginBottom:'14px'}}>
                  {(() => {
                    // Derive checkout from checkin + nights if checkout_date is null
                    const coDate = s.checkout_date || (() => {
                      if (!s.checkin_date || !nights) return null
                      const d = parseLocalDate(s.checkin_date)
                      if (!d) return null
                      d.setDate(d.getDate() + nights)
                      const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
                      return `${y}-${m}-${day}`
                    })()
                    const adults   = parseInt(s.adults)   || 0
                    const children = parseInt(s.children) || 0
                    const infants  = parseInt(s.infants)  || 0
                    const total    = adults + children + infants
                    return (
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 16px'}}>
                        <div>
                          <div style={infoLabel}>Check-in</div>
                          <div style={infoVal}>{fmtDate(s.checkin_date)}</div>
                        </div>
                        <div>
                          <div style={infoLabel}>Check-out</div>
                          <div style={infoVal}>
                            {coDate
                              ? <>{fmtDate(coDate)}{!s.checkout_date && <span style={{fontSize:'0.68rem',color:'var(--text-dim)',marginLeft:'5px'}}>(est.)</span>}</>
                              : <span style={{color:'var(--text-dim)'}}>TBD</span>}
                          </div>
                        </div>
                        <div>
                          <div style={infoLabel}>Phone</div>
                          <div style={infoVal}>
                            {s.guest_phone
                              ? <a href={`tel:${s.guest_phone}`} style={{color:'#85B7EB',textDecoration:'none'}}>{s.guest_phone}</a>
                              : <span style={{color:'var(--text-dim)'}}>—</span>}
                          </div>
                        </div>
                        <div>
                          <div style={infoLabel}>Email</div>
                          <div style={{fontSize:'0.85rem',color:'var(--text)',fontWeight:'500',wordBreak:'break-all'}}>
                            {s.guest_email
                              ? <a href={`mailto:${s.guest_email}`} style={{color:'#85B7EB',textDecoration:'none'}}>{s.guest_email}</a>
                              : <span style={{color:'var(--text-dim)'}}>—</span>}
                          </div>
                        </div>
                        <div style={{gridColumn:'1 / -1'}}>
                          <div style={infoLabel}>Booked By</div>
                          {!bookedByOpen ? (
                            <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                              {s.booked_by_name ? (
                                <>
                                  <span style={{fontSize:'0.85rem',color:'var(--text)',fontWeight:'500'}}>
                                    {s.booked_by_name}
                                  </span>
                                  <span style={{fontSize:'0.68rem',color:'var(--text-dim)'}}>
                                    (booked &amp; paid — different from guest who checked in)
                                  </span>
                                  <button onClick={()=>setBookedByOpen(true)}
                                    style={{fontSize:'0.7rem',color:'#85B7EB',background:'none',border:'none',
                                      cursor:'pointer',padding:'2px 6px',textDecoration:'underline'}}>
                                    change
                                  </button>
                                  <button onClick={()=>handleLinkBookedBy(null)}
                                    style={{fontSize:'0.7rem',color:'var(--text-dim)',background:'none',border:'none',
                                      cursor:'pointer',padding:'2px 6px',textDecoration:'underline'}}>
                                    unlink
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span style={{fontSize:'0.82rem',color:'var(--text-dim)'}}>
                                    Same as guest above
                                  </span>
                                  <button onClick={()=>setBookedByOpen(true)}
                                    style={{fontSize:'0.7rem',color:'#85B7EB',background:'none',border:'none',
                                      cursor:'pointer',padding:'2px 6px',textDecoration:'underline'}}>
                                    + link a different booking contact
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div style={{position:'relative'}}>
                              <input autoFocus value={bookedByQuery}
                                onChange={e=>setBookedByQuery(e.target.value)}
                                placeholder="Type a name to search guests…"
                                style={{width:'100%',padding:'8px 10px',background:'var(--dark-bg)',
                                  border:'1px solid var(--border-dim)',borderRadius:'8px',
                                  color:'var(--text)',fontSize:'0.85rem'}} />
                              <button onClick={()=>{setBookedByOpen(false);setBookedByQuery('');setBookedByResults([])}}
                                style={{position:'absolute',right:'8px',top:'6px',background:'none',border:'none',
                                  color:'var(--text-dim)',cursor:'pointer',fontSize:'0.9rem'}}>
                                ✕
                              </button>
                              {bookedBySearching && (
                                <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginTop:'6px'}}>Searching…</div>
                              )}
                              {!bookedBySearching && bookedByResults.length > 0 && (
                                <div style={{marginTop:'6px',background:'var(--dark-card)',
                                  border:'1px solid var(--border-dim)',borderRadius:'8px',overflow:'hidden'}}>
                                  {bookedByResults.map(g => (
                                    <div key={g.guest_id} onClick={()=>handleLinkBookedBy(g.guest_id)}
                                      style={{padding:'8px 10px',cursor:'pointer',
                                        borderBottom:'1px solid var(--border-dim)',fontSize:'0.82rem'}}
                                      onMouseEnter={e=>e.currentTarget.style.background='rgba(200,144,58,0.08)'}
                                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                      <div style={{fontWeight:'600'}}>{g.name}</div>
                                      <div style={{fontSize:'0.7rem',color:'var(--text-dim)'}}>
                                        {g.phone || g.email || '—'} · {g.total_stays || 0} past stay{g.total_stays!==1?'s':''}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!bookedBySearching && bookedByQuery.trim().length >= 2 && bookedByResults.length === 0 && (
                                <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginTop:'6px'}}>No matching guests found</div>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={infoLabel}>Guests</div>
                          <div style={infoVal}>
                            {total > 0 ? (
                              <>{total} total<span style={{color:'var(--text-dim)',fontWeight:'400',fontSize:'0.78rem',marginLeft:'6px'}}>
                                ({adults} adult{adults!==1?'s':''}
                                {children>0?` · ${children} child${children!==1?'ren':''}` : ''}
                                {infants>0?` · ${infants} infant${infants!==1?'s':''}` : ''})
                              </span></>
                            ) : <span style={{color:'var(--text-dim)'}}>—</span>}
                          </div>
                        </div>
                        <div>
                          <div style={infoLabel}>Nights</div>
                          <div style={infoVal}>{nights} night{nights!==1?'s':''}</div>
                        </div>
                      </div>
                    )
                  })()}
                  {/* Guest requests */}
                  {(!!s.request_early_checkin || !!s.request_late_checkout || !!s.request_breakfast || !!s.request_cab || !!s.request_extra_beds) && (
                    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid var(--border-dim)',display:'flex',flexWrap:'wrap',gap:'6px'}}>
                      {!!s.request_early_checkin && <span style={reqPill}>⏰ Early check-in</span>}
                      {!!s.request_late_checkout && <span style={reqPill}>🌙 Late check-out</span>}
                      {!!s.request_breakfast     && <span style={reqPill}>{'🍳 Breakfast' + (s.breakfast_choice ? ` — ${s.breakfast_choice}` : '')}</span>}
                      {!!s.request_cab           && <span style={reqPill}>🚗 Cab</span>}
                      {!!s.request_extra_beds    && <span style={reqPill}>{'🛏 Extra beds' + (s.extra_beds_count > 0 ? ` × ${s.extra_beds_count}` : '')}</span>}
                    </div>
                  )}
                </div>

                {/* Channel & Tariff */}
                <div className="card-section-label">CHANNEL & TARIFF</div>
                <div className="card">
                  <div className="field">
                    <label className="field-label">Booking channel</label>
                    <select className="field-input" value={form.channel} onChange={e=>set('channel',e.target.value)}>
                      {CHANNELS.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="grid-2">
                    {/* Tariff/Night only shown for non-Airbnb — Airbnb uses nightFee breakdown */}
                    {form.channel !== 'Airbnb' && (
                      <div className="field">
                        <label className="field-label">Tariff / night (₹)</label>
                        <input className="field-input gold" type="number" placeholder="0"
                          value={form.tariffPerNight}
                          onChange={e => set('tariffPerNight', e.target.value)}/>
                      </div>
                    )}
                    <div className="field">
                      <label className="field-label">Add extra charge</label>
                      <select className="field-input" value=""
                        onChange={e => {
                          if (!e.target.value) return
                          const item = EXTRA_ITEMS.find(x => x.label === e.target.value)
                          setExtraLines(prev => [...prev, { label: item.label, amount: item.amount }])
                          e.target.value = ''
                        }}>
                        <option value="">+ Add item…</option>
                        {EXTRA_ITEMS.map(x => <option key={x.label} value={x.label}>{x.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Extra charge lines */}
                {extraLines.length > 0 && (
                  <div className="card" style={{padding:'10px 14px',marginBottom:'8px'}}>
                    <div className="card-section-label" style={{marginBottom:'8px'}}>EXTRA CHARGES</div>
                    {extraLines.map((line, i) => (
                      <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                        <span style={{flex:1,fontSize:'0.85rem',color:'var(--text)'}}>{line.label}</span>
                        <input type="number" value={line.amount} placeholder="0"
                          onChange={e => setExtraLines(prev => prev.map((l,j) => j===i ? {...l, amount: e.target.value} : l))}
                          style={{width:'90px',padding:'5px 8px',borderRadius:'6px',
                            background:'var(--dark-input)',border:'1px solid var(--border-dim)',
                            color:'var(--gold)',fontWeight:'600',fontSize:'0.85rem',textAlign:'right'}}/>
                        <button onClick={() => setExtraLines(prev => prev.filter((_,j) => j!==i))}
                          style={{background:'none',border:'none',color:'#c62828',cursor:'pointer',fontSize:'1rem'}}>✕</button>
                      </div>
                    ))}
                    <div style={{borderTop:'1px solid var(--border-dim)',paddingTop:'6px',marginTop:'4px',
                      display:'flex',justifyContent:'space-between',fontSize:'0.82rem'}}>
                      <span style={{color:'var(--text-dim)'}}>Total extras</span>
                      <span style={{color:'var(--gold)',fontWeight:'700'}}>₹{extraTotal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}

                {/* Airbnb fee breakdown */}
                {form.channel === 'Airbnb' && (
                  <div className="card" style={{marginBottom:'8px'}}>
                    <div className="card-section-label" style={{marginBottom:'8px'}}>AIRBNB FEE BREAKDOWN</div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-dim)',marginBottom:'10px'}}>
                      From Airbnb confirmation email — "You earn" section
                    </div>
                    <div className="grid-2">
                      <div className="field">
                        <label className="field-label">Night fee total (₹) <span style={{color:'var(--text-dim)',fontWeight:'400'}}>auto</span></label>
                        <input type="number" className="field-input" placeholder="0"
                          value={airbnb.nightFee}
                          onChange={e => {
                            const nf = parseFloat(e.target.value) || 0
                            const cf = parseFloat(airbnb.cleaningFee) || 0
                            const hs = Math.round((nf + cf) * 0.03 * 100) / 100
                            const ye = Math.round((nf + cf - hs) * 100) / 100
                            setAirbnb(prev => ({...prev, nightFee: e.target.value, hostServiceFee: String(hs), youEarn: String(ye)}))
                          }}/>
                      </div>
                      <div className="field">
                        <label className="field-label">Cleaning fee (₹)</label>
                        <input type="number" className="field-input" placeholder="0"
                          value={airbnb.cleaningFee}
                          onChange={e => {
                            const nf = parseFloat(airbnb.nightFee) || 0
                            const cf = parseFloat(e.target.value) || 0
                            const hs = Math.round((nf + cf) * 0.03 * 100) / 100
                            const ye = Math.round((nf + cf - hs) * 100) / 100
                            setAirbnb(prev => ({...prev, cleaningFee: e.target.value, hostServiceFee: String(hs), youEarn: String(ye)}))
                          }}/>
                      </div>
                      <div className="field">
                        <label className="field-label">Host service fee (₹) <span style={{color:'var(--text-dim)',fontWeight:'400'}}>auto 3%</span></label>
                        <input type="number" className="field-input" placeholder="0"
                          value={airbnb.hostServiceFee}
                          onChange={e => {
                            const nf = parseFloat(airbnb.nightFee) || 0
                            const cf = parseFloat(airbnb.cleaningFee) || 0
                            const hs = parseFloat(e.target.value) || 0
                            const ye = Math.round((nf + cf - hs) * 100) / 100
                            setAirbnb(prev => ({...prev, hostServiceFee: e.target.value, youEarn: String(ye)}))
                          }}/>
                      </div>
                      <div className="field">
                        <label className="field-label">You earn total (₹) <span style={{color:'var(--text-dim)',fontWeight:'400'}}>auto</span></label>
                        <input type="number" className="field-input" placeholder="0"
                          value={airbnb.youEarn}
                          onChange={e => setAirbnb(prev => ({...prev, youEarn: e.target.value}))}/>
                      </div>
                    </div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-dim)',margin:'8px 0 6px'}}>
                      "Guest paid" section
                    </div>
                    <div className="grid-2">
                      {[
                        {key:'guestServiceFee', label:'Guest service fee (₹)'},
                        {key:'guestPaid',       label:'Guest paid total (₹)'},
                      ].map(f => (
                        <div key={f.key} className="field">
                          <label className="field-label">{f.label}</label>
                          <input type="number" className="field-input" placeholder="0"
                            value={airbnb[f.key]}
                            onChange={e => setAirbnb(prev => ({...prev, [f.key]: e.target.value}))}/>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Revenue summary */}
                <div className="net-box">
                  {isAirbnb ? (
                    <>
                      {nightFeeAmt > 0 && <div className="net-row">
                        <span className="net-label">Night fee ({nights}N × {fmt(nightFeeAmt / (nights||1))})</span>
                        <span className="net-val pos">{fmt(nightFeeAmt)}</span>
                      </div>}
                      {cleanFeeAmt > 0 && <div className="net-row">
                        <span className="net-label">Cleaning fee</span>
                        <span className="net-val pos">{fmt(cleanFeeAmt)}</span>
                      </div>}
                      {hostSvcAmt > 0 && <div className="net-row">
                        <span className="net-label">Host service fee (3%)</span>
                        <span className="net-val neg">−{fmt(hostSvcAmt)}</span>
                      </div>}
                      {extraLines.map((line,i) => (
                        <div key={i} className="net-row">
                          <span className="net-label">{line.label}</span>
                          <span className="net-val pos">{fmt(parseFloat(line.amount)||0)}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className="net-row">
                        <span className="net-label">Room ({nights}N × {fmt(tariff)})</span>
                        <span className="net-val pos">{fmt(tariff * nights)}</span>
                      </div>
                      {extraLines.map((line,i) => (
                        <div key={i} className="net-row">
                          <span className="net-label">{line.label}</span>
                          <span className="net-val pos">{fmt(parseFloat(line.amount)||0)}</span>
                        </div>
                      ))}
                      {commPct > 0 && (
                        <div className="net-row">
                          <span className="net-label">{form.channel} commission ({commPct}%)</span>
                          <span className="net-val neg">−{fmt(commAmt)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="net-divider"/>
                  <div className="net-row">
                    <span style={{color:'#EDF2F7',fontWeight:'600',fontSize:'1rem'}}>
                      {isAirbnb ? 'You earn (net)' : 'Net to owner'}
                    </span>
                    <span className="net-val big">{fmt(net)}</span>
                  </div>
                </div>

                {/* Extended check-in numbers */}
                {(() => {
                  const base = parseFloat(airbnb.guestPaid) || parseFloat(airbnb.youEarn) || gross || 0
                  if (base <= 0) return null
                  return (
                    <div className="card" style={{marginBottom:'8px'}}>
                      <div className="card-section-label" style={{marginBottom:'10px'}}>EXTENDED STAY REFERENCE</div>
                      <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginBottom:'10px'}}>
                        Based on {airbnb.guestPaid ? 'guest paid total' : airbnb.youEarn ? 'you earn' : 'gross'} of {fmt(base)}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                        <div style={extBox}>
                          <div style={{fontSize:'0.68rem',color:'var(--text-dim)',fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:'4px'}}>25% of guest paid</div>
                          <div style={{fontSize:'1.05rem',color:'#E8B86D',fontWeight:'700'}}>{fmt(Math.round(base * 0.25))}</div>
                          <div style={{fontSize:'0.68rem',color:'var(--text-dim)',marginTop:'2px'}}>Early check-in / late check-out ref</div>
                        </div>
                        <div style={extBox}>
                          <div style={{fontSize:'0.68rem',color:'var(--text-dim)',fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:'4px'}}>50% of guest paid</div>
                          <div style={{fontSize:'1.05rem',color:'#E8B86D',fontWeight:'700'}}>{fmt(Math.round(base * 0.5))}</div>
                          <div style={{fontSize:'0.68rem',color:'var(--text-dim)',marginTop:'2px'}}>Half-day / extra night ref</div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Notes */}
                <div className="card">
                  <div className="field" style={{marginBottom:0}}>
                    <label className="field-label">Notes</label>
                    <textarea className="field-input" rows={2} placeholder="Any notes…"
                      value={form.notes} onChange={e=>set('notes',e.target.value)}/>
                  </div>
                </div>

                {/* Save financials */}
                <button className="btn btn-gold" onClick={handleSaveFinancials} disabled={saving}
                  style={{marginBottom:'8px'}}>
                  {saving ? 'Saving…' : '💾 Save financial details'}
                </button>

                {/* WhatsApp host intro — show for all pre-checkin states */}
                {s && !['checked_in','checked_out','closed','cancelled'].includes(s.status) && (() => {
                  const phone = selected?.guest_phone || selected?.phone
                  const name  = (selected?.guest_name || '').split(' ')[0]
                  const ci    = selected?.checkin_date || ''
                  if (!phone) return (
                    <div style={{
                      padding:'10px 14px', borderRadius:'10px', marginBottom:'14px',
                      background:'rgba(37,211,102,0.05)', border:'1px dashed rgba(37,211,102,0.2)',
                      color:'rgba(37,211,102,0.45)', fontSize:'0.78rem', textAlign:'center',
                    }}>
                      💬 WhatsApp intro available once guest phone is captured
                    </div>
                  )
                  const raw = String(phone).replace(/\D/g,'')
                  const num = raw.startsWith('91') ? raw : `91${raw}`
                  const msg = encodeURIComponent(
                    `Namaskaram ${name}! 🙏\n\n` +
                    `This is Biji from ${selected.villa_name || 'Guruvayur Villa (Dwarka)'}. I wanted to personally welcome you ahead of your stay on ${parseLocalDate(ci)?.toLocaleDateString('en-IN',{month:'long',day:'numeric'}) || ci}.\n\n` +
                    `At Guruvayur Villa, we open our home to your family and strive to create a comfortable, memorable experience. To help us prepare for your visit, I'd love to connect briefly to review your reservation, arrival timing, and any special requirements you may have.\n\n` +
                    `Please let me know a convenient time to connect. We're looking forward to hosting you and your family.\n\n` +
                    `Snehapoorvam (സ്നേഹപൂർവ്വം),\nBiji | ${selected.villa_name || 'Guruvayur Villa (Dwarka)'}`
                  )
                  return (
                    <a href={`https://wa.me/${num}?text=${msg}`} target="_blank" rel="noreferrer"
                      style={{
                        display:'block', padding:'12px', borderRadius:'10px', textAlign:'center',
                        background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.3)',
                        color:'#25D366', fontWeight:'700', fontSize:'0.85rem',
                        textDecoration:'none', marginBottom:'14px',
                      }}>
                      💬 Send WhatsApp intro to {name}
                    </a>
                  )
                })()}

                {/* Status action buttons */}
                <div className="card-section-label">MOVE LIFECYCLE FORWARD</div>
                <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'14px'}}>

                  {canMarkDocsUploaded && (
                    <button onClick={()=>handleStatusChange('docs_uploaded')}
                      disabled={transitioning}
                      style={actionBtn('#8B5CF6')}>
                      {transitioning?'…':'📁 Mark documents uploaded'}
                    </button>
                  )}

                  {canMarkReadyForCheckin && (
                    <button onClick={()=>handleStatusChange('ready_for_checkin')}
                      disabled={transitioning}
                      style={actionBtn('#34A853')}>
                      {transitioning?'…':'🔑 Mark ready for check-in → Notify Raman'}
                    </button>
                  )}

                  {canCancel && (
                    <button onClick={()=>handleStatusChange('cancelled')}
                      disabled={transitioning}
                      style={actionBtn('#c62828')}>
                      {transitioning?'…':'❌ Cancel booking'}
                    </button>
                  )}
                </div>

                {/* Lifecycle guide */}
                <div className="card" style={{fontSize:'0.75rem',color:'var(--text-dim)',lineHeight:'1.8'}}>
                  <div style={{color:'var(--gold)',fontWeight:'600',marginBottom:'6px',fontSize:'0.78rem'}}>
                    STAY LIFECYCLE
                  </div>
                  {(() => {
                    const STAGES = [
                      ['booked',              'Booked',              'Booking received, not yet confirmed'],
                      ['confirmed',           'Confirmed',           'Booking confirmed with guest'],
                      ['docs_uploaded',       'Docs Uploaded',       'Guest has uploaded ID + registration form'],
                      ['pending_review',      'Pending Review',      'Guest submitted check-in form — awaiting owner approval'],
                      ['ready_for_checkin',   'Ready for Check-in',  'Raman can now check in the guest'],
                      ['checked_in',          'Checked In',          'Raman completed check-in, car photos taken'],
                      ['ready_for_checkout',  'Ready for Check-out', 'Guest ready to leave'],
                      ['checked_out',         'Checked Out',         'Stay complete, Raman commission auto-created'],
                      ['closed',              'Closed',              'Financials settled'],
                    ]
                    const currentIdx = STAGES.findIndex(([key]) => key === s.status)
                    return STAGES.map(([key, label, desc], i) => {
                      const isCurrent = i === currentIdx
                      const isPast    = i < currentIdx
                      return (
                        <div key={i} style={{display:'flex',gap:'10px',alignItems:'center',
                          padding:'3px 8px', borderRadius:'6px',
                          background: isCurrent ? 'rgba(200,144,58,0.12)' : 'transparent',
                          border: isCurrent ? '1px solid rgba(200,144,58,0.3)' : '1px solid transparent',
                        }}>
                          <span style={{fontSize:'0.75rem', width:'16px', flexShrink:0, textAlign:'center'}}>
                            {isCurrent ? '▶' : isPast ? '✓' : '○'}
                          </span>
                          <span style={{
                            minWidth:'130px', flexShrink:0,
                            color: isCurrent ? 'var(--gold)' : isPast ? '#34A853' : 'var(--text-dim)',
                            fontWeight: isCurrent ? '700' : '400',
                            textDecoration: isPast ? 'none' : 'none',
                          }}>{label}</span>
                          <span style={{
                            color: isCurrent ? 'var(--text)' : 'var(--text-dim)',
                            fontWeight: isCurrent ? '600' : '400',
                          }}>{desc}</span>
                        </div>
                      )
                    })
                  })()}
                </div>
              </>
            )}
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

function actionBtn(color) {
  return {
    width:'100%', padding:'12px', borderRadius:'10px', border:`1px solid ${color}55`,
    background:`${color}18`, color, fontWeight:'700', fontSize:'0.88rem',
    cursor:'pointer', textAlign:'left',
  }
}

const infoLabel = { fontSize:"0.68rem", color:"var(--text-dim)", fontWeight:"600", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"3px" }
const infoVal   = { fontSize:"0.88rem", color:"var(--text)", fontWeight:"600" }
const reqPill = {
  display:'inline-block', padding:'3px 9px', borderRadius:'10px',
  background:'rgba(200,144,58,0.12)', border:'1px solid rgba(200,144,58,0.25)',
  color:'#C8903A', fontSize:'0.72rem', fontWeight:'600',
}

const extBox = {
  background:'rgba(200,144,58,0.06)', border:'1px solid rgba(200,144,58,0.15)',
  borderRadius:'8px', padding:'10px 12px',
}
