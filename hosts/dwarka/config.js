// ============================================================
//  HOST CONFIG — dwarka (Guruvayur Villa)
//  All property-specific values for this host live here.
//  PINs are loaded from environment variables (never in code).
//  To onboard another host: copy this file to hosts/<hostId>/config.js,
//  edit the values, and build with VITE_HOST=<hostId>.
//
//  Values that must change WITHOUT a deploy (rates, phone numbers,
//  check-in/checkout times, auth) live in the `tenants`/`auth_tokens` D1
//  tables instead (served via the getTenantConfig worker action) — not
//  duplicated here.
// ============================================================

export const CONFIG = {
  // Branding
  brandName:  'Guruvayur Estates',
  brandShort: 'GE Portal',
  tagline:    'Property Management Portal',

  // Public marketing site — used for campaign tracking links (marketing
  // flyers/QR codes point here with ?ref=<campaign_token>).
  landingUrl: 'https://www.luxuryvillasofguruvayur.com',

  // Google integration
  driveRootId:   '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva',
  ownerEmail:    'bijisukumar@gmail.com',
  // Owner WhatsApp — for guest change requests only (arrival message routes
  // any date/guest-count/request changes here, not to the on-site manager).
  ownerWhatsApp: '+1 972.876.5101',
  // Silent copy of every guest-facing email, so the villa inbox holds the
  // same record the guest received. BCC, never CC — the guest must not see
  // an internal address on a message addressed to them.
  guestEmailBcc: 'kerala.luxuryvillas@gmail.com',
  spreadsheetId:    '1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ',  // add this
  guestFormSheetId: '1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0',


  // Villa properties — add more objects here for additional villas
  // logoUrl: per-villa logo for white-labeling (null = use default)
  villas: [
    {
      id:       'dwarka',
      name:     'Dwarka',
      full:     'Dwarka — GVR Villa',
      // Distinct from `full` above (which is the VillaHub display label) —
      // this is the formal name used specifically in the guest-facing
      // arrival WhatsApp message. Two different existing strings, not a
      // duplicate — kept separate on purpose.
      arrivalFullName: 'Dvaraka - Luxury Villas of Guruvayur',
      location: 'Guruvayur',
      address:  'Edappully Gandhinagar Rd, Palayoor, Guruvayur, Kerala 680506, India',
      mapsLink: 'https://maps.app.goo.gl/fjfe4eS4BJmaHh62A',
      bedrooms: 4,
      active:   true,
      logoUrl:  '/icons/DwarkaLVGLogo.png',
      // On-site manager whose name shows on the owner's "Staff Perks"
      // commission tile and the New Booking checklist — configurable per
      // host so a white-label tenant sees their own manager's name.
      managerName: 'RamananKutty',
      // Commission payout UPI id — genuinely host-specific, not cosmetic:
      // a new host's "Pay now" button must never default to someone
      // else's bank account.
      managerUpi: '85471419raman@okicici',
      // Manager's own WhatsApp — shared with guests only when the OWNER sends
      // the arrival message (so the guest has a direct line to the person
      // actually on-site, instead of "Raman" appearing to have texted them).
      managerPhone: '+91 85471 41401',
      // Duplicates the arrival message's hardcoded checkout time on purpose —
      // see that file's own note on why this isn't wired to the dynamic
      // tenant config yet (would require an async rewrite).
      checkinTime:  '4:00 PM',
      checkoutTime: '11:00 AM',
    }
  ],

  // Turnaround policy. Applied as the DEFAULT for every booking unless that
  // stay says otherwise (expected_arrival_at / expected_departure_at, or an
  // agreed early_checkin_time / late_checkout_time). turnaroundHours is what
  // the villa genuinely needs between one family leaving and the next
  // arriving — the flexibility screen uses it to work out the earliest
  // arrival / latest departure it can actually offer, instead of just
  // calling a back-to-back day "blocked".
  turnaround: {
    defaultCheckinTime:  '16:00',
    defaultCheckoutTime: '11:00',
    turnaroundHours: 4,
  },

  // Public check-in form. Token-based route on the React app
  // (src/screens/GuestCheckIn.jsx via /checkin/:linkToken) — chosen over the
  // luxuryvillasofguruvayur.com forms because stayvibe360.com is the
  // canonical domain and stayed up through the 2026-08-05 nameserver
  // incident that took the other one offline.
  checkinBaseUrl: 'https://dwarka.stayvibe360.com',
  // stays.source → stayvibe_checkin_links.token. Not a mechanical
  // 'gvr-' + source: makemytrip's token is gvr-mmt, booking_com's is
  // gvr-booking, and website/whatsapp/agoda have no token of their own so
  // they fall through to the default. Keys are matched lowercased.
  checkinLinkTokens: {
    airbnb:      'gvr-airbnb',
    booking_com: 'gvr-booking',
    booking:     'gvr-booking',
    makemytrip:  'gvr-mmt',
    goibibo:     'gvr-goibibo',
    agoda:       'gvr-agoda',
    expedia:     'gvr-expedia',
    vrbo:        'gvr-vrbo',
    direct:      'gvr-direct',
    website:     'gvr-direct',
    whatsapp:    'gvr-direct',
  },
  checkinLinkDefaultToken: 'gvr-direct',

  // Guest-facing message templates for the Complete Booking screen's
  // Checked-In Guests block. {placeholders} are substituted per-stay —
  // guestName, villaName, managerName, managerPhone, checkoutTime, brandName.
  // Content lives here (not hardcoded) so wording can change without
  // touching the sending logic, and so a white-label host can use its own
  // voice. Read server-side too (functions/api/[[route]].js imports this
  // file directly for the automated checkout-day send — see HOST_CONFIGS
  // there), so keep this object plain data, no functions/JSX.
  // Public "need flexibility" page (/flexibility). Every word a guest reads
  // lives here so wording can change without touching the component.
  // Deliberately carries NO rupee figures: the owner quotes 25% or 50% of a
  // night per request after checking the dates, so nobody turns up having
  // decided the rate for themselves.
  flexibility: {
    hero: {
      eyebrow: 'DIRECT GUESTS · DWARKA VILLA',
      title: "Travelling with family? We'll make the timings work.",
      intro: 'Check-in is after 4:00 PM and check-out by 11:00 AM. Here is what happens in the five hours between — and what we can do when those hours do not suit your family.',
    },
    why: {
      heading: 'Why our timings are what they are',
      body: [
        'Check-out is by 11:00 AM. Check-in is after 4:00 PM. That gap is five hours, and it is fully used.',
        'Dwarka is a 3,000 sq ft home with four bedrooms and four and a half bathrooms. Between one family leaving and the next arriving, our team works through all of it.',
      ],
      checklist: [
        'Every bed stripped and remade with fresh linen — nothing is reused between families, ever',
        'Every bathroom deep-cleaned and sanitised',
        'The kitchen cleaned down and restocked, ready for your family to cook in from the moment you arrive',
        'Every bedroom, the living areas, the dining hall and the grounds gone over',
      ],
      closing: [
        "We don't cut corners to turn the house around faster. A home this size simply takes that long to bring back to the standard you would expect when your family walks in.",
        "So when we hold to those hours, it isn't policy for the sake of policy — it's the reason the house feels the way it does when you arrive. Your family's gathering here should be memorable, and this is a large part of how we make sure it is.",
      ],
    },
    options: {
      heading: "Need to arrive earlier, or leave later? Just ask.",
      body: [
        'We know family travel rarely fits neatly into a 4:00 PM arrival — a long drive, small children, elderly parents, a wedding to be at. So rather than turn the request down, we hold the adjoining night for you.',
        "Once we do that, the night can't be offered to anyone else. Even so, we don't charge for a full extra night — we ask for a fraction of it, typically 25% or 50%, depending on how much extra time you need. We'll confirm the exact amount once we've looked at your dates.",
      ],
      availabilityNote: "One honest note: when the villa is booked back-to-back, there may simply be no gap to give — and we won't always be able to say yes. If that happens we'll tell you early rather than leave you hoping, and we'll look at every option we have to rearrange things around your family before we do.",
      directNote: "This is something we're able to offer only to guests who book with us directly. Booking direct means the calendar is ours to hold, so we can set a night aside for your family and price it as a courtesy rather than a full night's stay. It's one of the ways we try to keep your costs down.",
      advanceNote: 'Please ask ahead of time. Timing changes need to be agreed and settled before you arrive so we can plan the turnaround around your family — our on-site team is not able to approve changes on the day.',
    },
    ota: {
      heading: 'Booked through Airbnb, Booking.com or another platform?',
      body: [
        "Extra nights for your current stay need to be arranged through them — those dates live in their system, and they'll charge the full nightly rate.",
        "Worth knowing for next time: guests who book with us directly get flexibility on arrival and departure timings, held as a courtesy at a fraction of a night rather than the full rate. No platform fees either — you're dealing with the family who owns the home.",
      ],
      ctaLabel: "Send me your direct rates for next time",
      thanks: "Thank you — we'll be in touch with our direct rates. We'd love to host your family again.",
    },
    form: {
      heading: 'Tell us what you need',
      needTypes: [
        'Earlier check-in on arrival day',
        'Later check-out on departure day',
        'Both',
      ],
      submitLabel: 'Send request',
      thanks: "Thank you — we've got your request. We'll check the dates and come back to you with what we can do and the exact amount, before you travel.",
    },
    channels: ['Direct with the villa', 'Airbnb', 'Booking.com', 'MakeMyTrip', 'Goibibo', 'Agoda', 'Expedia', 'VRBO', 'Other platform'],
    directChannel: 'Direct with the villa',
  },

  guestMessages: {
    // Owner's personal welcome, sent any time before check-in. Villa/owner
    // names are literal here (not placeholders) since this whole object is
    // already per-host — only per-stay values are substituted.
    hostIntro: {
      template:
`Namaskaram {firstName}! 🙏

This is Biji from Guruvayur Villa (Dwarka). I wanted to personally welcome you ahead of your stay on {checkinDateShort}.

At Guruvayur Villa, we open our home to your family and strive to create a comfortable, memorable experience. To help us prepare for your visit, I'd love to connect briefly to review your reservation, arrival timing, and any special requirements you may have.

*YOUR BOOKING*
• Check-in: {checkinDateFull} — after {checkinTime}
• Check-out: {checkoutDateFull} — by {checkoutTime}
• Guests: {guestCount}
• Nights: {nights}
{checkinPrompt}
Please let me know a convenient time to connect. We're looking forward to hosting you and your family.

Snehapoorvam (സ്നേഹപൂർവ്വം),
Biji | Guruvayur Villa (Dwarka)`,
      // Spliced into {checkinPrompt} above ONLY when the stay has no
      // check-in form on record — a guest who has already registered
      // should never be asked again. Leading/trailing blank lines are
      // deliberate: they keep the paragraph spacing right when present,
      // and collapse cleanly to nothing when omitted.
      checkinPrompt:
`
📝 If you haven't completed your online check-in registration yet, please do so at your earliest convenience — it's a mandatory government requirement, and it helps us have everything ready before you arrive:
{checkinUrl}
`,
    },
    comfortCheck: {
      template:
`Namaskaram {guestName}! 🙏

We hope your travel to Guruvayur was comfortable, and that check-in went smoothly with our staff able to assist you well.

Wishing you a wonderful stay at {villaName}! If you need anything at all during your time here, {managerName} is just a phone call away — {managerPhone}.

Enjoy your stay! 🏡`,
    },
    checkoutDay: {
      subject: 'Checkout day today — {villaName}',
      template:
`Namaskaram {guestName},

Today is your check-out day at {villaName}. Standard check-out time is {checkoutTime} — please let {managerName} know if you need any assistance before you leave ({managerPhone}).

You'll find all your check-out details in the folder left at the villa — please do review it at your convenience.

We hope you had a truly beautiful and enjoyable time in Guruvayur, with wonderful family moments at {villaName}. Safe travels, and we do hope to welcome you back again soon!

Warm regards,
{brandName}`,
    },
  },

  // Rental properties — monthly income tracker
  // tenantName and leaseEnd are now managed via the Tenant Agreements screen (/owner/rental/agreement)
  // and stored in the rental_props table. The fields below are fallbacks for display only.
  // Add leaseEnd (YYYY-MM-DD) here to enable renewal alerts (60-day warning) as a quick override.
  //
  // unitNo/floor/building/hasParking/electricityConsumerNo are used by the
  // Lease Deed generator (Tenant Agreement screen → "Generate Lease Deed").
  // hasParking and electricityConsumerNo are optional — leave blank/false if
  // not applicable to a given property; the generated document only
  // mentions them when present, per explicit decision (not every property
  // has covered parking or a tracked electricity consumer number).
  rentalProperties: [
    { id: 'rental_1', name: 'Tritvam',  location: 'Kochi, KL',  tenantName: '', leaseEnd: '',
      unitNo: 'T4 9D', floor: '9th', building: 'Tata Tritvam at Marine Drive', city: 'Kochi',
      hasParking: true, electricityConsumerNo: '1155466025977', furnishing: 'semi furnished' },
    { id: 'rental_2', name: 'Pacifica', location: 'OMR, TN',    tenantName: '', leaseEnd: '',
      unitNo: '', floor: '', building: 'Pacifica', city: 'Chennai',
      hasParking: false, electricityConsumerNo: '', furnishing: 'non-furnished' },
    { id: 'rental_3', name: 'Pinnacle', location: 'TCR, KL',    tenantName: '', leaseEnd: '',
      unitNo: '103', floor: '1st', building: 'Pinnacle Residency', city: 'Trichur',
      hasParking: false, electricityConsumerNo: '', furnishing: 'non-furnished' },
  ],

  // Lessor + standard India lease terms — shared across every rentalProperties
  // entry. Fixed, not per-tenant: late-fee tiers, premature-termination
  // penalties, and the 5% renewal increase are deliberately standardized
  // across all India tenancies (explicit decision, 2026-06-24) rather than
  // configurable per agreement.
  leaseIndia: {
    lessorName:    'Biji Sukumar',
    lessorAddress: 'Thandayamgattil House, P O Chavakkad, Trichur Dist, Kerala 680501',
    lessorPan:     'AXRPS9969C',
    executionCity: 'Cochin',
    bank: {
      accountName:   'Biji Sukumar',
      bankName:      'Federal Bank',
      accountNumber: '14320100138300',
      ifsc:          'FDRL0001432',
      swift:         'FDRLINBBIBD',
    },
    renewalIncreasePct: 5,
    maintenanceIncludedInRent: false,   // standard: tenant pays maintenance separately
    lateFeeTiers: [
      { label: 'Due on 1st of every month',          from: 1,  to: 1,  fee: 0 },
      { label: 'Emergency Grace period (2nd-5th)',    from: 2,  to: 5,  fee: 0 },
      { label: '6th-8th of the month',                from: 6,  to: 8,  fee: 2000 },
      { label: '9th-15th of the month',               from: 9,  to: 15, fee: 7000 },
      { label: '16th-31st of the month',               from: 16, to: 31, fee: 12000 },
    ],
    prematureTermination: {
      beforeFullTerm:  'LESSEE is to pay broker commission',
      before6Months:   'LESSEE is to pay 1 month additional Rent amount',
    },
    defectNoticeDays: 10,
    jurisdiction:  'Ernakulam',
  },

  // Estate properties
  estates: [
    {
      id: 'pollachi', name: 'Pollachi Estate', type: 'coconut', manager: 'Pradosh', active: true,
      incomeCategories:  ['Mango Harvest Income', 'Lease income', 'Govt subsidy', 'Other income'],
      expenseCategories: ['Labour wages', 'Salary', 'Fertilizer', 'Pesticide', 'Tractor / Land tiling',
        'JCB work', 'Fencing', 'Irrigation', 'Water pump', 'Electricity bill', 'Land tax', 'Transport',
        'Housing expenses', 'Soil evaluation & testing', 'Tree / plant purchase', 'Maintenance & repairs', 'Other expense'],
    },
    {
      id: 'pavutumuri', name: 'Pavutumuri Estate', type: 'rubber', manager: 'RamananKutty', active: true,
      // Paper-register defaults (owner-supplied); rate changes over time so
      // the actual value tapped/stamped per row lives in rubber_production —
      // these are only the pre-filled defaults for a new entry.
      tappingRate:      2.75,  // ₹ per tree
      sheetWeightKg:    0.6,   // kg per sheet, used to derive weight from sheet count
      sheetRatePerKg:   200,   // ₹ per kg, Rubber Sheet sale price default
      ottupalRatePerKg: 150,   // ₹ per kg, Ottupal sale price default
      incomeCategories:  ['Rubber Sheet', 'Ottupal', 'Coconut', 'Lease income', 'Govt subsidy', 'Other income'],
      expenseCategories: ['Rubber Plantation', 'Coconut Plantation', 'Overall Farm (gates/fencing/road)',
        'Rubber Labour', 'Formic Acid', 'Fertilizer', 'Tree waterproofing',
        'Smoke house repair', 'Coconut Labour', 'House maintenance', 'Transport', 'Land tax', 'Other expense'],
    },
  ],

  // Pricing defaults
  breakfastRate:       275,   // ₹ per person per day
  additionalGuestRate: 750,   // ₹ per night
  dehuskDefaultRate:   1.50,  // ₹ per coconut

  // Villa tariff/enquiry pricing catalog (moved from src/utils/villaPricing.js)
  pricing: {
    overflowPerGuestPerNight: 750,  // ₹/guest/night above the rate card's max guest count
    overflowMaxRecommended:   4,    // extra guests before flagging outside recommended range
    rateCardMaxGuests:        12,

    // Fallback rate card used only if the backend rate-card fetch hasn't
    // completed yet or fails — mirrors the seeded `villa_rate_cards` table
    // exactly. The backend table is the source of truth; this just avoids a
    // blank UI on a slow/failed fetch.
    fallbackRateCards: {
      dwarka: [
        { guests: 1, tariff: 4896 }, { guests: 2, tariff: 4896 }, { guests: 3, tariff: 6037 },
        { guests: 4, tariff: 7178 }, { guests: 5, tariff: 8319 }, { guests: 6, tariff: 9460 },
        { guests: 7, tariff: 10601 }, { guests: 8, tariff: 11743 }, { guests: 9, tariff: 12884 },
        { guests: 10, tariff: 14025 }, { guests: 11, tariff: 15166 }, { guests: 12, tariff: 16307 },
      ],
    },

    // Mutually exclusive — an enquiry has at most one of these (or none).
    // Defaults are starting points the owner can tune per enquiry or globally later.
    discountCategories: [
      { id: 'loyal_patron', label: 'Loyal Patron / Valued Return Guest / Preferred Guest', defaultPct: 10 },
      { id: 'elite_guest', label: 'Elite Guest', defaultPct: 15 },
      { id: 'platinum_guest', label: 'Platinum Guest', defaultPct: 20 },
      { id: 'b2b_india', label: 'B2B – India', defaultPct: 10 },
      { id: 'b2b_intl', label: 'B2B – International', defaultPct: 20 },
      { id: 'custom_amount', label: 'Custom Amount', defaultPct: 0 },
    ],

    // Shared preset list for ad-hoc priced line items (e.g. "Additional Guest"),
    // used both on confirmed stays (CompleteBooking.jsx) and on enquiry quotes
    // (EnquiryDetail.jsx) before a booking is confirmed.
    extraItems: [
      { label: 'Early Check-in',              amount: 500  },
      { label: 'Late Check-out',              amount: 500  },
      { label: 'Early Check-in + Late Check-out', amount: 1000 },
      { label: 'Additional Day',              amount: 0    },
      { label: 'Breakfast',                   amount: 0    },
      { label: 'Floor Bed',                   amount: 750  },
      { label: 'Additional Guest',            amount: 0    },
      { label: 'Taxi Pick-up',                amount: 0    },
      { label: 'Drop-off & Pick-up',          amount: 0    },
      { label: 'Cleaning Fee',                amount: 1000 },
      { label: 'Event & Culinary Services',   amount: 0    },
      { label: 'Other',                       amount: 0    },
    ],
  },

  // Theme colours
  theme: {
    gold:      '#C8903A',
    goldLight: '#F0D080',
    dark:      '#1A1A1A',
    darkCard:  '#242B3D',
    darkNav:   '#1E2535',
    text:      '#EDF2F7',
    textMuted: '#8A9BAE',
    textDim:   '#5C7080',
    green:     '#34A853',
    red:       '#c62828',
    blue:      '#185FA5',
    teal:      '#0F6E56',
  }
}
