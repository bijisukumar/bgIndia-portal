// ============================================================
// PollNewReservationAndProcess.gs
// ============================================================
// PURPOSE:
//   Polls kerala.luxuryvillas@gmail.com inbox for Airbnb
//   reservation confirmations and auto-creates bookings.
//
// SETUP (run once under kerala.luxuryvillas@gmail.com):
//   1. Go to https://script.google.com
//   2. Sign in as kerala.luxuryvillas@gmail.com
//   3. New project → name it "PollNewReservationAndProcess"
//   4. Paste this entire file (replace default code)
//   5. Run setupTrigger() once manually to install the 5-min poller
//   6. Authorise when prompted (needs Gmail + UrlFetch access)
//   7. Run testConnection() to verify Worker is reachable
//
// WHAT IT DOES EACH RUN (every 5 minutes):
//   1. Searches Gmail for unread Airbnb "Reservation confirmed" emails
//   2. Parses: guest name, dates, night fee, cleaning fee,
//      host service fee, you earn, guest service fee, guest paid
//   3. Checks D1 via Worker — skips if already imported
//   4. Creates booking in D1 (status: confirmed)
//   5. Creates Drive folder: Guests/YYYY/MM-Mon/GuestName-DD-StayID
//   6. Backs up to Sheets
//   7. Emails bijisukumar@gmail.com with full booking summary
//   8. Marks email as read
//
// DOES NOT handle:
//   Reviews — those run from bijisukumar@gmail.com (V21 script)
//   Drive file watcher — runs from V21 script
//   Guest form submit — runs from GuestFormScript.gs
// ============================================================

// ── CONFIG ────────────────────────────────────────────────────────────────
var WORKER_URL    = 'https://manage.luxuryvillasofguruvayur.com/api';
var OWNER_EMAIL   = 'bijisukumar@gmail.com';   // where booking alerts are sent
var DRIVE_ROOT_ID = '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva';
var SPREADSHEET_ID = '1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ';
var STAYS_SHEET   = 'Stays';

// Stays sheet column headers (must match V20 Apps Script STAYS_HEADERS)
var STAYS_HEADERS = [
  'stayId','villaId','guestName','bookerName',
  'checkIn','checkOut','nights','bookedDate','confirmedAt',
  'guestCount','adults','children','infants',
  'citizenship','govtId','phone','email',
  'channel','breakfastPrepaid','additionalGuests','transport',
  'purpose','eta','carNumber','carPhoto','platePhoto','driveFolder',
  'status','gross','commPct','commAmt','gst','extraCharges','net',
  'ramanComm','ramanPaid','ramanPaidDate','ramanMonthly',
  'cabService','carRental','carRentalMargin',
  'cleaners','maintenance','review','source'
];

// ── ENTRY POINTS ──────────────────────────────────────────────────────────

// Main poller — runs every 5 minutes via trigger
function pollNewReservations() {
  Logger.log('=== pollNewReservations START ' + new Date().toISOString() + ' ===');
  try {
    pollAirbnbBookings();
  } catch(e) {
    Logger.log('pollAirbnbBookings ERROR: ' + e.message);
    sendAlert('🚨 Poller error', e.message + '\n' + (e.stack||''));
  }
  Logger.log('=== pollNewReservations END ===');
}

// Run once to install 5-min trigger
function setupTrigger() {
  // Remove existing trigger to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'pollNewReservations') {
      ScriptApp.deleteTrigger(t);
      Logger.log('Removed existing trigger');
    }
  });
  ScriptApp.newTrigger('pollNewReservations')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('✅ Trigger installed: pollNewReservations every 5 minutes');
}

// Quick smoke test — run manually to verify Worker connection
function testConnection() {
  var resp = callWorker('GET', 'getStays', { villaId:'dwarka', year:'2026' });
  if (resp && resp.success) {
    Logger.log('✅ Worker connected. 2026 stays: ' + (resp.data ? resp.data.length : 0));
  } else {
    Logger.log('❌ Worker connection failed: ' + JSON.stringify(resp));
  }
}

