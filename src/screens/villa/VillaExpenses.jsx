import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { localTodayStr } from '../../utils/dates'

const TODAY = localTodayStr()

// DEFAULT category list. Per-villa override lives in villa_settings key
// 'expense_categories' (JSON array) — loaded on mount below — so onboarding
// a new villa means saving a different list via saveVillaSetting, no code
// change. Reporting is category-agnostic (history filter derives from actual
// txns; P&L sums all rows), so lists can differ freely per villa.
export const VILLA_EXPENSE_CATS = [
  'Electricity',
  'Maintenance',
  'Repairs',
  'Laundry',
  'Deep Cleaning',
  'Housekeeping Supplies',
  'Pest Control (Mosquito & Bats)',
  'Kitchen Crockery',
  'Kitchen Supplies',
  'Appliance / AC Service',
  'Landscaping',
  'Painting',
  'Water Filtration System',
  'Water System — Motor & Associated',
  'Bulk Purchases (Soap, Shampoo, Body Wash etc.)',
  'Other',
]

function fmt(n) { return isNaN(n) || n === '' ? '—' : `₹${Number(n).toLocaleString('en-IN')}` }

const EMPTY_FORM = { date: TODAY, category: '', amount: '', description: '', paidTo: '' }

export default function VillaExpenses() {
  const navigate   = useNavigate()
  const villaId     = 'dwarka'
  const [tab, setTab]       = useState('add')        // 'add' | 'history'
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState(null)
  const [form, setForm]     = useState({ ...EMPTY_FORM })
  const [editId, setEditId] = useState(null)
  const scanRef = useRef(null)
  const [scanBusy, setScanBusy] = useState(false)   // reading a receipt
  const [scanHint, setScanHint] = useState('')

  const [txns, setTxns]               = useState([])
  const [loadingTxns, setLoadingTxns] = useState(false)
  const [filterCat, setFilterCat]     = useState('all')

  // Categories: per-villa configurable via villa_settings, default fallback.
  const [cats, setCats] = useState(VILLA_EXPENSE_CATS)
  useEffect(() => {
    api.getVillaSettings(villaId).then(res => {
      try {
        const parsed = JSON.parse(res?.data?.expense_categories || 'null')
        if (Array.isArray(parsed) && parsed.length) setCats(parsed)
      } catch (e) { /* keep defaults */ }
    }).catch(() => { /* keep defaults */ })
  }, [villaId])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const showToast = (msg, t = 'success') => { setToast({ msg, t }); setTimeout(() => setToast(null), 3000) }

  // Scan a receipt → OCR → pre-fill the expense form. v1 is read-only: the
  // image is only used to read fields and is not stored. Raman verifies and
  // saves; if it can't be read he just types it in.
  function handleScan(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      if (file.type && file.type.startsWith('image/')) runReceiptOcr(ev.target.result.split(',')[1])
      else setScanHint('Please use a photo of the receipt')
    }
    reader.readAsDataURL(file)
    e.target.value = ''   // allow re-scanning the same file
  }

  async function runReceiptOcr(b64) {
    if (!b64) return
    setScanBusy(true); setScanHint('')
    try {
      const res = await api.ocrReceipt({ receiptPhotoB64: b64, villaId })
      const f = res?.fields || {}
      setForm(prev => ({
        ...prev,
        paidTo:      f.vendor      || prev.paidTo,
        amount:      f.amount      ? String(f.amount) : prev.amount,
        date:        f.date        || prev.date,
        category:    f.category    || prev.category,
        description: f.description || prev.description,
      }))
      setScanHint((f.vendor || f.amount || f.date)
        ? '✨ Filled from the receipt — please check each field before saving'
        : "Couldn't read the receipt — please enter it manually")
    } catch (e) {
      setScanHint("Couldn't read the receipt — please enter it manually")
    } finally {
      setScanBusy(false)
    }
  }

  useEffect(() => { if (tab === 'history') loadTxns() }, [tab])

  async function loadTxns() {
    setLoadingTxns(true)
    try {
      const d = await api.getVillaExpenses(villaId)
      setTxns(Array.isArray(d) ? d : [])
    } catch { setTxns([]) }
    finally { setLoadingTxns(false) }
  }

  async function handleSave() {
    if (!form.date || !form.category || !form.amount) {
      showToast('Fill date, category and amount', 'error'); return
    }
    setSaving(true)
    try {
      await api.saveVillaExpense({
        villaId, ...form,
        ...(editId ? { txnId: editId } : {}),
      })
      showToast(editId ? 'Updated ✓' : 'Saved ✓')
      setForm({ ...EMPTY_FORM })
      setEditId(null)
      if (tab === 'history') loadTxns()
    } catch (e) { showToast(e?.message || 'Failed', 'error') }
    finally { setSaving(false) }
  }

  function openEdit(txn) {
    setEditId(txn.txn_id)
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
    if (!confirm('Delete this expense entry?')) return
    try {
      await api.deleteVillaExpense({ txnId })
      setTxns(t => t.filter(x => x.txn_id !== txnId))
      showToast('Deleted')
    } catch { showToast('Delete failed', 'error') }
  }

  const filtered = txns.filter(t => filterCat === 'all' || t.category === filterCat)
  const usedCats = [...new Set(txns.map(t => t.category))].sort()
  const monthTotal = txns
    .filter(t => (t.date || '').slice(0, 7) === TODAY.slice(0, 7))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)

  const S = {
    tabBtn: (active) => ({ flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', background: active ? 'rgba(24,95,165,0.15)' : 'transparent', color: active ? '#85B7EB' : '#5C7080', borderBottom: active ? '2px solid #185FA5' : '2px solid transparent' }),
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div><div className="topbar-title">Villa Expenses</div><div className="topbar-sub">DWARKA · RECURRING COSTS</div></div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111' }}>
        <button style={S.tabBtn(tab === 'add')} onClick={() => setTab('add')}>
          {editId ? '✏️ Edit entry' : '+ Add expense'}
        </button>
        <button style={S.tabBtn(tab === 'history')} onClick={() => setTab('history')}>
          📋 History {txns.length > 0 && `(${txns.length})`}
        </button>
      </div>

      <div className="screen-body">

        {tab === 'add' && (
          <>
            {editId && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '0.78rem', color: '#F59E0B' }}>
                ✏️ Editing existing entry — save to update or{' '}
                <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setEditId(null); setForm({ ...EMPTY_FORM }) }}>cancel</span>
              </div>
            )}

            <div className="card-section-label">EXPENSE DETAILS</div>
            <div className="card">
              <input ref={scanRef} type="file" accept="image/*" capture="environment"
                onChange={handleScan} style={{ display: 'none' }} />
              <button type="button" onClick={() => scanRef.current?.click()} disabled={scanBusy}
                style={{ width: '100%', padding: '11px', marginBottom: scanHint ? '6px' : '12px',
                  borderRadius: '10px', border: '1px solid rgba(200,144,58,0.4)',
                  background: 'rgba(200,144,58,0.1)', color: 'var(--gold)', fontWeight: 600,
                  fontSize: '0.85rem', cursor: 'pointer' }}>
                {scanBusy ? '🔎 Reading receipt…' : '📷 Scan receipt'}
              </button>
              {scanHint && (
                <div style={{ fontSize: '0.72rem', color: '#9aa4b2', marginBottom: '12px' }}>{scanHint}</div>
              )}
              <div className="grid-2">
                <div className="field"><label className="field-label">Date</label>
                  <input className="field-input gold" type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
                <div className="field"><label className="field-label">Amount (₹)</label>
                  <input className="field-input" type="number" placeholder="0"
                    style={{ color: 'var(--red)', fontWeight: '600' }}
                    value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
              </div>
              <div className="field"><label className="field-label">Category</label>
                <select className="field-input" value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">Select category...</option>
                  {cats.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label className="field-label">Paid to</label>
                <input className="field-input" placeholder="Name or vendor" value={form.paidTo} onChange={e => set('paidTo', e.target.value)} /></div>
              <div className="field" style={{ marginBottom: 0 }}><label className="field-label">Description</label>
                <textarea className="field-input" placeholder="Details..." rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>
            </div>

            <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editId ? 'Update entry →' : 'Save expense →'}
            </button>
            {!editId && <p className="btn-email-note">📧 Owner notified on save</p>}
          </>
        )}

        {tab === 'history' && (
          <>
            <div style={{
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '10px', padding: '10px 14px', marginBottom: '12px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.78rem', color: '#9AA5B4' }}>This month's total</span>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: '#EF4444' }}>{fmt(monthTotal)}</span>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setFilterCat('all')} style={{
                padding: '4px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600',
                border: `1px solid ${filterCat === 'all' ? '#185FA5' : 'rgba(255,255,255,0.1)'}`,
                background: filterCat === 'all' ? 'rgba(24,95,165,0.15)' : 'transparent',
                color: filterCat === 'all' ? '#85B7EB' : '#5C7080',
              }}>All ({txns.length})</button>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{
                padding: '4px 10px', borderRadius: '16px', fontSize: '0.72rem',
                background: 'var(--dark-input)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#9AA5B4', cursor: 'pointer',
              }}>
                <option value="all">All categories</option>
                {usedCats.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {loadingTxns && <div style={{ textAlign: 'center', color: '#5C7080', padding: '20px', fontSize: '0.82rem' }}>Loading…</div>}

            {!loadingTxns && filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '28px', color: '#5C7080', fontSize: '0.82rem', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px' }}>
                No expenses logged yet.
              </div>
            )}

            {filtered.map(txn => (
              <div key={txn.txn_id} style={{
                background: 'var(--dark-card)', border: '1px solid var(--border-dim)',
                borderRadius: '10px', padding: '10px 12px', marginBottom: '6px',
                borderLeft: '3px solid #EF4444',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#EF4444' }}>−{fmt(txn.amount)}</span>
                      <span style={{ fontSize: '0.68rem', color: '#5C7080', background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: '8px' }}>
                        {txn.category}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#5C7080' }}>
                      {txn.date}{txn.paid_to ? ` · ${txn.paid_to}` : ''}{txn.description ? ` · ${txn.description}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
                    <button onClick={() => openEdit(txn)}
                      style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9AA5B4', fontSize: '0.7rem', cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(txn.txn_id)}
                      style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#EF4444', fontSize: '0.7rem', cursor: 'pointer' }}>
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
