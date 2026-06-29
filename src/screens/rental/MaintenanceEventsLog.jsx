// ============================================================
//  MaintenanceEventsLog.jsx
//  Per-property maintenance/repair event log for a given month/year,
//  replacing the old single "Add. maintenance" manual number field
//  (per explicit decision, 2026-06-29). A property can have multiple
//  separate events in the same month (e.g. a fridge repair AND a
//  plumbing fix), each with its own category, amount, and a free-text
//  description of what was actually done (e.g. "Fridge fan repair by
//  Bob") -- the category list is fixed, confirmed with the owner, not
//  free text, so it stays consistent for any future reporting.
//
//  The sum of this month's events becomes property_expenses'
//  extra_maintenance automatically (computed server-side in
//  savePropertyExpense) -- there's no manual number to keep in sync.
// ============================================================
import { useState, useEffect } from 'react'
import { api } from '../../api'
import { localTodayStr } from '../../utils/dates'

const CATEGORIES = ['Plumbing', 'Electrical', 'Appliance Repair', 'Painting', 'Pest Control', 'Cleaning', 'Carpentry', 'Other']

function fmt(n) {
  if (!n && n !== 0) return '—'
  return `₹${Number(n).toLocaleString('en-IN')}`
}

export default function MaintenanceEventsLog({ propId, month, year, onTotalChange }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [category, setCategory] = useState(CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState(localTodayStr())
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [propId, month, year])

  async function load() {
    const requestedFor = `${propId}|${month}|${year}`
    setLoading(true)
    try {
      const data = await api.getMaintenanceEvents(propId, month, year)
      if (`${propId}|${month}|${year}` !== requestedFor) return
      const list = Array.isArray(data) ? data : []
      setEvents(list)
      if (onTotalChange) onTotalChange(list.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0))
    } catch (e) { console.warn(e) }
    finally { setLoading(false) }
  }

  function openNew() {
    setEditingId(null); setCategory(CATEGORIES[0]); setAmount(''); setDescription(''); setEventDate(localTodayStr())
    setShowForm(true)
  }
  function openEdit(ev) {
    setEditingId(ev.event_id); setCategory(ev.category); setAmount(String(ev.amount));
    setDescription(ev.description || ''); setEventDate(ev.event_date || localTodayStr())
    setShowForm(true)
  }

  async function handleSave() {
    if (!amount || parseFloat(amount) <= 0) return
    setSaving(true)
    try {
      await api.saveMaintenanceEvent({
        eventId: editingId, propId, month, year, category,
        amount: parseFloat(amount), description: description.trim(), eventDate,
      })
      setShowForm(false)
      await load()
    } catch (e) { console.warn(e) }
    finally { setSaving(false) }
  }

  async function handleDelete(eventId) {
    try { await api.deleteMaintenanceEvent(eventId); await load() }
    catch (e) { console.warn(e) }
  }

  const total = events.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)

  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          Maintenance / Repairs
        </label>
        <span style={{ fontSize: '0.78rem', color: '#EF9A9A', fontWeight: '600' }}>{fmt(total)}</span>
      </div>

      {loading && <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Loading…</div>}

      {!loading && events.map(ev => (
        <div key={ev.event_id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '6px 8px', borderRadius: '6px', marginBottom: '4px',
          background: 'var(--dark-input)', border: '1px solid var(--border-dim)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text)', fontWeight: '600' }}>
              {ev.category} — {fmt(ev.amount)}
            </div>
            {ev.description && <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '1px' }}>{ev.description}</div>}
          </div>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
            <button onClick={() => openEdit(ev)} style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-dim)', background: 'transparent', color: '#5C7080', fontSize: '0.62rem', cursor: 'pointer' }}>✏️</button>
            <button onClick={() => handleDelete(ev.event_id)} style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(229,57,53,0.3)', background: 'rgba(229,57,53,0.08)', color: '#E53935', fontSize: '0.62rem', cursor: 'pointer' }}>🗑️</button>
          </div>
        </div>
      ))}

      {!showForm ? (
        <button onClick={openNew} style={{
          width: '100%', padding: '7px', borderRadius: '6px', marginTop: '2px',
          border: '1px dashed rgba(200,144,58,0.4)', background: 'rgba(200,144,58,0.05)',
          color: '#C8903A', fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer',
        }}>
          + Log Maintenance / Repair
        </button>
      ) : (
        <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--dark-input)', border: '1px solid var(--border-dim)', marginTop: '4px' }}>
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', boxSizing: 'border-box', background: 'var(--dark)', border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.78rem', marginBottom: '6px' }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" min="0" placeholder="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', boxSizing: 'border-box', background: 'var(--dark)', border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.78rem', marginBottom: '6px' }} />
          <input type="text" placeholder="What was done (e.g. Fridge fan repair by Bob)" value={description} onChange={e => setDescription(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', boxSizing: 'border-box', background: 'var(--dark)', border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.78rem', marginBottom: '6px' }} />
          <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', boxSizing: 'border-box', background: 'var(--dark)', border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.78rem', marginBottom: '8px' }} />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text-dim)', fontSize: '0.72rem', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !amount} style={{ flex: 2, padding: '6px', borderRadius: '6px', border: 'none', background: '#C8903A', color: '#fff', fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer', opacity: (saving || !amount) ? 0.6 : 1 }}>
              {saving ? 'Saving…' : (editingId ? 'Update' : 'Add')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
