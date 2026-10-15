// ============================================================
// AvailabilityNote — what checkAvailability said about a pair of dates,
// and, when they are taken, the reply to send the guest.
//
// Used by New enquiry (every date change) and Enquiry detail (a saved
// enquiry whose dates may have been taken since it came in).
//
//   avail   undefined | 'loading' | the checkAvailability answer:
//           { available, conflicts, nearby, alternatives }
//   quiet   say something only when the dates are NOT free (Enquiry detail,
//           which is not a form: no "checking…", no green tick, no neighbours)
//   onReplySent({ note })   the guest's WhatsApp was opened with the reply;
//           the screen logs it (note is a one-line summary of what was offered)
//   onToast(message, type)  'success' | 'error'
//
// The reply (src/utils/guestMessages.js) never names whoever holds the dates.
// ============================================================
import { fmtDate } from '../utils/dates'
import { fmtTime } from '../utils/stayTimes'
import {
  buildNoAvailabilityMessage, buildNoAvailabilityWaLink, noAvailabilityLogNote, greetingName,
} from '../utils/guestMessages'

const fmtShort = d => { try { return fmtDate(d, { day: 'numeric', month: 'short' }) } catch (_) { return d } }
const windows = ws => (ws || []).map(w => `${fmtShort(w.checkIn)}→${fmtShort(w.checkOut)}`).join(' · ')

// A night nobody has booked but that is not for sale: the guest before has an
// agreed late check-out (or the one after an early check-in), so there is no
// time to reset the villa. The server names the night; the words are ours.
const heldWhy = c => c.reason === 'early_checkin_turnaround'
  ? `${c.guest_name} has an agreed early check-in at ${fmtTime(c.early_checkin_time)}`
  : `${c.guest_name} has an agreed late check-out until ${fmtTime(c.late_checkout_time)}`

export default function AvailabilityNote({
  avail, checkIn, checkOut, guestName, phone, quiet = false, onReplySent, onToast, style,
}) {
  if (!avail) return null
  if (avail === 'loading') {
    return quiet ? null : (
      <div style={{ color: '#5C7080', fontSize: '0.72rem', margin: '-2px 0 10px', ...style }}>Checking availability…</div>
    )
  }

  const taken = avail.available === false
  if (quiet && !taken) return null

  const turnoverTag = r => (r.checkout_date === checkIn || r.checkin_date === checkOut) ? ' (same-day turnover)' : ''
  const alt = avail.alternatives
  const nights = alt && alt.nights
  const hasWindows = !!alt && ((alt.before || []).length > 0 || (alt.after || []).length > 0)

  // The reply to the guest, built from what is on screen so it follows every edit.
  const replyInput = { guestName, checkIn, checkOut, alternatives: taken ? alt : null }
  const replyText = taken ? buildNoAvailabilityMessage(replyInput) : null
  const replyLink = taken && String(phone || '').trim() ? buildNoAvailabilityWaLink({ ...replyInput, phone }) : null
  const copyReply = () => {
    navigator.clipboard.writeText(replyText)
      .then(() => onToast && onToast('Message copied — paste into WhatsApp ✓', 'success'))
      .catch(() => onToast && onToast('Could not copy the message', 'error'))
  }

  return (
    <div style={{ margin: '-2px 0 10px', ...style }}>
      {taken ? (
        <>
          <div style={{ color: '#E06C5A', fontSize: '0.76rem', fontWeight: 600 }}>
            ✕ Not available — {avail.conflicts.map(c => c.heldNight
              ? `${fmtShort(c.heldNight)} night is held`
              : `${c.guest_name} ${fmtShort(c.checkin_date)}→${fmtShort(c.checkout_date)}`).join(' · ')}
          </div>
          {avail.conflicts.some(c => c.heldNight) && (
            <div style={{ color: '#E06C5A', fontSize: '0.7rem', marginTop: '3px', lineHeight: 1.5 }}>
              {avail.conflicts.filter(c => c.heldNight).map(c => heldWhy(c)).join(' · ')}
              {' '}— not enough time to reset the villa before the next guest.
            </div>
          )}
        </>
      ) : (
        <div style={{ color: '#34A853', fontSize: '0.76rem', fontWeight: 600 }}>
          ✓ Villa available {fmtShort(checkIn)} → {fmtShort(checkOut)}
        </div>
      )}

      {!quiet && avail.nearby && avail.nearby.length > 0 && (
        <div style={{ color: '#5C7080', fontSize: '0.7rem', marginTop: '3px', lineHeight: 1.5 }}>
          Around these dates: {avail.nearby.map(r =>
            `${r.guest_name} ${fmtShort(r.checkin_date)}→${fmtShort(r.checkout_date)}${turnoverTag(r)}`).join(' · ')}
        </div>
      )}

      {taken && replyText && (
        <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '10px',
          background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.25)' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text)' }}>
            Reply to {String(guestName || '').trim() ? greetingName(guestName) : 'the guest'}
          </div>
          <div style={{ color: '#5C7080', fontSize: '0.7rem', lineHeight: 1.6, margin: '4px 0 8px' }}>
            {hasWindows ? (
              <>
                Open for the same {nights} night{nights === 1 ? '' : 's'}:
                {(alt.before || []).length > 0 && <><br />Earlier — {windows(alt.before)}</>}
                {(alt.after || []).length > 0 && <><br />Later — {windows(alt.after)}</>}
              </>
            ) : (
              <>No window of {nights || 'that many'} night{nights === 1 ? '' : 's'} is open close to these dates.</>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {replyLink ? (
              <a href={replyLink} target="_blank" rel="noreferrer" className="btn"
                onClick={() => onReplySent && onReplySent({ note: noAvailabilityLogNote({ checkIn, checkOut, alternatives: alt }) })}
                style={{
                  flex: '1 1 200px', display: 'block', textAlign: 'center', textDecoration: 'none',
                  background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)',
                  color: '#25D366', fontWeight: '700',
                }}>
                💬 Send “not available” in WhatsApp
              </a>
            ) : (
              <div style={{ flex: '1 1 160px', alignSelf: 'center', fontSize: '0.7rem', color: '#5C7080' }}>
                Add the guest's mobile number to send this on WhatsApp.
              </div>
            )}
            <button type="button" className="btn" onClick={copyReply}
              style={{ width: 'auto', flex: '0 0 auto', padding: '0 14px', whiteSpace: 'nowrap' }}>
              📋 Copy message
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
