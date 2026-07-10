import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { parseLocalDate } from '../../utils/dates'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'
import { channelLabel, channelPillStyle } from '../../utils/channel'

// ── SEGMENT DEFINITIONS ───────────────────────────────────────────────────
const SEGMENTS = {
  frequent: { label:'Frequent Visitor', icon:'⭐', color:'#C8903A', bg:'rgba(200,144,58,0.12)', minStays:3 },
  temple:   { label:'Temple Regular',   icon:'🛕', color:'#8B5CF6', bg:'rgba(139,92,246,0.12)' },
  wedding:  { label:'Wedding Guest',    icon:'💒', color:'#EC4899', bg:'rgba(236,72,153,0.12)' },
  family:   { label:'Family Traveller', icon:'👨‍👩‍👧‍👦', color:'#34A853', bg:'rgba(52,168,83,0.12)' },
  overseas: { label:'Overseas Guest',   icon:'✈️', color:'#185FA5', bg:'rgba(24,95,165,0.12)' },
  vip:      { label:'VIP (5+ stays)',   icon:'👑', color:'#F59E0B', bg:'rgba(245,158,11,0.12)', minStays:5 },
}

function getSegments(guest) {
  const tags = []
  const total    = guest.totalStays || 0
  const country  = String(guest.country || '').toLowerCase()
  const sources  = String(guest.allSources || guest.source || '').toLowerCase()

  if (total >= 5) tags.push('vip')
  else if (total >= 3) tags.push('frequent')
  if (sources.includes('temple') || sources.includes('guruvayur')) tags.push('temple')
  if (country && !['india',''].includes(country)) tags.push('overseas')
  if (parseInt(guest.children||0) > 0) tags.push('family')
  return tags
}

function getMarketingActions(tags) {
  const actions = []
  if (tags.includes('vip') || tags.includes('frequent')) {
    actions.push({ icon:'🏆', text:'Invite to loyalty programme — advance booking offer for Ekadasi & festivals', priority:'high' })
  }
  if (tags.includes('temple')) {
    actions.push({ icon:'🛕', text:'Monthly temple visit package — repeat discount offer', priority:'high' })
    actions.push({ icon:'📿', text:'Send Guruvayur Ekadasi dates for next 6 months', priority:'medium' })
  }
  if (tags.includes('wedding')) {
    actions.push({ icon:'👶', text:'Invite for Choorunu / family milestone visits', priority:'high' })
    actions.push({ icon:'🎂', text:'Anniversary stay package', priority:'medium' })
  }
  if (tags.includes('family')) {
    actions.push({ icon:'🏖️', text:'Summer holiday package — school break stays', priority:'medium' })
  }
  if (tags.includes('overseas')) {
    actions.push({ icon:'✈️', text:'India visit pre-booking — contact 3 months before peak season', priority:'high' })
  }
  if (!actions.length) actions.push({ icon:'💌', text:'Add to general mailing list for seasonal offers', priority:'low' })
  return actions
}

function fmtDate(d) {
  if (!d) return '—'
  try { return parseLocalDate(d).toLocaleDateString('en-IN', { month:'short', year:'numeric' }) }
  catch { return String(d) }
}
function fmt(n) { return `₹${Number(n||0).toLocaleString('en-IN')}` }

