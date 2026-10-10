// ============================================================
//  HOST PRIVATE CONFIG — demovilla
//
//  Values that must never reach a browser without a login: the lessor's
//  identity, bank details and PAN (used to draw up lease deeds and receipts)
//  and the Google ids.
//
//  hosts/demovilla/config.js is compiled into the JavaScript every visitor
//  downloads and is also served, with no login, by the getAppConfig action,
//  so nothing private can live there. THIS file is imported ONLY by the
//  worker (functions/api/[[route]].js) and is handed to a signed-in owner by
//  the getPrivateConfig action. Never import it from src/.
// ============================================================

export const PRIVATE = {
  // Google ids
  driveRootId:      'demo-drive-root-id',
  spreadsheetId:    'demo-spreadsheet-id',
  guestFormSheetId: 'demo-guest-form-sheet-id',

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
}
