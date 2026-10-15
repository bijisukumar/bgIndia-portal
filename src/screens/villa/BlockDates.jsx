// ============================================================
//  BlockDates.jsx — close nights by hand (owner only), on the Channel calendar.
//
//  For nights the villa cannot host: family use, maintenance, a festival. A
//  block is a plain range of nights: no booking, no guest, no manager
//  commission, no revenue. Every part of the portal that decides whether a
//  night is free reads it: the calendar below shows it, each platform's
//  calendar link carries it (Airbnb's too), the enquiry check refuses it and
//  the upcoming-gaps card no longer offers it back as a gap.
//
//  The first night closed and the morning the villa opens again, the same way
//  a booking has a check-in and a check-out: closing 14 Oct → 17 Oct shuts
//  the nights of the 14th, 15th and 16th and guests can arrive on the 17th.
//
//  The parent loads the list (getDateBlocks) and passes it in; this
//  component adds and removes, then asks the parent to reload.
// ============================================================
import { useState } from 'react'
import { api } from '../../api'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'
import { addDays, dayMonth } from '../../utils/stayHolds'

export const BLOCK_REASONS = [
  { id: 'owner_use',   label: 'Family / owner use' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'festival',    label: 'Festival / event' },
  { id: 'other',       label: 'Other' },
]
const reasonLabel = id => (BLOCK_REASONS.find(r => r.id === id) || BLOCK_REASONS[3]).label

