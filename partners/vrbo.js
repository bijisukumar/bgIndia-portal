// VRBO: what every host who takes Vrbo bookings shares (see partners/airbnb.js for how this file is used).
export const VRBO = {
  id: 'vrbo',
  label: 'VRBO',
  group: 'channel',
  names: ['vrbo'],
  icon: '🏠',
  color: '#38BDF8', textColor: '#0B1220',
  legendRank: 3,
  // A placeholder (first given as "similar to Airbnb's old host fee"); set the host's real one under `partners.vrbo`.
  commission: { hostPct: 3, guestPct: 0, note: 'Placeholder: confirm on the Vrbo agreement' },
  feeBreakdown: false,
  bookingsFrom: 'calendar',
  reviewKey: 'vrbo',
  calendar: { via: 'link', whereToPaste: 'Calendar → Import/Export → Import calendar.' },
}
