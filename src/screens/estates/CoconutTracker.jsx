import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'

const TODAY = new Date().toISOString().split('T')[0]

function fmt(n) {
  if (n === '' || n === null || n === undefined || isNaN(Number(n))) return '—'
  return `₹${Number(n).toLocaleString('en-IN')}`
}
function fmtN(n) { return Number(n).toLocaleString('en-IN') }
function addDays(dateStr, days) {
  if (!dateStr) return ''
  const d = new Date(dateStr); d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label className="field-label">{label}
        {hint && <span style={{ color: '#5C7080', fontWeight: 400, marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}
function CalcBox({ value, color = '#85B7EB' }) {
  return <div className="field-input" style={{ color, fontWeight: '700' }}>{value}</div>
}

export default function CoconutTracker() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const [form, setForm] = useState({
    harvesterName: '', harvestDate: TODAY, finalPaymentDate: '',
    totalNuts: '', netGoodNuts: '', nutsRejected: '', additionalUnaccounted: '0',
    totalWeightKg: '', pricePerKg: '',
    nutsRejectedB2: '', coconutRejectedRevenue: '0',
    huskCountSold: '0', huskCostPerNut: '0',
    otherEarnings: '0',
    harvestNuts: '', harvestCostPerNut: '0',
    dehuskNuts: '', dehuskCostPerNut: CONFIG.dehuskDefaultRate.toString(),
    tractorExpense: '0', otherExpense: '0',
    advancePayment: '0', advancePaymentDate: '',
    secondPayment: '0', finalSettlement: '0',
    notes: '',
  })

  const set = (k, v) => setForm(f => {
    const n = { ...f, [k]: v }
    if (k === 'totalNuts' || k === 'netGoodNuts') {
      const total = parseFloat(k === 'totalNuts' ? v : n.totalNuts) || 0
      const good  = parseFloat(k === 'netGoodNuts' ? v : n.netGoodNuts) || 0
      const rej   = Math.max(0, total - good).toString()
      n.nutsRejected = rej; n.nutsRejectedB2 = rej
      if (!n.harvestNuts || k === 'totalNuts') n.harvestNuts = total.toString()
      if (!n.dehuskNuts  || k === 'totalNuts') n.dehuskNuts  = total.toString()
    }
    return n
  })

  // Calcs
  const totalNuts        = parseFloat(form.totalNuts) || 0
  const netGoodNuts      = parseFloat(form.netGoodNuts) || 0
  const nutsRejected     = parseFloat(form.nutsRejected) || 0
  const totalWeightKg    = parseFloat(form.totalWeightKg) || 0
  const pricePerKg       = parseFloat(form.pricePerKg) || 0
  const earningsMain     = totalWeightKg * pricePerKg
  const avgWeight        = netGoodNuts > 0 ? (totalWeightKg / netGoodNuts).toFixed(3) : null
  const rejRevenue       = parseFloat(form.coconutRejectedRevenue) || 0
  const huskCount        = parseFloat(form.huskCountSold) || 0
  const huskCostPerNut   = parseFloat(form.huskCostPerNut) || 0
  const huskEarnings     = huskCount * huskCostPerNut
  const otherEarnings    = parseFloat(form.otherEarnings) || 0
  const totalEarnings    = earningsMain + rejRevenue + huskEarnings + otherEarnings
  const harvestNuts      = parseFloat(form.harvestNuts) || 0
  const harvestCostPerNut= parseFloat(form.harvestCostPerNut) || 0
  const harvestExpense   = harvestNuts * harvestCostPerNut
  const dehuskNuts       = parseFloat(form.dehuskNuts) || 0
  const dehuskCostPerNut = parseFloat(form.dehuskCostPerNut) || 0
  const dehuskExpense    = dehuskNuts * dehuskCostPerNut
  const tractorExpense   = parseFloat(form.tractorExpense) || 0
  const otherExpense     = parseFloat(form.otherExpense) || 0
  const totalExpense     = harvestExpense + dehuskExpense + tractorExpense + otherExpense
  const netIncome        = totalEarnings - totalExpense
  const advPay           = parseFloat(form.advancePayment) || 0
  const secPay           = parseFloat(form.secondPayment) || 0
  const finSettle        = parseFloat(form.finalSettlement) || 0
  const totalPaid        = advPay + secPay + finSettle
  const balanceDue       = netIncome - totalPaid
  const rejPct           = totalNuts > 0 ? nutsRejected / totalNuts : 0
  const flagNoRejRev     = nutsRejected > 0 && rejRevenue === 0
  const flagHighRej      = rejPct > 0.02
  const nextHarvestDate  = addDays(form.harvestDate, 45)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000)
  }

  const handleSave = async () => {
    if (!form.harvestDate || !form.harvesterName || !form.totalNuts || !form.totalWeightKg || !form.pricePerKg) {
      showToast('Fill in harvester name, date, nut count, weight and price/kg', 'error'); return
    }
    setSaving(true)
    try {
      await api.saveCoconutHarvest({
        ...form, nutsRejected, earningsMain, avgWeight, huskEarnings,
        totalEarnings, harvestExpense, dehuskExpense, totalExpense, netIncome,
        totalPaid, balanceDue, nextHarvestDate, flagNoRejRev, flagHighRej, estate: 'pollachi',
      })
      showToast('Harvest record saved ✓')
      setTimeout(() => navigate(-1), 1500)
    } catch { showToast('Failed to save. Check connection.', 'error') }
    finally { setSaving(false) }
  }

  const numInp = (k, style = {}) => (
    <input className="field-input" type="number" placeholder="0"
      style={style} value={form[k]} onChange={e => set(k, e.target.value)} />
  )
  const goldInp = (k, extra = {}) => (
    <input className="field-input gold" type="number" placeholder="0"
      value={form[k]} onChange={e => set(k, e.target.value)} {...extra} />
  )

  const SectionLabel = ({ children, color = 'var(--text-muted)' }) => (
    <div className="card-section-label" style={{ color }}>{children}</div>
  )

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

        {/* FLAGS */}
        {(flagNoRejRev || flagHighRej) && (
          <div style={{ background: 'rgba(198,40,40,0.12)', border: '1px solid rgba(198,40,40,0.4)', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
            {flagNoRejRev && (
              <div style={{ color: '#EF9A9A', fontSize: '0.82rem', marginBottom: flagHighRej ? '6px' : 0 }}>
                ⚠️ <strong>No rejection revenue</strong> — {fmtN(nutsRejected)} nuts rejected, ₹0 revenue entered
              </div>
            )}
            {flagHighRej && (
              <div style={{ color: '#FFCC80', fontSize: '0.82rem' }}>
                ⚠️ <strong>High rejection: {(rejPct * 100).toFixed(2)}%</strong> — above 2% threshold
              </div>
            )}
            {nextHarvestDate && (
              <div style={{ color: '#80CBC4', fontSize: '0.78rem', marginTop: '6px' }}>
                📅 Next harvest estimate: <strong>{nextHarvestDate}</strong>
              </div>
            )}
          </div>
        )}

        {/* HEADER */}
        <SectionLabel>HARVEST DETAILS</SectionLabel>
        <div className="card">
          <Field label="Harvester name">
            <input className="field-input" type="text" placeholder="e.g. Rajan Kumar"
              value={form.harvesterName} onChange={e => set('harvesterName', e.target.value)} />
          </Field>
          <div className="grid-2">
            <Field label="Harvest date">
              <input className="field-input gold" type="date"
                value={form.harvestDate} onChange={e => set('harvestDate', e.target.value)} />
            </Field>
            <Field label="Final bill payment date">
              <input className="field-input" type="date"
                value={form.finalPaymentDate} onChange={e => set('finalPaymentDate', e.target.value)} />
            </Field>
          </div>
          {nextHarvestDate && (
            <div style={{ color: '#5C7080', fontSize: '0.75rem', marginTop: '2px' }}>
              📅 Next harvest estimate: <span style={{ color: '#80CBC4' }}>{nextHarvestDate}</span>
            </div>
          )}
        </div>

        {/* BLOCK 1 */}
        <SectionLabel color="#34A853">EARNINGS — BLOCK 1 · MAIN HARVEST</SectionLabel>
        <div className="card">
          <div className="grid-2">
            <Field label="Total nuts count">{goldInp('totalNuts')}</Field>
            <Field label="Net good nuts">{goldInp('netGoodNuts')}</Field>
            <Field label="Nuts rejected" hint="(overridable)">{numInp('nutsRejected', { color: '#EF9A9A' })}</Field>
            <Field label="Additional unaccounted nuts">{numInp('additionalUnaccounted')}</Field>
            <Field label="Total weight (kg)">{goldInp('totalWeightKg', { step: '0.1' })}</Field>
            <Field label="Price / kg (₹)">{goldInp('pricePerKg', { step: '0.5' })}</Field>
            <Field label="Avg weight / nut" hint="auto">
              <CalcBox value={avgWeight ? `${avgWeight} kg` : '—'} color="#85B7EB" />
            </Field>
            <Field label="Earnings [1]" hint="wt × price/kg">
              <CalcBox value={fmt(earningsMain)} color="#34A853" />
            </Field>
          </div>
        </div>

        {/* BLOCK 2 */}
        <SectionLabel color="#FFA726">EARNINGS — BLOCK 2 · REJECTION REVENUE</SectionLabel>
        <div className="card">
          <div className="grid-2">
            <Field label="Nuts rejected" hint="(overridable)">
              <input className="field-input" type="number" placeholder="0"
                style={{ color: '#EF9A9A' }} value={form.nutsRejectedB2}
                onChange={e => set('nutsRejectedB2', e.target.value)} />
            </Field>
            <Field label="Rejected coconut revenue [2] (₹)">
              <input className="field-input" type="number" placeholder="0"
                style={{ color: '#34A853' }} value={form.coconutRejectedRevenue}
                onChange={e => set('coconutRejectedRevenue', e.target.value)} />
            </Field>
          </div>
        </div>

        {/* BLOCK 3 */}
        <SectionLabel color="#FFA726">EARNINGS — BLOCK 3 · HUSK SOLD</SectionLabel>
        <div className="card">
          <div className="grid-2">
            <Field label="Husk count sold">{numInp('huskCountSold')}</Field>
            <Field label="Cost / nut (₹)">{numInp('huskCostPerNut', { step: '0.25' })}</Field>
            <Field label="Husk earnings [3]" hint="auto">
              <CalcBox value={fmt(huskEarnings)} color="#34A853" />
            </Field>
          </div>
        </div>

        {/* BLOCK 4 */}
        <SectionLabel color="#FFA726">EARNINGS — BLOCK 4 · OTHER</SectionLabel>
        <div className="card">
          <Field label="Other earnings [4] (₹)">
            <input className="field-input" type="number" placeholder="0"
              style={{ color: '#34A853' }} value={form.otherEarnings}
              onChange={e => set('otherEarnings', e.target.value)} />
          </Field>
        </div>

        {/* TOTAL EARNINGS */}
        <div className="net-box" style={{ border: '1px solid rgba(52,168,83,0.3)' }}>
          <div className="net-row"><span className="net-label">[1] Main harvest</span><span className="net-val pos">{fmt(earningsMain)}</span></div>
          <div className="net-row"><span className="net-label">[2] Rejection revenue</span><span className="net-val pos">{fmt(rejRevenue)}</span></div>
          <div className="net-row"><span className="net-label">[3] Husk</span><span className="net-val pos">{fmt(huskEarnings)}</span></div>
          <div className="net-row"><span className="net-label">[4] Other</span><span className="net-val pos">{fmt(otherEarnings)}</span></div>
          <div className="net-divider" />
          <div className="net-row">
            <span style={{ color: '#EDF2F7', fontWeight: '600', fontSize: '1rem' }}>Total earnings</span>
            <span className="net-val big">{fmt(totalEarnings)}</span>
          </div>
        </div>

        {/* EXPENSES */}
        <SectionLabel color="#EF9A9A">EXPENSES</SectionLabel>
        <div className="card">
          <div style={sectionHead}>HARVEST</div>
          <div className="grid-2">
            <Field label="Harvested nuts">{numInp('harvestNuts')}</Field>
            <Field label="Cost / nut (₹)">{numInp('harvestCostPerNut', { step: '0.25' })}</Field>
            <Field label="Harvest expense [1]" hint="auto">
              <CalcBox value={fmt(harvestExpense)} color="#EF9A9A" />
            </Field>
          </div>
          <div className="divider" />
          <div style={sectionHead}>DEHUSK</div>
          <div className="grid-2">
            <Field label="Dehusk nuts">{numInp('dehuskNuts')}</Field>
            <Field label="Cost / nut (₹)">{numInp('dehuskCostPerNut', { step: '0.25' })}</Field>
            <Field label="Dehusk expense [2]" hint="auto">
              <CalcBox value={fmt(dehuskExpense)} color="#EF9A9A" />
            </Field>
          </div>
          <div className="divider" />
          <div className="grid-2">
            <Field label="Tractor expense [3] (₹)">{numInp('tractorExpense')}</Field>
            <Field label="Other expense [4] (₹)">{numInp('otherExpense')}</Field>
          </div>
        </div>

        {/* NET INCOME */}
        <SectionLabel>NET HARVEST INCOME</SectionLabel>
        <div className="net-box">
          <div className="net-row"><span className="net-label">Total earnings</span><span className="net-val pos">{fmt(totalEarnings)}</span></div>
          <div className="net-row"><span className="net-label">Harvest expense [1]</span><span className="net-val neg">−{fmt(harvestExpense)}</span></div>
          <div className="net-row"><span className="net-label">Dehusk expense [2]</span><span className="net-val neg">−{fmt(dehuskExpense)}</span></div>
          {tractorExpense > 0 && <div className="net-row"><span className="net-label">Tractor expense [3]</span><span className="net-val neg">−{fmt(tractorExpense)}</span></div>}
          {otherExpense > 0   && <div className="net-row"><span className="net-label">Other expense [4]</span><span className="net-val neg">−{fmt(otherExpense)}</span></div>}
          <div className="net-divider" />
          <div className="net-row">
            <span style={{ color: '#EDF2F7', fontWeight: '700', fontSize: '1.05rem' }}>Net harvest income</span>
            <span className={`net-val big ${netIncome < 0 ? 'neg' : ''}`}>{fmt(netIncome)}</span>
          </div>
        </div>

        {/* PAYMENTS */}
        <SectionLabel>PAYMENTS</SectionLabel>
        <div className="card">
          <div className="grid-2">
            <Field label="Advance payment (₹)">
              <input className="field-input gold" type="number" placeholder="0"
                value={form.advancePayment} onChange={e => set('advancePayment', e.target.value)} />
            </Field>
            <Field label="Advance date">
              <input className="field-input" type="date"
                value={form.advancePaymentDate} onChange={e => set('advancePaymentDate', e.target.value)} />
            </Field>
            <Field label="2nd payment (₹)">{numInp('secondPayment')}</Field>
            <Field label="Final settlement (₹)">{numInp('finalSettlement')}</Field>
          </div>
          <div className="divider" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#EDF2F7', fontWeight: '600' }}>Balance due</span>
            <span style={{
              color: balanceDue === 0 ? '#34A853' : balanceDue < 0 ? '#EF9A9A' : '#FFCC80',
              fontWeight: '700', fontSize: '1.1rem',
            }}>
              {balanceDue === 0 ? '✓ Settled' : fmt(balanceDue)}
            </span>
          </div>
          {balanceDue < 0 && (
            <div style={{ color: '#EF9A9A', fontSize: '0.75rem', marginTop: '4px' }}>
              ⚠️ Overpaid by {fmt(Math.abs(balanceDue))}
            </div>
          )}
        </div>

        {/* NOTES */}
        <div className="card">
          <Field label="Notes">
            <textarea className="field-input" placeholder="Any notes for this harvest..."
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </Field>
        </div>

        <button className="btn btn-teal" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save harvest record →'}
        </button>
        <p className="btn-email-note">📧 Email sent with harvest summary + next harvest date on save</p>

      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

const sectionHead = { fontSize: '0.72rem', color: '#5C7080', letterSpacing: '1px', marginBottom: '8px' }
