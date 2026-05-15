import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

const TODAY = new Date().toISOString().split('T')[0]
const CHANNELS = ['Direct','Airbnb','MakeMyTrip','Booking.com','Goibibo','Other']
const COMMISSION = {'Direct':0,'Airbnb':15,'MakeMyTrip':18,'Booking.com':15,'Goibibo':18,'Other':10}

function fmt(n){ return isNaN(n)||n===''?'—':`₹${Number(n).toLocaleString('en-IN')}` }

export default function VillaRentalIncome() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({
    checkInDate: TODAY, checkOutDate:'', guestName:'', channel:'Direct',
    rooms:'1', tariffPerNight:'', extraCharges:'0', notes:''
  })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const nights = form.checkInDate && form.checkOutDate
    ? Math.max(0, (new Date(form.checkOutDate)-new Date(form.checkInDate))/(1000*60*60*24)) : 0
  const tariff = parseFloat(form.tariffPerNight)||0
  const extra  = parseFloat(form.extraCharges)||0
  const gross  = (tariff * nights) + extra
  const commPct = COMMISSION[form.channel]||0
  const commAmt = Math.round(gross * commPct / 100)
  const net     = gross - commAmt

  const showToast=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000)}

  const handleSave = async () => {
    if (!form.checkInDate||!form.checkOutDate||!form.guestName||!form.tariffPerNight) {
      showToast('Fill in dates, guest name and tariff','error'); return
    }
    setSaving(true)
    try {
      await api.saveVillaRentalIncome({...form,nights,gross,commPct,commAmt,net,villaId:'dwarka'})
      showToast('Income record saved ✓')
      setTimeout(()=>navigate(-1),1500)
    } catch { showToast('Failed to save. Check connection.','error') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div><div className="topbar-title">Villa rental income</div><div className="topbar-sub">DWARKA · NEW BOOKING</div></div>
      </div>
      <div className="screen-body">
        <div className="card-section-label">BOOKING DETAILS</div>
        <div className="card">
          <div className="field">
            <label className="field-label">Guest / booker name</label>
            <input className="field-input" placeholder="e.g. Vikram Ramasubramanian"
              value={form.guestName} onChange={e=>set('guestName',e.target.value)}/>
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="field-label">Check-in date</label>
              <input className="field-input gold" type="date" value={form.checkInDate} onChange={e=>set('checkInDate',e.target.value)}/>
            </div>
            <div className="field">
              <label className="field-label">Check-out date</label>
              <input className="field-input gold" type="date" value={form.checkOutDate} onChange={e=>set('checkOutDate',e.target.value)}/>
            </div>
            <div className="field">
              <label className="field-label">Nights (auto)</label>
              <div className="field-input" style={{color:'#85B7EB',fontWeight:'600'}}>{nights||'—'}</div>
            </div>
            <div className="field">
              <label className="field-label">Rooms</label>
              <input className="field-input" type="number" min="1" value={form.rooms} onChange={e=>set('rooms',e.target.value)}/>
            </div>
          </div>
        </div>

        <div className="card-section-label">CHANNEL & TARIFF</div>
        <div className="card">
          <div className="field">
            <label className="field-label">Booking channel</label>
            <select className="field-input" value={form.channel} onChange={e=>set('channel',e.target.value)}>
              {CHANNELS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="field-label">Tariff / night (₹)</label>
              <input className="field-input gold" type="number" placeholder="0"
                value={form.tariffPerNight} onChange={e=>set('tariffPerNight',e.target.value)}/>
            </div>
            <div className="field">
              <label className="field-label">Extra charges (₹)</label>
              <input className="field-input" type="number" placeholder="0"
                value={form.extraCharges} onChange={e=>set('extraCharges',e.target.value)}/>
            </div>
          </div>
        </div>

        <div className="card-section-label">REVENUE SUMMARY</div>
        <div className="net-box">
          <div className="net-row"><span className="net-label">Gross ({nights} nights × {fmt(tariff)})</span><span className="net-val pos">{fmt(gross)}</span></div>
          <div className="net-row"><span className="net-label">Channel commission ({commPct}%)</span><span className="net-val neg">−{fmt(commAmt)}</span></div>
          <div className="net-divider"/>
          <div className="net-row">
            <span style={{color:'#EDF2F7',fontWeight:'600',fontSize:'1rem'}}>Net to owner</span>
            <span className="net-val big">{fmt(net)}</span>
          </div>
        </div>

        <div className="card">
          <div className="field" style={{marginBottom:0}}>
            <label className="field-label">Notes (optional)</label>
            <textarea className="field-input" placeholder="Any notes..." value={form.notes} onChange={e=>set('notes',e.target.value)}/>
          </div>
        </div>

        <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
          {saving?'Saving...':'Save booking record →'}
        </button>
        <p className="btn-email-note">📧 Email notification sent to owner on save</p>
      </div>
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
