// ============================================================
//  PropertyDetails.jsx — 2-tab: Add New | Edit Existing
//  Route: /owner/rental/property
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'

// ── helpers ──────────────────────────────────────────────────
const toSnake = s => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

function fromDB(row) {
  if (!row) return {}
  const out = {}
  Object.entries(row).forEach(([k, v]) => { out[toCamel(k)] = v ?? '' })
  return out
}

function fmtAmt(n, cur='INR') {
  if (!n) return '—'
  return cur === 'USD'
    ? '$' + Number(n).toLocaleString('en-US')
    : '₹' + Number(n).toLocaleString('en-IN')
}

// ── field groups (drives both Add and Edit forms) ─────────────
const GROUPS = [
  {
    key: 'address', label: 'Property address', icon: '📍',
    fields: [
      { key: 'addressLine1',   label: 'Address line 1',      placeholder: '123 Main Street',    span: 2 },
      { key: 'addressLine2',   label: 'Address line 2',      placeholder: 'Apt / Unit',         span: 2 },
      { key: 'city',           label: 'City',                placeholder: 'Randolph' },
      { key: 'stateProvince',  label: 'State / Province',    placeholder: 'Texas' },
      { key: 'postalCode',     label: 'Postal code',         placeholder: '75080' },
      { key: 'country',        label: 'Country',             type: 'select',
        options: [{ value:'IN', label:'India' }, { value:'US', label:'USA' }] },
    ],
  },
  {
    key: 'electricity', label: 'Electricity', icon: '⚡',
    fields: [
      { key: 'elecProvider',       label: 'Provider name',   placeholder: 'Oncor, BWSSB…',   span: 2 },
      { key: 'elecConsumerId',     label: 'Consumer ID',     placeholder: 'Meter / consumer number', mono: true },
      { key: 'elecAccountNumber',  label: 'Account number',  placeholder: 'Account number',  mono: true },
      { key: 'elecPortalUrl',      label: 'Portal URL',      placeholder: 'https://…',       span: 2 },
      { key: 'elecMonthlyAvg',     label: 'Monthly avg',     type: 'number', amtKey: true },
    ],
  },
  {
    key: 'water', label: 'Water', icon: '💧',
    fields: [
      { key: 'waterProvider',      label: 'Provider name',   placeholder: 'City water…',     span: 2 },
      { key: 'waterConsumerId',    label: 'Consumer ID',     placeholder: 'Consumer number', mono: true },
      { key: 'waterAccountNumber', label: 'Account number',  placeholder: 'Account number',  mono: true },
      { key: 'waterPortalUrl',     label: 'Portal URL',      placeholder: 'https://…',       span: 2 },
      { key: 'waterMonthlyAvg',    label: 'Monthly avg',     type: 'number', amtKey: true },
    ],
  },
  {
    key: 'gas', label: 'Gas', icon: '🔥',
    fields: [
      { key: 'gasProvider',        label: 'Provider name',   placeholder: 'Atmos, Mahanagar…', span: 2 },
      { key: 'gasConsumerId',      label: 'Consumer ID',     placeholder: 'Consumer number',   mono: true },
      { key: 'gasAccountNumber',   label: 'Account number',  placeholder: 'Account number',    mono: true },
      { key: 'gasPortalUrl',       label: 'Portal URL',      placeholder: 'https://…',         span: 2 },
      { key: 'gasMonthlyAvg',      label: 'Monthly avg',     type: 'number', amtKey: true },
    ],
  },
  {
    key: 'internet', label: 'Internet', icon: '🌐',
    fields: [
      { key: 'internetProvider',   label: 'Provider name',   placeholder: 'AT&T, Airtel…' },
      { key: 'internetAccount',    label: 'Account number',  placeholder: 'Account number', mono: true },
      { key: 'internetMonthly',    label: 'Monthly',         type: 'number', amtKey: true },
    ],
  },
  {
    key: 'hoa', label: 'HOA', icon: '🏘️',
    fields: [
      { key: 'hoaName',    label: 'HOA name',      placeholder: 'Community / association name' },
      { key: 'hoaAccount', label: 'Account',       placeholder: 'Account number', mono: true },
      { key: 'hoaMonthly', label: 'Monthly dues',  type: 'number', amtKey: true },
    ],
  },
  {
    key: 'other', label: 'Other utility', icon: '🗑️',
    fields: [
      { key: 'otherUtilityName',    label: 'Utility name',   placeholder: 'Trash, sewage, cable…' },
      { key: 'otherUtilityId',      label: 'ID / Account',   placeholder: 'Account number', mono: true },
      { key: 'otherUtilityMonthly', label: 'Monthly',        type: 'number', amtKey: true },
    ],
  },
  {
    key: 'tax', label: 'Property tax', icon: '🏛️',
    fields: [
      { key: 'taxParcelId',   label: 'Parcel / assessment ID', placeholder: 'Tax parcel number',  mono: true },
      { key: 'taxAuthority',  label: 'Tax authority',          placeholder: 'County / municipality' },
      { key: 'taxAnnual',     label: 'Annual tax',             type: 'number', amtKey: true },
      { key: 'taxPortalUrl',  label: 'Portal URL',             placeholder: 'https://…',           span: 2 },
    ],
  },
  {
    key: 'loan', label: 'Loan / Mortgage', icon: '🏦',
    fields: [
      { key: 'loanLender',       label: 'Lender / Bank',       placeholder: 'Chase, HDFC…' },
      { key: 'loanAccount',      label: 'Loan account',        placeholder: 'Loan account number', mono: true },
      { key: 'loanOriginal',     label: 'Original loan',       type: 'number', amtKey: true },
      { key: 'loanOutstanding',  label: 'Outstanding balance', type: 'number', amtKey: true },
      { key: 'loanMonthlyEmi',   label: 'Monthly EMI',         type: 'number', amtKey: true },
      { key: 'loanInterestRate', label: 'Interest rate (%)',   type: 'number', placeholder: '6.5' },
      { key: 'loanStartDate',    label: 'Loan start date',     type: 'date' },
      { key: 'loanEndDate',      label: 'Loan end date',       type: 'date' },
      { key: 'loanPortalUrl',    label: 'Lender portal URL',   placeholder: 'https://…', span: 2 },
    ],
  },
  {
    key: 'value', label: 'Property value', icon: '📈',
    fields: [
      { key: 'purchasePrice',       label: 'Purchase price',        type: 'number', amtKey: true },
      { key: 'purchaseDate',        label: 'Purchase date',         type: 'date' },
      { key: 'estimatedValue',      label: 'Current estimated value', type: 'number', amtKey: true },
      { key: 'estimatedValueDate',  label: 'Valuation date',        type: 'date' },
    ],
  },
  {
    key: 'insurance', label: 'Insurance', icon: '🛡️',
    fields: [
      { key: 'insuranceProvider',  label: 'Provider',       placeholder: 'State Farm, LIC…' },
      { key: 'insurancePolicyNo',  label: 'Policy number',  placeholder: 'Policy number', mono: true },
      { key: 'insuranceAnnual',    label: 'Annual premium', type: 'number', amtKey: true },
      { key: 'insuranceExpiry',    label: 'Policy expiry',  type: 'date' },
    ],
  },
  {
    key: 'notes', label: 'Notes', icon: '📝',
    fields: [
      { key: 'notes', label: 'Notes', type: 'textarea', span: 2,
        placeholder: 'HOA rules, parking, key box code, repair contacts…' },
    ],
  },
]

