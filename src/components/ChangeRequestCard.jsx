// A guest's request to change a booking (more guests, say), waiting for the OWNER's decision (2026-10-27). Used on the owner's home
// (ChangeRequestsBlock) and on Complete booking (the banner on the selected guest).
//
// Two sources: Airbnb's "<guest> wants to change their reservation" email (read by the Gmail poller), and the guest's own check-in
// form giving a different head count from the booking. While one is pending the booking cannot be marked ready for check-in.
// The portal cannot accept or decline anything IN Airbnb: for an Airbnb request the owner does that there first (the email has the
// buttons) and records the decision here.
import { useState } from 'react'
import { api } from '../api'
import { fmtStampZ, fmtDate } from '../utils/dates'
import { dayMonth } from '../utils/stayHolds'

const AMBER = '#E8A33D'

export default function ChangeRequestCard({ request: r, onDone, onError, children }) {
  const asked = r.requestedGuests                      // null: a change that is not about the head count (dates, say)
  const dates = r.requestedDates || null               // { originalFrom, originalTo, from, to, nights, extraNights } when the email moves the dates (one email can also change the head count)
  const datesOnly = !!dates && asked == null
  const range = (a, b) => `${dayMonth(a)} to ${dayMonth(b)}`
  const nightsWord = n => `${n} night${n === 1 ? '' : 's'}`
  const extra = dates ? dates.extraNights : 0
  const stayChildren = r.stayChildren ?? 0
  const [adults, setAdults] = useState(String(r.requestedAdults ?? (asked != null ? Math.max(1, asked - (r.requestedChildren ?? stayChildren)) : (r.stayAdults ?? 1))))
  const [kids, setKids] = useState(String(r.requestedChildren ?? stayChildren))
  const [busy, setBusy] = useState('')
  const total = (parseInt(adults, 10) || 0) + (parseInt(kids, 10) || 0)
  const totalOk = asked == null || total === asked
  const fromEmail = r.kind === 'airbnb_email'
  const unmatched = !r.stayId

  async function decide(decision) {
    setBusy(decision)
    try {
      const body = { requestId: r.requestId, decision }
      if (decision === 'approved' && asked != null) { body.adults = parseInt(adults, 10) || 0; body.children = parseInt(kids, 10) || 0 }
      const res = await api.resolveChangeRequest(body)
      if (onDone) onDone(decision, res)
    } catch (e) {
      if (onError) onError(e.message || 'Failed')
    } finally { setBusy('') }
  }

  const btn = (rgb, solid) => ({
    flex: 1, minWidth: '150px', padding: '10px 12px', borderRadius: '10px', cursor: busy ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.82rem',
    border: `1px solid rgba(${rgb},${solid ? 0.5 : 0.35})`, background: solid ? `rgba(${rgb},0.16)` : 'transparent', color: `rgb(${rgb})`, opacity: busy ? 0.6 : 1,
  })
  const num = { width: '56px', padding: '6px 8px', borderRadius: '8px', fontSize: '16px', textAlign: 'center',
    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-dim)', color: 'var(--text)' }

  return (
    <div style={{ border: `1px solid ${AMBER}66`, background: `${AMBER}12`, borderRadius: '12px', padding: '12px 14px', marginBottom: '10px' }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: AMBER }}>
        ✋ {r.guestName || r.stayGuest || 'A guest'} asked to {asked == null && !dates ? 'change the reservation' : <>
          {asked != null && <>change the guests: {r.originalGuests ?? '?'} → {asked}</>}
          {asked != null && dates && ' and '}
          {dates && <>{asked != null ? 'the' : 'change the'} dates: {range(dates.originalFrom, dates.originalTo)} → {range(dates.from, dates.to)}</>}
        </>}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '3px' }}>
        {fromEmail ? 'Airbnb email' : 'Their check-in form'}{r.createdAt ? ` · ${fmtStampZ(r.createdAt)}` : ''}
        {r.checkIn ? ` · ${fmtDate(r.checkIn)}${r.checkOut ? ` → ${fmtDate(r.checkOut)}` : ''}` : ''}
        {r.stayAdults != null ? ` · booked for ${(r.stayAdults || 0) + (r.stayChildren || 0)} (${r.stayAdults} adult${r.stayAdults === 1 ? '' : 's'}${r.stayChildren ? ` · ${r.stayChildren} child${r.stayChildren === 1 ? '' : 'ren'}` : ''})` : ''}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.5, marginTop: '8px' }}>
        {fromEmail
          ? (dates
            ? 'Accept or decline it in Airbnb first (the email has the buttons), then record your decision here. Accepting moves the booking to the new dates on every calendar; the amounts are not changed, so enter Airbnb\'s new total afterwards. If something else is already booked on a night the new dates add, you are told here instead. Until you decide, this booking cannot be marked ready for check-in.'
            : 'Accept or decline it in Airbnb first (the email has the buttons), then record your decision here. Until you do, this booking cannot be marked ready for check-in.')
          : 'The guest\'s check-in form gives a different head count from the booking. Check it with them, then record your decision. Until you do, this booking cannot be marked ready for check-in.'}
      </div>
      {fromEmail && r.detail && (
        <details style={{ marginTop: '6px' }}>
          <summary style={{ fontSize: '0.72rem', color: '#85B7EB', cursor: 'pointer' }}>What the email says</summary>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px', lineHeight: 1.5, wordBreak: 'break-word' }}>{r.detail.slice(0, 600)}</div>
        </details>
      )}
      {unmatched ? (
        <div style={{ fontSize: '0.76rem', color: '#EF4444', marginTop: '8px' }}>
          This could not be matched to a booking in the portal: look at it in Airbnb, then dismiss it here.
        </div>
      ) : (
        <>
          {dates && (
            <div style={{ marginTop: '10px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>If approved the booking becomes </span>
              <span style={{ color: '#58C07C', fontWeight: 700 }}>{range(dates.from, dates.to)} · {nightsWord(dates.nights)}{extra ? ` (${extra > 0 ? '+' : ''}${extra})` : ''}</span>
            </div>
          )}
          {asked != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>{dates ? 'and the party becomes' : 'If approved the booking becomes'}</span>
              <input type="number" inputMode="numeric" min="1" value={adults} onChange={e => setAdults(e.target.value)} style={num} aria-label="Adults" />
              <span style={{ color: 'var(--text-dim)' }}>adults +</span>
              <input type="number" inputMode="numeric" min="0" value={kids} onChange={e => setKids(e.target.value)} style={num} aria-label="Children" />
              <span style={{ color: 'var(--text-dim)' }}>children</span>
              <span style={{ color: totalOk ? '#58C07C' : '#EF4444', fontWeight: 700 }}>= {total}{totalOk ? ' ✓' : ` (must be ${asked})`}</span>
            </div>
          )}
        </>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
        {!unmatched && (
          <button type="button" disabled={!!busy || !totalOk} onClick={() => decide('approved')} style={{ ...btn('52,168,83', true), opacity: busy || !totalOk ? 0.5 : 1 }}>
            {busy === 'approved' ? '…' : (datesOnly ? '✅ I accepted it: change the dates' : fromEmail ? '✅ I accepted it: update the booking' : '✅ Approve: update the booking')}
          </button>
        )}
        <button type="button" disabled={!!busy} onClick={() => decide('declined')} style={btn(unmatched ? '154,165,180' : '239,68,68', false)}>
          {busy === 'declined' ? '…' : (unmatched ? 'Dismiss' : (datesOnly ? `✖ I declined it: keep ${range(dates.originalFrom, dates.originalTo)}` : fromEmail ? '✖ I declined it: keep as booked' : '✖ Decline: keep as booked'))}
        </button>
      </div>
      {children}
    </div>
  )
}
