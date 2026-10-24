// One visit, TWO stay records ("twins"): the Airbnb booking, which holds all the money, and the record the
// guest's own check-in form made when the name typed did not match the booking's (so the form could not see
// it). The form's record has the ID, the form answers and the Drive folder but gross = net = 0, which is why
// the owner saw "You earn 0" for a guest who had paid (2026-10-22, Achala Kaushik).
//
// A pair is: a live stay with no money, a live stay WITH money on exactly the same dates, and either the
// no-money stay's notes name the other ("Overlaps existing stay <id>", written by the form) or the two names
// are alike (utils/guestNames.js). Exactly one candidate: with two, nobody guesses.
//
// What can be offered depends on where the money row is:
//   kind 'merge'  the money row has NOT arrived yet: move its money onto the guest's record and void the money
//                 row (the existing absorbDuplicateStay), one stay keeps the money.
//   kind 'void'   the money row is ALREADY IN THE VILLA (checked in): it must stay as it is, because voiding it
//                 would void the stay Raman is running. The empty record is the one to void
//                 (2026-10-23: the Karthik Sasta pair, offered the wrong way round at first).
// A pair where both are already in the villa is left alone.
import { namesAlike } from './guestNames.js'

const LIVE = s => !['void', 'cancelled', 'closed', 'checked_out'].includes(s.status)
const IN_VILLA = s => ['checked_in', 'ready_for_checkout'].includes(s.status)
const hasMoney = s => (Number(s.gross) || 0) > 0 || (Number(s.net) || 0) > 0

// A guest who registered on the check-in form through the form's OTHER record of the same visit has registered:
// the booking row (which the owner and the WhatsApp intro look at) must say so too, or the intro asks them to
// register again ("If you haven't completed your online check-in registration yet", 2026-10-24, Dimple, whose form
// was filed under "P. B Krishnan"). Read-time and reversible: a live stay without the flag takes it from a live stay
// WITH it on exactly the same dates, when either one's notes name the other ("Overlaps existing stay <id>"), the
// names are alike, or one is recorded as booked by the other. `registered_via` says which record vouched for it.
export function withRegistrationFromTwins(stays) {
  const rows = stays || []
  const flagged = rows.filter(s => LIVE(s) && s.checkin_form_submitted)
  if (!flagged.length) return rows
  return rows.map(s => {
    if (!LIVE(s) || s.checkin_form_submitted) return s
    const twin = flagged.find(f =>
      f.stay_id !== s.stay_id && f.checkin_date === s.checkin_date && f.checkout_date === s.checkout_date &&
      (String(f.notes || '').includes(s.stay_id) || String(s.notes || '').includes(f.stay_id) ||
       namesAlike(f.guest_name, s.guest_name) ||
       (!!s.booked_by_name && s.booked_by_name === f.guest_name) || (!!f.booked_by_name && f.booked_by_name === s.guest_name)))
    return twin ? { ...s, checkin_form_submitted: 1, registered_via: twin.stay_id } : s
  })
}

// [{ kind: 'merge' | 'void', source: the stay that holds the money, target: the no-money record }]
export function findTwinPairs(stays) {
  const live = (stays || []).filter(LIVE)
  const pairs = []
  for (const t of live) {
    if (hasMoney(t)) continue
    const candidates = live.filter(b =>
      b.stay_id !== t.stay_id && hasMoney(b) &&
      b.checkin_date === t.checkin_date && b.checkout_date === t.checkout_date &&
      (String(t.notes || '').includes(b.stay_id) || namesAlike(t.guest_name, b.guest_name)))
    if (candidates.length !== 1) continue
    const source = candidates[0]
    if (IN_VILLA(source)) {
      if (!IN_VILLA(t)) pairs.push({ kind: 'void', source, target: t })
    } else {
      pairs.push({ kind: 'merge', source, target: t })
    }
  }
  return pairs
}
