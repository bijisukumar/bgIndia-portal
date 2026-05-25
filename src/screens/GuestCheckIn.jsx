// ============================================================
// GuestCheckIn.jsx — Public guest check-in form
// Route: /checkin?villa=dwarka&partner=airbnb&stay=DWK-2026-XXXX
// No login required — public facing page
// Supports Indian and Foreign national flows (Form C compliance)
// ============================================================

import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

const VILLA_NAMES = { dwarka: 'Guruvayur Villa (Dwarka)' }
const VILLA_ADDRESSES = {
  dwarka: {
    address:  'Edappully Gandhinagar Rd, Palayoor',
    city:     'Guruvayur',
    state:    'Kerala',
    pincode:  '680101',
    country:  'India',
    phone:    '+91 99950 43283',
  }
}
const PARTNER_NAMES = {
  airbnb: 'Airbnb', direct: 'Direct Booking',
  makemytrip: 'MakeMyTrip', booking: 'Booking.com', goibibo: 'Goibibo',
}
const PURPOSE_OPTIONS  = ['Pilgrimage / Temple visit','Tourism','Family visit','Wedding / Function','Business','Arangettam','Other']
const TRANSPORT_OPTIONS= ['Car / SUV','Train','Flight','Bus','Auto / Taxi']
const ID_TYPES_INDIAN  = ['Aadhaar Card','PAN Card','Driving License','Voter ID','Passport']
const VISA_TYPES       = ['Tourist','Business','e-Visa','OCI Card','PIO Card','Other']
const INDIAN_STATES    = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh','Puducherry','Other']

function Field({ label, required, children, hint }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display:'block', fontSize:'0.72rem', fontWeight:'600',
        color:'#9AA5B4', letterSpacing:'0.5px', marginBottom:'6px', textTransform:'uppercase' }}>
        {label}{required && <span style={{ color:'#EF4444', marginLeft:'3px' }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize:'0.68rem', color:'#6B7280', marginTop:'4px' }}>{hint}</div>}
    </div>
  )
}

const inputStyle = {
  width:'100%', padding:'11px 14px', borderRadius:'10px',
  border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)',
  color:'#F0F0F0', fontSize:'0.9rem', outline:'none', boxSizing:'border-box',
}
const inputStyleReadonly = { ...inputStyle, opacity: 0.55, cursor: 'not-allowed' }

function Input({ value, onChange, placeholder, type='text', readOnly=false, style={}, ...props }) {
  return <input type={type} value={value}
    onChange={readOnly ? undefined : e => onChange(e.target.value)}
    readOnly={readOnly} placeholder={placeholder}
    style={{ ...inputStyle, ...(readOnly ? { opacity:0.55, cursor:'not-allowed' } : {}), ...style }}
    {...props} />
}

