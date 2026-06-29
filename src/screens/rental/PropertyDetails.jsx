// ============================================================
//  PropertyDetails.jsx — 2-tab: Edit Existing | Add New
//  HOA and Tax use history tables (line items per change/year)
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import PropertyDocs from './PropertyDocs'
import { usePropertyList } from './usePropertyList'
import { parseLocalDate, localTodayStr } from '../../utils/dates'

const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
function fromDB(row) {
  if (!row) return {}
  const out = {}
  Object.entries(row).forEach(([k,v]) => { out[toCamel(k)] = v ?? '' })
  return out
}
function fmtAmt(n, cur='INR') {
  if (!n && n!==0) return '—'
  return cur==='USD' ? '$'+Number(n).toLocaleString('en-US') : '₹'+Number(n).toLocaleString('en-IN')
}
function fmtDate(d) {
  if (!d) return '—'
  try { return parseLocalDate(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) }
  catch { return d }
}

const NUMERIC_FIELDS = [
  'elecMonthlyAvg','waterMonthlyAvg','gasMonthlyAvg','internetMonthly',
  'otherUtilityMonthly','loanOriginal','loanOutstanding','loanMonthlyEmi',
  'loanInterestRate','purchasePrice','estimatedValue','insuranceAnnual',
]

const GROUPS = [
  { key:'address', label:'Property address', icon:'📍', fields:[
    {key:'addressLine1',  label:'Address line 1', placeholder:'123 Main Street', span:2},
    {key:'addressLine2',  label:'Address line 2', placeholder:'Apt / Unit',      span:2},
    {key:'city',          label:'City',           placeholder:'Randolph'},
    {key:'stateProvince', label:'State / Province',placeholder:'Texas'},
    {key:'postalCode',    label:'Postal code',    placeholder:'75080'},
    {key:'country',       label:'Country',        type:'select',
     options:[{value:'IN',label:'India'},{value:'US',label:'USA'}]},
  ]},
  { key:'electricity', label:'Electricity', icon:'⚡', fields:[
    {key:'elecProvider',      label:'Provider name',  placeholder:'Oncor, BWSSB…', span:2},
    {key:'elecConsumerId',    label:'Consumer ID',    placeholder:'Meter number',  mono:true},
    {key:'elecAccountNumber', label:'Account number', placeholder:'Account',       mono:true},
    {key:'elecPortalUrl',     label:'Portal URL',     placeholder:'https://…',     span:2},
    {key:'elecMonthlyAvg',    label:'Monthly avg',    type:'number', amtKey:true},
  ]},
  { key:'water', label:'Water', icon:'💧', fields:[
    {key:'waterProvider',      label:'Provider name',  placeholder:'City water…', span:2},
    {key:'waterConsumerId',    label:'Consumer ID',    placeholder:'Consumer number', mono:true},
    {key:'waterAccountNumber', label:'Account number', placeholder:'Account',         mono:true},
    {key:'waterPortalUrl',     label:'Portal URL',     placeholder:'https://…',       span:2},
    {key:'waterMonthlyAvg',    label:'Monthly avg',    type:'number', amtKey:true},
  ]},
  { key:'gas', label:'Gas', icon:'🔥', fields:[
    {key:'gasProvider',      label:'Provider name',  placeholder:'Atmos, Mahanagar…', span:2},
    {key:'gasConsumerId',    label:'Consumer ID',    placeholder:'Consumer number',    mono:true},
    {key:'gasAccountNumber', label:'Account number', placeholder:'Account',            mono:true},
    {key:'gasPortalUrl',     label:'Portal URL',     placeholder:'https://…',          span:2},
    {key:'gasMonthlyAvg',    label:'Monthly avg',    type:'number', amtKey:true},
  ]},
  { key:'internet', label:'Internet', icon:'🌐', fields:[
    {key:'internetProvider', label:'Provider name',  placeholder:'AT&T, Airtel…'},
    {key:'internetAccount',  label:'Account number', placeholder:'Account',  mono:true},
    {key:'internetMonthly',  label:'Monthly',        type:'number', amtKey:true},
  ]},
  { key:'other', label:'Other utility', icon:'🗑️', fields:[
    {key:'otherUtilityName',    label:'Utility name', placeholder:'Trash, sewage…'},
    {key:'otherUtilityId',      label:'ID / Account', placeholder:'Account', mono:true},
    {key:'otherUtilityMonthly', label:'Monthly',      type:'number', amtKey:true},
  ]},
  { key:'loan', label:'Loan / Mortgage', icon:'🏦', fields:[
    {key:'loanLender',      label:'Lender / Bank',     placeholder:'Chase, HDFC…'},
    {key:'loanAccount',     label:'Loan account',      placeholder:'Account number', mono:true},
    {key:'loanOriginal',    label:'Original loan',     type:'number', amtKey:true},
    {key:'loanOutstanding', label:'Outstanding balance',type:'number', amtKey:true},
    {key:'loanMonthlyEmi',  label:'Monthly EMI',       type:'number', amtKey:true},
    {key:'loanInterestRate',label:'Interest rate (%)', type:'number', placeholder:'6.5'},
    {key:'loanStartDate',   label:'Loan start date',   type:'date'},
    {key:'loanEndDate',     label:'Loan end date',     type:'date'},
    {key:'loanPortalUrl',   label:'Lender portal URL', placeholder:'https://…', span:2},
  ]},
  { key:'value', label:'Property value', icon:'📈', fields:[
    {key:'purchasePrice',      label:'Purchase price',          type:'number', amtKey:true},
    {key:'purchaseDate',       label:'Purchase date',           type:'date'},
    {key:'estimatedValue',     label:'Current estimated value', type:'number', amtKey:true},
    {key:'estimatedValueDate', label:'Valuation date',          type:'date'},
  ]},
  { key:'insurance', label:'Insurance', icon:'🛡️', fields:[
    {key:'insuranceProvider', label:'Provider',      placeholder:'State Farm, LIC…'},
    {key:'insurancePolicyNo', label:'Policy number', placeholder:'Policy number', mono:true},
    {key:'insuranceAnnual',   label:'Annual premium',type:'number', amtKey:true},
    {key:'insuranceExpiry',   label:'Policy expiry', type:'date'},
  ]},
  { key:'notes', label:'Notes', icon:'📝', fields:[
    {key:'notes', label:'Notes', type:'textarea', span:2, placeholder:'HOA rules, parking, key box, repair contacts…'},
  ]},
]

