// AGODA: what every host who takes Agoda bookings shares (see partners/airbnb.js for how this file is used).
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
  bookingsFrom: 'calendar',
  reviewKey: 'agoda',
  calendar: {
    // Agoda only imports addresses from sites on its own approved list and refuses ours ("Please enter a valid link") before it
    // fetches anything, so its link is read by the "StayVibe to Agoda" Google script (apps-script/agoda-bridge/src/Code.js), which keeps a
    // private Google Calendar for Agoda to import. The screen's "Read N ago" on this row is that script reading our link.
    via: 'google-bridge',
    whereToPaste: 'Partner Portal → Calendar → Calendar connections → Other website link.',
    note: 'Only offered when the villa is listed as a single unit.',
    bridgeExplain: 'it only takes addresses it has approved, so its link goes in through a Google Calendar',
    notReadYet: 'Not read yet. Agoda refuses addresses it has not approved, so this link goes in through a Google Calendar: set up the “StayVibe to Agoda” script (see the manual).',
    quietWarning: 'is the “StayVibe to Agoda” script still running?',
  },
}