function Select({ value, onChange, options, placeholder, disabled=false }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{ ...inputStyle, background:'#1A2332',
        color: value ? '#F0F0F0' : '#6B7280', appearance:'none',
        opacity: disabled ? 0.55 : 1 }}>
      <option value="">{placeholder || 'Select…'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Textarea({ value, onChange, placeholder, rows=3, readOnly=false }) {
  return <textarea value={value}
    onChange={readOnly ? undefined : e => onChange(e.target.value)}
    readOnly={readOnly} placeholder={placeholder} rows={rows}
    style={{ ...inputStyle, resize:'vertical', minHeight: `${rows*24}px`,
      opacity: readOnly ? 0.55 : 1, cursor: readOnly ? 'not-allowed' : 'auto' }} />
}

function SectionLabel({ children, color='#C8903A', icon }) {
  return (
    <div style={{ fontSize:'0.65rem', fontWeight:'700', letterSpacing:'2px', color,
      marginBottom:'10px', marginTop:'24px', paddingBottom:'6px',
      borderBottom:`1px solid ${color}33`, display:'flex', alignItems:'center', gap:'6px' }}>
      {icon && <span>{icon}</span>}{children}
    </div>
  )
}

function UploadBox({ label, preview, onClick, color='#C8903A', icon='📷', hint }) {
  return (
    <div onClick={onClick} style={{ padding:'16px', borderRadius:'10px',
      border:`1px dashed ${color}66`, background:`${color}08`,
      cursor:'pointer', textAlign:'center' }}>
      {preview
        ? <img src={preview} alt={label}
            style={{ maxWidth:'100%', maxHeight:'150px', borderRadius:'6px', objectFit:'contain' }} />
        : <>
            <div style={{ fontSize:'1.8rem', marginBottom:'6px' }}>{icon}</div>
            <div style={{ color, fontSize:'0.82rem', fontWeight:'600' }}>{label}</div>
            {hint && <div style={{ color:'#6B7280', fontSize:'0.7rem', marginTop:'3px' }}>{hint}</div>}
          </>
      }
    </div>
  )
}

export default function GuestCheckIn() {
  const [params]  = useSearchParams()
  const villaId   = params.get('villa')   || 'dwarka'
  const partner   = params.get('partner') || 'direct'
  const stayId    = params.get('stay')    || ''
  const villaName = VILLA_NAMES[villaId]  || 'Guruvayur Villa'
  const villaAddr = VILLA_ADDRESSES[villaId] || {}
  const partnerName = PARTNER_NAMES[partner] || partner

  // Nationality
  const [nationality, setNationality] = useState('Indian')
  const isForeign = nationality === 'Foreign'

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState('')

  // ── Personal ─────────────────────────────────────────────
  const [fullName, setFullName] = useState('')
  const [dob,      setDob]      = useState('')
  const [gender,   setGender]   = useState('')
  const [phone,    setPhone]    = useState('')
  const [email,    setEmail]    = useState('')

  // ── Address ───────────────────────────────────────────────
  const [address,          setAddress]         = useState('')
  const [city,             setCity]            = useState('')
  const [state,            setState]           = useState('')
  const [pincode,          setPincode]         = useState('')
  const [country,          setCountry]         = useState('India')
  const [homeCountryAddr,  setHomeCountryAddr] = useState('')

  // ── Stay ──────────────────────────────────────────────────
  const [checkIn,   setCheckIn]   = useState('')
  const [checkOut,  setCheckOut]  = useState('')
  const [adults,    setAdults]    = useState('1')
  const [children,  setChildren]  = useState('0')
  const [guestList, setGuestList] = useState('')
  const [purpose,   setPurpose]   = useState('')
  const [transport, setTransport] = useState('')
  const [vehicle,   setVehicle]   = useState('')
  const [eta,       setEta]       = useState('')

  // ── Indian ID ─────────────────────────────────────────────
  const [idType,    setIdType]   = useState('')
  const [idNumber,  setIdNumber] = useState('')
  const [idPreview, setIdPreview]= useState(null)
  const [idFile,    setIdFile]   = useState(null)
  const idRef = useRef()

  // ── Foreign / Form C ──────────────────────────────────────
  const [passportNo,         setPassportNo]        = useState('')
  const [passportIssueDate,  setPassportIssueDate] = useState('')
  const [passportIssuePlace, setPassportIssuePlace]= useState('')
  const [passportExpiry,     setPassportExpiry]    = useState('')
  const [passportPreview,    setPassportPreview]   = useState(null)
  const [visaNo,             setVisaNo]            = useState('')
  const [visaType,           setVisaType]          = useState('')
  const [visaIssueDate,      setVisaIssueDate]     = useState('')
  const [visaIssuePlace,     setVisaIssuePlace]    = useState('')
  const [visaPreview,        setVisaPreview]       = useState(null)
  const [docsLater,          setDocsLater]         = useState(false)
  const [arrivalIndia,       setArrivalIndia]      = useState('')
  const [portOfArrival,      setPortOfArrival]     = useState('')
  const [nextDest,           setNextDest]          = useState('')
  const passportRef = useRef()
  const visaRef     = useRef()

  function handleFileUpload(e, setPreview, setFile) {
    const file = e.target.files?.[0]
    if (!file) return
    setFile && setFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function validate() {
    if (!fullName.trim())  return 'Full name is required'
    if (!phone.trim())     return 'Phone number is required'
    if (!checkIn)          return 'Check-in date is required'
    if (!checkOut)         return 'Check-out date is required'
    if (new Date(checkOut) <= new Date(checkIn)) return 'Check-out must be after check-in'
    if (!purpose)          return 'Purpose of visit is required'
    if (!transport)        return 'Mode of transport is required'
    if (!isForeign && !idType)   return 'Please select your ID type'
    if (!isForeign && !idNumber) return 'Please enter your ID number'
    if (isForeign && !passportNo)     return 'Passport number is required'
    if (isForeign && !passportExpiry) return 'Passport expiry date is required'
    if (isForeign && !visaNo && !docsLater)   return 'Visa number is required (or check "I will submit later")'
    if (isForeign && !visaType && !docsLater) return 'Visa type is required'
    return null
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); window.scrollTo(0,0); return }
    setError('')
    setSubmitting(true)
    try {
      const nights = Math.max(1, Math.round((new Date(checkOut)-new Date(checkIn))/86400000))
      const idFileB64    = idPreview?.split(',')[1]      || null
      const passportB64  = passportPreview?.split(',')[1]|| null
      const visaB64      = visaPreview?.split(',')[1]    || null

      const payload = {
        villaId, partner, stayId: stayId||null,
        guestName: fullName.trim(), dob, gender, nationality,
        phone, email,
        homeAddress: isForeign ? `${villaAddr.address}, ${villaAddr.city}` : address,
        city: isForeign ? villaAddr.city : city,
        state: isForeign ? villaAddr.state : state,
        pincode: isForeign ? villaAddr.pincode : pincode,
        country: isForeign ? villaAddr.country : 'India',
        fromCity: isForeign ? '' : city,
        homeCountryAddress: isForeign ? homeCountryAddr : null,
        checkInDate: checkIn, checkOutDate: checkOut, nights,
        adults: parseInt(adults)||1, children: parseInt(children)||0,
        guestList: guestList||null, purposeOfVisit: purpose,
        modeOfTransport: transport||null, vehicleNumber: vehicle||null, eta: eta||null,
        govtIdType: !isForeign ? idType : null,
        govtIdNum:  !isForeign ? idNumber : null,
        passportNumber: isForeign ? passportNo : null,
        passportIssueDate: isForeign ? passportIssueDate : null,
        passportIssuePlace: isForeign ? passportIssuePlace : null,
        passportExpiry: isForeign ? passportExpiry : null,
        visaNumber:    isForeign && !docsLater ? visaNo : null,
        visaType:      isForeign && !docsLater ? visaType : null,
        visaIssueDate: isForeign && !docsLater ? visaIssueDate : null,
        visaIssuePlace:isForeign && !docsLater ? visaIssuePlace : null,
        arrivalDateIndia: isForeign ? arrivalIndia : null,
        portOfArrival:    isForeign ? portOfArrival : null,
        nextDestination:  isForeign ? nextDest : null,
        docsSubmitLater: docsLater || false,
        idFileB64, idFileName: idFile?.name||null,
        passportFileB64: passportB64,
        visaFileB64: visaB64,
      }

      const res  = await fetch('/api/submitGuestCheckIn', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error||'Submission failed')
      setSubmitted(true)
    } catch(e) {
      setError(e.message)
      window.scrollTo(0,0)
    } finally { setSubmitting(false) }
  }

  // ── SUCCESS ───────────────────────────────────────────────
  if (submitted) return (
    <div style={s.page}>
      <div style={{ padding:'48px 24px', textAlign:'center', maxWidth:'400px', margin:'0 auto' }}>
        <div style={{ fontSize:'3.5rem', marginBottom:'16px' }}>🙏</div>
        <div style={{ fontSize:'1.3rem', fontWeight:'700', color:'#34A853', marginBottom:'12px' }}>
          Registration Complete
        </div>
        <div style={{ color:'#9AA5B4', fontSize:'0.88rem', lineHeight:'1.7' }}>
          Thank you, <strong style={{ color:'#F0F0F0' }}>{fullName.split(' ')[0]}</strong>.
          <br />Your check-in registration has been received.
          <br /><br />
          Our team will verify your details and prepare your room.
          {docsLater && <><br /><br /><span style={{ color:'#F59E0B' }}>⚠️ Please bring your passport and visa documents at check-in.</span></>}
          <br /><br />
          <strong style={{ color:'#C8903A' }}>{villaName}</strong><br />
          <span style={{ fontSize:'0.78rem' }}>{villaAddr.phone}</span>
        </div>
      </div>
    </div>
  )

  const nights = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(checkOut)-new Date(checkIn))/86400000)) : 0

  return (
    <div style={s.page}>
      {/* ── HEADER ── */}
      <div style={s.header}>
        <div style={s.brandRow}>
          <div style={s.brandIcon}>🏡</div>
          <div>
            <div style={s.brandName}>{villaName}</div>
            <div style={s.brandSub}>GURUVAYUR · KERALA</div>
          </div>
        </div>
        {partner !== 'direct' && (
          <div style={s.partnerBadge}>Booked via {partnerName}</div>
        )}
        <div style={s.welcomeText}>
          {partner === 'direct'
            ? <>Welcome to <strong style={{ color:'#E8B86D' }}>{villaName}</strong>.</>
            : <>Welcome to <strong style={{ color:'#E8B86D' }}>{villaName}</strong> — booked through <strong style={{ color:'#85B7EB' }}>{partnerName}</strong>.</>
          }
          <br /><br />
          As required under the <strong style={{ color:'#D0D0D0' }}>Registration of Foreigners Act</strong> and
          the <strong style={{ color:'#D0D0D0' }}>Kerala Police Hotel Guest Rules</strong>, all guests must
          complete this registration before check-in. This is a mandatory government requirement —
          please complete it at the earliest.
        </div>
      </div>

      <div style={s.body}>

        {/* Error banner */}
        {error && (
          <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
            borderRadius:'10px', padding:'12px 16px', color:'#EF4444',
            fontSize:'0.85rem', marginBottom:'16px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── NATIONALITY TOGGLE ── */}
        <Field label="Nationality" required>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => setNationality('Indian')}
              style={{ flex:1, padding:'11px 8px', borderRadius:'10px', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                border: nationality==='Indian' ? '1px solid #C8903A' : '1px solid rgba(255,255,255,0.1)',
                background: nationality==='Indian' ? 'rgba(200,144,58,0.15)' : 'rgba(255,255,255,0.03)',
                color: nationality==='Indian' ? '#C8903A' : '#9AA5B4',
                fontWeight: nationality==='Indian' ? '700' : '400', fontSize:'0.83rem' }}>
              <img src="https://flagcdn.com/w20/in.png" alt="India" style={{ width:'20px', height:'14px', borderRadius:'2px', objectFit:'cover' }} />
              Indian
            </button>
            <button onClick={() => setNationality('Foreign')}
              style={{ flex:1, padding:'11px 8px', borderRadius:'10px', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                border: nationality==='Foreign' ? '1px solid #C8903A' : '1px solid rgba(255,255,255,0.1)',
                background: nationality==='Foreign' ? 'rgba(200,144,58,0.15)' : 'rgba(255,255,255,0.03)',
                color: nationality==='Foreign' ? '#C8903A' : '#9AA5B4',
                fontWeight: nationality==='Foreign' ? '700' : '400', fontSize:'0.83rem' }}>
              🌍 Foreign National
            </button>
          </div>
        </Field>

        {/* ── SECTION 1: PERSONAL ── */}
        <SectionLabel icon="👤">1 · PERSONAL DETAILS</SectionLabel>

        <Field label="Full name (as on ID)" required>
          <Input value={fullName} onChange={setFullName} placeholder="e.g. Bharat L Rao" />
        </Field>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <Field label="Date of birth">
            <Input type="date" value={dob} onChange={setDob} />
          </Field>
          <Field label="Gender">
            <Select value={gender} onChange={setGender} options={['Male','Female','Other']} placeholder="Select" />
          </Field>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <Field label="Phone number" required>
            <Input type="tel" value={phone} onChange={setPhone} placeholder="9880335522" />
          </Field>
          <Field label="Email address">
            <Input type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          </Field>
        </div>

        {/* ── SECTION 2: ADDRESS ── */}
        <SectionLabel icon="🏠">2 · {isForeign ? 'HOME COUNTRY ADDRESS' : 'HOME ADDRESS'}</SectionLabel>

        {isForeign ? (
          <>
            <Field label="Permanent address in home country" required>
              <Textarea value={homeCountryAddr} onChange={setHomeCountryAddr}
                placeholder="Full address including city, country" rows={3} />
            </Field>
            {/* Pre-filled villa address for foreign guests */}
            <div style={{ background:'rgba(200,144,58,0.06)', border:'1px solid rgba(200,144,58,0.2)',
              borderRadius:'10px', padding:'12px 14px', marginBottom:'14px' }}>
              <div style={{ fontSize:'0.68rem', fontWeight:'700', color:'#C8903A',
                letterSpacing:'1px', marginBottom:'6px' }}>ADDRESS IN INDIA (VILLA)</div>
              <div style={{ fontSize:'0.82rem', color:'#D0D0D0', lineHeight:'1.6' }}>
                {villaName}<br />
                {villaAddr.address}<br />
                {villaAddr.city}, {villaAddr.state} {villaAddr.pincode}<br />
                {villaAddr.country}<br />
                <span style={{ color:'#9AA5B4' }}>{villaAddr.phone}</span>
              </div>
              <div style={{ fontSize:'0.68rem', color:'#6B7280', marginTop:'6px' }}>
                Auto-filled as your India address for Form C
              </div>
            </div>
          </>
        ) : (
          <>
            <Field label="Street address">
              <Input value={address} onChange={setAddress} placeholder="Flat / House, Street, Area" />
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'12px' }}>
              <Field label="City / Town" required>
                <Input value={city} onChange={setCity} placeholder="Bengaluru" />
              </Field>
              <Field label="Pincode">
                <Input type="tel" value={pincode} onChange={setPincode} placeholder="560001" maxLength={6} />
              </Field>
            </div>
            <Field label="State" required>
              <Select value={state} onChange={setState} options={INDIAN_STATES} placeholder="Select state" />
            </Field>
          </>
        )}

        {/* ── SECTION 3: STAY DETAILS ── */}
        <SectionLabel icon="📅">3 · STAY DETAILS</SectionLabel>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <Field label="Check-in date" required>
            <Input type="date" value={checkIn} onChange={setCheckIn} />
          </Field>
          <Field label="Check-out date" required>
            <Input type="date" value={checkOut} onChange={setCheckOut} />
          </Field>
        </div>

        {nights > 0 && (
          <div style={{ textAlign:'center', color:'#C8903A', fontSize:'0.82rem',
            fontWeight:'600', marginBottom:'14px', marginTop:'-6px' }}>
            {nights} night{nights!==1?'s':''}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <Field label="Adults" required>
            <Select value={adults} onChange={setAdults} options={['1','2','3','4','5','6','7','8']} />
          </Field>
          <Field label="Children (under 12)">
            <Select value={children} onChange={setChildren} options={['0','1','2','3','4','5']} />
          </Field>
        </div>

        <Field label="Names of other guests in your group" hint="Helps us prepare and keep records">
          <Textarea value={guestList} onChange={setGuestList}
            placeholder="e.g. Priya Rao, Arjun Rao (age 8), Meena Rao" rows={2} />
        </Field>

        <Field label="Purpose of visit" required>
          <Select value={purpose} onChange={setPurpose} options={PURPOSE_OPTIONS} />
        </Field>

        <Field label="Mode of transport" required>
          <Select value={transport} onChange={setTransport} options={TRANSPORT_OPTIONS} />
        </Field>

        {transport === 'Car / SUV' && (
          <Field label="Vehicle registration number" hint="Noted for villa security">
            <Input value={vehicle} onChange={v => setVehicle(v.toUpperCase())}
              placeholder="KA 01 AB 1234"
              style={{ textTransform:'uppercase', letterSpacing:'1px' }} />
          </Field>
        )}

        <Field label="Estimated arrival time (ETA)" hint="So we can be ready for you">
          <Input type="time" value={eta} onChange={setEta} />
        </Field>

        {/* ── SECTION 4A: INDIAN ID ── */}
        {!isForeign && (<>
          <SectionLabel icon="🪪">4 · IDENTITY DOCUMENT</SectionLabel>

          <Field label="ID type" required>
            <Select value={idType} onChange={setIdType} options={ID_TYPES_INDIAN} />
          </Field>
          <Field label="ID number" required>
            <Input value={idNumber} onChange={setIdNumber}
              placeholder={
                idType==='Aadhaar Card' ? 'XXXX XXXX XXXX' :
                idType==='PAN Card' ? 'ABCDE1234F' :
                idType==='Driving License' ? 'KA-0119XXXXXXXX' : 'Enter ID number'
              } />
          </Field>
          <Field label="Upload ID document" hint="Photo or scan of front of your ID">
            <UploadBox label="Tap to upload ID" preview={idPreview}
              onClick={() => idRef.current?.click()}
              hint="Aadhaar / PAN / Licence — photo or PDF" />
            <input ref={idRef} type="file" accept="image/*,application/pdf" capture="environment"
              onChange={e => handleFileUpload(e, setIdPreview, setIdFile)}
              style={{ display:'none' }} />
            {idPreview && (
              <div style={{ fontSize:'0.7rem', color:'#34A853', marginTop:'4px' }}>✅ Document uploaded</div>
            )}
          </Field>
        </>)}

        {/* ── SECTION 4B: FOREIGN — FORM C ── */}
        {isForeign && (<>
          <SectionLabel icon="🛂" color="#85B7EB">4 · PASSPORT DETAILS (FORM C)</SectionLabel>

          <Field label="Passport number" required>
            <Input value={passportNo} onChange={setPassportNo} placeholder="A1234567" />
          </Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <Field label="Issue date">
              <Input type="date" value={passportIssueDate} onChange={setPassportIssueDate} />
            </Field>
            <Field label="Expiry date" required>
              <Input type="date" value={passportExpiry} onChange={setPassportExpiry} />
            </Field>
          </div>
          <Field label="Place of issue">
            <Input value={passportIssuePlace} onChange={setPassportIssuePlace} placeholder="New Delhi / Mumbai" />
          </Field>

          <Field label="Upload passport photo page" required={!docsLater}
            hint="Photo page showing your name, photo, and passport number">
            <UploadBox label="Upload passport photo page" preview={passportPreview}
              onClick={() => passportRef.current?.click()}
              color="#85B7EB" icon="🛂"
              hint="Clear photo of the biographical data page" />
            <input ref={passportRef} type="file" accept="image/*,application/pdf" capture="environment"
              onChange={e => handleFileUpload(e, setPassportPreview, null)}
              style={{ display:'none' }} />
            {passportPreview && (
              <div style={{ fontSize:'0.7rem', color:'#34A853', marginTop:'4px' }}>✅ Passport uploaded</div>
            )}
          </Field>

          <SectionLabel icon="📋" color="#85B7EB">5 · VISA DETAILS (FORM C)</SectionLabel>

          {/* Docs later toggle */}
          <div onClick={() => setDocsLater(!docsLater)}
            style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px',
              padding:'12px 14px', borderRadius:'10px', cursor:'pointer',
              border: docsLater ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)',
              background: docsLater ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)' }}>
            <div style={{ width:'20px', height:'20px', borderRadius:'6px', flexShrink:0,
              border: docsLater ? '1px solid #F59E0B' : '1px solid rgba(255,255,255,0.2)',
              background: docsLater ? '#F59E0B' : 'transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'0.75rem', color:'#111' }}>
              {docsLater ? '✓' : ''}
            </div>
            <div>
              <div style={{ fontSize:'0.85rem', color: docsLater ? '#F59E0B' : '#D0D0D0', fontWeight:'600' }}>
                I will submit visa documents at check-in
              </div>
              <div style={{ fontSize:'0.7rem', color:'#6B7280', marginTop:'2px' }}>
                You can skip visa details now — please bring originals when you arrive
              </div>
            </div>
          </div>

          {!docsLater && (<>
            <Field label="Visa number" required>
              <Input value={visaNo} onChange={setVisaNo} placeholder="IN-XXXXXXXX" />
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <Field label="Visa type" required>
                <Select value={visaType} onChange={setVisaType} options={VISA_TYPES} />
              </Field>
              <Field label="Issue date">
                <Input type="date" value={visaIssueDate} onChange={setVisaIssueDate} />
              </Field>
            </div>
            <Field label="Place of visa issue">
              <Input value={visaIssuePlace} onChange={setVisaIssuePlace} placeholder="Embassy / Consulate city" />
            </Field>
            <Field label="Upload visa page" hint="Page showing visa stamp or sticker">
              <UploadBox label="Upload visa page" preview={visaPreview}
                onClick={() => visaRef.current?.click()}
                color="#85B7EB" icon="📋"
                hint="Visa stamp, sticker, or e-Visa printout" />
              <input ref={visaRef} type="file" accept="image/*,application/pdf" capture="environment"
                onChange={e => handleFileUpload(e, setVisaPreview, null)}
                style={{ display:'none' }} />
              {visaPreview && (
                <div style={{ fontSize:'0.7rem', color:'#34A853', marginTop:'4px' }}>✅ Visa page uploaded</div>
              )}
            </Field>
          </>)}

          <SectionLabel icon="✈️" color="#85B7EB">6 · ARRIVAL IN INDIA (FORM C)</SectionLabel>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <Field label="Date of arrival in India">
              <Input type="date" value={arrivalIndia} onChange={setArrivalIndia} />
            </Field>
            <Field label="Port of arrival">
              <Input value={portOfArrival} onChange={setPortOfArrival} placeholder="Kochi / Chennai" />
            </Field>
          </div>
          <Field label="Next destination after this stay">
            <Input value={nextDest} onChange={setNextDest} placeholder="Kovalam / Mumbai / Home country" />
          </Field>
        </>)}

        {/* ── SUBMIT ── */}
        <div style={{ marginTop:'28px' }}>
          {error && (
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
              borderRadius:'10px', padding:'12px 16px', color:'#EF4444',
              fontSize:'0.85rem', marginBottom:'14px' }}>
              ⚠️ {error}
            </div>
          )}
          <button onClick={handleSubmit} disabled={submitting}
            style={{ width:'100%', padding:'16px', borderRadius:'12px',
              background: submitting ? 'rgba(200,144,58,0.4)' : '#C8903A',
              color:'#111', fontWeight:'800', fontSize:'1rem', border:'none',
              cursor: submitting ? 'not-allowed' : 'pointer', letterSpacing:'0.5px' }}>
            {submitting ? 'Submitting…' : '✅ Complete Registration'}
          </button>
          <p style={{ color:'#6B7280', fontSize:'0.7rem', textAlign:'center',
            lineHeight:'1.5', marginTop:'10px' }}>
            Your information is collected for hotel registration compliance only
            and is not shared with third parties.
          </p>
        </div>

      </div>
    </div>
  )
}

