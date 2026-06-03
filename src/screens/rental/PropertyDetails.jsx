// ============================================================
//  PropertyDetails.jsx
//  Utility providers, loan, tax, insurance, property value
//  Route: /owner/rental/property
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'

const SECTIONS = [
  { key: 'address',     label: 'Address',          icon: '📍', color: '#8B5CF6' },
  { key: 'electricity', label: 'Electricity',       icon: '⚡', color: '#F59E0B' },
  { key: 'water',       label: 'Water',             icon: '💧', color: '#185FA5' },
  { key: 'gas',         label: 'Gas',               icon: '🔥', color: '#E24B4A' },
  { key: 'other',       label: 'Internet / HOA',    icon: '🌐', color: '#0F6E56' },
  { key: 'tax',         label: 'Property tax',      icon: '🏛️', color: '#5C7080' },
  { key: 'loan',        label: 'Loan / Mortgage',   icon: '🏦', color: '#C8903A' },
  { key: 'value',       label: 'Property value',    icon: '📈', color: '#34A853' },
  { key: 'insurance',   label: 'Insurance',         icon: '🛡️', color: '#7C3AED' },
]

const EMPTY = {
  addressLine1:'', addressLine2:'', city:'', stateProvince:'', postalCode:'', country:'IN',
  elecProvider:'', elecConsumerId:'', elecAccountNumber:'', elecPortalUrl:'', elecMonthlyAvg:'',
  waterProvider:'', waterConsumerId:'', waterAccountNumber:'', waterPortalUrl:'', waterMonthlyAvg:'',
  gasProvider:'', gasConsumerId:'', gasAccountNumber:'', gasPortalUrl:'', gasMonthlyAvg:'',
  internetProvider:'', internetAccount:'', internetMonthly:'',
  hoaName:'', hoaAccount:'', hoaMonthly:'',
  otherUtilityName:'', otherUtilityId:'', otherUtilityMonthly:'',
  taxParcelId:'', taxAuthority:'', taxAnnual:'', taxPortalUrl:'',
  loanLender:'', loanAccount:'', loanOriginal:'', loanOutstanding:'', loanMonthlyEmi:'',
  loanInterestRate:'', loanStartDate:'', loanEndDate:'', loanPortalUrl:'',
  purchasePrice:'', purchaseDate:'', estimatedValue:'', estimatedValueDate:'', currency:'INR',
  insuranceProvider:'', insurancePolicyNo:'', insuranceAnnual:'', insuranceExpiry:'',
  notes:'',
}

function fromDB(row) {
  if (!row) return {...EMPTY}
  const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
  const out = {...EMPTY}
  Object.entries(row).forEach(([k, v]) => {
    const camel = toCamel(k)
    if (camel in out) out[camel] = v ?? ''
  })
  return out
}

function fmtCurrency(amount, currency='INR') {
  if (!amount) return '—'
  if (currency === 'USD') return '$' + Number(amount).toLocaleString('en-US')
  return '₹' + Number(amount).toLocaleString('en-IN')
}

function Field({ label, value, onChange, type='text', placeholder='', mono=false, hint='' }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={{ display:'block', fontSize:'0.68rem', color:'var(--text-dim)', letterSpacing:'1px', marginBottom:'4px' }}>
        {label}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width:'100%', padding:'9px 12px', borderRadius:'8px', boxSizing:'border-box',
          background:'var(--dark-input)', border:'1px solid var(--border-dim)',
          color:'var(--text)', fontSize: mono ? '0.82rem' : '0.9rem',
          fontFamily: mono ? 'monospace' : 'inherit',
        }}
      />
      {hint && <div style={{ fontSize:'0.65rem', color:'#5C7080', marginTop:'3px' }}>{hint}</div>}
    </div>
  )
}

