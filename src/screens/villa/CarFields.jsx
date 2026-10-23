// The cars of ONE stay, as Raman records them: for each car a photo of the car, a photo of its number plate and
// the number itself. A plate photo is read by the AI (api.ocrPlate) and pre-fills the number: advisory only, Raman
// checks or types it, and a failed read just says so and never blocks anything. Up to MAX_CARS.
//
// Controlled: the parent keeps `cars` (so its Save / Confirm button can send them) and this draws and edits them.
// Used by the check-in tab (cars at the gate) and by "Add cars" on an in-house guest (cars added later: rain, or a
// second car), so both behave the same.
import { useRef } from 'react'
import { api } from '../../api'

export const MAX_CARS = 3

// One entry per car: most bookings have one, but a family can arrive in 2-3 vehicles and every one needs to be on
// record. Each entry carries its own OCR state since each plate photo is read independently.
export const emptyCar = () => ({ number: '', photo: null, plate: null, ocrBusy: false, ocrHint: '', ocrSuggestion: '' })

// What the Worker takes: only cars with something in them, photos as bare base64.
export function carsToPayload(cars) {
  return cars
    .filter(c => c.number.trim() || c.photo || c.plate)
    .map(c => ({
      number: c.number.trim(),
      carPhotoB64:   c.photo ? c.photo.preview.split(',')[1] : null,
      platePhotoB64: c.plate ? c.plate.preview.split(',')[1] : null,
    }))
}

export default function CarFields({ cars, setCars, heading }) {
  // Per-car file input refs, indexed by car position (up to MAX_CARS).
  const carRefs   = useRef([])
  const plateRefs = useRef([])

  const updateCar = (i, patch) => setCars(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  const addCar = () => setCars(prev => prev.length < MAX_CARS ? [...prev, emptyCar()] : prev)
  const removeCar = (i) => setCars(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)

  function handlePhotoCapture(i, type, e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      if (type==='car')   updateCar(i, { photo: {file, preview:ev.target.result} })
      if (type==='plate') {
        updateCar(i, { plate: {file, preview:ev.target.result} })
        // Kick off plate OCR to pre-fill this car's number. Fire-and-forget:
        // it never blocks the photo capture or the check-in itself.
        const b64 = ev.target.result.split(',')[1]
        runPlateOcr(i, b64)
      }
    }
    reader.readAsDataURL(file)
  }

  // Read the number-plate photo via Workers AI and pre-fill this car's
  // number. Advisory only — Raman verifies/corrects. Any failure just
  // leaves the field for manual entry with a gentle hint; nothing here can
  // break the check-in flow.
  async function runPlateOcr(i, platePhotoB64) {
    if (!platePhotoB64) return
    updateCar(i, { ocrBusy: true, ocrHint: '', ocrSuggestion: '' })
    try {
      const res = await api.ocrPlate({ platePhotoB64 })
      const plate = res?.plate || ''
      if (!plate) {
        updateCar(i, { ocrBusy: false, ocrHint: "Couldn't read the plate — please type it in" })
        return
      }
      // Don't clobber a number Raman already typed; offer it instead.
      setCars(prev => prev.map((c, idx) => {
        if (idx !== i) return c
        if (c.number.trim() && c.number.trim() !== plate) return { ...c, ocrBusy: false, ocrSuggestion: plate, ocrHint: '' }
        return { ...c, ocrBusy: false, number: plate, ocrHint: '✨ Auto-read from the plate photo — please check it' }
      }))
    } catch (e) {
      updateCar(i, { ocrBusy: false, ocrHint: "Couldn't read the plate — please type it in" })
    }
  }

  return (
    <>
      <div className="card-section-label">{heading} {cars.length > 1 ? `(${cars.length} cars)` : ''}</div>
      {cars.map((car, i) => (
        <div className="card" key={i} style={{ marginBottom: cars.length > 1 ? '10px' : undefined }}>
          {cars.length > 1 && (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <span style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--gold)' }}>Car {i + 1}</span>
              <span onClick={()=>removeCar(i)} style={{ fontSize:'0.75rem', color:'#EF4444', cursor:'pointer' }}>✕ Remove</span>
            </div>
          )}
          <div className="photo-row">
            <div className={`photo-box ${car.photo?'captured':''}`} onClick={()=>carRefs.current[i]?.click()}>
              {car.photo
                ? <img src={car.photo.preview} alt="car" style={{width:'100%',height:'80px',objectFit:'cover',borderRadius:'6px'}}/>
                : <><div className="photo-icon">📷</div><div className="photo-label">Car photo</div><div className="photo-sub">Tap to take</div></>
              }
              <input ref={el => carRefs.current[i] = el} type="file" accept="image/*" capture="environment"
                onChange={e=>handlePhotoCapture(i, 'car', e)} style={{display:'none'}}/>
            </div>
            <div className={`photo-box ${car.plate?'captured':''}`} onClick={()=>plateRefs.current[i]?.click()}>
              {car.plate
                ? <img src={car.plate.preview} alt="plate" style={{width:'100%',height:'80px',objectFit:'cover',borderRadius:'6px'}}/>
                : <><div className="photo-icon">🔢</div><div className="photo-label">Number plate</div><div className="photo-sub">Tap to take</div></>
              }
              <input ref={el => plateRefs.current[i] = el} type="file" accept="image/*" capture="environment"
                onChange={e=>handlePhotoCapture(i, 'plate', e)} style={{display:'none'}}/>
            </div>
          </div>
          <div className="divider"/>
          <div className="field" style={{marginBottom:0}}>
            <div className="field-label">
              Car number
              {car.ocrBusy && <span style={{marginLeft:8,fontWeight:400,color:'#8a94a6'}}>· reading plate photo…</span>}
            </div>
            <input className="field-input" placeholder="e.g. KL 07 AB 1234"
              value={car.number}
              onChange={e=>updateCar(i, { number: e.target.value.toUpperCase(), ocrHint: '', ocrSuggestion: '' })}
              style={{textTransform:'uppercase'}}/>
            {car.ocrHint && (
              <div style={{marginTop:6,fontSize:12,color:'#8a94a6'}}>{car.ocrHint}</div>
            )}
            {car.ocrSuggestion && (
              <div style={{marginTop:6,fontSize:12,color:'#8a94a6'}}>
                Photo reads “{car.ocrSuggestion}” ·{' '}
                <span
                  onClick={()=>updateCar(i, { number: car.ocrSuggestion, ocrSuggestion: '', ocrHint: '✨ Using the plate photo reading — please check it' })}
                  style={{color:'#c9a24b',fontWeight:600,cursor:'pointer'}}>use this</span>
              </div>
            )}
          </div>
        </div>
      ))}
      {cars.length < MAX_CARS && (
        <button className="btn" onClick={addCar} style={{ marginBottom:'12px' }}>+ Add another car</button>
      )}
    </>
  )
}
