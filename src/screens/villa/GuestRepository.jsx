import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

// Marketing segment definitions
const SEGMENTS = {
  frequent:   { label:'Frequent Visitor',     icon:'⭐', color:'#C8903A', bg:'rgba(200,144,58,0.12)',  minStays: 3 },
  temple:     { label:'Temple Regular',       icon:'🛕', color:'#8B5CF6', bg:'rgba(139,92,246,0.12)', minStays: 2 },
  wedding:    { label:'Wedding Guest',        icon:'💒', color:'#EC4899', bg:'rgba(236,72,153,0.12)', keywords:['wedding','wed'] },
  family:     { label:'Family Traveller',     icon:'👨‍👩‍👧‍👦', color:'#34A853', bg:'rgba(52,168,83,0.12)',  minKids: 1 },
  overseas:   { label:'Overseas Guest',       icon:'✈️', color:'#185FA5', bg:'rgba(24,95,165,0.12)',  countries:['USA','UK','Australia','Canada','UAE','Singapore','Germany','France'] },
  vip:        { label:'VIP (5+ stays)',       icon:'👑', color:'#F59E0B', bg:'rgba(245,158,11,0.12)', minStays: 5 },
}

function getSegments(guest, stays) {
  const guestStays = stays.filter(s =>
    s.guestName?.toLowerCase() === guest.name?.toLowerCase() ||
    s.bookerName?.toLowerCase() === guest.name?.toLowerCase()
  )
  const tags = []
  const totalStays  = guest.totalStays || guestStays.length
  const totalNights = guest.totalNights || guestStays.reduce((s,r) => s + (parseInt(r.nights)||0), 0)
  const purposes    = guestStays.map(s => String(s.purpose||'').toLowerCase()).join(' ')
  const country     = String(guest.country || '').trim()

  if (totalStays >= 5)  tags.push('vip')
  else if (totalStays >= 3) tags.push('frequent')
  if (totalStays >= 2 && purposes.includes('temple')) tags.push('temple')
  if (SEGMENTS.wedding.keywords.some(k => purposes.includes(k))) tags.push('wedding')
  if (SEGMENTS.overseas.countries.some(c => country.toLowerCase().includes(c.toLowerCase()))) tags.push('overseas')
  // Family: check if any stay had children
  if (guestStays.some(s => parseInt(s.children||0) > 0 || parseInt(s.infants||0) > 0)) tags.push('family')

  return tags
}

function getMarketingActions(tags) {
  const actions = []
  if (tags.includes('vip') || tags.includes('frequent')) {
    actions.push({ icon:'🏆', text:'Invite to "Guruvayoorappan Special Stay" loyalty programme', priority:'high' })
    actions.push({ icon:'📅', text:'Send advance booking offer for Ekadasi & peak festivals', priority:'high' })
  }
  if (tags.includes('temple')) {
    actions.push({ icon:'🛕', text:'Monthly/quarterly temple visit package — offer repeat discount', priority:'high' })
    actions.push({ icon:'📿', text:'Send Guruvayur Ekadasi dates for next 6 months', priority:'medium' })
  }
  if (tags.includes('wedding')) {
    actions.push({ icon:'👶', text:'Invite for Choorunu (rice ceremony) stay — family milestone visits', priority:'high' })
    actions.push({ icon:'🎂', text:'Anniversary stay package — 1st, 5th, 10th year returns', priority:'medium' })
    actions.push({ icon:'🛕', text:'Yearly pilgrimage package for wedding anniversary blessing', priority:'medium' })
  }
  if (tags.includes('family')) {
    actions.push({ icon:'🏖️', text:'Summer holiday package — school break stays', priority:'medium' })
    actions.push({ icon:'🎄', text:'Christmas/Onam family reunion stay offer', priority:'medium' })
  }
  if (tags.includes('overseas')) {
    actions.push({ icon:'✈️', text:'India visit pre-booking — contact 3 months before peak season', priority:'high' })
    actions.push({ icon:'📧', text:'Email newsletter with Guruvayur festival calendar', priority:'medium' })
  }
  if (!actions.length) {
    actions.push({ icon:'💌', text:'Add to general mailing list for seasonal offers', priority:'low' })
  }
  return actions
}

