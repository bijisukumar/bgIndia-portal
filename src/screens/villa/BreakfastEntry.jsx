import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'
import { localTodayStr } from '../../utils/dates'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'

export default function BreakfastEntry() {
  const navigate   = useNavigate()
  const [stay, setStay]         = useState(null)
  // Combined list: active stay (if any) first, then recent checkouts —
  // always offered together so Raman can log a just-checked-out guest's
  // breakfast charge (these can land 1-2 days late) even after a new
  // guest has already checked in and become the active stay.
  const [guestOptions, setGuestOptions] = useState([])
  const [date, setDate]         = useState(localTodayStr())
  const [guestCount, setCount]  = useState(0)
  const [rate, setRate]         = useState(CONFIG.breakfastRate || 275)
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }
  const total = guestCount * rate

  const selectGuest = (g) => {
    setStay(g)
    setCount(parseInt(g.adults || g.guestCount || 0))
  }

  useEffect(() => {
    Promise.all([
      api.getActiveStay(DEFAULT_VILLA_ID).catch(() => null),
      api.getRecentCheckouts(DEFAULT_VILLA_ID).catch(() => []),
    ]).then(([active, checkouts]) => {
      const options = [
        ...(active && active.stayId ? [{ ...active, isHistoricalSession: false }] : []),
        ...(Array.isArray(checkouts) ? checkouts.map(c => ({
          stayId: c.stay_id, guestName: c.guest_name, adults: c.adults,
          isHistoricalSession: true, checkoutDate: c.checkout_date,
        })) : []),
      ]
      setGuestOptions(options)
      if (options.length) selectGuest(options[0])
    })
  }, [])

  const handleSave = async () => {
    if (!guestCount) { showToast('Enter guest count','error'); return }
    setSaving(true)
    try {
      // Note: this only logs the charge to guest_requests — it never touches
      // stays.status, so picking a past checkout here does NOT re-trigger
      // checkout or affect the booking lifecycle.
      await api.saveBreakfastEntry({ stayId:stay?.stayId, guestName:stay?.guestName, date, guestCount, ratePerPerson:rate, total, notes })
      showToast(`Breakfast entry saved ✓${stay?.isHistoricalSession ? ' · retroactive' : ''}`)
      setNotes('')
    } catch { showToast('Failed to save','error') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div><div className="topbar-title">Breakfast</div><div className="topbar-sub">{stay?.guestName || 'No active stay'}</div></div>
        <div style={{width:34}}/>
      </div>
      <div className="screen-body">
        {guestOptions.length > 0 && (
          <div className="card" style={{ padding: '14px', marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.65rem', color: '#5C7080', marginBottom: '6px', fontWeight: '600', letterSpacing: '1px' }}>
              GUEST CONTEXT — who is this breakfast for?
            </label>
            <select
              value={stay?.stayId || ''}
              onChange={(e) => {
                const chosen = guestOptions.find(g => g.stayId === e.target.value)
                if (chosen) selectGuest(chosen)
              }}
              className="field-input"
              style={{ width: '100%', background: '#1A202C', color: '#FFF', padding: '8px', borderRadius: '6px', border: '1px solid rgba(200,144,58,0.3)' }}
            >
              {guestOptions.map(g => (
                <option key={g.stayId} value={g.stayId}>
                  {g.isHistoricalSession ? `${g.guestName} — checked out ${g.checkoutDate}` : `🟢 ${g.guestName} — active stay`}
                </option>
              ))}
            </select>
          </div>
        )}
        {!stay ? (
          <div className="card" style={{ padding: '14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>No active stay or recent checkouts found.</div>
          </div>
        ) : (
          <>
            <div className="card-section-label">BREAKFAST ENTRY</div>
            <div className="card">
              <div className="grid-2">
                <div className="field">
                  <div className="field-label">Date</div>
                  <input className="field-input gold" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
                </div>
                <div className="field">
                  <div className="field-label">Rate / person (₹)</div>
                  <input className="field-input" type="number" value={rate} onChange={e=>setRate(e.target.value)}/>
                </div>
              </div>
              <div className="field">
                <div className="field-label">Number of guests</div>
                <div style={{display:'flex',alignItems:'center',gap:'16px',marginTop:'6px'}}>
                  <button onClick={()=>setCount(Math.max(0,guestCount-1))}
                    style={{width:36,height:36,borderRadius:'50%',border:'1px solid var(--border-dim)',
                      background:'transparent',color:'var(--text)',fontSize:'1.3rem',cursor:'pointer'}}>−</button>
                  <span style={{color:'var(--gold)',fontSize:'2rem',fontWeight:'800',minWidth:'40px',textAlign:'center'}}>{guestCount}</span>
                  <button onClick={()=>setCount(guestCount+1)}
                    style={{width:36,height:36,borderRadius:'50%',border:'1px solid var(--border-dim)',
                      background:'transparent',color:'var(--text)',fontSize:'1.3rem',cursor:'pointer'}}>+</button>
                </div>
              </div>
              <div className="field" style={{marginBottom:0}}>
                <div className="field-label">Notes (optional)</div>
                <input className="field-input" placeholder="Any notes..." value={notes} onChange={e=>setNotes(e.target.value)}/>
              </div>
            </div>
            <div className="net-box">
              <div className="net-row">
                <span className="net-label">{guestCount} guests × ₹{rate}</span>
                <span className="net-val big">₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <button className="btn btn-gold" onClick={handleSave} disabled={saving||!guestCount}>
              {saving ? 'Saving...' : `Save · ₹${total.toLocaleString('en-IN')}`}
            </button>
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
