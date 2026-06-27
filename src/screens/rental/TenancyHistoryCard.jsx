// ============================================================
//  TenancyHistoryCard.jsx
//  Shows past tenants for the selected property (from the new
//  tenancy_history table) and lets the owner add/edit a historic
//  record by hand — completely separate from the live agreement in
//  rental_props, so back-filling an old tenant for Pinnacle never
//  touches Pinnacle's current tenant's data.
// ============================================================
import { useState, useEffect } from 'react'
import { api } from '../../api'
import { fmtDate } from '../../utils/dates'

const STATUSES = ['Completed','Evicted','Runaway']
const STATUS_COLOR = { Completed:'#5C7080', Evicted:'#EF4444', Runaway:'#EF4444' }

function fmt(n, currency='INR') {
  if (!n && n !== 0) return '—'
  return currency === 'USD' ? `$${Number(n).toLocaleString()}` : `₹${Number(n).toLocaleString('en-IN')}`
}

const EMPTY = {
  historyId:null, tenantName:'', tenantEmail:'', tenantPhone:'', tenantAddress:'', tenantPan:'',
  deposit:'', agreedRent:'', maintenance:'', leaseStart:'', leaseEnd:'',
  country:'IN', currency:'INR', status:'Completed', notes:'',
}

const F = {
  label: {display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'12px'},
  input: {width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'},
}

export default function TenancyHistoryCard({ propId, propCountry, showToast }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [propId])

  async function load() {
    setLoading(true)
    try {
      const data = await api.getTenancyHistory(propId)
      setRecords(Array.isArray(data) ? data : [])
    } catch (e) { console.warn(e) }
    finally { setLoading(false) }
  }

  function openNew() {
    setEditing({ ...EMPTY, country: propCountry, currency: propCountry === 'US' ? 'USD' : 'INR' })
  }

  function openEdit(r) {
    setEditing({
      historyId: r.history_id, tenantName: r.tenant_name || '', tenantEmail: r.tenant_email || '',
      tenantPhone: r.tenant_phone || '', tenantAddress: r.tenant_address || '', tenantPan: r.tenant_pan || '',
      deposit: r.deposit || '', agreedRent: r.agreed_rent || '', maintenance: r.maintenance_fee || '',
      leaseStart: r.lease_start || '', leaseEnd: r.lease_end || '',
      country: r.country || 'IN', currency: r.currency || 'INR', status: r.status || 'Completed',
      notes: r.notes || '',
    })
  }

  async function handleSave() {
    if (!editing.tenantName.trim()) { showToast('Tenant name is required', 'error'); return }
    setSaving(true)
    try {
      await api.saveTenancyHistory({
        historyId: editing.historyId, propId,
        tenantName: editing.tenantName.trim(), tenantEmail: editing.tenantEmail.trim(),
        tenantPhone: editing.tenantPhone.trim(), tenantAddress: editing.tenantAddress.trim(),
        tenantPan: editing.tenantPan.trim(),
        deposit: parseFloat(editing.deposit) || 0, agreedRent: parseFloat(editing.agreedRent) || 0,
        maintenance: parseFloat(editing.maintenance) || 0,
        leaseStart: editing.leaseStart, leaseEnd: editing.leaseEnd,
        country: editing.country, currency: editing.currency, status: editing.status,
        notes: editing.notes.trim(),
      })
      showToast(`✅ Historic record saved for ${editing.tenantName}`)
      setEditing(null)
      load()
    } catch (e) { showToast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete(historyId, name) {
    try {
      await api.deleteTenancyHistory(historyId)
      showToast(`Removed ${name}`)
      load()
    } catch (e) { showToast(e.message, 'error') }
  }

  if (editing) {
    return (
      <div className="card">
        <div className="card-section-label">
          {editing.historyId ? 'Edit Historic Tenant' : 'Add Historic Tenant'}
        </div>
        <div style={{fontSize:'0.7rem', color:'#5C7080', marginBottom:'4px'}}>
          This is a past tenancy record, kept separate from the property's current tenant.
        </div>

        <label style={F.label}>TENANT NAME *</label>
        <input value={editing.tenantName} onChange={e=>setEditing({...editing, tenantName:e.target.value})} style={F.input}/>

        <div className="grid-2">
          <div>
            <label style={F.label}>EMAIL</label>
            <input value={editing.tenantEmail} onChange={e=>setEditing({...editing, tenantEmail:e.target.value})} style={F.input}/>
          </div>
          <div>
            <label style={F.label}>PHONE</label>
            <input value={editing.tenantPhone} onChange={e=>setEditing({...editing, tenantPhone:e.target.value})} style={F.input}/>
          </div>
        </div>

        <label style={F.label}>ADDRESS</label>
        <textarea value={editing.tenantAddress} onChange={e=>setEditing({...editing, tenantAddress:e.target.value})} rows={2} style={{...F.input, resize:'vertical'}}/>

        <label style={F.label}>PAN / AADHAAR</label>
        <input value={editing.tenantPan} onChange={e=>setEditing({...editing, tenantPan:e.target.value})} style={F.input}/>

        <div className="grid-2">
          <div>
            <label style={F.label}>DEPOSIT</label>
            <input type="number" value={editing.deposit} onChange={e=>setEditing({...editing, deposit:e.target.value})} style={F.input}/>
          </div>
          <div>
            <label style={F.label}>RENT / MONTH</label>
            <input type="number" value={editing.agreedRent} onChange={e=>setEditing({...editing, agreedRent:e.target.value})} style={F.input}/>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <label style={F.label}>LEASE START</label>
            <input type="date" value={editing.leaseStart} onChange={e=>setEditing({...editing, leaseStart:e.target.value})} style={F.input}/>
          </div>
          <div>
            <label style={F.label}>LEASE END</label>
            <input type="date" value={editing.leaseEnd} onChange={e=>setEditing({...editing, leaseEnd:e.target.value})} style={F.input}/>
          </div>
        </div>

        <label style={F.label}>HOW DID THIS TENANCY END?</label>
        <div style={{display:'flex', gap:'6px', marginTop:'4px'}}>
          {STATUSES.map(s => (
            <button key={s} onClick={()=>setEditing({...editing, status:s})} style={{
              padding:'6px 14px', borderRadius:'20px', cursor:'pointer', fontSize:'0.78rem', fontWeight:'600',
              border:`1px solid ${editing.status===s ? STATUS_COLOR[s] : 'rgba(255,255,255,0.1)'}`,
              background: editing.status===s ? `${STATUS_COLOR[s]}22` : 'transparent',
              color: editing.status===s ? STATUS_COLOR[s] : '#5C7080',
            }}>{s}</button>
          ))}
        </div>

        <label style={F.label}>NOTES</label>
        <textarea value={editing.notes} onChange={e=>setEditing({...editing, notes:e.target.value})} rows={2} style={{...F.input, resize:'vertical'}}/>

        <div style={{display:'flex', gap:'10px', marginTop:'16px'}}>
          <button onClick={()=>setEditing(null)} style={{flex:1, padding:'10px', borderRadius:'8px', border:'1px solid var(--border-dim)', background:'transparent', color:'var(--text-dim)', cursor:'pointer'}}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{flex:2, padding:'10px', borderRadius:'8px', border:'none', background:'#C8903A', color:'#fff', fontWeight:'700', cursor:'pointer', opacity:saving?0.6:1}}>
            {saving ? 'Saving…' : '💾 Save Historic Record'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-section-label">Past Tenants</div>

      {loading && <div style={{color:'var(--text-dim)', fontSize:'0.82rem', padding:'8px 0'}}>Loading…</div>}

      {!loading && records.length === 0 && (
        <div style={{fontSize:'0.8rem', color:'var(--text-dim)', padding:'8px 0'}}>
          No past tenants on file for this property yet.
        </div>
      )}

      {!loading && records.map(r => (
        <div key={r.history_id} style={{
          padding:'10px 12px', borderRadius:'10px', marginBottom:'8px',
          background:'var(--dark-input)', border:'1px solid var(--border-dim)',
        }}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <div style={{fontWeight:'700', fontSize:'0.88rem', color:'var(--text)'}}>{r.tenant_name}</div>
              <div style={{fontSize:'0.72rem', color:'var(--text-dim)', marginTop:'2px'}}>
                {fmtDate(r.lease_start)} – {fmtDate(r.lease_end)} · {fmt(r.agreed_rent, r.currency)}
              </div>
              <div style={{fontSize:'0.68rem', color:STATUS_COLOR[r.status]||'#5C7080', marginTop:'2px', fontWeight:'600'}}>{r.status}</div>
            </div>
            <div style={{display:'flex', gap:'6px'}}>
              <button onClick={()=>openEdit(r)} style={{padding:'5px 10px', borderRadius:'6px', border:'1px solid var(--border-dim)', background:'transparent', color:'var(--text-dim)', fontSize:'0.7rem', cursor:'pointer'}}>Edit</button>
              <button onClick={()=>handleDelete(r.history_id, r.tenant_name)} style={{padding:'5px 10px', borderRadius:'6px', border:'1px solid rgba(229,57,53,0.3)', background:'rgba(229,57,53,0.08)', color:'#E53935', fontSize:'0.7rem', cursor:'pointer'}}>Remove</button>
            </div>
          </div>
        </div>
      ))}

      <button onClick={openNew} style={{
        width:'100%', marginTop:'4px', padding:'11px', borderRadius:'10px',
        border:'1px dashed rgba(200,144,58,0.4)', background:'rgba(200,144,58,0.06)',
        color:'#C8903A', fontWeight:'700', fontSize:'0.85rem', cursor:'pointer',
      }}>
        + Add Historic Tenant
      </button>
    </div>
  )
}
