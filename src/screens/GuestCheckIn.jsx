// ============================================================
// GuestCheckIn.jsx — Public guest check-in form
// Route: /checkin?villa=dwarka&partner=airbnb&stay=DWK-2026-XXXX
//
// No login required — public facing page
// Supports Indian and Foreign national flows (Form C compliance)
// On submit: creates/updates stay in D1 → Drive folder created via worker
// Status flow: pending_review → owner approves → ready_for_checkin
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

const VILLA_NAMES = {
  dwarka: 'Guruvayur Villa (Dwarka)',
}
const PARTNER_NAMES = {
  airbnb:   'Airbnb',
  direct:   'Direct Booking',
  makemytrip: 'MakeMyTrip',
  booking:  'Booking.com',
  goibibo:  'Goibibo',
}

const PURPOSE_OPTIONS = ['Pilgrimage / Temple visit', 'Tourism', 'Family visit', 'Wedding / Function', 'Business', 'Arangettam', 'Other']
const TRANSPORT_OPTIONS = ['Car / SUV', 'Train', 'Flight', 'Bus', 'Auto / Taxi']
const ID_TYPES_INDIAN   = ['Aadhaar Card', 'PAN Card', 'Driving License', 'Voter ID', 'Passport']
const VISA_TYPES        = ['Tourist', 'Business', 'e-Visa', 'OCI Card', 'PIO Card', 'Other']

