import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

const TODAY=new Date().toISOString().split('T')[0]
const INCOME_CATS=['Harvest sale','Lease income','Govt subsidy','Other income']
const EXPENSE_CATS=['Labour wages','Fertilizer','Pesticide','Equipment','Irrigation','Land tax','Transport','Maintenance','Other expense']
function fmt(n){return isNaN(n)||n===''?'—':`₹${Number(n).toLocaleString('en-IN')}`}

export default function EstateLedger({ estate }) {
  const navigate=useNavigate()
  const [type,setType]=useState('income')
  const [saving,setSaving]=useState(false)
  const [toast,setToast]=useState(null)
  const [form,setForm]=useState({date:TODAY,category:'',amount:'',description:'',paidTo:''})
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const showToast=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000)}
  const cats=type==='income'?INCOME_CATS:EXPENSE_CATS
  const estateLabel=estate==='pollachi'?'Pollachi Estate':'Pavutumuri Estate'

  const handleSave=async()=>{
    if(!form.date||!form.category||!form.amount){
      showToast('Fill date, category and amount','error');return
    }
    setSaving(true)
    try {
      await api.saveEstateTransaction({...form,type,estate})
      showToast('Transaction saved ✓')
      setForm({date:TODAY,category:'',amount:'',description:'',paidTo:''})
    } catch { showToast('Failed to save','error') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div><div className="topbar-title">Income / Expense</div><div className="topbar-sub">{estateLabel.toUpperCase()}</div></div>
      </div>
      <div className="screen-body">
        <div style={styles.toggle}>
          <button style={{...styles.toggleBtn,...( type==='income'?styles.toggleActive:{})}} onClick={()=>{setType('income');set('category','')}}>
            💰 Income
          </button>
          <button style={{...styles.toggleBtn,...(type==='expense'?{...styles.toggleActive,background:'var(--red)'}:{})}} onClick={()=>{setType('expense');set('category','')}}>
            💸 Expense
          </button>
        </div>

        <div className="card-section-label">TRANSACTION DETAILS</div>
        <div className="card">
          <div className="grid-2">
            <div className="field"><label className="field-label">Date</label>
              <input className="field-input gold" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
            <div className="field"><label className="field-label">Amount (₹)</label>
              <input className="field-input" type="number" placeholder="0"
                style={{color:type==='income'?'var(--green)':'var(--red)',fontWeight:'600'}}
                value={form.amount} onChange={e=>set('amount',e.target.value)}/></div>
          </div>
          <div className="field"><label className="field-label">Category</label>
            <select className="field-input" value={form.category} onChange={e=>set('category',e.target.value)}>
              <option value="">Select category...</option>
              {cats.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label className="field-label">{type==='expense'?'Paid to':'Received from'}</label>
            <input className="field-input" placeholder="Name or party" value={form.paidTo} onChange={e=>set('paidTo',e.target.value)}/></div>
          <div className="field" style={{marginBottom:0}}><label className="field-label">Description</label>
            <textarea className="field-input" placeholder="Details..." value={form.description} onChange={e=>set('description',e.target.value)}/></div>
        </div>

        <button className={`btn ${type==='income'?'btn-green':'btn-gold'}`} onClick={handleSave} disabled={saving}>
          {saving?'Saving...':`Save ${type} entry →`}
        </button>
        <p className="btn-email-note">📧 Email notification sent to owner on save</p>
      </div>
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
const styles={
  toggle:{display:'flex',gap:'8px',marginBottom:'16px'},
  toggleBtn:{flex:1,padding:'11px',borderRadius:'10px',border:'1px solid var(--border-dim)',background:'var(--dark-card)',color:'var(--text-muted)',fontSize:'0.9rem',fontWeight:'600',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all 0.15s'},
  toggleActive:{background:'var(--green)',color:'#fff',border:'1px solid var(--green)'},
}
