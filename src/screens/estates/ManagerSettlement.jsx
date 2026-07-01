import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { localTodayStr, fmtDate } from '../../utils/dates'

function fmt(n) { return isNaN(n) || n === '' ? '₹0' : `₹${Number(n).toLocaleString('en-IN')}` }
const METHODS = ['cash', 'bank', 'upi', 'other']

export default function ManagerSettlement({ estate = 'pavutumuri' }) {
  const navigate = useNavigate()
  const [data, setData]     = useState({ payments: [], totalExpenses: 0, totalPaid: 0, balance: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState(null)
  const [form, setForm] = useState({
    paymentDate: localTodayStr(), amount: '', method: 'cash', note: '',
    managerName: 'Madhavan', payerName: 'Raman',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  async function load() {
    setLoading(true)
    try {
      const d = await api.getManagerSettlements(estate)
      setData(d || { payments: [], totalExpenses: 0, totalPaid: 0, balance: 0 })
      // Keep name fields in sync with the most recent record, if any
      const last = d?.payments?.[0]
      if (last) setForm(f => ({ ...f, managerName: last.manager_name || f.managerName, payerName: last.payer_name || f.payerName }))
    } catch { setData({ payments: [], totalExpenses: 0, totalPaid: 0, balance: 0 }) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [estate])

  async function handleSave() {
    if (!form.paymentDate || !form.amount) { showToast('Enter date and amount', 'error'); return }
    setSaving(true)
    try {
      await api.saveManagerSettlement({ estate, ...form })
      showToast('Payment recorded ✓')
      setForm(f => ({ ...f, amount: '', note: '' }))
      load()
    } catch (e) { showToast(e?.message || 'Failed', 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this payment?')) return
    try { await api.deleteManagerSettlement({ settlementId: id }); load() }
    catch { showToast('Delete failed', 'error') }
  }

  const mgr = form.managerName || 'Madhavan'
  const balance = data.balance || 0
  const owes = balance > 0

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div><div className="topbar-title">Manager settlement</div><div className="topbar-sub">PAVUTUMURI ESTATE · {mgr.toUpperCase()}</div></div>
      </div>

      <div className="screen-body">
        {/* Balance summary */}
        <div className="net-box" style={{ borderColor: owes ? 'rgba(239,68,68,0.35)' : 'rgba(52,168,83,0.35)' }}>
          <div className="net-row"><span className="net-label">Total estate expenses</span><span className="net-val">{fmt(data.totalExpenses)}</span></div>
          <div className="net-row"><span className="net-label">Paid to {mgr}</span><span className="net-val pos">−{fmt(data.totalPaid)}</span></div>
          <div className="net-divider" />
          <div className="net-row">
            <span style={{ color: '#EDF2F7', fontWeight: 600, fontSize: '1rem' }}>
              {owes ? `Balance owed to ${mgr}` : balance < 0 ? `${mgr} overpaid` : 'Settled up'}
            </span>
            <span className="net-val big" style={{ color: owes ? '#EF4444' : '#34A853' }}>{fmt(Math.abs(balance))}</span>
          </div>
          {loading && <div style={{ fontSize: '0.72rem', color: '#5C7080', marginTop: '6px' }}>loading…</div>}
        </div>

        <div className="card-section-label">RECORD A PAYMENT</div>
        <div className="card">
          <div className="grid-2">
            <div className="field"><label className="field-label">Payment date</label>
              <input className="field-input gold" type="date" value={form.paymentDate} onChange={e => set('paymentDate', e.target.value)} /></div>
            <div className="field"><label className="field-label">Amount (₹)</label>
              <input className="field-input" type="number" placeholder="0" style={{ color: '#34A853', fontWeight: 600 }}
                value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="field-label">From (payer)</label>
              <input className="field-input" value={form.payerName} onChange={e => set('payerName', e.target.value)} /></div>
            <div className="field"><label className="field-label">To (manager)</label>
              <input className="field-input" value={form.managerName} onChange={e => set('managerName', e.target.value)} /></div>
          </div>
          <div className="field"><label className="field-label">Method</label>
            <select className="field-input" value={form.method} onChange={e => set('method', e.target.value)}>
              {METHODS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}><label className="field-label">Note</label>
            <input className="field-input" placeholder="e.g. part payment for May expenses" value={form.note} onChange={e => set('note', e.target.value)} /></div>
        </div>

        <button className="btn btn-teal" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : `Record ${form.payerName || 'Raman'} → ${mgr} payment →`}
        </button>
        <p className="btn-email-note">📧 Owner emailed on save · unpaid balance carries into next month</p>

        <div className="card-section-label" style={{ marginTop: '18px' }}>PAYMENT HISTORY {data.payments.length > 0 && `(${data.payments.length})`}</div>
        {!loading && data.payments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#5C7080', fontSize: '0.82rem', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px' }}>
            No payments recorded yet.
          </div>
        )}
        {data.payments.map(p => (
          <div key={p.settlement_id} style={{ background: 'var(--dark-card)', border: '1px solid var(--border-dim)', borderLeft: '3px solid #34A853', borderRadius: '10px', padding: '10px 12px', marginBottom: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#34A853' }}>{fmt(p.amount)}</span>
                  <span style={{ fontSize: '0.66rem', color: '#5C7080', background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: '8px' }}>{(p.method || 'cash').toUpperCase()}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#5C7080' }}>
                  {fmtDate(p.payment_date)} · {p.payer_name} → {p.manager_name}{p.note ? ` · ${p.note}` : ''}
                </div>
              </div>
              <button onClick={() => handleDelete(p.settlement_id)}
                style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#EF4444', fontSize: '0.7rem', cursor: 'pointer', marginLeft: '8px' }}>×</button>
            </div>
          </div>
        ))}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
