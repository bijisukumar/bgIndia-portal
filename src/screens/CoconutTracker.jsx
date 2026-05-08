import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { CONFIG } from '../config'

const TODAY = new Date().toISOString().split('T')[0]

function fmt(n) {
  return isNaN(n) || n === '' ? '—' : `₹${Number(n).toLocaleString('en-IN')}`
}

export default function CoconutTracker() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState(null)

  const [form, setForm] = useState({
    harvestDate:       TODAY,
    paymentDate:       '',
    totalCount:        '',
    rejectionCount:    '',
    totalWeight:       '',
    pricePerKg:        '',
    rejectionRevenue:  '',
    dehuskRate:        String(CONFIG.dehuskDefaultRate),
    transport:         '',
    otherCharges:      '',
    harvesterName:     '',
    notes:             '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Derived calculations
  const totalCount     = parseFloat(form.totalCount)     || 0
  const rejectionCount = parseFloat(form.rejectionCount) || 0
  const netCount       = Math.max(0, totalCount - rejectionCount)
  const totalWeight    = parseFloat(form.totalWeight)    || 0
  const pricePerKg     = parseFloat(form.pricePerKg)     || 0
  const totalAmount    = totalWeight * pricePerKg
  const rejRevenue     = parseFloat(form.rejectionRevenue) || 0
  const dehuskRate     = parseFloat(form.dehuskRate)     || 0
  const dehuskTotal    = totalCount * dehuskRate
  const transport      = parseFloat(form.transport)      || 0
  const otherCharges   = parseFloat(form.otherCharges)   || 0
  const totalExpenses  = dehuskTotal + transport + otherCharges
  const netIncome      = totalAmount + rejRevenue - totalExpenses

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSave = async () => {
    if (!form.harvestDate || !form.totalCount || !form.totalWeight || !form.pricePerKg) {
      showToast('Please fill harvest date, count, weight and price', 'error')
      return
    }
    setSaving(true)
    try {
      await api.saveCoconutHarvest({
        ...form,
        netCount,
        totalAmount,
        dehuskTotal,
        totalExpenses,
        netIncome,
        estate: 'pollachi',
      })
      showToast('Harvest record saved ✓')
      setTimeout(() => navigate(-1), 1500)
    } catch (e) {
      showToast('Failed to save. Check connection.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Coconut tracker</div>
          <div className="topbar-sub">POLLACHI ESTATE · HARVEST LOG</div>
        </div>
      </div>

      <div className="screen-body">

        {/* HARVEST DETAILS */}
        <div className="card-section-label">HARVEST DETAILS</div>
        <div className="card">
          <div className="grid-2">
            <div className="field">
              <label className="field-label">Harvest date</label>
              <input className="field-input gold" type="date"
                value={form.harvestDate} onChange={e => set('harvestDate', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Payment date</label>
              <input className="field-input gold" type="date"
                value={form.paymentDate} onChange={e => set('paymentDate', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Harvester name</label>
            <input className="field-input" type="text" placeholder="e.g. Rajan Kumar"
              value={form.harvesterName} onChange={e => set('harvesterName', e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="field-label">Total coconut count</label>
              <input className="field-input gold" type="number" placeholder="0"
                value={form.totalCount} onChange={e => set('totalCount', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Coconut rejection</label>
              <input className="field-input" type="number" placeholder="0"
                style={{ color: '#EF9A9A' }}
                value={form.rejectionCount} onChange={e => set('rejectionCount', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Net count (billable)</label>
              <div className="field-input" style={{ color: '#85B7EB', fontWeight: '600' }}>
                {netCount.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="field">
              <label className="field-label">Total weight (kg)</label>
              <input className="field-input" type="number" placeholder="0"
                value={form.totalWeight} onChange={e => set('totalWeight', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Price / kg (₹)</label>
              <input className="field-input gold" type="number" placeholder="0.00" step="0.50"
                value={form.pricePerKg} onChange={e => set('pricePerKg', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Total amount</label>
              <div className="field-input" style={{ color: '#34A853', fontWeight: '700' }}>
                {fmt(totalAmount)}
              </div>
            </div>
          </div>
          <div className="divider" />
          <div className="field">
            <label className="field-label">Coconut rejection revenue (₹)</label>
            <input className="field-input" type="number" placeholder="0"
              style={{ color: '#34A853' }}
              value={form.rejectionRevenue} onChange={e => set('rejectionRevenue', e.target.value)} />
          </div>
        </div>

        {/* EXPENSES */}
        <div className="card-section-label">EXPENSES</div>
        <div className="card">
          <div className="grid-2">
            <div className="field">
              <label className="field-label">Dehusk rate (₹ / coconut)</label>
              <input className="field-input gold" type="number" step="0.25" placeholder="1.50"
                value={form.dehuskRate} onChange={e => set('dehuskRate', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Total dehusk (auto)</label>
              <div className="field-input" style={{ color: '#EF9A9A', fontWeight: '600' }}>
                {fmt(dehuskTotal)}
              </div>
            </div>
          </div>
          <div className="field">
            <label className="field-label">Transportation (₹)</label>
            <input className="field-input" type="number" placeholder="0"
              value={form.transport} onChange={e => set('transport', e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Other charges (₹)</label>
            <input className="field-input" type="number" placeholder="0"
              value={form.otherCharges} onChange={e => set('otherCharges', e.target.value)} />
          </div>
        </div>

        {/* NET INCOME SUMMARY */}
        <div className="card-section-label">NET HARVEST INCOME</div>
        <div className="net-box">
          <div className="net-row">
            <span className="net-label">Total amount</span>
            <span className="net-val pos">{fmt(totalAmount)}</span>
          </div>
          {rejRevenue > 0 && (
            <div className="net-row">
              <span className="net-label">Rejection revenue</span>
              <span className="net-val pos">+{fmt(rejRevenue)}</span>
            </div>
          )}
          <div className="net-row">
            <span className="net-label">Dehusk charges</span>
            <span className="net-val neg">−{fmt(dehuskTotal)}</span>
          </div>
          {transport > 0 && (
            <div className="net-row">
              <span className="net-label">Transportation</span>
              <span className="net-val neg">−{fmt(transport)}</span>
            </div>
          )}
          {otherCharges > 0 && (
            <div className="net-row">
              <span className="net-label">Other charges</span>
              <span className="net-val neg">−{fmt(otherCharges)}</span>
            </div>
          )}
          <div className="net-divider" />
          <div className="net-row">
            <span style={{ color: '#EDF2F7', fontWeight: '600', fontSize: '1rem' }}>Net income</span>
            <span className={`net-val big ${netIncome < 0 ? 'neg' : ''}`}>{fmt(netIncome)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Notes (optional)</label>
            <textarea className="field-input" placeholder="Any notes for this harvest..."
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <button className="btn btn-teal" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save harvest record →'}
        </button>
        <p className="btn-email-note">📧 Email notification sent to owner on save</p>

      </div>

      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}