function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { month:'short', year:'numeric' }) }
  catch { return String(d) }
}

function GuestCard({ guest, stays, onClick }) {
  const tags    = getSegments(guest, stays)
  const isRepeat = (guest.totalStays || 0) > 1

  return (
    <div onClick={onClick} style={{ background:'var(--dark-card)', border:'1px solid var(--border-dim)',
      borderRadius:'12px', padding:'14px 16px', marginBottom:'8px', cursor:'pointer',
      borderLeft: isRepeat ? '3px solid var(--gold)' : '1px solid var(--border-dim)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
            <span style={{ color:'var(--text)', fontWeight:'600', fontSize:'0.92rem' }}>{guest.name}</span>
            {isRepeat && (
              <span style={{ background:'rgba(200,144,58,0.2)', color:'var(--gold)', fontSize:'0.65rem',
                fontWeight:'800', padding:'2px 7px', borderRadius:'10px' }}>
                {guest.totalStays}× STAYS
              </span>
            )}
          </div>
          <div style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>
            {guest.totalNights || 0} nights · Last: {fmtDate(guest.lastStay)}
            {guest.country ? ` · ${guest.country}` : ''}
          </div>
        </div>
      </div>
      {/* Segment tags */}
      {tags.length > 0 && (
        <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginTop:'6px' }}>
          {tags.map(tag => (
            <span key={tag} style={{ padding:'2px 7px', borderRadius:'10px', fontSize:'0.67rem',
              fontWeight:'700', background: SEGMENTS[tag].bg, color: SEGMENTS[tag].color }}>
              {SEGMENTS[tag].icon} {SEGMENTS[tag].label}
            </span>
          ))}
        </div>
      )}
      {/* Contact availability */}
      <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
        {guest.phone && (
          <span style={{ fontSize:'0.7rem', color:'var(--green)' }}>📱 WhatsApp</span>
        )}
        {guest.email && (
          <span style={{ fontSize:'0.7rem', color:'var(--blue)' }}>📧 Email</span>
        )}
        {!guest.phone && !guest.email && (
          <span style={{ fontSize:'0.7rem', color:'var(--text-dim)' }}>No contact info</span>
        )}
      </div>
    </div>
  )
}

