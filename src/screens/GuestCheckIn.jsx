// ============================================================
// GuestCheckIn.jsx — Public guest check-in form
// Route: /checkin?villa=dwarka&partner=airbnb&stay=DWK-2026-XXXX
// No login required — public facing page
// Supports Indian and Foreign national flows (Form C compliance)
// ============================================================

import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import { CONFIG } from '../config'
import { DEFAULT_VILLA_ID } from '../utils/villaContext'

const VILLA_NAMES = Object.fromEntries(CONFIG.villas.map(v => [v.id, v.full || v.name]))

function LogoImg({ villaId }) {
  const [failed, setFailed] = useState(false)
  if (failed) return (
    <div style={{ width:'56px', height:'56px', borderRadius:'12px', fontSize:'1.8rem',
      background:'rgba(200,144,58,0.15)', border:'1px solid rgba(200,144,58,0.3)',
      display:'flex', alignItems:'center', justifyContent:'center' }}>🏡</div>
  )
  const whiteLabelLogo = CONFIG.villas.find(v => v.id === villaId)?.logoUrl
  return (
    <img
      src={whiteLabelLogo || '/icons/StayVibe360Logo.png'}
      alt={CONFIG.brandName}
      onError={() => setFailed(true)}
      style={{ width:'56px', height:'56px', borderRadius:'12px', objectFit:'cover',
        border:'1px solid rgba(200,144,58,0.3)', boxShadow:'0 4px 12px rgba(200,144,58,0.15)' }}
    />
  )
}
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
// Full country list for the FOREIGN NATIONAL home-country-address section only.
// Indian guests never see this — their country is always 'India', set directly
// in the submit payload, no dropdown needed.
// India is still listed first/default in case a foreign-passport guest is an NRI
// whose permanent address happens to be in India; native <select> typeahead lets
// guests jump straight to their country by typing the first letter regardless.
const COUNTRIES = ['India','Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Swaziland','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe']

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

function ServiceToggle({ label, priceNote, hint, checked, onClick, color='#8B5CF6' }) {
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'flex-start', gap:'10px', marginBottom:'10px',
      padding:'12px 14px', borderRadius:'10px', cursor:'pointer',
      border: checked ? `1px solid ${color}66` : '1px solid rgba(255,255,255,0.08)',
      background: checked ? `${color}14` : 'rgba(255,255,255,0.02)' }}>
      <div style={{ width:'20px', height:'20px', borderRadius:'6px', flexShrink:0, marginTop:'1px',
        border: checked ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.2)',
        background: checked ? color : 'transparent',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:'0.75rem', color:'#fff' }}>
        {checked ? '✓' : ''}
      </div>
      <div>
        <div style={{ fontSize:'0.85rem', color: checked ? '#F0F0F0' : '#D0D0D0', fontWeight:'600' }}>
          {label}{priceNote && <span style={{ color:'#C8903A', fontWeight:'600', fontSize:'0.78rem' }}> {priceNote}</span>}
        </div>
        {hint && <div style={{ fontSize:'0.7rem', color:'#6B7280', marginTop:'2px' }}>{hint}</div>}
      </div>
    </div>
  )
}