const NUMERIC_FIELDS = [
  'elecMonthlyAvg','waterMonthlyAvg','gasMonthlyAvg','internetMonthly','hoaMonthly',
  'otherUtilityMonthly','taxAnnual','loanOriginal','loanOutstanding','loanMonthlyEmi',
  'loanInterestRate','purchasePrice','estimatedValue','insuranceAnnual',
]

// ── sub-components ────────────────────────────────────────────
function FieldInput({ f, value, onChange, currency }) {
  const cur = currency === 'USD' ? '$' : '₹'
  const label = f.amtKey ? `${f.label} (${cur})` : f.label
  const base = {
    width:'100%', padding:'9px 12px', borderRadius:'8px', boxSizing:'border-box',
    background:'var(--dark-input)', border:'1px solid var(--border-dim)',
    color:'var(--text)', fontSize: f.mono ? '0.82rem' : '0.9rem',
    fontFamily: f.mono ? 'monospace' : 'inherit',
  }
  return (
    <div style={{ gridColumn: f.span === 2 ? 'span 2' : undefined }}>
      <label style={{ display:'block', fontSize:'0.68rem', color:'var(--text-dim)', letterSpacing:'1px', marginBottom:'4px' }}>
        {label.toUpperCase()}
      </label>
      {f.type === 'select' ? (
        <select value={value||''} onChange={e=>onChange(e.target.value)} style={base}>
          {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : f.type === 'textarea' ? (
        <textarea value={value||''} onChange={e=>onChange(e.target.value)}
          placeholder={f.placeholder||''} rows={3}
          style={{...base, resize:'vertical'}}/>
      ) : (
        <input type={f.type||'text'} value={value||''} onChange={e=>onChange(e.target.value)}
          placeholder={f.placeholder||''}
          style={{...base, color: f.amtKey ? (currency==='USD'?'#85B7EB':'#C8903A') : 'var(--text)'}}/>
      )}
    </div>
  )
}

function GroupCard({ group, form, onChange, currency, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || false)
  const filled = group.fields.filter(f => form[f.key] && String(form[f.key]).trim()).length
  const total = group.fields.length
  return (
    <div style={{ border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', marginBottom:'8px', overflow:'hidden' }}>
      <div onClick={()=>setOpen(o=>!o)} style={{
        display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px',
        cursor:'pointer', userSelect:'none',
        background: open ? 'rgba(24,95,165,0.08)' : 'var(--dark-card)',
      }}>
        <span style={{fontSize:'1.1rem'}}>{group.icon}</span>
        <span style={{fontWeight:'600', fontSize:'0.88rem', color: open?'#85B7EB':'var(--text)', flex:1}}>
          {group.label}
        </span>
        {filled > 0 && !open && (
          <span style={{fontSize:'0.68rem',color:'#34A853',background:'rgba(52,168,83,0.12)',padding:'2px 8px',borderRadius:'10px',fontWeight:'600'}}>
            {filled}/{total}
          </span>
        )}
        <span style={{color:'#5C7080',fontSize:'0.9rem'}}>{open ? '∧' : '∨'}</span>
      </div>
      {open && (
        <div style={{ padding:'14px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            {group.fields.map(f => (
              <FieldInput key={f.key} f={f} value={form[f.key]} currency={currency}
                onChange={v => onChange(f.key, v)}/>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────
export default function PropertyDetails() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('edit')

  // Edit tab state
  const [selectedProp, setSelectedProp] = useState(CONFIG.rentalProperties[0]?.id || 'rental_1')
  const [form, setForm] = useState({})
  const [currency, setCurrency] = useState('INR')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState(null)

  // Add tab state
  const [newPropName, setNewPropName] = useState('')
  const [newPropLocation, setNewPropLocation] = useState('')
  const [newPropCountry, setNewPropCountry] = useState('IN')
  const [newPropCurrency, setNewPropCurrency] = useState('INR')
  const [addForm, setAddForm] = useState({})
  const [addSaving, setAddSaving] = useState(false)
  const [addDone, setAddDone] = useState(false)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }
  const setField = (k, v) => { setForm(f=>({...f,[k]:v})); setDirty(true) }
  const setAddField = (k, v) => setAddForm(f=>({...f,[k]:v}))

  useEffect(() => { loadDetails(selectedProp) }, [selectedProp])

  async function loadDetails(propId) {
    setDirty(false)
    try {
      const d = await api.getPropertyDetails(propId)
      const data = fromDB(d?.data)
      setForm(data)
      setCurrency(data.currency || (propId.includes('us') ? 'USD' : 'INR'))
    } catch(e) { setForm({}); }
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
      showToast(`✅ Saved — ${CONFIG.rentalProperties.find(p=>p.id===selectedProp)?.name}`)
    } catch(e) { showToast('Save failed: '+e.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleAddNew() {
    if (!newPropName.trim()) { showToast('Property name is required', 'error'); return }
    setAddSaving(true)
    try {
      const id = 'rental_' + Date.now()
      // Create the rental_props record first via agreement save
      await api.saveRentalAgreement({
        propId: id, propName: newPropName.trim(), location: newPropLocation.trim(),
        country: newPropCountry, currency: newPropCurrency,
        tenantName:'', deposit:0, agreedRent:0, maintenance:0,
        leaseStart:'', leaseEnd:'', notes:'',
      })
      // Then save property details
      await api.savePropertyDetails(buildPayload(addForm, id, newPropCurrency))
      CONFIG.rentalProperties.push({ id, name:newPropName.trim(), location:newPropLocation.trim() })
      setAddDone(true)
      showToast(`✅ ${newPropName} added successfully`)
      // Switch to edit tab for the new property
      setTimeout(() => {
        setSelectedProp(id)
        setTab('edit')
        setAddDone(false)
        setNewPropName(''); setNewPropLocation(''); setAddForm({})
      }, 1500)
    } catch(e) { showToast('Add failed: '+e.message, 'error') }
    finally { setAddSaving(false) }
  }

  const prop = CONFIG.rentalProperties.find(p=>p.id===selectedProp)
  const equity = (parseFloat(form.estimatedValue)||0) - (parseFloat(form.loanOutstanding)||0)
  const monthlyFixed = [
    'elecMonthlyAvg','waterMonthlyAvg','gasMonthlyAvg','internetMonthly',
    'hoaMonthly','otherUtilityMonthly','loanMonthlyEmi',
  ].reduce((s,k) => s+(parseFloat(form[k])||0), 0) + (parseFloat(form.taxAnnual)||0)/12 + (parseFloat(form.insuranceAnnual)||0)/12

  const tabBtn = (t, label) => ({
    flex:1, padding:'11px', border:'none', cursor:'pointer', fontWeight:'600',
    fontSize:'0.82rem', textAlign:'center',
    background: tab===t ? 'rgba(24,95,165,0.15)' : 'transparent',
    color: tab===t ? '#85B7EB' : '#5C7080',
    borderBottom: tab===t ? '2px solid #185FA5' : '2px solid transparent',
  })

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Property details</div>
          <div className="topbar-sub">UTILITIES · LOAN · TAX · INSURANCE</div>
        </div>
        {tab==='edit' && dirty && (
          <button onClick={handleSave} disabled={saving}
            style={{padding:'6px 14px',borderRadius:'8px',border:'none',background:'#34A853',color:'#fff',fontWeight:'700',fontSize:'0.78rem',cursor:'pointer'}}>
            {saving?'…':'Save'}
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'#111'}}>
        <button style={tabBtn('edit','edit')} onClick={()=>setTab('edit')}>✏️ Edit existing</button>
        <button style={tabBtn('add','add')} onClick={()=>setTab('add')}>＋ Add new property</button>
      </div>

      {/* ── EDIT TAB ────────────────────────────────────────── */}
      {tab === 'edit' && (
        <div className="screen-body">
          {/* Property selector */}
          <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap'}}>
            {CONFIG.rentalProperties.map(p => (
              <button key={p.id} onClick={()=>setSelectedProp(p.id)} style={{
                flex:1, minWidth:'70px', padding:'10px 6px', borderRadius:'10px', cursor:'pointer', textAlign:'center',
                border: selectedProp===p.id ? '2px solid #185FA5' : '1px solid var(--border-dim)',
                background: selectedProp===p.id ? 'rgba(24,95,165,0.12)' : 'var(--dark-card)',
                color:'var(--text)',
              }}>
                <div style={{fontWeight:'700',fontSize:'0.82rem'}}>{p.name}</div>
                <div style={{fontSize:'0.65rem',color:'#5C7080',marginTop:'2px'}}>{p.location}</div>
              </button>
            ))}
          </div>

          {/* Currency toggle */}
          <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'12px'}}>
            <span style={{fontSize:'0.68rem',color:'#5C7080',letterSpacing:'1px'}}>CURRENCY</span>
            {['INR','USD'].map(c=>(
              <button key={c} onClick={()=>{setCurrency(c);setDirty(true)}} style={{
                padding:'4px 12px',borderRadius:'16px',cursor:'pointer',fontSize:'0.72rem',fontWeight:'600',
                border:`1px solid ${currency===c?'#34A853':'rgba(255,255,255,0.1)'}`,
                background:currency===c?'rgba(52,168,83,0.12)':'transparent',
                color:currency===c?'#34A853':'#5C7080',
              }}>{c === 'INR' ? '₹ INR' : '$ USD'}</button>
            ))}
          </div>

          {/* KPI strip */}
          {monthlyFixed > 0 && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'14px'}}>
              {[
                {label:'MONTHLY FIXED',  val:monthlyFixed,              color:'#EF4444'},
                {label:'LOAN BALANCE',   val:form.loanOutstanding,      color:'#F59E0B'},
                {label:'EQUITY',         val:equity, color:equity>=0?'#34A853':'#EF4444'},
              ].map(k => (
                <div key={k.label} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:'0.58rem',color:'#5C7080',letterSpacing:'1px',marginBottom:'4px'}}>{k.label}</div>
                  <div style={{fontWeight:'700',color:k.color,fontSize:'0.95rem'}}>{fmtAmt(k.val,currency)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Section groups */}
          {GROUPS.map((g, i) => (
            <GroupCard key={g.key} group={g} form={form}
              onChange={setField} currency={currency}
              defaultOpen={i===0}/>
          ))}

          <button className="btn btn-gold" onClick={handleSave} disabled={saving} style={{marginTop:'8px'}}>
            {saving ? 'Saving…' : `💾 Save — ${prop?.name}`}
          </button>
          <div style={{height:'20px'}}/>
        </div>
      )}

      {/* ── ADD NEW TAB ─────────────────────────────────────── */}
      {tab === 'add' && (
        <div className="screen-body">
          {addDone ? (
            <div style={{textAlign:'center',padding:'40px',color:'#34A853',fontSize:'1rem',fontWeight:'600'}}>
              ✅ Property added! Switching to edit view…
            </div>
          ) : (
            <>
              {/* Property identity */}
              <div className="card-section-label">PROPERTY IDENTITY</div>
              <div className="card" style={{marginBottom:'12px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <div style={{gridColumn:'span 2'}}>
                    <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>PROPERTY NAME *</label>
                    <input value={newPropName} onChange={e=>setNewPropName(e.target.value)}
                      placeholder="e.g. Randolph House, Tritvam 2…"
                      style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}/>
                  </div>
                  <div style={{gridColumn:'span 2'}}>
                    <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>LOCATION (city, state)</label>
                    <input value={newPropLocation} onChange={e=>setNewPropLocation(e.target.value)}
                      placeholder="e.g. Randolph, TX"
                      style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>COUNTRY</label>
                    <select value={newPropCountry} onChange={e=>{setNewPropCountry(e.target.value);setNewPropCurrency(e.target.value==='US'?'USD':'INR')}}
                      style={{width:'100%',padding:'9px 12px',borderRadius:'8px',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}>
                      <option value="IN">India</option>
                      <option value="US">USA</option>
                    </select>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>CURRENCY</label>
                    <select value={newPropCurrency} onChange={e=>setNewPropCurrency(e.target.value)}
                      style={{width:'100%',padding:'9px 12px',borderRadius:'8px',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}>
                      <option value="INR">₹ INR</option>
                      <option value="USD">$ USD</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* All detail groups */}
              <div className="card-section-label">PROPERTY DETAILS (fill what you have)</div>
              {GROUPS.map(g => (
                <GroupCard key={g.key} group={g} form={addForm}
                  onChange={setAddField} currency={newPropCurrency}
                  defaultOpen={g.key==='address'}/>
              ))}

              <button className="btn btn-gold" onClick={handleAddNew} disabled={addSaving||!newPropName.trim()}
                style={{marginTop:'8px',opacity:!newPropName.trim()?0.5:1}}>
                {addSaving ? 'Adding…' : '＋ Add property'}
              </button>
              <div style={{height:'20px'}}/>
            </>
          )}
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
