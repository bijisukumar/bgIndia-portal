// ============================================================
//  BG INDIA PORTAL — CENTRAL CONFIGURATION
//  All property-specific values live here.
//  PINs are loaded from environment variables (never in code).
//  To white-label for another tenant: change this file only.
// ============================================================

export const CONFIG = {
  // Branding
  brandName:  'Guruvayur Estates',
  brandShort: 'GE Portal',
  tagline:    'Property Management Portal',

  // Google integration
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbzpW7u02Ss_uUkd7539Ja2RrjzanBrIWIfC8b6Q9wCZa7X4xDLjWHnJiRmr7m9VE1DK/exec',
  driveRootId:   '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva',
  ownerEmail:    'bijisukumar@gmail.com',
  spreadsheetId:    '1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ',  // add this
  guestFormSheetId: '1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0',


  // Villa properties — add more objects here for additional villas
  // logoUrl: per-villa logo for white-labeling (null = use default)
  villas: [
    {
      id:       'dwarka',
      name:     'Dwarka',
      full:     'Dwarka — GVR Villa',
      location: 'Guruvayur',
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
    { id: 'pollachi',   name: 'Pollachi Estate',   type: 'coconut', manager: 'Pradosh',      active: true },
    { id: 'pavutumuri', name: 'Pavutumuri Estate',  type: 'rubber',  manager: 'RamananKutty', active: true },
  ],

  // Pricing defaults
  breakfastRate:       275,   // ₹ per person per day
  additionalGuestRate: 750,   // ₹ per night
  dehuskDefaultRate:   1.50,  // ₹ per coconut

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
