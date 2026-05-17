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
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

const CHANNELS   = ['Direct','Airbnb','MakeMyTrip','Booking.com','Goibibo','Other']
const COMMISSION = { Direct:0, Airbnb:15, MakeMyTrip:18, 'Booking.com':15, Goibibo:18, Other:10 }

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
  try { return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) }
  catch { return d }
}
function daysFromNow(d) {
  if (!d) return null
  return Math.round((new Date(d) - new Date()) / (1000*60*60*24))
}

const EMPTY_FORM = { channel:'Direct', tariffPerNight:'', extraCharges:'0', notes:'' }

export default function CompleteBooking() {
  const navigate = useNavigate()
  const [stays, setStays]       = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [toast, setToast]       = useState(null)

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
      if (list.length > 0) selectStay(list[0])
    } catch(e) {
      showToast('Could not load bookings: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  function selectStay(stay) {
    setSelected(stay)
    // Pre-fill form from existing stay data
    setForm({
      channel:        stay.source
                        ? stay.source.charAt(0).toUpperCase() + stay.source.slice(1).replace('_','.')
                        : 'Direct',
      tariffPerNight: stay.tariff_per_night || '',
      extraCharges:   stay.extra_charges    || '0',
      notes:          stay.notes            || '',
    })
  }

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  // Derived financials
  const nights  = selected
    ? Math.max(0, Math.round((new Date(selected.checkout_date)-new Date(selected.checkin_date))/(1000*60*60*24)))
    : 0
  const tariff  = parseFloat(form.tariffPerNight)||0
  const extra   = parseFloat(form.extraCharges)||0
  const gross   = (tariff * nights) + extra
  const commPct = COMMISSION[form.channel]||0
  const commAmt = Math.round(gross * commPct / 100)
  const net     = gross - commAmt

  // Save financial details (updates stay record)
  async function handleSaveFinancials() {
    if (!selected) return
    if (form.tariffPerNight === '') { showToast('Enter the tariff (0 is valid)', 'error'); return }
    setSaving(true)
    try {
      await api.saveVillaRentalIncome({
        stayId:    selected.stay_id,
        villaId:   'dwarka',
        guestName: selected.guest_name,
        checkInDate:  selected.checkin_date,
        checkOutDate: selected.checkout_date,
        channel:   form.channel,
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

  const s = selected
  const meta = s ? (STATUS_META[s.status] || STATUS_META.booked) : null
  const days = s ? daysFromNow(s.checkin_date) : null

  // What action buttons to show based on current status
  const canMarkDocsUploaded   = s && ['booked','confirmed'].includes(s.status)
  const canMarkReadyForCheckin = s && ['booked','confirmed','docs_uploaded'].includes(s.status)
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
            <div className="card-section-label">SELECT GUEST</div>
            <div style={{background:'var(--dark-card)',borderRadius:'12px',border:'1px solid var(--border-dim)',overflow:'hidden',marginBottom:'14px'}}>
              {stays.map((stay, i) => {
                const m   = STATUS_META[stay.status] || STATUS_META.booked
                const d   = daysFromNow(stay.checkin_date)
                const sel = selected?.stay_id === stay.stay_id
                return (
                  <div key={stay.stay_id}
                    onClick={() => selectStay(stay)}
                    style={{
                      padding:'12px 16px', cursor:'pointer',
                      borderBottom: i < stays.length-1 ? '1px solid var(--border-dim)' : 'none',
                      background: sel ? 'rgba(200,144,58,0.07)' : 'transparent',
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                    }}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px'}}>
                        {sel && <span style={{color:'var(--gold)'}}>✓</span>}
                        <span style={{fontWeight:'600',fontSize:'0.9rem',
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {stay.guest_name}
                        </span>
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

                {/* Drive folder link */}
                {s.drive_folder_id && (
                  <a href={`https://drive.google.com/drive/folders/${s.drive_folder_id}`}
                    target="_blank" rel="noreferrer"
                    style={{display:'block',padding:'10px 14px',background:'var(--dark-card)',
                      border:'1px solid var(--border-dim)',borderRadius:'10px',marginBottom:'14px',
                      color:'#85B7EB',fontSize:'0.82rem',textDecoration:'none'}}>
                    📁 Open guest Drive folder → verify ID + registration docs uploaded
                  </a>
                )}

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
                    <div className="field">
                      <label className="field-label">Tariff / night (₹)</label>
                      <input className="field-input gold" type="number" placeholder="0"
                        value={form.tariffPerNight} onChange={e=>set('tariffPerNight',e.target.value)}/>
                    </div>
                    <div className="field">
                      <label className="field-label">Extra charges (₹)</label>
                      <input className="field-input" type="number" placeholder="0"
                        value={form.extraCharges} onChange={e=>set('extraCharges',e.target.value)}/>
                    </div>
                  </div>
                </div>

                {/* Revenue summary */}
                <div className="net-box">
                  <div className="net-row">
                    <span className="net-label">Gross ({nights}N × {fmt(tariff)})</span>
                    <span className="net-val pos">{fmt(gross)}</span>
                  </div>
                  {commPct > 0 && (
                    <div className="net-row">
                      <span className="net-label">{form.channel} commission ({commPct}%)</span>
                      <span className="net-val neg">−{fmt(commAmt)}</span>
                    </div>
                  )}
                  <div className="net-divider"/>
                  <div className="net-row">
                    <span style={{color:'#EDF2F7',fontWeight:'600',fontSize:'1rem'}}>Net to owner</span>
                    <span className="net-val big">{fmt(net)}</span>
                  </div>
                </div>

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
                  {[
                    ['Booked',              'Booking received, not yet confirmed'],
                    ['Confirmed',           'Booking confirmed with guest'],
                    ['Docs Uploaded',       'Guest has uploaded ID + registration form'],
                    ['Ready for Check-in',  '← YOU ARE HERE · Raman can now check in'],
                    ['Checked In',          'Raman completed check-in, car photos taken'],
                    ['Ready for Check-out', 'Guest ready to leave'],
                    ['Checked Out',         'Stay complete, Raman commission auto-created'],
                    ['Closed',              'Financials settled'],
                  ].map(([st,desc],i) => (
                    <div key={i} style={{display:'flex',gap:'10px',
                      color: s.status===st.toLowerCase().replace(/ /g,'_') ? 'var(--text)':'inherit'}}>
                      <span style={{
                        minWidth:'130px',flexShrink:0,
                        color: s.status===st.toLowerCase().replace(/ /g,'_') ? 'var(--gold)':'inherit',
                        fontWeight: s.status===st.toLowerCase().replace(/ /g,'_') ? '700':'400',
                      }}>{st}</span>
                      <span>{desc}</span>
                    </div>
                  ))}
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
