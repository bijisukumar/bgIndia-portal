// EXPEDIA: what every host who takes Expedia bookings shares (see partners/airbnb.js for how this file is used).
export const EXPEDIA = {
  id: 'expedia',
  label: 'Expedia',
  group: 'channel',
  names: ['expedia'],
  icon: '🏠',
  color: '#FACC15', textColor: '#0B1220',
  legendRank: 5,
  // A placeholder (the rate it was first given as "similar to Airbnb's old host fee"); set the host's real one under `partners.expedia`.
  commission: { hostPct: 3, guestPct: 0, note: 'Placeholder: confirm on the Expedia agreement' },
  feeBreakdown: false,
  bookingsFrom: 'calendar',
  reviewKey: 'expedia',
  calendar: { via: 'link', whereToPaste: 'Calendar → Sync calendars / Connect calendars.' },
}
