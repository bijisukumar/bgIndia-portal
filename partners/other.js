// OTHER: a booking from somewhere not listed. The cut is a guess until the host sets it.
export const OTHER = {
  id: 'other',
  label: 'Other',
  group: 'other',
  names: ['other'],
  hubLabel: 'Direct',
  icon: '🏠',
  color: '#94A3B8', textColor: '#0B1220',
  commission: { hostPct: 10, guestPct: 0, note: 'A guess for a source nobody has described: set the real one' },
  feeBreakdown: false,
}
