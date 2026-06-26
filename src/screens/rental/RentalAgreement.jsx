// ============================================================
//  RentalAgreement.jsx — v3: progressive flow + modular cards
//  Country Toggle -> Property Tabs -> Tenant Lifecycle Filter,
//  then 4 cards: TenantProfileCard, DocumentEngineCard,
//  FinancialsReceiptCard, MetaDiagnosticsCard.
//
//  Carried over unchanged from v2 (not in the new spec, but real,
//  working, saved functionality — not dropped on a rebuild):
//    - status bar (Active/Notice Given/Delinquent/Evicted/Runaway/Completed)
//    - expiry + renewal banners
//    - 5-item document checklist with instant-save checkboxes
//    - Add Property modal
//  "Prior" from the spec's lifecycle filter doesn't exist as a real
//  status in this database — dropped per explicit decision, using the
//  actual 6 statuses instead (see STATUSES below).
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'
import { parseLocalDate } from '../../utils/dates'
import TenantProfileCard from './TenantProfileCard'
import DocumentEngineCard from './DocumentEngineCard'
import FinancialsReceiptCard from './FinancialsReceiptCard'
import MetaDiagnosticsCard from './MetaDiagnosticsCard'

const STATUSES = ['Active','Notice Given','Delinquent','Evicted','Runaway','Completed']
const STATUS_COLOR = {
  'Active':'#34A853','Notice Given':'#F59E0B','Delinquent':'#EF4444',
  'Evicted':'#EF4444','Runaway':'#EF4444','Completed':'#5C7080',
}
const LIFECYCLE_FILTERS = [
  { key: 'active', label: 'Active',         match: s => s === 'Active' },
  { key: 'notice',  label: 'Notice Given',   match: s => s === 'Notice Given' },
  { key: 'delinquent', label: 'Delinquent',  match: s => s === 'Delinquent' },
  { key: 'prior',   label: 'Prior Tenants',  match: s => ['Evicted','Runaway','Completed'].includes(s) },
]
const DRIVE_FOLDER_TEMPLATE = (tenantName, propName) =>
  `RentalManagement/${propName}/${tenantName}`

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const parsed = parseLocalDate(dateStr)
  if (!parsed) return null
  return Math.round((parsed - today) / (1000*60*60*24))
}
function leaseDurationMonths(start, end) {
  if (!start || !end) return null
  const s = parseLocalDate(start), e = parseLocalDate(end)
  if (!s || !e) return null
  const m = Math.round((e - s) / (1000*60*60*24*30.44))
  return m > 0 ? m : null
}

const EMPTY_FORM = {
  tenantName:'', tenantEmail:'', tenantPhone:'', tenantAddress:'', tenantPan:'',
  deposit:'', agreedRent:'',
  maintenance:'', leaseStart:'', leaseEnd:'', notes:'',
  country:'IN', currency:'INR', driveFolderUrl:'', status:'Active',
  nextRenewalDate:'', earlyTerminated:false, earlyTerminationDate:'',
  docContractSigned:false, docIdCaptured:false, docMoveIn:false, docMoveOut:false, docDamageReport:false,
}

