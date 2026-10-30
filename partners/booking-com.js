// BOOKING.COM: what every host who takes Booking.com bookings shares (see partners/airbnb.js for how this file is used).
export const BOOKING_COM = {
  id: 'bookingcom',
  label: 'Booking.com',
  group: 'channel',
  names: ['booking.com', 'bookingcom', 'booking', 'booking_com'],   // 'booking_com' is what its sync stores, 'booking.com' what is typed by hand
  icon: '🌐',
  color: '#2563EB', textColor: '#FFFFFF',
  legendRank: 2,
  commission: { hostPct: 15, guestPct: 0 },
  feeBreakdown: false,                   // it gives a percentage, not an itemised breakdown: the booking holds the room total and the cut worked out from the rate
  bookingsFrom: 'calendar',              // no confirmation email is read: a booking shows only as blocked dates on its calendar
  reviewKey: 'booking',                  // (a host's guestMessages.reviewRequest is written under 'booking')
  calendar: {
    via: 'link',
    whereToPaste: 'Calendar → Sync calendars / Connect calendars.',
    note: 'Only offered when the villa is listed as a single unit, and not at all if a channel manager is connected.',
  },
}
