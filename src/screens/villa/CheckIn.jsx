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

function formatDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) }
  catch { return String(d) }
}
function calcNights(ci, co) {
  if (!ci||!co) return 0
  return Math.max(0, Math.round((new Date(co)-new Date(ci))/(1000*60*60*24)))
}
function daysFromNow(d) {
  if (!d) return null
  return Math.round((new Date(d)-new Date())/(1000*60*60*24))
}

const STATUS_META = {
  ready_for_checkin:  { label:'Ready for Check-in',  color:'#34A853', icon:'🔑' },
  checked_in:         { label:'Checked In',          color:'#C8903A', icon:'🏠' },
  ready_for_checkout: { label:'Ready for Check-out', color:'#F59E0B', icon:'🧳' },
}

export default function CheckIn() {
  const navigate = useNavigate()
  const [stays,    setStays]    = useState([])
  const [selected, setSelected] = useState(null)
  const [tab,      setTab]      = useState('checkin')  // 'checkin' | 'inhouse'
  const [carNumber, setCarNumber] = useState('')
  const [carPhoto,  setCarPhoto]  = useState(null)
  const [platePhoto,setPlatePhoto]= useState(null)
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
      // Load checked_in and ready_for_checkout stays (in-house guests)
      const active = await api.getUpcomingStays('dwarka')
      const inhouse = Array.isArray(active)
        ? active.filter(s => ['checked_in','ready_for_checkout'].includes(s.status))
        : []
      setStays({ pending: Array.isArray(pending) ? pending : [], inhouse })
      const allReady = Array.isArray(pending) ? pending : []
      if (allReady.length > 0) setSelected(allReady[0])
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
      if (type==='plate') setPlatePhoto({file, preview:ev.target.result})
    }
    reader.readAsDataURL(file)
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
        villaId:      'dwarka',
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
                    </div>

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
                        <div className="field-label">Car number</div>
                        <input className="field-input" placeholder="e.g. KL 07 AB 1234"
                          value={carNumber} onChange={e=>setCarNumber(e.target.value.toUpperCase())}
                          style={{textTransform:'uppercase'}}/>
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