// ── simple field input ────────────────────────────────────────
function FI({ f, value, onChange, currency }) {
  const cur = currency==='USD'?'$':'₹'
  const base = {width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',
    background:'var(--dark-input)',border:'1px solid var(--border-dim)',
    color: f.amtKey?(currency==='USD'?'#85B7EB':'#C8903A'):'var(--text)',
    fontSize:f.mono?'0.82rem':'0.9rem', fontFamily:f.mono?'monospace':'inherit'}
  const lbl = (f.amtKey ? `${f.label} (${cur})` : f.label).toUpperCase()
  return (
    <div style={{gridColumn:f.span===2?'span 2':undefined}}>
      <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>{lbl}</label>
      {f.type==='select' ? (
        <select value={value||''} onChange={e=>onChange(e.target.value)} style={base}>
          {f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : f.type==='textarea' ? (
        <textarea value={value||''} onChange={e=>onChange(e.target.value)} placeholder={f.placeholder||''} rows={3} style={{...base,resize:'vertical'}}/>
      ) : (
        <input type={f.type||'text'} value={value||''} onChange={e=>onChange(e.target.value)} placeholder={f.placeholder||''} style={base}/>
      )}
    </div>
  )
}

// ── generic collapsible group ─────────────────────────────────
function GroupCard({ group, form, onChange, currency, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen||false)
  const filled = group.fields.filter(f=>form[f.key]&&String(form[f.key]).trim()).length
  return (
    <div style={{border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',marginBottom:'8px',overflow:'hidden'}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 14px',cursor:'pointer',userSelect:'none',background:open?'rgba(24,95,165,0.08)':'var(--dark-card)'}}>
        <span style={{fontSize:'1.1rem'}}>{group.icon}</span>
        <span style={{fontWeight:'600',fontSize:'0.88rem',color:open?'#85B7EB':'var(--text)',flex:1}}>{group.label}</span>
        {filled>0&&!open&&<span style={{fontSize:'0.68rem',color:'#34A853',background:'rgba(52,168,83,0.12)',padding:'2px 8px',borderRadius:'10px',fontWeight:'600'}}>{filled}/{group.fields.length}</span>}
        <span style={{color:'#5C7080',fontSize:'0.9rem'}}>{open?'∧':'∨'}</span>
      </div>
      {open&&(
        <div style={{padding:'14px',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
            {group.fields.map(f=><FI key={f.key} f={f} value={form[f.key]} currency={currency} onChange={v=>onChange(f.key,v)}/>)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── HOA history section ───────────────────────────────────────
function HoaSection({ propId, currency }) {
  const [open, setOpen]     = useState(false)
  const [history, setHistory] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]     = useState({ effectiveDate:'', monthlyAmount:'', notes:'' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const cur = currency==='USD'?'$':'₹'

  useEffect(() => { if (open) load() }, [open, propId])

  async function load() {
    try { const d = await api.getHoaHistory(propId); setHistory(Array.isArray(d)?d:[]) }
    catch(e) { setHistory([]) }
  }

  async function handleSave() {
    if (!form.effectiveDate || !form.monthlyAmount) return
    setSaving(true)
    try {
      await api.saveHoaEntry({ id:editId||null, propId, effectiveDate:form.effectiveDate, monthlyAmount:parseFloat(form.monthlyAmount)||0, currency, notes:form.notes })
      setShowForm(false); setEditId(null); setForm({effectiveDate:'',monthlyAmount:'',notes:''})
      load()
    } catch(e) {}
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this HOA entry?')) return
    await api.deleteHoaEntry({ id }); load()
  }

  const latest = history[0]

  return (
    <div style={{border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',marginBottom:'8px',overflow:'hidden'}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 14px',cursor:'pointer',userSelect:'none',background:open?'rgba(24,95,165,0.08)':'var(--dark-card)'}}>
        <span style={{fontSize:'1.1rem'}}>🏘️</span>
        <span style={{fontWeight:'600',fontSize:'0.88rem',color:open?'#85B7EB':'var(--text)',flex:1}}>HOA</span>
        {latest&&!open&&(
          <span style={{fontSize:'0.72rem',color:'#F59E0B'}}>
            {cur}{latest.monthly_amount}/mo · since {fmtDate(latest.effective_date)}
          </span>
        )}
        {history.length>0&&!open&&<span style={{fontSize:'0.68rem',color:'#34A853',background:'rgba(52,168,83,0.12)',padding:'2px 8px',borderRadius:'10px',fontWeight:'600',marginLeft:'6px'}}>{history.length} entries</span>}
        <span style={{color:'#5C7080',fontSize:'0.9rem'}}>{open?'∧':'∨'}</span>
      </div>

      {open&&(
        <div style={{padding:'14px',borderTop:'1px solid rgba(255,255,255,0.06)'}}>

          {/* History list */}
          {history.length===0&&!showForm&&(
            <div style={{textAlign:'center',color:'#5C7080',fontSize:'0.82rem',padding:'12px'}}>No HOA entries yet</div>
          )}
          {history.map((h,i)=>(
            <div key={h.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',marginBottom:'6px',borderRadius:'10px',background:i===0?'rgba(245,158,11,0.06)':'rgba(255,255,255,0.02)',border:`1px solid ${i===0?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.06)'}`}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:'600',fontSize:'0.88rem',color:'#EDF2F7'}}>
                  {cur}{h.monthly_amount}<span style={{fontSize:'0.72rem',color:'#5C7080',fontWeight:'400'}}>/mo</span>
                  {i===0&&<span style={{marginLeft:'8px',fontSize:'0.65rem',color:'#F59E0B',fontWeight:'700',padding:'1px 6px',background:'rgba(245,158,11,0.15)',borderRadius:'8px'}}>CURRENT</span>}
                </div>
                <div style={{fontSize:'0.72rem',color:'#5C7080',marginTop:'2px'}}>
                  Effective: {fmtDate(h.effective_date)}{h.notes?` · ${h.notes}`:''}
                </div>
              </div>
              <div style={{display:'flex',gap:'6px'}}>
                <button onClick={()=>{setEditId(h.id);setForm({effectiveDate:h.effective_date,monthlyAmount:h.monthly_amount,notes:h.notes||''});setShowForm(true)}}
                  style={{padding:'4px 10px',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#9AA5B4',fontSize:'0.72rem',cursor:'pointer'}}>Edit</button>
                <button onClick={()=>handleDelete(h.id)}
                  style={{padding:'4px 10px',borderRadius:'8px',border:'1px solid rgba(239,68,68,0.3)',background:'transparent',color:'#EF4444',fontSize:'0.72rem',cursor:'pointer'}}>×</button>
              </div>
            </div>
          ))}

          {/* Add/edit form */}
          {showForm?(
            <div style={{background:'rgba(245,158,11,0.05)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:'10px',padding:'12px',marginTop:'8px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div>
                  <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>EFFECTIVE DATE *</label>
                  <input type="date" value={form.effectiveDate} onChange={e=>setForm(f=>({...f,effectiveDate:e.target.value}))}
                    style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>MONTHLY AMOUNT ({cur}) *</label>
                  <input type="number" value={form.monthlyAmount} onChange={e=>setForm(f=>({...f,monthlyAmount:e.target.value}))}
                    placeholder="0" style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'#F59E0B',fontSize:'0.9rem'}}/>
                </div>
                <div style={{gridColumn:'span 2'}}>
                  <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>NOTES (optional)</label>
                  <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                    placeholder="Annual increase notice, reason…"
                    style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}/>
                </div>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={()=>{setShowForm(false);setEditId(null);setForm({effectiveDate:'',monthlyAmount:'',notes:''})}}
                  style={{flex:1,padding:'9px',borderRadius:'9px',border:'1px solid var(--border-dim)',background:'transparent',color:'var(--text-dim)',cursor:'pointer'}}>Cancel</button>
                <button onClick={handleSave} disabled={saving||!form.effectiveDate||!form.monthlyAmount}
                  style={{flex:2,padding:'9px',borderRadius:'9px',border:'none',background:'#F59E0B',color:'#111',fontWeight:'700',cursor:'pointer',opacity:saving?0.6:1}}>
                  {saving?'Saving…':editId?'Update':'Add entry'}
                </button>
              </div>
            </div>
          ):(
            <button onClick={()=>{setEditId(null);setForm({effectiveDate:localTodayStr(),monthlyAmount:'',notes:''});setShowForm(true)}}
              style={{width:'100%',padding:'9px',borderRadius:'9px',border:'1px dashed rgba(245,158,11,0.3)',background:'transparent',color:'#F59E0B',fontSize:'0.82rem',cursor:'pointer',marginTop:'8px'}}>
              + Add HOA rate change
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tax history section ───────────────────────────────────────
function TaxSection({ propId, currency }) {
  const [open, setOpen]       = useState(false)
  const [history, setHistory] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState({ taxYear:new Date().getFullYear(), annualAmount:'', parcelId:'', taxAuthority:'', dueDate:'', paidDate:'', paidAmount:'', receiptRef:'', notes:'' })
  const [editId, setEditId]   = useState(null)
  const [saving, setSaving]   = useState(false)
  const cur = currency==='USD'?'$':'₹'

  useEffect(() => { if (open) load() }, [open, propId])

  async function load() {
    try { const d = await api.getTaxHistory(propId); setHistory(Array.isArray(d)?d:[]) }
    catch(e) { setHistory([]) }
  }

  async function handleSave() {
    if (!form.taxYear || !form.annualAmount) return
    setSaving(true)
    try {
      await api.saveTaxEntry({ id:editId||null, propId, taxYear:form.taxYear, annualAmount:parseFloat(form.annualAmount)||0, currency, parcelId:form.parcelId||null, taxAuthority:form.taxAuthority||null, dueDate:form.dueDate||null, paidDate:form.paidDate||null, paidAmount:parseFloat(form.paidAmount)||0, receiptRef:form.receiptRef||null, notes:form.notes||null })
      setShowForm(false); setEditId(null)
      setForm({taxYear:new Date().getFullYear(),annualAmount:'',parcelId:'',taxAuthority:'',dueDate:'',paidDate:'',paidAmount:'',receiptRef:'',notes:''})
      load()
    } catch(e) {}
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this tax entry?')) return
    await api.deleteTaxEntry({ id }); load()
  }

  const thisYear = new Date().getFullYear()
  const currentYear = history.find(h=>h.tax_year===thisYear) || history[0]

  const SF = {width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}
  const SL = {display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}

  return (
    <div style={{border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',marginBottom:'8px',overflow:'hidden'}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 14px',cursor:'pointer',userSelect:'none',background:open?'rgba(24,95,165,0.08)':'var(--dark-card)'}}>
        <span style={{fontSize:'1.1rem'}}>🏛️</span>
        <span style={{fontWeight:'600',fontSize:'0.88rem',color:open?'#85B7EB':'var(--text)',flex:1}}>Property tax</span>
        {currentYear&&!open&&(
          <span style={{fontSize:'0.72rem',color:'#5C7080'}}>
            {thisYear}: {cur}{currentYear.annual_amount}
            {currentYear.paid_date&&<span style={{color:'#34A853',marginLeft:'6px'}}>✓ paid</span>}
            {!currentYear.paid_date&&<span style={{color:'#F59E0B',marginLeft:'6px'}}>· unpaid</span>}
          </span>
        )}
        {history.length>0&&!open&&<span style={{fontSize:'0.68rem',color:'#34A853',background:'rgba(52,168,83,0.12)',padding:'2px 8px',borderRadius:'10px',fontWeight:'600',marginLeft:'6px'}}>{history.length} yrs</span>}
        <span style={{color:'#5C7080',fontSize:'0.9rem'}}>{open?'∧':'∨'}</span>
      </div>

      {open&&(
        <div style={{padding:'14px',borderTop:'1px solid rgba(255,255,255,0.06)'}}>

          {history.length===0&&!showForm&&(
            <div style={{textAlign:'center',color:'#5C7080',fontSize:'0.82rem',padding:'12px'}}>No tax records yet</div>
          )}

          {/* Year history table */}
          {history.length>0&&(
            <div style={{marginBottom:'10px'}}>
              <div style={{display:'grid',gridTemplateColumns:'60px 1fr 80px 70px 60px',gap:'4px',padding:'6px 8px',fontSize:'0.65rem',color:'#5C7080',letterSpacing:'1px',borderBottom:'1px solid rgba(255,255,255,0.06)',marginBottom:'4px'}}>
                <span>YEAR</span><span>AMOUNT</span><span>DUE DATE</span><span>PAID</span><span></span>
              </div>
              {history.map((h,i)=>(
                <div key={h.id} style={{display:'grid',gridTemplateColumns:'60px 1fr 80px 70px 60px',gap:'4px',padding:'8px',marginBottom:'4px',borderRadius:'8px',alignItems:'center',background:h.tax_year===thisYear?'rgba(24,95,165,0.08)':'rgba(255,255,255,0.02)',border:`1px solid ${h.tax_year===thisYear?'rgba(24,95,165,0.2)':'rgba(255,255,255,0.05)'}`}}>
                  <div style={{fontWeight:'700',fontSize:'0.85rem',color:h.tax_year===thisYear?'#85B7EB':'#EDF2F7'}}>{h.tax_year}</div>
                  <div>
                    <div style={{fontWeight:'600',fontSize:'0.85rem'}}>{cur}{h.annual_amount}</div>
                    {h.tax_authority&&<div style={{fontSize:'0.68rem',color:'#5C7080'}}>{h.tax_authority}</div>}
                  </div>
                  <div style={{fontSize:'0.72rem',color:'#5C7080'}}>{h.due_date?fmtDate(h.due_date):'—'}</div>
                  <div>
                    {h.paid_date
                      ? <span style={{fontSize:'0.72rem',color:'#34A853',fontWeight:'600'}}>✓ {fmtDate(h.paid_date)}</span>
                      : <span style={{fontSize:'0.72rem',color:'#F59E0B'}}>Unpaid</span>}
                  </div>
                  <div style={{display:'flex',gap:'4px',justifyContent:'flex-end'}}>
                    <button onClick={()=>{setEditId(h.id);setForm({taxYear:h.tax_year,annualAmount:h.annual_amount,parcelId:h.parcel_id||'',taxAuthority:h.tax_authority||'',dueDate:h.due_date||'',paidDate:h.paid_date||'',paidAmount:h.paid_amount||'',receiptRef:h.receipt_ref||'',notes:h.notes||''});setShowForm(true)}}
                      style={{padding:'3px 8px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#9AA5B4',fontSize:'0.68rem',cursor:'pointer'}}>✏️</button>
                    <button onClick={()=>handleDelete(h.id)}
                      style={{padding:'3px 8px',borderRadius:'6px',border:'1px solid rgba(239,68,68,0.3)',background:'transparent',color:'#EF4444',fontSize:'0.68rem',cursor:'pointer'}}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/edit form */}
          {showForm?(
            <div style={{background:'rgba(24,95,165,0.05)',border:'1px solid rgba(24,95,165,0.2)',borderRadius:'10px',padding:'14px',marginTop:'8px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                <div>
                  <label style={SL}>TAX YEAR *</label>
                  <input type="number" value={form.taxYear} onChange={e=>setForm(f=>({...f,taxYear:parseInt(e.target.value)}))}
                    placeholder="2024" style={SF}/>
                </div>
                <div>
                  <label style={SL}>ANNUAL TAX ({cur}) *</label>
                  <input type="number" value={form.annualAmount} onChange={e=>setForm(f=>({...f,annualAmount:e.target.value}))}
                    placeholder="0" style={{...SF,color:currency==='USD'?'#85B7EB':'#C8903A'}}/>
                </div>
                <div>
                  <label style={SL}>PARCEL ID</label>
                  <input value={form.parcelId} onChange={e=>setForm(f=>({...f,parcelId:e.target.value}))}
                    placeholder="Tax parcel number" style={{...SF,fontFamily:'monospace',fontSize:'0.82rem'}}/>
                </div>
                <div>
                  <label style={SL}>TAX AUTHORITY</label>
                  <input value={form.taxAuthority} onChange={e=>setForm(f=>({...f,taxAuthority:e.target.value}))}
                    placeholder="County / municipality" style={SF}/>
                </div>
                <div>
                  <label style={SL}>DUE DATE</label>
                  <input type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} style={SF}/>
                </div>
                <div>
                  <label style={SL}>PAID DATE</label>
                  <input type="date" value={form.paidDate} onChange={e=>setForm(f=>({...f,paidDate:e.target.value}))} style={SF}/>
                </div>
                <div>
                  <label style={SL}>AMOUNT PAID ({cur})</label>
                  <input type="number" value={form.paidAmount} onChange={e=>setForm(f=>({...f,paidAmount:e.target.value}))}
                    placeholder="0" style={{...SF,color:'#34A853'}}/>
                </div>
                <div>
                  <label style={SL}>RECEIPT / REF NO</label>
                  <input value={form.receiptRef} onChange={e=>setForm(f=>({...f,receiptRef:e.target.value}))}
                    placeholder="Confirmation number" style={{...SF,fontFamily:'monospace',fontSize:'0.82rem'}}/>
                </div>
                <div style={{gridColumn:'span 2'}}>
                  <label style={SL}>NOTES</label>
                  <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                    placeholder="Reassessment, appeal, exemption…" style={SF}/>
                </div>
              </div>
              <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
                <button onClick={()=>{setShowForm(false);setEditId(null)}}
                  style={{flex:1,padding:'9px',borderRadius:'9px',border:'1px solid var(--border-dim)',background:'transparent',color:'var(--text-dim)',cursor:'pointer'}}>Cancel</button>
                <button onClick={handleSave} disabled={saving||!form.taxYear||!form.annualAmount}
                  style={{flex:2,padding:'9px',borderRadius:'9px',border:'none',background:'#185FA5',color:'#fff',fontWeight:'700',cursor:'pointer',opacity:saving?0.6:1}}>
                  {saving?'Saving…':editId?'Update year':'Add tax year'}
                </button>
              </div>
            </div>
          ):(
            <button onClick={()=>{setEditId(null);setShowForm(true)}}
              style={{width:'100%',padding:'9px',borderRadius:'9px',border:'1px dashed rgba(24,95,165,0.3)',background:'transparent',color:'#85B7EB',fontSize:'0.82rem',cursor:'pointer',marginTop:'8px'}}>
              + Add tax year
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────
export default function PropertyDetails() {
  const navigate = useNavigate()
  const { properties, reload: reloadProperties } = usePropertyList()
  const [tab, setTab] = useState('edit')
  const [selectedProp, setSelectedProp] = useState(null)
  const [form, setForm] = useState({})
  const [currency, setCurrency] = useState('INR')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState(null)
  const [newProp, setNewProp] = useState({ name:'', location:'', country:'IN', currency:'INR' })
  const [addForm, setAddForm] = useState({})
  const [addSaving, setAddSaving] = useState(false)
  const [addDone, setAddDone] = useState(false)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }
  const setField = (k,v) => { setForm(f=>({...f,[k]:v})); setDirty(true) }
  const setAddField = (k,v) => setAddForm(f=>({...f,[k]:v}))

  useEffect(() => {
    if (!selectedProp && properties.length > 0) setSelectedProp(properties[0].id)
  }, [properties, selectedProp])

  useEffect(() => { if (selectedProp) loadDetails(selectedProp) }, [selectedProp])

  async function loadDetails(propId) {
    setDirty(false)
    try {
      const d = await api.getPropertyDetails(propId)
      const data = fromDB(d)
      setForm(data)
      setCurrency(data.currency || 'INR')
    } catch(e) { setForm({}) }
  }

  function buildPayload(f, propId, cur) {
    const payload = { propId, currency: cur }
    GROUPS.forEach(g => g.fields.forEach(f2 => {
      const val = f[f2.key]
      payload[f2.key] = NUMERIC_FIELDS.includes(f2.key) ? (parseFloat(val)||0) : (val||null)
    }))
    return payload
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.savePropertyDetails(buildPayload(form, selectedProp, currency))
      setDirty(false)
      showToast(`✅ Saved — ${properties.find(p=>p.id===selectedProp)?.name}`)
    } catch(e) { showToast('Save failed: '+e.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleAddNew() {
    if (!newProp.name.trim()) { showToast('Name required', 'error'); return }
    setAddSaving(true)
    try {
      const id = 'rental_' + Date.now()
      await api.saveRentalAgreement({ propId:id, propName:newProp.name.trim(), location:newProp.location.trim(), country:newProp.country, currency:newProp.currency, tenantName:'', deposit:0, agreedRent:0, maintenance:0, leaseStart:'', leaseEnd:'', notes:'' })
      await api.savePropertyDetails(buildPayload(addForm, id, newProp.currency))
      await reloadProperties()
      setAddDone(true)
      showToast(`✅ ${newProp.name} added`)
      setTimeout(() => { setSelectedProp(id); setTab('edit'); setAddDone(false); setNewProp({name:'',location:'',country:'IN',currency:'INR'}); setAddForm({}) }, 1500)
    } catch(e) { showToast('Add failed: '+e.message, 'error') }
    finally { setAddSaving(false) }
  }

  const prop = properties.find(p=>p.id===selectedProp)
  const equity = (parseFloat(form.estimatedValue)||0) - (parseFloat(form.loanOutstanding)||0)
  const monthlyFixed = ['elecMonthlyAvg','waterMonthlyAvg','gasMonthlyAvg','internetMonthly','otherUtilityMonthly','loanMonthlyEmi']
    .reduce((s,k)=>s+(parseFloat(form[k])||0),0) + (parseFloat(form.insuranceAnnual)||0)/12

  const tabBtn = (t, label) => ({flex:1,padding:'11px',border:'none',cursor:'pointer',fontWeight:'600',fontSize:'0.82rem',textAlign:'center',background:tab===t?'rgba(24,95,165,0.15)':'transparent',color:tab===t?'#85B7EB':'#5C7080',borderBottom:tab===t?'2px solid #185FA5':'2px solid transparent'})

  const INP = {width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}
  const LBL = {display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Property details</div>
          <div className="topbar-sub">UTILITIES · LOAN · TAX · INSURANCE</div>
        </div>
        {tab==='edit'&&dirty&&(
          <button onClick={handleSave} disabled={saving}
            style={{padding:'6px 14px',borderRadius:'8px',border:'none',background:'#34A853',color:'#fff',fontWeight:'700',fontSize:'0.78rem',cursor:'pointer'}}>
            {saving?'…':'Save'}
          </button>
        )}
      </div>

      <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'#111'}}>
        <button style={tabBtn('edit')} onClick={()=>setTab('edit')}>✏️ Edit existing</button>
        <button style={tabBtn('add')} onClick={()=>setTab('add')}>＋ Add new</button>
      </div>

      {tab==='edit'&&(
        <div className="screen-body">
          {/* Property picker */}
          <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap'}}>
            {properties.map(p=>(
              <button key={p.id} onClick={()=>setSelectedProp(p.id)} style={{flex:1,minWidth:'70px',padding:'10px 6px',borderRadius:'10px',cursor:'pointer',textAlign:'center',border:selectedProp===p.id?'2px solid #185FA5':'1px solid var(--border-dim)',background:selectedProp===p.id?'rgba(24,95,165,0.12)':'var(--dark-card)',color:'var(--text)'}}>
                <div style={{fontWeight:'700',fontSize:'0.82rem'}}>{p.name}</div>
                <div style={{fontSize:'0.65rem',color:'#5C7080',marginTop:'2px'}}>{p.location}</div>
              </button>
            ))}
          </div>

          {/* Currency toggle */}
          <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'12px'}}>
            <span style={{fontSize:'0.68rem',color:'#5C7080',letterSpacing:'1px'}}>CURRENCY</span>
            {['INR','USD'].map(c=>(
              <button key={c} onClick={()=>{setCurrency(c);setDirty(true)}} style={{padding:'4px 12px',borderRadius:'16px',cursor:'pointer',fontSize:'0.72rem',fontWeight:'600',border:`1px solid ${currency===c?'#34A853':'rgba(255,255,255,0.1)'}`,background:currency===c?'rgba(52,168,83,0.12)':'transparent',color:currency===c?'#34A853':'#5C7080'}}>
                {c==='INR'?'₹ INR':'$ USD'}
              </button>
            ))}
          </div>

          {/* KPI strip */}
          {monthlyFixed>0&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'14px'}}>
              {[{label:'MONTHLY FIXED',val:monthlyFixed,color:'#EF4444'},{label:'LOAN BALANCE',val:form.loanOutstanding,color:'#F59E0B'},{label:'EQUITY',val:equity,color:equity>=0?'#34A853':'#EF4444'}].map(k=>(
                <div key={k.label} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:'0.58rem',color:'#5C7080',letterSpacing:'1px',marginBottom:'4px'}}>{k.label}</div>
                  <div style={{fontWeight:'700',color:k.color,fontSize:'0.95rem'}}>{fmtAmt(k.val,currency)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Static sections */}
          {GROUPS.map((g,i)=>(
            <GroupCard key={g.key} group={g} form={form} onChange={setField} currency={currency} defaultOpen={i===0}/>
          ))}

          {/* History sections */}
          <HoaSection propId={selectedProp} currency={currency}/>
          <TaxSection propId={selectedProp} currency={currency}/>

          {/* Document registry */}
          <div style={{height:'8px'}}/>
          <PropertyDocs propId={selectedProp} propName={prop?.name||selectedProp}/>

          <button className="btn btn-gold" onClick={handleSave} disabled={saving} style={{marginTop:'8px'}}>
            {saving?'Saving…':`💾 Save — ${prop?.name}`}
          </button>
          <div style={{height:'20px'}}/>
        </div>
      )}

      {tab==='add'&&(
        <div className="screen-body">
          {addDone?(
            <div style={{textAlign:'center',padding:'40px',color:'#34A853',fontSize:'1rem',fontWeight:'600'}}>✅ Property added! Switching to edit view…</div>
          ):(
            <>
              <div className="card-section-label">PROPERTY IDENTITY</div>
              <div className="card" style={{marginBottom:'12px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <div style={{gridColumn:'span 2'}}>
                    <label style={LBL}>PROPERTY NAME *</label>
                    <input value={newProp.name} onChange={e=>setNewProp(p=>({...p,name:e.target.value}))} placeholder="e.g. Randolph House, Tritvam 2…" style={INP}/>
                  </div>
                  <div style={{gridColumn:'span 2'}}>
                    <label style={LBL}>LOCATION</label>
                    <input value={newProp.location} onChange={e=>setNewProp(p=>({...p,location:e.target.value}))} placeholder="e.g. Randolph, TX" style={INP}/>
                  </div>
                  <div>
                    <label style={LBL}>COUNTRY</label>
                    <select value={newProp.country} onChange={e=>setNewProp(p=>({...p,country:e.target.value,currency:e.target.value==='US'?'USD':'INR'}))} style={INP}>
                      <option value="IN">India</option><option value="US">USA</option>
                    </select>
                  </div>
                  <div>
                    <label style={LBL}>CURRENCY</label>
                    <select value={newProp.currency} onChange={e=>setNewProp(p=>({...p,currency:e.target.value}))} style={INP}>
                      <option value="INR">₹ INR</option><option value="USD">$ USD</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="card-section-label">PROPERTY DETAILS (fill what you have)</div>
              {GROUPS.map(g=>(
                <GroupCard key={g.key} group={g} form={addForm} onChange={setAddField} currency={newProp.currency} defaultOpen={g.key==='address'}/>
              ))}
              <button className="btn btn-gold" onClick={handleAddNew} disabled={addSaving||!newProp.name.trim()} style={{marginTop:'8px',opacity:!newProp.name.trim()?0.5:1}}>
                {addSaving?'Adding…':'＋ Add property'}
              </button>
              <div style={{height:'20px'}}/>
            </>
          )}
        </div>
      )}
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
