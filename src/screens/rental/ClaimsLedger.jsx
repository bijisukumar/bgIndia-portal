// ============================================================
//  ClaimsLedger.jsx — Damage & loss tracking per property
//  Route: /owner/rental/claims
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { usePropertyList } from './usePropertyList'

const CATEGORIES = ['Rent','Damage','Cleaning','Legal','Other']
const STATUSES   = ['Estimated','Claimed','Recovered','Unrecoverable']
const STATUS_COLOR = { 'Estimated':'#F59E0B','Claimed':'#185FA5','Recovered':'#34A853','Unrecoverable':'#EF4444' }
const CAT_ICON = { 'Rent':'💸','Damage':'🔨','Cleaning':'🧹','Legal':'⚖️','Other':'📌' }

function fmtAmt(amount, currency='INR') {
  if (!amount && amount !== 0) return '—'
  const abs = Math.abs(amount)
  if (currency === 'USD') return (amount < 0 ? '−' : '') + '$' + abs.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})
  return (amount < 0 ? '−' : '') + '₹' + abs.toLocaleString('en-IN')
}

const EMPTY_ITEM = { itemCategory:'Damage', description:'', amount:'', currency:'INR', evidenceFileName:'', evidenceDriveUrl:'', evidenceTimestamp:'', status:'Estimated' }

