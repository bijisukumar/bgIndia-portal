// ============================================================
//  GuestTimesReview.jsx
//  When a guest fills the online check-in form with an arrival time before
//  check-in, or an expected departure after check-out, they are asking for more
//  than the villa gives. This panel flags that for the owner to decide — before
//  the stay is marked ready for check-in — with one tap to approve each.
//
//  Approving records the guest's time as the AGREED early check-in / late
//  check-out time (the same fields Complete booking edits, and the ones Raman and
//  the WhatsApp messages read). Declining is simply not approving. Any extra
//  charge is agreed with the guest as usual: this records the time only.
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

export default function GuestTimesReview({ stay, onDone, onError, compact = false }) {
  const [busy, setBusy] = useState('')
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

  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }
  const text = { fontSize: compact ? '0.74rem' : '0.8rem', color: '#F0F0F0', lineHeight: 1.4, flex: '1 1 180px' }
  const holdLine = { fontSize: compact ? '0.66rem' : '0.7rem', color: '#F59E0B', marginTop: '2px' }
  const btn = (disabled) => ({
    padding: '6px 11px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '700', cursor: disabled ? 'default' : 'pointer',
    border: '1px solid rgba(52,168,83,0.45)', background: 'rgba(52,168,83,0.12)', color: '#34A853',
    whiteSpace: 'nowrap', opacity: disabled ? 0.5 : 1,
  })

  return (
    <div style={{ margin: compact ? '8px 0 0' : '0 0 12px', padding: compact ? '9px 11px' : '11px 13px', borderRadius: '10px',
      background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.4)' }}>
      <div style={{ fontSize: compact ? '0.72rem' : '0.78rem', fontWeight: '700', color: '#F59E0B' }}>
        ⚠️ Guest asked for different times — decide before marking ready for check-in
      </div>

      {t.arrivalFlag && (
        <div style={row}>
          <div style={text}>
            🔑 Arrives <strong>{t.eta}</strong> — check-in is from {t.inTime}
            {arrivalHold && <div style={holdLine}>🔒 Approving also closes the night of {dayMonth(arrivalHold.night)} to new bookings</div>}
          </div>
          <button onClick={() => approve('arrival')} disabled={!!busy || !t.etaClock} style={btn(!!busy || !t.etaClock)}
            title={t.etaClock ? '' : 'Not a clock time: set the early check-in time by hand'}>
            {busy === 'arrival' ? '…' : `Approve ${t.eta}`}
          </button>
        </div>
      )}

      {t.departureFlag && (
        <div style={row}>
          <div style={text}>
            🧳 Leaves <strong>{t.etd}</strong> — check-out is by {t.outTime}
            {departureHold && <div style={holdLine}>🔒 Approving also closes the night of {dayMonth(departureHold.night)} to new bookings</div>}
          </div>
          <button onClick={() => approve('departure')} disabled={!!busy || !t.etdClock} style={btn(!!busy || !t.etdClock)}
            title={t.etdClock ? '' : 'Not a clock time: set the late check-out time by hand'}>
            {busy === 'departure' ? '…' : `Approve ${t.etd}`}
          </button>
        </div>
      )}

      <div style={{ fontSize: '0.66rem', color: '#9AA5B4', marginTop: '7px', lineHeight: 1.45 }}>
        Approving records it as the agreed time (Raman and the WhatsApp message will use it) — agree any charge with the guest as usual.
        To decline, leave it and tell the guest.
      </div>
    </div>
  )
}
