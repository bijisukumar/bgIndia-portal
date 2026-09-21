// ============================================================
//  MoveExpensesCard.jsx — costs the OWNER incurs preparing a property
//  for a new tenant (move-in) or after one leaves (move-out): deep
//  cleaning, AC service, electrician, plumbing, realty commission, etc.
//  Distinct from the Claims Ledger (damage/dues charged TO the tenant)
//  and from vacant-property monthly expenses (RentalProperties.jsx) --
//  these are genuine owner expenses, tied to a specific move event.
// ============================================================
import { useState, useEffect } from 'react'
import { api } from '../../api'
import { fmtDate, localTodayStr } from '../../utils/dates'
import FormatToggle from './FormatToggle'

const CATEGORIES = ['Realty Commission','Deep Cleaning','AC Service','Electrician','Plumbing','Painting','Pest Control','Other']
const CAT_ICON = {
  'Realty Commission':'🏢','Deep Cleaning':'🧹','AC Service':'❄️','Electrician':'💡',
  'Plumbing':'🚰','Painting':'🎨','Pest Control':'🐜','Other':'📌',
}

function fmt(n, currency='INR') {
  if (!n && n !== 0) return '—'
  return currency === 'USD' ? `$${Number(n).toLocaleString('en-US')}` : `₹${Number(n).toLocaleString('en-IN')}`
}

const EMPTY_ITEM = { category:'Deep Cleaning', description:'', amount:'', vendorName:'', paidDate: localTodayStr(), evidenceUrl:'' }

