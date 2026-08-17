// ============================================================
// Flexibility.jsx — public "need flexibility" page
// Route: /flexibility   (anchors: #why, #request)
// No login required — linked from the marketing site.
//
// Two jobs:
//   1. Explain WHY check-out is 11:00 and check-in is 16:00, so the
//      request for a free early check-in doesn't start in the first
//      place. #why is linkable on its own for exactly that.
//   2. Take the request from DIRECT guests only. An OTA guest can't be
//      given an extra night here (their dates live in the channel's
//      system, and moving a confirmed booking off-platform breaches
//      their terms) — so they get a book-direct-next-time capture,
//      which turns a dead end into a lead.
//
// Every string a guest reads comes from CONFIG.flexibility.
// ============================================================

import { useState } from 'react'
import { CONFIG } from '../config'
import { DEFAULT_VILLA_ID } from '../utils/villaContext'

const F = CONFIG.flexibility
const villa = CONFIG.villas[0]

const c = {
  gold: '#C8903A', goldSoft: 'rgba(200,144,58,0.10)', goldLine: 'rgba(200,144,58,0.30)',
  text: '#EDF2F7', dim: '#9AA5B4', faint: '#6B7280',
  card: '#1B2130', line: 'rgba(255,255,255,0.08)', green: '#34A853',
}

// Sized for a thumb, not a mouse — this page is read on phones.
// fontSize is 16px on purpose: iOS Safari zooms the whole page when a field
// smaller than that takes focus, which throws the guest out of the layout
// mid-form. 13px padding takes the fields to ~45px, over the 44px minimum
// touch target; at 11px they measured 39px.
const input = {
  width: '100%', padding: '13px 14px', borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
  color: c.text, fontSize: '16px', outline: 'none', boxSizing: 'border-box',
}

function Field({ label, required, children, hint }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: c.dim,
        letterSpacing: '0.5px', marginBottom: '6px', textTransform: 'uppercase' }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: '0.68rem', color: c.faint, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function Done({ text, waLink }) {
  return (
    <div style={{ padding: '28px 22px', textAlign: 'center', background: 'rgba(52,168,83,0.08)',
      border: '1px solid rgba(52,168,83,0.3)', borderRadius: 14 }}>
      <div style={{ fontSize: '2.4rem', marginBottom: 12 }}>🙏</div>
      <div style={{ color: c.green, fontWeight: 700, marginBottom: 8 }}>Request received</div>
      <div style={{ color: c.dim, fontSize: '0.88rem', lineHeight: 1.6 }}>{text}</div>
      {waLink && (
        <a href={waLink} target="_blank" rel="noreferrer" style={{
          display: 'inline-block', marginTop: 16, padding: '12px 20px', borderRadius: 11,
          background: '#25D366', color: '#0B141A', fontWeight: 800, fontSize: '0.9rem',
          textDecoration: 'none' }}>
          Send it on WhatsApp
        </a>
      )}
    </div>
  )
}

