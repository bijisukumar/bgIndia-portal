// "Cars" for a guest who is already in the villa (Raman's Check-in screen, In-house tab). Rain can stop the car and
// plate photos being taken at the gate, or a second car turns up later: this adds them afterwards, to the same
// place they would have gone at check-in (the stay's car numbers, and the photos the guest's Drive folder receives).
// It only ever ADDS: nothing already on record is replaced.
import { useEffect, useState } from 'react'
import { api } from '../../api'
import CarFields, { emptyCar, carsToPayload } from './CarFields'

export default function AddStayCars({ stay, onSaved, showToast }) {
  const [open, setOpen]     = useState(false)
  const [cars, setCars]     = useState([emptyCar()])
  const [saving, setSaving] = useState(false)

  // A different guest: start closed and empty.
  useEffect(() => { setOpen(false); setCars([emptyCar()]) }, [stay.stay_id])

  const numbers = String(stay.vehicle_number || '').split(/[,;]/).map(s => s.trim()).filter(Boolean)
  const payload = carsToPayload(cars)

  async function save() {
    if (!payload.length) return
    setSaving(true)
    try {
      const res = await api.addStayCars({ stayId: stay.stay_id, cars: payload })
      const n = res?.numbersAdded?.length || 0
      const p = res?.photosSaved || 0
      showToast(`🚗 Saved${n ? ` · ${n} car number${n > 1 ? 's' : ''}` : ''}${p ? ` · ${p} photo${p > 1 ? 's' : ''}` : ''}`)
      setOpen(false)
      setCars([emptyCar()])
      if (onSaved) onSaved(res)
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="card-section-label">CARS</div>
      <div className="card" style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '0.85rem', marginBottom: open ? 0 : '10px', color: numbers.length ? 'var(--text)' : 'var(--text-dim)' }}>
          {numbers.length ? `🚗 ${numbers.join('  ·  ')}` : 'No car number on record yet'}
        </div>
        {!open && (
          <button className="btn" onClick={() => setOpen(true)}>📷 Add car photos / plate numbers</button>
        )}
      </div>
      {open && (
        <>
          <CarFields cars={cars} setCars={setCars} heading="ADD CAR PHOTOS / PLATE NUMBERS" />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button className="btn btn-gold" style={{ flex: 1 }} disabled={saving || !payload.length} onClick={save}>
              {saving ? 'Saving…' : '✅ Save cars'}
            </button>
            <button className="btn" style={{ flex: 1 }} disabled={saving} onClick={() => { setOpen(false); setCars([emptyCar()]) }}>
              Cancel
            </button>
          </div>
        </>
      )}
    </>
  )
}
