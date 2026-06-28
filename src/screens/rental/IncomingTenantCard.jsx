// ============================================================
//  IncomingTenantCard.jsx
//  Holds ONE queued future tenant's intake data for a property,
//  completely separate from the live rental_props record. Used when
//  a new tenant has already signed/paid while the CURRENT tenant is
//  still living there (e.g. on Notice Given) -- rental_props only has
//  one slot, so the new tenant's data can't go there yet without
//  corrupting the live record.
//
//  "Move In Now" performs the actual swap: archives the current
//  tenant to history, overwrites rental_props with this incoming
//  tenant's data, and clears this record -- all atomically server-side.
// ============================================================
import { useState, useEffect } from 'react'
import { api } from '../../api'
import { fmtDate, localTodayStr } from '../../utils/dates'
import { downloadDepositReceipt } from '../../utils/generateReceipt'
import { downloadMoveReport } from '../../utils/generateMoveReport'

function fmt(n, currency='INR') {
  if (!n && n !== 0) return '—'
  return currency === 'USD' ? `$${Number(n).toLocaleString()}` : `₹${Number(n).toLocaleString('en-IN')}`
}

const EMPTY = {
  tenantName:'', tenantEmail:'', tenantPhone:'', tenantAddress:'', tenantPan:'',
  deposit:'', agreedRent:'', maintenance:'', leaseStart:'', leaseEnd:'',
  country:'IN', currency:'INR', notes:'', docContractSigned:false, docIdCaptured:false,
}