// ── AIRBNB BOOKING POLLER ─────────────────────────────────────────────────
function pollAirbnbBookings() {
  var threads = GmailApp.search(
    'from:automated@airbnb.com ' +
    '(subject:"Reservation confirmed" OR subject:"New reservation") ' +
    'is:unread',
    0, 20
  );

  Logger.log('Unread Airbnb reservation threads: ' + threads.length);

  threads.forEach(function(thread) {
    var msg  = thread.getMessages()[0];
    var subj = msg.getSubject();
    var body = msg.getPlainBody();

    Logger.log('Processing: ' + subj);

    try {
      // ── Parse the email ────────────────────────────────────────────────
      var booking = parseAirbnbConfirmation(body, subj);
      if (!booking) {
        Logger.log('Could not parse email — skipping: ' + subj);
        // Still mark read so we don't re-process
        msg.markRead();
        return;
      }

      Logger.log('Parsed: ' + booking.guestName + ' | ' +
                 booking.checkIn + ' → ' + booking.checkOut +
                 ' | conf: ' + booking.confirmationCode);

      // ── Duplicate check — skip if already in D1 ────────────────────────
      if (alreadyImported(booking.confirmationCode)) {
        Logger.log('Already imported: ' + booking.confirmationCode);
        msg.markRead();
        return;
      }

      // ── Create booking in D1 via Worker ───────────────────────────────
      var resp = callWorker('POST', 'createBooking', {
        villaId:         'dwarka',
        source:          'airbnb',
        guestName:       booking.guestName,
        checkInDate:     booking.checkIn,
        checkOutDate:    booking.checkOut,
        nights:          booking.nights,
        adults:          booking.adults || 1,
        // Gross = night fee + cleaning fee (both shown on host payout)
        gross:           (booking.nightFee || 0) + (booking.cleaningFee || 0),
        // Host commission = 3% host service fee (NOT the 15% guest fee)
        commissionPct:   3,
        commissionAmt:   booking.hostServiceFee || 0,
        net:             booking.youEarn || 0,
        // Store Airbnb confirmation code in airbnbConf field
        airbnbConf:      booking.confirmationCode,
        // Store all fee components for reference
        nightFee:        booking.nightFee,
        cleaningFee:     booking.cleaningFee,
        hostServiceFee:  booking.hostServiceFee,
        guestServiceFee: booking.guestServiceFee,
        guestPaid:       booking.guestPaid,
        youEarn:         booking.youEarn,
        status:          'confirmed',
        createdBy:       'auto',
      });

      if (!resp || !resp.success) {
        Logger.log('Worker createBooking failed: ' + JSON.stringify(resp));
        sendAlert('⚠️ Booking import failed: ' + booking.guestName,
          'Conf: ' + booking.confirmationCode +
          '\nWorker response: ' + JSON.stringify(resp) +
          '\nPlease create manually in New Booking screen.');
        return;
      }

      var stayId = resp.data.stayId;
      Logger.log('D1 booking created: ' + stayId);

      // ── Create Drive folder ────────────────────────────────────────────
      var folderUrl = '';
      try {
        var folder = getOrCreateGuestFolder(booking.guestName, stayId, booking.checkIn);
        folderUrl  = folder.getUrl();
        // Link folder back to D1 stay
        callWorker('POST', 'updateDriveFolder', {
          stayId:         stayId,
          driveFolderId:  folder.getId(),
          driveFolderUrl: folderUrl,
        });
        Logger.log('Drive folder created: ' + folderUrl);
      } catch(fe) {
        Logger.log('Drive folder error: ' + fe.message);
        // Non-fatal — booking still created, folder can be made manually
      }

      // ── Backup to Sheets ───────────────────────────────────────────────
      try {
        appendToStaysSheet({
          stayId:    stayId,
          villaId:   'dwarka',
          guestName: booking.guestName,
          checkIn:   booking.checkIn,
          checkOut:  booking.checkOut,
          nights:    booking.nights,
          channel:   'Airbnb',
          gross:     (booking.nightFee || 0) + (booking.cleaningFee || 0),
          commPct:   3,
          commAmt:   booking.hostServiceFee || 0,
          net:       booking.youEarn || 0,
          status:    'confirmed',
          source:    booking.confirmationCode,
          driveFolder: folderUrl,
        });
      } catch(se) {
        Logger.log('Sheets backup error: ' + se.message);
        // Non-fatal
      }

      // ── Mark email as read ─────────────────────────────────────────────
      msg.markRead();

      // ── Alert owner ────────────────────────────────────────────────────
      sendAlert(
        '✈️ New Airbnb booking: ' + booking.guestName,
        'BOOKING IMPORTED AUTOMATICALLY' +
        '\n' +
        '\nStay ID:          ' + stayId +
        '\nGuest:            ' + booking.guestName +
        '\nConfirmation:     ' + booking.confirmationCode +
        '\nCheck-in:         ' + booking.checkIn +
        '\nCheck-out:        ' + booking.checkOut +
        '\nNights:           ' + booking.nights +
        '\nAdults:           ' + (booking.adults || 1) +
        '\n' +
        '\nHOST PAYOUT:' +
        '\n  Night fee:        ₹' + (booking.nightFee || 0) +
        '\n  Cleaning fee:     ₹' + (booking.cleaningFee || 0) +
        '\n  Host service fee: -₹' + (booking.hostServiceFee || 0) +
        '\n  You earn:         ₹' + (booking.youEarn || 0) +
        '\n' +
        '\nGUEST PAID:' +
        '\n  Guest service fee: ₹' + (booking.guestServiceFee || 0) +
        '\n  Total paid:        ₹' + (booking.guestPaid || 0) +
        '\n' +
        '\nDrive folder: ' + (folderUrl || 'not created — create manually') +
        '\n' +
        '\nNEXT STEPS:' +
        '\n1. Open Complete Booking screen and review financials' +
        '\n2. Send check-in form link to guest' +
        '\n3. Once guest submits form, system auto-sets ready_for_checkin'
      );

      Logger.log('✅ Done: ' + booking.guestName + ' → ' + stayId);

    } catch(e) {
      Logger.log('Error processing "' + subj + '": ' + e.message);
      sendAlert('🚨 Airbnb import error: ' + subj,
        e.message + '\n' + (e.stack || '') +
        '\nPlease create this booking manually.');
    }
  });
}

