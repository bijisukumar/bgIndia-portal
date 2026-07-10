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
      logoUrl:  null,
    }
  ],

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
