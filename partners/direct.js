// DIRECT: bookings the host takes itself, whichever door they came through. They keep their whole price, so no cut.
export const DIRECT = {
  id: 'direct',
  label: 'Direct',
  group: 'direct',
  names: ['direct'],
  // Other names a booking's source can have that are still the host's own direct booking (compared ignoring case and punctuation).
  doors: ['website', 'guestform', 'manualtrigger', 'whatsapp', 'phone', 'referral', 'walkin'],
  doorLabels: { website: 'Website', whatsapp: 'WhatsApp', phone: 'Phone', referral: 'Referral', walkin: 'Walk-in', guestform: 'Check-in form', manualtrigger: 'Entered by hand' },
  enquiryDoors: ['website', 'whatsapp', 'phone', 'referral'],   // the doors offered as "where did the enquiry come from", in this order
  hubLabel: 'Direct',                    // how these nights read on a platform's calendar ("Unavailable (Direct)")
  guestFormLabel: 'Direct Booking',      // how the guest's own check-in form names it
  icon: '🏠',
  color: '#34A853', textColor: '#FFFFFF',
  commission: { hostPct: 0, guestPct: 0 },
  feeBreakdown: false,
}
