/**
 * CheckIn.jsx — Raman's screen
 *
 * Shows stays in 'ready_for_checkin' status.
 * Raman selects a guest, takes car photos, and confirms check-in.
 *
 * Also handles:
 *   - "Ready for Check-out" button (guest about to leave)
 *   - "Complete Check-out" button (guest has left)
 *
 * Lifecycle managed here:
 *   ready_for_checkin → [Raman confirms + car photos] → checked_in
 *   checked_in → ready_for_checkout → checked_out
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { parseLocalDate } from '../../utils/dates'
import { buildArrivalWaLink } from '../../utils/arrivalMessage'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'

function formatDate(d) {
  if (!d) return '—'
  try { return parseLocalDate(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) }
  catch { return String(d) }
}
function calcNights(ci, co) {
  if (!ci||!co) return 0
  return Math.max(0, Math.round((parseLocalDate(co)-parseLocalDate(ci))/(1000*60*60*24)))
}
function daysFromNow(d) {
  if (!d) return null
  const parsed = parseLocalDate(d)
  if (!parsed) return null
  const today = new Date()
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((parsed-todayLocal)/(1000*60*60*24))
}

const STATUS_META = {
  booked:             { label:'Booked',              color:'#185FA5', icon:'📋' },
  confirmed:          { label:'Confirmed',           color:'#C8903A', icon:'✅' },
  docs_uploaded:      { label:'Docs Uploaded',       color:'#8B5CF6', icon:'📁' },
  pending_review:     { label:'Pending Review',      color:'#8B5CF6', icon:'📁' },
  ready_for_checkin:  { label:'Ready for Check-in',  color:'#34A853', icon:'🔑' },
  checked_in:         { label:'Checked In',          color:'#C8903A', icon:'🏠' },
  ready_for_checkout: { label:'Ready for Check-out', color:'#F59E0B', icon:'🧳' },
}

// Shows the car/number-plate photos Raman captured at check-in, while
// they're still in D1 (kept there for ~5 days for exactly this purpose,
// even after they've already reached the guest's Drive folder — see
// cleanupExpiredDocuments and processPendingDocumentUploads in
// GuestFormScript.gs). After 5 days these are only in Drive.
function CarPlatePhotos({ stayId }) {
  const [photos, setPhotos] = useState(null)  // null = loading, [] = none, [...] = found
  const [zoomed, setZoomed] = useState(null)

  useEffect(() => {
    let cancelled = false
    setPhotos(null)
    api.getStayPhotos(stayId)
      .then(rows => { if (!cancelled) setPhotos(Array.isArray(rows) ? rows : []) })
      .catch(() => { if (!cancelled) setPhotos([]) })
    return () => { cancelled = true }
  }, [stayId])

  if (photos === null) return null   // don't flash a section while loading
  if (photos.length === 0) return null  // nothing captured, or past the 5-day window — no clutter

  return (
    <>
      <div className="card-section-label">CAR & PLATE PHOTOS <span style={{fontWeight:400,color:'#5C7080'}}>(available ~5 days)</span></div>
      <div style={{display:'flex', gap:'8px', marginBottom:'14px'}}>
        {photos.map(p => (
          <img key={p.doc_id}
            src={`data:image/jpeg;base64,${p.file_b64}`}
            alt={p.doc_type}
            onClick={() => setZoomed(p)}
            style={{width:'100px', height:'80px', objectFit:'cover', borderRadius:'8px',
              border:'1px solid var(--border-dim)', cursor:'pointer'}} />
        ))}
      </div>
      {zoomed && (
        <div onClick={() => setZoomed(null)} style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
        }}>
          <img src={`data:image/jpeg;base64,${zoomed.file_b64}`} alt={zoomed.doc_type}
            style={{maxWidth:'100%', maxHeight:'100%', borderRadius:'8px'}} />
        </div>
      )}
    </>
  )
}

export default function CheckIn() {
  const navigate = useNavigate()
  const [stays,    setStays]    = useState([])
  const [futureGuests, setFutureGuests] = useState([])
  const [selected, setSelected] = useState(null)
  const [tab,      setTab]      = useState('checkin')  // 'checkin' | 'inhouse'
  const [carNumber, setCarNumber] = useState('')
  const [carPhoto,  setCarPhoto]  = useState(null)
  const [platePhoto,setPlatePhoto]= useState(null)
  const [ocrBusy,   setOcrBusy]   = useState(false)   // reading plate photo
  const [ocrHint,   setOcrHint]   = useState('')      // status line under the field
  const [ocrSuggestion, setOcrSuggestion] = useState('') // read value when field already has manual text
  const [saving,  setSaving]    = useState(false)
  const [loading, setLoading]   = useState(true)
  const [toast,   setToast]     = useState(null)
  const carRef   = useRef()
  const plateRef = useRef()

  const showToast = (msg, type='success') => {
    setToast({msg,type}); setTimeout(()=>setToast(null),4000)
  }

  useEffect(() => { loadStays() }, [])

  async function loadStays() {
    setLoading(true)
    try {
      // Load ready_for_checkin stays
      const pending = await api.getPendingCheckIns()
      const allReadyForCheckin = Array.isArray(pending) ? pending : []

      // Only show a guest as actionable in the Check-in tab once their
      // check-in date is within the next 4 days — prevents accidentally
      // confirming someone whose actual arrival is months out (this is
      // exactly what happened with a guest whose real check-in was in
      // October getting checked in during July, because there was no
      // date guardrail on this list at all).
      const fourDaysOut = new Date()
      fourDaysOut.setHours(23, 59, 59, 999)
      fourDaysOut.setDate(fourDaysOut.getDate() + 4)
      const nearTermReady = allReadyForCheckin.filter(s => parseLocalDate(s.checkin_date) <= fourDaysOut)
      const farFutureReady = allReadyForCheckin.filter(s => parseLocalDate(s.checkin_date) > fourDaysOut)

      // Load all upcoming stays (any non-closed/cancelled status, checkin >= today)
      const active = await api.getUpcomingStays(DEFAULT_VILLA_ID)
      const allUpcoming = Array.isArray(active) ? active : []
      const inhouse = allUpcoming.filter(s => ['checked_in','ready_for_checkout'].includes(s.status))

      // Future guests block: anyone upcoming who isn't already actionable
      // (near-term ready-for-checkin) or in-house, within the next 2
      // months — gives Raman visibility of the pipeline (including a
      // far-future ready_for_checkin guest, informationally, without
      // letting him check them in early) without affecting his actual
      // check-in/checkout workflow.
      const twoMonthsOut = new Date()
      twoMonthsOut.setMonth(twoMonthsOut.getMonth() + 2)
      const future = allUpcoming
        .filter(s => !['checked_in','ready_for_checkout'].includes(s.status))
        .filter(s => !nearTermReady.some(p => p.stay_id === s.stay_id))
        .filter(s => parseLocalDate(s.checkin_date) <= twoMonthsOut)
        .sort((a,b) => parseLocalDate(a.checkin_date) - parseLocalDate(b.checkin_date))

      setStays({ pending: nearTermReady, inhouse })
      setFutureGuests(future)
      if (nearTermReady.length > 0) setSelected(nearTermReady[0])
      else if (inhouse.length > 0) { setSelected(inhouse[0]); setTab('inhouse') }
    } catch(e) {
      showToast('Could not load stays: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  const pendingList = stays.pending || []
  const inhouseList = stays.inhouse || []

  function handlePhotoCapture(type, e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      if (type==='car')   setCarPhoto({file, preview:ev.target.result})
      if (type==='plate') {
        setPlatePhoto({file, preview:ev.target.result})
        // Kick off plate OCR to pre-fill the car number. Fire-and-forget:
        // it never blocks the photo capture or the check-in itself.
        const b64 = ev.target.result.split(',')[1]
        runPlateOcr(b64)
      }
    }
    reader.readAsDataURL(file)
  }

  // Read the number-plate photo via Workers AI and pre-fill "Car number".
  // Advisory only — Raman verifies/corrects. Any failure just leaves the
  // field for manual entry with a gentle hint; nothing here can break the
  // check-in flow.
  async function runPlateOcr(platePhotoB64) {
    if (!platePhotoB64) return
    setOcrBusy(true); setOcrHint(''); setOcrSuggestion('')
    try {
      const res = await api.ocrPlate({ platePhotoB64 })
      const plate = res?.plate || ''
      if (!plate) {
        setOcrHint("Couldn't read the plate — please type it in")
        return
      }
      // Don't clobber a number Raman already typed; offer it instead.
      if (carNumber.trim() && carNumber.trim() !== plate) {
        setOcrSuggestion(plate)
        setOcrHint('')
      } else {
        setCarNumber(plate)
        setOcrHint('✨ Auto-read from the plate photo — please check it')
      }
    } catch (e) {
      setOcrHint("Couldn't read the plate — please type it in")
    } finally {
      setOcrBusy(false)
    }
  }

  // Confirm check-in (ready_for_checkin → checked_in)
  async function handleConfirmCheckIn() {
    if (!selected) { showToast('No guest selected','error'); return }
    setSaving(true)
    try {
      const carPhotoB64   = carPhoto   ? carPhoto.preview.split(',')[1]   : null
      const platePhotoB64 = platePhoto ? platePhoto.preview.split(',')[1] : null

      await api.confirmCheckIn({
        stayId:       selected.stay_id,
        villaId:      DEFAULT_VILLA_ID,
        guestName:    selected.guest_name,
        checkInDate:  selected.checkin_date,
        checkOutDate: selected.checkout_date,
        adultsCount:  selected.adults || 1,
        childrenCount: selected.children || 0,
        carNumber,
        carPhotoB64,
        platePhotoB64,
      })
      showToast('✅ Check-in confirmed! ' + selected.stay_id)
      setCarPhoto(null); setPlatePhoto(null); setCarNumber('')
      setOcrBusy(false); setOcrHint(''); setOcrSuggestion('')
      await loadStays()
    } catch(e) {
      showToast('Failed: ' + e.message, 'error')
    } finally { setSaving(false) }
  }

  // Move to ready_for_checkout
  async function handleReadyForCheckout() {
    if (!selected) return
    setSaving(true)
    try {
      await api.updateStayStatus({ stayId: selected.stay_id, status: 'ready_for_checkout' })
      showToast('Marked ready for check-out ✓')
      await loadStays()
    } catch(e) { showToast('Failed: '+e.message,'error') }
    finally { setSaving(false) }
  }

  // Complete checkout (ready_for_checkout → checked_out)
  async function handleCompleteCheckout() {
    if (!selected) return
    setSaving(true)
    try {
      await api.checkOut({ stayId: selected.stay_id })
      showToast('✅ Check-out complete! Raman commission recorded.')
      setSelected(null)
      await loadStays()
    } catch(e) { showToast('Failed: '+e.message,'error') }
    finally { setSaving(false) }
  }

  const nights = selected ? calcNights(selected.checkin_date, selected.checkout_date) : 0
  const days   = selected ? daysFromNow(selected.checkin_date) : null

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Guest check-in</div>
          <div className="topbar-sub">GVR DWARKA VILLA</div>
        </div>
        <div style={{width:34}}/>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',background:'var(--dark-card)',borderBottom:'1px solid var(--border-dim)',flexShrink:0}}>
        {[
          {key:'checkin', label:`Check-in (${pendingList.length})`, icon:'🔑'},
          {key:'inhouse', label:`In-house (${inhouseList.length})`,  icon:'🏠'},
        ].map(t => (
          <button key={t.key} onClick={()=>{setTab(t.key); setSelected(t.key==='checkin'?pendingList[0]:inhouseList[0])}}
            style={{flex:1,padding:'12px 4px',border:'none',background:'transparent',cursor:'pointer',
              color:tab===t.key?'var(--gold)':'var(--text-dim)',
              borderBottom:tab===t.key?'2px solid var(--gold)':'2px solid transparent',
              fontSize:'0.78rem',fontWeight:tab===t.key?'700':'400'}}>
            <div style={{fontSize:'1rem',marginBottom:'2px'}}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      <div className="screen-body">
        {loading && <div className="loading"><div className="spinner"/>Loading…</div>}

        {/* ── CHECK-IN TAB ── */}
        {!loading && tab==='checkin' && (
          <>
            {pendingList.length === 0 ? (
              <div className="card" style={{textAlign:'center',padding:'32px 16px'}}>
                <div style={{fontSize:'2rem',marginBottom:'12px'}}>🔑</div>
                <div style={{color:'var(--gold)',fontWeight:'600',marginBottom:'6px'}}>No guests ready for check-in</div>
                <div style={{color:'var(--text-dim)',fontSize:'0.85rem'}}>
                  Owner must mark a booking as "Ready for Check-in" before it appears here.
                </div>
              </div>
            ) : (
              <>
                {/* Guest selector */}
                {pendingList.length > 1 && (
                  <>
                    <div className="card-section-label">SELECT GUEST</div>
                    <div style={{background:'var(--dark-card)',borderRadius:'12px',
                      border:'1px solid var(--border-dim)',overflow:'hidden',marginBottom:'14px'}}>
                      {pendingList.map((stay,i) => (
                        <div key={stay.stay_id} onClick={()=>setSelected(stay)}
                          style={{padding:'12px 16px',cursor:'pointer',
                            borderBottom:i<pendingList.length-1?'1px solid var(--border-dim)':'none',
                            background:selected?.stay_id===stay.stay_id?'rgba(200,144,58,0.07)':'transparent',
                            display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div>
                            <div style={{fontWeight:'600',fontSize:'0.88rem'}}>
                              {selected?.stay_id===stay.stay_id && <span style={{color:'var(--gold)',marginRight:'6px'}}>✓</span>}
                              {stay.guest_name}
                            </div>
                            <div style={{fontSize:'0.73rem',color:'var(--text-dim)',marginTop:'2px'}}>
                              {formatDate(stay.checkin_date)} · {calcNights(stay.checkin_date,stay.checkout_date)}N
                            </div>
                          </div>
                          <span style={{fontSize:'0.68rem',fontWeight:'700',padding:'2px 8px',
                            borderRadius:'10px',background:'rgba(52,168,83,0.15)',color:'#34A853'}}>
                            Ready
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {selected && (
                  <>
                    {/* Early check-in / late check-out — called out ABOVE the
                        booking summary, first thing Raman sees, since these
                        change what time he should actually expect the guest
                        (and the guest's own typed ETA sometimes undercuts the
                        approved early-check-in time — e.g. approved Noon, but
                        guest says 11am — so both are shown for him to judge). */}
                    {(!!selected.request_early_checkin || !!selected.request_late_checkout) && (
                      <div style={{
                        marginBottom:'12px', padding:'10px 14px', borderRadius:'10px',
                        background:'rgba(200,144,58,0.1)', border:'1px solid rgba(200,144,58,0.35)',
                      }}>
                        {!!selected.request_early_checkin && (
                          <div style={{color:'var(--gold)', fontWeight:'700', fontSize:'0.85rem'}}>
                            ⏰ Early check-in approved — Noon
                          </div>
                        )}
                        {!!selected.request_late_checkout && (
                          <div style={{color:'var(--gold)', fontWeight:'700', fontSize:'0.85rem', marginTop: selected.request_early_checkin ? '4px' : 0}}>
                            🌙 Late check-out approved
                          </div>
                        )}
                        {selected.eta && (
                          <div style={{color:'var(--text-dim)', fontSize:'0.78rem', marginTop:'4px'}}>
                            Guest's requested ETA: <strong style={{color:'var(--text)'}}>{selected.eta}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Booking summary */}
                    <div className="card-section-label">BOOKING SUMMARY</div>
                    <div className="card">
                      <div className="grid-2">
                        <div className="field">
                          <div className="field-label">Guest</div>
                          <div className="field-input auto-filled">{selected.guest_name}</div>
                        </div>
                        <div className="field">
                          <div className="field-label">Stay ID</div>
                          <div className="field-input" style={{color:'var(--gold)',fontWeight:'700',
                            fontFamily:'monospace',fontSize:'0.85rem'}}>{selected.stay_id}</div>
                        </div>
                        <div className="field">
                          <div className="field-label">Check-in</div>
                          <div className="field-input gold">{formatDate(selected.checkin_date)}</div>
                        </div>
                        <div className="field">
                          <div className="field-label">Check-out</div>
                          <div className="field-input gold">{formatDate(selected.checkout_date)}</div>
                        </div>
                        <div className="field">
                          <div className="field-label">Nights</div>
                          <div className="field-input" style={{color:'#85B7EB',fontWeight:'600'}}>{nights}</div>
                        </div>
                        <div className="field">
                          <div className="field-label">Guests</div>
                          <div className="field-input auto-filled">{selected.adults||1} adults{selected.children>0?`, ${selected.children} children`:''}</div>
                        </div>
                      </div>
                      {selected.guest_phone && (
                        <div className="field" style={{marginBottom:0,marginTop:'4px'}}>
                          <div className="field-label">WhatsApp</div>
                          <div className="field-input auto-filled">{selected.guest_phone}</div>
                        </div>
                      )}
                      {!selected.request_early_checkin && !selected.request_late_checkout && selected.eta && (
                        <div className="field" style={{marginBottom:0,marginTop:'4px'}}>
                          <div className="field-label">Requested ETA</div>
                          <div className="field-input auto-filled">{selected.eta}</div>
                        </div>
                      )}
                    </div>

                    {/* Directions & arrival steps — send a day or two before arrival */}
                    {selected.guest_phone ? (
                      <a href={buildArrivalWaLink(selected)} target="_blank" rel="noreferrer"
                        style={{
                          display:'block', padding:'12px', borderRadius:'10px', textAlign:'center',
                          background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.3)',
                          color:'#25D366', fontWeight:'700', fontSize:'0.85rem',
                          textDecoration:'none', marginBottom:'12px',
                        }}>
                        📍 Send directions & arrival steps to guest
                      </a>
                    ) : (
                      <div style={{
                        padding:'10px 14px', borderRadius:'10px', marginBottom:'12px',
                        background:'rgba(37,211,102,0.05)', border:'1px dashed rgba(37,211,102,0.2)',
                        color:'rgba(37,211,102,0.45)', fontSize:'0.78rem', textAlign:'center',
                      }}>
                        📍 Directions & arrival steps available once guest phone is captured
                      </div>
                    )}

                    {/* Extra services requested — from booking */}
                    {(() => {
                      let extras = []
                      try {
                        const raw = selected.extra_lines || selected.extraLines
                        if (raw) extras = JSON.parse(raw)
                      } catch(e) {}
                      const hasExtras = extras.length > 0 || (selected.extra_charges > 0)
                      if (!hasExtras) return null
                      return (
                        <>
                          <div className="card-section-label">EXTRA SERVICES REQUESTED</div>
                          <div className="card" style={{marginBottom:'12px'}}>
                            {extras.length > 0 ? extras.map((ex,i) => (
                              <div key={i} style={{display:'flex',justifyContent:'space-between',
                                alignItems:'center',padding:'6px 0',
                                borderBottom:i<extras.length-1?'1px solid var(--border-dim)':'none'}}>
                                <span style={{fontSize:'0.85rem',fontWeight:'600'}}>
                                  {i+1}. {ex.label||ex.item||ex.type||ex.name}
                                </span>
                                {/*(ex.amount||ex.price) > 0 && (
                                  <span style={{color:'var(--gold)',fontWeight:'700'}}>
                                    {'₹'}{Number(ex.amount||ex.price).toLocaleString('en-IN')}
                                  </span>
                                )*/}
                              </div>
                            )) : (
                              <div style={{display:'flex',justifyContent:'space-between'}}>
                                <span style={{fontSize:'0.85rem'}}>Extra charges</span>
                                {/*<span style={{color:'var(--gold)',fontWeight:'700'}}>
                                  {'₹'}{Number(selected.extra_charges).toLocaleString('en-IN')}
                                </span>*/}
                              </div>
                            )}
                          </div>
                        </>
                      )
                    })()}

                    {/* Car photos — Raman's main task */}
                    <div className="card-section-label">YOUR TASK — TAKE CAR PHOTOS</div>
                    <div className="card">
                      <div className="photo-row">
                        <div className={`photo-box ${carPhoto?'captured':''}`} onClick={()=>carRef.current?.click()}>
                          {carPhoto
                            ? <img src={carPhoto.preview} alt="car" style={{width:'100%',height:'80px',objectFit:'cover',borderRadius:'6px'}}/>
                            : <><div className="photo-icon">📷</div><div className="photo-label">Car photo</div><div className="photo-sub">Tap to take</div></>
                          }
                          <input ref={carRef} type="file" accept="image/*" capture="environment"
                            onChange={e=>handlePhotoCapture('car',e)} style={{display:'none'}}/>
                        </div>
                        <div className={`photo-box ${platePhoto?'captured':''}`} onClick={()=>plateRef.current?.click()}>
                          {platePhoto
                            ? <img src={platePhoto.preview} alt="plate" style={{width:'100%',height:'80px',objectFit:'cover',borderRadius:'6px'}}/>
                            : <><div className="photo-icon">🔢</div><div className="photo-label">Number plate</div><div className="photo-sub">Tap to take</div></>
                          }
                          <input ref={plateRef} type="file" accept="image/*" capture="environment"
                            onChange={e=>handlePhotoCapture('plate',e)} style={{display:'none'}}/>
                        </div>
                      </div>
                      <div className="divider"/>
                      <div className="field" style={{marginBottom:0}}>
                        <div className="field-label">
                          Car number
                          {ocrBusy && <span style={{marginLeft:8,fontWeight:400,color:'#8a94a6'}}>· reading plate photo…</span>}
                        </div>
                        <input className="field-input" placeholder="e.g. KL 07 AB 1234"
                          value={carNumber}
                          onChange={e=>{ setCarNumber(e.target.value.toUpperCase()); setOcrHint(''); setOcrSuggestion('') }}
                          style={{textTransform:'uppercase'}}/>
                        {ocrHint && (
                          <div style={{marginTop:6,fontSize:12,color:'#8a94a6'}}>{ocrHint}</div>
                        )}
                        {ocrSuggestion && (
                          <div style={{marginTop:6,fontSize:12,color:'#8a94a6'}}>
                            Photo reads “{ocrSuggestion}” ·{' '}
                            <span
                              onClick={()=>{ setCarNumber(ocrSuggestion); setOcrSuggestion(''); setOcrHint('✨ Using the plate photo reading — please check it') }}
                              style={{color:'#c9a24b',fontWeight:600,cursor:'pointer'}}>use this</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button className="btn btn-gold" onClick={handleConfirmCheckIn} disabled={saving}>
                      {saving?'Confirming…':'✅ Confirm check-in'}
                    </button>
                    <p className="btn-email-note">📧 Owner notified on check-in</p>
                  </>
                )}
              </>
            )}

            {/* ── FUTURE GUESTS — pipeline visibility, next 2 months ── */}
            {futureGuests.length > 0 && (
              <>
                <div className="card-section-label" style={{marginTop:'18px'}}>
                  FUTURE GUESTS — NEXT 2 MONTHS ({futureGuests.length})
                </div>
                <div style={{background:'var(--dark-card)',borderRadius:'12px',
                  border:'1px solid var(--border-dim)',overflow:'hidden',marginBottom:'14px'}}>
                  {futureGuests.map((stay,i) => {
                    const m = STATUS_META[stay.status] || { label: stay.status, color:'#5C7080', icon:'📋' }
                    const d = daysFromNow(stay.checkin_date)
                    return (
                      <div key={stay.stay_id} style={{padding:'11px 16px',
                        borderBottom:i<futureGuests.length-1?'1px solid var(--border-dim)':'none',
                        display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontWeight:'600',fontSize:'0.85rem'}}>{stay.guest_name}</div>
                          <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginTop:'2px'}}>
                            {formatDate(stay.checkin_date)}
                            {d !== null && d > 0 && <span> · in {d} day{d!==1?'s':''}</span>}
                          </div>
                          {/* Early check-in / late check-out flagged here too,
                              not just once the guest is Ready for Check-in —
                              so Raman can plan ahead of time, not find out the
                              same day. */}
                          {(!!stay.request_early_checkin || !!stay.request_late_checkout) && (
                            <div style={{fontSize:'0.7rem',color:'var(--gold)',marginTop:'2px',fontWeight:'600'}}>
                              {!!stay.request_early_checkin && `⏰ Early check-in — Noon${stay.eta ? ` (asked for ${stay.eta})` : ''}`}
                              {!!stay.request_early_checkin && !!stay.request_late_checkout && ' · '}
                              {!!stay.request_late_checkout && '🌙 Late check-out'}
                            </div>
                          )}
                        </div>
                        <span style={{fontSize:'0.66rem',fontWeight:'700',padding:'2px 8px',
                          borderRadius:'10px',background:m.color+'22',color:m.color,whiteSpace:'nowrap'}}>
                          {m.icon} {m.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ── IN-HOUSE TAB ── */}
        {!loading && tab==='inhouse' && (
          <>
            {inhouseList.length === 0 ? (
              <div className="card" style={{textAlign:'center',padding:'32px 16px'}}>
                <div style={{fontSize:'2rem',marginBottom:'12px'}}>🏠</div>
                <div style={{color:'var(--gold)',fontWeight:'600',marginBottom:'6px'}}>No guests currently in-house</div>
              </div>
            ) : (
              <>
                {inhouseList.length > 1 && (
                  <>
                    <div className="card-section-label">SELECT GUEST</div>
                    <div style={{background:'var(--dark-card)',borderRadius:'12px',
                      border:'1px solid var(--border-dim)',overflow:'hidden',marginBottom:'14px'}}>
                      {inhouseList.map((stay,i) => {
                        const m = STATUS_META[stay.status] || STATUS_META.checked_in
                        return (
                          <div key={stay.stay_id} onClick={()=>setSelected(stay)}
                            style={{padding:'12px 16px',cursor:'pointer',
                              borderBottom:i<inhouseList.length-1?'1px solid var(--border-dim)':'none',
                              background:selected?.stay_id===stay.stay_id?'rgba(200,144,58,0.07)':'transparent',
                              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <div>
                              <div style={{fontWeight:'600',fontSize:'0.88rem'}}>
                                {selected?.stay_id===stay.stay_id && <span style={{color:'var(--gold)',marginRight:'6px'}}>✓</span>}
                                {stay.guest_name}
                              </div>
                              <div style={{fontSize:'0.73rem',color:'var(--text-dim)',marginTop:'2px'}}>
                                Out: {formatDate(stay.checkout_date)}
                              </div>
                            </div>
                            <span style={{fontSize:'0.68rem',fontWeight:'700',padding:'2px 8px',
                              borderRadius:'10px',background:m.color+'22',color:m.color}}>
                              {m.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {selected && ['checked_in','ready_for_checkout'].includes(selected.status) && (
                  <>
                    <div className="card-section-label">GUEST</div>
                    <div className="card">
                      <div className="grid-2">
                        <div className="field">
                          <div className="field-label">Name</div>
                          <div className="field-input auto-filled">{selected.guest_name}</div>
                        </div>
                        <div className="field">
                          <div className="field-label">Stay ID</div>
                          <div className="field-input" style={{color:'var(--gold)',fontWeight:'700',
                            fontFamily:'monospace',fontSize:'0.85rem'}}>{selected.stay_id}</div>
                        </div>
                        <div className="field">
                          <div className="field-label">Check-out</div>
                          <div className="field-input gold">{formatDate(selected.checkout_date)}</div>
                        </div>
                        <div className="field">
                          <div className="field-label">Nights</div>
                          <div className="field-input" style={{color:'#85B7EB',fontWeight:'600'}}>{nights}</div>
                        </div>
                      </div>
                    </div>

                    <CarPlatePhotos stayId={selected.stay_id} />

                    {/* Status actions */}
                    <div className="card-section-label">CHECKOUT ACTIONS</div>
                    <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'14px'}}>
                      {selected.status === 'checked_in' && (
                        <button onClick={handleReadyForCheckout} disabled={saving}
                          style={{width:'100%',padding:'12px',borderRadius:'10px',
                            border:'1px solid rgba(245,158,11,0.4)',
                            background:'rgba(245,158,11,0.12)',color:'#F59E0B',
                            fontWeight:'700',fontSize:'0.88rem',cursor:'pointer',textAlign:'left'}}>
                          {saving?'…':'🧳 Guest is ready to check out'}
                        </button>
                      )}
                      {selected.status === 'ready_for_checkout' && (
                        <button onClick={handleCompleteCheckout} disabled={saving}
                          style={{width:'100%',padding:'12px',borderRadius:'10px',
                            border:'1px solid rgba(52,168,83,0.4)',
                            background:'rgba(52,168,83,0.12)',color:'#34A853',
                            fontWeight:'700',fontSize:'0.88rem',cursor:'pointer',textAlign:'left'}}>
                          {saving?'…':'✅ Complete check-out — guest has left'}
                        </button>
                      )}
                    </div>
                    <p style={{color:'var(--text-dim)',fontSize:'0.75rem',textAlign:'center',marginTop:'4px'}}>
                      📧 Owner notified · Raman commission auto-created on check-out
                    </p>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
