// ============================================================
//  HOST PRIVATE CONFIG — dwarka
//
//  Values that must never reach a browser without a login: the lessor's
//  identity, bank details and PAN (used to draw up lease deeds and receipts)
//  and the Google ids.
//
//  hosts/dwarka/config.js is compiled into the JavaScript every visitor
//  downloads and is also served, with no login, by the getAppConfig action,
//  so nothing private can live there. THIS file is imported ONLY by the
//  worker (functions/api/[[route]].js) and is handed to a signed-in owner by
//  the getPrivateConfig action. Never import it from src/.
// ============================================================

export const PRIVATE = {
  // Google ids
  driveRootId:      '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva',
  spreadsheetId:    '1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ',
  guestFormSheetId: '1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0',

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
}
