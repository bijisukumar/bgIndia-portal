// One visit, TWO stay records ("twins"): the Airbnb booking, which holds all the money, and the record the
// guest's own check-in form made when the name typed did not match the booking's (so the form could not see
// it). The form's record has the ID, the form answers and the Drive folder but gross = net = 0, which is why
// the owner saw "You earn 0" for a guest who had paid (2026-10-22, Achala Kaushik). Complete booking offers to
// merge such a pair with the existing absorbDuplicateStay (moves the money onto the form's record, voids the
// booking row, one stay keeps the money).
//
// A pair is: a live stay with no money, a live stay WITH money on exactly the same dates, and either the
// no-money stay's notes name the other ("Overlaps existing stay <id>", written by the form) or the two names
// are alike (utils/guestNames.js). Exactly one candidate: with two, nobody guesses.
import { namesAlike } from './guestNames.js'

const LIVE = s => !['void', 'cancelled', 'closed', 'checked_out'].includes(s.status)
const hasMoney = s => (Number(s.gross) || 0) > 0 || (Number(s.net) || 0) > 0

// [{ source: the booking that holds the money, target: the no-money record to keep }]
export function findTwinPairs(stays) {
  const live = (stays || []).filter(LIVE)
  const pairs = []
  for (const t of live) {
    if (hasMoney(t)) continue
    const candidates = live.filter(b =>
      b.stay_id !== t.stay_id && hasMoney(b) &&
      b.checkin_date === t.checkin_date && b.checkout_date === t.checkout_date &&
      (String(t.notes || '').includes(b.stay_id) || namesAlike(t.guest_name, b.guest_name)))
    if (candidates.length === 1) pairs.push({ source: candidates[0], target: t })
  }
  return pairs
}