function GuestDetail({ guest, stays, onClose }) {
  const tags    = getSegments(guest, stays)
  const actions = getMarketingActions(tags)
  const guestStays = stays.filter(s =>
    s.guestName?.toLowerCase() === guest.name?.toLowerCase() ||
    s.bookerName?.toLowerCase() === guest.name?.toLowerCase()
  ).sort((a,b) => new Date(b.checkIn) - new Date(a.checkIn))

  const whatsappLink = guest.phone
    ? `https://wa.me/${guest.phone.replace(/[^0-9]/g,'')}?text=Namaste%20${encodeURIComponent(guest.name)}%2C%20We%20hope%20you%20enjoyed%20your%20stay%20at%20GVR%20Dwarka%20Villa.`
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
          {/* Segment badges */}
          {tags.length > 0 && (
            <>
              <div className="card-section-label">GUEST TYPE</div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' }}>
                {tags.map(tag => (
                  <span key={tag} style={{ padding:'5px 12px', borderRadius:'14px', fontSize:'0.78rem',
                    fontWeight:'700', background: SEGMENTS[tag].bg, color: SEGMENTS[tag].color,
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
            <div className="net-row">
              <span className="net-label">Total stays</span>
              <span style={{ color:'var(--gold)', fontWeight:'700' }}>{guest.totalStays || guestStays.length}</span>
            </div>
            <div className="net-row">
              <span className="net-label">Total nights</span>
              <span style={{ fontWeight:'600' }}>{guest.totalNights || 0}</span>
            </div>
            <div className="net-row">
              <span className="net-label">First stay</span>
              <span>{fmtDate(guest.firstStay)}</span>
            </div>
            <div className="net-row">
              <span className="net-label">Last stay</span>
              <span>{fmtDate(guest.lastStay)}</span>
            </div>
            {guest.country && (
              <div className="net-row">
                <span className="net-label">From</span>
                <span>{[guest.fromCity, guest.country].filter(Boolean).join(', ')}</span>
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
                  <div style={{ color:'var(--text)', fontSize:'0.9rem', marginTop:'3px' }}>{guest.phone}</div>
                </div>
                <a href={whatsappLink} target="_blank" rel="noreferrer"
                  style={{ padding:'8px 14px', borderRadius:'10px', background:'rgba(52,168,83,0.15)',
                    color:'var(--green)', fontSize:'0.82rem', fontWeight:'700', textDecoration:'none',
                    border:'1px solid rgba(52,168,83,0.3)' }}>
                  💬 Chat
                </a>
              </div>
            ) : (
              <div style={{ color:'var(--text-dim)', fontSize:'0.82rem', marginBottom:'10px' }}>No phone on record</div>
            )}
            {guest.email ? (
              <div>
                <div className="field-label">Email</div>
                <div style={{ color:'var(--text)', fontSize:'0.85rem', marginTop:'3px' }}>{guest.email}</div>
              </div>
            ) : (
              <div style={{ color:'var(--text-dim)', fontSize:'0.82rem' }}>No email on record</div>
            )}
          </div>

          {/* Marketing actions */}
          <div className="card-section-label">🎯 MARKETING ACTIONS</div>
          <div className="card">
            {actions.map((action, i) => (
              <div key={i} style={{ display:'flex', gap:'12px', paddingBottom:'10px', marginBottom:'10px',
                borderBottom: i < actions.length-1 ? '1px solid var(--border-dim)' : 'none' }}>
                <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{action.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ color:'var(--text)', fontSize:'0.83rem', lineHeight:'1.4' }}>{action.text}</div>
                  <div style={{ marginTop:'4px' }}>
                    <span style={{ fontSize:'0.68rem', fontWeight:'700', padding:'2px 6px', borderRadius:'8px',
                      background: action.priority==='high' ? 'rgba(229,57,53,0.15)' : action.priority==='medium' ? 'rgba(200,144,58,0.12)' : 'rgba(92,112,128,0.15)',
                      color: action.priority==='high' ? '#E53935' : action.priority==='medium' ? 'var(--gold)' : 'var(--text-dim)' }}>
                      {action.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Individual stays */}
          {guestStays.length > 0 && (
            <>
              <div className="card-section-label">ALL STAYS</div>
              <div style={{ background:'var(--dark-card)', borderRadius:'12px',
                border:'1px solid var(--border-dim)', overflow:'hidden', marginBottom:'12px' }}>
                {guestStays.map((s, i) => (
                  <div key={i} style={{ padding:'12px 16px',
                    borderBottom: i < guestStays.length-1 ? '1px solid var(--border-dim)' : 'none' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'3px' }}>
                      <span style={{ color:'var(--text)', fontWeight:'600', fontSize:'0.85rem' }}>
                        {fmtDate(s.checkIn)}
                      </span>
                      <span style={{ color:'var(--gold)', fontWeight:'600', fontSize:'0.85rem' }}>
                        {s.nights} night{s.nights>1?'s':''}
                      </span>
                    </div>
                    <div style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>
                      {s.channel} · {s.adults||0} adults{s.children>0?` · ${s.children} children`:''} · {s.stayId}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function GuestRepository() {
  const navigate    = useNavigate()
  const [guests, setGuests]       = useState([])
  const [stays,  setStays]        = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')
  const [selected, setSelected]   = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getGuests(),
      api.getStays('dwarka', 'all'),
    ]).then(([g, s]) => {
      setGuests(Array.isArray(g) ? g.sort((a,b) => (b.totalStays||0) - (a.totalStays||0)) : [])
      setStays(Array.isArray(s) ? s : [])
      setLoading(false)
    }).catch(() => setLoading(false))
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
    const matchSearch = !search ||
      g.name?.toLowerCase().includes(search.toLowerCase()) ||
      g.country?.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filter === 'all') return true
    const tags = getSegments(g, stays)
    return tags.includes(filter)
  })

  // Stats
  const repeatGuests   = guests.filter(g => (g.totalStays||0) > 1).length
  const withContact    = guests.filter(g => g.phone || g.email).length
  const segmentCounts  = {}
  Object.keys(SEGMENTS).forEach(seg => {
    segmentCounts[seg] = guests.filter(g => getSegments(g, stays).includes(seg)).length
  })

  if (selected) {
    return <GuestDetail guest={selected} stays={stays} onClose={() => setSelected(null)}/>
  }

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

      <div className="screen-body">
        {/* Stats row */}
        {!loading && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginBottom:'14px' }}>
            {[
              { label:'Total guests', val: guests.length, color:'var(--text)' },
              { label:'Repeat guests', val: repeatGuests, color:'var(--gold)' },
              { label:'With contact', val: withContact, color:'var(--green)' },
            ].map((s,i) => (
              <div key={i} style={{ background:'var(--dark-card)', borderRadius:'10px',
                border:'1px solid var(--border-dim)', padding:'10px', textAlign:'center' }}>
                <div style={{ color:s.color, fontSize:'1.4rem', fontWeight:'800' }}>{s.val}</div>
                <div style={{ color:'var(--text-dim)', fontSize:'0.68rem', marginTop:'2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Segment summary */}
        {!loading && (
          <>
            <div className="card-section-label">SEGMENTS</div>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' }}>
              {Object.entries(SEGMENTS).map(([key, seg]) => (
                <div key={key} style={{ padding:'5px 10px', borderRadius:'12px',
                  background: seg.bg, border:`1px solid ${seg.color}44`,
                  fontSize:'0.72rem', fontWeight:'600', color: seg.color }}>
                  {seg.icon} {seg.label} ({segmentCounts[key]||0})
                </div>
              ))}
            </div>
          </>
        )}

        {/* Search */}
        <input className="field-input" placeholder="🔍 Search by name or country..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ marginBottom:'10px', width:'100%' }}/>

        {/* Filter pills */}
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px', overflowX:'auto' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding:'5px 12px', borderRadius:'20px', border:`1px solid ${filter===f.key?'var(--gold)':'rgba(255,255,255,0.08)'}`,
                background: filter===f.key?'rgba(200,144,58,0.15)':'transparent',
                color: filter===f.key?'var(--gold)':'var(--text-dim)',
                fontSize:'0.75rem', fontWeight: filter===f.key?'700':'400', cursor:'pointer', whiteSpace:'nowrap' }}>
              {f.label} {filter===f.key && filtered.length > 0 ? `(${filtered.length})` : ''}
            </button>
          ))}
        </div>

        {/* Guest list */}
        <div className="card-section-label">
          {filtered.length} GUEST{filtered.length !== 1 ? 'S' : ''}
          {filter !== 'all' ? ` · ${FILTERS.find(f=>f.key===filter)?.label}` : ''}
        </div>

        {loading ? (
          Array(6).fill(0).map((_, i) => <div key={i} style={{ height:80, background:'rgba(255,255,255,0.04)', borderRadius:'12px', marginBottom:'8px' }}/>)
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign:'center', color:'var(--text-dim)', padding:'32px' }}>
            No guests found
          </div>
        ) : (
          filtered.map((guest, i) => (
            <GuestCard key={i} guest={guest} stays={stays} onClick={() => setSelected(guest)}/>
          ))
        )}
      </div>
    </div>
  )
}
