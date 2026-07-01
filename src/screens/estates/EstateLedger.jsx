import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { localTodayStr } from '../../utils/dates'

const TODAY = localTodayStr()

// Pollachi (coconut) — original lists
const INCOME_CATS  = ['Mango Harvest Income','Lease income','Govt subsidy','Other income']
const EXPENSE_CATS = ['Labour wages','Salary','Fertilizer','Pesticide','Tractor / Land tiling',
  'JCB work','Fencing','Irrigation','Water pump','Electricity bill','Land tax','Transport',
  'Housing expenses','Soil evaluation & testing','Tree / plant purchase','Maintenance & repairs','Other expense']

// Pavutumuri (rubber) — matches the estate's actual income/sales and expense lines
const PAVUTUMURI_INCOME_CATS  = ['Rubber Sheet','Ottupal','Coconut','Lease income','Govt subsidy','Other income']
const PAVUTUMURI_EXPENSE_CATS = ['Rubber Labour','Formic Acid','Fertilizer','Tree waterproofing',
  'Smoke house repair','Coconut Labour','House maintenance','Transport','Land tax','Other expense']

function catsFor(estate, type) {
  if (estate === 'pavutumuri') return type === 'income' ? PAVUTUMURI_INCOME_CATS : PAVUTUMURI_EXPENSE_CATS
  return type === 'income' ? INCOME_CATS : EXPENSE_CATS
}

function fmt(n) { return isNaN(n)||n==='' ? '—' : `₹${Number(n).toLocaleString('en-IN')}` }

const EMPTY_FORM = { date: TODAY, category: '', amount: '', description: '', paidTo: '' }

