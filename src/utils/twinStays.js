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
