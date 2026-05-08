import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

// Column mapping from the Google Form response sheet
// Based on actual Vikram submission headers
const COL = {
  timestamp:        0,
  email:            1,
  phone:            2,
  address:          3,
  guestNames:       4,   // "Name/Age, Name/Age" format
  citizenship:      5,
  additionalGuests: 6,
  aadhaar:          7,
  aadhaarUpload:    8,
  passportNumber:   9,
  passportUpload:   10,
  visaInfo:         11,
  eta:              12,
  purpose:          13,
  transport:        14,
  breakfast:        15,
  checkInDate:      16,
  checkOutDate:     17,
  adultsCount:      18,
  childrenCount:    19,
  infantsCount:     20,
  bookerName:       21,
}

function parseGuestNames(raw) {
  if (!raw) return []
  return raw.split(',').map(g => {
    const parts = g.trim().split('/')
    return { name: parts[0]?.trim() || '', age: parts[1]?.trim() || '' }
  }).filter(g => g.name)
}

function formatDate(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date)) return String(d)
  return date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}

function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0
  const diff = new Date(checkOut) - new Date(checkIn)
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)))
}

export default function CheckIn() {
  const navigate   = useNavigate()
  const [pending, setPending]     = useState([])   // list of form submissions
  const [selected, setSelected]   = useState(null) // chosen submission
  const [expanded, setExpanded]   = useState(false)
  const [carNumber, setCarNumber] = useState('')
  const [carPhoto, setCarPhoto]   = useState(null)
  const [platePhoto, setPlatePhoto] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const carPhotoRef   = useRef()
  const platePhotoRef = useRef()

  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    api.getPendingCheckIns()
      .then(rows => {
        setPending(rows)
        if (rows.length > 0) setSelected(rows[0])
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        showToast('Could not load form submissions. Check connection.', 'error')
      })
  }, [])

  const guests     = selected ? parseGuestNames(selected[COL.guestNames]) : []
  const nights     = selected ? calcNights(selected[COL.checkInDate], selected[COL.checkOutDate]) : 0
  const citizenship = selected ? String(selected[COL.citizenship] || '').toLowerCase() : ''
  const isForeign  = citizenship.includes('foreign')
  const totalGuests = selected
    ? (parseInt(selected[COL.adultsCount])||0) +
      (parseInt(selected[COL.childrenCount])||0) +
      (parseInt(selected[COL.infantsCount])||0)
    : 0

  const handlePhotoCapture = (type, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      if (type === 'car')   setCarPhoto({ file, preview: ev.target.result })
      if (type === 'plate') setPlatePhoto({ file, preview: ev.target.result })
    }
    reader.readAsDataURL(file)
  }

  const handleConfirm = async () => {
    if (!selected) { showToast('No guest selected', 'error'); return }
    setSaving(true)
    try {
      const result = await api.confirmCheckIn({
        villaId:          'dwarka',
        guestName:        guests[0]?.name || selected[COL.bookerName] || 'Guest',
        bookerName:       selected[COL.bookerName] || '',
        checkInDate:      selected[COL.checkInDate],
        checkOutDate:     selected[COL.checkOutDate],
        adultsCount:      selected[COL.adultsCount] || 0,
        childrenCount:    selected[COL.childrenCount] || 0,
        infantsCount:     selected[COL.infantsCount] || 0,
        citizenship:      selected[COL.citizenship] || 'Indian',
        govtId:           isForeign ? selected[COL.passportNumber] : selected[COL.aadhaar],
        phone:            selected[COL.phone] || '',
        email:            selected[COL.email] || '',
        eta:              selected[COL.eta] || '',
        purpose:          selected[COL.purpose] || '',
        transport:        selected[COL.transport] || 'No',
        breakfastPrepaid: selected[COL.breakfast] || 'No',
        additionalGuests: selected[COL.additionalGuests] || 'No',
        carNumber:        carNumber,
        channel:          'Direct',
        guestNamesRaw:    selected[COL.guestNames] || '',
        visaInfo:         isForeign ? selected[COL.visaInfo] || '' : '',
      })
      showToast('Check-in confirmed! Stay ID: ' + result?.data?.stayId)
      setTimeout(() => navigate('/'), 2500)
    } catch (e) {
      showToast('Failed to confirm check-in. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Guest check-in</div>
          <div className="topbar-sub">GVR DVARAKA VILLA</div>
        </div>
        <div style={{width:34}}/>
      </div>

      <div className="screen-body">

        {/* PENDING SUBMISSIONS */}
        {loading ? (
          <div className="loading"><div className="spinner"/>Loading guest forms...</div>
        ) : pending.length === 0 ? (
          <div className="card" style={{textAlign:'center',padding:'32px 16px'}}>
            <div style={{fontSize:'2rem',marginBottom:'12px'}}>📋</div>
            <div style={{color:'var(--gold)',fontWeight:'600',marginBottom:'6px'}}>No pending check-ins</div>
            <div style={{color:'var(--text-dim)',fontSize:'0.85rem'}}>
              Guests must fill the online registration form before check-in appears here.
            </div>
          </div>
        ) : (
          <>
            {/* Guest selector — show if multiple pending */}
            {pending.length > 1 && (
              <>
                <div className="card-section-label">SELECT GUEST</div>
                <div className="menu-tile" style={{marginBottom:'14px'}}>
                  {pending.map((row, i) => (
                    <div key={i} className="menu-row"
                      style={{
                        borderBottom: i < pending.length-1 ? '1px solid var(--border-dim)' : 'none',
                        background: selected === row ? 'rgba(200,144,58,0.06)' : undefined,
                      }}
                      onClick={() => setSelected(row)}>
                      <div className="menu-icon" style={{background:'rgba(200,144,58,0.08)'}}>🏠</div>
                      <div className="menu-label">
                        <div className="menu-title">{row[COL.bookerName] || 'Guest'}</div>
                        <div className="menu-sub">{formatDate(row[COL.checkInDate])} · {row[COL.adultsCount]} adults</div>
                      </div>
                      {selected === row && <span style={{color:'var(--gold)',fontSize:'1.1rem'}}>✓</span>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {selected && (
              <>
                {/* AUTO-FILLED BANNER */}
                <div className="banner-green" style={{marginBottom:'14px'}}>
                  <div className="banner-dot"/>
                  <div>
                    <div className="banner-title">Auto-filled from online registration</div>
                    <div className="banner-sub">
                      Submitted {formatDate(selected[COL.timestamp])} · Raman only needs to take car photos below
                    </div>
                  </div>
                </div>

                {/* BOOKING SUMMARY */}
                <div className="card-section-label">BOOKING SUMMARY</div>
                <div className="card">
                  <div className="grid-2">
                    <div className="field">
                      <div className="field-label">Booker</div>
                      <div className="field-input auto-filled">{selected[COL.bookerName] || '—'}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">Purpose</div>
                      <div className="field-input auto-filled">{selected[COL.purpose] || '—'}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">Check-in</div>
                      <div className="field-input gold">{formatDate(selected[COL.checkInDate])}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">Check-out</div>
                      <div className="field-input gold">{formatDate(selected[COL.checkOutDate])}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">Nights</div>
                      <div className="field-input" style={{color:'#85B7EB',fontWeight:'600'}}>{nights}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">ETA</div>
                      <div className="field-input auto-filled">{selected[COL.eta] || '—'}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">WhatsApp</div>
                      <div className="field-input auto-filled" style={{fontSize:'0.85rem'}}>{selected[COL.phone] || '—'}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">Email</div>
                      <div className="field-input auto-filled" style={{fontSize:'0.8rem'}}>{selected[COL.email] || '—'}</div>
                    </div>
                  </div>
                </div>

                {/* GUEST COUNT */}
                <div className="card-section-label">GUEST COUNT — {totalGuests} TOTAL</div>
                <div className="card">
                  <div className="grid-3">
                    <div className="field">
                      <div className="field-label">Adults</div>
                      <div className="field-input auto-filled" style={{textAlign:'center',fontSize:'1.1rem',fontWeight:'700'}}>{selected[COL.adultsCount]||0}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">Children</div>
                      <div className="field-input auto-filled" style={{textAlign:'center',fontSize:'1.1rem',fontWeight:'700'}}>{selected[COL.childrenCount]||0}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">Infants</div>
                      <div className="field-input auto-filled" style={{textAlign:'center',fontSize:'1.1rem',fontWeight:'700'}}>{selected[COL.infantsCount]||0}</div>
                    </div>
                  </div>
                  <div className="divider"/>
                  {/* Guest names list */}
                  <div className="field-label" style={{marginBottom:'8px'}}>GUEST NAMES</div>
                  <div style={styles.guestList}>
                    {(expanded ? guests : guests.slice(0,4)).map((g,i) => (
                      <div key={i} style={styles.guestRow}>
                        <span style={styles.guestName}>{g.name}</span>
                        <span style={styles.guestAge}>{g.age} yrs</span>
                      </div>
                    ))}
                    {guests.length > 4 && (
                      <div style={styles.guestMore} onClick={() => setExpanded(!expanded)}>
                        {expanded ? 'Show less ↑' : `+${guests.length - 4} more · tap to expand`}
                      </div>
                    )}
                  </div>

                  {selected[COL.additionalGuests] && !String(selected[COL.additionalGuests]).toLowerCase().includes('no') && (
                    <div className="tag-row" style={{marginTop:'10px'}}>
                      <span className="tag tag-gold">Additional guests requested</span>
                    </div>
                  )}
                </div>

                {/* ADD-ONS */}
                <div className="card-section-label">ADD-ONS REQUESTED</div>
                <div className="card">
                  <div className="tag-row">
                    <span className={`tag ${String(selected[COL.breakfast]||'').toLowerCase().includes('yes') ? 'tag-green' : 'tag-gray'}`}>
                      {String(selected[COL.breakfast]||'').toLowerCase().includes('yes') ? '✓ Breakfast prepaid' : 'No breakfast'}
                    </span>
                    <span className={`tag ${String(selected[COL.transport]||'').toLowerCase().includes('yes') ? 'tag-green' : 'tag-gray'}`}>
                      {String(selected[COL.transport]||'').toLowerCase().includes('yes') ? '✓ Transport needed' : 'No transport'}
                    </span>
                    {selected[COL.purpose] && (
                      <span className="tag tag-gold">{selected[COL.purpose]}</span>
                    )}
                  </div>
                </div>

                {/* IDENTITY */}
                <div className="card-section-label">
                  IDENTITY — {isForeign ? '🌍 FOREIGN CITIZEN' : '🇮🇳 INDIAN CITIZEN'}
                </div>
                <div className="card" style={{borderColor: isForeign ? 'rgba(24,95,165,0.25)' : 'rgba(52,168,83,0.2)'}}>
                  {!isForeign ? (
                    <div className="grid-2">
                      <div className="field">
                        <div className="field-label">Aadhaar / Passport</div>
                        <div className="field-input auto-filled">{selected[COL.aadhaar] || '—'}</div>
                      </div>
                      <div className="field">
                        <div className="field-label">ID Upload</div>
                        <div className="field-input auto-filled">
                          {selected[COL.aadhaarUpload] ? 'Received ✓' : 'Not uploaded'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid-2">
                        <div className="field">
                          <div className="field-label">Passport number</div>
                          <div className="field-input" style={{color:'#85B7EB',fontWeight:'600'}}>{selected[COL.passportNumber] || '—'}</div>
                        </div>
                        <div className="field">
                          <div className="field-label">Passport upload</div>
                          <div className="field-input" style={{color:'#85B7EB'}}>
                            {selected[COL.passportUpload] ? 'Received ✓' : 'Not uploaded'}
                          </div>
                        </div>
                      </div>
                      {selected[COL.visaInfo] && (
                        <div className="field" style={{marginTop:'8px'}}>
                          <div className="field-label">Visa / GOI info</div>
                          <div className="field-input" style={{color:'#85B7EB',fontSize:'0.85rem'}}>{selected[COL.visaInfo]}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* RAMAN'S ONLY TASK */}
                <div className="card-section-label">YOUR ONLY TASK — TAKE CAR PHOTOS</div>
                <div className="card">
                  <div className="photo-row">
                    <div
                      className={`photo-box ${carPhoto ? 'captured' : ''}`}
                      onClick={() => carPhotoRef.current?.click()}
                    >
                      {carPhoto ? (
                        <img src={carPhoto.preview} alt="car" style={styles.photoPreview}/>
                      ) : (
                        <>
                          <div className="photo-icon">📷</div>
                          <div className="photo-label">Car photo</div>
                          <div className="photo-sub">Tap to take</div>
                        </>
                      )}
                      <input ref={carPhotoRef} type="file" accept="image/*" capture="environment"
                        onChange={e => handlePhotoCapture('car', e)} style={{display:'none'}}/>
                    </div>
                    <div
                      className={`photo-box ${platePhoto ? 'captured' : ''}`}
                      onClick={() => platePhotoRef.current?.click()}
                    >
                      {platePhoto ? (
                        <img src={platePhoto.preview} alt="plate" style={styles.photoPreview}/>
                      ) : (
                        <>
                          <div className="photo-icon">🔢</div>
                          <div className="photo-label">Number plate</div>
                          <div className="photo-sub">Tap to take</div>
                        </>
                      )}
                      <input ref={platePhotoRef} type="file" accept="image/*" capture="environment"
                        onChange={e => handlePhotoCapture('plate', e)} style={{display:'none'}}/>
                    </div>
                  </div>
                  <div className="divider"/>
                  <div className="field" style={{marginBottom:0}}>
                    <div className="field-label">Car number (type if visible)</div>
                    <input className="field-input" placeholder="e.g. KL 07 AB 1234"
                      value={carNumber} onChange={e => setCarNumber(e.target.value)}
                      style={{textTransform:'uppercase'}}/>
                  </div>
                </div>

                {/* STAY ID PREVIEW */}
                <div style={styles.stayIdStrip}>
                  <div>
                    <div style={styles.stayIdLabel}>STAY ID · WILL BE AUTO-GENERATED</div>
                    <div style={styles.stayIdVal}>DWK-?????</div>
                    <div style={styles.stayIdNote}>Generated on confirm · links all transactions · saved to Drive</div>
                  </div>
                  <span style={{fontSize:'1.4rem'}}>🔒</span>
                </div>

                <button className="btn btn-gold" onClick={handleConfirm} disabled={saving}>
                  {saving ? 'Confirming check-in...' : 'Confirm check-in → Save to Drive'}
                </button>
                <p className="btn-email-note">📧 Confirmation email sent to owner + guest on confirm</p>
              </>
            )}
          </>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

const styles = {
  guestList: {
    background: 'var(--dark-input)',
    borderRadius: '8px',
    padding: '8px 10px',
    border: '1px solid rgba(52,168,83,0.2)',
  },
  guestRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  guestName: { color: '#C0DD97', fontSize: '0.85rem', fontWeight: '600' },
  guestAge:  { color: 'var(--text-dim)', fontSize: '0.78rem' },
  guestMore: {
    color: 'var(--text-dim)', fontSize: '0.78rem',
    textAlign: 'right', paddingTop: '6px', cursor: 'pointer',
  },
  photoPreview: {
    width: '100%', height: '80px',
    objectFit: 'cover', borderRadius: '6px',
  },
  stayIdStrip: {
    background: 'rgba(200,144,58,0.06)',
    border: '1px solid rgba(200,144,58,0.2)',
    borderRadius: '10px',
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  stayIdLabel: { fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '1px' },
  stayIdVal:   { color: 'var(--gold)', fontSize: '1.1rem', fontWeight: '800', fontFamily: 'monospace', letterSpacing: '2px', margin: '3px 0' },
  stayIdNote:  { fontSize: '0.68rem', color: 'var(--text-dim)' },
}
