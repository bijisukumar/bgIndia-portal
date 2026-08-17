// ============================================================
//  HOST CONFIG — demovilla (SIMULATION ONLY — local demo-onboarding test)
//  Not a real host. Created to prove out the hosts/<hostId>/config.js
//  shape and the villa-scoping logic end to end, entirely against a
//  local D1 replica. Delete once the demo-onboarding simulation is done,
//  or keep as a living reference template for real onboarding later.
// ============================================================

export const CONFIG = {
  // Branding
  brandName:  'Demo Test Villas',
  brandShort: 'Demo Portal',
  tagline:    'Simulation Host — Not A Real Customer',

  landingUrl: 'https://www.demo-not-real.test',

  // Google integration (fake placeholders — this host never talks to Google)
  appsScriptUrl: 'https://script.google.com/macros/s/DEMO_NOT_REAL/exec',
  driveRootId:   'demo-drive-root-id',
  ownerEmail:    'demo-owner@example.test',
  ownerWhatsApp: '+1 900 000 0000',
  // Demo tenant has no verified sending domain of its own, so it borrows the
  // one verified domain with a display name that is unmistakably not a real
  // customer. guestBcc stays null — the demo must never copy a real inbox
  // while a prospect is clicking around in it.
  email: {
    guestFrom: 'Demo Test Villas <stay@luxuryvillasofguruvayur.com>',
    alertFrom: 'Demo Test Villas (alerts) <alerts@luxuryvillasofguruvayur.com>',
    guestBcc:  null,
  },
  spreadsheetId:    'demo-spreadsheet-id',
  guestFormSheetId: 'demo-guest-form-sheet-id',

  villas: [
    {
      id:       'demovilla',
      name:     'Demo Villa',
      full:     'Demo Villa — Simulation Host',
      arrivalFullName: 'Demo Test Villa',
      location: 'Test City',
      address:  '123 Demo Street, Test City, Kerala 680000',
      mapsLink: 'https://maps.app.goo.gl/demo-placeholder',
      bedrooms: 3,
      active:   true,
      logoUrl:  null,   // no distinct white-label logo for the demo tenant — showing the
                        // redundant "Powered by StayVibe360" line under the StayVibe360
                        // logo itself would look like a bug, not a feature
      managerName: 'Demo Manager',
      managerUpi: 'demo-manager@upi',
      managerPhone: '+1 900 000 0002',
      checkinTime:  '4:00 PM',
      checkoutTime: '11:00 AM',
    }
  ],

  turnaround: {
    defaultCheckinTime:  '16:00',
    defaultCheckoutTime: '11:00',
    turnaroundHours: 4,
  },

  checkinBaseUrl: 'https://demo.stayvibe360.com',
  checkinLinkTokens: { direct: 'demo-direct' },
  checkinLinkDefaultToken: 'demo-direct',

  // Demo equivalent of dwarka's flexibility page. Required, not optional:
  // demovilla builds from the same stayvibe app entry, so /flexibility is
  // routed here too and the component reads these keys directly — without
  // this block that route would throw on render.
  flexibility: {
    hero: {
      eyebrow: 'DIRECT GUESTS · DEMO VILLA',
      title: "Travelling with family? We'll make the timings work.",
      intro: 'Check-in is after 4:00 PM and check-out by 11:00 AM. Here is what happens in the five hours between — and what we can do when those hours do not suit your family.',
    },
    why: {
      heading: 'Why our timings are what they are',
      body: [
        'Check-out is by 11:00 AM. Check-in is after 4:00 PM. That gap is five hours, and it is fully used.',
        'Between one family leaving and the next arriving, our team resets the whole house.',
      ],
      checklist: [
        'Every bed stripped and remade with fresh linen',
        'Every bathroom deep-cleaned and sanitised',
        'The kitchen cleaned down and restocked',
        'Every bedroom, the living areas and the grounds gone over',
      ],
      closing: [
        "We don't cut corners to turn the house around faster — a home this size simply takes that long to bring back to standard.",
      ],
    },
    options: {
      heading: 'Need to arrive earlier, or leave later? Just ask.',
      body: [
        'We understand that at times a family needs more flexibility than our normal timings allow. Tell us which of these two it is, and we will work to it.',
      ],
      tiers: [
        { label: 'Would be nice to have',
          lead: 'Free, if the house is free.',
          body: "If nobody is staying the night before, we'll give you the extra time at no charge, confirmed on the morning of your check-in." },
        { label: 'Must have',
          lead: 'Held for you, guaranteed, at a fraction of a night.',
          body: "We hold the adjoining night so it is certain. That night can't then be sold, so we ask for 25% or 50% of it rather than a full night." },
      ],
      availabilityNote: "One honest note: when the villa is booked back-to-back, there may simply be no gap to give — and we won't always be able to say yes. If that happens we'll tell you early, and we'll look at every option we have before we do.",
      directNote: "This is something we're able to offer only to guests who book with us directly.",
      advanceNote: 'Please ask ahead of time — timing changes need to be agreed before you arrive.',
    },
    ota: {
      heading: 'Booked through a platform?',
      body: [
        'Extra nights for your current stay need to be arranged through them — those dates live in their system.',
        'Worth knowing for next time: guests who book with us directly get flexibility on arrival and departure timings at a fraction of a night rather than the full rate.',
      ],
      directPitch: [
        'No platform commission — that saving stays with you',
        'Flexible arrival and departure at a fraction of a night',
        'Talk straight to the family who owns the home',
      ],
      directOptInLabel: "Yes — send me your direct rates. I'd like to book with you directly.",
      ctaLabel: 'Send me your direct rates for next time',
      thanks: "Thank you — we'll be in touch with our direct rates.",
    },
    form: {
      heading: 'Tell us what you need',
      needTypes: ['Earlier check-in on arrival day', 'Later check-out on departure day', 'Both'],
      checkinTimeLabel:  'What time do you need to arrive?',
      checkoutTimeLabel: 'What time do you need to leave?',
      priorityLabel: 'Type of request',
      priorities: [
        { id: 'nice_to_have', label: 'Would like it if available — no charge, confirm on the day' },
        { id: 'must_have',    label: 'Must have — happy to pay to secure it' },
      ],
      directInterestLabel: "I'd like to discuss booking directly with you",
      submitLabel: 'Send request',
      thanks: "Thank you — we've got your request and will come back to you before you travel.",
    },
    channels: ['OTA — online partner (Airbnb, Booking.com, MMT…)', 'Direct with us', 'Travel agent'],
    directChannel: 'Direct with us',
  },

  guestMessages: {
    hostIntro: {
      template:
`Namaskaram {firstName}! 🙏

This is your host from Demo Villa. I wanted to personally welcome you ahead of your stay on {checkinDateShort}.

We open our home to your family and strive to create a comfortable, memorable experience. To help us prepare for your visit, I'd love to connect briefly to review your reservation, arrival timing, and any special requirements you may have.

*YOUR BOOKING*
• Check-in: {checkinDateFull} — after {checkinTime}
• Check-out: {checkoutDateFull} — by {checkoutTime}
• Guests: {guestCount}
• Nights: {nights}
{checkinPrompt}
Please let me know a convenient time to connect. We're looking forward to hosting you and your family.

Warm regards,
Demo Villa`,
      checkinPrompt:
`
📝 If you haven't completed your online check-in registration yet, please do so at your earliest convenience — it's a mandatory registration requirement, and it helps us have everything ready before you arrive:
{checkinUrl}
`,
    },
    comfortCheck: {
      template:
`Namaskaram {guestName}! 🙏

We hope your travel was comfortable, and that check-in went smoothly with our staff able to assist you well.

Wishing you a wonderful stay at {villaName}! If you need anything at all during your time here, {managerName} is just a phone call away — {managerPhone}.

Enjoy your stay! 🏡`,
    },
    checkoutDay: {
      subject: 'Checkout day today — {villaName}',
      template:
`Namaskaram {guestName},

Today is your check-out day at {villaName}. Standard check-out time is {checkoutTime} — please let {managerName} know if you need any assistance before you leave ({managerPhone}).

You'll find all your check-out details in the folder left at the villa — please do review it at your convenience.

We hope you had a truly beautiful and enjoyable stay, with wonderful family moments at {villaName}. Safe travels, and we do hope to welcome you back again soon!

Warm regards,
{brandName}`,
    },
  },

  rentalProperties: [],

  leaseIndia: {
    lessorName:    'Demo Lessor',
    lessorAddress: 'Demo Address, Test City, Kerala 680000',
    lessorPan:     'DEMO0000X',
    executionCity: 'Test City',
    bank: {
      accountName:   'Demo Lessor',
      bankName:      'Demo Bank',
      accountNumber: '00000000000000',
      ifsc:          'DEMO0000000',
      swift:         'DEMOINBBXXX',
    },
    renewalIncreasePct: 5,
    maintenanceIncludedInRent: false,
    lateFeeTiers: [
      { label: 'Due on 1st of every month',       from: 1,  to: 1,  fee: 0 },
      { label: 'Emergency Grace period (2nd-5th)', from: 2,  to: 5,  fee: 0 },
      { label: '6th-8th of the month',             from: 6,  to: 8,  fee: 2000 },
      { label: '9th-15th of the month',            from: 9,  to: 15, fee: 7000 },
      { label: '16th-31st of the month',           from: 16, to: 31, fee: 12000 },
    ],
    prematureTermination: {
      beforeFullTerm:  'LESSEE is to pay broker commission',
      before6Months:   'LESSEE is to pay 1 month additional Rent amount',
    },
    defectNoticeDays: 10,
    jurisdiction:  'Test City',
  },

  estates: [],

  // Pricing defaults — deliberately different values from dwarka's, so a
  // mix-up between hosts would be immediately obvious in the UI.
  breakfastRate:       300,
  additionalGuestRate: 800,
  dehuskDefaultRate:   2.00,

  pricing: {
    overflowPerGuestPerNight: 800,
    overflowMaxRecommended:   3,
    rateCardMaxGuests:        10,

    fallbackRateCards: {
      demovilla: [
        { guests: 1, tariff: 3000 }, { guests: 2, tariff: 3000 }, { guests: 3, tariff: 4000 },
        { guests: 4, tariff: 5000 }, { guests: 5, tariff: 6000 }, { guests: 6, tariff: 7000 },
        { guests: 7, tariff: 8000 }, { guests: 8, tariff: 9000 }, { guests: 9, tariff: 10000 },
        { guests: 10, tariff: 11000 },
      ],
    },

    discountCategories: [
      { id: 'loyal_patron', label: 'Loyal Patron', defaultPct: 10 },
      { id: 'b2b_india', label: 'B2B – India', defaultPct: 10 },
      { id: 'custom_amount', label: 'Custom Amount', defaultPct: 0 },
    ],

    extraItems: [
      { label: 'Early Check-in',  amount: 500  },
      { label: 'Late Check-out',  amount: 500  },
      { label: 'Additional Day',  amount: 0    },
      { label: 'Breakfast',       amount: 0    },
      { label: 'Other',           amount: 0    },
    ],
  },

  theme: {
    gold:      '#3A7CC8',
    goldLight: '#80B0F0',
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