const F = {
  label: {display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'12px'},
  input: {width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'},
}

export default function IncomingTenantCard({ propId, propCountry, property, currentTenantName, showToast, onMovedIn }) {
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmingMoveIn, setConfirmingMoveIn] = useState(false)
  const [movingIn, setMovingIn] = useState(false)
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [depositDate, setDepositDate] = useState(localTodayStr())
  const [depositMode, setDepositMode] = useState('Bank Transfer')
  const [markingDeposit, setMarkingDeposit] = useState(false)
  const [generatingReceipt, setGeneratingReceipt] = useState(false)
  const [generatingMoveIn, setGeneratingMoveIn] = useState(false)

  useEffect(() => { load() }, [propId])

  async function load() {
    // Capture the propId this load() call was started for, so that if the
    // user switches properties again before this request resolves, we can
    // detect the response is stale and discard it instead of letting a
    // late response for the OLD property overwrite the NEW property's
    // (correctly different, possibly empty) state.
    const requestedFor = propId
    setRecord(null)   // clear immediately -- don't keep showing the
    setLoading(true)  // previous property's record while this loads
    try {
      const data = await api.getIncomingTenant(requestedFor)
      if (requestedFor !== propId) return // stale response, a newer load() has since started -- discard
      setRecord(data || false)
      if (data) {
        setForm({
          tenantName: data.tenant_name||'', tenantEmail: data.tenant_email||'', tenantPhone: data.tenant_phone||'',
          tenantAddress: data.tenant_address||'', tenantPan: data.tenant_pan||'',
          deposit: data.deposit||'', agreedRent: data.agreed_rent||'', maintenance: data.maintenance_fee||'',
          leaseStart: data.lease_start||'', leaseEnd: data.lease_end||'',
          country: data.country||propCountry, currency: data.currency|| (propCountry==='US'?'USD':'INR'),
          notes: data.notes||'', docContractSigned: !!data.doc_contract_signed, docIdCaptured: !!data.doc_id_captured,
        })
      } else {
        setForm(EMPTY)
      }
    } catch (e) {
      console.warn(e)
      if (requestedFor === propId) setRecord(false)
    }
    finally { if (requestedFor === propId) setLoading(false) }
  }

  function openNew() {
    setForm({ ...EMPTY, country: propCountry, currency: propCountry==='US'?'USD':'INR' })
    setEditing(true)
  }

  async function handleSave() {
    if (!form.tenantName.trim()) { showToast('Tenant name is required', 'error'); return }
    if (!form.leaseStart) { showToast('Planned move-in date is required', 'error'); return }
    setSaving(true)
    try {
      await api.saveIncomingTenant({
        propId, tenantName: form.tenantName.trim(), tenantEmail: form.tenantEmail.trim(),
        tenantPhone: form.tenantPhone.trim(), tenantAddress: form.tenantAddress.trim(), tenantPan: form.tenantPan.trim(),
        deposit: parseFloat(form.deposit)||0, agreedRent: parseFloat(form.agreedRent)||0, maintenance: parseFloat(form.maintenance)||0,
        leaseStart: form.leaseStart, leaseEnd: form.leaseEnd,
        country: form.country, currency: form.currency, notes: form.notes.trim(),
        docContractSigned: form.docContractSigned, docIdCaptured: form.docIdCaptured,
      })
      showToast(`✅ Incoming tenant saved: ${form.tenantName}`)
      setEditing(false)
      load()
    } catch (e) { showToast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleRemove() {
    try {
      await api.deleteIncomingTenant(propId)
      showToast('Incoming tenant record removed')
      setRecord(false)
    } catch (e) { showToast(e.message, 'error') }
  }

  async function handleMoveIn() {
    setMovingIn(true)
    try {
      await api.moveInIncomingTenant({ propId })
      showToast(`🔑 ${record.tenant_name} moved in — now Active`)
      setConfirmingMoveIn(false)
      setRecord(false)
      if (onMovedIn) onMovedIn()
    } catch (e) { showToast(e.message, 'error') }
    finally { setMovingIn(false) }
  }

  async function handleMarkDepositPaid() {
    if (!depositDate) { showToast('Payment date is required', 'error'); return }
    setMarkingDeposit(true)
    try {
      await api.markIncomingDepositPaid({ propId, paid: true, paidDate: depositDate, paymentMode: depositMode })
      showToast(`✅ Deposit marked paid for ${record.tenant_name}`)
      setShowDepositForm(false)
      load()
    } catch (e) { showToast(e.message, 'error') }
    finally { setMarkingDeposit(false) }
  }

  async function handleUnmarkDepositPaid() {
    try {
      await api.markIncomingDepositPaid({ propId, paid: false })
      showToast('Deposit payment cleared')
      load()
    } catch (e) { showToast(e.message, 'error') }
  }

  async function handleGenerateDepositReceipt() {
    setGeneratingReceipt(true)
    try {
      // Use the incoming tenant's OWN real data — their actual deposit
      // amount, address, and recorded payment date/mode — never the
      // previous tenant's. property is passed through unchanged since
      // the address/building is the same regardless of who's moving in.
      await downloadDepositReceipt({
        tenant_name: record.tenant_name,
        tenant_address: record.tenant_address,
        deposit: record.deposit,
        currency: record.currency || 'INR',
        _depositPaymentDate: record.deposit_paid_date || depositDate,
        _depositPaymentMode: record.deposit_payment_mode || depositMode,
      }, property)
      showToast(`🧾 Deposit receipt generated for ${record.tenant_name}`)
    } catch (e) { showToast(e.message, 'error') }
    finally { setGeneratingReceipt(false) }
  }

  async function handleGenerateMoveInDoc() {
    setGeneratingMoveIn(true)
    try {
      // record.lease_start is the PLANNED move-in date for this incoming
      // tenant — using it (rather than today) means the document's
      // stated Move-In Date, and the 14-day reporting window that legal
      // clause is anchored to, reflect the real date the tenant actually
      // takes possession, not whatever day this button happens to be
      // clicked.
      await downloadMoveReport('move-in', { tenant_name: record.tenant_name }, property, record.lease_start)
      showToast(`🔑 Move-in document generated for ${record.tenant_name}`)
    } catch (e) { showToast(e.message, 'error') }
    finally { setGeneratingMoveIn(false) }
  }

  if (loading || record === null) {
    return (
      <div className="card">
        <div className="card-section-label">Incoming Tenant</div>
        <div style={{color:'var(--text-dim)', fontSize:'0.82rem'}}>Loading…</div>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="card">
        <div className="card-section-label">{record ? 'Edit Incoming Tenant' : 'Add Incoming Tenant'}</div>
        <div style={{fontSize:'0.7rem', color:'#5C7080', marginBottom:'4px'}}>
          Kept separate from the current tenant's record until you move them in.
        </div>

        <label style={F.label}>TENANT NAME *</label>
        <input value={form.tenantName} onChange={e=>setForm({...form, tenantName:e.target.value})} style={F.input}/>

        <div className="grid-2">
          <div>
            <label style={F.label}>EMAIL</label>
            <input value={form.tenantEmail} onChange={e=>setForm({...form, tenantEmail:e.target.value})} style={F.input}/>
          </div>
          <div>
            <label style={F.label}>PHONE</label>
            <input value={form.tenantPhone} onChange={e=>setForm({...form, tenantPhone:e.target.value})} style={F.input}/>
          </div>
        </div>

        <label style={F.label}>ADDRESS</label>
        <textarea value={form.tenantAddress} onChange={e=>setForm({...form, tenantAddress:e.target.value})} rows={2} style={{...F.input, resize:'vertical'}}/>

        <label style={F.label}>PAN / AADHAAR</label>
        <input value={form.tenantPan} onChange={e=>setForm({...form, tenantPan:e.target.value})} style={F.input}/>

        <div className="grid-2">
          <div>
            <label style={F.label}>DEPOSIT</label>
            <input type="number" value={form.deposit} onChange={e=>setForm({...form, deposit:e.target.value})} style={F.input}/>
          </div>
          <div>
            <label style={F.label}>RENT / MONTH</label>
            <input type="number" value={form.agreedRent} onChange={e=>setForm({...form, agreedRent:e.target.value})} style={F.input}/>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <label style={F.label}>PLANNED MOVE-IN DATE *</label>
            <input type="date" value={form.leaseStart} onChange={e=>setForm({...form, leaseStart:e.target.value})} style={F.input}/>
          </div>
          <div>
            <label style={F.label}>PLANNED LEASE END</label>
            <input type="date" value={form.leaseEnd} onChange={e=>setForm({...form, leaseEnd:e.target.value})} style={F.input}/>
          </div>
        </div>

        <label style={F.label}>NOTES</label>
        <textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} rows={2} style={{...F.input, resize:'vertical'}}/>

        <div style={{display:'flex', gap:'10px', marginTop:'16px'}}>
          <button onClick={()=>setEditing(false)} style={{flex:1, padding:'10px', borderRadius:'8px', border:'1px solid var(--border-dim)', background:'transparent', color:'var(--text-dim)', cursor:'pointer'}}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{flex:2, padding:'10px', borderRadius:'8px', border:'none', background:'#185FA5', color:'#fff', fontWeight:'700', cursor:'pointer', opacity:saving?0.6:1}}>
            {saving ? 'Saving…' : '💾 Save Incoming Tenant'}
          </button>
        </div>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="card">
        <div className="card-section-label">Incoming Tenant</div>
        <div style={{fontSize:'0.8rem', color:'var(--text-dim)', marginBottom:'10px'}}>
          No incoming tenant queued. Use this if someone new has signed up while the current tenant is still here.
        </div>
        <button onClick={openNew} style={{
          width:'100%', padding:'11px', borderRadius:'10px',
          border:'1px dashed rgba(24,95,165,0.4)', background:'rgba(24,95,165,0.06)',
          color:'#185FA5', fontWeight:'700', fontSize:'0.85rem', cursor:'pointer',
        }}>
          + Add Incoming Tenant
        </button>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-section-label">Incoming Tenant</div>
      <div style={{padding:'10px 12px', borderRadius:'10px', background:'rgba(24,95,165,0.08)', border:'1px solid rgba(24,95,165,0.25)', marginBottom:'10px'}}>
        <div style={{fontWeight:'700', fontSize:'0.9rem', color:'var(--text)'}}>{record.tenant_name}</div>
        <div style={{fontSize:'0.74rem', color:'var(--text-dim)', marginTop:'2px'}}>
          Planned move-in: {fmtDate(record.lease_start)} · {fmt(record.agreed_rent, record.currency)}/mo
        </div>
      </div>

      <div style={{display:'flex', gap:'8px', marginBottom:'10px'}}>
        <button onClick={()=>setEditing(true)} style={{flex:1, padding:'9px', borderRadius:'8px', border:'1px solid var(--border-dim)', background:'transparent', color:'var(--text-dim)', fontSize:'0.78rem', cursor:'pointer'}}>
          ✏️ Edit
        </button>
        <button onClick={handleRemove} style={{flex:1, padding:'9px', borderRadius:'8px', border:'1px solid rgba(229,57,53,0.3)', background:'rgba(229,57,53,0.08)', color:'#E53935', fontSize:'0.78rem', cursor:'pointer'}}>
          🗑️ Remove
        </button>
      </div>

      {/* Deposit tracking — uses THIS tenant's own deposit amount/address,
          never the previous tenant's, even though the receipt format is
          shared via downloadDepositReceipt(). */}
      <div style={{padding:'10px 12px', borderRadius:'10px', background:'var(--dark-input)', border:'1px solid var(--border-dim)', marginBottom:'10px'}}>
        <div style={{fontSize:'0.7rem', color:'var(--text-dim)', letterSpacing:'1px', marginBottom:'8px'}}>SECURITY DEPOSIT — {fmt(record.deposit, record.currency)}</div>

        {record.deposit_paid ? (
          <>
            <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px'}}>
              <span style={{color:'#34A853', fontWeight:'700', fontSize:'0.82rem'}}>✓ Paid</span>
              <span style={{color:'var(--text-dim)', fontSize:'0.74rem'}}>
                {fmtDate(record.deposit_paid_date)} · {record.deposit_payment_mode}
              </span>
              <button onClick={handleUnmarkDepositPaid} style={{
                marginLeft:'auto', padding:'3px 8px', borderRadius:'6px', border:'1px solid var(--border-dim)',
                background:'transparent', color:'#5C7080', fontSize:'0.66rem', cursor:'pointer',
              }}>undo</button>
            </div>
            <button onClick={handleGenerateDepositReceipt} disabled={generatingReceipt} style={{
              width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid rgba(24,95,165,0.4)',
              background:'rgba(24,95,165,0.1)', color:'#185FA5', fontWeight:'700', fontSize:'0.8rem',
              cursor: generatingReceipt ? 'default' : 'pointer', opacity: generatingReceipt ? 0.6 : 1,
            }}>
              {generatingReceipt ? 'Generating…' : '🧾 Generate Deposit Receipt'}
            </button>
          </>
        ) : !showDepositForm ? (
          <button onClick={()=>setShowDepositForm(true)} style={{
            width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid rgba(52,168,83,0.4)',
            background:'rgba(52,168,83,0.1)', color:'#34A853', fontWeight:'700', fontSize:'0.8rem', cursor:'pointer',
          }}>
            Mark Deposit Paid
          </button>
        ) : (
          <div>
            <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>PAYMENT DATE</label>
            <input type="date" value={depositDate} onChange={e=>setDepositDate(e.target.value)}
              style={{width:'100%',padding:'8px 10px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.85rem'}}/>

            <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'8px'}}>PAYMENT MODE</label>
            <select value={depositMode} onChange={e=>setDepositMode(e.target.value)}
              style={{width:'100%',padding:'8px 10px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.85rem'}}>
              <option>Bank Transfer</option><option>UPI</option><option>Cheque</option><option>Cash</option>
            </select>

            <div style={{display:'flex', gap:'8px', marginTop:'10px'}}>
              <button onClick={()=>setShowDepositForm(false)} style={{flex:1, padding:'8px', borderRadius:'8px', border:'1px solid var(--border-dim)', background:'transparent', color:'var(--text-dim)', fontSize:'0.78rem', cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={handleMarkDepositPaid} disabled={markingDeposit} style={{
                flex:2, padding:'8px', borderRadius:'8px', border:'none', background:'#34A853', color:'#fff',
                fontWeight:'700', fontSize:'0.78rem', cursor: markingDeposit ? 'default' : 'pointer', opacity: markingDeposit ? 0.6 : 1,
              }}>
                {markingDeposit ? 'Saving…' : 'Confirm Paid'}
              </button>
            </div>
          </div>
        )}
      </div>

      <button onClick={handleGenerateMoveInDoc} disabled={generatingMoveIn} style={{
        width:'100%', marginBottom:'10px', padding:'10px', borderRadius:'8px', border:'1px solid rgba(52,168,83,0.4)',
        background:'rgba(52,168,83,0.1)', color:'#34A853', fontWeight:'700', fontSize:'0.8rem',
        cursor: generatingMoveIn ? 'default' : 'pointer', opacity: generatingMoveIn ? 0.6 : 1,
      }}>
        {generatingMoveIn ? 'Generating…' : '🔑 Generate Move-In Document'}
      </button>

      {!confirmingMoveIn ? (
        <button onClick={()=>setConfirmingMoveIn(true)} style={{
          width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid rgba(52,168,83,0.5)',
          background:'rgba(52,168,83,0.12)', color:'#34A853', fontWeight:'700', fontSize:'0.85rem', cursor:'pointer',
        }}>
          🔑 Move In Now
        </button>
      ) : (
        <div style={{padding:'12px', borderRadius:'10px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.35)'}}>
          <div style={{fontSize:'0.8rem', color:'#F59E0B', fontWeight:'600', marginBottom:'8px'}}>
            {currentTenantName
              ? `This will archive ${currentTenantName} to Past Tenants and make ${record.tenant_name} the live tenant. This can't be undone from here.`
              : `This will make ${record.tenant_name} the live tenant for this property.`}
          </div>
          <div style={{display:'flex', gap:'8px'}}>
            <button onClick={()=>setConfirmingMoveIn(false)} style={{flex:1, padding:'9px', borderRadius:'8px', border:'1px solid var(--border-dim)', background:'transparent', color:'var(--text-dim)', cursor:'pointer'}}>
              Cancel
            </button>
            <button onClick={handleMoveIn} disabled={movingIn} style={{flex:1, padding:'9px', borderRadius:'8px', border:'none', background:'#34A853', color:'#fff', fontWeight:'700', cursor:'pointer', opacity:movingIn?0.6:1}}>
              {movingIn ? 'Moving in…' : 'Confirm Move In'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
