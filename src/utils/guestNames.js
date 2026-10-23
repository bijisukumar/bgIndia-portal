// Two spellings of ONE guest's name. An Airbnb booking carries the name on the guest's Airbnb profile and
// the check-in form carries what the guest types, so one person is "Achala Kaushik" in one place and
// "Achala A Kaushik" in the other, or "Karthik Sasta" and "Karthik Sasta Chandran". The form then failed to
// see its own booking, made a second stay with no money (the "You earn 0" the owner kept finding), and the
// two had to be merged by hand.
//
// The same person when the SHORTER name's words (two or more, once initials and punctuation are dropped)
// all appear, in the same order, in the longer one. A single word never counts ("Rahul" says nothing),
// different words never do, and the same words in another order do not either. Pure, so the Worker and
// the screens use the one rule.

export function nameWords(name) {
  return String(name || '').toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 1)
}

export function namesAlike(a, b) {
  let x = nameWords(a), y = nameWords(b)
  if (x.length > y.length) [x, y] = [y, x]
  if (x.length < 2) return false
  let at = 0
  for (const w of x) {
    at = y.indexOf(w, at)
    if (at < 0) return false
    at++
  }
  return true
}
