import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { CONFIG } from '../config'

const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CUR_MONTH=new Date().getMonth()
const CUR_YEAR=new Date().getFullYear()
const FIELDS=[
  {key:'rent',label:'Rent received',color:'green'},
  {key:'maintenance',label:'Maintenance fee',color:'red'},
  {key:'electricity',label:'Electricity',color:'red'},
  {key:'water',label:'Water',color:'red'},
  {key:'propertyTax',label:'Property tax',color:'red'},
  {key:'landTax',label:'Land tax',color:'red'},
  {key:'carParking',label:'Car parking',color:'green'},
  {key:'extraMaintenance',label:'Add. maintenance',color:'red'},
]
function emptyProp(){return Object.fromEntries(FIELDS.map(f=>[f.key,'0']))}
function calcNet(p){
  const inc=(parseFloat(p.rent)||0)+(parseFloat(p.carParking)||0)
  const exp=FIELDS.filter(f=>f.color==='red').reduce((s,f)=>s+(parseFloat(p[f.key])||0),0)
  return inc-exp
}
function fmt(n){if(n===undefined||n===null)return'—';const abs=Math.abs(n);const s=abs>=100000?`₹${(abs/100000).toFixed(1)}L`:abs>=1000?`₹${(abs/1000).toFixed(1)}K`:`₹${abs.toLocaleString('en-IN')}`;return n<0?`−${s}`:s}

export default function RentalProperties() {
  const navigate=useNavigate()
  const [month,setMonth]=useState(CUR_MONTH)
  const [saving,setSaving]=useState(false)
  const [toast,setToast]=useState(null)
  const [data,setData]=useState(CONFIG.rentalProperties.map(()=>emptyProp()))
  const showToast=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000)}

  const set=(pi,key,val)=>setData(d=>d.map((p,i)=>i===pi?{...p,[key]:val}:p))
  const totalNet=data.reduce((s,p)=>s+calcNet(p),0)

  const handleSave=async()=>{
    setSaving(true)
    try {
      await api.saveRentalIncome({month,year:CUR_YEAR,properties:data})
      showToast('Rental income saved ✓')
    } catch { showToast('Failed to save','error') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div><div className="topbar-title">Rental properties</div><div className="topbar-sub">MONTHLY INCOME TRACKER</div></div>
      </div>
      <div className="screen-body">
        <div className="month-strip">
          {MONTHS.map((m,i)=>(
            <button key={m} className={`month-pill${month===i?' active':''}`} onClick={()=>setMonth(i)}>{m}</button>
          ))}
        </div>

        {CONFIG.rentalProperties.map((prop,pi)=>{
          const net=calcNet(data[pi])
          return (
            <div key={prop.id}>
              <div className="card-section-label">{prop.name}{prop.location?` — ${prop.location}`:''}</div>
              <div className="card" style={{borderColor:net>=0?'rgba(52,168,83,0.15)':'rgba(229,57,53,0.15)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                  <span style={{color:'#8A9BAE',fontSize:'0.8rem'}}>Net this month</span>
                  <span style={{color:net>=0?'var(--green)':'var(--red)',fontSize:'1.1rem',fontWeight:'700'}}>{fmt(net)}</span>
                </div>
                <div className="grid-2">
                  {FIELDS.map(f=>(
                    <div className="field" key={f.key}>
                      <label className="field-label">{f.label}</label>
                      <input className="field-input" type="number" value={data[pi][f.key]}
                        style={{color:f.color==='green'?'var(--green)':parseFloat(data[pi][f.key])>0?'var(--red)':'var(--text-dim)'}}
                        onChange={e=>set(pi,f.key,e.target.value)}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}

        <div style={{background:'rgba(24,95,165,0.07)',border:'1px solid rgba(24,95,165,0.2)',borderRadius:'12px',padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
          <div>
            <div style={{color:'#8A9BAE',fontSize:'0.8rem'}}>Total net · {MONTHS[month]} {CUR_YEAR}</div>
            <div style={{color:'#5C7080',fontSize:'0.7rem',marginTop:'2px'}}>All {CONFIG.rentalProperties.length} properties</div>
          </div>
          <div style={{color:'#85B7EB',fontSize:'1.4rem',fontWeight:'800'}}>{fmt(totalNet)}</div>
        </div>

        <button className="btn btn-blue" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : `Save ${MONTHS[month]} entries →`}
        </button>
        <p className="btn-email-note">📧 Email notification sent to owner on save</p>
      </div>
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