// ── EMAIL PARSER ──────────────────────────────────────────────────────────
function parseAirbnbConfirmation(body, subject) {
  // Confirmation code: HMXXXXXXXX format
  var confMatch = body.match(/\b(HM[A-Z0-9]{6,12})\b/) ||
                  body.match(/Confirmation code[:\s]+([A-Z0-9]{8,12})/i);
  var confCode  = confMatch ? confMatch[1] : ('AB-' + Date.now());

  // Guest name from subject or body
  var nameMatch = subject.match(/^([A-Za-z\s\-\.]+?)\s+(?:has reserved|left a)/i) ||
                  body.match(/Guest name[:\s]+(.+)/i) ||
                  subject.match(/from\s+([A-Za-z\s]+)/i);
  var guestName = nameMatch ? nameMatch[1].trim() : 'Airbnb Guest';

  // Dates
  var checkIn  = extractDate(body, 'Check-in');
  var checkOut = extractDate(body, 'Check-out') || extractDate(body, 'Checkout');
  if (!checkIn) return null; // can't create booking without date

  // Nights
  var nightsMatch = body.match(/(\d+)\s+night/i);
  var nights = nightsMatch ? parseInt(nightsMatch[1]) : 0;
  if (!nights && checkIn && checkOut) {
    nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  }

  // Fees — handles ₹ symbol, commas, en-dash, minus
  function amt(pattern) {
    var m = body.match(pattern);
    if (!m) return 0;
    return parseFloat(String(m[1]).replace(/[,₹\s\u20B9]/g, '')) || 0;
  }

  // Night fee: "₹7,770.00 x 1 night" or "1 night room fee  ₹7,770.00"
  var nightFee = amt(/(\d[\d,\.]+)\s*(?:×|x)\s*\d+\s*night/i) ||
                 amt(/\d+\s+night\s+room\s+fee\s+₹?\s*([\d,\.]+)/i) ||
                 amt(/Night fee[:\s]+₹?\s*([\d,\.]+)/i);

  var cleaningFee   = amt(/Cleaning fee[:\s]+₹?\s*([\d,\.]+)/i);
  var hostSvcFee    = amt(/Host service fee[^:\n]*[:\s]+[-−\u2212]?₹?\s*([\d,\.]+)/i);
  var youEarn       = amt(/You earn[:\s]+₹?\s*([\d,\.]+)/i) ||
                      amt(/Total\s*\(INR\)[:\s]+₹?\s*([\d,\.]+)/i);
  var guestSvcFee   = amt(/Guest service fee[:\s]+₹?\s*([\d,\.]+)/i);
  var guestPaid     = amt(/(?:Guest paid|Total \(INR\))[:\s]+₹?\s*([\d,\.]+)/i);

  var adultsMatch = body.match(/(\d+)\s+guest/i);

  return {
    confirmationCode: confCode,
    guestName:        guestName,
    checkIn:          checkIn,
    checkOut:         checkOut || '',
    nights:           nights,
    adults:           adultsMatch ? parseInt(adultsMatch[1]) : 1,
    nightFee:         nightFee,
    cleaningFee:      cleaningFee,
    hostServiceFee:   hostSvcFee,
    youEarn:          youEarn,
    guestServiceFee:  guestSvcFee,
    guestPaid:        guestPaid,
  };
}

function extractDate(body, label) {
  // "Check-in: Thursday, May 22, 2026" or "Check-in: 2026-05-22"
  var p1 = new RegExp(label + '[:\\s]+([A-Za-z]+,?\\s+[A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4})', 'i');
  var p2 = new RegExp(label + '[:\\s]+(\\d{4}-\\d{2}-\\d{2})', 'i');
  var p3 = new RegExp(label + '[:\\s]+(\\d{1,2}\\s+[A-Za-z]+\\s+\\d{4})', 'i');
  var m  = body.match(p1) || body.match(p2) || body.match(p3);
  if (!m) return null;
  try {
    var d = new Date(m[1].replace(/(\d+)(st|nd|rd|th)/gi,'$1'));
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  } catch(e) { return null; }
}

