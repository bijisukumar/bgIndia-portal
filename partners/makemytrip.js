// MAKEMYTRIP: what every host who takes MakeMyTrip bookings shares (see partners/airbnb.js for how this file is used).
export const MAKEMYTRIP = {
  id: 'makemytrip',
  label: 'MakeMyTrip',
  group: 'channel',
  names: ['makemytrip', 'mmt'],
  icon: '✈️',
  color: '#EA580C', textColor: '#FFFFFF',
  legendRank: 6,
  commission: { hostPct: 18, guestPct: 0 },
  feeBreakdown: false,
  bookingsFrom: 'calendar',
  reviewKey: 'makemytrip',
  calendar: { via: 'link' },                  // (how to connect it is not written down yet: add `whereToPaste` when it is known)
}