function nightsBetween(a, b) {
  const x = Date.parse(a + 'T00:00:00Z'), y = Date.parse(b + 'T00:00:00Z')
  return isNaN(x) || isNaN(y) ? 0 : Math.round((y - x) / 86400000)
}
function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const INP = { width: '100%', padding: '9px 12px', borderRadius: '8px', boxSizing: 'border-box', background: 'var(--dark-input)', border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.9rem' }
const LBL = { display: 'block', fontSize: '0.68rem', color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: '4px' }

export default function BlockDates({ blocks = [], loading = false, onChanged, showToast }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ start: '', end: '', reason: 'owner_use', note: '' })
  const [saving, setSaving] = useState(false)
  const [inTheWay, setInTheWay] = useState([])   // bookings that refused the block
  const [removing, setRemoving] = useState(null)

  const nights = form.start && form.end ? nightsBetween(form.start, form.end) : 0
  const lastNight = nights > 0 ? addDays(form.end, -1) : ''
  const problem = !form.start || !form.end ? ''
    : nights <= 0 ? 'The villa must open again after the first closed night.'
    : nights > 366 ? 'A block can be at most 366 nights: make two.' : ''

  const setStart = v => setForm(f => ({
    ...f, start: v,
    // the common case is one or a few nights: offer the next morning as the opening day
    end: v && (!f.end || f.end <= v) ? addDays(v, 1) : f.end,
  }))

  async function save() {
    if (!form.start || !form.end) { showToast && showToast('Pick the first night and the day it opens again', 'error'); return }
    if (problem) { showToast && showToast(problem, 'error'); return }
    setSaving(true); setInTheWay([])
    try {
      await api.saveDateBlock({
        villaId: DEFAULT_VILLA_ID, startDate: form.start, endDate: form.end, reason: form.reason, note: form.note.trim(),
      })
      showToast && showToast(`✅ ${nights} night${nights === 1 ? '' : 's'} blocked`)
      setForm({ start: '', end: '', reason: 'owner_use', note: '' })
      setOpen(false)
      onChanged && onChanged()
    } catch (e) {
      if (e.code === 'bookings_in_the_way' && Array.isArray(e.conflict)) setInTheWay(e.conflict)
      else showToast && showToast('Failed: ' + e.message, 'error')
    } finally { setSaving(false) }
  }

  async function remove(b) {
    const ok = window.confirm(
      `Open ${dayMonth(b.startDate)} → ${dayMonth(b.endDate)} again?\n\n` +
      `The nights are released everywhere. Platforms pick the change up the next time they read their link.`)
    if (!ok) return
    setRemoving(b.blockId)
    try {
      await api.deleteDateBlock({ blockId: b.blockId })
      showToast && showToast('Dates reopened')
      onChanged && onChanged()
    } catch (e) { showToast && showToast('Failed: ' + e.message, 'error') }
    finally { setRemoving(null) }
  }

  const today = todayLocal()

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="card-section-label" style={{ margin: 0 }}>BLOCK DATES</div>
        <button type="button" onClick={() => { setOpen(o => !o); setInTheWay([]) }}
          style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid rgba(200,144,58,0.35)', background: 'rgba(200,144,58,0.1)', color: 'var(--gold)', fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer' }}>
          {open ? '✕ Close' : '+ Block dates'}
        </button>
      </div>

      <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', lineHeight: 1.55, marginBottom: '10px' }}>
        Close nights you cannot host (family use, maintenance, a festival). They shut on every connected
        calendar, are refused by the enquiry check and are not offered back as gaps. No guest, commission
        or revenue is created, so there is nothing to clean up afterwards.
      </div>

      {open && (
        <div style={{ background: 'rgba(100,116,139,0.10)', border: '1px solid rgba(100,116,139,0.35)', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={LBL}>FIRST NIGHT CLOSED *</label>
              <input type="date" value={form.start} min={today} onChange={e => setStart(e.target.value)} style={INP} />
            </div>
            <div>
              <label style={LBL}>OPEN AGAIN ON *</label>
              <input type="date" value={form.end} min={form.start || today} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} style={INP} />
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', margin: '8px 0 10px', lineHeight: 1.5, color: problem ? '#E06C5A' : 'var(--text-dim)' }}>
            {problem
              ? problem
              : nights > 0
                ? <><strong style={{ color: 'var(--text)' }}>{nights} night{nights === 1 ? '' : 's'}</strong> closed ({dayMonth(form.start)}{nights > 1 ? ` to ${dayMonth(lastNight)}` : ''}); guests can arrive on {dayMonth(form.end)}.</>
                : 'The villa opens again on the morning you pick: closing 14 Oct → 17 Oct shuts the nights of the 14th, 15th and 16th.'}
          </div>

          <label style={LBL}>REASON</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {BLOCK_REASONS.map(r => (
              <button key={r.id} type="button" onClick={() => setForm(f => ({ ...f, reason: r.id }))}
                style={{
                  padding: '6px 11px', borderRadius: '999px', fontSize: '0.74rem', cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${form.reason === r.id ? 'var(--gold)' : 'var(--border-dim)'}`,
                  background: form.reason === r.id ? 'rgba(200,144,58,0.15)' : 'transparent',
                  color: form.reason === r.id ? 'var(--gold)' : 'var(--text-dim)', fontWeight: form.reason === r.id ? '700' : '500',
                }}>{r.label}</button>
            ))}
          </div>

          <label style={LBL}>NOTE (ONLY YOU SEE THIS)</label>
          <input value={form.note} maxLength={300} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="e.g. Painting the upstairs rooms" style={INP} />

          {inTheWay.length > 0 && (
            <div style={{ marginTop: '10px', padding: '9px 11px', borderRadius: '8px', background: 'rgba(224,108,90,0.1)', border: '1px solid rgba(224,108,90,0.35)', fontSize: '0.74rem', color: '#E06C5A', lineHeight: 1.55 }}>
              A booking is in the way. Move or cancel it first, then block these dates:
              {inTheWay.map(s => (
                <div key={s.stayId} style={{ fontWeight: 600 }}>
                  {s.guestName} · {dayMonth(s.checkIn)} → {dayMonth(s.checkOut)}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={() => { setOpen(false); setInTheWay([]) }}
              style={{ flex: 1, padding: '9px', borderRadius: '9px', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving || !!problem || !form.start || !form.end}
              style={{ flex: 2, padding: '9px', borderRadius: '9px', border: 'none', background: 'var(--gold)', color: '#1A202C', fontWeight: '700', cursor: 'pointer', opacity: (saving || problem || !form.start || !form.end) ? 0.55 : 1 }}>
              {saving ? 'Blocking…' : 'Block these dates'}
            </button>
          </div>
        </div>
      )}

      {!loading && blocks.length === 0 && !open && (
        <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textAlign: 'center', padding: '14px', border: '1px dashed var(--border-dim)', borderRadius: '10px' }}>
          Nothing blocked. Tap "+ Block dates" to close some nights.
        </div>
      )}

      {blocks.map(b => (
        <div key={b.blockId} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--dark-card)', border: '1px solid var(--border-dim)', borderLeft: '4px solid #64748B', borderRadius: '10px', padding: '10px 12px', marginBottom: '6px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text)' }}>
              {dayMonth(b.startDate)} → {dayMonth(b.endDate)}
              <span style={{ fontWeight: 500, color: 'var(--text-dim)' }}> · {b.nights} night{b.nights === 1 ? '' : 's'}</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
              {reasonLabel(b.reason)}{b.note ? ` — ${b.note}` : ''}
            </div>
          </div>
          <button type="button" onClick={() => remove(b)} disabled={removing === b.blockId}
            style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: '#EF4444', fontSize: '0.72rem', cursor: 'pointer', opacity: removing === b.blockId ? 0.5 : 1 }}>
            {removing === b.blockId ? '…' : 'Reopen'}
          </button>
        </div>
      ))}
    </div>
  )
}