export default function RentalAgreement() {
  const navigate = useNavigate()
  const [country, setCountry] = useState('IN')
  const [lifecycle, setLifecycle] = useState('active')
  const [selectedProp, setSelectedProp] = useState(null)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [agreements, setAgreements] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [toast, setToast]     = useState(null)
  const [showAddProp, setShowAddProp] = useState(false)
  const [newProp, setNewProp] = useState({ name:'', location:'', country:'IN', currency:'INR' })
  const [addingProp, setAddingProp] = useState(false)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }
  const setField = (key, val) => setForm(f => ({...f, [key]: val}))

  useEffect(() => { loadAgreements() }, [])

  async function loadAgreements() {
    setLoading(true)
    try {
      const data = await api.getRentalAgreements()
      const map = {}
      ;(Array.isArray(data) ? data : []).forEach(a => { map[a.prop_id] = a })
      setAgreements(map)
      const firstMatch = CONFIG.rentalProperties.find(p => matchesView(p, map, 'IN', 'active'))
        || CONFIG.rentalProperties[0]
      if (firstMatch) {
        setSelectedProp(firstMatch.id)
        if (map[firstMatch.id]) prefill(map[firstMatch.id])
      }
    } catch(e) { console.warn(e) }
    finally { setLoading(false) }
  }

  function matchesView(prop, agreementsMap, ctry, lifecycleKey) {
    const a = agreementsMap[prop.id]
    const propCountry = a?.country || prop.country || 'IN'
    if (propCountry !== ctry) return false
    const status = a?.status || 'Active'
    const filter = LIFECYCLE_FILTERS.find(f => f.key === lifecycleKey)
    return filter ? filter.match(status) : true
  }

  function prefill(a) {
    setForm({
      tenantName:    a.tenant_name    || '',
      tenantEmail:   a.tenant_email   || '',
      tenantPhone:   a.tenant_phone   || '',
      tenantAddress: a.tenant_address || '',
      tenantPan:     a.tenant_pan     || '',
      deposit:       a.deposit        || '',
      agreedRent:    a.agreed_rent    || '',
      maintenance:   a.maintenance_fee|| '',
      leaseStart:    a.lease_start    || '',
      leaseEnd:      a.lease_end      || '',
      notes:         a.notes          || '',
      country:       a.country        || 'IN',
      currency:      a.currency       || 'INR',
      driveFolderUrl:a.drive_folder_url || '',
      status:        a.status         || 'Active',
      nextRenewalDate:      a.next_renewal_date      || '',
      earlyTerminated:      !!a.early_terminated,
      earlyTerminationDate: a.early_termination_date || '',
      docContractSigned: !!a.doc_contract_signed,
      docIdCaptured:     !!a.doc_id_captured,
      docMoveIn:         !!a.doc_move_in,
      docMoveOut:        !!a.doc_move_out,
      docDamageReport:   !!a.doc_damage_report,
    })
  }

  function handlePropChange(propId) {
    setSelectedProp(propId)
    setError('')
    if (agreements[propId]) prefill(agreements[propId])
    else setForm({...EMPTY_FORM, country, currency: country === 'US' ? 'USD' : 'INR'})
  }

  function handleCountryChange(newCountry) {
    setCountry(newCountry)
    setLifecycle('active')
    const visible = CONFIG.rentalProperties.filter(p => matchesView(p, agreements, newCountry, 'active'))
    if (visible[0]) handlePropChange(visible[0].id)
    else setSelectedProp(null)
  }

  function handleLifecycleChange(key) {
    setLifecycle(key)
    const visible = CONFIG.rentalProperties.filter(p => matchesView(p, agreements, country, key))
    if (visible[0]) handlePropChange(visible[0].id)
    else setSelectedProp(null)
  }

  function handleTenantNameChange(val) {
    setField('tenantName', val)
    const prop = CONFIG.rentalProperties.find(p => p.id === selectedProp)
    if (val && prop && !form.driveFolderUrl) {
      setField('driveFolderUrl', DRIVE_FOLDER_TEMPLATE(val.replace(/\s+/g,'-'), prop.name))
    }
  }

  async function handleStatusChange(newStatus) {
    setField('status', newStatus)
    if (agreements[selectedProp]) {
      try {
        await api.updateTenantStatus({ propId: selectedProp, status: newStatus })
        setAgreements(prev => ({...prev, [selectedProp]: {...prev[selectedProp], status: newStatus}}))
        showToast(`Status updated to ${newStatus}`)
      } catch(e) { showToast('Status update failed', 'error') }
    }
  }

  async function handleDocToggle(field, currentValue) {
    const newValue = !currentValue
    setField(field, newValue)
    if (!agreements[selectedProp]) return
    const backendField = {
      docContractSigned:'doc_contract_signed', docIdCaptured:'doc_id_captured',
      docMoveIn:'doc_move_in', docMoveOut:'doc_move_out', docDamageReport:'doc_damage_report',
    }[field]
    try {
      await api.updateRentalDocChecklist({ propId: selectedProp, field: backendField, value: newValue })
      setAgreements(prev => ({...prev, [selectedProp]: {...prev[selectedProp], [backendField]: newValue ? 1 : 0}}))
    } catch(e) { showToast('Could not update checklist', 'error'); setField(field, currentValue) }
  }

  async function handleSave() {
    setError('')
    if (!form.tenantName.trim()) { setError('Tenant name is required'); return }
    if (!form.leaseStart) { setError('Lease start is required'); return }
    if (!form.leaseEnd)   { setError('Lease end is required'); return }
    if (parseLocalDate(form.leaseEnd) <= parseLocalDate(form.leaseStart)) { setError('Lease end must be after start'); return }
    if (form.earlyTerminated && !form.earlyTerminationDate) { setError('Early termination date is required when marked early-terminated'); return }
    setSaving(true)
    try {
      const prop = CONFIG.rentalProperties.find(p => p.id === selectedProp)
      await api.saveRentalAgreement({
        propId:       selectedProp,
        propName:     prop?.name || selectedProp,
        location:     prop?.location || '',
        country:      form.country,
        currency:     form.currency,
        tenantName:   form.tenantName.trim(),
        tenantEmail:  form.tenantEmail.trim(),
        tenantPhone:  form.tenantPhone.trim(),
        tenantAddress:form.tenantAddress.trim(),
        tenantPan:    form.tenantPan.trim(),
        deposit:      parseFloat(form.deposit) || 0,
        agreedRent:   parseFloat(form.agreedRent) || 0,
        maintenance:  parseFloat(form.maintenance) || 0,
        leaseStart:   form.leaseStart,
        leaseEnd:     form.leaseEnd,
        notes:        form.notes.trim(),
        driveFolderUrl: form.driveFolderUrl.trim(),
        nextRenewalDate:      form.nextRenewalDate || null,
        earlyTerminated:      form.earlyTerminated,
        earlyTerminationDate: form.earlyTerminated ? form.earlyTerminationDate : null,
        docContractSigned: form.docContractSigned,
        docIdCaptured:     form.docIdCaptured,
        docMoveIn:         form.docMoveIn,
        docMoveOut:        form.docMoveOut,
        docDamageReport:   form.docDamageReport,
      })
      setAgreements(prev => ({...prev, [selectedProp]: {...prev[selectedProp],
        prop_id:selectedProp, tenant_name:form.tenantName, tenant_email:form.tenantEmail,
        tenant_phone:form.tenantPhone, tenant_address:form.tenantAddress, tenant_pan:form.tenantPan,
        deposit:parseFloat(form.deposit)||0, agreed_rent:parseFloat(form.agreedRent)||0,
        maintenance_fee:parseFloat(form.maintenance)||0,
        lease_start:form.leaseStart, lease_end:form.leaseEnd,
        country:form.country, currency:form.currency, drive_folder_url:form.driveFolderUrl, status:form.status,
        next_renewal_date:form.nextRenewalDate, early_terminated:form.earlyTerminated?1:0, early_termination_date:form.earlyTerminationDate,
        doc_contract_signed:form.docContractSigned?1:0, doc_id_captured:form.docIdCaptured?1:0,
        doc_move_in:form.docMoveIn?1:0, doc_move_out:form.docMoveOut?1:0, doc_damage_report:form.docDamageReport?1:0,
      }}))
      showToast(`✅ Agreement saved for ${prop?.name}`)
    } catch(e) { setError(`Save failed: ${e.message}`) }
    finally { setSaving(false) }
  }

  async function handleAddProperty() {
    if (!newProp.name.trim()) return
    setAddingProp(true)
    try {
      const id = 'rental_' + Date.now()
      await api.saveRentalAgreement({
        propId:id, propName:newProp.name.trim(), location:newProp.location.trim(),
        country:newProp.country, currency:newProp.currency,
        tenantName:'', deposit:0, agreedRent:0, maintenance:0,
        leaseStart:'', leaseEnd:'', notes:'',
      })
      CONFIG.rentalProperties.push({ id, name:newProp.name.trim(), location:newProp.location.trim(), country:newProp.country })
      setCountry(newProp.country)
      setSelectedProp(id); setForm({...EMPTY_FORM, country:newProp.country, currency:newProp.currency})
      setNewProp({name:'',location:'',country:'IN',currency:'INR'}); setShowAddProp(false)
      showToast(`${newProp.name} added`)
    } catch(e) { showToast('Could not add: ' + e.message, 'error') }
    finally { setAddingProp(false) }
  }

  const prop = CONFIG.rentalProperties.find(p => p.id === selectedProp)
  const saved = !!agreements[selectedProp]
  const days = daysUntil(form.leaseEnd)
  const duration = leaseDurationMonths(form.leaseStart, form.leaseEnd)
  const expiryColor = days===null?'#34A853':days<0?'#c62828':days<=30?'#e67e22':days<=60?'#f1c40f':'#34A853'
  const expiryMsg = days===null?null:days<0?`⚠️ Lease EXPIRED ${Math.abs(days)} days ago`:
    days===0?'⚠️ Expires TODAY':days<=60?`📅 Expires in ${days} days (${form.leaseEnd})`:`✓ Active — ${days} days remaining`

  const renewalDays = daysUntil(form.nextRenewalDate)
  const showRenewalBanner = form.nextRenewalDate && form.nextRenewalDate !== form.leaseEnd && renewalDays !== null && renewalDays <= 60
  const renewalColor = renewalDays<0?'#c62828':renewalDays<=14?'#e67e22':'#f1c40f'
  const renewalMsg = renewalDays<0?`⚠️ Renewal review OVERDUE by ${Math.abs(renewalDays)} days`:
    renewalDays===0?'🔔 Renewal review due TODAY':`🔔 Renewal review due in ${renewalDays} days (${form.nextRenewalDate})`

  const readOnly = lifecycle === 'prior'

  const visibleProps = CONFIG.rentalProperties.filter(p => matchesView(p, agreements, country, lifecycle))

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Tenant agreements</div>
          <div className="topbar-sub">RENTAL PROPERTIES · LEASE DETAILS</div>
        </div>
        <div style={{width:34}}/>
      </div>

      <div className="screen-body">
        <div style={{display:'flex', gap:'8px', marginBottom:'14px'}}>
          {[{ key:'IN', label:'🇮🇳 India' }, { key:'US', label:'🇺🇸 USA' }].map(c => (
            <button key={c.key} onClick={()=>handleCountryChange(c.key)} style={{
              flex:1, padding:'10px', borderRadius:'10px', cursor:'pointer', fontWeight:'700', fontSize:'0.85rem',
              border: country===c.key ? '2px solid #34A853' : '1px solid var(--border-dim)',
              background: country===c.key ? 'rgba(52,168,83,0.12)' : 'var(--dark-card)',
              color: country===c.key ? '#34A853' : 'var(--text-dim)',
            }}>{c.label}</button>
          ))}
        </div>

        <div style={{display:'flex',gap:'8px',marginBottom:'10px',alignItems:'stretch',flexWrap:'wrap'}}>
          {visibleProps.map(p => {
            const a = agreements[p.id]
            const d = a?.lease_end ? daysUntil(a.lease_end) : null
            const dot = d===null?null:d<0?'#c62828':d<=60?'#e67e22':'#34A853'
            const statusCol = a?.status ? STATUS_COLOR[a.status] : null
            return (
              <button key={p.id} onClick={()=>handlePropChange(p.id)} style={{
                flex:'1 1 100px', padding:'10px 6px',borderRadius:'10px',cursor:'pointer',textAlign:'center',
                border:selectedProp===p.id?'2px solid #185FA5':'1px solid var(--border-dim)',
                background:selectedProp===p.id?'rgba(24,95,165,0.12)':'var(--dark-card)',color:'var(--text)',
              }}>
                <div style={{fontWeight:'700',fontSize:'0.85rem'}}>{p.name}</div>
                <div style={{fontSize:'0.7rem',color:'var(--text-dim)',marginTop:'2px'}}>{p.location}</div>
                {statusCol && <div style={{fontSize:'0.62rem',color:statusCol,marginTop:'3px',fontWeight:'600'}}>{a.status}</div>}
                {dot && <div style={{width:6,height:6,borderRadius:'50%',background:dot,margin:'4px auto 0'}}/>}
              </button>
            )
          })}
          <button onClick={()=>{ setNewProp(p=>({...p, country})); setShowAddProp(true) }} style={{
            width:40,flexShrink:0,borderRadius:'10px',cursor:'pointer',
            border:'1px dashed rgba(24,95,165,0.4)',background:'rgba(24,95,165,0.06)',
            color:'#185FA5',fontSize:'1.4rem',display:'flex',alignItems:'center',justifyContent:'center',
          }}>+</button>
        </div>

        <div style={{display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap'}}>
          {LIFECYCLE_FILTERS.map(f => (
            <button key={f.key} onClick={()=>handleLifecycleChange(f.key)} style={{
              padding:'6px 12px', borderRadius:'20px', cursor:'pointer', fontSize:'0.74rem', fontWeight:'600',
              border: `1px solid ${lifecycle===f.key ? '#34A853' : 'rgba(255,255,255,0.1)'}`,
              background: lifecycle===f.key ? 'rgba(52,168,83,0.14)' : 'transparent',
              color: lifecycle===f.key ? '#34A853' : '#5C7080',
            }}>{f.label}</button>
          ))}
        </div>

        {showAddProp && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
            <div style={{background:'var(--dark-card)',borderRadius:'16px',padding:'24px',width:'100%',maxWidth:'360px',border:'1px solid rgba(24,95,165,0.2)'}}>
              <div style={{color:'#85B7EB',fontWeight:'700',fontSize:'1rem',marginBottom:'16px'}}>Add New Property</div>
              {[{key:'name',ph:'e.g. Tritvam 2'},{key:'location',ph:'e.g. Kochi, KL'}].map(f=>(
                <div key={f.key} style={{marginBottom:'12px'}}>
                  <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginBottom:'6px',letterSpacing:'1px'}}>{f.key.toUpperCase()}</div>
                  <input value={newProp[f.key]} onChange={e=>setNewProp(p=>({...p,[f.key]:e.target.value}))}
                    placeholder={f.ph} style={{width:'100%',background:'var(--dark)',border:'1px solid var(--border-dim)',borderRadius:'8px',padding:'10px 12px',color:'var(--text)',fontSize:'0.9rem',boxSizing:'border-box'}}/>
                </div>
              ))}
              <div className="grid-2" style={{marginBottom:'16px'}}>
                <div>
                  <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginBottom:'6px',letterSpacing:'1px'}}>COUNTRY</div>
                  <select value={newProp.country} onChange={e=>setNewProp(p=>({...p,country:e.target.value,currency:e.target.value==='US'?'USD':'INR'}))}
                    style={{width:'100%',background:'var(--dark)',border:'1px solid var(--border-dim)',borderRadius:'8px',padding:'10px 12px',color:'var(--text)',fontSize:'0.9rem',boxSizing:'border-box'}}>
                    <option value="IN">India (₹)</option>
                    <option value="US">USA ($)</option>
                  </select>
                </div>
                <div>
                  <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginBottom:'6px',letterSpacing:'1px'}}>CURRENCY</div>
                  <select value={newProp.currency} onChange={e=>setNewProp(p=>({...p,currency:e.target.value}))}
                    style={{width:'100%',background:'var(--dark)',border:'1px solid var(--border-dim)',borderRadius:'8px',padding:'10px 12px',color:'var(--text)',fontSize:'0.9rem',boxSizing:'border-box'}}>
                    <option value="INR">INR ₹</option>
                    <option value="USD">USD $</option>
                  </select>
                </div>
              </div>
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={()=>{setShowAddProp(false);setNewProp({name:'',location:'',country:'IN',currency:'INR'})}}
                  style={{flex:1,padding:'10px',borderRadius:'8px',border:'1px solid var(--border-dim)',background:'transparent',color:'var(--text-dim)',cursor:'pointer'}}>Cancel</button>
                <button onClick={handleAddProperty} disabled={addingProp||!newProp.name.trim()}
                  style={{flex:2,padding:'10px',borderRadius:'8px',border:'none',background:'#185FA5',color:'#fff',fontWeight:'700',cursor:'pointer',opacity:addingProp||!newProp.name.trim()?0.6:1}}>
                  {addingProp?'Adding…':'Add Property'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && <div style={{textAlign:'center',color:'var(--text-dim)',padding:'24px'}}>Loading…</div>}

        {!loading && visibleProps.length === 0 && (
          <div className="card-dashed" onClick={()=>{ setNewProp(p=>({...p, country})); setShowAddProp(true) }} style={{cursor:'pointer', textAlign:'center', padding:'28px 16px'}}>
            <div className="card-dashed-icon" style={{fontSize:'1.8rem', marginBottom:'8px'}}>
              {country === 'US' ? '🇺🇸' : '🇮🇳'}
            </div>
            <div className="card-dashed-text">
              <strong>No {country === 'US' ? 'USA' : 'India'} properties{lifecycle !== 'active' ? ` in "${LIFECYCLE_FILTERS.find(f=>f.key===lifecycle)?.label}"` : ''} yet</strong>
              <span>{country === 'US'
                ? 'Add your first US property to get started — note that US lease document generation isn\u2019t set up yet.'
                : 'Tap to add a property in this country.'}</span>
            </div>
          </div>
        )}

        {!loading && selectedProp && prop && (
          <>
            {readOnly && (
              <div style={{background:'rgba(92,112,128,0.15)',border:'1px solid rgba(92,112,128,0.4)',borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',color:'#8A9BAE',fontSize:'0.8rem',fontWeight:'600'}}>
                📁 Archival view — Prior Tenants are read-only. Generation and posting actions are disabled.
              </div>
            )}

            <div style={{display:'flex',gap:'6px',marginBottom:'12px',flexWrap:'wrap'}}>
              {STATUSES.map(s => (
                <button key={s} onClick={()=>!readOnly && handleStatusChange(s)} disabled={readOnly} style={{
                  padding:'5px 12px',borderRadius:'20px',cursor: readOnly ? 'default' : 'pointer',fontSize:'0.72rem',fontWeight:'600',
                  border:`1px solid ${form.status===s?STATUS_COLOR[s]:'rgba(255,255,255,0.1)'}`,
                  background:form.status===s?`${STATUS_COLOR[s]}22`:'transparent',
                  color:form.status===s?STATUS_COLOR[s]:'#5C7080',
                  opacity: readOnly ? 0.6 : 1,
                }}>{s}</button>
              ))}
            </div>

            {expiryMsg && (
              <div style={{background:`${expiryColor}18`,border:`1px solid ${expiryColor}55`,borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',color:expiryColor,fontSize:'0.85rem',fontWeight:'600'}}>
                {expiryMsg}
              </div>
            )}

            {showRenewalBanner && (
              <div style={{background:`${renewalColor}18`,border:`1px solid ${renewalColor}55`,borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',color:renewalColor,fontSize:'0.85rem',fontWeight:'600'}}>
                {renewalMsg}
              </div>
            )}

            <div className="card-section-label">{prop?.name?.toUpperCase()} · {prop?.location}</div>

            <TenantProfileCard form={form} setField={setField} onTenantNameChange={handleTenantNameChange} readOnly={readOnly}/>

            <div className="card">
              <div className="card-section-label">Lease Terms (editable)</div>
              <div className="grid-2">
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>SECURITY DEPOSIT ({form.currency==='USD'?'$':'₹'})</label>
                  <input type="number" min="0" value={form.deposit} disabled={readOnly} onChange={e=>setField('deposit',e.target.value)}
                    placeholder="0" style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem',opacity:readOnly?0.6:1}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>RENT / MONTH ({form.currency==='USD'?'$':'₹'})</label>
                  <input type="number" min="0" value={form.agreedRent} disabled={readOnly} onChange={e=>setField('agreedRent',e.target.value)}
                    placeholder="0" style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'#34A853',fontSize:'0.9rem',opacity:readOnly?0.6:1}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>MAINTENANCE ({form.currency==='USD'?'$':'₹'})</label>
                  <input type="number" min="0" value={form.maintenance} disabled={readOnly} onChange={e=>setField('maintenance',e.target.value)}
                    placeholder="0" style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem',opacity:readOnly?0.6:1}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>TOTAL MONTHLY ({form.currency==='USD'?'$':'₹'})</label>
                  <div style={{padding:'9px 12px',borderRadius:'8px',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'#C8903A',fontWeight:'700',display:'flex',alignItems:'center',fontSize:'0.9rem'}}>
                    {((parseFloat(form.agreedRent)||0)+(parseFloat(form.maintenance)||0)) > 0
                      ? (form.currency==='USD' ? `$${((parseFloat(form.agreedRent)||0)+(parseFloat(form.maintenance)||0)).toLocaleString()}` : `₹${((parseFloat(form.agreedRent)||0)+(parseFloat(form.maintenance)||0)).toLocaleString('en-IN')}`)
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{marginTop:'10px'}}>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>LEASE START *</label>
                  <input type="date" value={form.leaseStart} disabled={readOnly} onChange={e=>setField('leaseStart',e.target.value)}
                    style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem',opacity:readOnly?0.6:1}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>LEASE END *</label>
                  <input type="date" value={form.leaseEnd} disabled={readOnly} onChange={e=>setField('leaseEnd',e.target.value)}
                    style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem',opacity:readOnly?0.6:1}}/>
                </div>
              </div>
              {duration && <div style={{color:'#C8903A',fontSize:'0.75rem',marginTop:'4px',opacity:0.8}}>Duration: {duration} months</div>}

              <div className="grid-2" style={{marginTop:'10px'}}>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>NEXT RENEWAL DATE</label>
                  <input type="date" value={form.nextRenewalDate} disabled={readOnly} onChange={e=>setField('nextRenewalDate',e.target.value)}
                    style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem',opacity:readOnly?0.6:1}}/>
                  <div style={{fontSize:'0.65rem',color:'#5C7080',marginTop:'4px'}}>Defaults to lease end if left blank.</div>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>EARLY TERMINATION DATE</label>
                  <input type="date" value={form.earlyTerminationDate} disabled={readOnly || !form.earlyTerminated}
                    onChange={e=>setField('earlyTerminationDate',e.target.value)}
                    style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem',opacity:(readOnly||!form.earlyTerminated)?0.4:1}}/>
                </div>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'10px',cursor: readOnly ? 'default' : 'pointer'}}>
                <input type="checkbox" checked={form.earlyTerminated} disabled={readOnly}
                  onChange={e=>setField('earlyTerminated', e.target.checked)} style={{width:16,height:16}}/>
                <span style={{fontSize:'0.82rem',color: form.earlyTerminated ? '#EF4444' : 'var(--text-dim)'}}>
                  Lease was terminated early
                </span>
              </label>

              <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'14px'}}>DOCUMENTS ON FILE</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'4px'}}>
                {[
                  { key:'docContractSigned', label:'📝 Contract signed' },
                  { key:'docIdCaptured',     label:'🪪 ID captured' },
                  { key:'docMoveIn',         label:'🔑 Move-in doc' },
                  { key:'docMoveOut',        label:'📦 Move-out doc' },
                  { key:'docDamageReport',   label:'⚠️ Damage report' },
                ].map(item => (
                  <label key={item.key} onClick={()=>!readOnly && handleDocToggle(item.key, form[item.key])} style={{
                    display:'flex', alignItems:'center', gap:'8px', cursor: readOnly ? 'default' : 'pointer',
                    padding:'8px 10px', borderRadius:'8px',
                    background: form[item.key] ? 'rgba(52,168,83,0.1)' : 'var(--dark-input)',
                    border: `1px solid ${form[item.key] ? 'rgba(52,168,83,0.35)' : 'var(--border-dim)'}`,
                    opacity: readOnly ? 0.7 : 1,
                  }}>
                    <input type="checkbox" checked={form[item.key]} disabled={readOnly} onChange={()=>{}} style={{width:15,height:15,flexShrink:0}}/>
                    <span style={{fontSize:'0.78rem', color: form[item.key] ? '#34A853' : 'var(--text-dim)'}}>{item.label}</span>
                  </label>
                ))}
              </div>

              {error && <div style={{color:'#EF9A9A',fontSize:'0.82rem',marginTop:'10px',background:'rgba(198,40,40,0.1)',padding:'8px 10px',borderRadius:'8px'}}>❌ {error}</div>}
            </div>

            {!readOnly && (
              <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : `💾 Save — ${prop?.name}`}
              </button>
            )}

            <DocumentEngineCard
              agreement={agreements[selectedProp]}
              property={prop}
              country={form.country}
              saved={saved}
              readOnly={readOnly}
              showToast={showToast}
            />

            <FinancialsReceiptCard
              propId={selectedProp}
              agreement={agreements[selectedProp]}
              property={prop}
              saved={saved}
              readOnly={readOnly}
              showToast={showToast}
            />

            <MetaDiagnosticsCard form={form} setField={setField} propName={prop?.name} readOnly={readOnly}/>
          </>
        )}

        {toast && (
          <div style={{
            position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
            background: toast.type==='error' ? 'rgba(198,40,40,0.95)' : 'rgba(52,168,83,0.95)',
            color:'#fff', padding:'10px 20px', borderRadius:'10px', fontSize:'0.85rem', fontWeight:'600',
            boxShadow:'var(--shadow)', zIndex:300,
          }}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  )
}
