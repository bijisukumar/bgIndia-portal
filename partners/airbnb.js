// AIRBNB: what every host who takes Airbnb bookings shares. Copy nothing: a host lists `airbnb: {}` under `partners` in its
// config.js and gets this; it changes a rule for its own villa only by writing that rule there (see partners/README.md).
// When Airbnb changes its rules for everyone, change them HERE, once.
export const AIRBNB = {
  id: 'airbnb',
  label: 'Airbnb',                       // how it reads on screens, calendar entries and messages
  group: 'channel',                      // a platform that takes a cut (the host's own doors are 'direct', 'agent', 'other')
  names: ['airbnb'],                     // every spelling that shows as this label, lower case, exactly as stored in a booking's source
  icon: '🏡',                            // the mark beside the booking on the caretaker's list
  color: '#FF5A5F', textColor: '#FFFFFF',  // its bars and tags on the calendar (kept clear of the amber used for held nights)
  legendRank: 1,                         // order on the calendar-links screen and the legend; leave out to show it only when used

  // What it keeps. Since it moved to a HOST-ONLY service fee, the host pays 15.5% of the booking (night fee + cleaning fee) and the
  // guest pays nothing extra. Bookings made earlier keep the fees Airbnb actually charged (3% host + a guest fee): those amounts are
  // stored on each booking, so this rate only fills in a figure nobody has typed. When the rate changes again, write the new one as a
  // dated entry (`commission: [{ from: '2020-01-01', hostPct: 3, guestPct: 14.2 }, { from: '<date>', hostPct: 15.5, guestPct: 0 }]`)
  // so a booking is always worked out under the rule of its own time.
  commission: { hostPct: 15.5, guestPct: 0 },

  feeBreakdown: true,                    // its confirmation lists the fees in rupees (night fee, cleaning, host fee, you earn, guest fee, guest paid)
  bookingsFrom: 'email',                 // a confirmation email is read and a stay is made ('calendar': only its calendar shows a blocked date)
  reviewKey: 'airbnb',                   // the key under guestMessages.reviewRequest.platforms / .links in a host's config

  calendar: {
    via: 'link',                         // 'link': paste the address StayVibe gives it. 'google-bridge': it refuses our address (see agoda.js)
    whereToPaste: 'Calendar → Availability → Connect calendars → Connect to another website.',
    readsEvery: 'about every 3 hours',
    staleAfterHours: 8,                  // the owner is warned if it has not read our link for this long (it reads about every 3 hours; see partners/README.md)
    reservedPrefix: 'Reserved',          // how its own calendar names a real booking, as opposed to a night someone closed
  },
}