export default function Flexibility() {
  const [channel,  setChannel]  = useState('')
  const [name,     setName]     = useState('')
  const [contact,  setContact]  = useState('')
  const [checkIn,  setCheckIn]  = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [needType, setNeedType] = useState('')
  const [priority, setPriority] = useState('')
  const [wantsDirect, setWantsDirect] = useState(false)
  const [inTime,   setInTime]   = useState('')
  const [outTime,  setOutTime]  = useState('')
  const [waLink,   setWaLink]   = useState('')
  const [lookup,  setLookup]   = useState(null)   // null | {found:false} | {found:true,...}
  const [looking, setLooking]  = useState(false)
  const [manual,  setManual]   = useState(false)  // fall back to the old free-form path
  const [details,  setDetails]  = useState('')
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState('')
  const [sent,     setSent]     = useState(null)   // 'direct' | 'ota'

  // The need type decides which times we ask for — asking a guest who only
  // wants a late check-out what time they'll arrive is noise.
  const wantsEarlyIn  = /earlier|both/i.test(needType)
  const wantsLateOut  = /later|both/i.test(needType)

  const isDirect = channel === F.directChannel
  const isOta    = !!channel && !isDirect

  async function findMe() {
    if (!name.trim())    { setError('Please tell us your name');  return }
    if (!contact.trim()) { setError('Please give the email or phone on the booking'); return }
    if (!checkIn || !checkOut) { setError('Please give both dates as they are on the booking'); return }
    setError(''); setLooking(true); setLookup(null)
    try {
      const res = await fetch('/api/findMyBooking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ villaId: DEFAULT_VILLA_ID, guestName: name.trim(),
          contact: contact.trim(), checkInDate: checkIn, checkOutDate: checkOut }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Could not look that up')
      setLookup(data.data)
      // Take the channel from the booking rather than asking — a guest who
      // picks the wrong one from a dropdown would be quoted the wrong thing.
      if (data.data.found) setChannel(data.data.isDirect ? F.directChannel : (F.channels[0] || 'OTA'))
    } catch (e) { setError(e.message) }
    finally { setLooking(false) }
  }

  // The quote, in the guest's own numbers. Only shown once we know which
  // booking we're talking about — the public copy above still carries no
  // figures, so nobody reverse-engineers a rate before we've seen the dates.
  function QuoteBlock({ title, rows, note }) {
    return (
      <div style={{ background: c.card, border: `1px solid ${c.line}`, borderRadius: 12,
        padding: '14px 15px', marginBottom: 12 }}>
        <div style={{ color: c.gold, fontWeight: 700, fontSize: '0.9rem', marginBottom: 8 }}>{title}</div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10,
            padding: '7px 0', borderTop: i ? `1px solid ${c.line}` : 'none' }}>
            <span style={{ color: c.text, fontSize: '0.86rem' }}>
              {r.hours} hrs — from {r.time}
            </span>
            <span style={{ color: c.dim, fontSize: '0.86rem', whiteSpace: 'nowrap' }}>
              {r.pct}% · ₹{Number(r.amount).toLocaleString('en-IN')}
            </span>
          </div>
        ))}
        {note && <div style={{ color: c.faint, fontSize: '0.72rem', marginTop: 8, lineHeight: 1.5 }}>{note}</div>}
      </div>
    )
  }

  // Prefilled WhatsApp to the owner. Same facts as the saved record, laid
  // out so it can be read on a phone without opening the portal.
  function buildWaLink(kind) {
    const digits = String(CONFIG.ownerWhatsApp || '').replace(/\D/g, '')
    if (!digits) return ''
    const L = []
    L.push(`*Flexibility request — ${villa.name}*`)
    L.push('')
    L.push(`Name: ${name.trim()}`)
    L.push(`Contact: ${contact.trim()}`)
    L.push(`Current booking: ${channel}`)
    if (checkIn || checkOut) L.push(`Dates: ${checkIn || '?'} to ${checkOut || '?'}`)
    if (kind === 'direct') {
      L.push(`Need: ${needType}`)
      if (wantsEarlyIn && inTime)  L.push(`Wants to arrive: ${inTime}`)
      if (wantsLateOut && outTime) L.push(`Wants to leave: ${outTime}`)
      const p = (F.form.priorities || []).find(x => x.id === priority)
      if (p) L.push(`Type: ${p.label}`)
    } else {
      L.push('Asking about direct rates for a future stay')
    }
    if (wantsDirect) L.push('Open to booking direct')
    if (details.trim()) L.push(`Notes: ${details.trim()}`)
    return `https://wa.me/${digits}?text=${encodeURIComponent(L.join('\n'))}`
  }

  async function submit(kind) {
    if (!name.trim())    { setError('Please tell us your name');  return }
    if (!contact.trim()) { setError('Please leave a phone or email so we can reply'); return }
    if (kind === 'direct' && !needType) { setError('Please tell us what you need'); return }
    if (kind === 'direct' && !priority) { setError('Please tell us whether this is a nice-to-have or a must-have'); return }
    setError(''); setBusy(true)
    try {
      const res = await fetch('/api/submitFlexRequest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villaId: DEFAULT_VILLA_ID,
          guestName: name.trim(), contact: contact.trim(),
          bookingChannel: channel,
          checkInDate: checkIn || null, checkOutDate: checkOut || null,
          // kind is 'direct' whenever there is a request to price — including
          // an OTA guest who ticked through to book with us, since that is a
          // conversion, not a lead. bookingChannel still carries where they
          // came from, so the owner can see it started on a platform.
          needType: kind === 'direct' ? needType : 'Asking for direct rates',
          priority: kind === 'direct' ? priority : null,
          wantsDirect,
          requestedCheckinTime:  kind === 'direct' && wantsEarlyIn ? (inTime  || null) : null,
          requestedCheckoutTime: kind === 'direct' && wantsLateOut ? (outTime || null) : null,
          details: details || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Could not send')

      // Recorded first, then handed to WhatsApp. Saving before opening means
      // the request still reaches the owner's list if the guest never presses
      // send in WhatsApp — the message is a faster nudge, not the record.
      const link = buildWaLink(kind)
      setWaLink(link)
      setSent(kind)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      // location.href rather than window.open: a popup opened after an await
      // has lost the user-gesture chain and gets blocked. The Done screen
      // still shows the link, so a blocked hand-off is recoverable.
      if (link) window.location.href = link
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  // Defined once and rendered by both paths. An OTA guest who ticks
  // "book directly with you" is converting, not filing a lead — so they
  // need the same details a direct request needs, in the same submission.
  // Two forms for one intent would be the two-step this replaces.
  const contactFields = (
    <>
      <Field label="Your name" required>
        <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
      </Field>
      <Field label="WhatsApp or email" required>
        <input style={input} value={contact} onChange={e => setContact(e.target.value)} placeholder="+91… or you@example.com" />
      </Field>
    </>
  )

  const dateFields = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
      <Field label="Check-in date" required>
        <input style={input} type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
      </Field>
      <Field label="Check-out date" required>
        <input style={input} type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
      </Field>
    </div>
  )

  const stayFields = (
    <>
      <Field label="What do you need?" required>
        <select value={needType} onChange={e => setNeedType(e.target.value)}
          style={{ ...input, background: '#1A2332', color: needType ? c.text : c.faint }}>
          <option value="">Select…</option>
          {F.form.needTypes.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>
      {/* The actual times. Without these the owner has to message back to
          ask, which is the round trip this page exists to remove — and the
          turnaround maths needs a time, not a date, to say yes or no. */}
      {(wantsEarlyIn || wantsLateOut) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {wantsEarlyIn && (
            <Field label={F.form.checkinTimeLabel || 'What time do you need to arrive?'}>
              <input style={input} type="time" value={inTime} onChange={e => setInTime(e.target.value)} />
            </Field>
          )}
          {wantsLateOut && (
            <Field label={F.form.checkoutTimeLabel || 'What time do you need to leave?'}>
              <input style={input} type="time" value={outTime} onChange={e => setOutTime(e.target.value)} />
            </Field>
          )}
        </div>
      )}
      {/* Radios, not a dropdown — the difference between the two is the
          whole point and shouldn't be hidden behind a tap. */}
      <Field label={F.form.priorityLabel || 'Type of request'} required>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(F.form.priorities || []).map(p => (
            <label key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
              background: priority === p.id ? 'rgba(200,144,58,0.12)' : c.card,
              border: `1px solid ${priority === p.id ? c.goldLine : c.line}` }}>
              <input type="radio" name="flexPriority" value={p.id} checked={priority === p.id}
                onChange={() => setPriority(p.id)} style={{ marginTop: 3, flexShrink: 0 }} />
              <span style={{ color: priority === p.id ? c.text : c.dim,
                fontSize: '0.88rem', lineHeight: 1.5 }}>{p.label}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Anything that helps us plan"
        hint="Who's travelling, how you're getting here, anything else we should know">
        <textarea rows={3} style={{ ...input, resize: 'vertical' }} value={details}
          onChange={e => setDetails(e.target.value)}
          placeholder="e.g. driving from Bengaluru overnight with two small children" />
      </Field>
    </>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E10', color: c.text,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 20px 72px' }}>

        {/* Hero */}
        <div style={{ fontSize: '0.68rem', letterSpacing: '2px', color: c.gold,
          fontWeight: 700, marginBottom: 12 }}>{F.hero.eyebrow}</div>
        <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', lineHeight: 1.25, margin: '0 0 14px',
          textWrap: 'balance' }}>{F.hero.title}</h1>
        <p style={{ color: c.dim, fontSize: '1rem', lineHeight: 1.7, margin: '0 0 32px' }}>
          {F.hero.intro}
        </p>

        {/* ── WHY (anchor-linkable on its own: /flexibility#why) ── */}
        <div id="why" style={{ scrollMarginTop: 20, background: c.card, border: `1px solid ${c.line}`,
          borderRadius: 14, padding: '24px 22px', marginBottom: 22 }}>
          <h2 style={{ fontSize: '1.1rem', color: c.gold, margin: '0 0 14px' }}>{F.why.heading}</h2>
          {F.why.body.map((p, i) => (
            <p key={i} style={{ color: c.dim, fontSize: '0.92rem', lineHeight: 1.7, margin: '0 0 12px' }}>{p}</p>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '16px 0' }}>
            {F.why.checklist.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: c.gold, flexShrink: 0 }}>✓</span>
                <span style={{ color: c.dim, fontSize: '0.9rem', lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}
          </div>
          {F.why.closing.map((p, i) => (
            <p key={i} style={{ color: c.dim, fontSize: '0.92rem', lineHeight: 1.7, margin: '0 0 12px' }}>{p}</p>
          ))}
        </div>

        {/* ── OPTIONS ── */}
        <div style={{ background: c.goldSoft, border: `1px solid ${c.goldLine}`,
          borderRadius: 14, padding: '24px 22px', marginBottom: 22 }}>
          <h2 style={{ fontSize: '1.1rem', color: c.gold, margin: '0 0 14px' }}>{F.options.heading}</h2>
          {F.options.body.map((p, i) => (
            <p key={i} style={{ color: c.dim, fontSize: '0.92rem', lineHeight: 1.7, margin: '0 0 12px' }}>{p}</p>
          ))}

          {/* The two asks, side by side — a guest who only "would like" the
              extra time should not read a price and assume it applies. */}
          {(F.options.tiers || []).map((t, i) => (
            <div key={i} style={{ background: c.card, border: `1px solid ${c.line}`,
              borderRadius: 12, padding: '16px 16px', margin: '0 0 12px' }}>
              <div style={{ color: c.gold, fontWeight: 700, fontSize: '0.95rem' }}>{t.label}</div>
              <div style={{ color: c.text, fontWeight: 600, fontSize: '0.88rem', margin: '4px 0 8px' }}>{t.lead}</div>
              <div style={{ color: c.dim, fontSize: '0.9rem', lineHeight: 1.7 }}>{t.body}</div>
            </div>
          ))}
          {F.options.availabilityNote && (
            <p style={{ color: c.dim, fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 12px',
              paddingLeft: 12, borderLeft: `2px solid ${c.goldLine}` }}>
              {F.options.availabilityNote}
            </p>
          )}
          <div style={{ borderTop: `1px solid ${c.goldLine}`, marginTop: 16, paddingTop: 14 }}>
            <p style={{ color: c.text, fontSize: '0.9rem', lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
              {F.options.directNote}
            </p>
          </div>
          <p style={{ color: c.faint, fontSize: '0.82rem', lineHeight: 1.6, margin: '14px 0 0' }}>
            {F.options.advanceNote}
          </p>
        </div>

        {/* ── REQUEST ── */}
        <div id="request" style={{ scrollMarginTop: 20 }}>
          {sent ? (
            <Done text={sent === 'direct' ? F.form.thanks : F.ota.thanks} waLink={waLink} />
          ) : (
            <div style={{ background: c.card, border: `1px solid ${c.line}`, borderRadius: 14, padding: '24px 22px' }}>
              <h2 style={{ fontSize: '1.1rem', color: c.gold, margin: '0 0 16px' }}>{F.form.heading}</h2>

              {/* PHASE 1 - who they are and which dates. Nothing else is
                  asked yet: we can answer far better once we know which
                  booking this is, so find it first. */}
              {!(lookup && lookup.found) && (
                <>
                  {contactFields}
                  {dateFields}
                  {error && <div style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: 10 }}>{error}</div>}
                  <button onClick={findMe} disabled={looking} style={{
                    width: '100%', padding: 14, borderRadius: 11, border: 'none',
                    background: looking ? 'rgba(200,144,58,0.4)' : c.gold, color: '#111',
                    fontWeight: 800, fontSize: '0.92rem', cursor: looking ? 'not-allowed' : 'pointer' }}>
                    {looking ? 'Looking...' : 'Find my booking'}
                  </button>

                  {lookup && !lookup.found && !manual && (
                    <div style={{ marginTop: 14, padding: '14px 15px', borderRadius: 11,
                      background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.4)' }}>
                      <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.88rem', marginBottom: 6 }}>
                        We could not match that to a booking
                      </div>
                      <div style={{ color: c.dim, fontSize: '0.84rem', lineHeight: 1.6 }}>
                        The dates and the email or phone need to be exactly as they are on your
                        reservation. Worth checking those - or send us the request anyway and
                        we will find it at our end.
                      </div>
                      <button onClick={() => setManual(true)} style={{
                        marginTop: 12, padding: '11px 16px', borderRadius: 10,
                        border: '1px solid ' + c.goldLine, background: 'transparent',
                        color: c.gold, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                        Send the request anyway
                      </button>
                    </div>
                  )}

                  {manual && (
                    <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid ' + c.line }}>
                      <Field label="How did you book?" required>
                        <select value={channel} onChange={e => { setChannel(e.target.value); setError('') }}
                          style={{ ...input, background: '#1A2332', color: channel ? c.text : c.faint }}>
                          <option value="">Select...</option>
                          {F.channels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                        </select>
                      </Field>
                      {stayFields}
                      {error && <div style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: 10 }}>{error}</div>}
                      <button onClick={() => submit('direct')} disabled={busy} style={{
                        width: '100%', padding: 14, borderRadius: 11, border: 'none',
                        background: busy ? 'rgba(200,144,58,0.4)' : c.gold, color: '#111',
                        fontWeight: 800, fontSize: '0.92rem', cursor: busy ? 'not-allowed' : 'pointer' }}>
                        {busy ? 'Sending...' : F.form.submitLabel}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* PHASE 2 - found. Now we can quote real numbers. */}
              {lookup && lookup.found && (
                <>
                  <div style={{ padding: '13px 15px', borderRadius: 11, marginBottom: 16,
                    background: 'rgba(52,168,83,0.08)', border: '1px solid rgba(52,168,83,0.35)' }}>
                    <div style={{ color: c.green, fontWeight: 700, fontSize: '0.9rem' }}>
                      Found it - welcome back, {lookup.firstName}
                    </div>
                    <div style={{ color: c.dim, fontSize: '0.82rem', marginTop: 3 }}>
                      {lookup.checkinDate} to {lookup.checkoutDate} · {lookup.nights} night{lookup.nights > 1 ? 's' : ''}
                      {' '}· check-in {lookup.standardCheckin}, check-out {lookup.standardCheckout}
                    </div>
                  </div>

                  <QuoteBlock title="Arrive earlier" rows={lookup.earlyCheckin}
                    note="Priced against your own nightly rate, not a full extra night." />
                  <QuoteBlock title="Leave later" rows={lookup.lateCheckout}
                    note="Whichever you choose, we hold the adjoining night so it is actually yours." />

                  {!lookup.isDirect && (
                    <div style={{ marginBottom: 14 }}>
                      {(F.ota.directPitch || []).length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8,
                          margin: '0 0 12px', padding: '13px 14px', borderRadius: 11,
                          background: c.goldSoft, border: '1px solid ' + c.goldLine }}>
                          {F.ota.directPitch.map((line, i) => (
                            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                              <span style={{ color: c.gold, flexShrink: 0, fontWeight: 700 }}>&#10003;</span>
                              <span style={{ color: c.text, fontSize: '0.85rem', lineHeight: 1.5 }}>{line}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
                        padding: '12px 13px', borderRadius: 10, cursor: 'pointer',
                        background: wantsDirect ? 'rgba(200,144,58,0.12)' : c.card,
                        border: '1px solid ' + (wantsDirect ? c.goldLine : c.line) }}>
                        <input type="checkbox" checked={wantsDirect}
                          onChange={e => setWantsDirect(e.target.checked)}
                          style={{ marginTop: 3, flexShrink: 0 }} />
                        <span style={{ color: wantsDirect ? c.text : c.dim, fontSize: '0.88rem', lineHeight: 1.5 }}>
                          {F.ota.directOptInLabel}
                        </span>
                      </label>
                    </div>
                  )}

                  {stayFields}
                  {error && <div style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: 10 }}>{error}</div>}
                  <button onClick={() => submit('direct')} disabled={busy} style={{
                    width: '100%', padding: 14, borderRadius: 11, border: 'none',
                    background: busy ? 'rgba(200,144,58,0.4)' : c.gold, color: '#111',
                    fontWeight: 800, fontSize: '0.92rem', cursor: busy ? 'not-allowed' : 'pointer' }}>
                    {busy ? 'Sending...' : F.form.submitLabel}
                  </button>
                  <button onClick={() => { setLookup(null); setError('') }} style={{
                    width: '100%', marginTop: 8, padding: 10, borderRadius: 10, border: 'none',
                    background: 'transparent', color: c.faint, fontSize: '0.8rem', cursor: 'pointer' }}>
                    Not your booking? Search again
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', color: c.faint, fontSize: '0.75rem', marginTop: 28, lineHeight: 1.6 }}>
          {villa.arrivalFullName}<br />{villa.address}
        </div>
      </div>
    </div>
  )
}
