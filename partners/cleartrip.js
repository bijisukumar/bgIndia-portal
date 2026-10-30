// CLEARTRIP: known, shown only when the host lists it (no legendRank, so it is not always on the calendar screens).
export const CLEARTRIP = {
  id: 'cleartrip',
  label: 'Cleartrip',
  group: 'channel',
  names: ['cleartrip'],
  icon: '🏠',
  color: '#84CC16', textColor: '#0B1220',
  commission: { hostPct: 0, guestPct: 0, note: 'Rate not set: enter the host\'s under `partners.cleartrip`' },
  feeBreakdown: false,
  bookingsFrom: 'calendar',
  reviewKey: 'cleartrip',
  calendar: { via: 'link' },                  // (how to connect it is not written down yet: add `whereToPaste` when it is known)
}
