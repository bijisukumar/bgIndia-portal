/**
 * RentalAgreement.jsx
 * Capture and manage tenant agreement details for each rental property.
 * Saved to D1 → rental_props table.
 *
 * Fields: tenant name, security deposit, agreed rent, maintenance fee,
 *         lease start, lease end, notes.
 *
 * Expiry alerts:
 *   Red   — lease already expired
 *   Orange — expires within 30 days
 *   Yellow — expires within 60 days
 *   Gold   — more than 60 days remaining
 *
 * Route: /owner/rental/agreement  (Owner only)
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'

function fmt(n) {
  if (!n && n !== 0) return '—'
  return `₹${Number(n).toLocaleString('en-IN')}`
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.round((new Date(dateStr) - today) / (1000*60*60*24))
}

function leaseDurationMonths(start, end) {
  if (!start || !end) return null
  const months = Math.round((new Date(end) - new Date(start)) / (1000*60*60*24*30.44))
  return months > 0 ? months : null
}

const EMPTY_FORM = {
  tenantName: '', deposit: '', agreedRent: '', maintenance: '',
  leaseStart: '', leaseEnd: '', notes: '',
}

export default function RentalAgreement() {
  const navigate = useNavigate()
  const [selectedProp, setSelectedProp] = useState(CONFIG.rentalProperties[0]?.id || 'rental_1')
  const [form, setForm]       = useState(EMPTY_FORM)
  const [agreements, setAgreements] = useState({}) // keyed by prop_id
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const [toast, setToast]     = useState(null)

  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => { loadAgreements() }, [])

  async function loadAgreements() {
    setLoading(true)
    try {
      const data = await api.getRentalAgreements()
      const map = {}
      ;(Array.isArray(data) ? data : []).forEach(a => { map[a.prop_id] = a })
      setAgreements(map)
      // Pre-fill for first property
      if (map[selectedProp]) prefill(map[selectedProp])
    } catch (e) {
      console.warn('Could not load agreements:', e.message)
    } finally {
      setLoading(false)
    }
  }

  function prefill(agreement) {
    setForm({
      tenantName:  agreement.tenant_name   || '',
      deposit:     agreement.deposit        || '',
      agreedRent:  agreement.agreed_rent    || '',
      maintenance: agreement.maintenance_fee|| '',
      leaseStart:  agreement.lease_start    || '',
      leaseEnd:    agreement.lease_end      || '',
      notes:       agreement.notes          || '',
    })
  }

  function handlePropChange(propId) {
    setSelectedProp(propId)
    setSaved(false)
    setError('')
    if (agreements[propId]) prefill(agreements[propId])
    else setForm(EMPTY_FORM)
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    setSaved(false)
  }

  async function handleSave() {
    setError('')
    if (!form.tenantName.trim()) { setError('Tenant name is required'); return }
    if (!form.leaseStart)        { setError('Lease start date is required'); return }
    if (!form.leaseEnd)          { setError('Lease end date is required'); return }
    if (new Date(form.leaseEnd) <= new Date(form.leaseStart)) {
      setError('Lease end must be after lease start'); return
    }
    setSaving(true)
    try {
      await api.saveRentalAgreement({
        propId:      selectedProp,
        tenantName:  form.tenantName.trim(),
        deposit:     parseFloat(form.deposit)     || 0,
        agreedRent:  parseFloat(form.agreedRent)  || 0,
        maintenance: parseFloat(form.maintenance) || 0,
        leaseStart:  form.leaseStart,
        leaseEnd:    form.leaseEnd,
        notes:       form.notes.trim(),
      })
      // Update local cache
      setAgreements(prev => ({
        ...prev,
        [selectedProp]: {
          prop_id: selectedProp,
          tenant_name:    form.tenantName,
          deposit:        parseFloat(form.deposit)||0,
          agreed_rent:    parseFloat(form.agreedRent)||0,
          maintenance_fee: parseFloat(form.maintenance)||0,
          lease_start:    form.leaseStart,
          lease_end:      form.leaseEnd,
          notes:          form.notes,
        }
      }))
      setSaved(true)
      showToast(`✅ Agreement saved for ${prop?.name}`)
    } catch (e) {
      setError(`Save failed: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const prop      = CONFIG.rentalProperties.find(p => p.id === selectedProp)
  const days      = daysUntil(form.leaseEnd)
  const duration  = leaseDurationMonths(form.leaseStart, form.leaseEnd)
  const totalMonthly = (parseFloat(form.agreedRent)||0) + (parseFloat(form.maintenance)||0)

  const expiryColor =
    days === null ? 'var(--gold)' :
    days < 0      ? '#c62828' :
    days <= 30    ? '#e67e22' :
    days <= 60    ? '#f1c40f' :
                    '#34A853'

  const expiryMsg =
    days === null ? null :
    days < 0      ? `⚠️ Lease EXPIRED ${Math.abs(days)} day${Math.abs(days)!==1?'s':''} ago — renew immediately` :
    days === 0    ? '⚠️ Lease expires TODAY' :
    days <= 30    ? `⏰ Lease expires in ${days} days (${form.leaseEnd})` :
    days <= 60    ? `📅 Lease expires in ${days} days — renew soon (${form.leaseEnd})` :
                    `✓ Active — expires ${form.leaseEnd} (${days} days remaining)`

  const F = { label: { display:'block', fontSize:'0.7rem', color:'var(--text-dim)', letterSpacing:'1px', marginBottom:'4px', marginTop:'12px' },
              input: { width:'100%', padding:'9px 12px', borderRadius:'8px', boxSizing:'border-box', background:'var(--dark-input)', border:'1px solid var(--border-dim)', color:'var(--text)', fontSize:'0.9rem' } }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Tenant agreements</div>
          <div className="topbar-sub">RENTAL PROPERTIES · LEASE DETAILS</div>
        </div>
        <div style={{ width: 34 }} />
      </div>

      <div className="screen-body">

        {/* Property tabs */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
          {CONFIG.rentalProperties.map(p => {
            const a = agreements[p.id]
            const d = a?.lease_end ? daysUntil(a.lease_end) : null
            const dot = d === null ? null : d < 0 ? '#c62828' : d <= 60 ? '#e67e22' : '#34A853'
            return (
              <button key={p.id} onClick={() => handlePropChange(p.id)} style={{
                flex:1, padding:'10px 6px', borderRadius:'10px', cursor:'pointer', textAlign:'center',
                border: selectedProp===p.id ? '2px solid var(--gold)' : '1px solid var(--border-dim)',
                background: selectedProp===p.id ? 'rgba(200,144,58,0.12)' : 'var(--dark-card)',
                color:'var(--text)',
              }}>
                <div style={{ fontWeight:'700', fontSize:'0.85rem' }}>{p.name}</div>
                <div style={{ fontSize:'0.7rem', color:'var(--text-dim)', marginTop:'2px' }}>{p.location}</div>
                {dot && <div style={{ width:6, height:6, borderRadius:'50%', background:dot, margin:'4px auto 0' }} />}
                {agreements[p.id] && !dot && <div style={{ fontSize:'0.65rem', color:'var(--gold)', marginTop:'4px' }}>✓ saved</div>}
              </button>
            )
          })}
        </div>

        {loading && (
          <div style={{ textAlign:'center', color:'var(--text-dim)', padding:'24px' }}>Loading agreements…</div>
        )}

        {!loading && (
          <>
            {/* Expiry banner */}
            {expiryMsg && (
              <div style={{ background:`${expiryColor}18`, border:`1px solid ${expiryColor}55`, borderRadius:'10px', padding:'10px 14px', marginBottom:'12px', color:expiryColor, fontSize:'0.85rem', fontWeight:'600' }}>
                {expiryMsg}
              </div>
            )}

            {/* Form */}
            <div className="card-section-label">{prop?.name?.toUpperCase()} · {prop?.location}</div>
            <div className="card">

              <label style={F.label}>TENANT NAME *</label>
              <input value={form.tenantName} onChange={e => setField('tenantName', e.target.value)}
                placeholder="Full name of tenant" style={F.input} />

              <div className="grid-2">
                <div>
                  <label style={F.label}>SECURITY DEPOSIT (₹)</label>
                  <input type="number" min="0" value={form.deposit}
                    onChange={e => setField('deposit', e.target.value)}
                    placeholder="0" style={F.input} />
                </div>
                <div>
                  <label style={F.label}>AGREED RENT / MONTH (₹)</label>
                  <input type="number" min="0" value={form.agreedRent}
                    onChange={e => setField('agreedRent', e.target.value)}
                    placeholder="0" style={{ ...F.input, color:'#34A853' }} />
                </div>
                <div>
                  <label style={F.label}>MAINTENANCE / MONTH (₹)</label>
                  <input type="number" min="0" value={form.maintenance}
                    onChange={e => setField('maintenance', e.target.value)}
                    placeholder="0" style={F.input} />
                </div>
                <div>
                  <label style={F.label}>TOTAL MONTHLY (₹)</label>
                  <div style={{ ...F.input, color:'var(--gold)', fontWeight:'700', display:'flex', alignItems:'center' }}>
                    {totalMonthly > 0 ? fmt(totalMonthly) : '—'}
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ marginTop:'4px' }}>
                <div>
                  <label style={F.label}>LEASE START *</label>
                  <input type="date" value={form.leaseStart}
                    onChange={e => setField('leaseStart', e.target.value)} style={F.input} />
                </div>
                <div>
                  <label style={F.label}>LEASE END *</label>
                  <input type="date" value={form.leaseEnd}
                    onChange={e => setField('leaseEnd', e.target.value)} style={F.input} />
                </div>
              </div>

              {duration && (
                <div style={{ color:'var(--gold)', fontSize:'0.75rem', marginTop:'4px', opacity:0.8 }}>
                  Duration: {duration} month{duration!==1?'s':''}
                </div>
              )}

              <label style={F.label}>NOTES (optional)</label>
              <textarea value={form.notes} onChange={e => setField('notes', e.target.value)}
                placeholder="Special terms, parking slot, emergency contact, etc."
                rows={3} style={{ ...F.input, resize:'vertical' }} />

              {error && (
                <div style={{ color:'#EF9A9A', fontSize:'0.82rem', marginTop:'10px', background:'rgba(198,40,40,0.1)', padding:'8px 10px', borderRadius:'8px' }}>
                  ❌ {error}
                </div>
              )}
              {saved && (
                <div style={{ color:'#81C784', fontSize:'0.82rem', marginTop:'10px', background:'rgba(52,168,83,0.1)', padding:'8px 10px', borderRadius:'8px' }}>
                  ✅ Agreement saved
                </div>
              )}
            </div>

            <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : `💾 Save Agreement — ${prop?.name}`}
            </button>
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