// ── GUEST CARD ─────────────────────────────────────────────────────────────
function GuestCard({ guest, onClick }) {
  const tags     = getSegments(guest)
  const isRepeat = (guest.totalStays || 0) > 1
  const sources  = [...new Set(String(guest.allSources||guest.source||'direct').split(',').map(s=>s.trim()).filter(Boolean))]

  return (
    <div onClick={onClick} style={{
      background:'var(--dark-card)', border:'1px solid var(--border-dim)',
      borderRadius:'12px', padding:'14px 16px', marginBottom:'8px', cursor:'pointer',
      borderLeft: isRepeat ? '3px solid var(--gold)' : '1px solid var(--border-dim)',
    }}>
      {/* Name + badges row */}
      <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'4px', flexWrap:'wrap' }}>
        <span style={{ fontWeight:'600', fontSize:'0.92rem', color:'var(--text)' }}>{guest.name}</span>
        {isRepeat && (
          <span style={{ background:'rgba(200,144,58,0.2)', color:'var(--gold)',
            fontSize:'0.65rem', fontWeight:'800', padding:'2px 7px', borderRadius:'10px' }}>
            {guest.totalStays}× STAYS
          </span>
        )}
        {guest.lastReviewRating > 0 && (
          <span style={{
            fontSize:'0.7rem', fontWeight:'700', padding:'2px 7px', borderRadius:'10px',
            color: guest.lastReviewRating >= 4 ? '#34A853' : '#C8903A',
            background: guest.lastReviewRating >= 4 ? 'rgba(52,168,83,0.12)' : 'rgba(200,144,58,0.1)',
          }}>
            {'★'.repeat(guest.lastReviewRating)} {guest.lastReviewSource === 'google' ? 'G' : 'AB'}
          </span>
        )}
        {/* Channel badges */}
        {sources.map(src => (
          <span key={src} style={{ fontSize:'0.65rem', fontWeight:'700', padding:'2px 6px',
            borderRadius:'8px', ...channelPillStyle(src) }}>
            {channelLabel(src)}
          </span>
        ))}
      </div>

      {/* Sub-line */}
      <div style={{ color:'var(--text-dim)', fontSize:'0.75rem', marginBottom:'6px' }}>
        {guest.totalNights||0} nights · Last: {fmtDate(guest.lastStay)}
        {guest.fromCity ? ` · ${guest.fromCity}${guest.state ? ', '+guest.state : ''}` : ''}
        {guest.country && guest.country !== 'India' ? ` · ${guest.country}` : ''}
      </div>

      {/* Segment tags */}
      {tags.length > 0 && (
        <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginTop:'4px' }}>
          {tags.map(tag => (
            <span key={tag} style={{ padding:'2px 7px', borderRadius:'10px', fontSize:'0.66rem',
              fontWeight:'700', background:SEGMENTS[tag].bg, color:SEGMENTS[tag].color }}>
              {SEGMENTS[tag].icon} {SEGMENTS[tag].label}
            </span>
          ))}
        </div>
      )}

      {/* Contact */}
      <div style={{ display:'flex', gap:'8px', marginTop:'6px' }}>
        {guest.phone && <span style={{ fontSize:'0.7rem', color:'var(--green)' }}>📱</span>}
        {guest.email && <span style={{ fontSize:'0.7rem', color:'#85B7EB' }}>📧</span>}
        {!guest.phone && !guest.email && (
          <span style={{ fontSize:'0.7rem', color:'var(--text-dim)' }}>No contact info</span>
        )}
      </div>
    </div>
  )
}