export default function ClaimsLedger() {
  const navigate = useNavigate()
  const { properties, loading: loadingProperties } = usePropertyList()
  const [selectedProp, setSelectedProp] = useState(null)
  const [agreements, setAgreements] = useState({})
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_ITEM)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const formRef = useRef(null)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }
  const setField = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { loadAll() }, [])
  useEffect(() => {
    if (!selectedProp && properties.length > 0) setSelectedProp(properties[0].id)
  }, [properties, selectedProp])
  useEffect(() => { loadClaims() }, [selectedProp])

  async function loadAll() {
    try {
      const data = await api.getRentalAgreements()
      const map = {}
      ;(Array.isArray(data)?data:[]).forEach(a=>{map[a.prop_id]=a})
      setAgreements(map)
      // Set currency from agreement
      const a = map[selectedProp]
      if (a?.currency) setForm(f=>({...f, currency: a.currency}))
    } catch(e) { console.warn(e) }
  }

  async function loadClaims() {
    setLoading(true)
    try {
      const d = await api.getLeaseLosses(selectedProp)
      setClaims(Array.isArray(d) ? d : [])
    } catch(e) { setClaims([]) }
    finally { setLoading(false) }
  }

  function openAddForm() {
    const a = agreements[selectedProp]
    setEditItem(null)
    setForm({...EMPTY_ITEM, currency: a?.currency || 'INR'})
    setShowForm(true)
    setTimeout(()=>formRef.current?.scrollIntoView({behavior:'smooth'}),100)
  }

  function openEditForm(item) {
    setEditItem(item.loss_id)
    setForm({
      itemCategory:    item.item_category,
      description:     item.description,
      amount:          item.amount,
      currency:        item.currency || 'INR',
      evidenceFileName:item.evidence_file_name || '',
      evidenceDriveUrl:item.evidence_drive_url || '',
      evidenceTimestamp:item.evidence_timestamp || '',
      status:          item.status,
    })
    setShowForm(true)
    setTimeout(()=>formRef.current?.scrollIntoView({behavior:'smooth'}),100)
  }

  async function handleSave() {
    if (!form.description.trim()) { showToast('Description is required', 'error'); return }
    if (!form.amount || isNaN(parseFloat(form.amount))) { showToast('Amount is required', 'error'); return }
    setSaving(true)
    try {
      const a = agreements[selectedProp]
      const snap = a ? `${a.tenant_name} | ${a.lease_start} → ${a.lease_end}` : ''
      await api.saveLeaseLoss({
        lossId:            editItem || null,
        propId:            selectedProp,
        leaseSnapshot:     snap,
        itemCategory:      form.itemCategory,
        description:       form.description.trim(),
        amount:            parseFloat(form.amount),
        currency:          form.currency,
        evidenceFileName:  form.evidenceFileName.trim() || null,
        evidenceDriveUrl:  form.evidenceDriveUrl.trim() || null,
        evidenceTimestamp: form.evidenceTimestamp.trim() || null,
        status:            form.status,
      })
      showToast(editItem ? '✅ Updated' : '✅ Claim added')
      setShowForm(false)
      setEditItem(null)
      loadClaims()
    } catch(e) { showToast('Save failed: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete(lossId) {
    if (!confirm('Delete this claim?')) return
    try {
      await api.deleteLeaseLoss({ lossId })
      setClaims(c => c.filter(x => x.loss_id !== lossId))
      showToast('Deleted')
    } catch(e) { showToast('Delete failed', 'error') }
  }

  async function handleStatusChange(lossId, newStatus) {
    try {
      await api.updateLeaseLossStatus({ lossId, status: newStatus })
      setClaims(c => c.map(x => x.loss_id===lossId ? {...x, status:newStatus} : x))
    } catch(e) { showToast('Status update failed', 'error') }
  }

  const prop = properties.find(p => p.id === selectedProp)
  const agreement = agreements[selectedProp]
  const currency = agreement?.currency || 'INR'
  const deposit = parseFloat(agreement?.deposit) || 0

  const totalClaimed = claims.reduce((s,c) => s + (parseFloat(c.amount)||0), 0)
  const totalRecovered = claims.filter(c=>c.status==='Recovered').reduce((s,c)=>s+(parseFloat(c.amount)||0),0)
  const totalUnrecoverable = claims.filter(c=>c.status==='Unrecoverable').reduce((s,c)=>s+(parseFloat(c.amount)||0),0)
  const netBalance = totalClaimed - deposit
  const smallClaimsTarget = Math.max(0, netBalance)

  const F = {
    label:{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'12px'},
    input:{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'},
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Claims ledger</div>
          <div className="topbar-sub">DAMAGE · LOSS · LEGAL TRACKING</div>
        </div>
        <button onClick={()=>navigate('/owner/rental/claims/report?prop='+selectedProp)}
          style={{padding:'6px 12px',borderRadius:'8px',border:'1px solid rgba(226,75,74,0.4)',background:'rgba(226,75,74,0.1)',color:'#E24B4A',fontSize:'0.72rem',fontWeight:'700',cursor:'pointer'}}>
          ⚖️ PDF
        </button>
      </div>

      <div className="screen-body">
        {/* Property selector */}
        <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
          {properties.map(p => {
            const a = agreements[p.id]
            return (
              <button key={p.id} onClick={()=>setSelectedProp(p.id)} style={{
                flex:1,minWidth:'80px',padding:'10px 6px',borderRadius:'10px',cursor:'pointer',textAlign:'center',
                border:selectedProp===p.id?'2px solid #E24B4A':'1px solid var(--border-dim)',
                background:selectedProp===p.id?'rgba(226,75,74,0.1)':'var(--dark-card)',color:'var(--text)',
              }}>
                <div style={{fontWeight:'700',fontSize:'0.82rem'}}>{p.name}</div>
                <div style={{fontSize:'0.68rem',color:'#5C7080',marginTop:'2px'}}>{a?.tenant_name || 'No tenant'}</div>
              </button>
            )
          })}
        </div>

        {/* Agreement summary */}
        {agreement?.tenant_name && (
          <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',padding:'12px 14px',marginBottom:'12px',fontSize:'0.8rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
              <span style={{color:'#EDF2F7',fontWeight:'600'}}>{agreement.tenant_name}</span>
              <span style={{color:'#34A853',fontWeight:'600'}}>{fmtAmt(deposit, currency)} deposit held</span>
            </div>
            <div style={{color:'#5C7080',fontSize:'0.72rem'}}>
              {agreement.lease_start} → {agreement.lease_end} · {prop?.location}
            </div>
          </div>
        )}

        {/* Settlement calculator */}
        {claims.length > 0 && (
          <div style={{background:'rgba(226,75,74,0.06)',border:'1px solid rgba(226,75,74,0.2)',borderRadius:'12px',padding:'14px',marginBottom:'12px'}}>
            <div style={{fontSize:'0.68rem',color:'#E24B4A',letterSpacing:'1.5px',marginBottom:'10px',fontWeight:'700'}}>SETTLEMENT CALCULATOR</div>
            {[
              {label:'Total claimed', val:totalClaimed, color:'#EDF2F7'},
              {label:'Deposit held', val:-deposit, color:'#34A853'},
              {label:'Recovered', val:-totalRecovered, color:'#34A853'},
            ].map(row=>(
              <div key={row.label} style={{display:'flex',justifyContent:'space-between',fontSize:'0.82rem',marginBottom:'6px'}}>
                <span style={{color:'#9AA5B4'}}>{row.label}</span>
                <span style={{color:row.color,fontWeight:'600'}}>{fmtAmt(row.val, currency)}</span>
              </div>
            ))}
            <div style={{borderTop:'1px solid rgba(226,75,74,0.2)',marginTop:'8px',paddingTop:'8px',display:'flex',justifyContent:'space-between'}}>
              <span style={{color:'#EDF2F7',fontWeight:'700',fontSize:'0.88rem'}}>Small claims target</span>
              <span style={{color:smallClaimsTarget>0?'#E24B4A':'#34A853',fontWeight:'700',fontSize:'1rem'}}>
                {fmtAmt(smallClaimsTarget, currency)}
              </span>
            </div>
            <div style={{fontSize:'0.68rem',color:'#5C7080',marginTop:'6px'}}>
              Unrecoverable losses: {fmtAmt(totalUnrecoverable, currency)}
            </div>
          </div>
        )}

        {/* Claims list */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
          <div className="card-section-label" style={{marginBottom:0}}>CLAIMS ({claims.length})</div>
          <button onClick={openAddForm}
            style={{padding:'6px 14px',borderRadius:'8px',border:'none',background:'#E24B4A',color:'#fff',fontWeight:'700',fontSize:'0.78rem',cursor:'pointer'}}>
            + Add claim
          </button>
        </div>

        {loading && <div style={{textAlign:'center',color:'var(--text-dim)',padding:'24px'}}>Loading…</div>}

        {!loading && claims.length === 0 && (
          <div style={{textAlign:'center',padding:'32px',color:'#5C7080',fontSize:'0.85rem'}}>
            No claims yet for {prop?.name || 'this property'}.<br/>
            <span style={{fontSize:'0.78rem'}}>Tap "+ Add claim" to log a loss item.</span>
          </div>
        )}

        {claims.map(item => (
          <div key={item.loss_id} style={{background:'var(--dark-card)',border:'1px solid var(--border-dim)',borderRadius:'12px',padding:'12px 14px',marginBottom:'8px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <span style={{fontSize:'1rem'}}>{CAT_ICON[item.item_category] || '📌'}</span>
                <div>
                  <div style={{fontWeight:'600',fontSize:'0.88rem',color:'#EDF2F7'}}>{item.description}</div>
                  <div style={{fontSize:'0.7rem',color:'#5C7080',marginTop:'2px'}}>{item.item_category}</div>
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:'700',color:'#E24B4A',fontSize:'0.95rem'}}>{fmtAmt(item.amount, item.currency||currency)}</div>
              </div>
            </div>

            {/* Evidence */}
            {(item.evidence_file_name || item.evidence_drive_url) && (
              <div style={{fontSize:'0.72rem',color:'#5C7080',marginBottom:'8px',background:'rgba(255,255,255,0.03)',borderRadius:'6px',padding:'6px 8px'}}>
                {item.evidence_file_name && <span>📎 {item.evidence_file_name}{item.evidence_timestamp ? ` @ ${item.evidence_timestamp}` : ''}</span>}
                {item.evidence_drive_url && (
                  <a href={item.evidence_drive_url} target="_blank" rel="noreferrer"
                    style={{color:'#85B7EB',marginLeft:'8px',textDecoration:'none'}}>🔗 Drive</a>
                )}
              </div>
            )}

            {/* Status + actions */}
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
              {STATUSES.map(s=>(
                <button key={s} onClick={()=>handleStatusChange(item.loss_id,s)} style={{
                  padding:'3px 8px',borderRadius:'12px',cursor:'pointer',fontSize:'0.68rem',fontWeight:'600',
                  border:`1px solid ${item.status===s?STATUS_COLOR[s]:'rgba(255,255,255,0.1)'}`,
                  background:item.status===s?`${STATUS_COLOR[s]}22`:'transparent',
                  color:item.status===s?STATUS_COLOR[s]:'#5C7080',
                }}>{s}</button>
              ))}
              <div style={{marginLeft:'auto',display:'flex',gap:'6px'}}>
                <button onClick={()=>openEditForm(item)}
                  style={{padding:'4px 10px',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#9AA5B4',fontSize:'0.72rem',cursor:'pointer'}}>
                  Edit
                </button>
                <button onClick={()=>handleDelete(item.loss_id)}
                  style={{padding:'4px 10px',borderRadius:'8px',border:'1px solid rgba(239,68,68,0.3)',background:'transparent',color:'#EF4444',fontSize:'0.72rem',cursor:'pointer'}}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add / Edit form */}
        {showForm && (
          <div ref={formRef} style={{background:'rgba(226,75,74,0.05)',border:'1px solid rgba(226,75,74,0.2)',borderRadius:'14px',padding:'16px',marginTop:'12px'}}>
            <div style={{fontWeight:'700',color:'#E24B4A',fontSize:'0.88rem',marginBottom:'12px'}}>
              {editItem ? '✏️ Edit claim' : '+ New claim'}
            </div>

            <div className="grid-2">
              <div>
                <label style={F.label}>CATEGORY</label>
                <select value={form.itemCategory} onChange={e=>setField('itemCategory',e.target.value)} style={F.input}>
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={F.label}>STATUS</label>
                <select value={form.status} onChange={e=>setField('status',e.target.value)} style={F.input}>
                  {STATUSES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <label style={F.label}>DESCRIPTION *</label>
            <input value={form.description} onChange={e=>setField('description',e.target.value)}
              placeholder="e.g. Broken bathroom tiles, 3 months unpaid rent…" style={F.input}/>

            <div className="grid-2">
              <div>
                <label style={F.label}>AMOUNT *</label>
                <input type="number" min="0" value={form.amount} onChange={e=>setField('amount',e.target.value)}
                  placeholder="0" style={{...F.input,color:'#E24B4A'}}/>
              </div>
              <div>
                <label style={F.label}>CURRENCY</label>
                <select value={form.currency} onChange={e=>setField('currency',e.target.value)} style={F.input}>
                  <option value="INR">INR ₹</option>
                  <option value="USD">USD $</option>
                </select>
              </div>
            </div>

            <label style={F.label}>EVIDENCE FILE NAME</label>
            <input value={form.evidenceFileName} onChange={e=>setField('evidenceFileName',e.target.value)}
              placeholder="exit_video.mp4, move-out-photos.zip…" style={F.input}/>

            <div className="grid-2">
              <div>
                <label style={F.label}>VIDEO TIMESTAMP</label>
                <input value={form.evidenceTimestamp} onChange={e=>setField('evidenceTimestamp',e.target.value)}
                  placeholder="e.g. 04:12" style={F.input}/>
              </div>
              <div>
                <label style={F.label}>DRIVE LINK</label>
                <input value={form.evidenceDriveUrl} onChange={e=>setField('evidenceDriveUrl',e.target.value)}
                  placeholder="https://drive.google.com/…" style={F.input}/>
              </div>
            </div>

            <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
              <button onClick={()=>{setShowForm(false);setEditItem(null)}}
                style={{flex:1,padding:'11px',borderRadius:'10px',border:'1px solid var(--border-dim)',background:'transparent',color:'var(--text-dim)',cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{flex:2,padding:'11px',borderRadius:'10px',border:'none',background:'#E24B4A',color:'#fff',fontWeight:'700',cursor:'pointer',opacity:saving?0.6:1}}>
                {saving?'Saving…':editItem?'Update claim':'Add claim'}
              </button>
            </div>
          </div>
        )}

        <div style={{height:'20px'}}/>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
