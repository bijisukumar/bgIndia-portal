import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const TODAY=new Date().toISOString().split('T')[0]
function fmt(n){return isNaN(n)||n===''?'—':`₹${Number(n).toLocaleString('en-IN')}`}

export default function RubberTracker() {
  const navigate=useNavigate()
  const [saving,setSaving]=useState(false)
  const [toast,setToast]=useState(null)
  const [form,setForm]=useState({
    tappingDate:TODAY,paymentDate:'',tapperName:'',
    latexKg:'',pricePerKg:'',rejectionKg:'0',rejectionRevenue:'0',
    tapperWages:'',transport:'',otherCharges:'',notes:''
  })
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const showToast=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000)}

  const latexKg=parseFloat(form.latexKg)||0
  const pricePerKg=parseFloat(form.pricePerKg)||0
  const rejKg=parseFloat(form.rejectionKg)||0
  const netKg=Math.max(0,latexKg-rejKg)
  const totalAmount=netKg*pricePerKg
  const rejRevenue=parseFloat(form.rejectionRevenue)||0
  const tapperWages=parseFloat(form.tapperWages)||0
  const transport=parseFloat(form.transport)||0
  const otherCharges=parseFloat(form.otherCharges)||0
  const totalExpenses=tapperWages+transport+otherCharges
  const netIncome=totalAmount+rejRevenue-totalExpenses

  const handleSave=async()=>{
    if(!form.tappingDate||!form.latexKg||!form.pricePerKg){
      showToast('Fill tapping date, latex kg and price','error');return
    }
    setSaving(true)
    try {
      await api.saveRubberHarvest({...form,netKg,totalAmount,totalExpenses,netIncome,estate:'pavutumuri'})
      showToast('Harvest record saved ✓')
      setTimeout(()=>navigate(-1),1500)
    } catch { showToast('Failed to save','error') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div><div className="topbar-title">Rubber tracker</div><div className="topbar-sub">PAVUTUMURI ESTATE · HARVEST LOG</div></div>
      </div>
      <div className="screen-body">
        <div className="card-section-label">TAPPING DETAILS</div>
        <div className="card">
          <div className="grid-2">
            <div className="field"><label className="field-label">Tapping date</label>
              <input className="field-input gold" type="date" value={form.tappingDate} onChange={e=>set('tappingDate',e.target.value)}/></div>
            <div className="field"><label className="field-label">Payment date</label>
              <input className="field-input gold" type="date" value={form.paymentDate} onChange={e=>set('paymentDate',e.target.value)}/></div>
          </div>
          <div className="field"><label className="field-label">Tapper name</label>
            <input className="field-input" placeholder="e.g. Rajan" value={form.tapperName} onChange={e=>set('tapperName',e.target.value)}/></div>
          <div className="grid-2">
            <div className="field"><label className="field-label">Latex collected (kg)</label>
              <input className="field-input gold" type="number" placeholder="0" value={form.latexKg} onChange={e=>set('latexKg',e.target.value)}/></div>
            <div className="field"><label className="field-label">Rejection (kg)</label>
              <input className="field-input" type="number" placeholder="0" style={{color:'#EF9A9A'}} value={form.rejectionKg} onChange={e=>set('rejectionKg',e.target.value)}/></div>
            <div className="field"><label className="field-label">Net kg (billable)</label>
              <div className="field-input" style={{color:'#85B7EB',fontWeight:'600'}}>{netKg.toLocaleString('en-IN')}</div></div>
            <div className="field"><label className="field-label">Price / kg (₹)</label>
              <input className="field-input gold" type="number" placeholder="0" value={form.pricePerKg} onChange={e=>set('pricePerKg',e.target.value)}/></div>
            <div className="field"><label className="field-label">Total amount</label>
              <div className="field-input" style={{color:'var(--green)',fontWeight:'700'}}>{fmt(totalAmount)}</div></div>
            <div className="field"><label className="field-label">Rejection revenue (₹)</label>
              <input className="field-input" type="number" placeholder="0" style={{color:'var(--green)'}} value={form.rejectionRevenue} onChange={e=>set('rejectionRevenue',e.target.value)}/></div>
          </div>
        </div>

        <div className="card-section-label">EXPENSES</div>
        <div className="card">
          <div className="grid-2">
            <div className="field"><label className="field-label">Tapper wages (₹)</label>
              <input className="field-input" type="number" placeholder="0" value={form.tapperWages} onChange={e=>set('tapperWages',e.target.value)}/></div>
            <div className="field"><label className="field-label">Transportation (₹)</label>
              <input className="field-input" type="number" placeholder="0" value={form.transport} onChange={e=>set('transport',e.target.value)}/></div>
            <div className="field"><label className="field-label">Other charges (₹)</label>
              <input className="field-input" type="number" placeholder="0" value={form.otherCharges} onChange={e=>set('otherCharges',e.target.value)}/></div>
          </div>
        </div>

        <div className="card-section-label">NET HARVEST INCOME</div>
        <div className="net-box">
          <div className="net-row"><span className="net-label">Total amount</span><span className="net-val pos">{fmt(totalAmount)}</span></div>
          {rejRevenue>0&&<div className="net-row"><span className="net-label">Rejection revenue</span><span className="net-val pos">+{fmt(rejRevenue)}</span></div>}
          {tapperWages>0&&<div className="net-row"><span className="net-label">Tapper wages</span><span className="net-val neg">−{fmt(tapperWages)}</span></div>}
          {transport>0&&<div className="net-row"><span className="net-label">Transportation</span><span className="net-val neg">−{fmt(transport)}</span></div>}
          {otherCharges>0&&<div className="net-row"><span className="net-label">Other charges</span><span className="net-val neg">−{fmt(otherCharges)}</span></div>}
          <div className="net-divider"/>
          <div className="net-row">
            <span style={{color:'#EDF2F7',fontWeight:'600',fontSize:'1rem'}}>Net income</span>
            <span className={`net-val big${netIncome<0?' neg':''}`}>{fmt(netIncome)}</span>
          </div>
        </div>

        <button className="btn btn-teal" onClick={handleSave} disabled={saving}>
          {saving?'Saving...':'Save harvest record →'}
        </button>
        <p className="btn-email-note">📧 Email notification sent to owner on save</p>
      </div>
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