const s = {
  page:   { minHeight:'100vh', background:'#0D1117', color:'#F0F0F0', fontFamily:'system-ui,sans-serif' },
  header: { background:'linear-gradient(135deg, #111827 0%, #1A2332 100%)',
            padding:'24px 20px 20px', borderBottom:'1px solid rgba(200,144,58,0.2)' },
  brandRow:    { display:'flex', alignItems:'center', gap:'14px', marginBottom:'12px' },
  brandIcon:   { fontSize:'2rem', background:'rgba(200,144,58,0.15)', borderRadius:'12px',
                 padding:'8px 10px', border:'1px solid rgba(200,144,58,0.3)' },
  brandName:   { fontFamily:"'Georgia',serif", fontSize:'1.1rem', fontWeight:'700',
                 color:'#E8B86D', letterSpacing:'0.5px' },
  brandSub:    { fontSize:'0.6rem', color:'#5C7080', letterSpacing:'3px', marginTop:'2px' },
  partnerBadge:{ display:'inline-block', background:'rgba(133,183,235,0.12)',
                 border:'1px solid rgba(133,183,235,0.25)', borderRadius:'20px',
                 padding:'3px 12px', color:'#85B7EB', fontSize:'0.72rem',
                 fontWeight:'600', marginBottom:'10px' },
  welcomeText: { fontSize:'0.82rem', color:'#9AA5B4', lineHeight:'1.6' },
  body:        { padding:'20px 16px 48px', maxWidth:'520px', margin:'0 auto' },
}
