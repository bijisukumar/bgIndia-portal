import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

export default function CarRentalEntry() {
  const navigate = useNavigate()
  const [stay, setStay]             = useState(null)
  const [date, setDate]             = useState(new Date().toISOString().split('T')[0])
  const [destination, setDest]      = useState('')
  const [amount, setAmount]         = useState('')
  const [commission, setCommission] = useState('')
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState(null)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }
  const net = (parseFloat(amount)||0) - (parseFloat(commission)||0)

  useEffect(() => { api.getActiveStay('dwarka').then(s => { if(s?.stayId) setStay(s) }) }, [])

  const handleSave = async () => {
    if (!amount) { showToast('Enter trip amount','error'); return }
    setSaving(true)
    try {
      await api.saveCarRental({ stayId:stay?.stayId, guestName:stay?.guestName, date, destination, amount:parseFloat(amount), commission:parseFloat(commission)||0, net, notes })
      showToast('Car rental saved ✓')
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
          <div className="card" style={{textAlign:'center',padding:'32px',color:'var(--text-dim)'}}>No active stay — check in a guest first</div>
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
