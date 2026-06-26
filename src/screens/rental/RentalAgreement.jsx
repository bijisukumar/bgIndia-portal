// ============================================================
//  RentalAgreement.jsx — v2 with status, drive folder, US support
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'
import { parseLocalDate } from '../../utils/dates'
import { downloadLeaseDeed } from '../../utils/generateLeaseDeed'

const STATUSES = ['Active','Notice Given','Delinquent','Evicted','Runaway','Completed']
const STATUS_COLOR = {
  'Active':'#34A853','Notice Given':'#F59E0B','Delinquent':'#EF4444',
  'Evicted':'#EF4444','Runaway':'#EF4444','Completed':'#5C7080',
}
const DRIVE_FOLDER_TEMPLATE = (tenantName, propName) =>
  `RentalManagement/${propName}/${tenantName}`

function fmt(n, currency='INR') {
  if (!n && n !== 0) return '—'
  return currency === 'USD' ? `$${Number(n).toLocaleString()}` : `₹${Number(n).toLocaleString('en-IN')}`
}
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
  const [selectedProp, setSelectedProp] = useState(CONFIG.rentalProperties[0]?.id || 'rental_1')
  const [form, setForm]       = useState(EMPTY_FORM)
  const [agreements, setAgreements] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [toast, setToast]     = useState(null)
  const [showAddProp, setShowAddProp] = useState(false)
  const [newProp, setNewProp] = useState({ name:'', location:'', country:'IN', currency:'INR' })
  const [addingProp, setAddingProp] = useState(false)
  const [generatingDeed, setGeneratingDeed] = useState(false)

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
      if (map[selectedProp]) prefill(map[selectedProp])
    } catch(e) { console.warn(e) }
    finally { setLoading(false) }
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
    else setForm(EMPTY_FORM)
  }

  // Auto-fill drive folder when tenant name is entered
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
    if (!agreements[selectedProp]) return  // not saved yet — just update local form, will persist on next Save
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
        tenant_address:form.tenantAddress, tenant_pan:form.tenantPan,
        deposit:parseFloat(form.deposit)||0, agreed_rent:parseFloat(form.agreedRent)||0,
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

  async function handleGenerateDeed() {
    const prop = CONFIG.rentalProperties.find(p => p.id === selectedProp)
    const saved = agreements[selectedProp]
    if (!saved) {
      showToast('Save the agreement first, then generate the deed', 'error')
      return
    }
    setGeneratingDeed(true)
    try {
      await downloadLeaseDeed(saved, prop)
      showToast(`📄 Lease deed generated for ${saved.tenant_name}`)
    } catch(e) {
      showToast(e.message, 'error')
    } finally {
      setGeneratingDeed(false)
    }
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
      CONFIG.rentalProperties.push({ id, name:newProp.name.trim(), location:newProp.location.trim() })
      setSelectedProp(id); setForm({...EMPTY_FORM, country:newProp.country, currency:newProp.currency})
      setNewProp({name:'',location:'',country:'IN',currency:'INR'}); setShowAddProp(false)
      showToast(`${newProp.name} added`)
    } catch(e) { showToast('Could not add: ' + e.message, 'error') }
    finally { setAddingProp(false) }
  }

  const prop = CONFIG.rentalProperties.find(p => p.id === selectedProp)
  const days = daysUntil(form.leaseEnd)
  const duration = leaseDurationMonths(form.leaseStart, form.leaseEnd)
  const totalMonthly = (parseFloat(form.agreedRent)||0) + (parseFloat(form.maintenance)||0)
  const expiryColor = days===null?'#34A853':days<0?'#c62828':days<=30?'#e67e22':days<=60?'#f1c40f':'#34A853'
  const expiryMsg = days===null?null:days<0?`⚠️ Lease EXPIRED ${Math.abs(days)} days ago`:
    days===0?'⚠️ Expires TODAY':days<=60?`📅 Expires in ${days} days (${form.leaseEnd})`:`✓ Active — ${days} days remaining`

  // Renewal reminder — only shown when nextRenewalDate is set AND differs from
  // leaseEnd, so we don't show two banners saying the same thing for the common
  // case where renewal coincides with lease end.
  const renewalDays = daysUntil(form.nextRenewalDate)
  const showRenewalBanner = form.nextRenewalDate && form.nextRenewalDate !== form.leaseEnd && renewalDays !== null && renewalDays <= 60
  const renewalColor = renewalDays<0?'#c62828':renewalDays<=14?'#e67e22':'#f1c40f'
  const renewalMsg = renewalDays<0?`⚠️ Renewal review OVERDUE by ${Math.abs(renewalDays)} days`:
    renewalDays===0?'🔔 Renewal review due TODAY':`🔔 Renewal review due in ${renewalDays} days (${form.nextRenewalDate})`

  const curSymbol = form.currency === 'USD' ? '$' : '₹'

  const F = {
    label: {display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'12px'},
    input: {width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'},
  }

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
        {/* Property tabs */}
        <div style={{display:'flex',gap:'8px',marginBottom:'16px',alignItems:'stretch'}}>
          {CONFIG.rentalProperties.map(p => {
            const a = agreements[p.id]
            const d = a?.lease_end ? daysUntil(a.lease_end) : null
            const dot = d===null?null:d<0?'#c62828':d<=60?'#e67e22':'#34A853'
            const statusCol = a?.status ? STATUS_COLOR[a.status] : null
            return (
              <button key={p.id} onClick={()=>handlePropChange(p.id)} style={{
                flex:1,padding:'10px 6px',borderRadius:'10px',cursor:'pointer',textAlign:'center',
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
          <button onClick={()=>setShowAddProp(true)} style={{
            width:40,flexShrink:0,borderRadius:'10px',cursor:'pointer',
            border:'1px dashed rgba(24,95,165,0.4)',background:'rgba(24,95,165,0.06)',
            color:'#185FA5',fontSize:'1.4rem',display:'flex',alignItems:'center',justifyContent:'center',
          }}>+</button>
        </div>

        {/* Add property modal */}
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

        {!loading && (
          <>
            {/* Status bar */}
            <div style={{display:'flex',gap:'6px',marginBottom:'12px',flexWrap:'wrap'}}>
              {STATUSES.map(s => (
                <button key={s} onClick={()=>handleStatusChange(s)} style={{
                  padding:'5px 12px',borderRadius:'20px',cursor:'pointer',fontSize:'0.72rem',fontWeight:'600',
                  border:`1px solid ${form.status===s?STATUS_COLOR[s]:'rgba(255,255,255,0.1)'}`,
                  background:form.status===s?`${STATUS_COLOR[s]}22`:'transparent',
                  color:form.status===s?STATUS_COLOR[s]:'#5C7080',
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
            <div className="card">
              {/* Country + Currency */}
              <div className="grid-2">
                <div>
                  <label style={F.label}>COUNTRY</label>
                  <select value={form.country} onChange={e=>setField('country',e.target.value)} style={F.input}>
                    <option value="IN">India</option>
                    <option value="US">USA</option>
                  </select>
                </div>
                <div>
                  <label style={F.label}>CURRENCY</label>
                  <select value={form.currency} onChange={e=>setField('currency',e.target.value)} style={F.input}>
                    <option value="INR">INR ₹</option>
                    <option value="USD">USD $</option>
                  </select>
                </div>
              </div>

              <label style={F.label}>TENANT NAME *</label>
              <input value={form.tenantName} onChange={e=>handleTenantNameChange(e.target.value)}
                placeholder="Full legal name" style={F.input}/>

              <div className="grid-2">
                <div>
                  <label style={F.label}>EMAIL</label>
                  <input type="email" value={form.tenantEmail} onChange={e=>setField('tenantEmail',e.target.value)}
                    placeholder="tenant@email.com" style={F.input}/>
                </div>
                <div>
                  <label style={F.label}>PHONE</label>
                  <input type="tel" value={form.tenantPhone} onChange={e=>setField('tenantPhone',e.target.value)}
                    placeholder="+91 …" style={F.input}/>
                </div>
              </div>

              <label style={F.label}>TENANT ADDRESS</label>
              <textarea value={form.tenantAddress} onChange={e=>setField('tenantAddress',e.target.value)}
                placeholder="Full permanent address, as it should appear on the lease deed" rows={2}
                style={{...F.input,resize:'vertical'}}/>

              <label style={F.label}>TENANT PAN / AADHAAR NUMBER</label>
              <input value={form.tenantPan} onChange={e=>setField('tenantPan',e.target.value)}
                placeholder="e.g. AXRPS9969C or 1234 5678 9012" style={F.input}/>
              <div style={{fontSize:'0.65rem',color:'#5C7080',marginTop:'4px'}}>
                Required on the lease deed — used to identify the LESSEE in the legal document.
              </div>

              <div className="grid-2">
                <div>
                  <label style={F.label}>SECURITY DEPOSIT ({curSymbol})</label>
                  <input type="number" min="0" value={form.deposit} onChange={e=>setField('deposit',e.target.value)}
                    placeholder="0" style={F.input}/>
                </div>
                <div>
                  <label style={F.label}>RENT / MONTH ({curSymbol})</label>
                  <input type="number" min="0" value={form.agreedRent} onChange={e=>setField('agreedRent',e.target.value)}
                    placeholder="0" style={{...F.input,color:'#34A853'}}/>
                </div>
                <div>
                  <label style={F.label}>MAINTENANCE ({curSymbol})</label>
                  <input type="number" min="0" value={form.maintenance} onChange={e=>setField('maintenance',e.target.value)}
                    placeholder="0" style={F.input}/>
                </div>
                <div>
                  <label style={F.label}>TOTAL MONTHLY ({curSymbol})</label>
                  <div style={{...F.input,color:'#C8903A',fontWeight:'700',display:'flex',alignItems:'center'}}>
                    {totalMonthly > 0 ? fmt(totalMonthly, form.currency) : '—'}
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{marginTop:'4px'}}>
                <div>
                  <label style={F.label}>LEASE START *</label>
                  <input type="date" value={form.leaseStart} onChange={e=>setField('leaseStart',e.target.value)} style={F.input}/>
                </div>
                <div>
                  <label style={F.label}>LEASE END *</label>
                  <input type="date" value={form.leaseEnd} onChange={e=>setField('leaseEnd',e.target.value)} style={F.input}/>
                </div>
              </div>
              {duration && <div style={{color:'#C8903A',fontSize:'0.75rem',marginTop:'4px',opacity:0.8}}>Duration: {duration} months</div>}

              <div className="grid-2" style={{marginTop:'4px'}}>
                <div>
                  <label style={F.label}>NEXT RENEWAL DATE</label>
                  <input type="date" value={form.nextRenewalDate} onChange={e=>setField('nextRenewalDate',e.target.value)} style={F.input}/>
                  <div style={{fontSize:'0.65rem',color:'#5C7080',marginTop:'4px'}}>Defaults to lease end if left blank — drives renewal reminders.</div>
                </div>
                <div>
                  <label style={F.label}>EARLY TERMINATION DATE</label>
                  <input type="date" value={form.earlyTerminationDate} disabled={!form.earlyTerminated}
                    onChange={e=>setField('earlyTerminationDate',e.target.value)}
                    style={{...F.input, opacity: form.earlyTerminated ? 1 : 0.4}}/>
                </div>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'10px',cursor:'pointer'}}>
                <input type="checkbox" checked={form.earlyTerminated}
                  onChange={e=>setField('earlyTerminated', e.target.checked)} style={{width:16,height:16}}/>
                <span style={{fontSize:'0.82rem',color: form.earlyTerminated ? '#EF4444' : 'var(--text-dim)'}}>
                  Lease was terminated early
                </span>
              </label>

              <label style={F.label}>DOCUMENTS ON FILE</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'4px'}}>
                {[
                  { key:'docContractSigned', label:'📝 Contract signed' },
                  { key:'docIdCaptured',     label:'🪪 ID captured' },
                  { key:'docMoveIn',         label:'🔑 Move-in doc' },
                  { key:'docMoveOut',        label:'📦 Move-out doc' },
                  { key:'docDamageReport',   label:'⚠️ Damage report' },
                ].map(item => (
                  <label key={item.key} onClick={()=>handleDocToggle(item.key, form[item.key])} style={{
                    display:'flex', alignItems:'center', gap:'8px', cursor:'pointer',
                    padding:'8px 10px', borderRadius:'8px',
                    background: form[item.key] ? 'rgba(52,168,83,0.1)' : 'var(--dark-input)',
                    border: `1px solid ${form[item.key] ? 'rgba(52,168,83,0.35)' : 'var(--border-dim)'}`,
                  }}>
                    <input type="checkbox" checked={form[item.key]} onChange={()=>{}} style={{width:15,height:15,flexShrink:0}}/>
                    <span style={{fontSize:'0.78rem', color: form[item.key] ? '#34A853' : 'var(--text-dim)'}}>{item.label}</span>
                  </label>
                ))}
              </div>

              <label style={F.label}>GOOGLE DRIVE FOLDER PATH</label>
              <input value={form.driveFolderUrl} onChange={e=>setField('driveFolderUrl',e.target.value)}
                placeholder="RentalManagement/PropertyName/TenantName" style={{...F.input,fontFamily:'monospace',fontSize:'0.8rem'}}/>
              <div style={{fontSize:'0.68rem',color:'#5C7080',marginTop:'4px'}}>
                Format: RentalManagement / {prop?.name || 'Property'} / TenantName / [Move-in, Contracts, Move-out, Renewals]
              </div>

              <label style={F.label}>NOTES</label>
              <textarea value={form.notes} onChange={e=>setField('notes',e.target.value)}
                placeholder="Parking slot, special terms, emergency contact…" rows={3}
                style={{...F.input,resize:'vertical'}}/>

              {error && <div style={{color:'#EF9A9A',fontSize:'0.82rem',marginTop:'10px',background:'rgba(198,40,40,0.1)',padding:'8px 10px',borderRadius:'8px'}}>❌ {error}</div>}
            </div>

            <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : `💾 Save — ${prop?.name}`}
            </button>

            {form.country === 'IN' && (
              <button
                onClick={handleGenerateDeed}
                disabled={generatingDeed || !agreements[selectedProp]}
                style={{
                  width:'100%', marginTop:'10px', padding:'12px',
                  borderRadius:'10px', cursor: (generatingDeed || !agreements[selectedProp]) ? 'default' : 'pointer',
                  border:'1px solid rgba(24,95,165,0.4)', background:'rgba(24,95,165,0.08)',
                  color:'#185FA5', fontWeight:'700', fontSize:'0.88rem',
                  opacity: (generatingDeed || !agreements[selectedProp]) ? 0.5 : 1,
                }}>
                {generatingDeed ? 'Generating…' : '📄 Generate Lease Deed (.docx)'}
              </button>
            )}
            {form.country === 'IN' && !agreements[selectedProp] && (
              <div style={{fontSize:'0.68rem', color:'#5C7080', marginTop:'6px', textAlign:'center'}}>
                Save the agreement first to enable deed generation.
              </div>
            )}
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
