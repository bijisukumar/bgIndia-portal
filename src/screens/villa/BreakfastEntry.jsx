import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'
import { localTodayStr } from '../../utils/dates'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'

export default function BreakfastEntry() {
  const navigate   = useNavigate()
  const [stay, setStay]         = useState(null)
  const [recentCheckouts, setRecentCheckouts] = useState([])
  const [date, setDate]         = useState(localTodayStr())
  const [guestCount, setCount]  = useState(0)
  const [rate, setRate]         = useState(CONFIG.breakfastRate || 275)
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }
  const total = guestCount * rate

  useEffect(() => {
    api.getActiveStay(DEFAULT_VILLA_ID).then(s => {
      if (s?.stayId) {
        setStay(s)
        setCount(parseInt(s.adults||s.guestCount||0))
      }
    })
    api.getRecentCheckouts(DEFAULT_VILLA_ID).then(d => { if (Array.isArray(d)) setRecentCheckouts(d) }).catch(() => {})
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
        {!stay ? (
          <div className="card" style={{ padding: '14px', marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#F59E0B', marginBottom: '6px', fontWeight: '600' }}>
              ⚠️ No active stay found. Select a recent checkout to log breakfast charges:
            </label>
            {recentCheckouts.length > 0 ? (
              <select
                onChange={(e) => {
                  const chosen = recentCheckouts.find(r => r.stay_id === e.target.value)
                  if (chosen) {
                    setStay({
                      stayId: chosen.stay_id, guestName: chosen.guest_name,
                      adults: chosen.adults, isHistoricalSession: true,
                    })
                    setCount(parseInt(chosen.adults) || 0)
                  } else { setStay(null) }
                }}
                className="field-input"
                style={{ width: '100%', background: '#1A202C', color: '#FFF', padding: '8px', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                <option value="">-- Choose a past checkout --</option>
                {recentCheckouts.map(s => (
                  <option key={s.stay_id} value={s.stay_id}>{s.guest_name} (Checked out: {s.checkout_date})</option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>No recent checkouts found.</div>
            )}
          </div>
        ) : (
          <>
            {stay.isHistoricalSession && (
              <div className="card" style={{ padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#5C7080', fontSize: '0.65rem' }}>🔴 RETROACTIVE — {stay.guestName}</span>
                <button onClick={() => setStay(null)} style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>✕ Clear</button>
              </div>
            )}
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
