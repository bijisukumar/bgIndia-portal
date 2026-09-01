/**
 * PlatformSignups.jsx
 * Maintenance > Signups - who has come in through the three public forms.
 * Route: /owner/maintenance/signups   (master_owner only)
 *
 * The intake forms wrote a row and emailed the operator, and that was the
 * whole story. During a launch the question is not "did an email arrive" but
 * "how many came in, and who has not been called back" - which a mailbox
 * answers badly.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { whatsappDraft, waLink, fillTemplate } from './leadOutreach'

const RANGES = [7, 30, 90, 365]

function fmtWhen(d) {
  if (!d) return ''
  try {
    const dt = new Date(String(d).replace(' ', 'T') + 'Z')
    return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return d }
}

export default function PlatformSignups() {
  const navigate = useNavigate()
  const [days, setDays] = useState(90)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  // Keyed by request id: 'sending' | 'sent' | an error string. Local to this
  // view; the server's ackSent is the durable record.
  const [acks, setAcks] = useState({})

  const sendAck = async (r, message) => {
    if (acks[r.id] === 'sending') return
    setAcks(a => ({ ...a, [r.id]: 'sending' }))
    try {
      await api.sendInviteAck(r.id, message)
      setAcks(a => ({ ...a, [r.id]: 'sent' }))
    } catch (e) {
      setAcks(a => ({ ...a, [r.id]: e?.message || 'Failed' }))
    }
  }

  useEffect(() => {
    setData(null); setError('')
    api.getPlatformSignups(days)
      .then(setData)
      .catch(e => setError(e?.message || 'Could not load signups'))
  }, [days])

  const invites = data?.invites || []
  const hosts   = data?.hosts   || []
  const leads   = data?.leads   || []
  const total   = invites.length + hosts.length + leads.length

  return (
    <div style={s.page}>
      <button style={s.back} onClick={() => navigate('/owner/maintenance')}>&larr; Maintenance</button>
      <h1 style={s.h1}>Signups</h1>
      <p style={s.sub}>Everyone who came in through the invite, host registration and demo forms.</p>

      <div style={s.rangeRow}>
        {RANGES.map(d => (
          <button key={d} onClick={() => setDays(d)}
            style={{ ...s.range, ...(d === days ? s.rangeOn : {}) }}>
            {d === 365 ? '1 year' : d + ' days'}
          </button>
        ))}
      </div>

      {error && <p style={s.error}>{error}</p>}
      {!data && !error && <p style={s.dim}>Loading...</p>}

      {data && (
        <>
          <div style={s.tiles}>
            <Tile n={invites.length} label="Invite requests" tone="#C8903A" />
            <Tile n={hosts.length} label="Host registrations" tone="#5FD0AE" />
            <Tile n={leads.length} label="Demo requests" tone="#85B7EB" />
          </div>

          {total === 0 && (
            <p style={s.dim}>Nothing in this window. Widen the range, or the campaign has not landed yet.</p>
          )}

          <Section title="Invite requests" rows={invites} empty="No invite requests yet."
            render={r => (
              <>
                <Line label="Contact" value={r.whatsapp} wa={waLink(r.whatsapp)} />
                <Line label="Email" value={r.email} />
                <Line label="Where" value={[r.location, r.property_name].filter(Boolean).join(' - ')} />
                <Line label="Property" value={[r.property_type, r.property_count && (r.property_count + ' unit(s)')].filter(Boolean).join(' - ')} />
                <Line label="Channels" value={r.channels} />
                <Line label="Foreign guests" value={r.foreign_guests} />
                <Line label="Ready in 6-8 wks" value={r.onboard_3m} />
                <Line label="Interested in" value={r.interests} />
                <Line label="Notes" value={r.notes} />
                <Outreach r={r} ackTemplate={data.ackTemplate}
                  state={acks[r.id]} onSendEmail={(text) => sendAck(r, text)} />
              </>
            )} />

          <Section title="Host registrations" rows={hosts} empty="No host registrations yet."
            nameOf={r => r.brand_name || r.owner_name}
            render={r => (
              <>
                <Line label="Owner" value={r.owner_name} />
                <Line label="Contact" value={r.owner_whatsapp} wa={waLink(r.owner_whatsapp)} />
                <Line label="Email" value={r.owner_email} />
                <Line label="Villa" value={r.villa_display_name} />
                <Line label="Address" value={r.address} />
                <Line label="Bedrooms" value={r.bedrooms} />
              </>
            )} />

          <Section title="Demo requests" rows={leads} empty="No demo requests yet."
            render={r => (
              <>
                <Line label="Contact" value={r.phone} wa={waLink(r.phone)} />
                <Line label="Email" value={r.email} />
                <Line label="Source" value={r.source} />
                <Line label="Notes" value={r.notes} />
              </>
            )} />
        </>
      )}
    </div>
  )
}

// Outreach for one signup. Both drafts open in a textarea first: the operator
// is looking at this person's answers while they write, and one sentence that
// responds to what they actually said is worth more than any template. Nothing
// leaves without being seen.
function Outreach({ r, ackTemplate, state, onSendEmail }) {
  const [open, setOpen] = useState(null)          // 'wa' | 'email' | null
  const [waText, setWaText] = useState('')
  const [mailText, setMailText] = useState('')

  const sent = state === 'sent' || (r.ackSent && !state)
  const failed = state && state !== 'sending' && state !== 'sent'

  const openWa = () => {
    if (!waText) setWaText(whatsappDraft(r))
    setOpen(open === 'wa' ? null : 'wa')
  }
  const openMail = () => {
    if (!mailText) setMailText(fillTemplate(ackTemplate, r))
    setOpen(open === 'email' ? null : 'email')
  }

  const box = {
    width: '100%', minHeight: 190, marginTop: 8, padding: '10px 12px',
    borderRadius: 8, background: '#141820', color: '#EDF2F7',
    border: '1px solid rgba(200,144,58,0.25)', fontSize: 14,
    fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
  }
  const btn = (tone) => ({
    padding: '7px 12px', borderRadius: 8, fontSize: '0.76rem', fontWeight: 700,
    cursor: 'pointer', border: '1px solid ' + tone + '66',
    background: tone + '1f', color: tone,
  })

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {r.whatsapp && (
          <button style={btn('#25D366')} onClick={openWa}>
            {open === 'wa' ? 'Hide message' : 'WhatsApp'}
          </button>
        )}
        {r.email && (
          <button style={btn(sent ? '#5FD0AE' : '#C8903A')} onClick={openMail}>
            {open === 'email' ? 'Hide email' : sent ? 'Email again' : 'Email'}
          </button>
        )}
        {sent && <span style={{ fontSize: '0.72rem', color: '#5FD0AE' }}>confirmation sent</span>}
        {failed && <span style={{ fontSize: '0.72rem', color: '#EF9A9A' }}>{state}</span>}
      </div>

      {open === 'wa' && (
        <div>
          <textarea style={box} value={waText} onChange={e => setWaText(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            {/* Opens WhatsApp with the text prefilled. It is still the operator
                who presses send there, which is the right place for that
                decision to sit. */}
            <a href={waLink(r.whatsapp, waText) || '#'} target="_blank" rel="noreferrer"
              style={{ ...btn('#25D366'), textDecoration: 'none', display: 'inline-block' }}>
              Open in WhatsApp
            </a>
            <span style={{ fontSize: '0.7rem', color: '#5C7080' }}>
              opens your WhatsApp with this text ready to send
            </span>
          </div>
        </div>
      )}

      {open === 'email' && (
        <div>
          <textarea style={box} value={mailText} onChange={e => setMailText(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <button
              style={{ ...btn('#C8903A'), opacity: state === 'sending' ? 0.6 : 1 }}
              disabled={state === 'sending'}
              onClick={() => onSendEmail(mailText)}>
              {state === 'sending' ? 'Sending...' : 'Send email'}
            </button>
            <span style={{ fontSize: '0.7rem', color: '#5C7080' }}>
              sends from invitation@stayvibe360.com, blind-copied to you
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function Tile({ n, label, tone }) {
  return (
    <div style={{ ...s.tile, borderColor: n > 0 ? tone + '55' : 'rgba(255,255,255,0.08)' }}>
      <div style={{ ...s.tileN, color: n > 0 ? tone : '#5C7080' }}>{n}</div>
      <div style={s.tileL}>{label}</div>
    </div>
  )
}

function Section({ title, rows, empty, render, nameOf }) {
  if (!rows.length) {
    return (
      <div style={s.section}>
        <p style={s.sectionTitle}>{title}</p>
        <p style={s.dim}>{empty}</p>
      </div>
    )
  }
  return (
    <div style={s.section}>
      <p style={s.sectionTitle}>{title} &middot; {rows.length}</p>
      {rows.map(r => (
        <div key={r.id} style={s.card}>
          <div style={s.cardHead}>
            <span style={s.cardName}>{(nameOf ? nameOf(r) : r.name) || 'Unnamed'}</span>
            <span style={s.cardWhen}>{fmtWhen(r.created_at)}</span>
          </div>
          {r.status && r.status !== 'new' && <span style={s.status}>{r.status}</span>}
          {render(r)}
        </div>
      ))}
    </div>
  )
}

// Blank fields are hidden rather than shown as dashes. Most of these forms are
// half-filled on a phone, and a wall of empty rows buries the answers somebody
// did take the trouble to give.
function Line({ label, value, wa }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={s.line}>
      <span style={s.lineLabel}>{label}</span>
      <span style={s.lineValue}>
        {value}
        {wa && <a href={wa} target="_blank" rel="noreferrer" style={s.wa}>WhatsApp</a>}
      </span>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#111111', padding: '18px 14px 60px', color: '#EDF2F7' },
  back: { background: 'none', border: 'none', color: '#C8903A', fontSize: '0.8rem', padding: 0, marginBottom: 14, cursor: 'pointer' },
  h1: { fontSize: '1.3rem', fontWeight: 800, margin: '0 0 4px' },
  sub: { fontSize: '0.8rem', color: '#8A9BAE', margin: '0 0 16px' },
  dim: { fontSize: '0.82rem', color: '#8A9BAE' },
  error: { fontSize: '0.82rem', color: '#EF9A9A' },
  rangeRow: { display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
  range: { padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(200,144,58,0.25)', background: 'transparent', color: '#8A9BAE', fontSize: '0.76rem', cursor: 'pointer' },
  rangeOn: { background: 'rgba(200,144,58,0.15)', color: '#C8903A', fontWeight: 700 },
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 22 },
  tile: { background: '#1A1F2B', border: '1px solid', borderRadius: 12, padding: '14px 12px', textAlign: 'center' },
  tileN: { fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 },
  tileL: { fontSize: '0.68rem', color: '#8A9BAE', marginTop: 6 },
  section: { marginBottom: 26 },
  sectionTitle: { fontSize: '0.7rem', letterSpacing: '0.09em', fontWeight: 800, color: '#5C7080', marginBottom: 10 },
  card: { background: '#1A1F2B', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  cardName: { fontWeight: 700, fontSize: '0.95rem' },
  cardWhen: { fontSize: '0.7rem', color: '#8A9BAE', whiteSpace: 'nowrap' },
  status: { display: 'inline-block', fontSize: '0.65rem', color: '#C8903A', border: '1px solid rgba(200,144,58,0.35)', borderRadius: 6, padding: '1px 6px', marginBottom: 8 },
  line: { display: 'flex', gap: 10, padding: '3px 0', fontSize: '0.8rem' },
  lineLabel: { color: '#5C7080', minWidth: 112, flexShrink: 0 },
  lineValue: { color: '#EDF2F7', wordBreak: 'break-word' },
  wa: { marginLeft: 8, color: '#25D366', textDecoration: 'none', fontWeight: 700, fontSize: '0.72rem' },
}
