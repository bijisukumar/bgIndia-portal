// AGODA: what every host who takes Agoda bookings shares (see partners/airbnb.js for how this file is used).
//
// WHAT CHANGED (newest first)
//   2026-11-27  Agoda's booking EMAILS are now read (Biji, after the first real booking, 5-6 Dec 2026, was never captured: "go, build the Agoda
//               email capture"). `bookingsFrom` is now 'email' and the new `email` block below says who sends them, how to tell a confirmation from a
//               cancellation, and which words in the body come before each value. The reader itself (apps-script/poll-reservations, v1.5) and the
//               parser (src/utils/platformEmail.js) know no platform: all of that is data, here. Its calendar still tells us the nights.
export const AGODA = {
  id: 'agoda',
  label: 'Agoda',
  group: 'channel',
  names: ['agoda'],
  icon: '🏠',                            // (no mark of its own yet: the plain house, as before)
  color: '#8B5CF6', textColor: '#FFFFFF',
  legendRank: 4,
  // A placeholder until the host confirms the rate on their Agoda agreement (set theirs under `partners.agoda` in config.js).
  commission: { hostPct: 18, guestPct: 0, note: 'Placeholder: confirm on the Agoda agreement' },
  feeBreakdown: false,
  bookingsFrom: 'email',                 // its confirmation email is read and a stay is made (its calendar only shows the nights)
  // ── Its booking emails: read by the inbox reader (apps-script/poll-reservations) and understood by src/utils/platformEmail.js ──
  // Written from the real "New booking confirmed for 5 - 6 Dec 2026" email (2026-11-26). The cancellation and change wording below is a first
  // guess from that subject style: when the first of each arrives and is not recognised, the owner is emailed the text and this list is corrected here.
  email: {
    from: ['no-reply@agoda.com'],        // who sends them (a full address, or a bare domain for any address at it)
    searchWords: ['booking'],            // a word the subject must have for the reader to pick the mail up at all (its other mail is left alone)
    // What an email is, from its subject: lower-case fragments; the FIRST kind listed that matches wins, so a cancellation is never taken for a confirmation.
    kinds: {
      cancelled: ['cancel'],
      modified: ['modif', 'amend', 'chang'],
      confirmed: ['booking confirmed', 'new booking'],
    },
    // The words that come in front of each value in the body (lower case). Both layouts are understood: a label with its value after it, and a row of
    // labels followed by a row of values (what an email table becomes as text).
    labels: {
      bookingId: ['booking id'],
      checkIn: ['check-in'],
      checkOut: ['check-out'],
      total: ['total price'],
      rooms: ['room(s)'],
      guests: ['guest(s)'],
      guestName: ['lead guest name'],
      country: ["guest's country/region of residence"],
    },
    totalPriceIs: 'gross',               // what "Total price" is: 'gross' (the price the guest pays: our commission is taken off it) or 'net' (what Agoda pays us). Biji to confirm.
    currency: 'INR',                     // a price in any other currency is not stored as money (the owner is told to enter it)
    noContact: true,                     // the email carries no phone or email for the guest: the alert tells the owner to copy them from the platform
  },
  reviewKey: 'agoda',
  calendar: {
    // Agoda only imports addresses from sites on its own approved list and refuses ours ("Please enter a valid link") before it
    // fetches anything, so its link is read by the "StayVibe to Agoda" Google script (apps-script/agoda-bridge/src/Code.js), which keeps a
    // private Google Calendar for Agoda to import. The screen's "Read N ago" on this row is that script reading our link.
    via: 'google-bridge',
    staleAfterHours: 3,                  // the script reads our link every 15 minutes, so three quiet hours means it has stopped
    whereToPaste: 'Partner Portal → Calendar → Calendar connections → Other website link.',
    note: 'Only offered when the villa is listed as a single unit.',
    // Said under this platform's row in Connected feeds, where its Sync button is: that button only READS the platform's own calendar and
    // sends nothing to it. Here the nights reach the platform another way (the Google calendar above), which it imports on its own schedule.
    pushNote: 'This reads Agoda’s own calendar; it sends nothing to Agoda. Your nights reach Agoda through your Google calendar, which Agoda imports by itself a few times a day. To get a new booking onto Agoda at once, press “Refresh connections” in Agoda (Calendar → Calendar connections).',
    bridgeExplain: 'it only takes addresses it has approved, so its link goes in through a Google Calendar',
    notReadYet: 'Not read yet. Agoda refuses addresses it has not approved, so this link goes in through a Google Calendar: set up the “StayVibe to Agoda” script (see the manual).',
    quietWarning: 'is the “StayVibe to Agoda” script still running?',
    // The words for what that script reports back after every copy (apps-script/agoda-bridge, v1.1): the line "Google calendar copied N min ago"
    // under this platform's link on the Channel calendar, and the warning when the script goes quiet or keeps failing. calendar = what it
    // keeps up to date, script = what it is called, then = what the platform does with it next (StayVibe cannot see that step).
    bridge: {
      calendar: 'Google calendar',
      script: 'the “StayVibe to Agoda” script',
      then: 'Agoda imports it by itself a few times a day',
    },
  },
}