export default function MoveExpensesCard({ propId, agreement, property, saved, readOnly, showToast }) {
  const currency = agreement?.currency || 'INR'
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [eventType, setEventType] = useState('move_in')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_ITEM)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(null)
  const [useDocx, setUseDocx] = useState(false)

  const setField = (k,v) => setForm(f => ({...f, [k]: v}))

  useEffect(() => { if (saved) load() }, [propId, saved])

  async function load() {
    setLoading(true)
    try {
      const data = await api.getMoveExpenses(propId)
      setExpenses(Array.isArray(data) ? data : [])
    } catch (e) { setExpenses([]) }
    finally { setLoading(false) }
  }

  function openAddForm() {
    setEditId(null)
    setForm(EMPTY_ITEM)
    setShowForm(true)
  }

  function openEditForm(item) {
    setEditId(item.expense_id)
    setForm({
      category: item.category, description: item.description || '', amount: item.amount,
      vendorName: item.vendor_name || '', paidDate: item.paid_date || localTodayStr(), evidenceUrl: item.evidence_url || '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.amount || isNaN(parseFloat(form.amount))) { showToast('Amount is required', 'error'); return }
    setSaving(true)
    try {
      await api.saveMoveExpense({
        expenseId: editId || null,
        propId, eventType,
        tenantSnapshot: agreement?.tenant_name || '',
        category: form.category,
        description: form.description.trim() || null,
        amount: parseFloat(form.amount),
        currency,
        vendorName: form.vendorName.trim() || null,
        paidDate: form.paidDate || localTodayStr(),
        evidenceUrl: form.evidenceUrl.trim() || null,
      })
      showToast(editId ? '✅ Updated' : '✅ Expense added')
      setShowForm(false); setEditId(null)
      load()
    } catch (e) { showToast('Save failed: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete(expenseId) {
    if (!confirm('Delete this expense?')) return
    try {
      await api.deleteMoveExpense(expenseId)
      setExpenses(e => e.filter(x => x.expense_id !== expenseId))
      showToast('Deleted')
    } catch (e) { showToast('Delete failed', 'error') }
  }

  async function handlePayoutVoucher(item) {
    setGenerating(item.expense_id)
    try {
      const { generatePayoutVoucherAny } = await import('../../utils/formatChoice')
      await generatePayoutVoucherAny(!useDocx, item, property)
      showToast('🧾 Payout voucher generated')
    } catch (e) { showToast(e.message, 'error') }
    finally { setGenerating(null) }
  }

  const shown = expenses.filter(e => e.event_type === eventType)
  const total = shown.reduce((s,e) => s + (parseFloat(e.amount)||0), 0)

  const F = {
    label:{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'12px'},
    input:{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'},
  }

  return (
    <div className="card" style={{marginTop:'12px'}}>
      <div className="card-section-label">🧾 Move-In / Move-Out Expenses</div>

      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
        {[['move_in','🔑 Move-In'],['move_out','📦 Move-Out']].map(([val,label]) => (
          <button key={val} onClick={()=>setEventType(val)} style={{
            flex:1, padding:'8px 6px', borderRadius:'8px', cursor:'pointer', textAlign:'center',
            border: eventType===val ? '2px solid #C8903A' : '1px solid var(--border-dim)',
            background: eventType===val ? 'rgba(200,144,58,0.1)' : 'var(--dark-card)',
            color:'var(--text)', fontSize:'0.82rem', fontWeight:'600',
          }}>{label}</button>
        ))}
      </div>

      {!saved ? (
        <div style={{fontSize:'0.78rem', color:'var(--text-dim)', padding:'8px 0'}}>Save the agreement first to track expenses.</div>
      ) : (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
            <div style={{fontSize:'0.78rem',color:'var(--text-dim)'}}>
              Total: <strong style={{color:'#C8903A'}}>{fmt(total, currency)}</strong>
            </div>
            {!readOnly && (
              <button onClick={openAddForm} style={{padding:'6px 12px',borderRadius:'8px',border:'none',background:'#C8903A',color:'#fff',fontWeight:'700',fontSize:'0.76rem',cursor:'pointer'}}>
                + Add expense
              </button>
            )}
          </div>

          {loading && <div style={{textAlign:'center',color:'var(--text-dim)',padding:'16px'}}>Loading…</div>}

          {!loading && shown.length === 0 && (
            <div style={{textAlign:'center',padding:'20px',color:'#5C7080',fontSize:'0.82rem'}}>
              No {eventType==='move_in'?'move-in':'move-out'} expenses logged yet.
            </div>
          )}

          {shown.map(item => (
            <div key={item.expense_id} style={{background:'var(--dark-input)',border:'1px solid var(--border-dim)',borderRadius:'10px',padding:'10px 12px',marginBottom:'8px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                  <span>{CAT_ICON[item.category] || '📌'}</span>
                  <div>
                    <div style={{fontWeight:'600',fontSize:'0.85rem',color:'var(--text)'}}>{item.category}</div>
                    {item.description && <div style={{fontSize:'0.7rem',color:'var(--text-dim)'}}>{item.description}</div>}
                    <div style={{fontSize:'0.68rem',color:'#5C7080',marginTop:'2px'}}>
                      {item.vendor_name || 'No vendor'} · {fmtDate(item.paid_date)}
                    </div>
                  </div>
                </div>
                <div style={{fontWeight:'700',color:'#C8903A',fontSize:'0.9rem'}}>{fmt(item.amount, item.currency||currency)}</div>
              </div>
              {item.evidence_url && (
                <a href={item.evidence_url} target="_blank" rel="noreferrer" style={{fontSize:'0.7rem',color:'#85B7EB',textDecoration:'none',display:'block',marginTop:'6px'}}>
                  🔗 Vendor invoice
                </a>
              )}
              {!readOnly && (
                <div style={{display:'flex',gap:'6px',marginTop:'8px',flexWrap:'wrap'}}>
                  <button onClick={()=>handlePayoutVoucher(item)} disabled={generating===item.expense_id}
                    style={{padding:'4px 10px',borderRadius:'6px',border:'1px solid rgba(200,144,58,0.4)',background:'rgba(200,144,58,0.1)',color:'#C8903A',fontSize:'0.68rem',fontWeight:'600',cursor:'pointer'}}>
                    {generating===item.expense_id ? '…' : `🧾 Payout Voucher (${useDocx?'.docx':'.pdf'})`}
                  </button>
                  <button onClick={()=>openEditForm(item)}
                    style={{padding:'4px 10px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#9AA5B4',fontSize:'0.68rem',cursor:'pointer'}}>
                    Edit
                  </button>
                  <button onClick={()=>handleDelete(item.expense_id)}
                    style={{padding:'4px 10px',borderRadius:'6px',border:'1px solid rgba(239,68,68,0.3)',background:'transparent',color:'#EF4444',fontSize:'0.68rem',cursor:'pointer'}}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}

          {shown.length > 0 && <FormatToggle useDocx={useDocx} onChange={setUseDocx} idSuffix="payout" />}

          {showForm && (
            <div style={{background:'rgba(200,144,58,0.05)',border:'1px solid rgba(200,144,58,0.2)',borderRadius:'12px',padding:'14px',marginTop:'12px'}}>
              <div style={{fontWeight:'700',color:'#C8903A',fontSize:'0.84rem',marginBottom:'8px'}}>
                {editId ? '✏️ Edit expense' : `+ New ${eventType==='move_in'?'move-in':'move-out'} expense`}
              </div>

              <label style={F.label}>CATEGORY</label>
              <select value={form.category} onChange={e=>setField('category',e.target.value)} style={F.input}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>

              <label style={F.label}>DESCRIPTION</label>
              <input value={form.description} onChange={e=>setField('description',e.target.value)}
                placeholder="e.g. Two-bedroom deep clean before new tenant" style={F.input}/>

              <div className="grid-2">
                <div>
                  <label style={F.label}>AMOUNT ({currency==='USD'?'$':'₹'})</label>
                  <input type="number" min="0" value={form.amount} onChange={e=>setField('amount',e.target.value)}
                    placeholder="0" style={{...F.input,color:'#C8903A'}}/>
                </div>
                <div>
                  <label style={F.label}>PAID DATE</label>
                  <input type="date" value={form.paidDate} onChange={e=>setField('paidDate',e.target.value)} style={F.input}/>
                </div>
              </div>

              <label style={F.label}>VENDOR NAME</label>
              <input value={form.vendorName} onChange={e=>setField('vendorName',e.target.value)}
                placeholder="e.g. Sparkle Cleaning Services" style={F.input}/>

              <label style={F.label}>VENDOR INVOICE (ONEDRIVE LINK)</label>
              <input value={form.evidenceUrl} onChange={e=>setField('evidenceUrl',e.target.value)}
                placeholder="https://onedrive.live.com/..." style={F.input}/>

              <div style={{display:'flex',gap:'8px',marginTop:'14px'}}>
                <button onClick={()=>{setShowForm(false);setEditId(null)}}
                  style={{flex:1,padding:'10px',borderRadius:'10px',border:'1px solid var(--border-dim)',background:'transparent',color:'var(--text-dim)',cursor:'pointer'}}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{flex:2,padding:'10px',borderRadius:'10px',border:'none',background:'#C8903A',color:'#fff',fontWeight:'700',cursor:'pointer',opacity:saving?0.6:1}}>
                  {saving?'Saving…':editId?'Update expense':'Add expense'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
