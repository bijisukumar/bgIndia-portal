/**
 * FlexRequests.jsx — owner inbox for early check-in / late check-out asks
 * Route: /owner/villa/flexibility
 *
 * Deliberately NOT part of Complete Booking: a request can arrive from a
 * guest with no stay record yet (asking before they book), and every OTA
 * lead the public page captures has no stay at all. Complete Booking is
 * per-stay, so you'd have to find the booking before you could even read
 * the request. This screen is the inbox; Complete Booking shows the agreed
 * outcome once it's settled.
 *
 * Each row answers both questions in one place:
 *   can I?      → who else is in the villa on the adjoining day
 *   what to charge? → nightly rate with 25% / 50% worked out
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { fmtDate } from '../../utils/dates'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`

const STATUS = {
  new:      { label: 'New',       color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  approved: { label: 'Approved',  color: '#34A853', bg: 'rgba(52,168,83,0.12)'  },
  declined: { label: 'Declined',  color: '#9AA5B4', bg: 'rgba(154,165,180,0.12)'},
  lead:     { label: 'OTA lead',  color: '#85B7EB', bg: 'rgba(133,183,235,0.12)'},
}

// 'possible' is the one that earns its keep: the adjoining day IS sold, but
// once you allow for when that family actually comes and goes, the turnaround
// still fits — so it's a yes the calendar alone would have called a no.
const VERDICT = {
  free:     { label: 'Adjoining day is free',        color: '#34A853', bg: 'rgba(52,168,83,0.07)',  line: 'rgba(52,168,83,0.28)' },
  possible: { label: 'Booked either side — but this still fits', color: '#F59E0B', bg: 'rgba(245,158,11,0.07)', line: 'rgba(245,158,11,0.30)' },
  blocked:  { label: 'No room to turn the villa around', color: '#EF4444', bg: 'rgba(239,68,68,0.07)', line: 'rgba(239,68,68,0.28)' },
  unknown:  { label: 'No dates given',                color: '#9AA5B4', bg: 'rgba(154,165,180,0.07)', line: 'var(--border-dim)' },
}

// "2026-08-10 08:00" → "10 Aug, 8:00 AM". Kept as a plain string parse so a
// naive villa-local timestamp is never re-interpreted in the browser's zone.
function when(s) {
  if (!s) return '—'
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (!m) return s
  const [, y, mo, dd, hh, mi] = m
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  let h = parseInt(hh, 10)
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${parseInt(dd, 10)} ${MON[parseInt(mo, 10) - 1]}, ${h}:${mi} ${ap}`
}

export default function FlexRequests() {
  const navigate = useNavigate()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast]     = useState(null)
  const [busyId, setBusyId]   = useState(null)
  const [draft, setDraft]     = useState({})   // requestId -> { pct, note }

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await api.getFlexRequests(DEFAULT_VILLA_ID)
      setRows(Array.isArray(data) ? data : [])
    } catch (e) { showToast('Could not load: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  async function save(r, status) {
    setBusyId(r.request_id)
    try {
      const d = draft[r.request_id] || {}
      await api.updateFlexRequest({
        requestId: r.request_id,
        status,
        quotedPct: d.pct != null && d.pct !== '' ? parseInt(d.pct, 10) : undefined,
        ownerNote: d.note || undefined,
      })
      showToast(status === 'approved' ? 'Approved ✓' : 'Updated ✓')
      await load()
    } catch (e) { showToast('Failed: ' + e.message, 'error') }
    finally { setBusyId(null) }
  }

  const setDraftVal = (id, k, v) => setDraft(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))

  // An OTA submission is a future-booking lead, not something to price now.
  const isLead = r => /direct rates/i.test(r.need_type || '')

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Flexibility requests</div>
          <div className="topbar-sub">DWARKA · EARLY CHECK-IN / LATE CHECK-OUT</div>
        </div>
      </div>

      <div className="screen-body">
        {loading && <div className="loading"><div className="spinner" />Loading requests…</div>}

        {!loading && rows.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🕐</div>
            <div style={{ color: 'var(--gold)', fontWeight: 600, marginBottom: 6 }}>No requests yet</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
              Requests from the public flexibility page land here.<br />
              <span style={{ color: '#85B7EB' }}>dwarka.stayvibe360.com/flexibility</span>
            </div>
          </div>
        )}

        {!loading && rows.map(r => {
          const meta = isLead(r) ? STATUS.lead : (STATUS[r.status] || STATUS.new)
          const d = draft[r.request_id] || {}
          const V = VERDICT[r.verdict] || VERDICT.unknown
          const blocker = r.blockingBefore || r.blockingAfter
          return (
            <div key={r.request_id} className="card" style={{ marginBottom: 14 }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.guest_name}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: 2 }}>
                    {r.contact || 'no contact given'} · booked {r.booking_channel || '—'}
                  </div>
                </div>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '3px 9px', borderRadius: 9,
                  flexShrink: 0, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}55` }}>
                  {meta.label}
                </span>
              </div>

              {/* What they asked */}
              <div style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--text)' }}>
                {r.need_type || '—'}
              </div>
              {(r.checkin_date || r.checkout_date) && (
                <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: 3 }}>
                  {r.checkin_date ? fmtDate(r.checkin_date) : '—'} → {r.checkout_date ? fmtDate(r.checkout_date) : '—'}
                </div>
              )}
              {r.details && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 8, fontStyle: 'italic',
                  paddingLeft: 10, borderLeft: '2px solid var(--border-dim)' }}>
                  “{r.details}”
                </div>
              )}

              {/* Lead: nothing to price, just contact them */}
              {isLead(r) ? (
                <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(133,183,235,0.07)', border: '1px solid rgba(133,183,235,0.25)',
                  fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  Booked via a channel — wants your direct rates for next time. Nothing to price;
                  send them your rates and add them to your direct list.
                </div>
              ) : (
                <>
                  {/* Can we? Not just "is it booked" — when is the villa
                      genuinely free, allowing for cleaning. */}
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8,
                    background: V.bg, border: `1px solid ${V.line}`, fontSize: '0.78rem', lineHeight: 1.6 }}>
                    <span style={{ color: V.color, fontWeight: 700 }}>{V.label}</span>

                    {r.verdict === 'free' && (
                      <div style={{ color: 'var(--text-dim)', marginTop: 4 }}>
                        Nobody booked either side — you can accommodate without holding a night.
                      </div>
                    )}

                    {blocker && (
                      <div style={{ color: 'var(--text-dim)', marginTop: 6 }}>
                        <div>
                          <strong style={{ color: 'var(--text)' }}>{blocker.guestName}</strong>
                          {' · '}{fmtDate(blocker.checkIn)} → {fmtDate(blocker.checkOut)}
                        </div>
                        {r.blockingBefore && (
                          <div>leaves {when(r.blockingBefore.leavesAt)}</div>
                        )}
                        {r.blockingAfter && (
                          <div>
                            arrives {when(r.blockingAfter.arrivesAt)}
                            {r.blockingAfter.arrivesLaterThanCheckin && (
                              <span style={{ color: '#F59E0B' }}> — holds the night but arrives next day</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {(r.earliestArrival || r.latestDeparture) && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-dim)' }}>
                        {r.earliestArrival && (
                          <div style={{ color: 'var(--text-dim)' }}>
                            Earliest you can hand over:{' '}
                            <strong style={{ color: V.color }}>{when(r.earliestArrival)}</strong>
                            <span style={{ opacity: 0.7 }}> (standard {when(r.standardArrival)})</span>
                          </div>
                        )}
                        {r.latestDeparture && (
                          <div style={{ color: 'var(--text-dim)' }}>
                            Latest they can stay:{' '}
                            <strong style={{ color: V.color }}>{when(r.latestDeparture)}</strong>
                            <span style={{ opacity: 0.7 }}> (standard {when(r.standardDeparture)})</span>
                          </div>
                        )}
                        <div style={{ color: 'var(--text-dim)', opacity: 0.75, marginTop: 3, fontSize: '0.72rem' }}>
                          Allows {r.turnaroundHours}h to turn the villa around.
                        </div>
                      </div>
                    )}

                    {r.verdict === 'blocked' && (
                      <div style={{ color: 'var(--text-dim)', marginTop: 6 }}>
                        No room to clean in between — to say yes you'd hold the night. Quote below.
                      </div>
                    )}
                  </div>

                  {/* What to charge */}
                  {r.nightlyRate > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, padding: '8px 10px',
                      borderRadius: 8, background: 'rgba(200,144,58,0.06)', border: '1px solid rgba(200,144,58,0.15)',
                      fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                      <span>Per night: <strong style={{ color: 'var(--gold)' }}>{fmt(r.nightlyRate)}</strong></span>
                      <span>25%: <strong style={{ color: 'var(--gold)' }}>{fmt(r.quote25)}</strong></span>
                      <span>50%: <strong style={{ color: 'var(--gold)' }}>{fmt(r.quote50)}</strong></span>
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                      No matching booking found yet — rate can't be worked out automatically.
                    </div>
                  )}

                  {/* Decide */}
                  {r.status === 'new' && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Quote</span>
                        {[25, 50].map(p => (
                          <button key={p} onClick={() => setDraftVal(r.request_id, 'pct', String(p))}
                            style={{ padding: '5px 12px', borderRadius: 7, fontSize: '0.76rem', fontWeight: 700,
                              cursor: 'pointer',
                              border: `1px solid ${String(d.pct) === String(p) ? 'var(--gold)' : 'var(--border-dim)'}`,
                              background: String(d.pct) === String(p) ? 'rgba(200,144,58,0.15)' : 'transparent',
                              color: String(d.pct) === String(p) ? 'var(--gold)' : 'var(--text-dim)' }}>
                            {p}%
                          </button>
                        ))}
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                          {d.pct && r.nightlyRate ? `= ${fmt(Math.round(r.nightlyRate * (parseInt(d.pct, 10) / 100)))}` : ''}
                        </span>
                      </div>
                      <input className="field-input" placeholder="Note to yourself (optional)"
                        value={d.note || ''} onChange={e => setDraftVal(r.request_id, 'note', e.target.value)}
                        style={{ marginBottom: 8, fontSize: '0.82rem' }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-gold" style={{ flex: 1 }} disabled={busyId === r.request_id}
                          onClick={() => save(r, 'approved')}>
                          {busyId === r.request_id ? '…' : 'Approve'}
                        </button>
                        <button style={{ flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer',
                          border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text-dim)' }}
                          disabled={busyId === r.request_id} onClick={() => save(r, 'declined')}>
                          Can't do
                        </button>
                      </div>
                    </div>
                  )}

                  {r.status !== 'new' && (r.quoted_pct || r.owner_note) && (
                    <div style={{ marginTop: 10, fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                      {r.quoted_pct ? `Quoted ${r.quoted_pct}%` : ''}
                      {r.quoted_pct && r.owner_note ? ' · ' : ''}
                      {r.owner_note || ''}
                    </div>
                  )}
                </>
              )}

              <div style={{ marginTop: 10, fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                Received {r.created_at}
              </div>
            </div>
          )
        })}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#c62828' : '#34A853', color: '#fff',
          padding: '10px 18px', borderRadius: 10, fontSize: '0.85rem', zIndex: 99 }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
