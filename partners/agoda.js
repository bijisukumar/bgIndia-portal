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
