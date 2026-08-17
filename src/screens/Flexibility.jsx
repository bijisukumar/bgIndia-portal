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

const input = {
  width: '100%', padding: '11px 14px', borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
  color: c.text, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
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
    L.push(`Booked via: ${channel}`)
    if (checkIn || checkOut) L.push(`Dates: ${checkIn || '?'} to ${checkOut || '?'}`)
    if (kind === 'direct') {
      L.push(`Need: ${needType}`)
      if (wantsEarlyIn && inTime)  L.push(`Wants to arrive: ${inTime}`)
      if (wantsLateOut && outTime) L.push(`Wants to leave: ${outTime}`)
      const p = (F.form.priorities || []).find(x => x.id === priority)
      if (p) L.push(`Type: ${p.label}`)
    } else {
      L.push('Booked through a partner — asking about direct rates')
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
          // An OTA submission is a future-booking lead, not a request we can
          // action for the current stay — recorded distinctly so the owner
          // isn't shown it as something to price.
          needType: kind === 'direct' ? needType : 'Direct rates for next time',
          // An OTA lead is by definition someone we want on direct next time,
          // so that path always carries the interest flag.
          priority: kind === 'direct' ? priority : null,
          wantsDirect: kind === 'direct' ? wantsDirect : wantsDirect,
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

              <Field label="How did you book?" required>
                <select value={channel} onChange={e => { setChannel(e.target.value); setError('') }}
                  style={{ ...input, background: '#1A2332', color: channel ? c.text : c.faint }}>
                  <option value="">Select…</option>
                  {F.channels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                </select>
              </Field>

              {/* OTA guests can't be sold the adjoining night here — turn it
                  into a direct-booking lead for next time instead. */}
              {isOta && (
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${c.line}` }}>
                  <h3 style={{ fontSize: '0.95rem', color: c.text, margin: '0 0 10px' }}>{F.ota.heading}</h3>
                  {F.ota.body.map((p, i) => (
                    <p key={i} style={{ color: c.dim, fontSize: '0.88rem', lineHeight: 1.7, margin: '0 0 12px' }}>{p}</p>
                  ))}

                  {/* The conversion ask, before the inputs — they've just read
                      why direct is cheaper, so this is the moment it lands. */}
                  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '12px 13px', borderRadius: 10, cursor: 'pointer', margin: '4px 0 16px',
                    background: wantsDirect ? 'rgba(200,144,58,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${wantsDirect ? c.goldLine : c.line}` }}>
                    <input type="checkbox" checked={wantsDirect}
                      onChange={e => setWantsDirect(e.target.checked)}
                      style={{ marginTop: 3, flexShrink: 0 }} />
                    <span style={{ color: wantsDirect ? c.text : c.dim, fontSize: '0.88rem', lineHeight: 1.5 }}>
                      {F.ota.directOptInLabel || "I'm open to booking directly next time, to save on cost"}
                    </span>
                  </label>

                  <Field label="Your name" required>
                    <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
                  </Field>
                  <Field label="WhatsApp or email" required>
                    <input style={input} value={contact} onChange={e => setContact(e.target.value)} placeholder="+91… or you@example.com" />
                  </Field>
                  {error && <div style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: 10 }}>⚠️ {error}</div>}
                  <button onClick={() => submit('ota')} disabled={busy} style={{
                    width: '100%', padding: 14, borderRadius: 11, border: 'none',
                    background: busy ? 'rgba(200,144,58,0.4)' : c.gold, color: '#111',
                    fontWeight: 800, fontSize: '0.92rem', cursor: busy ? 'not-allowed' : 'pointer' }}>
                    {busy ? 'Sending…' : F.ota.ctaLabel}
                  </button>
                </div>
              )}

              {isDirect && (
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${c.line}` }}>
                  <Field label="Your name" required>
                    <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
                  </Field>
                  <Field label="WhatsApp or email" required>
                    <input style={input} value={contact} onChange={e => setContact(e.target.value)} placeholder="+91… or you@example.com" />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Check-in date">
                      <input style={input} type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
                    </Field>
                    <Field label="Check-out date">
                      <input style={input} type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
                    </Field>
                  </div>
                  <Field label="What do you need?" required>
                    <select value={needType} onChange={e => setNeedType(e.target.value)}
                      style={{ ...input, background: '#1A2332', color: needType ? c.text : c.faint }}>
                      <option value="">Select…</option>
                      {F.form.needTypes.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                  {/* The actual times. Without these the owner has to message
                      back to ask, which is the round trip this page exists to
                      remove — and the turnaround maths needs a time, not a
                      date, to say yes or no. */}
                  {(wantsEarlyIn || wantsLateOut) && (
                    <div style={{ display: 'grid',
                      gridTemplateColumns: wantsEarlyIn && wantsLateOut ? '1fr 1fr' : '1fr', gap: 10 }}>
                      {wantsEarlyIn && (
                        <Field label={F.form.checkinTimeLabel || 'What time do you need to arrive?'}>
                          <input style={input} type="time" value={inTime}
                            onChange={e => setInTime(e.target.value)} />
                        </Field>
                      )}
                      {wantsLateOut && (
                        <Field label={F.form.checkoutTimeLabel || 'What time do you need to leave?'}>
                          <input style={input} type="time" value={outTime}
                            onChange={e => setOutTime(e.target.value)} />
                        </Field>
                      )}
                    </div>
                  )}

                  {/* Which tier they're asking for. Radios, not a dropdown —
                      the difference between the two is the whole point and
                      shouldn't be hidden behind a tap. */}
                  <Field label={F.form.priorityLabel || 'Type of request'} required>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(F.form.priorities || []).map(p => (
                        <label key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
                          padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
                          background: priority === p.id ? 'rgba(200,144,58,0.12)' : c.card,
                          border: `1px solid ${priority === p.id ? c.goldLine : c.line}` }}>
                          <input type="radio" name="flexPriority" value={p.id}
                            checked={priority === p.id}
                            onChange={() => setPriority(p.id)}
                            style={{ marginTop: 3, flexShrink: 0 }} />
                          <span style={{ color: priority === p.id ? c.text : c.dim,
                            fontSize: '0.88rem', lineHeight: 1.5 }}>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </Field>

                  <Field label="Anything that helps us plan"
                    hint="Roughly what time you expect to arrive or leave, who's travelling, anything else">
                    <textarea rows={3} style={{ ...input, resize: 'vertical' }} value={details}
                      onChange={e => setDetails(e.target.value)}
                      placeholder="e.g. driving from Bengaluru overnight with two small children, hoping to arrive around noon" />
                  </Field>

                  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '11px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 12,
                    background: wantsDirect ? 'rgba(200,144,58,0.12)' : c.card,
                    border: `1px solid ${wantsDirect ? c.goldLine : c.line}` }}>
                    <input type="checkbox" checked={wantsDirect}
                      onChange={e => setWantsDirect(e.target.checked)}
                      style={{ marginTop: 3, flexShrink: 0 }} />
                    <span style={{ color: wantsDirect ? c.text : c.dim, fontSize: '0.88rem', lineHeight: 1.5 }}>
                      {F.form.directInterestLabel || "I'd like to discuss booking directly with you"}
                    </span>
                  </label>
                  {error && <div style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: 10 }}>⚠️ {error}</div>}
                  <button onClick={() => submit('direct')} disabled={busy} style={{
                    width: '100%', padding: 14, borderRadius: 11, border: 'none',
                    background: busy ? 'rgba(200,144,58,0.4)' : c.gold, color: '#111',
                    fontWeight: 800, fontSize: '0.92rem', cursor: busy ? 'not-allowed' : 'pointer' }}>
                    {busy ? 'Sending…' : F.form.submitLabel}
                  </button>
                </div>
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
