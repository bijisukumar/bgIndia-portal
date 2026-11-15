// ============================================================
//  GuestTimesReview.jsx
//  When a guest fills the online check-in form with an arrival time before
//  check-in, or an expected departure after check-out, they are asking for more
//  than the villa gives. This panel flags that for the owner to decide — before
//  the stay is marked ready for check-in — with one tap to approve or to decline
//  each.
//
//  Approving records the guest's time as the AGREED early check-in / late
//  check-out time (the same fields Complete booking edits, and the ones Raman and
//  the WhatsApp messages read). Declining (2026-11-15) leaves the usual time alone
//  and writes the decision on the stay's history instead — the time they asked for,
//  who said no, when and why (optional) — so the panel goes away, Raman's screens
//  say "declined" rather than "requested, not agreed yet", and "we had asked for an
//  early check-in" can be answered later (see TimeAskHistory). Any extra charge is
//  agreed with the guest as usual: this records the time only.
//
//  An agreed time also keeps the neighbouring night out of sale (a guest leaving at
//  6 PM is still in the villa when the next family would arrive at 4), so the panel
//  says which night before the owner approves, and the server asks first when
//  somebody is already booked into it (see src/utils/stayHolds.js).
//
//  Used by Complete booking (Guest Info) and the home screen's Needs attention
//  block, so the two can never disagree. Renders nothing when there is nothing to
//  decide, or once the stay is ready for check-in (see stayTimes()).
// ============================================================
import { useState } from 'react'
import { api } from '../api'
import { stayTimes } from '../utils/stayTimes'
import { stayHolds, dayMonth } from '../utils/stayHolds'
import { villaTimeDefaults, villaHoldRules } from '../utils/villaTimes'

// One tap instead of typing on a phone; the box can still be typed in.
const QUICK_REASONS = ['Guest did not want to pay', 'Villa is not free before check-in']