export default function EstateLedger({ estate }) {
  const navigate   = useNavigate()
  const [tab, setTab]       = useState('add')        // 'add' | 'history'
  const [type, setType]     = useState('expense')
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState(null)
  const [form, setForm]     = useState({...EMPTY_FORM})
  const [editId, setEditId] = useState(null)

  // History state
  const [txns, setTxns]         = useState([])
  const [loadingTxns, setLoadingTxns] = useState(false)
  const [filterType, setFilterType]   = useState('all')
  const [filterCat, setFilterCat]     = useState('all')

  const set = (k, v) => setForm(f => ({...f, [k]: v}))
  const showToast = (msg, t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null), 3000) }
  const cats = catsFor(estate, type)
  const estateLabel = estate === 'pollachi' ? 'Pollachi Estate' : 'Pavutumuri Estate'

  useEffect(() => { if (tab === 'history') loadTxns() }, [tab, estate])

  async function loadTxns() {
    setLoadingTxns(true)
    try {
      const d = await api.getEstateTransactions(estate)
      setTxns(Array.isArray(d) ? d : [])
    } catch(e) { setTxns([]) }
    finally { setLoadingTxns(false) }
  }

  async function handleSave() {
    if (!form.date || !form.category || !form.amount) {
      showToast('Fill date, category and amount', 'error'); return
    }
    setSaving(true)
    try {
      await api.saveEstateTransaction({
        ...form, type, estate,
        ...(editId ? { txnId: editId } : {})
      })
      showToast(editId ? 'Updated ✓' : 'Saved ✓')
      setForm({...EMPTY_FORM})
      setEditId(null)
      if (tab === 'history') loadTxns()
    } catch(e) { showToast(e?.message || 'Failed', 'error') }
    finally { setSaving(false) }
  }

  function openEdit(txn) {
    setEditId(txn.txn_id)
    setType(txn.type)
    setForm({
      date:        txn.date,
      category:    txn.category,
      amount:      txn.amount,
      description: txn.description || '',
      paidTo:      txn.paid_to || '',
    })
    setTab('add')
  }

  async function handleDelete(txnId) {
    if (!confirm('Delete this entry?')) return
    try {
      await api.deleteEstateTransaction({ txnId })
      setTxns(t => t.filter(x => x.txn_id !== txnId))
      showToast('Deleted')
    } catch(e) { showToast('Delete failed', 'error') }
  }

  // Filtered history
  const filtered = txns.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterCat !== 'all' && t.category !== filterCat) return false
    return true
  })

  // Unique categories in history for filter
  const usedCats = [...new Set(txns.map(t => t.category))].sort()

  const S = {
    toggle:      { display:'flex', gap:'8px', marginBottom:'16px' },
    toggleBtn:   { flex:1, padding:'11px', borderRadius:'10px', border:'1px solid var(--border-dim)', background:'var(--dark-card)', color:'var(--text-muted)', fontSize:'0.9rem', fontWeight:'600', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" },
    toggleActive:{ background:'var(--green)', color:'#fff', border:'1px solid var(--green)' },
    tabBtn: (active) => ({ flex:1, padding:'10px', border:'none', cursor:'pointer', fontWeight:'600', fontSize:'0.8rem', background: active ? 'rgba(24,95,165,0.15)' : 'transparent', color: active ? '#85B7EB' : '#5C7080', borderBottom: active ? '2px solid #185FA5' : '2px solid transparent' }),
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div><div className="topbar-title">Income / Expense</div><div className="topbar-sub">{estateLabel.toUpperCase()}</div></div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'#111' }}>
        <button style={S.tabBtn(tab==='add')} onClick={()=>setTab('add')}>
          {editId ? '✏️ Edit entry' : '+ Add entry'}
        </button>
        <button style={S.tabBtn(tab==='history')} onClick={()=>setTab('history')}>
          📋 History {txns.length > 0 && `(${txns.length})`}
        </button>
      </div>

      <div className="screen-body">

        {/* ── ADD / EDIT TAB ── */}
        {tab === 'add' && (
          <>
            {editId && (
              <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:'8px', padding:'8px 12px', marginBottom:'12px', fontSize:'0.78rem', color:'#F59E0B' }}>
                ✏️ Editing existing entry — save to update or{' '}
                <span style={{ cursor:'pointer', textDecoration:'underline' }} onClick={()=>{setEditId(null);setForm({...EMPTY_FORM})}}>cancel</span>
              </div>
            )}

            <div style={S.toggle}>
              <button style={{...S.toggleBtn,...(type==='income'?S.toggleActive:{})}} onClick={()=>{setType('income');set('category','')}}>
                💰 Income
              </button>
              <button style={{...S.toggleBtn,...(type==='expense'?{...S.toggleActive,background:'var(--red)'}:{})}} onClick={()=>{setType('expense');set('category','')}}>
                💸 Expense
              </button>
            </div>

            <div className="card-section-label">TRANSACTION DETAILS</div>
            <div className="card">
              <div className="grid-2">
                <div className="field"><label className="field-label">Date</label>
                  <input className="field-input gold" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
                <div className="field"><label className="field-label">Amount (₹)</label>
                  <input className="field-input" type="number" placeholder="0"
                    style={{color:type==='income'?'var(--green)':'var(--red)',fontWeight:'600'}}
                    value={form.amount} onChange={e=>set('amount',e.target.value)}/></div>
              </div>
              <div className="field"><label className="field-label">Category</label>
                <select className="field-input" value={form.category} onChange={e=>set('category',e.target.value)}>
                  <option value="">Select category...</option>
                  {cats.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label className="field-label">{type==='expense'?'Paid to':'Received from'}</label>
                <input className="field-input" placeholder="Name or party" value={form.paidTo} onChange={e=>set('paidTo',e.target.value)}/></div>
              <div className="field" style={{marginBottom:0}}><label className="field-label">Description</label>
                <textarea className="field-input" placeholder="Details..." rows={2} value={form.description} onChange={e=>set('description',e.target.value)}/></div>
            </div>

            <button className={`btn ${type==='income'?'btn-green':'btn-gold'}`} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editId ? 'Update entry →' : `Save ${type} entry →`}
            </button>
            {!editId && <p className="btn-email-note">📧 Email notification sent to owner on save</p>}
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <>
            {/* Filters */}
            <div style={{ display:'flex', gap:'6px', marginBottom:'10px', flexWrap:'wrap' }}>
              {['all','income','expense'].map(f => (
                <button key={f} onClick={()=>setFilterType(f)} style={{
                  padding:'4px 12px', borderRadius:'16px', cursor:'pointer', fontSize:'0.72rem', fontWeight:'600',
                  border:`1px solid ${filterType===f?'#185FA5':'rgba(255,255,255,0.1)'}`,
                  background:filterType===f?'rgba(24,95,165,0.15)':'transparent',
                  color:filterType===f?'#85B7EB':'#5C7080',
                }}>{f === 'all' ? `All (${txns.length})` : f.charAt(0).toUpperCase()+f.slice(1)}</button>
              ))}
              <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{
                padding:'4px 10px', borderRadius:'16px', fontSize:'0.72rem',
                background:'var(--dark-input)', border:'1px solid rgba(255,255,255,0.1)',
                color:'#9AA5B4', cursor:'pointer',
              }}>
                <option value="all">All categories</option>
                {usedCats.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {loadingTxns && <div style={{ textAlign:'center', color:'#5C7080', padding:'20px', fontSize:'0.82rem' }}>Loading…</div>}

            {!loadingTxns && filtered.length === 0 && (
              <div style={{ textAlign:'center', padding:'28px', color:'#5C7080', fontSize:'0.82rem', border:'1px dashed rgba(255,255,255,0.08)', borderRadius:'12px' }}>
                No transactions found.
              </div>
            )}

            {/* "Other expense" re-categorize hint */}
            {filterCat === 'Other expense' && filtered.length > 0 && (
              <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'10px', padding:'10px 12px', marginBottom:'10px', fontSize:'0.78rem', color:'#F59E0B' }}>
                💡 {filtered.length} "Other expense" entries — tap Edit to assign the correct category (Fencing, JCB, Water pump etc.)
              </div>
            )}

            {filtered.map(txn => (
              <div key={txn.txn_id} style={{
                background:'var(--dark-card)', border:'1px solid var(--border-dim)',
                borderRadius:'10px', padding:'10px 12px', marginBottom:'6px',
                borderLeft: `3px solid ${txn.type==='income'?'#34A853':'#EF4444'}`,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                      <span style={{ fontWeight:'700', fontSize:'0.88rem', color: txn.type==='income'?'#34A853':'#EF4444' }}>
                        {txn.type==='income'?'+':'-'}{fmt(txn.amount)}
                      </span>
                      <span style={{ fontSize:'0.68rem', color:'#5C7080', background:'rgba(255,255,255,0.05)', padding:'1px 7px', borderRadius:'8px' }}>
                        {txn.category}
                      </span>
                    </div>
                    <div style={{ fontSize:'0.72rem', color:'#5C7080' }}>
                      {txn.date}{txn.paid_to ? ` · ${txn.paid_to}` : ''}{txn.description ? ` · ${txn.description}` : ''}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'6px', marginLeft:'8px' }}>
                    <button onClick={() => openEdit(txn)}
                      style={{ padding:'4px 10px', borderRadius:'7px', border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#9AA5B4', fontSize:'0.7rem', cursor:'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(txn.txn_id)}
                      style={{ padding:'4px 10px', borderRadius:'7px', border:'1px solid rgba(239,68,68,0.3)', background:'transparent', color:'#EF4444', fontSize:'0.7rem', cursor:'pointer' }}>
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.t}`}>{toast.msg}</div>}
    </div>
  )
}
