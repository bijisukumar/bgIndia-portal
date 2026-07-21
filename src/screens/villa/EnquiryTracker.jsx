import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { daysFromToday } from '../../utils/dates'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'

export const SOURCES = [
  { id: 'website',     label: 'Website' },
  { id: 'airbnb',       label: 'Airbnb' },
  { id: 'booking_com',  label: 'Booking.com' },
  { id: 'whatsapp',     label: 'WhatsApp' },
  { id: 'phone',        label: 'Phone' },
  { id: 'referral',     label: 'Referral' },
]

export const PURPOSES = ['Vacation', 'Wedding', 'Temple Visit', 'Family Function', 'Dance', 'Other']

export const LOST_REASONS = [
  { id: 'price',             label: 'Price' },
  { id: 'dates_unavailable', label: 'Dates Unavailable' },
  { id: 'chose_another',     label: 'Chose Another Property' },
  { id: 'change_of_plans',   label: 'Change of Plans' },
  { id: 'no_response',       label: 'No Response' },
  { id: 'other',             label: 'Other' },
]

export const STATUS_META = {
  new:               { label: 'New',              color: '#185FA5', bg: 'rgba(24,95,165,0.12)' },
  quoted:            { label: 'Quoted',            color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  follow_up_needed:  { label: 'Follow-Up Needed',  color: '#FB923C', bg: 'rgba(251,146,60,0.12)' },
  negotiating:       { label: 'Negotiating',       color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  confirmed:         { label: 'Confirmed',         color: '#34A853', bg: 'rgba(52,168,83,0.12)' },
  lost:              { label: 'Lost',              color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  cancelled:         { label: 'Cancelled',         color: '#5C7080', bg: 'rgba(92,112,128,0.12)' },
}

function fmt(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }
function fmtDate(d) { if (!d) return '—'; return String(d).slice(0, 10) }

const TERMINAL_STATUSES = ['confirmed', 'lost', 'cancelled']

// An enquiry is "archivable" — moved out of the main list into the collapsed
// Archive section — once it can no longer realistically convert: either its
// check-in date has already passed, or it's already Lost/Cancelled (even if
// the dates are still in the future, e.g. guest cancelled early). Confirmed
// bookings with future dates stay in the main list since they're still live,
// upcoming business — only a past check-in date archives a Confirmed one too
// (the stay has already happened, nothing left to track here).
function isArchivable(enq) {
  if (enq.status === 'lost' || enq.status === 'cancelled') return true
  const daysUntilCheckin = daysFromToday(enq.checkin_date)
  return daysUntilCheckin !== null && daysUntilCheckin < 0
}

function nudgeWaLink(enq) {
  const raw = (enq.phone || '').trim()
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  // Only assume India's country code for a bare 10-digit number with no
  // '+' in the original string. Anything that already looks international
  // (has a '+', or is already longer than 10 digits) is left as-is —
  // blindly prepending '91' would corrupt a real international number
  // (e.g. a Qatar guest's +974... becoming 91974...).
  const looksInternational = raw.includes('+') || digits.length > 10
  const num = looksInternational ? digits : `91${digits}`
  const firstName = (enq.guest_name || '').split(' ')[0]
  const msg = encodeURIComponent(
    `Hi ${firstName}, just checking in — were you able to look over the details for your stay? Happy to answer any questions you have. And if you've decided to go a different way, no worries at all, just let us know so we can keep things updated on our end. Thank you! 🙏`
  )
  return `https://wa.me/${num}?text=${msg}`
}

function EnquiryCard({ enq, navigate, nudging, handleNudge, dimmed = false }) {
  const meta = STATUS_META[enq.status] || STATUS_META.new
  const isActive = !TERMINAL_STATUSES.includes(enq.status)
  const sinceDate = enq.last_contact_date || enq.date_received
  const daysSince = sinceDate ? -daysFromToday(sinceDate) : null   // negate: daysFromToday is future-positive
  return (
    <div onClick={() => navigate(`/owner/villa/enquiries/${enq.enquiry_id}`)}
      className="card" style={{ marginBottom: '10px', cursor: 'pointer', padding: '14px', opacity: dimmed ? 0.7 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text)', fontWeight: '700', fontSize: '0.92rem' }}>{enq.guest_name}</span>
            {!!enq.is_repeat_guest && (
              <span style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>
                Repeat · {enq.previous_stays}×
              </span>
            )}
          </div>
          <div style={{ color: '#5C7080', fontSize: '0.72rem', marginTop: '2px' }}>
            {enq.phone || enq.email || 'No contact on file'} · {SOURCES.find(s => s.id === enq.source)?.label || enq.source}
          </div>
        </div>
        <span style={{ background: meta.bg, color: meta.color, fontSize: '0.68rem', fontWeight: '700', padding: '4px 10px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
          {meta.label}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-dim)' }}>
        <div style={{ color: '#5C7080', fontSize: '0.72rem' }}>
          {fmtDate(enq.checkin_date)} → {fmtDate(enq.checkout_date)} · {enq.nights || 0}n · {enq.guests_count || 1}p
        </div>
        <div style={{ color: 'var(--gold)', fontWeight: '700', fontSize: '0.85rem' }}>
          {fmt(enq.final_offer_amount || enq.quote_amount)}
        </div>
      </div>
      {enq.follow_up_due && enq.status !== 'confirmed' && enq.status !== 'lost' && (
        <div style={{ marginTop: '6px', color: '#FB923C', fontSize: '0.68rem' }}>
          ⏰ Follow up by {fmtDate(enq.follow_up_due)}
        </div>
      )}

      {isActive && !dimmed && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-dim)' }}>
          {daysSince !== null ? (
            <span style={{
              fontSize: '0.7rem', fontWeight: '600',
              color: daysSince >= 3 ? '#EF4444' : daysSince >= 1 ? '#FB923C' : '#5C7080',
            }}>
              {daysSince <= 0 ? 'Contacted today' : `⏳ ${daysSince} day${daysSince === 1 ? '' : 's'} since last contact`}
            </span>
          ) : <span/>}
          <button onClick={(e) => handleNudge(e, enq)} disabled={nudging === enq.enquiry_id}
            style={{
              background: 'rgba(52,168,83,0.12)', border: '1px solid rgba(52,168,83,0.35)',
              borderRadius: '8px', color: '#34A853', fontWeight: '700', fontSize: '0.72rem',
              padding: '6px 12px', cursor: nudging === enq.enquiry_id ? 'default' : 'pointer',
              opacity: nudging === enq.enquiry_id ? 0.6 : 1, flexShrink: 0,
            }}>
            💬 Nudge
          </button>
        </div>
      )}
    </div>
  )
}

export default function EnquiryTracker() {
  const navigate = useNavigate()
  const [enquiries, setEnquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [nudging, setNudging] = useState(null)   // enquiry_id currently being nudged, for a brief disabled state
  const [archiveOpen, setArchiveOpen] = useState(false)

  // Enquiries that likely already turned into a real stay without going
  // through this enquiry's own Confirm flow (e.g. guest gave a shorter name
  // at enquiry time, fuller name at check-in). Human-reviewed: the owner
  // eyeballs each one and either links it or dismisses it for this session.
  const [matches, setMatches] = useState([])
  const [dismissedMatches, setDismissedMatches] = useState(() => new Set())
  const [linkingMatch, setLinkingMatch] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.getEnquiries(DEFAULT_VILLA_ID).then(rows => {
      if (!cancelled && Array.isArray(rows)) setEnquiries(rows)
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    api.getEnquiryMatchCandidates(DEFAULT_VILLA_ID).then(rows => {
      if (!cancelled && Array.isArray(rows)) setMatches(rows)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const visibleMatches = matches.filter(m => !dismissedMatches.has(`${m.enquiryId}:${m.stayId}`))

  async function handleLinkMatch(m) {
    setLinkingMatch(m.enquiryId)
    try {
      await api.linkEnquiryToExistingStay({ enquiryId: m.enquiryId, stayId: m.stayId })
      setMatches(prev => prev.filter(x => x.enquiryId !== m.enquiryId))
      setEnquiries(prev => prev.map(e => e.enquiry_id === m.enquiryId ? { ...e, status: 'confirmed', booking_confirmed: 1 } : e))
    } catch (err) {
      alert(err.message || 'Could not link — try again.')
    } finally {
      setLinkingMatch(null)
    }
  }

  function handleDismissMatch(m) {
    setDismissedMatches(prev => new Set(prev).add(`${m.enquiryId}:${m.stayId}`))
  }

  async function handleNudge(e, enq) {
    e.stopPropagation()   // don't trigger the card's own onClick (navigate to detail)
    const link = nudgeWaLink(enq)
    if (!link) { alert('No phone number on file for this enquiry.'); return }
    window.open(link, '_blank')
    setNudging(enq.enquiry_id)
    try {
      await api.logCommunication({ enquiryId: enq.enquiry_id, type: 'whatsapp', notes: 'Follow-up nudge sent (traction check-in)' })
      setEnquiries(prev => prev.map(r => r.enquiry_id === enq.enquiry_id ? { ...r, last_contact_date: new Date().toISOString() } : r))
    } catch (err) {
      // WhatsApp already opened regardless — just the "days since contact" badge
      // won't reset. Not worth blocking or alerting the user over; they already
      // sent the message, this is just bookkeeping.
    } finally {
      setNudging(null)
    }
  }

  const filtered = useMemo(() => {
    let rows = enquiries
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(r =>
        (r.guest_name || '').toLowerCase().includes(q) ||
        (r.phone || '').includes(q) ||
        (r.email || '').toLowerCase().includes(q)
      )
    }
    return rows
  }, [enquiries, statusFilter, search])

  // Split whatever matches the current filter/search into the main list and
  // the collapsed Archive — past check-in date or already Lost/Cancelled.
  // A search match always surfaces in the main list (so searching by name
  // still finds an old guest immediately) rather than being hidden in Archive.
  const { activeRows, archivedRows } = useMemo(() => {
    if (search.trim()) return { activeRows: filtered, archivedRows: [] }
    const active = [], archived = []
    filtered.forEach(r => (isArchivable(r) ? archived : active).push(r))
    return { activeRows: active, archivedRows: archived }
  }, [filtered, search])

  const statusCounts = useMemo(() => {
    const c = { all: enquiries.length }
    enquiries.forEach(e => { c[e.status] = (c[e.status] || 0) + 1 })
    return c
  }, [enquiries])

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Guest Enquiries</div>
          <div className="topbar-sub">DWARKA · ENQUIRY TRACKER{loading ? ' · loading…' : ''}</div>
        </div>
        <button onClick={() => navigate('/owner/villa/enquiries/new')}
          style={{ background: 'var(--gold)', border: 'none', borderRadius: '8px', color: '#1A202C', fontWeight: '700', fontSize: '0.78rem', padding: '8px 12px', cursor: 'pointer' }}>
          + New
        </button>
      </div>

      <div className="screen-body">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <button onClick={() => navigate('/owner/villa/enquiries/dashboard')}
            style={{ flex: 1, background: 'rgba(200,144,58,0.1)', border: '1px solid rgba(200,144,58,0.3)', borderRadius: '10px', color: '#C8903A', fontWeight: '600', fontSize: '0.8rem', padding: '10px', cursor: 'pointer' }}>
            📊 Conversion Dashboard
          </button>
        </div>

        {visibleMatches.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div className="card-section-label" style={{ color: 'var(--gold)' }}>🔗 POSSIBLE MATCHES — SAME GUEST?</div>
            {visibleMatches.map(m => (
              <div key={`${m.enquiryId}:${m.stayId}`} className="card" style={{ marginBottom: '10px', padding: '14px' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text)', marginBottom: '4px' }}>
                  Enquiry <strong>{m.enquiryGuestName}</strong> ({SOURCES.find(s => s.id === m.enquirySource)?.label || m.enquirySource}) vs.
                  stay <strong>{m.stayGuestName}</strong> ({m.stayChannel || 'direct'}, {m.stayStatus})
                </div>
                <div style={{ color: '#5C7080', fontSize: '0.72rem', marginBottom: '10px' }}>
                  Same dates: {fmtDate(m.checkinDate)} → {fmtDate(m.checkoutDate)}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleLinkMatch(m)} disabled={linkingMatch === m.enquiryId}
                    style={{ flex: 1, background: 'rgba(52,168,83,0.12)', border: '1px solid rgba(52,168,83,0.35)', borderRadius: '8px', color: '#34A853', fontWeight: '700', fontSize: '0.75rem', padding: '8px', cursor: linkingMatch === m.enquiryId ? 'default' : 'pointer', opacity: linkingMatch === m.enquiryId ? 0.6 : 1 }}>
                    {linkingMatch === m.enquiryId ? 'Linking…' : '✓ Same guest — link'}
                  </button>
                  <button onClick={() => handleDismissMatch(m)}
                    style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-dim)', borderRadius: '8px', color: '#5C7080', fontWeight: '600', fontSize: '0.75rem', padding: '8px', cursor: 'pointer' }}>
                    Not a match
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <input className="field-input" placeholder="Search by name, phone, or email…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: '10px' }} />

        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '4px' }}>
          {['all', ...Object.keys(STATUS_META)].map(s => {
            const meta = STATUS_META[s]
            const active = statusFilter === s
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer',
                  border: active ? `1px solid ${meta?.color || '#C8903A'}` : '1px solid var(--border-dim)',
                  background: active ? (meta?.bg || 'rgba(200,144,58,0.12)') : 'transparent',
                  color: active ? (meta?.color || '#C8903A') : '#5C7080',
                }}>
                {s === 'all' ? 'All' : meta.label} ({statusCounts[s] || 0})
              </button>
            )
          })}
        </div>

        {activeRows.length === 0 && archivedRows.length === 0 && !loading && (
          <div className="card" style={{ textAlign: 'center', padding: '30px 14px', color: '#5C7080', fontSize: '0.85rem' }}>
            No enquiries {statusFilter !== 'all' ? `with status "${STATUS_META[statusFilter]?.label}"` : 'yet'}.
          </div>
        )}

        {activeRows.map(enq => (
          <EnquiryCard key={enq.enquiry_id} enq={enq} navigate={navigate} nudging={nudging} handleNudge={handleNudge} />
        ))}

        {activeRows.length === 0 && archivedRows.length > 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '20px 14px', color: '#5C7080', fontSize: '0.82rem', marginBottom: '10px' }}>
            Nothing needs attention right now — {archivedRows.length} past/closed {archivedRows.length === 1 ? 'enquiry is' : 'enquiries are'} in Archive below.
          </div>
        )}

        {archivedRows.length > 0 && (
          <div style={{ marginTop: '6px' }}>
            <button onClick={() => setArchiveOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'transparent', border: '1px solid var(--border-dim)', borderRadius: '10px',
                padding: '10px 14px', cursor: 'pointer', color: '#5C7080', fontSize: '0.78rem', fontWeight: '600',
              }}>
              <span>🗄 Archive — past dates or closed ({archivedRows.length})</span>
              <span style={{ transform: archiveOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
            </button>
            {archiveOpen && (
              <div style={{ marginTop: '10px' }}>
                {archivedRows.map(enq => (
                  <EnquiryCard key={enq.enquiry_id} enq={enq} navigate={navigate} nudging={nudging} handleNudge={handleNudge} dimmed />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
