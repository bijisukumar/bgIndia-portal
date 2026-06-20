import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

export const SOURCES = [
  { id: 'website',     label: 'Website' },
  { id: 'airbnb',       label: 'Airbnb' },
  { id: 'booking_com',  label: 'Booking.com' },
  { id: 'whatsapp',     label: 'WhatsApp' },
  { id: 'phone',        label: 'Phone' },
  { id: 'referral',     label: 'Referral' },
]

export const PURPOSES = ['Vacation', 'Wedding', 'Temple Visit', 'Family Function', 'Other']

export const LOST_REASONS = [
  { id: 'price',             label: 'Price' },
  { id: 'dates_unavailable', label: 'Dates Unavailable' },
  { id: 'chose_another',     label: 'Chose Another Property' },
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

export default function EnquiryTracker() {
  const navigate = useNavigate()
  const [enquiries, setEnquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    api.getEnquiries('dwarka').then(rows => {
      if (!cancelled && Array.isArray(rows)) setEnquiries(rows)
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

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

        {filtered.length === 0 && !loading && (
          <div className="card" style={{ textAlign: 'center', padding: '30px 14px', color: '#5C7080', fontSize: '0.85rem' }}>
            No enquiries {statusFilter !== 'all' ? `with status "${STATUS_META[statusFilter]?.label}"` : 'yet'}.
          </div>
        )}

        {filtered.map(enq => {
          const meta = STATUS_META[enq.status] || STATUS_META.new
          return (
            <div key={enq.enquiry_id} onClick={() => navigate(`/owner/villa/enquiries/${enq.enquiry_id}`)}
              className="card" style={{ marginBottom: '10px', cursor: 'pointer', padding: '14px' }}>
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
