/**
 * StaffAccess.jsx
 * Maintenance > Staff & Access — owner self-service for staff logins.
 * Reset a PIN, lock/unlock an account, or add a new staff login — all
 * without ever running a SQL script by hand. PINs are generated and
 * hashed server-side; the plaintext PIN is shown here exactly once.
 * Route: /owner/maintenance/staff
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../hooks/useAuth'

const COMP_TYPES = [
  { id: 'commission',              label: 'Commission only',       hint: 'Earns commission per stay, no fixed pay' },
  { id: 'salary',                  label: 'Salaried',              hint: 'Fixed pay, never earns commission' },
  { id: 'salary_plus_commission',  label: 'Salary + commission',   hint: 'Fixed pay AND earns commission per stay' },
]

function compLabel(c) {
  return COMP_TYPES.find(t => t.id === c)?.label || c || '—'
}

function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(String(d).replace(' ', 'T')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}

export default function StaffAccess() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [staff, setStaff]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast]   = useState(null)
  const [busyActor, setBusyActor] = useState(null)
  const [revealedPin, setRevealedPin] = useState(null) // { actorSlug, label, pin }
  const [addOpen, setAddOpen] = useState(false)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const load = () => {
    setLoading(true)
    api.getStaffAccounts().then(setStaff).catch(() => setStaff([])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleReset = async (row) => {
    if (!window.confirm(`Reset ${row.label || row.actor}'s PIN? Their current PIN will stop working immediately.`)) return
    setBusyActor(row.actor)
    try {
      const r = await api.resetStaffPin({ actorSlug: row.actor })
      setRevealedPin({ actorSlug: row.actor, label: row.label || row.actor, pin: r.pin })
    } catch (e) { showToast(e?.message || 'Failed to reset PIN', 'error') }
    finally { setBusyActor(null) }
  }

  const handleToggleActive = async (row) => {
    const nextActive = !row.active
    if (!nextActive && !window.confirm(`Lock ${row.label || row.actor}'s account? They won't be able to log in again until unlocked.`)) return
    setBusyActor(row.actor)
    try {
      await api.setStaffActive({ actorSlug: row.actor, active: nextActive })
      showToast(nextActive ? `${row.label || row.actor} unlocked ✓` : `${row.label || row.actor} locked ✓`)
      load()
    } catch (e) { showToast(e?.message || 'Failed to update', 'error') }
    finally { setBusyActor(null) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Staff &amp; Access</div>
          <div className="topbar-sub">MAINTENANCE · LOGINS &amp; PINS</div>
        </div>
        <div style={{ width: 34 }} />
      </div>

      <div className="screen-body">

        {revealedPin && (
          <div style={{ background: 'rgba(95,208,174,0.1)', border: '1px solid rgba(95,208,174,0.4)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#5FD0AE', letterSpacing: '1px', marginBottom: '8px' }}>
              NEW PIN FOR {(revealedPin.label || '').toUpperCase()} — SHOWN ONCE
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '6px', color: '#fff', fontFamily: 'monospace', marginBottom: '8px' }}>
              {revealedPin.pin}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#9AA5B4', marginBottom: '12px' }}>
              Share this with them now (in person or a message you'll delete) — it won't be shown again. We only ever store a one-way hash of it.
            </div>
            <button className="btn" style={{ width: '100%' }} onClick={() => { setRevealedPin(null); load() }}>Done</button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div className="card-section-label" style={{ marginBottom: 0 }}>STAFF LOGINS</div>
          <button onClick={() => setAddOpen(o => !o)} style={{ fontSize: '0.76rem', fontWeight: 700, color: '#5FD0AE', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            {addOpen ? '✕ Cancel' : '+ Add staff'}
          </button>
        </div>

        {addOpen && <AddStaffForm onDone={(pin, label, actorSlug) => { setAddOpen(false); setRevealedPin({ actorSlug, label, pin }) }} onCancel={() => setAddOpen(false)} showToast={showToast} />}

        {loading ? (
          <div className="loading"><div className="spinner" />Loading…</div>
        ) : !staff?.length ? (
          <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>No staff logins yet</div>
        ) : (
          <div style={{ background: 'var(--dark-card)', borderRadius: '12px', border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
            {staff.map((row, i) => (
              <div key={row.actor} style={{ padding: '14px 16px', borderBottom: i < staff.length - 1 ? '1px solid var(--border-dim)' : 'none', opacity: row.active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {row.label || row.actor}
                    {row.actor === user?.actor && <span style={{ fontSize: '0.65rem', color: '#5C7080', marginLeft: '6px' }}>(you)</span>}
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                    background: row.active ? 'rgba(52,168,83,0.15)' : 'rgba(198,40,40,0.15)',
                    color: row.active ? '#34A853' : '#EF4444' }}>
                    {row.active ? 'ACTIVE' : 'LOCKED'}
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '10px' }}>
                  {row.role} · {compLabel(row.comp_type)} · code: {row.actor} · since {fmtDate(row.created_at)}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => handleReset(row)} disabled={busyActor === row.actor}
                    style={{ fontSize: '0.76rem', fontWeight: 700, padding: '8px 12px', borderRadius: '8px',
                      background: 'rgba(133,183,235,0.1)', border: '1px solid rgba(133,183,235,0.3)', color: '#85B7EB', cursor: 'pointer' }}>
                    🔑 Reset PIN
                  </button>
                  {row.actor !== user?.actor && (
                    <button onClick={() => handleToggleActive(row)} disabled={busyActor === row.actor}
                      style={{ fontSize: '0.76rem', fontWeight: 700, padding: '8px 12px', borderRadius: '8px',
                        background: row.active ? 'rgba(239,68,68,0.1)' : 'rgba(52,168,83,0.1)',
                        border: row.active ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(52,168,83,0.3)',
                        color: row.active ? '#EF4444' : '#34A853', cursor: 'pointer' }}>
                      {row.active ? '🔒 Lock' : '🔓 Unlock'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '14px', fontSize: '0.7rem', color: '#5C7080', lineHeight: 1.5 }}>
          Locking takes effect on next login — a session already in progress stays valid until it expires (up to 12 hours) or they log out.
        </div>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

function AddStaffForm({ onDone, onCancel, showToast }) {
  const [label, setLabel] = useState('')
  const [actorSlug, setActorSlug] = useState('')
  const [compType, setCompType] = useState('salary')
  const [baseSalary, setBaseSalary] = useState('')
  const [commissionSingle, setCommissionSingle] = useState('1000')
  const [commissionMulti, setCommissionMulti] = useState('2000')
  const [busy, setBusy] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  const setLabelAndSlug = (v) => {
    setLabel(v)
    if (!slugTouched) setActorSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  const submit = async () => {
    if (!label.trim()) { showToast('Enter a name', 'error'); return }
    setBusy(true)
    try {
      const r = await api.addStaffAccount({
        label: label.trim(), actorSlug, compType,
        baseSalary: baseSalary || 0,
        commissionSingleNight: commissionSingle, commissionMultiNight: commissionMulti,
      })
      onDone(r.pin, label.trim(), r.actorSlug)
    } catch (e) { showToast(e?.message || 'Failed to add staff', 'error') }
    finally { setBusy(false) }
  }

  const inp = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-dim)', background: 'var(--dark-input)', color: '#EDF2F7', fontSize: '0.85rem', boxSizing: 'border-box' }

  return (
    <div className="card" style={{ marginBottom: '14px' }}>
      <div className="field" style={{ marginBottom: '10px' }}>
        <label className="field-label">Name</label>
        <input style={inp} value={label} onChange={e => setLabelAndSlug(e.target.value)} placeholder="e.g. Pradosh" />
      </div>
      <div className="field" style={{ marginBottom: '10px' }}>
        <label className="field-label">Login code</label>
        <input style={inp} value={actorSlug} onChange={e => { setSlugTouched(true); setActorSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }} placeholder="e.g. staff-pradosh" />
      </div>
      <div className="field" style={{ marginBottom: '10px' }}>
        <label className="field-label">Pay type</label>
        {COMP_TYPES.map(t => (
          <label key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 0', cursor: 'pointer' }}>
            <input type="radio" checked={compType === t.id} onChange={() => setCompType(t.id)} style={{ marginTop: '3px' }} />
            <div>
              <div style={{ fontSize: '0.84rem', color: '#EDF2F7' }}>{t.label}</div>
              <div style={{ fontSize: '0.68rem', color: '#5C7080' }}>{t.hint}</div>
            </div>
          </label>
        ))}
      </div>
      {(compType === 'salary' || compType === 'salary_plus_commission') && (
        <div className="field" style={{ marginBottom: '10px' }}>
          <label className="field-label">Base salary (₹, optional — no payroll feature uses this yet)</label>
          <input style={inp} type="number" inputMode="decimal" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} placeholder="0" />
        </div>
      )}
      {(compType === 'commission' || compType === 'salary_plus_commission') && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">₹ / 1-night stay</label>
            <input style={inp} type="number" inputMode="decimal" value={commissionSingle} onChange={e => setCommissionSingle(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">₹ / 2+ night stay</label>
            <input style={inp} type="number" inputMode="decimal" value={commissionMulti} onChange={e => setCommissionMulti(e.target.value)} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-teal" style={{ flex: 2 }} disabled={busy} onClick={submit}>{busy ? 'Adding…' : 'Add staff & generate PIN'}</button>
        <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
