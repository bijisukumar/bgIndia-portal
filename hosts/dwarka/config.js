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
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbzpW7u02Ss_uUkd7539Ja2RrjzanBrIWIfC8b6Q9wCZa7X4xDLjWHnJiRmr7m9VE1DK/exec',
  driveRootId:   '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva',
  ownerEmail:    'bijisukumar@gmail.com',
  // Owner WhatsApp — for guest change requests only (arrival message routes
  // any date/guest-count/request changes here, not to the on-site manager).
  ownerWhatsApp: '+1 972.876.5101',
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
      logoUrl:  null,   // set to '/icons/dwarka-logo.png' or CDN URL to brand this villa
    }
  ],

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