export default function GuestTimesReview({ stay, onDone, onError, compact = false }) {
  const [busy, setBusy] = useState('')
  const [declining, setDeclining] = useState('')   // 'arrival' | 'departure' while that row's reason box is open
  const [reason, setReason] = useState('')
  const s = stay || {}
  const t = stayTimes(s, villaTimeDefaults())
  if (!t.needsReview) return null
  const stayId = s.stay_id || s.stayId

  // The night each approval would close, worked out the way the server will.
  const dates = { checkin_date: s.checkin_date || s.checkIn, checkout_date: s.checkout_date || s.checkOut }
  const rules = villaHoldRules()
  const arrivalHold = t.arrivalFlag && t.etaClock
    ? stayHolds({ ...dates, early_checkin_time: s.eta }, rules).find(h => h.kind === 'early_checkin') : null
  const departureHold = t.departureFlag && t.etdClock
    ? stayHolds({ ...dates, late_checkout_time: s.etd }, rules).find(h => h.kind === 'late_checkout') : null

  async function approve(which) {
    setBusy(which)
    try {
      let res = await api.approveGuestTimes({ stayId, [which]: true })
      // Somebody is already booked into the hours this would use up: nothing has
      // been written yet, so the owner can still say no.
      if (res && res.needsConfirm) {
        if (!window.confirm('⚠️ ' + res.warnings.join('\n') + '\n\nApprove this time anyway?')) return
        res = await api.approveGuestTimes({ stayId, [which]: true, confirmed: true })
      }
      if (onDone) await onDone(which, res)
    } catch (e) {
      if (onError) onError(e.message || 'Could not approve')
    } finally { setBusy('') }
  }

  async function decline(which) {
    setBusy('no-' + which)
    try {
      const res = await api.declineGuestTimes({ stayId, [which]: true, reason: reason.trim() })
      setDeclining(''); setReason('')
      if (onDone) await onDone(which, { ...(res || {}), declined: true })
    } catch (e) {
      if (onError) onError(e.message || 'Could not decline')
    } finally { setBusy('') }
  }

  function openDecline(which) {
    setReason('')
    setDeclining(declining === which ? '' : which)
  }

  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }
  const text = { fontSize: compact ? '0.74rem' : '0.8rem', color: '#F0F0F0', lineHeight: 1.4, flex: '1 1 180px' }
  const holdLine = { fontSize: compact ? '0.66rem' : '0.7rem', color: '#F59E0B', marginTop: '2px' }
  const small = { padding: '6px 11px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '700', whiteSpace: 'nowrap' }
  const btn = (disabled) => ({
    ...small, cursor: disabled ? 'default' : 'pointer',
    border: '1px solid rgba(52,168,83,0.45)', background: 'rgba(52,168,83,0.12)', color: '#34A853', opacity: disabled ? 0.5 : 1,
  })
  const noBtn = (disabled, on) => ({
    ...small, cursor: disabled ? 'default' : 'pointer',
    border: '1px solid rgba(239,68,68,0.45)', background: on ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.10)', color: '#EF4444', opacity: disabled ? 0.5 : 1,
  })
  const chip = (on) => ({
    padding: '4px 9px', borderRadius: '999px', fontSize: '0.68rem', cursor: 'pointer',
    border: '1px solid ' + (on ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.18)'),
    background: on ? 'rgba(239,68,68,0.18)' : 'transparent', color: on ? '#EF9A9A' : '#C9D1DC',
  })

  // The row for one thing the guest asked for: what they said, the night approving would close, and the two answers.
  const askRow = ({ which, words, hold, time, clock, standard, tip }) => (
    <div key={which}>
      <div style={row}>
        <div style={text}>
          {words}
          {hold && <div style={holdLine}>🔒 Approving also closes the night of {dayMonth(hold.night)} to new bookings</div>}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => openDecline(which)} disabled={!!busy} style={noBtn(!!busy, declining === which)}
            title={`Say no to ${time}: ${tip} stays ${standard}`}>
            Decline
          </button>
          <button onClick={() => approve(which)} disabled={!!busy || !clock} style={btn(!!busy || !clock)}
            title={clock ? '' : `Not a clock time: set the ${which === 'arrival' ? 'early check-in' : 'late check-out'} time by hand`}>
            {busy === which ? '…' : `Approve ${time}`}
          </button>
        </div>
      </div>
      {declining === which && (
        <div style={{ marginTop: '6px', padding: compact ? '8px 9px' : '9px 11px', borderRadius: '8px',
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div style={{ fontSize: compact ? '0.72rem' : '0.76rem', color: '#F0F0F0', lineHeight: 1.45 }}>
            Decline {time}? {tip} stays {standard}. The stay keeps a note that they asked, and why.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', margin: '7px 0 6px' }}>
            {QUICK_REASONS.map(q => (
              <button key={q} onClick={() => setReason(reason === q ? '' : q)} style={chip(reason === q)}>{q}</button>
            ))}
          </div>
          <input value={reason} onChange={e => setReason(e.target.value.slice(0, 200))} placeholder="Why? (optional)"
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: '16px',
              background: 'var(--dark-bg, #0D1117)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '7px', color: '#F0F0F0' }} />
          <div style={{ display: 'flex', gap: '6px', marginTop: '7px' }}>
            <button onClick={() => decline(which)} disabled={!!busy} style={noBtn(!!busy, true)}>
              {busy === 'no-' + which ? '…' : 'Yes, decline'}
            </button>
            <button onClick={() => setDeclining('')} disabled={!!busy}
              style={{ ...small, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#9AA5B4' }}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ margin: compact ? '8px 0 0' : '0 0 12px', padding: compact ? '9px 11px' : '11px 13px', borderRadius: '10px',
      background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.4)' }}>
      <div style={{ fontSize: compact ? '0.72rem' : '0.78rem', fontWeight: '700', color: '#F59E0B' }}>
        ⚠️ Guest asked for different times — decide before marking ready for check-in
      </div>

      {t.arrivalFlag && askRow({
        which: 'arrival', time: t.eta, clock: t.etaClock, standard: `from ${t.inTime}`, tip: 'Check-in', hold: arrivalHold,
        words: <>🔑 Arrives <strong>{t.eta}</strong> — check-in is from {t.inTime}</>,
      })}

      {t.departureFlag && askRow({
        which: 'departure', time: t.etd, clock: t.etdClock, standard: `by ${t.outTime}`, tip: 'Check-out', hold: departureHold,
        words: <>🧳 Leaves <strong>{t.etd}</strong> — check-out is by {t.outTime}</>,
      })}

      <div style={{ fontSize: '0.66rem', color: '#9AA5B4', marginTop: '7px', lineHeight: 1.45 }}>
        Approving records it as the agreed time (Raman and the WhatsApp message will use it) — agree any charge with the guest as usual.
        Declining keeps the usual time and puts a note on the stay for you and Raman — tell the guest yourself.
      </div>
    </div>
  )
}