// Guests upload phone-camera photos with zero client-side size control — a
// raw high-res photo can be several MB, and base64-encoded even larger.
// That silently exceeded the backend's storage limit for one guest whose ID
// photo never made it into the database at all: the insert failed, but the
// failure only ever hit a console.warn, invisible anywhere else, while the
// rest of the submission succeeded normally. Downscaling before the file
// ever leaves the browser fixes this at the source. PDFs pass through
// untouched — compression only applies to raster images.
function readAndCompressFile(file, maxDim = 1600, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => resolve(ev.target.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim }
          else { width = Math.round(width * maxDim / height); height = maxDim }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = ev.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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
  const [params]    = useSearchParams()
  const { linkToken } = useParams()
  const stayId      = params.get('stay') || ''

  // Resolved from token or fallback to query params
  const [villaId,     setVillaId]     = useState(params.get('villa')   || DEFAULT_VILLA_ID)
  const [partner,     setPartner]     = useState(params.get('partner') || 'direct')
  const [linkLoading, setLinkLoading] = useState(!!linkToken)
  const [linkError,   setLinkError]   = useState('')

  const villaName   = VILLA_NAMES[villaId]      || 'Guruvayur Villa'
  const villaAddr   = VILLA_ADDRESSES[villaId]  || {}
  const partnerName = PARTNER_NAMES[partner]    || partner

  // Resolve opaque token → villa + partner
  useEffect(() => {
    if (!linkToken) return
    fetch('/api/resolveCheckinLink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: linkToken }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setVillaId(data.data.villaId)
          setPartner(data.data.partner)
        } else {
          setLinkError(data.error || 'Invalid check-in link')
        }
      })
      .catch(() => setLinkError('Unable to verify check-in link'))
      .finally(() => setLinkLoading(false))
  }, [linkToken])

  // Nationality
  const [nationality, setNationality] = useState('Indian')
  const isForeign = nationality === 'Foreign'
  // "Enhance Your Stay" comes after section 4 (Indian ID) or section 6
  // (Foreign Form C's arrival section), so its own number shifts accordingly.
  const enhanceSectionNum = isForeign ? 8 : 5

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState('')

  // ── Personal ─────────────────────────────────────────────
  const [fullName, setFullName] = useState('')
  const [dob,      setDob]      = useState('')
  const [gender,   setGender]   = useState('')
  const [phone,    setPhone]    = useState('')
  // Indian by default: nearly every guest is, and the +91 prefix is what
  // stops the trunk 0 getting typed in the first place.
  const [intlPhone, setIntlPhone] = useState(false)
  const [email,    setEmail]    = useState('')

  // ── Address ───────────────────────────────────────────────
  const [address,          setAddress]         = useState('')
  const [address2,         setAddress2]        = useState('')
  // Separate from `country` below, which the foreign branch uses for the
  // guest's HOME country. This one is the country of the postal address, so
  // an Indian national living abroad can give a non-Indian address without
  // the two fields fighting each other.
  const [addrCountry,      setAddrCountry]     = useState('India')
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
  const [passportOcrBusy, setPassportOcrBusy] = useState(false)  // reading MRZ
  const [passportOcrHint, setPassportOcrHint] = useState('')     // status under the upload
  const visaRef     = useRef()

  // ── Additional foreign nationals (Form C is per person, not per booking) ──
  // Every foreign national staying at the property needs their own Form C with
  // their own passport and visa. Guest 1 is whoever is filling this form; each
  // block below is another person in the party.
  const BLANK_GUEST = {
    guestName:'', nationality:'', dob:'', gender:'',
    passportNumber:'', passportIssueDate:'', passportIssuePlace:'', passportExpiry:'',
    visaNumber:'', visaType:'', visaIssueDate:'', visaIssuePlace:'',
    arrivalDateIndia:'', portOfArrival:'', nextDestination:'',
    docsSubmitLater:false, passportPreview:null, visaPreview:null,
  }
  const [extraGuests, setExtraGuests] = useState([])

  // Switching nationality must leave NO trace of the other branch. Without
  // this, a guest who opened the Foreign flow, uploaded a passport, then
  // corrected themselves to Indian still submitted passport data and scans —
  // which is how a domestic booking ended up with a Form C row attached.
  // The two flows must never carry each other's data, in either direction.
  function switchNationality(next) {
    if (next === nationality) return
    setNationality(next)
    if (next === 'Indian') {
      setPassportNo(''); setPassportIssueDate(''); setPassportIssuePlace('')
      setPassportExpiry(''); setPassportPreview(null)
      setVisaNo(''); setVisaType(''); setVisaIssueDate(''); setVisaIssuePlace('')
      setVisaPreview(null); setDocsLater(false)
      setArrivalIndia(''); setPortOfArrival(''); setNextDest('')
      setHomeCountryAddr(''); setExtraGuests([])
      setPassportOcrHint(''); setPassportOcrBusy(false)
      if (passportRef.current) passportRef.current.value = ''
      if (visaRef.current)     visaRef.current.value = ''
    } else {
      setIdType(''); setIdNumber(''); setIdPreview(null); setIdFile(null)
      if (idRef.current) idRef.current.value = ''
    }
  }
  const guestFileRefs = useRef({})
  const partySize   = (parseInt(adults)||1) + (parseInt(children)||0)
  const formCFiled  = 1 + extraGuests.length      // guest 1 is this form
  const formCMissing = Math.max(0, partySize - formCFiled)

  const patchGuest  = (i, patch) =>
    setExtraGuests(gs => gs.map((g, idx) => idx === i ? { ...g, ...patch } : g))
  const addGuest    = () => setExtraGuests(gs => [...gs, { ...BLANK_GUEST }])
  const removeGuest = i => setExtraGuests(gs => gs.filter((_, idx) => idx !== i))

  // Same reader as the primary guest's uploads, but writes into the guest's
  // own slot. No OCR here — MRZ auto-fill stays on the primary passport only.
  async function handleGuestUpload(e, i, key) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      patchGuest(i, { [key]: await readAndCompressFile(file) })
    } catch (err) {
      // Never worse than before — fall back to the uncompressed original
      // rather than losing the upload if canvas/Image processing fails.
      const reader = new FileReader()
      reader.onload = ev => patchGuest(i, { [key]: ev.target.result })
      reader.readAsDataURL(file)
    }
  }

  // ── Enhance your stay (optional add-on requests) ───────────
  const [reqEarly,        setReqEarly]        = useState(false)
  const [reqLate,         setReqLate]         = useState(false)
  const [reqBreakfast,    setReqBreakfast]    = useState(false)
  const [breakfastChoice, setBreakfastChoice] = useState('')
  const [reqExtraBeds,    setReqExtraBeds]    = useState(false)
  const [extraBedsCount,  setExtraBedsCount]  = useState(1)
  const [reqCab,          setReqCab]          = useState(false)

  async function handleFileUpload(e, setPreview, setFile) {
    const file = e.target.files?.[0]
    if (!file) return
    setFile && setFile(file)
    try {
      setPreview(await readAndCompressFile(file))
    } catch (err) {
      const reader = new FileReader()
      reader.onload = ev => setPreview(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  // Passport upload → preview, then fire MRZ OCR to pre-fill passport fields.
  // Advisory only: the guest verifies everything. Never blocks the form, and
  // only pre-fills fields the guest hasn't already typed.
  async function handlePassportUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const isImage = file.type && file.type.startsWith('image/')
    try {
      const dataUrl = await readAndCompressFile(file)
      setPassportPreview(dataUrl)
      // Only OCR image uploads — a PDF passport scan skips straight to manual.
      if (isImage) runPassportOcr(dataUrl.split(',')[1])
    } catch (err) {
      const reader = new FileReader()
      reader.onload = ev => {
        setPassportPreview(ev.target.result)
        if (isImage) runPassportOcr(ev.target.result.split(',')[1])
      }
      reader.readAsDataURL(file)
    }
  }

  async function runPassportOcr(passportPhotoB64) {
    if (!passportPhotoB64) return
    setPassportOcrBusy(true); setPassportOcrHint('')
    try {
      // Public endpoint — called with a raw fetch (no auth), exactly like the
      // form's own submitGuestCheckIn call.
      const res  = await fetch('/api/ocrPassport', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ passportPhotoB64 }),
      })
      const data = await res.json().catch(() => ({}))
      const f = data?.data?.fields || {}
      if (!f.passportNumber) {
        setPassportOcrHint("Couldn't read your passport automatically — please fill the fields in below")
        return
      }
      let filled = 0
      if (f.passportNumber && !passportNo)    { setPassportNo(f.passportNumber);   filled++ }
      if (f.expiry        && !passportExpiry) { setPassportExpiry(f.expiry);        filled++ }
      if (f.dob           && !dob)            { setDob(f.dob);                      filled++ }
      if (f.fullName      && !fullName.trim()){ setFullName(f.fullName);            filled++ }
      setPassportOcrHint(filled
        ? '✨ Filled in from your passport — please check each field is correct'
        : 'Passport read — please confirm the details below are correct')
    } catch (e) {
      setPassportOcrHint("Couldn't read your passport automatically — please fill the fields in below")
    } finally {
      setPassportOcrBusy(false)
    }
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
    if (!isForeign && !idPreview) return 'Please upload a photo or scan of your ID document'
    if (!isForeign && !addrCountry) return 'Please select the country of your address'
    if (isForeign && !homeCountryAddr.trim()) return 'Permanent address in home country is required'
    if (isForeign && !country)   return 'Please select your country'
    if (isForeign && !passportNo)     return 'Passport number is required'
    if (isForeign && !passportExpiry) return 'Passport expiry date is required'
    if (isForeign && !docsLater && !passportPreview) return 'Please upload your passport photo page'
    if (isForeign && !visaNo && !docsLater)   return 'Visa number is required (or check "I will submit later")'
    if (isForeign && !visaType && !docsLater) return 'Visa type is required'
    if (isForeign) {
      for (let i = 0; i < extraGuests.length; i++) {
        const g = extraGuests[i], who = `Guest ${i + 2}`
        if (!g.guestName.trim())      return `${who}: full name is required`
        if (!g.nationality)           return `${who}: nationality is required`
        if (!g.passportNumber.trim()) return `${who}: passport number is required`
        if (!g.passportExpiry)        return `${who}: passport expiry date is required`
        if (!g.docsSubmitLater && !g.visaNumber.trim())
          return `${who}: visa number is required (or tick "submit at check-in")`
        if (!g.docsSubmitLater && !g.visaType)
          return `${who}: visa type is required`
      }
    }
    return null
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); window.scrollTo(0,0); return }
    setError('')
    setSubmitting(true)
    try {
      const nights = Math.max(1, Math.round((new Date(checkOut)-new Date(checkIn))/86400000))
      // Gated the same way the typed fields are. Previously these three were
      // sent unconditionally, so a domestic submission could still carry a
      // passport scan uploaded moments earlier under the Foreign flow.
      const idFileB64    = !isForeign ? (idPreview?.split(',')[1] || null) : null
      const passportB64  = isForeign  ? (passportPreview?.split(',')[1] || null) : null
      const visaB64      = isForeign && !docsLater
        ? (visaPreview?.split(',')[1] || null) : null

      const payload = {
        villaId, partner, stayId: stayId||null,
        guestName: fullName.trim(), dob, gender, nationality,
        phone: intlPhone ? phone : (phone ? `+91${phone}` : ''), email,
        // For foreign guests, home_address/city/state/pincode/country stay as the
        // VILLA'S India address — that's what Form C requires (current address in
        // India during the stay). The guest's actual home country is a separate
        // field below (homeCountry), so it doesn't get silently overwritten.
        homeAddress: isForeign ? `${villaAddr.address}, ${villaAddr.city}` : address,
        homeAddressLine2: isForeign ? null : (address2 || null),
        city: isForeign ? villaAddr.city : city,
        state: isForeign ? villaAddr.state : state,
        pincode: isForeign ? villaAddr.pincode : pincode,
        country: isForeign ? villaAddr.country : addrCountry,
        homeCountry: isForeign ? country : 'India',
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
        // One entry per additional foreign national. Previews carry the base64
        // scan; strip the data: prefix the same way the primary guest's do.
        formCGuests: isForeign ? extraGuests.map(g => ({
          guestName: g.guestName.trim(), nationality: g.nationality,
          dob: g.dob || null, gender: g.gender || null,
          passportNumber: g.passportNumber.trim(),
          passportIssueDate: g.passportIssueDate || null,
          passportIssuePlace: g.passportIssuePlace || null,
          passportExpiry: g.passportExpiry || null,
          visaNumber:    g.docsSubmitLater ? null : g.visaNumber.trim(),
          visaType:      g.docsSubmitLater ? null : g.visaType,
          visaIssueDate: g.docsSubmitLater ? null : (g.visaIssueDate || null),
          visaIssuePlace:g.docsSubmitLater ? null : (g.visaIssuePlace || null),
          arrivalDateIndia: g.arrivalDateIndia || null,
          portOfArrival:    g.portOfArrival || null,
          nextDestination:  g.nextDestination || null,
          homeCountryAddress: null,
          docsSubmitLater: !!g.docsSubmitLater,
          passportFileB64: g.passportPreview?.split(',')[1] || null,
          visaFileB64:     g.visaPreview?.split(',')[1] || null,
        })) : [],
        docsSubmitLater: isForeign ? (docsLater || false) : false,
        idFileB64, idFileName: idFile?.name||null,
        passportFileB64: passportB64,
        visaFileB64: visaB64,
        requestEarlyCheckIn: reqEarly,
        requestLateCheckOut: reqLate,
        requestBreakfast: reqBreakfast,
        breakfastChoice: reqBreakfast ? breakfastChoice : null,
        requestCab: reqCab,
        requestExtraBeds: reqExtraBeds,
        extraBedsCount: reqExtraBeds ? (parseInt(extraBedsCount) || 1) : 0,
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
          <LogoImg villaId={villaId} />
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

        {/* Link loading / error */}
        {linkLoading && (
          <div style={{ textAlign:'center', padding:'40px', color:'#9AA5B4' }}>
            <div style={{ fontSize:'1.5rem', marginBottom:'8px' }}>⏳</div>
            Verifying your check-in link…
          </div>
        )}
        {linkError && (
          <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
            borderRadius:'10px', padding:'16px', color:'#EF4444', textAlign:'center', marginBottom:'16px' }}>
            ⚠️ {linkError}<br />
            <span style={{ fontSize:'0.75rem', color:'#9AA5B4' }}>Please contact the villa for a valid link.</span>
          </div>
        )}
        {!linkLoading && !linkError && (<>

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
            <button type="button" onClick={() => switchNationality('Indian')}
              style={{ flex:1, padding:'11px 8px', borderRadius:'10px', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                border: nationality==='Indian' ? '1px solid #C8903A' : '1px solid rgba(255,255,255,0.1)',
                background: nationality==='Indian' ? 'rgba(200,144,58,0.15)' : 'rgba(255,255,255,0.03)',
                color: nationality==='Indian' ? '#C8903A' : '#9AA5B4',
                fontWeight: nationality==='Indian' ? '700' : '400', fontSize:'0.83rem' }}>
              <img src="https://flagcdn.com/w20/in.png" alt="India" style={{ width:'20px', height:'14px', borderRadius:'2px', objectFit:'cover' }} />
              Indian
            </button>
            <button type="button" onClick={() => switchNationality('Foreign')}
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
          <Input value={fullName} onChange={setFullName} placeholder={isForeign ? 'e.g. Michael J Carter' : 'e.g. Arjun R Nair'} />
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
          {/* +91 is fixed alongside the field rather than pre-filled into it,
              so a guest cannot delete it or type a domestic trunk 0 in front.
              That leading 0 is the single most common way a number reaches us
              unusable — wa.me rejects it, so the guest can't be messaged at
              all. Non-Indian guests use the toggle. */}
          <Field label="Phone number" required
            hint={intlPhone ? 'Include your country code' : 'Indian mobile — 10 digits, no leading 0'}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              {!intlPhone && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px',
                  borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.06)', color: '#EDF2F7',
                  fontSize: '16px', fontWeight: 600, flexShrink: 0 }}>
                  +91
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input type="tel" value={phone}
                  onChange={v => setPhone(intlPhone ? v : String(v).replace(/\D/g, '').replace(/^0+/, '').slice(0, 10))}
                  placeholder={intlPhone ? '+1 415 555 0142' : '9995043283'} />
              </div>
            </div>
            <button type="button" onClick={() => { setIntlPhone(!intlPhone); setPhone('') }}
              style={{ marginTop: 6, background: 'none', border: 'none', padding: 0,
                color: '#85B7EB', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>
              {intlPhone ? 'Indian number instead' : 'Not an Indian number?'}
            </button>
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
                placeholder="Full address including city, state/province" rows={3} />
            </Field>
            <Field label="Country" required>
              <Select value={country} onChange={setCountry} options={COUNTRIES} placeholder="Select country" />
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
            <Field label="Street address 1">
              <Input value={address} onChange={setAddress} placeholder="Flat / House number, Street" />
            </Field>
            <Field label="Street address 2">
              <Input value={address2} onChange={setAddress2} placeholder="Apartment, suite, area (optional)" />
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'12px' }}>
              <Field label="City / Town" required>
                <Input value={city} onChange={setCity} placeholder="Bengaluru" />
              </Field>
              {/* Not type=tel or maxLength 6 any more — that was an Indian
                  PIN assumption, and it silently truncated ZIP+4 and most
                  non-numeric postcodes (UK, Canada, Netherlands). */}
              <Field label="Pincode / ZIP code">
                <Input value={pincode} onChange={setPincode} placeholder="560001" maxLength={12} />
              </Field>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <Field label={addrCountry === 'India' ? 'State' : 'State / Province'} required>
                {addrCountry === 'India'
                  ? <Select value={state} onChange={setState} options={INDIAN_STATES} placeholder="Select state" />
                  : <Input value={state} onChange={setState} placeholder="California" />}
              </Field>
              <Field label="Country" required>
                <Select value={addrCountry}
                  onChange={v => { setAddrCountry(v); setState('') }}
                  options={COUNTRIES} placeholder="Select country" />
              </Field>
            </div>
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
            placeholder={isForeign ? 'e.g. Sarah Carter, Ethan Carter (age 8), Laura Carter' : 'e.g. Priya Nair, Karthik Nair (age 8), Meera Nair'} rows={2} />
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
          <Field label="Upload ID document" required hint="Photo or scan of front of your ID">
            <UploadBox label="Tap to upload ID" preview={idPreview}
              onClick={() => idRef.current?.click()}
              hint="Aadhaar / PAN / Licence — photo or PDF" />
            <input ref={idRef} type="file" accept="image/*,application/pdf"
              onChange={e => handleFileUpload(e, setIdPreview, setIdFile)}
              style={{ display:'none' }} />
            {idPreview && (
              <div style={{ fontSize:'0.7rem', color:'#34A853', marginTop:'4px' }}>✅ Document uploaded</div>
            )}
          </Field>
        </>)}

        {/* ── SECTION 4B: FOREIGN — FORM C ── */}
        {isForeign && (<>
          {/* The single most-missed rule on this form: guests fill in their
              own passport and assume they are done. Say it before they start,
              not after. */}
          <div style={{ margin:'18px 0 6px', padding:'16px 18px', borderRadius:'12px',
            background:'rgba(234,179,8,0.10)', border:'2px solid rgba(234,179,8,0.55)' }}>
            <div style={{ fontSize:'0.95rem', fontWeight:'800', color:'#EAB308',
              marginBottom:'8px', letterSpacing:'0.3px' }}>
              &#9888;&#65039; EVERY foreign guest needs their own passport &amp; visa
            </div>
            <div style={{ fontSize:'0.85rem', color:'#D8DEE6', lineHeight:'1.7' }}>
              Indian law requires a <strong style={{ color:'#FFF' }}>separate Form C for each
              foreign national</strong> staying at the villa &mdash; including children with
              their own passport.
              <br /><br />
              The next sections are for <strong style={{ color:'#FFF' }}>you only</strong>.
              For everyone else travelling with you, scroll to the bottom and use
              <strong style={{ color:'#EAB308' }}> &ldquo;+ Add another foreign guest&rdquo;</strong>,
              then upload <strong style={{ color:'#FFF' }}>their</strong> passport and visa there.
              <br /><br />
              <span style={{ color:'#9AA5B4' }}>
                We cannot complete your registration without a passport and visa for
                every foreign guest.
              </span>
            </div>
          </div>

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
            <input ref={passportRef} type="file" accept="image/*,application/pdf"
              onChange={handlePassportUpload}
              style={{ display:'none' }} />
            {passportPreview && (
              <div style={{ fontSize:'0.7rem', color:'#34A853', marginTop:'4px' }}>✅ Passport uploaded</div>
            )}
            {passportOcrBusy && (
              <div style={{ fontSize:'0.7rem', color:'#85B7EB', marginTop:'4px' }}>🔎 Reading passport…</div>
            )}
            {passportOcrHint && !passportOcrBusy && (
              <div style={{ fontSize:'0.7rem', color:'#9aa4b2', marginTop:'4px' }}>{passportOcrHint}</div>
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
              <input ref={visaRef} type="file" accept="image/*,application/pdf"
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

          {/* 7 - OTHER FOREIGN GUESTS. Form C is per person, so each foreign
               national in the party needs their own passport and visa here,
               not just the person who made the booking. */}
          <SectionLabel icon="👥" color="#85B7EB">7 &middot; OTHER FOREIGN GUESTS (FORM C)</SectionLabel>

          <div style={{ marginBottom:'14px', padding:'12px 14px',
            background:'rgba(133,183,235,0.06)', border:'1px solid rgba(133,183,235,0.2)',
            borderRadius:'10px', fontSize:'0.82rem', color:'#9AA5B4', lineHeight:'1.6' }}>
            Indian law requires a <strong style={{ color:'#C9D4E2' }}>separate Form C for every
            foreign national</strong> staying at the property &mdash; not just the person who booked.
            Sections 4&ndash;6 above cover <strong style={{ color:'#C9D4E2' }}>you</strong>. Please add
            each additional foreign guest below with their own passport and visa.
          </div>

          <div style={{ marginBottom:'14px', padding:'10px 14px', borderRadius:'10px',
            fontSize:'0.8rem', fontWeight:'600',
            background: formCMissing ? 'rgba(234,179,8,0.08)' : 'rgba(52,168,83,0.08)',
            border: '1px solid ' + (formCMissing ? 'rgba(234,179,8,0.35)' : 'rgba(52,168,83,0.35)'),
            color: formCMissing ? '#EAB308' : '#34A853' }}>
            {formCMissing
              ? formCFiled + ' of ' + partySize + ' guests entered — ' + formCMissing + ' still to add'
              : 'All ' + partySize + ' guest' + (partySize === 1 ? '' : 's') + ' entered'}
          </div>

          {extraGuests.map((g, i) => (
            <div key={i} style={{ marginBottom:'16px', padding:'14px', borderRadius:'12px',
              border:'1px solid rgba(133,183,235,0.25)', background:'rgba(133,183,235,0.04)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                marginBottom:'12px' }}>
                <div style={{ fontSize:'0.85rem', fontWeight:'700', color:'#85B7EB' }}>
                  GUEST {i + 2}
                </div>
                <button type="button" onClick={() => removeGuest(i)}
                  style={{ background:'none', border:'1px solid rgba(239,68,68,0.4)',
                    color:'#EF4444', borderRadius:'8px', padding:'5px 12px',
                    fontSize:'0.75rem', fontWeight:'600', cursor:'pointer' }}>
                  Remove
                </button>
              </div>

              <Field label="Full name (as in passport)" required>
                <Input value={g.guestName} onChange={v => patchGuest(i, { guestName:v })}
                  placeholder="Given name + surname" />
              </Field>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <Field label="Nationality" required>
                  <Select value={g.nationality} onChange={v => patchGuest(i, { nationality:v })}
                    options={COUNTRIES.filter(c => c !== 'India')} placeholder="Select country" />
                </Field>
                <Field label="Date of birth">
                  <Input type="date" value={g.dob} onChange={v => patchGuest(i, { dob:v })} />
                </Field>
              </div>
              <Field label="Gender">
                <Select value={g.gender} onChange={v => patchGuest(i, { gender:v })}
                  options={['Male','Female','Other']} placeholder="Select" />
              </Field>

              <div style={{ fontSize:'0.72rem', fontWeight:'700', color:'#6B7280',
                letterSpacing:'0.06em', margin:'14px 0 8px' }}>PASSPORT</div>
              <Field label="Passport number" required>
                <Input value={g.passportNumber} onChange={v => patchGuest(i, { passportNumber:v })}
                  placeholder="A1234567" />
              </Field>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <Field label="Issue date">
                  <Input type="date" value={g.passportIssueDate}
                    onChange={v => patchGuest(i, { passportIssueDate:v })} />
                </Field>
                <Field label="Expiry date" required>
                  <Input type="date" value={g.passportExpiry}
                    onChange={v => patchGuest(i, { passportExpiry:v })} />
                </Field>
              </div>
              <Field label="Place of issue">
                <Input value={g.passportIssuePlace}
                  onChange={v => patchGuest(i, { passportIssuePlace:v })}
                  placeholder="New Delhi / Mumbai" />
              </Field>
              <Field label="Upload passport photo page">
                <UploadBox label="Upload passport photo page" preview={g.passportPreview}
                  icon="🛂" color="#85B7EB"
                  onClick={() => guestFileRefs.current['p' + i]?.click()}
                  hint="Clear photo of the biographical data page" />
                <input type="file" accept="image/*,application/pdf"
                  ref={el => { guestFileRefs.current['p' + i] = el }}
                  onChange={e => handleGuestUpload(e, i, 'passportPreview')}
                  style={{ display:'none' }} />
              </Field>

              <div style={{ fontSize:'0.72rem', fontWeight:'700', color:'#6B7280',
                letterSpacing:'0.06em', margin:'14px 0 8px' }}>VISA</div>
              <ServiceToggle label="Submit visa documents at check-in"
                hint="Skip visa details now - bring originals on arrival"
                checked={g.docsSubmitLater}
                onClick={() => patchGuest(i, { docsSubmitLater: !g.docsSubmitLater })} />
              {!g.docsSubmitLater && (<>
                <Field label="Visa number" required>
                  <Input value={g.visaNumber} onChange={v => patchGuest(i, { visaNumber:v })}
                    placeholder="IN-XXXXXXXX" />
                </Field>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <Field label="Visa type" required>
                    <Select value={g.visaType} onChange={v => patchGuest(i, { visaType:v })}
                      options={VISA_TYPES} placeholder="Select..." />
                  </Field>
                  <Field label="Issue date">
                    <Input type="date" value={g.visaIssueDate}
                      onChange={v => patchGuest(i, { visaIssueDate:v })} />
                  </Field>
                </div>
                <Field label="Place of visa issue">
                  <Input value={g.visaIssuePlace}
                    onChange={v => patchGuest(i, { visaIssuePlace:v })}
                    placeholder="Embassy / Consulate city" />
                </Field>
                <Field label="Upload visa page">
                  <UploadBox label="Upload visa page" preview={g.visaPreview}
                    icon="📋" color="#85B7EB"
                    onClick={() => guestFileRefs.current['v' + i]?.click()}
                    hint="Visa stamp, sticker, or e-Visa printout" />
                  <input type="file" accept="image/*,application/pdf"
                    ref={el => { guestFileRefs.current['v' + i] = el }}
                    onChange={e => handleGuestUpload(e, i, 'visaPreview')}
                    style={{ display:'none' }} />
                </Field>
              </>)}

              <div style={{ fontSize:'0.72rem', fontWeight:'700', color:'#6B7280',
                letterSpacing:'0.06em', margin:'14px 0 8px' }}>ARRIVAL IN INDIA</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <Field label="Date of arrival in India">
                  <Input type="date" value={g.arrivalDateIndia}
                    onChange={v => patchGuest(i, { arrivalDateIndia:v })} />
                </Field>
                <Field label="Port of arrival">
                  <Input value={g.portOfArrival} onChange={v => patchGuest(i, { portOfArrival:v })}
                    placeholder="Kochi / Chennai" />
                </Field>
              </div>
              <Field label="Next destination after this stay">
                <Input value={g.nextDestination}
                  onChange={v => patchGuest(i, { nextDestination:v })}
                  placeholder="Kovalam / Mumbai / Home country" />
              </Field>
            </div>
          ))}

          <button type="button" onClick={addGuest}
            style={{ width:'100%', padding:'14px', borderRadius:'10px',
              border:'1px dashed rgba(133,183,235,0.5)', background:'rgba(133,183,235,0.06)',
              color:'#85B7EB', fontSize:'0.88rem', fontWeight:'700', cursor:'pointer',
              marginBottom:'6px' }}>
            + Add another foreign guest
          </button>
          <div style={{ fontSize:'0.72rem', color:'#6B7280', marginBottom:'14px' }}>
            Add one block per additional foreign national &mdash; including children with their own passport.
          </div>
        </>)}

        {/* ── ENHANCE YOUR STAY (optional add-ons) ── */}
        <SectionLabel icon="✨" color="#8B5CF6">{enhanceSectionNum} · ENHANCE YOUR STAY</SectionLabel>

        <div style={{ marginBottom:'14px', padding:'12px 14px', background:'rgba(139,92,246,0.06)',
          border:'1px solid rgba(139,92,246,0.2)', borderRadius:'10px', fontSize:'0.82rem',
          color:'#9AA5B4', lineHeight:'1.6' }}>
          💡 Curious how early check-in, late check-out, or our other services actually work? Take a quick look at our{' '}
          <a href="https://luxuryvillasofguruvayur.com/faq.html" target="_blank" rel="noreferrer"
            style={{ color:'#A78BFA', fontWeight:'600' }}>Stay FAQ</a>{' '}
          before choosing below — it only takes a minute, and helps you pick exactly what's right for your stay.
        </div>

        <div style={{ fontSize:'0.78rem', color:'#9AA5B4', marginBottom:'10px' }}>
          Select any services you would like us to arrange:
        </div>

        <ServiceToggle label="Request early check-in" hint="Subject to availability · Additional charges apply"
          checked={reqEarly} onClick={() => setReqEarly(!reqEarly)} />
        <ServiceToggle label="Request late check-out" hint="Subject to availability · No last-minute extensions"
          checked={reqLate} onClick={() => setReqLate(!reqLate)} />
        <ServiceToggle label="Breakfast" priceNote="(₹275 per person)"
          hint="Fresh traditional Kerala breakfast prepared and served at the villa."
          checked={reqBreakfast}
          onClick={() => { const next = !reqBreakfast; setReqBreakfast(next); if (!next) setBreakfastChoice('') }} />

        {reqBreakfast && (
          <div style={{ marginLeft:'30px', marginBottom:'10px' }}>
            <div style={{ fontSize:'0.72rem', color:'#9AA5B4', marginBottom:'6px' }}>Select breakfast type:</div>
            {[
              'Idli, Vada, Chutney, Coffee/Tea & Water',
              'Puttu, Kadala, Kerala Banana, Coffee/Tea & Water',
              'Appam, Curry, Coffee/Tea & Water',
            ].map(opt => {
              const key = opt.split(',')[0]
              const active = breakfastChoice === key
              return (
                <div key={key} onClick={() => setBreakfastChoice(active ? '' : key)}
                  style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px', cursor:'pointer' }}>
                  <div style={{ width:'16px', height:'16px', borderRadius:'4px', flexShrink:0,
                    border: active ? '1px solid #8B5CF6' : '1px solid rgba(255,255,255,0.2)',
                    background: active ? '#8B5CF6' : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', color:'#fff' }}>
                    {active ? '✓' : ''}
                  </div>
                  <div style={{ fontSize:'0.78rem', color:'#D0D0D0' }}>{opt}</div>
                </div>
              )
            })}
          </div>
        )}

        <ServiceToggle label="Extra floor beds" priceNote="₹750 per night (₹1,000 at the villa)"
          hint="Additional sleeping arrangements · Please specify count below"
          checked={reqExtraBeds} onClick={() => setReqExtraBeds(!reqExtraBeds)} />

        {reqExtraBeds && (
          <div style={{ marginLeft:'30px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ fontSize:'0.78rem', color:'#9AA5B4' }}>Number of extra beds needed</span>
            <input type="number" min="1" max="10" value={extraBedsCount}
              onChange={e => setExtraBedsCount(e.target.value)}
              style={{ width:'60px', padding:'6px 8px', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.15)',
                background:'#1E2530', color:'#F0F0F0', fontSize:'0.8rem' }} />
          </div>
        )}

        <ServiceToggle label="Cab service"
          hint="Airport and railway station pickup/drop arrangements coordinated by our team."
          checked={reqCab} onClick={() => setReqCab(!reqCab)} />

        {/* ── WHAT HAPPENS NEXT ── */}
        <div style={{ margin:'24px 0 4px', padding:'16px', background:'rgba(200,144,58,0.06)',
          border:'1px solid rgba(200,144,58,0.2)', borderRadius:'10px' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:'700', letterSpacing:'1px', color:'#C8903A', marginBottom:'10px' }}>
            ONCE SUBMITTED
          </div>
          <div style={{ fontSize:'0.78rem', color:'#9AA5B4', lineHeight:'1.7' }}>
            <div style={{ marginBottom:'6px' }}>✅ Thank you for completing your registration. Our host team will review your details and contact you shortly.</div>
            <div style={{ marginBottom:'6px' }}>📞 We will reach out to assist with your arrival and check-in arrangements.</div>
            <div style={{ marginBottom:'6px' }}>🛏️ Extra floor beds pre-booked here: <strong style={{ color:'#C8903A' }}>₹750 / bed / night.</strong></div>
            <div>🛏️ Extra floor beds requested at villa: <strong style={{ color:'#9AA5B4' }}>₹1,000 / bed / night.</strong></div>
          </div>
        </div>

        </> /* end !linkLoading && !linkError */
        )}

        {/* ── SUBMIT ── */}
        {!linkLoading && !linkError && <div style={{ marginTop:'28px' }}>
          {/* Last chance to catch a party that entered one passport for four
              people. Warns, but never blocks — a guest stuck at midnight
              without a companion's passport still has to be able to register. */}
          {isForeign && formCMissing > 0 && (
            <div style={{ background:'rgba(234,179,8,0.10)', border:'2px solid rgba(234,179,8,0.55)',
              borderRadius:'12px', padding:'14px 16px', marginBottom:'14px' }}>
              <div style={{ fontSize:'0.88rem', fontWeight:'800', color:'#EAB308', marginBottom:'6px' }}>
                &#9888;&#65039; {formCMissing} foreign guest{formCMissing === 1 ? '' : 's'} still missing a passport
              </div>
              <div style={{ fontSize:'0.8rem', color:'#D8DEE6', lineHeight:'1.6' }}>
                You told us <strong style={{ color:'#FFF' }}>{partySize}</strong> guest{partySize === 1 ? '' : 's'} are
                staying, but only <strong style={{ color:'#FFF' }}>{formCFiled}</strong> passport
                {formCFiled === 1 ? '' : 's'} {formCFiled === 1 ? 'has' : 'have'} been entered. Use
                <strong style={{ color:'#EAB308' }}> &ldquo;+ Add another foreign guest&rdquo;</strong> above
                for each remaining person. If some of your party are Indian citizens you can
                continue &mdash; Form C applies only to foreign nationals.
              </div>
            </div>
          )}
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
        </div>}

      </div>
    </div>
  )
}

const s = {
  page:   { minHeight:'100vh', background:'#0D1117', color:'#F0F0F0', fontFamily:'system-ui,sans-serif' },
  header: { background:'linear-gradient(135deg, #111827 0%, #1A2332 100%)',
            padding:'24px 20px 20px', borderBottom:'1px solid rgba(200,144,58,0.2)' },
  brandRow:    { display:'flex', alignItems:'center', gap:'14px', marginBottom:'12px' },
  logoImg:     { height:'56px', width:'56px', borderRadius:'12px', objectFit:'cover',
                 border:'1px solid rgba(200,144,58,0.3)', boxShadow:'0 4px 12px rgba(200,144,58,0.15)' },
  brandIcon:   { fontSize:'2rem', background:'rgba(200,144,58,0.15)', borderRadius:'12px',
                 padding:'8px 10px', border:'1px solid rgba(200,144,58,0.3)',
                 alignItems:'center', justifyContent:'center' },
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