// ── DUPLICATE CHECK ────────────────────────────────────────────────────────
// Checks both D1 (via Worker) and Sheets to avoid double-imports
function alreadyImported(confCode) {
  if (!confCode || confCode.startsWith('AB-')) return false;

  // Check D1 — query current + last year (covers edge cases around Jan)
  try {
    var currentYear = new Date().getFullYear();
    var yearsToCheck = [currentYear, currentYear - 1];
    for (var yi = 0; yi < yearsToCheck.length; yi++) {
      var resp = callWorker('GET', 'getStays', { villaId:'dwarka', year: String(yearsToCheck[yi]) });
      if (resp && resp.success && Array.isArray(resp.data)) {
        var found = resp.data.some(function(s) {
          return String(s.airbnb_conf || s.airbnbConf || '').trim() === confCode ||
                 String(s.source || '').trim() === confCode;
        });
        if (found) return true;
      }
    }
  } catch(e) { Logger.log('D1 dup check error: ' + e.message); }

  // Fallback: check Sheets
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(STAYS_SHEET);
    if (!sheet) return false;
    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    var srcIdx  = headers.indexOf('source');
    if (srcIdx < 0) return false;
    return data.slice(1).some(function(row) {
      return String(row[srcIdx] || '').trim() === confCode;
    });
  } catch(e) { Logger.log('Sheets dup check error: ' + e.message); return false; }
}

// ── DRIVE FOLDER ───────────────────────────────────────────────────────────
// Creates: Guests/YYYY/MM-MonthName/GuestName-DD-StayID
function getOrCreateGuestFolder(guestName, stayId, checkInDate) {
  var root = DriveApp.getFolderById(DRIVE_ROOT_ID);

  var gf = root.getFoldersByName('Guests');
  var guestsFolder = gf.hasNext() ? gf.next() : root.createFolder('Guests');

  var d = checkInDate ? new Date(checkInDate) : new Date();
  if (isNaN(d)) d = new Date();
  var year       = String(d.getFullYear());
  var month      = d.getMonth();
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthLabel = String(month + 1).padStart(2, '0') + '-' + monthNames[month];
  var day        = String(d.getDate()).padStart(2, '0');

  var yf = guestsFolder.getFoldersByName(year);
  var yearFolder = yf.hasNext() ? yf.next() : guestsFolder.createFolder(year);

  var mf = yearFolder.getFoldersByName(monthLabel);
  var monthFolder = mf.hasNext() ? mf.next() : yearFolder.createFolder(monthLabel);

  var folderName = (guestName || 'Guest') + '-' + day + '-' + stayId;
  var ef = monthFolder.getFoldersByName(folderName);
  return ef.hasNext() ? ef.next() : monthFolder.createFolder(folderName);
}

// ── SHEETS BACKUP ─────────────────────────────────────────────────────────
function appendToStaysSheet(data) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(STAYS_SHEET);
  if (!sheet) return; // sheet doesn't exist — skip silently

  var now = new Date().toISOString();
  var gc  = (parseInt(data.adults)||0) + (parseInt(data.children)||0);

  // Build row matching STAYS_HEADERS column order exactly
  var row = [
    data.stayId||'',    data.villaId||'dwarka', data.guestName||'', data.guestName||'',
    data.checkIn||'',   data.checkOut||'',       data.nights||0,     '',   now,
    gc||0,              data.adults||0,           data.children||0,   0,
    '', '', '', '',  // citizenship blank — unknown at booking time
    data.channel||'Airbnb', 'No','No','No',
    '','','','','', data.driveFolder||'',
    data.status||'confirmed',
    data.gross||0,  data.commPct||0, data.commAmt||0, 0, 0, data.net||0,
    0,'No','','',
    0,0,0,
    0,0,'', data.source||''
  ];

  sheet.appendRow(row);
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function callWorker(method, action, payload) {
  try {
    var url  = WORKER_URL + '/' + action;
    var opts = {
      method:             method.toLowerCase(),
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getSystemToken() },
      muteHttpExceptions: true,
    };
    if (method === 'GET' && payload && Object.keys(payload).length > 0) {
      url += '?' + Object.keys(payload).map(function(k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(String(payload[k] || ''));
      }).join('&');
    }
    if (method === 'POST') {
      opts.payload = JSON.stringify(payload || {});
    }
    var resp = UrlFetchApp.fetch(url, opts);
    return JSON.parse(resp.getContentText());
  } catch(e) {
    Logger.log('callWorker (' + action + '): ' + e.message);
    return null;
  }
}

function sendAlert(subject, body) {
  try {
    GmailApp.sendEmail(OWNER_EMAIL, '[GVR Portal] ' + subject, body);
  } catch(e) {
    Logger.log('sendAlert failed: ' + e.message);
  }
}