// ── GUEST DETAIL ───────────────────────────────────────────────────────────
function GuestDetail({ guest, onClose }) {
  const tags    = getSegments(guest)
  const actions = getMarketingActions(tags)
  const sources = [...new Set(String(guest.allSources||guest.source||'direct').split(',').map(s=>s.trim()).filter(Boolean))]
  const wa = guest.phone
    ? `https://wa.me/${guest.phone.replace(/[^0-9]/g,'')}?text=Namaste%20${encodeURIComponent(guest.name)}%2C%20Welcome%20back%20to%20GVR%20Dwarka%20Villa!`
    : null

  return (
    <div style={{ position:'fixed', inset:0, background:'var(--dark)', zIndex:200, overflowY:'auto' }}>
      <div style={{ maxWidth:'480px', margin:'0 auto' }}>
        <div className="topbar">
          <button className="back-btn" onClick={onClose}>‹</button>
          <div>
            <div className="topbar-title">{guest.name}</div>
            <div className="topbar-sub">GUEST PROFILE</div>
          </div>
          <div style={{width:34}}/>
        </div>
        <div style={{ padding:'16px 16px 80px' }}>
          {/* Segments */}
          {tags.length > 0 && (
            <>
              <div className="card-section-label">GUEST TYPE</div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' }}>
                {tags.map(tag => (
                  <span key={tag} style={{ padding:'5px 12px', borderRadius:'14px', fontSize:'0.78rem',
                    fontWeight:'700', background:SEGMENTS[tag].bg, color:SEGMENTS[tag].color,
                    border:`1px solid ${SEGMENTS[tag].color}44` }}>
                    {SEGMENTS[tag].icon} {SEGMENTS[tag].label}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Stats */}
          <div className="card-section-label">STAY HISTORY</div>
          <div className="card">
            {[
              ['Total stays',    guest.totalStays || 0, 'var(--gold)'],
              ['Total nights',   guest.totalNights || 0, null],
              ['Total spent',    fmt(guest.totalSpent), null],
              ['First stay',     fmtDate(guest.firstStay), null],
              ['Last stay',      fmtDate(guest.lastStay), null],
            ].map(([label, val, color]) => (
              <div key={label} className="net-row">
                <span className="net-label">{label}</span>
                <span style={color ? { color, fontWeight:'700' } : {}}>{val}</span>
              </div>
            ))}
            {/* Booking channels */}
            <div className="net-row">
              <span className="net-label">Booked via</span>
              <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                {sources.map(src => (
                  <span key={src} style={{ fontSize:'0.72rem', fontWeight:'700',
                    padding:'2px 7px', borderRadius:'8px', ...channelPillStyle(src) }}>{channelLabel(src)}</span>
                ))}
              </div>
            </div>
            {/* Location */}
            {(guest.fromCity || guest.country) && (
              <div className="net-row">
                <span className="net-label">From</span>
                <span>{[guest.fromCity, guest.state, guest.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {/* Review */}
            {guest.lastReviewRating > 0 && (
              <div className="net-row">
                <span className="net-label">Review</span>
                <span style={{ color:'#34A853', fontWeight:'700' }}>
                  {'★'.repeat(guest.lastReviewRating)} {guest.lastReviewSource === 'google' ? 'Google' : 'Airbnb'}
                </span>
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="card-section-label">CONTACT</div>
          <div className="card">
            {guest.phone ? (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                <div>
                  <div className="field-label">WhatsApp</div>
                  <div style={{ fontSize:'0.9rem', marginTop:'3px' }}>{guest.phone}</div>
                </div>
                <a href={wa} target="_blank" rel="noreferrer"
                  style={{ padding:'8px 14px', borderRadius:'10px', background:'rgba(52,168,83,0.15)',
                    color:'var(--green)', fontSize:'0.82rem', fontWeight:'700', textDecoration:'none',
                    border:'1px solid rgba(52,168,83,0.3)' }}>
                  💬 Chat
                </a>
              </div>
            ) : <div style={{ color:'var(--text-dim)', fontSize:'0.82rem', marginBottom:'8px' }}>No phone on record</div>}
            {guest.email
              ? <div><div className="field-label">Email</div><div style={{ fontSize:'0.85rem', marginTop:'3px' }}>{guest.email}</div></div>
              : <div style={{ color:'var(--text-dim)', fontSize:'0.82rem' }}>No email on record</div>}
          </div>

          {/* Marketing actions */}
          <div className="card-section-label">🎯 MARKETING ACTIONS</div>
          <div className="card">
            {actions.map((a, i) => (
              <div key={i} style={{ display:'flex', gap:'12px', paddingBottom:'10px', marginBottom:'10px',
                borderBottom: i < actions.length-1 ? '1px solid var(--border-dim)' : 'none' }}>
                <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{a.icon}</span>
                <div>
                  <div style={{ fontSize:'0.83rem', lineHeight:'1.4' }}>{a.text}</div>
                  <span style={{ fontSize:'0.68rem', fontWeight:'700', padding:'2px 6px', borderRadius:'8px', marginTop:'4px', display:'inline-block',
                    background: a.priority==='high'?'rgba(229,57,53,0.15)':a.priority==='medium'?'rgba(200,144,58,0.12)':'rgba(92,112,128,0.15)',
                    color: a.priority==='high'?'#E53935':a.priority==='medium'?'var(--gold)':'var(--text-dim)' }}>
                    {a.priority.toUpperCase()} PRIORITY
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MARKETING TAB ──────────────────────────────────────────────────────────
const CUR_YEAR_MKT = new Date().getFullYear()
const YEARS_MKT = [null, CUR_YEAR_MKT, CUR_YEAR_MKT-1, CUR_YEAR_MKT-2, CUR_YEAR_MKT-3, CUR_YEAR_MKT-4]
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const STATE_COLORS = ['#C8903A','#34A853','#185FA5','#8B5CF6','#EC4899','#F59E0B','#06B6D4','#10B981']

function MarketingTab() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [statYear, setStatYear] = useState(null) // null = all years

  useEffect(() => {
    setLoading(true)
    api.getMarketingStats(DEFAULT_VILLA_ID, statYear)
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [statYear])

  if (loading) return <div className="loading"><div className="spinner"/>Loading…</div>
  if (!stats)  return <div style={{ color:'var(--text-dim)', textAlign:'center', padding:'32px' }}>No data</div>

  const maxCityCount = Math.max(...(stats.cities||[]).map(c => c.guest_count), 1)
  const maxChRev     = Math.max(...(stats.channels||[]).map(c => c.net_revenue), 1)
  const stale        = stats.stale || {}

  // Build state-by-month matrix from monthlyByRegion
  const monthlyData = stats.monthlyByRegion || []
  const topStates   = [...new Set(monthlyData.map(r => r.region))].slice(0, 6)
  // Group by month for current/selected year
  const displayYear = statYear || CUR_YEAR_MKT
  const monthMatrix = MONTH_NAMES.map((mn, mi) => {
    const month = String(mi + 1).padStart(2, '0')
    const rows  = monthlyData.filter(r => r.year === String(displayYear) && r.month === month)
    return { month: mn, rows, total: rows.reduce((s,r) => s + (r.guests||0), 0) }
  })
  const maxMonthTotal = Math.max(...monthMatrix.map(m => m.total), 1)

  return (
    <div>
      {/* ── YEAR SELECTOR ── */}
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' }}>
        {YEARS_MKT.map(y => (
          <button key={y||'all'} onClick={() => setStatYear(y)} style={{
            padding:'4px 12px', borderRadius:'20px', cursor:'pointer', fontSize:'0.78rem',
            border:`1px solid ${statYear===y?'var(--gold)':'rgba(255,255,255,0.08)'}`,
            background: statYear===y?'rgba(200,144,58,0.15)':'transparent',
            color: statYear===y?'var(--gold)':'var(--text-dim)',
            fontWeight: statYear===y?'700':'400',
          }}>{y||'All years'}</button>
        ))}
      </div>

      {/* ── GUESTS BY STATE/REGION BY MONTH ── */}
      {monthMatrix.some(m => m.total > 0) && (
        <>
          <div className="card-section-label">GUESTS BY STATE · {statYear || 'ALL YEARS'}</div>
          <div style={{ background:'var(--dark-card)', borderRadius:'12px',
            border:'1px solid var(--border-dim)', padding:'12px', marginBottom:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:'3px', marginBottom:'8px' }}>
              {monthMatrix.map((m,i) => (
                <div key={i} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'0.6rem', color:'var(--text-dim)', marginBottom:'4px' }}>{m.month}</div>
                  <div style={{ position:'relative', height:'60px', display:'flex', flexDirection:'column',
                    justifyContent:'flex-end', gap:'1px' }}>
                    {topStates.map((state, si) => {
                      const row = m.rows.find(r => r.region === state)
                      const guests = row ? row.guests : 0
                      const pct = maxMonthTotal > 0 ? (guests/maxMonthTotal*100) : 0
                      return pct > 0 ? (
                        <div key={state} title={`${state}: ${guests} guests`} style={{
                          height:`${Math.max(pct*0.6, 2)}px`, borderRadius:'1px',
                          background: STATE_COLORS[si % STATE_COLORS.length], opacity:0.85
                        }}/>
                      ) : null
                    })}
                  </div>
                  {m.total > 0 && <div style={{ fontSize:'0.6rem', color:'var(--gold)', marginTop:'2px' }}>{m.total}</div>}
                </div>
              ))}
            </div>
            {/* Legend */}
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', paddingTop:'6px',
              borderTop:'1px solid var(--border-dim)' }}>
              {topStates.map((state, si) => (
                <div key={state} style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'0.7rem' }}>
                  <div style={{ width:8, height:8, borderRadius:2,
                    background:STATE_COLORS[si%STATE_COLORS.length] }}/>
                  <span style={{ color:'var(--text-dim)' }}>{state}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── CITY BREAKDOWN ── */}
      <div className="card-section-label">GUESTS BY CITY · {statYear || 'ALL YEARS'}</div>
      <div style={{ background:'var(--dark-card)', borderRadius:'12px',
        border:'1px solid var(--border-dim)', overflow:'hidden', marginBottom:'14px' }}>
        {(stats.cities||[]).filter(c => c.city_name !== 'Unknown').slice(0,15).map((c,i) => (
          <div key={i} style={{ padding:'10px 16px',
            borderBottom: i < stats.cities.length-1 ? '1px solid var(--border-dim)' : 'none' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
              <div>
                <span style={{ fontWeight:'600', fontSize:'0.88rem' }}>
                  {c.city_name}
                </span>
                {(c.state_name || c.country_name !== 'India') && (
                  <span style={{ color:'var(--text-dim)', fontSize:'0.75rem', marginLeft:'6px' }}>
                    {[c.state_name, c.country_name !== 'India' ? c.country_name : ''].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
              <div style={{ textAlign:'right' }}>
                <span style={{ color:'var(--gold)', fontWeight:'700', fontSize:'0.88rem' }}>
                  {c.guest_count} guest{c.guest_count!==1?'s':''}
                </span>
                <span style={{ color:'var(--text-dim)', fontSize:'0.72rem', marginLeft:'8px' }}>
                  {c.booking_count} stays
                </span>
              </div>
            </div>
            {/* Bar */}
            <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:2, background:'var(--gold)',
                width:`${Math.round(c.guest_count/maxCityCount*100)}%`, transition:'width 0.3s' }}/>
            </div>
          </div>
        ))}
        {(stats.cities||[]).filter(c => c.city_name === 'Unknown').length > 0 && (
          <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border-dim)',
            color:'var(--text-dim)', fontSize:'0.78rem' }}>
            ⚠️ {stats.cities.find(c=>c.city_name==='Unknown')?.guest_count} guests with no city data
          </div>
        )}
      </div>

      {/* ── PURPOSE / CATEGORY ── */}
      <div className="card-section-label">PURPOSE OF STAY</div>
      <div style={{ background:'var(--dark-card)', borderRadius:'12px',
        border:'1px solid var(--border-dim)', overflow:'hidden', marginBottom:'14px' }}>
        {(stats.purposes||[]).map((p,i) => (
          <div key={i} style={{ padding:'10px 16px',
            borderBottom: i < stats.purposes.length-1 ? '1px solid var(--border-dim)' : 'none',
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:'600', fontSize:'0.88rem' }}>{p.purpose}</div>
              <div style={{ color:'var(--text-dim)', fontSize:'0.73rem', marginTop:'1px' }}>
                {p.guests} guest{p.guests!==1?'s':''} · {p.bookings} booking{p.bookings!==1?'s':''}
              </div>
            </div>
            <div style={{ color:'#34A853', fontWeight:'700', fontSize:'0.88rem' }}>
              {fmt(p.revenue)}
            </div>
          </div>
        ))}
      </div>

      {/* ── CHANNEL: BOOKINGS vs REVENUE ── */}
      <div className="card-section-label">CHANNEL — BOOKINGS vs REVENUE</div>
      <div style={{ background:'var(--dark-card)', borderRadius:'12px',
        border:'1px solid var(--border-dim)', overflow:'hidden', marginBottom:'14px' }}>
        {(stats.channels||[]).map((ch,i) => {
          return (
            <div key={i} style={{ padding:'12px 16px',
              borderBottom: i < stats.channels.length-1 ? '1px solid var(--border-dim)' : 'none' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'0.75rem', fontWeight:'700', padding:'2px 8px',
                    borderRadius:'8px', ...channelPillStyle(ch.channel) }}>{channelLabel(ch.channel)}</span>
                  <span style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>
                    {ch.bookings} bookings · {ch.unique_guests} guests
                  </span>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ color:'#34A853', fontWeight:'700', fontSize:'0.88rem' }}>{fmt(ch.net_revenue)}</div>
                  {ch.total_commission > 0 && (
                    <div style={{ color:'#e74c3c', fontSize:'0.72rem' }}>-{fmt(ch.total_commission)} comm</div>
                  )}
                </div>
              </div>
              {/* Revenue bar */}
              <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:3, background:m.color,
                  width:`${Math.round(ch.net_revenue/maxChRev*100)}%` }}/>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── STALE DATA REPORT ── */}
      <div className="card-section-label">DATA QUALITY</div>
      <div className="card">
        <div style={{ color:'var(--text-dim)', fontSize:'0.75rem', marginBottom:'10px' }}>
          {stale.total} total stays · missing fields:
        </div>
        {[
          ['City / origin',  stale.missing_city,    stale.total],
          ['State',          stale.missing_state,   stale.total],
          ['Country',        stale.missing_country, stale.total],
          ['Phone',          stale.missing_phone,   stale.total],
          ['Email',          stale.missing_email,   stale.total],
        ].map(([label, missing, total]) => {
          const pct = total ? Math.round(missing/total*100) : 0
          return (
            <div key={label} style={{ marginBottom:'8px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                <span style={{ fontSize:'0.8rem' }}>{label}</span>
                <span style={{ fontSize:'0.78rem',
                  color: pct > 50 ? '#e74c3c' : pct > 20 ? '#e67e22' : '#34A853',
                  fontWeight:'600' }}>
                  {missing} missing ({pct}%)
                </span>
              </div>
              <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:2,
                  background: pct > 50 ? '#e74c3c' : pct > 20 ? '#e67e22' : '#34A853',
                  width:`${pct}%` }}/>
              </div>
            </div>
          )
        })}
        <div style={{ fontSize:'0.73rem', color:'var(--text-dim)', marginTop:'8px',
          padding:'8px', background:'rgba(255,255,255,0.03)', borderRadius:'6px' }}>
          💡 City data is captured from the Google Check-in Form (Full Home Address field).
          Historical stays before the form integration will show as missing.
        </div>
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function GuestRepository() {
  const navigate  = useNavigate()
  const [guests, setGuests]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all')
  const [tab, setTab]         = useState('guests')   // 'guests' | 'marketing'
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api.getGuests()
      .then(g => { setGuests(Array.isArray(g) ? g.sort((a,b) => (b.totalStays||0)-(a.totalStays||0)) : []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const FILTERS = [
    { key:'all',      label:'All' },
    { key:'vip',      label:'⭐ VIP' },
    { key:'frequent', label:'🔄 Repeat' },
    { key:'temple',   label:'🛕 Temple' },
    { key:'wedding',  label:'💒 Wedding' },
    { key:'overseas', label:'✈️ Overseas' },
    { key:'family',   label:'👨‍👩‍👧‍👦 Family' },
  ]

  const filtered = guests.filter(g => {
    if (search && !g.name?.toLowerCase().includes(search.toLowerCase()) &&
        !g.fromCity?.toLowerCase().includes(search.toLowerCase()) &&
        !g.country?.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'all') return true
    return getSegments(g).includes(filter)
  })

  const repeatGuests  = guests.filter(g => (g.totalStays||0) > 1).length
  const withContact   = guests.filter(g => g.phone || g.email).length
  const segmentCounts = {}
  Object.keys(SEGMENTS).forEach(seg => {
    segmentCounts[seg] = guests.filter(g => getSegments(g).includes(seg)).length
  })

  if (selected) return <GuestDetail guest={selected} onClose={() => setSelected(null)}/>

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Guest Repository</div>
          <div className="topbar-sub">MARKETING · RELATIONSHIPS</div>
        </div>
        <div style={{width:34}}/>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', background:'var(--dark-card)',
        borderBottom:'1px solid var(--border-dim)', flexShrink:0 }}>
        {[
          { key:'guests',    label:'Guests',    icon:'👥' },
          { key:'marketing', label:'Marketing', icon:'🎯' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex:1, padding:'12px 4px', border:'none', background:'transparent', cursor:'pointer',
            color:tab===t.key?'var(--gold)':'var(--text-dim)',
            borderBottom:tab===t.key?'2px solid var(--gold)':'2px solid transparent',
            fontSize:'0.78rem', fontWeight:tab===t.key?'700':'400',
          }}>
            <div style={{ fontSize:'1rem', marginBottom:'2px' }}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      <div className="screen-body">

        {/* ── GUESTS TAB ── */}
        {tab === 'guests' && (
          <>
            {/* Stats */}
            {!loading && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginBottom:'14px' }}>
                {[
                  { label:'Total guests', val:guests.length,  color:'var(--text)' },
                  { label:'Repeat guests', val:repeatGuests,  color:'var(--gold)' },
                  { label:'With contact', val:withContact,    color:'var(--green)' },
                ].map((s,i) => (
                  <div key={i} style={{ background:'var(--dark-card)', borderRadius:'10px',
                    border:'1px solid var(--border-dim)', padding:'10px', textAlign:'center' }}>
                    <div style={{ color:s.color, fontSize:'1.4rem', fontWeight:'800' }}>{s.val}</div>
                    <div style={{ color:'var(--text-dim)', fontSize:'0.68rem', marginTop:'2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Segment counts */}
            {!loading && (
              <>
                <div className="card-section-label">SEGMENTS</div>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' }}>
                  {Object.entries(SEGMENTS).map(([key, seg]) => (
                    <div key={key} style={{ padding:'4px 10px', borderRadius:'12px',
                      background:seg.bg, border:`1px solid ${seg.color}44`,
                      fontSize:'0.72rem', fontWeight:'600', color:seg.color }}>
                      {seg.icon} {seg.label} ({segmentCounts[key]||0})
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Search */}
            <input className="field-input"
              placeholder="🔍 Search by name, city or country…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ marginBottom:'10px', width:'100%' }}/>

            {/* Filter pills */}
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' }}>
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontSize:'0.75rem',
                  border:`1px solid ${filter===f.key?'var(--gold)':'rgba(255,255,255,0.08)'}`,
                  background: filter===f.key?'rgba(200,144,58,0.15)':'transparent',
                  color: filter===f.key?'var(--gold)':'var(--text-dim)',
                  fontWeight: filter===f.key?'700':'400', whiteSpace:'nowrap',
                }}>
                  {f.label}{filter===f.key && filtered.length ? ` (${filtered.length})` : ''}
                </button>
              ))}
            </div>

            <div className="card-section-label">{filtered.length} GUESTS</div>

            {loading
              ? Array(6).fill(0).map((_,i) => <div key={i} style={{ height:80,
                  background:'rgba(255,255,255,0.04)', borderRadius:'12px', marginBottom:'8px' }}/>)
              : filtered.length === 0
                ? <div className="card" style={{ textAlign:'center', color:'var(--text-dim)', padding:'32px' }}>No guests found</div>
                : filtered.map((g,i) => <GuestCard key={i} guest={g} onClick={() => setSelected(g)}/>)
            }
          </>
        )}

        {/* ── MARKETING TAB ── */}
        {tab === 'marketing' && <MarketingTab />}
      </div>
    </div>
  )
}
