// GOIBIBO: what every host who takes Goibibo bookings shares (see partners/airbnb.js for how this file is used).
export const GOIBIBO = {
  id: 'goibibo',
  label: 'Goibibo',
  group: 'channel',
  names: ['goibibo'],
  icon: '🟣',
  color: '#EC4899', textColor: '#FFFFFF',
  legendRank: 7,
  commission: { hostPct: 18, guestPct: 0 },
  feeBreakdown: false,
  bookingsFrom: 'calendar',
  reviewKey: 'goibibo',
  calendar: { via: 'link' },                  // (how to connect it is not written down yet: add `whereToPaste` when it is known)
}
