import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { localTodayStr } from '../../utils/dates'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'

export default function CarRentalEntry() {
  const navigate = useNavigate()
  const [stay, setStay]             = useState(null)
  // Combined list: active stay (if any) first, then recent checkouts —
  // always offered together so Raman can log a just-checked-out guest's
  // car rental charge (these can land 1-2 days late) even after a new
  // guest has already checked in and become the active stay.
  const [guestOptions, setGuestOptions] = useState([])
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
    Promise.all([
      api.getActiveStay(DEFAULT_VILLA_ID).catch(() => null),
      api.getRecentCheckouts(DEFAULT_VILLA_ID).catch(() => []),
    ]).then(([active, checkouts]) => {
      const options = [
        ...(active && active.stayId ? [{ ...active, isHistoricalSession: false }] : []),
        ...(Array.isArray(checkouts) ? checkouts.map(c => ({
          stayId: c.stay_id, guestName: c.guest_name,
          isHistoricalSession: true, checkoutDate: c.checkout_date,
        })) : []),
      ]
      setGuestOptions(options)
      if (options.length) setStay(options[0])
    })
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
        {guestOptions.length > 0 && (
          <div className="card" style={{ padding: '14px', marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.65rem', color: '#5C7080', marginBottom: '6px', fontWeight: '600', letterSpacing: '1px' }}>
              GUEST CONTEXT — who is this car rental for?
            </label>
            <select
              value={stay?.stayId || ''}
              onChange={(e) => {
                const chosen = guestOptions.find(g => g.stayId === e.target.value)
                if (chosen) setStay(chosen)
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
