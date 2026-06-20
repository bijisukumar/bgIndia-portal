import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { localTodayStr } from '../../utils/dates'

export default function CarRentalEntry() {
  const navigate = useNavigate()
  const [stay, setStay]             = useState(null)
  const [recentCheckouts, setRecentCheckouts] = useState([])
  const [date, setDate]             = useState(localTodayStr())
  const [destination, setDest]      = useState('')
  const [amount, setAmount]         = useState('')
  const [commission, setCommission] = useState('')
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState(null)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }
  const net = (parseFloat(amount)||0) - (parseFloat(commission)||0)

  useEffect(() => {
    api.getActiveStay('dwarka').then(s => { if(s?.stayId) setStay(s) })
    api.getRecentCheckouts('dwarka').then(d => { if (Array.isArray(d)) setRecentCheckouts(d) }).catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!amount) { showToast('Enter trip amount','error'); return }
    setSaving(true)
    try {
      // Note: only logs to guest_requests — never touches stays.status,
      // so a retroactive (past-checkout) entry does not affect the booking lifecycle.
      await api.saveCarRental({ stayId:stay?.stayId, guestName:stay?.guestName, date, destination, amount:parseFloat(amount), commission:parseFloat(commission)||0, net, notes })
      showToast(`Car rental saved ✓${stay?.isHistoricalSession ? ' · retroactive' : ''}`)
      setDest(''); setAmount(''); setCommission(''); setNotes('')
    } catch { showToast('Failed to save','error') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div><div className="topbar-title">Car rental</div><div className="topbar-sub">{stay?.guestName || 'No active stay'}</div></div>
        <div style={{width:34}}/>
      </div>
      <div className="screen-body">
        {!stay ? (
          <div className="card" style={{ padding: '14px', marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#F59E0B', marginBottom: '6px', fontWeight: '600' }}>
              ⚠️ No active stay found. Select a recent checkout to log a car rental:
            </label>
            {recentCheckouts.length > 0 ? (
              <select
                onChange={(e) => {
                  const chosen = recentCheckouts.find(r => r.stay_id === e.target.value)
                  if (chosen) {
                    setStay({ stayId: chosen.stay_id, guestName: chosen.guest_name, isHistoricalSession: true })
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
            <div className="card-section-label">TRIP DETAILS</div>
            <div className="card">
              <div className="grid-2">
                <div className="field">
                  <div className="field-label">Date</div>
                  <input className="field-input gold" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
                </div>
                <div className="field">
                  <div className="field-label">Destination</div>
                  <input className="field-input" placeholder="e.g. Thrissur" value={destination} onChange={e=>setDest(e.target.value)}/>
                </div>
                <div className="field">
                  <div className="field-label">Trip amount (₹)</div>
                  <input className="field-input gold" type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/>
                </div>
                <div className="field">
                  <div className="field-label">Our commission (₹)</div>
                  <input className="field-input" type="number" placeholder="0" value={commission} onChange={e=>setCommission(e.target.value)}/>
                </div>
              </div>
              <div className="field" style={{marginBottom:0}}>
                <div className="field-label">Notes</div>
                <input className="field-input" placeholder="Driver name, vehicle, etc." value={notes} onChange={e=>setNotes(e.target.value)}/>
              </div>
            </div>
            {amount && (
              <div className="net-box">
                <div className="net-row"><span className="net-label">Trip amount</span><span className="net-val pos">₹{parseFloat(amount).toLocaleString('en-IN')}</span></div>
                {commission && <div className="net-row"><span className="net-label">Commission</span><span className="net-val neg">−₹{parseFloat(commission).toLocaleString('en-IN')}</span></div>}
                <div className="net-divider"/>
                <div className="net-row"><span style={{color:'var(--text)',fontWeight:'700'}}>Net to villa</span><span className="net-val big">₹{net.toLocaleString('en-IN')}</span></div>
              </div>
            )}
            <button className="btn btn-gold" onClick={handleSave} disabled={saving||!amount}>
              {saving ? 'Saving...' : 'Save car rental entry'}
            </button>
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