function Field({ label, required, children, hint }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600',
        color: '#9AA5B4', letterSpacing: '0.5px', marginBottom: '6px', textTransform: 'uppercase' }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: '3px' }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: '0.68rem', color: '#6B7280', marginTop: '4px' }}>{hint}</div>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', ...props }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.05)', color: '#F0F0F0', fontSize: '0.9rem',
        outline: 'none', boxSizing: 'border-box' }}
      {...props} />
  )
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
        background: '#1A2332', color: value ? '#F0F0F0' : '#6B7280', fontSize: '0.9rem',
        outline: 'none', boxSizing: 'border-box', appearance: 'none' }}>
      <option value="">{placeholder || 'Select…'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function SectionLabel({ children, color = '#C8903A' }) {
  return (
    <div style={{ fontSize: '0.65rem', fontWeight: '700', letterSpacing: '2px',
      color, marginBottom: '10px', marginTop: '20px', paddingBottom: '6px',
      borderBottom: `1px solid ${color}22` }}>
      {children}
    </div>
  )
}

export default function GuestCheckIn() {
  const [params] = useSearchParams()
  const villaId  = params.get('villa')   || 'dwarka'
  const partner  = params.get('partner') || 'direct'
  const stayId   = params.get('stay')    || ''

  const villaName   = VILLA_NAMES[villaId]   || 'Guruvayur Villa'
  const partnerName = PARTNER_NAMES[partner] || partner

  // ── Form state ────────────────────────────────────────────
  const [nationality, setNationality] = useState('Indian')  // 'Indian' | 'Foreign'
  const [step, setStep]   = useState(1)  // 1=personal, 2=stay details, 3=id/docs, 4=review
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error, setError] = useState('')

  // Personal
  const [fullName,   setFullName]   = useState('')
  const [dob,        setDob]        = useState('')
  const [gender,     setGender]     = useState('')
  const [phone,      setPhone]      = useState('')
  const [email,      setEmail]      = useState('')

  // Address
  const [address,    setAddress]    = useState('')
  const [city,       setCity]       = useState('')
  const [state,      setState]      = useState('')
  const [pincode,    setPincode]    = useState('')
  const [country,    setCountry]    = useState('India')

  // Stay
  const [checkIn,    setCheckIn]    = useState(stayId ? '' : '')
  const [checkOut,   setCheckOut]   = useState('')
  const [adults,     setAdults]     = useState('1')
  const [children,   setChildren]   = useState('0')
  const [guestList,  setGuestList]  = useState('')
  const [purpose,    setPurpose]    = useState('')
  const [transport,  setTransport]  = useState('')
  const [vehicle,    setVehicle]    = useState('')
  const [eta,        setEta]        = useState('')

  // Indian ID
  const [idType,     setIdType]     = useState('')
  const [idNumber,   setIdNumber]   = useState('')
  const [idFile,     setIdFile]     = useState(null)
  const [idPreview,  setIdPreview]  = useState(null)
  const idRef = useRef()

  // Foreign (Form C)
  const [passportNo,       setPassportNo]       = useState('')
  const [passportIssueDate,setPassportIssueDate]= useState('')
  const [passportIssuePlace,setPassportIssuePlace]= useState('')
  const [passportExpiry,   setPassportExpiry]   = useState('')
  const [visaNo,           setVisaNo]           = useState('')
  const [visaType,         setVisaType]         = useState('')
  const [visaIssueDate,    setVisaIssueDate]    = useState('')
  const [visaIssuePlace,   setVisaIssuePlace]   = useState('')
  const [arrivalIndia,     setArrivalIndia]     = useState('')
  const [portOfArrival,    setPortOfArrival]    = useState('')
  const [nextDest,         setNextDest]         = useState('')
  const [homeCountryAddr,  setHomeCountryAddr]  = useState('')

  const isForeign = nationality === 'Foreign'

  function handleIdUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setIdFile(file)
    const reader = new FileReader()
    reader.onload = ev => setIdPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function validate() {
    if (!fullName.trim())  return 'Full name is required'
    if (!phone.trim())     return 'Phone number is required'
    if (!checkIn)          return 'Check-in date is required'
    if (!checkOut)         return 'Check-out date is required'
    if (new Date(checkOut) <= new Date(checkIn)) return 'Check-out must be after check-in'
    if (!purpose)          return 'Purpose of visit is required'
    if (!isForeign && !idType)   return 'Please select ID type'
    if (!isForeign && !idNumber) return 'Please enter your ID number'
    if (isForeign && !passportNo)    return 'Passport number is required'
    if (isForeign && !passportExpiry) return 'Passport expiry is required'
    if (isForeign && !visaNo)        return 'Visa number is required'
    if (isForeign && !visaType)      return 'Visa type is required'
    return null
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSubmitting(true)

    try {
      const nights = Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000))

      // Convert ID file to base64 if present
      let idFileB64 = null, idFileName = null
      if (idFile) {
        idFileB64  = idPreview?.split(',')[1] || null
        idFileName = idFile.name
      }

      const payload = {
        // Identity
        villaId, partner, stayId: stayId || null,
        guestName: fullName.trim(),
        dob, gender, nationality,
        phone, email,
        // Address
        homeAddress: address, city, state, pincode,
        country: isForeign ? country : 'India',
        fromCity: city,
        // Stay
        checkInDate: checkIn, checkOutDate: checkOut, nights,
        adults: parseInt(adults) || 1,
        children: parseInt(children) || 0,
        guestList: guestList || null,
        purposeOfVisit: purpose,
        modeOfTransport: transport || null,
        vehicleNumber: vehicle || null,
        eta: eta || null,
        // Indian ID
        govtIdType: !isForeign ? idType : null,
        govtIdNum:  !isForeign ? idNumber : null,
        // Foreign (Form C)
        passportNumber:     isForeign ? passportNo : null,
        passportIssueDate:  isForeign ? passportIssueDate : null,
        passportIssuePlace: isForeign ? passportIssuePlace : null,
        passportExpiry:     isForeign ? passportExpiry : null,
        visaNumber:         isForeign ? visaNo : null,
        visaType:           isForeign ? visaType : null,
        visaIssueDate:      isForeign ? visaIssueDate : null,
        visaIssuePlace:     isForeign ? visaIssuePlace : null,
        arrivalDateIndia:   isForeign ? arrivalIndia : null,
        portOfArrival:      isForeign ? portOfArrival : null,
        nextDestination:    isForeign ? nextDest : null,
        homeCountryAddress: isForeign ? homeCountryAddr : null,
        // ID doc
        idFileB64, idFileName,
      }

      const res = await fetch('/api/submitGuestCheckIn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Submission failed')
      setSubmitted(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── SUCCESS SCREEN ────────────────────────────────────────
  if (submitted) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#34A853', marginBottom: '8px' }}>
              Registration Complete
            </div>
            <div style={{ color: '#9AA5B4', fontSize: '0.88rem', lineHeight: '1.6' }}>
              Thank you, {fullName.split(' ')[0]}. Your check-in registration has been received.
              <br /><br />
              Our team will verify your details and confirm your check-in shortly.
              <br /><br />
              <strong style={{ color: '#C8903A' }}>{villaName}</strong>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const nights = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000))
    : 0

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.brandRow}>
          <div style={s.brandIcon}>🏡</div>
          <div>
            <div style={s.brandName}>{villaName}</div>
            <div style={s.brandSub}>GURUVAYUR · KERALA</div>
          </div>
        </div>
        {partner !== 'direct' && (
          <div style={s.partnerBadge}>via {partnerName}</div>
        )}
        <div style={s.welcomeText}>
          Welcome! Please complete your check-in registration below.
          This takes about 2 minutes and helps us serve you better.
        </div>
      </div>

      <div style={s.body}>
        {/* Nationality toggle — first thing */}
        <Field label="Are you an Indian or Foreign national?" required>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Indian', 'Foreign'].map(n => (
              <button key={n} onClick={() => setNationality(n)}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', cursor: 'pointer',
                  border: nationality === n ? '1px solid #C8903A' : '1px solid rgba(255,255,255,0.1)',
                  background: nationality === n ? 'rgba(200,144,58,0.15)' : 'rgba(255,255,255,0.03)',
                  color: nationality === n ? '#C8903A' : '#9AA5B4',
                  fontWeight: nationality === n ? '700' : '400', fontSize: '0.88rem' }}>
                {n === 'Indian' ? '🇮🇳 Indian' : '✈️ Foreign National'}
              </button>
            ))}
          </div>
        </Field>

        {/* ── SECTION 1: PERSONAL DETAILS ── */}
        <SectionLabel>1 · Personal Details</SectionLabel>

        <Field label="Full name (as on ID)" required>
          <Input value={fullName} onChange={setFullName} placeholder="e.g. Bharat L Rao" />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Date of birth" required={isForeign}>
            <Input type="date" value={dob} onChange={setDob} />
          </Field>
          <Field label="Gender" required={isForeign}>
            <Select value={gender} onChange={setGender}
              options={['Male', 'Female', 'Other']} placeholder="Select" />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Phone number" required>
            <Input type="tel" value={phone} onChange={setPhone} placeholder="9880335522" />
          </Field>
          <Field label="Email address">
            <Input type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          </Field>
        </div>

        {/* ── SECTION 2: HOME ADDRESS ── */}
        <SectionLabel>2 · {isForeign ? 'Address in India' : 'Home Address'}</SectionLabel>

        {isForeign && (
          <Field label="Permanent address in home country" required>
            <textarea value={homeCountryAddr} onChange={e => setHomeCountryAddr(e.target.value)}
              placeholder="Full address in your home country"
              style={{ width: '100%', padding: '11px 14px', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                color: '#F0F0F0', fontSize: '0.9rem', minHeight: '70px', resize: 'vertical',
                outline: 'none', boxSizing: 'border-box' }} />
          </Field>
        )}

        <Field label={isForeign ? 'Address in India / Hotel address' : 'Street address'}>
          <Input value={address} onChange={setAddress} placeholder="Flat / House, Street, Area" />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
          <Field label="City / Town" required>
            <Input value={city} onChange={setCity} placeholder="Bengaluru" />
          </Field>
          <Field label="Pincode">
            <Input type="tel" value={pincode} onChange={setPincode} placeholder="560001" maxLength={6} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="State" required={!isForeign}>
            <Input value={state} onChange={setState} placeholder="Karnataka" />
          </Field>
          <Field label="Country">
            <Input value={isForeign ? country : 'India'} onChange={setCountry}
              placeholder="India" readOnly={!isForeign}
              style={{ opacity: isForeign ? 1 : 0.5 }} />
          </Field>
        </div>

        {/* ── SECTION 3: STAY DETAILS ── */}
        <SectionLabel>3 · Stay Details</SectionLabel>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Check-in date" required>
            <Input type="date" value={checkIn} onChange={setCheckIn} />
          </Field>
          <Field label="Check-out date" required>
            <Input type="date" value={checkOut} onChange={setCheckOut} />
          </Field>
        </div>

        {nights > 0 && (
          <div style={{ textAlign: 'center', color: '#C8903A', fontSize: '0.82rem',
            fontWeight: '600', marginBottom: '12px', marginTop: '-4px' }}>
            {nights} night{nights > 1 ? 's' : ''}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Adults" required>
            <Select value={adults} onChange={setAdults}
              options={['1','2','3','4','5','6','7','8']} />
          </Field>
          <Field label="Children (under 12)">
            <Select value={children} onChange={setChildren}
              options={['0','1','2','3','4','5']} />
          </Field>
        </div>

        <Field label="Names of other guests" hint="Optional — helps us prepare">
          <textarea value={guestList} onChange={e => setGuestList(e.target.value)}
            placeholder="e.g. Priya Rao, Arjun Rao (age 8)"
            style={{ width: '100%', padding: '11px 14px', borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
              color: '#F0F0F0', fontSize: '0.9rem', minHeight: '60px', resize: 'vertical',
              outline: 'none', boxSizing: 'border-box' }} />
        </Field>

        <Field label="Purpose of visit" required>
          <Select value={purpose} onChange={setPurpose} options={PURPOSE_OPTIONS} />
        </Field>

        <Field label="Mode of transport" required>
          <Select value={transport} onChange={setTransport} options={TRANSPORT_OPTIONS} />
        </Field>

        {transport === 'Car / SUV' && (
          <Field label="Vehicle number" required hint="We note this for villa security">
            <Input value={vehicle} onChange={setVehicle}
              placeholder="e.g. KA 01 AB 1234"
              style={{ textTransform: 'uppercase' }}
              onChange={v => setVehicle(v.toUpperCase())} />
          </Field>
        )}

        <Field label="Estimated time of arrival (ETA)">
          <Input type="time" value={eta} onChange={setEta} />
        </Field>

        {/* ── SECTION 4A: INDIAN GUEST ID ── */}
        {!isForeign && (
          <>
            <SectionLabel>4 · Identity Document</SectionLabel>
            <Field label="ID type" required>
              <Select value={idType} onChange={setIdType} options={ID_TYPES_INDIAN} />
            </Field>
            <Field label="ID number" required>
              <Input value={idNumber} onChange={setIdNumber}
                placeholder={idType === 'Aadhaar Card' ? 'XXXX XXXX XXXX' :
                              idType === 'PAN Card' ? 'ABCDE1234F' : 'Enter ID number'} />
            </Field>
            <Field label="Upload ID document" hint="Photo or scan of your ID (optional but recommended)">
              <div onClick={() => idRef.current?.click()}
                style={{ padding: '16px', borderRadius: '10px', border: '1px dashed rgba(200,144,58,0.4)',
                  background: 'rgba(200,144,58,0.04)', cursor: 'pointer', textAlign: 'center' }}>
                {idPreview
                  ? <img src={idPreview} alt="ID" style={{ maxWidth: '100%', maxHeight: '140px', borderRadius: '6px' }} />
                  : <>
                      <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>📷</div>
                      <div style={{ color: '#C8903A', fontSize: '0.82rem', fontWeight: '600' }}>Tap to upload ID</div>
                      <div style={{ color: '#6B7280', fontSize: '0.72rem', marginTop: '2px' }}>Photo, scan, or PDF</div>
                    </>
                }
                <input ref={idRef} type="file" accept="image/*,application/pdf" capture="environment"
                  onChange={handleIdUpload} style={{ display: 'none' }} />
              </div>
            </Field>
          </>
        )}

        {/* ── SECTION 4B: FOREIGN NATIONAL — FORM C ── */}
        {isForeign && (
          <>
            <SectionLabel color="#85B7EB">4 · Passport Details (Form C)</SectionLabel>
            <Field label="Passport number" required>
              <Input value={passportNo} onChange={setPassportNo} placeholder="A1234567" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Issue date" required>
                <Input type="date" value={passportIssueDate} onChange={setPassportIssueDate} />
              </Field>
              <Field label="Expiry date" required>
                <Input type="date" value={passportExpiry} onChange={setPassportExpiry} />
              </Field>
            </div>
            <Field label="Place of issue" required>
              <Input value={passportIssuePlace} onChange={setPassportIssuePlace} placeholder="New Delhi / Mumbai" />
            </Field>

            <SectionLabel color="#85B7EB">5 · Visa Details (Form C)</SectionLabel>
            <Field label="Visa number" required>
              <Input value={visaNo} onChange={setVisaNo} placeholder="IN-XXXXXXXX" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Visa type" required>
                <Select value={visaType} onChange={setVisaType} options={VISA_TYPES} />
              </Field>
              <Field label="Issue date" required>
                <Input type="date" value={visaIssueDate} onChange={setVisaIssueDate} />
              </Field>
            </div>
            <Field label="Place of visa issue">
              <Input value={visaIssuePlace} onChange={setVisaIssuePlace} placeholder="Embassy / Consulate city" />
            </Field>

            <SectionLabel color="#85B7EB">6 · Arrival in India (Form C)</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Date of arrival in India" required>
                <Input type="date" value={arrivalIndia} onChange={setArrivalIndia} />
              </Field>
              <Field label="Port of arrival" required>
                <Input value={portOfArrival} onChange={setPortOfArrival} placeholder="Chennai / Kochi airport" />
              </Field>
            </div>
            <Field label="Next destination after this stay">
              <Input value={nextDest} onChange={setNextDest} placeholder="Kovalam / Mumbai / Home country" />
            </Field>

            <SectionLabel color="#85B7EB">7 · Upload Passport Copy</SectionLabel>
            <Field label="Passport photo page" hint="Required for foreign nationals">
              <div onClick={() => idRef.current?.click()}
                style={{ padding: '16px', borderRadius: '10px', border: '1px dashed rgba(133,183,235,0.4)',
                  background: 'rgba(133,183,235,0.04)', cursor: 'pointer', textAlign: 'center' }}>
                {idPreview
                  ? <img src={idPreview} alt="Passport" style={{ maxWidth: '100%', maxHeight: '140px', borderRadius: '6px' }} />
                  : <>
                      <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>📷</div>
                      <div style={{ color: '#85B7EB', fontSize: '0.82rem', fontWeight: '600' }}>Tap to upload passport</div>
                      <div style={{ color: '#6B7280', fontSize: '0.72rem', marginTop: '2px' }}>Photo page + visa page</div>
                    </>
                }
                <input ref={idRef} type="file" accept="image/*,application/pdf" capture="environment"
                  onChange={handleIdUpload} style={{ display: 'none' }} />
              </div>
            </Field>
          </>
        )}

        {/* ── ERROR ── */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px', padding: '12px 16px', color: '#EF4444',
            fontSize: '0.85rem', marginBottom: '12px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── SUBMIT ── */}
        <button onClick={handleSubmit} disabled={submitting}
          style={{ width: '100%', padding: '15px', borderRadius: '12px',
            background: submitting ? 'rgba(200,144,58,0.4)' : 'rgba(200,144,58,0.9)',
            color: '#111', fontWeight: '800', fontSize: '1rem', border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer', marginBottom: '8px',
            letterSpacing: '0.5px' }}>
          {submitting ? 'Submitting…' : '✅ Submit Registration'}
        </button>

        <p style={{ color: '#6B7280', fontSize: '0.72rem', textAlign: 'center', lineHeight: '1.5' }}>
          Your information is collected for hotel registration compliance only
          and is not shared with third parties.
        </p>
      </div>
    </div>
  )
}

const s = {
  page:   { minHeight: '100vh', background: '#0D1117', color: '#F0F0F0', fontFamily: 'system-ui, sans-serif' },
  header: { background: 'linear-gradient(135deg, #111827 0%, #1A2332 100%)',
            padding: '24px 20px 20px', borderBottom: '1px solid rgba(200,144,58,0.2)' },
  brandRow:   { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' },
  brandIcon:  { fontSize: '2rem', background: 'rgba(200,144,58,0.15)', borderRadius: '12px',
                padding: '8px 10px', border: '1px solid rgba(200,144,58,0.3)' },
  brandName:  { fontFamily: "'Georgia', serif", fontSize: '1.1rem', fontWeight: '700',
                color: '#E8B86D', letterSpacing: '0.5px' },
  brandSub:   { fontSize: '0.6rem', color: '#5C7080', letterSpacing: '3px', marginTop: '2px' },
  partnerBadge: { display: 'inline-block', background: 'rgba(133,183,235,0.12)',
                  border: '1px solid rgba(133,183,235,0.25)', borderRadius: '20px',
                  padding: '3px 12px', color: '#85B7EB', fontSize: '0.72rem',
                  fontWeight: '600', marginBottom: '10px' },
  welcomeText: { fontSize: '0.82rem', color: '#9AA5B4', lineHeight: '1.6' },
  body: { padding: '20px 16px 40px', maxWidth: '520px', margin: '0 auto' },
  card: { margin: '20px 16px', background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' },
}