function Section({ section, open, onToggle, children, summary }) {
  return (
    <div style={{ marginBottom: '8px', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', overflow:'hidden' }}>
      <div onClick={onToggle} style={{
        display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px',
        cursor:'pointer', background: open ? `${section.color}10` : 'var(--dark-card)',
        borderBottom: open ? `1px solid rgba(255,255,255,0.06)` : 'none',
      }}>
        <span style={{ fontSize:'1.1rem' }}>{section.icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:'600', fontSize:'0.88rem', color: open ? section.color : 'var(--text)' }}>
            {section.label}
          </div>
          {!open && summary && (
            <div style={{ fontSize:'0.7rem', color:'#5C7080', marginTop:'2px' }}>{summary}</div>
          )}
        </div>
        <span style={{ color:'#5C7080', fontSize:'1rem' }}>{open ? '∨' : '›'}</span>
      </div>
      {open && <div style={{ padding:'14px' }}>{children}</div>}
    </div>
  )
}

export default function PropertyDetails() {
  const navigate = useNavigate()
  const [selectedProp, setSelectedProp] = useState(CONFIG.rentalProperties[0]?.id || 'rental_1')
  const [form, setForm] = useState({...EMPTY})
  const [openSection, setOpenSection] = useState('address')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [dirty, setDirty] = useState(false)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }
  const set = (key, val) => { setForm(f => ({...f,[key]:val})); setDirty(true) }

  useEffect(() => { loadDetails() }, [selectedProp])

  async function loadDetails() {
    setDirty(false)
    try {
      const d = await api.getPropertyDetails(selectedProp)
      setForm(fromDB(d?.data))
    } catch(e) { setForm({...EMPTY}) }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const prop = CONFIG.rentalProperties.find(p => p.id === selectedProp)
      await api.savePropertyDetails({
        propId: selectedProp,
        ...form,
        // coerce numerics
        elecMonthlyAvg:    parseFloat(form.elecMonthlyAvg)    || 0,
        waterMonthlyAvg:   parseFloat(form.waterMonthlyAvg)   || 0,
        gasMonthlyAvg:     parseFloat(form.gasMonthlyAvg)     || 0,
        internetMonthly:   parseFloat(form.internetMonthly)   || 0,
        hoaMonthly:        parseFloat(form.hoaMonthly)        || 0,
        otherUtilityMonthly: parseFloat(form.otherUtilityMonthly) || 0,
        taxAnnual:         parseFloat(form.taxAnnual)         || 0,
        loanOriginal:      parseFloat(form.loanOriginal)      || 0,
        loanOutstanding:   parseFloat(form.loanOutstanding)   || 0,
        loanMonthlyEmi:    parseFloat(form.loanMonthlyEmi)    || 0,
        loanInterestRate:  parseFloat(form.loanInterestRate)  || 0,
        purchasePrice:     parseFloat(form.purchasePrice)     || 0,
        estimatedValue:    parseFloat(form.estimatedValue)    || 0,
        insuranceAnnual:   parseFloat(form.insuranceAnnual)   || 0,
      })
      setDirty(false)
      showToast(`✅ Saved — ${prop?.name}`)
    } catch(e) { showToast('Save failed: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  const prop = CONFIG.rentalProperties.find(p => p.id === selectedProp)
  const cur = form.currency === 'USD' ? '$' : '₹'

  // Monthly cost summary
  const monthlyFixed = [
    parseFloat(form.elecMonthlyAvg)||0, parseFloat(form.waterMonthlyAvg)||0,
    parseFloat(form.gasMonthlyAvg)||0, parseFloat(form.internetMonthly)||0,
    parseFloat(form.hoaMonthly)||0, parseFloat(form.otherUtilityMonthly)||0,
    parseFloat(form.loanMonthlyEmi)||0, (parseFloat(form.taxAnnual)||0)/12,
    (parseFloat(form.insuranceAnnual)||0)/12,
  ].reduce((s,v)=>s+v,0)

  const equity = (parseFloat(form.estimatedValue)||0) - (parseFloat(form.loanOutstanding)||0)

  const getSummary = (key) => {
    if (key==='address') return form.city ? `${form.addressLine1||''} ${form.city}, ${form.stateProvince||''}`.trim() : ''
    if (key==='electricity') return form.elecProvider ? `${form.elecProvider} · ID: ${form.elecConsumerId||'—'}` : ''
    if (key==='water') return form.waterProvider ? `${form.waterProvider} · ID: ${form.waterConsumerId||'—'}` : ''
    if (key==='gas') return form.gasProvider ? `${form.gasProvider} · ID: ${form.gasConsumerId||'—'}` : ''
    if (key==='tax') return form.taxParcelId ? `Parcel: ${form.taxParcelId}` : ''
    if (key==='loan') return form.loanLender ? `${form.loanLender} · EMI: ${fmtCurrency(form.loanMonthlyEmi, form.currency)}/mo` : ''
    if (key==='value') return form.estimatedValue ? `Est. ${fmtCurrency(form.estimatedValue, form.currency)} · Equity: ${fmtCurrency(equity, form.currency)}` : ''
    if (key==='insurance') return form.insuranceProvider ? `${form.insuranceProvider} · ${form.insurancePolicyNo||''}` : ''
    return ''
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Property details</div>
          <div className="topbar-sub">UTILITIES · LOAN · TAX · INSURANCE</div>
        </div>
        {dirty && (
          <button onClick={handleSave} disabled={saving}
            style={{padding:'6px 14px',borderRadius:'8px',border:'none',background:'#34A853',color:'#fff',fontWeight:'700',fontSize:'0.78rem',cursor:'pointer',opacity:saving?0.6:1}}>
            {saving?'…':'Save'}
          </button>
        )}
      </div>

      <div className="screen-body">
        {/* Property tabs */}
        <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
          {CONFIG.rentalProperties.map(p => (
            <button key={p.id} onClick={()=>setSelectedProp(p.id)} style={{
              flex:1,padding:'10px 6px',borderRadius:'10px',cursor:'pointer',textAlign:'center',
              border:selectedProp===p.id?'2px solid #34A853':'1px solid var(--border-dim)',
              background:selectedProp===p.id?'rgba(52,168,83,0.1)':'var(--dark-card)',color:'var(--text)',
            }}>
              <div style={{fontWeight:'700',fontSize:'0.82rem'}}>{p.name}</div>
              <div style={{fontSize:'0.68rem',color:'#5C7080',marginTop:'2px'}}>{p.location}</div>
            </button>
          ))}
        </div>

        {/* Cost summary strip */}
        {monthlyFixed > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}}>
            <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',padding:'10px 12px',textAlign:'center'}}>
              <div style={{fontSize:'0.62rem',color:'#5C7080',letterSpacing:'1px',marginBottom:'4px'}}>MONTHLY FIXED</div>
              <div style={{fontWeight:'700',color:'#EF4444',fontSize:'1rem'}}>{fmtCurrency(monthlyFixed, form.currency)}</div>
            </div>
            <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',padding:'10px 12px',textAlign:'center'}}>
              <div style={{fontSize:'0.62rem',color:'#5C7080',letterSpacing:'1px',marginBottom:'4px'}}>LOAN BALANCE</div>
              <div style={{fontWeight:'700',color:'#F59E0B',fontSize:'1rem'}}>{fmtCurrency(form.loanOutstanding, form.currency)}</div>
            </div>
            <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',padding:'10px 12px',textAlign:'center'}}>
              <div style={{fontSize:'0.62rem',color:'#5C7080',letterSpacing:'1px',marginBottom:'4px'}}>EQUITY</div>
              <div style={{fontWeight:'700',color:equity>0?'#34A853':'#EF4444',fontSize:'1rem'}}>{fmtCurrency(equity, form.currency)}</div>
            </div>
          </div>
        )}

        {/* Currency selector */}
        <div style={{display:'flex',gap:'8px',marginBottom:'12px',alignItems:'center'}}>
          <span style={{fontSize:'0.72rem',color:'#5C7080',letterSpacing:'1px'}}>CURRENCY</span>
          {['INR','USD'].map(c=>(
            <button key={c} onClick={()=>set('currency',c)} style={{
              padding:'4px 12px',borderRadius:'16px',cursor:'pointer',fontSize:'0.75rem',fontWeight:'600',
              border:`1px solid ${form.currency===c?'#34A853':'rgba(255,255,255,0.1)'}`,
              background:form.currency===c?'rgba(52,168,83,0.12)':'transparent',
              color:form.currency===c?'#34A853':'#5C7080',
            }}>{c}</button>
          ))}
        </div>

        {/* Sections */}
        {SECTIONS.map(section => (
          <Section key={section.key} section={section}
            open={openSection===section.key}
            onToggle={()=>setOpenSection(openSection===section.key?null:section.key)}
            summary={getSummary(section.key)}>

            {section.key==='address' && (
              <div className="grid-2">
                <div style={{gridColumn:'span 2'}}><Field label="ADDRESS LINE 1" value={form.addressLine1} onChange={v=>set('addressLine1',v)} placeholder="123 Main Street"/></div>
                <div style={{gridColumn:'span 2'}}><Field label="ADDRESS LINE 2 (APT, SUITE)" value={form.addressLine2} onChange={v=>set('addressLine2',v)} placeholder="Apt 4B"/></div>
                <Field label="CITY" value={form.city} onChange={v=>set('city',v)} placeholder="Randolph"/>
                <Field label="STATE / PROVINCE" value={form.stateProvince} onChange={v=>set('stateProvince',v)} placeholder="Texas"/>
                <Field label="POSTAL CODE" value={form.postalCode} onChange={v=>set('postalCode',v)} placeholder="75080"/>
                <div>
                  <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>COUNTRY</label>
                  <select value={form.country} onChange={e=>set('country',e.target.value)}
                    style={{width:'100%',padding:'9px 12px',borderRadius:'8px',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}>
                    <option value="IN">India</option>
                    <option value="US">USA</option>
                  </select>
                </div>
              </div>
            )}

            {['electricity','water','gas'].includes(section.key) && (() => {
              const p = section.key==='electricity'?'elec':section.key==='water'?'water':'gas'
              const cap = section.key.charAt(0).toUpperCase()+section.key.slice(1)
              return (
                <div className="grid-2">
                  <div style={{gridColumn:'span 2'}}><Field label="PROVIDER NAME" value={form[`${p}Provider`]} onChange={v=>set(`${p}Provider`,v)} placeholder={`e.g. Oncor, BWSSB`}/></div>
                  <Field label="CONSUMER ID" value={form[`${p}ConsumerId`]} onChange={v=>set(`${p}ConsumerId`,v)} mono placeholder="Consumer / meter number"/>
                  <Field label="ACCOUNT NUMBER" value={form[`${p}AccountNumber`]} onChange={v=>set(`${p}AccountNumber`,v)} mono placeholder="Account number"/>
                  <div style={{gridColumn:'span 2'}}><Field label="PORTAL / LOGIN URL" value={form[`${p}PortalUrl`]} onChange={v=>set(`${p}PortalUrl`,v)} placeholder="https://…"/></div>
                  <Field label={`MONTHLY AVG (${cur})`} value={form[`${p}MonthlyAvg`]} onChange={v=>set(`${p}MonthlyAvg`,v)} type="number" placeholder="0"/>
                </div>
              )
            })()}

            {section.key==='other' && (
              <div className="grid-2">
                <div style={{gridColumn:'span 2',borderBottom:'1px solid rgba(255,255,255,0.06)',paddingBottom:'12px',marginBottom:'4px'}}>
                  <div style={{fontSize:'0.7rem',color:'#5C7080',letterSpacing:'1px',marginBottom:'8px'}}>INTERNET</div>
                  <div className="grid-2">
                    <Field label="PROVIDER" value={form.internetProvider} onChange={v=>set('internetProvider',v)} placeholder="AT&T, Airtel…"/>
                    <Field label="ACCOUNT" value={form.internetAccount} onChange={v=>set('internetAccount',v)} mono/>
                    <Field label={`MONTHLY (${cur})`} value={form.internetMonthly} onChange={v=>set('internetMonthly',v)} type="number" placeholder="0"/>
                  </div>
                </div>
                <div style={{gridColumn:'span 2',borderBottom:'1px solid rgba(255,255,255,0.06)',paddingBottom:'12px',marginBottom:'4px'}}>
                  <div style={{fontSize:'0.7rem',color:'#5C7080',letterSpacing:'1px',marginBottom:'8px'}}>HOA</div>
                  <div className="grid-2">
                    <Field label="HOA NAME" value={form.hoaName} onChange={v=>set('hoaName',v)} placeholder="Community name"/>
                    <Field label="ACCOUNT" value={form.hoaAccount} onChange={v=>set('hoaAccount',v)} mono/>
                    <Field label={`MONTHLY (${cur})`} value={form.hoaMonthly} onChange={v=>set('hoaMonthly',v)} type="number" placeholder="0"/>
                  </div>
                </div>
                <div style={{gridColumn:'span 2'}}>
                  <div style={{fontSize:'0.7rem',color:'#5C7080',letterSpacing:'1px',marginBottom:'8px'}}>OTHER UTILITY</div>
                  <div className="grid-2">
                    <Field label="NAME" value={form.otherUtilityName} onChange={v=>set('otherUtilityName',v)} placeholder="Trash, sewage…"/>
                    <Field label="ID / ACCOUNT" value={form.otherUtilityId} onChange={v=>set('otherUtilityId',v)} mono/>
                    <Field label={`MONTHLY (${cur})`} value={form.otherUtilityMonthly} onChange={v=>set('otherUtilityMonthly',v)} type="number" placeholder="0"/>
                  </div>
                </div>
              </div>
            )}

            {section.key==='tax' && (
              <div className="grid-2">
                <Field label="PARCEL / ASSESSMENT ID" value={form.taxParcelId} onChange={v=>set('taxParcelId',v)} mono placeholder="Tax parcel number"/>
                <Field label="TAX AUTHORITY" value={form.taxAuthority} onChange={v=>set('taxAuthority',v)} placeholder="County / Municipality"/>
                <Field label={`ANNUAL TAX (${cur})`} value={form.taxAnnual} onChange={v=>set('taxAnnual',v)} type="number" placeholder="0" hint={`≈ ${fmtCurrency((parseFloat(form.taxAnnual)||0)/12, form.currency)}/mo`}/>
                <div style={{gridColumn:'span 2'}}><Field label="TAX PORTAL URL" value={form.taxPortalUrl} onChange={v=>set('taxPortalUrl',v)} placeholder="https://…"/></div>
              </div>
            )}

            {section.key==='loan' && (
              <div className="grid-2">
                <Field label="LENDER / BANK" value={form.loanLender} onChange={v=>set('loanLender',v)} placeholder="Chase, HDFC…"/>
                <Field label="LOAN ACCOUNT" value={form.loanAccount} onChange={v=>set('loanAccount',v)} mono placeholder="Loan account number"/>
                <Field label={`ORIGINAL LOAN (${cur})`} value={form.loanOriginal} onChange={v=>set('loanOriginal',v)} type="number" placeholder="0"/>
                <Field label={`OUTSTANDING (${cur})`} value={form.loanOutstanding} onChange={v=>set('loanOutstanding',v)} type="number" placeholder="0"/>
                <Field label={`MONTHLY EMI (${cur})`} value={form.loanMonthlyEmi} onChange={v=>set('loanMonthlyEmi',v)} type="number" placeholder="0"/>
                <Field label="INTEREST RATE (%)" value={form.loanInterestRate} onChange={v=>set('loanInterestRate',v)} type="number" placeholder="6.5"/>
                <Field label="LOAN START DATE" value={form.loanStartDate} onChange={v=>set('loanStartDate',v)} type="date"/>
                <Field label="LOAN END DATE" value={form.loanEndDate} onChange={v=>set('loanEndDate',v)} type="date"/>
                <div style={{gridColumn:'span 2'}}><Field label="LENDER PORTAL URL" value={form.loanPortalUrl} onChange={v=>set('loanPortalUrl',v)} placeholder="https://…"/></div>
              </div>
            )}

            {section.key==='value' && (
              <div className="grid-2">
                <Field label={`PURCHASE PRICE (${cur})`} value={form.purchasePrice} onChange={v=>set('purchasePrice',v)} type="number" placeholder="0"/>
                <Field label="PURCHASE DATE" value={form.purchaseDate} onChange={v=>set('purchaseDate',v)} type="date"/>
                <Field label={`CURRENT ESTIMATED VALUE (${cur})`} value={form.estimatedValue} onChange={v=>set('estimatedValue',v)} type="number" placeholder="0"/>
                <Field label="VALUATION DATE" value={form.estimatedValueDate} onChange={v=>set('estimatedValueDate',v)} type="date"/>
                {form.purchasePrice && form.estimatedValue && (
                  <div style={{gridColumn:'span 2',background:'rgba(52,168,83,0.06)',border:'1px solid rgba(52,168,83,0.2)',borderRadius:'8px',padding:'10px 12px',fontSize:'0.82rem'}}>
                    <span style={{color:'#5C7080'}}>Appreciation: </span>
                    <span style={{color:'#34A853',fontWeight:'700'}}>
                      {fmtCurrency((parseFloat(form.estimatedValue)||0)-(parseFloat(form.purchasePrice)||0), form.currency)}
                      {' '}({(((parseFloat(form.estimatedValue)||0)/(parseFloat(form.purchasePrice)||1)-1)*100).toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            )}

            {section.key==='insurance' && (
              <div className="grid-2">
                <Field label="INSURANCE PROVIDER" value={form.insuranceProvider} onChange={v=>set('insuranceProvider',v)} placeholder="State Farm, LIC…"/>
                <Field label="POLICY NUMBER" value={form.insurancePolicyNo} onChange={v=>set('insurancePolicyNo',v)} mono placeholder="Policy number"/>
                <Field label={`ANNUAL PREMIUM (${cur})`} value={form.insuranceAnnual} onChange={v=>set('insuranceAnnual',v)} type="number" placeholder="0"/>
                <Field label="POLICY EXPIRY" value={form.insuranceExpiry} onChange={v=>set('insuranceExpiry',v)} type="date"/>
              </div>
            )}
          </Section>
        ))}

        <div>
          <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'6px',marginTop:'8px'}}>NOTES</label>
          <textarea value={form.notes||''} onChange={e=>{set('notes',e.target.value)}}
            placeholder="HOA rules, parking, key box code, contact for repairs…"
            rows={3}
            style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem',resize:'vertical'}}/>
        </div>

        <button className="btn btn-gold" onClick={handleSave} disabled={saving} style={{marginTop:'12px'}}>
          {saving?'Saving…':`💾 Save — ${prop?.name}`}
        </button>
        <div style={{height:'20px'}}/>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
