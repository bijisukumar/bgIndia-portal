// ============================================================
//  MarketingCampaigns.jsx
//  Campaign creation, analytics dashboard, flyer generator
//  Route: /owner/marketing
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'

const LANDING = CONFIG.landingUrl
const API_BASE = '/api'
const CHANNELS = ['WhatsApp','Instagram','Facebook','Print','Email','Temple group','Travel agent','Other']
const CHANNEL_ICON = { 'WhatsApp':'💬','Instagram':'📸','Facebook':'👥','Print':'🖨️',
  'Email':'📧','Temple group':'🛕','Travel agent':'✈️','Other':'📣' }

// ── QR code via Google Charts API (no lib needed) ─────────────
function QRCode({ value, size = 160 }) {
  const url = `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encodeURIComponent(value)}&choe=UTF-8&chld=M|2`
  return <img src={url} width={size} height={size} alt="QR Code" style={{ display:'block', imageRendering:'pixelated' }}/>
}

// ── Flyer component (printable / canvas-exportable) ───────────
const VILLA_IMG_BASE = 'https://www.luxuryvillasofguruvayur.com/images'
const LOGO_URL = 'https://manage.luxuryvillasofguruvayur.com/icons/logo-dark.png'

function VillaFlyer({ campaign, flyerRef }) {
  const trackUrl = `${LANDING}?ref=${campaign.unique_token}`
  return (
    <div ref={flyerRef} style={{
      width: '420px', minHeight: '700px', background: '#FAF7F2',
      fontFamily: "'Georgia', serif", position: 'relative',
      border: '1px solid #D4B483', overflow: 'hidden',
    }}>
      {/* Hero: real villa exterior photo, full-bleed with a dark gradient for legible text on top */}
      <div style={{ height: '260px', position: 'relative', overflow: 'hidden' }}>
        <img src={`${VILLA_IMG_BASE}/Home.jpg`} crossOrigin="anonymous" alt="Villa Exterior"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,8,2,0.55) 0%, rgba(10,8,2,0.15) 38%, rgba(10,8,2,0.1) 60%, rgba(250,247,242,1) 100%)' }} />
        {/* Logo, top-left, on top of the photo */}
        <img src={LOGO_URL} crossOrigin="anonymous" alt={CONFIG.brandName}
          style={{ position: 'absolute', top: '14px', left: '16px', width: '52px', height: 'auto', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />
        {/* Title, bottom of hero, over the photo */}
        <div style={{ position: 'absolute', bottom: '14px', left: '20px', right: '20px' }}>
          <div style={{ color: '#F0D99A', fontSize: '0.62rem', letterSpacing: '3px', marginBottom: '4px', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
            LUXURY VILLAS OF GURUVAYUR
          </div>
          <div style={{ color: '#FFFFFF', fontSize: '1.55rem', fontWeight: '700', letterSpacing: '0.5px', textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
            Dwarka — Sacred Stay
          </div>
          <div style={{ color: '#F0D99A', fontSize: '0.72rem', marginTop: '4px', letterSpacing: '1px', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
            GURUVAYUR, KERALA · INDIA
          </div>
        </div>
      </div>

      {/* Photo strip: bedroom, kitchen, dining, living, garden — the spaces, not just icons */}
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ color: '#8B6914', fontSize: '0.62rem', letterSpacing: '2px', marginBottom: '8px', textAlign: 'center' }}>
          STEP INSIDE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px' }}>
          {[
            { src: 'bedroom.jpg', label: 'Bedroom' },
            { src: 'ModernKitchen.jpg', label: 'Kitchen' },
            { src: 'Dining.jpg', label: 'Dining' },
            { src: 'Living.jpg', label: 'Living' },
            { src: 'garden.jpg', label: 'Garden' },
          ].map(p => (
            <div key={p.src} style={{ textAlign: 'center' }}>
              <div style={{ height: '52px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #E8D5A3' }}>
                <img src={`${VILLA_IMG_BASE}/${p.src}`} crossOrigin="anonymous" alt={p.label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ fontSize: '0.5rem', color: '#8B6914', marginTop: '3px', letterSpacing: '0.3px' }}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature grid */}
      <div style={{ padding: '16px 20px 12px' }}>
        <div style={{ color: '#8B6914', fontSize: '0.62rem', letterSpacing: '2px', marginBottom: '12px', textAlign: 'center' }}>
          EXCLUSIVELY YOURS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {[
            { icon: '🛏️', label: '4 Bedrooms', sub: 'AC · En-suite' },
            { icon: '🛁', label: '4.5 Bathrooms', sub: 'Premium fittings' },
            { icon: '👨‍👩‍👧‍👦', label: '10–12 Guests', sub: 'Full villa booking' },
            { icon: '🕌', label: '5 min to Temple', sub: 'Guruvayur Devaswom' },
            { icon: '🍳', label: 'Full Kitchen', sub: 'Chef on request' },
            { icon: '🅿️', label: 'Parking', sub: 'Secure · Covered' },
          ].map(f => (
            <div key={f.label} style={{ background: '#FFF8EE', border: '1px solid #E8D5A3', borderRadius: '6px', padding: '8px 10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '1.1rem' }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#3D2B00' }}>{f.label}</div>
                <div style={{ fontSize: '0.62rem', color: '#8B6914' }}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* QR + CTA row */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#FFF8EE', border: '1px solid #D4B483', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ flexShrink: 0 }}>
            <QRCode value={trackUrl} size={90}/>
            <div style={{ fontSize: '0.52rem', color: '#8B6914', textAlign: 'center', marginTop: '4px', letterSpacing: '0.5px' }}>Scan to enquire</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.62rem', color: '#8B6914', letterSpacing: '1.5px', marginBottom: '6px' }}>
              EXCLUSIVE OFFER
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#3D2B00', marginBottom: '8px', lineHeight: '1.3' }}>
              Book Your Sacred Family Stay
            </div>
            <a href={trackUrl} style={{
              display: 'block', background: 'linear-gradient(135deg, #B3924A, #8B6914)',
              color: '#FAF7F2', textAlign: 'center', padding: '9px 12px',
              borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700',
              letterSpacing: '1px', textDecoration: 'none',
            }}>
              ENQUIRE / BOOK NOW
            </a>
            <div style={{ fontSize: '0.58rem', color: '#8B6914', marginTop: '6px', textAlign: 'center' }}>
              +91 99950 43283 · luxuryvillasofguruvayur.com
            </div>
          </div>
        </div>

        {/* Campaign tag */}
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <span style={{ fontSize: '0.58rem', color: '#B3924A', letterSpacing: '1.5px', background: '#FFF0D4', padding: '3px 10px', borderRadius: '10px', border: '1px solid #E8D5A3' }}>
            {campaign.campaign_name.toUpperCase()} · {campaign.unique_token}
          </span>
        </div>
      </div>

      {/* Gold bottom bar */}
      <div style={{ background: '#B3924A', padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#FAF7F2', fontSize: '0.6rem', letterSpacing: '1px' }}>LUXURY VILLAS OF GURUVAYUR</div>
        <div style={{ color: '#F0D99A', fontSize: '0.6rem' }}>luxuryvillasofguruvayur.com</div>
      </div>
    </div>
  )
}

// ── Conversion funnel bar ─────────────────────────────────────
function FunnelBar({ clicks, inquiries, bookings }) {
  const max = Math.max(clicks, 1)
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
      {[
        { label: 'Clicks', val: clicks, color: '#185FA5', bg: 'rgba(24,95,165,0.15)' },
        { label: 'Inquiries', val: inquiries, color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
        { label: 'Bookings', val: bookings, color: '#34A853', bg: 'rgba(52,168,83,0.15)' },
      ].map(s => (
        <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginBottom: '4px' }}>
            <div style={{ height: '4px', width: `${(s.val/max)*100}%`, background: s.color, borderRadius: '2px', transition: 'width 0.5s' }}/>
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: '700', color: s.color }}>{s.val}</div>
          <div style={{ fontSize: '0.58rem', color: '#5C7080', letterSpacing: '0.5px' }}>{s.label}</div>
        </div>
      ))}
      <div style={{ textAlign: 'center', minWidth: '44px' }}>
        <div style={{ fontSize: '0.88rem', fontWeight: '700', color: bookings > 0 ? '#34A853' : '#5C7080' }}>
          {clicks > 0 ? Math.round((bookings/clicks)*100) : 0}%
        </div>
        <div style={{ fontSize: '0.58rem', color: '#5C7080' }}>Conv.</div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function MarketingCampaigns() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ campaignName: '', channel: 'WhatsApp', notes: '' })
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState(null)
  const [flyerCampaign, setFlyerCampaign] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const flyerRef = useRef(null)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const d = await api.getCampaigns(DEFAULT_VILLA_ID)
      setCampaigns(Array.isArray(d) ? d : [])
    } catch(e) { setCampaigns([]) }
    finally { setLoading(false) }
  }

  async function handleCreate() {
    if (!form.campaignName.trim()) { showToast('Campaign name required', 'error'); return }
    setCreating(true)
    try {
      const d = await api.createCampaign({
        campaignName: form.campaignName.trim(),
        channel: form.channel,
        villaId: DEFAULT_VILLA_ID,
        notes: form.notes.trim() || null,
      })
      showToast(`✅ Campaign created — token: ${d.token}`)
      setShowCreate(false)
      setForm({ campaignName: '', channel: 'WhatsApp', notes: '' })
      load()
    } catch(e) { showToast('Create failed: ' + e.message, 'error') }
    finally { setCreating(false) }
  }

  async function handleToggle(campaignId) {
    try {
      await api.toggleCampaign({ campaignId })
      setCampaigns(c => c.map(x => x.id === campaignId ? {...x, is_active: x.is_active ? 0 : 1} : x))
    } catch(e) { showToast('Failed', 'error') }
  }

  async function handleDelete(campaignId, name) {
    if (!confirm(`Delete "${name}" and all its analytics?`)) return
    try {
      await api.deleteCampaign({ campaignId })
      setCampaigns(c => c.filter(x => x.id !== campaignId))
      showToast('Deleted')
    } catch(e) { showToast('Delete failed', 'error') }
  }

  async function handleDownload(campaign) {
    setDownloading(true)
    setFlyerCampaign(campaign)
    // Let the flyer mount, then wait for every <img> inside it (hero, logo, 5
    // photo-strip thumbnails) to actually finish loading before capturing —
    // a fixed timeout isn't reliable now that the flyer pulls in 6 external
    // images instead of 0, especially on a slower connection.
    setTimeout(async () => {
      try {
        if (!window.html2canvas) {
          await new Promise((res, rej) => {
            const s = document.createElement('script')
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
            s.onload = res; s.onerror = rej
            document.head.appendChild(s)
          })
        }
        const imgs = Array.from(flyerRef.current.querySelectorAll('img'))
        await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => {
          img.onload = res; img.onerror = res   // resolve even on error so one bad image doesn't hang the download forever
          setTimeout(res, 8000)                  // hard cap per image so a stalled load can't block the export indefinitely
        })))
        const canvas = await window.html2canvas(flyerRef.current, { scale: 2, useCORS: true, backgroundColor: '#FAF7F2' })
        const link = document.createElement('a')
        link.download = `LVG-${campaign.unique_token}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        showToast('✅ Flyer downloaded!')
      } catch(e) { showToast('Download failed — try again', 'error') }
      finally { setDownloading(false) }
    }, 300)
  }

  const totalClicks = campaigns.reduce((s,c) => s+(c.clicks||0), 0)
  const totalInquiries = campaigns.reduce((s,c) => s+(c.inquiries||0), 0)
  const totalBookings = campaigns.reduce((s,c) => s+(c.bookings||0), 0)

  const INP = { width:'100%', padding:'9px 12px', borderRadius:'8px', boxSizing:'border-box', background:'var(--dark-input)', border:'1px solid var(--border-dim)', color:'var(--text)', fontSize:'0.9rem' }
  const LBL = { display:'block', fontSize:'0.68rem', color:'var(--text-dim)', letterSpacing:'1px', marginBottom:'4px' }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Marketing campaigns</div>
          <div className="topbar-sub">FLYERS · QR CODES · TRACKING</div>
        </div>
        <button onClick={()=>setShowCreate(s=>!s)}
          style={{ padding:'6px 14px', borderRadius:'8px', border:'none', background:'#B3924A', color:'#FAF7F2', fontWeight:'700', fontSize:'0.78rem', cursor:'pointer' }}>
          {showCreate ? '✕' : '+ New'}
        </button>
      </div>

      <div className="screen-body">

        {/* Portfolio KPIs */}
        {campaigns.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'14px' }}>
            {[
              { label:'TOTAL CLICKS',    val: totalClicks,    color:'#185FA5' },
              { label:'INQUIRIES',       val: totalInquiries, color:'#F59E0B' },
              { label:'BOOKINGS',        val: totalBookings,  color:'#34A853' },
            ].map(k => (
              <div key={k.label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
                <div style={{ fontSize:'0.58rem', color:'#5C7080', letterSpacing:'1px', marginBottom:'4px' }}>{k.label}</div>
                <div style={{ fontWeight:'700', color:k.color, fontSize:'1.2rem' }}>{k.val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div style={{ background:'rgba(179,146,74,0.06)', border:'1px solid rgba(179,146,74,0.25)', borderRadius:'12px', padding:'16px', marginBottom:'14px' }}>
            <div style={{ fontWeight:'700', color:'#B3924A', fontSize:'0.88rem', marginBottom:'12px' }}>New campaign</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <div style={{ gridColumn:'span 2' }}>
                <label style={LBL}>CAMPAIGN NAME *</label>
                <input value={form.campaignName} onChange={e=>setForm(f=>({...f,campaignName:e.target.value}))}
                  placeholder="e.g. Temple Friends, John Uncle, Guruvayur Group…"
                  style={INP}/>
              </div>
              <div>
                <label style={LBL}>CHANNEL</label>
                <select value={form.channel} onChange={e=>setForm(f=>({...f,channel:e.target.value}))} style={INP}>
                  {CHANNELS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={LBL}>NOTES</label>
                <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                  placeholder="Who, occasion, target…" style={INP}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px', marginTop:'12px' }}>
              <button onClick={()=>setShowCreate(false)}
                style={{ flex:1, padding:'9px', borderRadius:'9px', border:'1px solid var(--border-dim)', background:'transparent', color:'var(--text-dim)', cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={creating || !form.campaignName.trim()}
                style={{ flex:2, padding:'9px', borderRadius:'9px', border:'none', background:'#B3924A', color:'#FAF7F2', fontWeight:'700', cursor:'pointer', opacity:creating||!form.campaignName.trim()?0.6:1 }}>
                {creating ? 'Creating…' : 'Create campaign'}
              </button>
            </div>
          </div>
        )}

        {/* Campaign list */}
        {loading && <div style={{ textAlign:'center', color:'#5C7080', padding:'24px', fontSize:'0.85rem' }}>Loading campaigns…</div>}

        {!loading && campaigns.length === 0 && !showCreate && (
          <div style={{ textAlign:'center', padding:'32px', color:'#5C7080', fontSize:'0.85rem', border:'1px dashed rgba(179,146,74,0.2)', borderRadius:'12px' }}>
            No campaigns yet.<br/>
            <span style={{ fontSize:'0.75rem' }}>Tap "+ New" to create your first trackable flyer.</span>
          </div>
        )}

        {campaigns.map(c => (
          <div key={c.id} style={{ background:'var(--dark-card)', border:`1px solid ${c.is_active?'rgba(179,146,74,0.2)':'rgba(255,255,255,0.05)'}`, borderRadius:'12px', padding:'14px', marginBottom:'8px', opacity: c.is_active ? 1 : 0.6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'1rem' }}>{CHANNEL_ICON[c.channel]||'📣'}</span>
                  <span style={{ fontWeight:'700', fontSize:'0.92rem', color:'#EDF2F7' }}>{c.campaign_name}</span>
                  {!c.is_active && <span style={{ fontSize:'0.62rem', color:'#5C7080', background:'rgba(255,255,255,0.06)', padding:'1px 6px', borderRadius:'8px' }}>PAUSED</span>}
                </div>
                <div style={{ fontSize:'0.68rem', color:'#5C7080', marginTop:'3px', fontFamily:'monospace' }}>
                  {c.channel} · token: {c.unique_token}
                </div>
              </div>
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={() => { setFlyerCampaign(c) }}
                  style={{ padding:'5px 10px', borderRadius:'7px', border:'1px solid rgba(179,146,74,0.35)', background:'rgba(179,146,74,0.1)', color:'#B3924A', fontSize:'0.72rem', cursor:'pointer', fontWeight:'600' }}>
                  🖼️ Flyer
                </button>
                <button onClick={() => handleToggle(c.id)}
                  style={{ padding:'5px 10px', borderRadius:'7px', border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#9AA5B4', fontSize:'0.72rem', cursor:'pointer' }}>
                  {c.is_active ? 'Pause' : 'Resume'}
                </button>
                <button onClick={() => handleDelete(c.id, c.campaign_name)}
                  style={{ padding:'5px 10px', borderRadius:'7px', border:'1px solid rgba(239,68,68,0.3)', background:'transparent', color:'#EF4444', fontSize:'0.72rem', cursor:'pointer' }}>
                  ×
                </button>
              </div>
            </div>
            <FunnelBar clicks={c.clicks||0} inquiries={c.inquiries||0} bookings={c.bookings||0}/>
          </div>
        ))}

        {/* Flyer modal */}
        {flyerCampaign && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:300, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
            <div style={{ background:'var(--dark-card)', borderRadius:'16px', padding:'16px', width:'100%', maxWidth:'460px', maxHeight:'90vh', overflowY:'auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                <div style={{ fontWeight:'700', color:'#B3924A', fontSize:'0.9rem' }}>{flyerCampaign.campaign_name}</div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => handleDownload(flyerCampaign)} disabled={downloading}
                    style={{ padding:'7px 14px', borderRadius:'8px', border:'none', background:'#B3924A', color:'#FAF7F2', fontWeight:'700', fontSize:'0.78rem', cursor:'pointer', opacity:downloading?0.6:1 }}>
                    {downloading ? 'Generating…' : '⬇️ Download PNG'}
                  </button>
                  <button onClick={() => setFlyerCampaign(null)}
                    style={{ padding:'7px 12px', borderRadius:'8px', border:'1px solid var(--border-dim)', background:'transparent', color:'var(--text-dim)', cursor:'pointer' }}>
                    ✕
                  </button>
                </div>
              </div>
              {/* Tracking URL */}
              <div style={{ background:'rgba(179,146,74,0.06)', border:'1px solid rgba(179,146,74,0.2)', borderRadius:'8px', padding:'8px 12px', marginBottom:'12px', fontFamily:'monospace', fontSize:'0.72rem', color:'#B3924A', wordBreak:'break-all' }}>
                {LANDING}?ref={flyerCampaign.unique_token}
              </div>
              {/* Flyer preview */}
              <div style={{ display:'flex', justifyContent:'center', overflowX:'auto' }}>
                <VillaFlyer campaign={flyerCampaign} flyerRef={flyerRef}/>
              </div>
              <div style={{ fontSize:'0.68rem', color:'#5C7080', textAlign:'center', marginTop:'8px' }}>
                Download as PNG → share on WhatsApp / Instagram
              </div>
            </div>
          </div>
        )}

        <div style={{ height: '20px' }}/>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
