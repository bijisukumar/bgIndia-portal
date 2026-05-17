// ============================================================
// BG INDIA PORTAL — APPS SCRIPT ADDITIONS
// Add these functions to your existing Apps Script (V20)
// Then set up time-based triggers as noted below.
// ============================================================

// ── UPDATED CONFIG (merge with existing) ─────────────────────────────────
// Add these to your existing CONFIG object:
// workerUrl: 'https://manage.luxuryvillasofguruvayur.com/api'
// The Worker URL is used to notify D1 when reviews/bookings arrive via email.

var WORKER_URL = 'https://manage.luxuryvillasofguruvayur.com/api';

// ============================================================
// PART 1: DRIVE FOLDER — CORRECT YEAR/MONTH/GUEST STRUCTURE
// ============================================================
// New structure: BG-India/Portal/Guests/YYYY/MM-MonthName/GuestName-DD-StayID
// Example: Guests/2026/05-May/Vikram Ramasubramanian-17-DWK-AB123
//
// REPLACE your existing getOrCreateGuestFolder() with this version:

function getOrCreateGuestFolder(guestName, stayId, checkInDate) {
  var root = DriveApp.getFolderById(CONFIG.driveRootId);

  // Get or create Guests root
  var gf = root.getFoldersByName('Guests');
  var guestsFolder = gf.hasNext() ? gf.next() : root.createFolder('Guests');

  // Parse check-in date for year/month
  var d = checkInDate ? new Date(checkInDate) : new Date();
  var year  = String(d.getFullYear());
  var month = d.getMonth(); // 0-indexed
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthLabel = String(month + 1).padStart(2, '0') + '-' + monthNames[month];
  var day   = String(d.getDate()).padStart(2, '0');

  // Year folder
  var yf = guestsFolder.getFoldersByName(year);
  var yearFolder = yf.hasNext() ? yf.next() : guestsFolder.createFolder(year);

  // Month folder
  var mf = yearFolder.getFoldersByName(monthLabel);
  var monthFolder = mf.hasNext() ? mf.next() : yearFolder.createFolder(monthLabel);

  // Guest folder: GuestName-DD-StayID
  var folderName = guestName + '-' + day + '-' + stayId;
  var ef = monthFolder.getFoldersByName(folderName);
  if (ef.hasNext()) return ef.next();
  return monthFolder.createFolder(folderName);
}

// UPDATE createBooking to pass checkInDate to folder creation:
// FIND this line in confirmCheckIn and createBooking:
//   var folder = getOrCreateGuestFolder(guestName, stayId);
// REPLACE with:
//   var folder = getOrCreateGuestFolder(guestName, stayId, data.checkInDate||data.checkIn);

// ============================================================
// PART 2: GMAIL POLLER — AIRBNB BOOKINGS + REVIEWS
// ============================================================
// Set up a time-based trigger: every 5 minutes
// In Apps Script: Triggers → Add Trigger → pollGmail → Time-driven → Minutes → Every 5 minutes

function pollGmail() {
  try { pollAirbnbBookings(); } catch(e) { Logger.log('pollAirbnbBookings error: ' + e.message); }
  try { pollAirbnbReviews();  } catch(e) { Logger.log('pollAirbnbReviews error: '  + e.message); }
  try { pollGoogleReviews();  } catch(e) { Logger.log('pollGoogleReviews error: '  + e.message); }
  try { pollDriveCheckIns();  } catch(e) { Logger.log('pollDriveCheckIns error: '  + e.message); }
}

// ── AIRBNB BOOKING CONFIRMATION ───────────────────────────────────────────
// Reads Airbnb confirmation emails and creates bookings in D1 via Worker.
// Email pattern: from:automated@airbnb.com subject:"Reservation confirmed"
// Also catches: subject:"New reservation" from Airbnb

function pollAirbnbBookings() {
  var threads = GmailApp.search(
    'from:automated@airbnb.com (subject:"Reservation confirmed" OR subject:"New reservation") is:unread',
    0, 10
  );

  threads.forEach(function(thread) {
    var msg  = thread.getMessages()[0];
    var body = msg.getPlainBody();
    var subj = msg.getSubject();

    try {
      var booking = parseAirbnbConfirmation(body, subj);
      if (!booking) { Logger.log('Could not parse Airbnb email: ' + subj); return; }

      // Check if already imported (by Airbnb confirmation code)
      var existing = checkAirbnbConfExists(booking.confirmationCode);
      if (existing) {
        Logger.log('Already imported: ' + booking.confirmationCode);
        msg.markRead();
        return;
      }

      // Create booking via Worker → D1
      var payload = {
        action:          'createBooking',
        villaId:         'dwarka',
        source:          'airbnb',
        guestName:       booking.guestName,
        checkInDate:     booking.checkIn,
        checkOutDate:    booking.checkOut,
        nights:          booking.nights,
        adults:          booking.adults || 1,
        gross:           booking.nightFee + (booking.cleaningFee || 0),
        commissionPct:   3,
        commissionAmt:   booking.hostServiceFee || 0,
        net:             booking.youEarn || 0,
        airbnbConf:      booking.confirmationCode,
        nightFee:        booking.nightFee,
        cleaningFee:     booking.cleaningFee,
        hostServiceFee:  booking.hostServiceFee,
        guestServiceFee: booking.guestServiceFee,
        guestPaid:       booking.guestPaid,
        youEarn:         booking.youEarn,
        status:          'confirmed',
        createdBy:       'auto',
      };

      var resp = callWorker('POST', 'createBooking', payload);
      if (resp && resp.success) {
        Logger.log('Airbnb booking imported: ' + booking.confirmationCode + ' → ' + resp.data.stayId);
        msg.markRead();

        // Also save to Sheets (legacy backup)
        appendRow(SHEETS.STAYS, STAYS_HEADERS, buildStayRow({
          stayId:    resp.data.stayId,
          villaId:   'dwarka',
          guestName: booking.guestName,
          checkIn:   booking.checkIn,
          checkOut:  booking.checkOut,
          nights:    booking.nights,
          channel:   'Airbnb',
          gross:     booking.nightFee + (booking.cleaningFee || 0),
          commPct:   3,
          commAmt:   booking.hostServiceFee || 0,
          net:       booking.youEarn || 0,
          status:    'confirmed',
          source:    booking.confirmationCode,
        }, resp.data.folderUrl || ''));

        sendEmail(
          '✈️ Airbnb booking auto-imported: ' + booking.guestName,
          'Confirmation: ' + booking.confirmationCode +
          '\nGuest: '      + booking.guestName +
          '\nCheck-in: '   + booking.checkIn +
          '\nCheck-out: '  + booking.checkOut +
          '\nNights: '     + booking.nights +
          '\nYou earn: ₹'  + (booking.youEarn || 0) +
          '\nStay ID: '    + resp.data.stayId +
          '\n\nPlease review and update tariff in Complete Booking screen.'
        );
      } else {
        Logger.log('Worker createBooking failed: ' + JSON.stringify(resp));
      }
    } catch(e) {
      Logger.log('Error processing Airbnb email: ' + e.message);
      sendErrorEmail('pollAirbnbBookings', e, subj);
    }
  });
}

function parseAirbnbConfirmation(body, subject) {
  // Extract confirmation code: HMXXXXXXXX format
  var confMatch = body.match(/\b(HM[A-Z0-9]{6,12})\b/) ||
                  body.match(/Confirmation code[:\s]+([A-Z0-9]{8,12})/i) ||
                  body.match(/([A-Z0-9]{10})\b/);
  var confCode  = confMatch ? confMatch[1] : null;

  // Extract guest name from subject or body
  var nameMatch = subject.match(/^([A-Za-z\s]+) has reserved/) ||
                  body.match(/Guest name[:\s]+(.+)/i) ||
                  body.match(/([A-Z][a-z]+ [A-Z][a-z]+) is reserved/);
  var guestName = nameMatch ? nameMatch[1].trim() : 'Airbnb Guest';

  // Extract dates
  var checkInMatch  = body.match(/Check-in[:\s]+([A-Za-z]+,?\s+[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i) ||
                      body.match(/(\d{4}-\d{2}-\d{2})/);
  var checkOutMatch = body.match(/Check-out[:\s]+([A-Za-z]+,?\s+[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);

  var checkIn  = checkInMatch  ? parseFlexDate(checkInMatch[1])  : null;
  var checkOut = checkOutMatch ? parseFlexDate(checkOutMatch[1]) : null;

  // Nights
  var nightsMatch = body.match(/(\d+)\s+night/i);
  var nights = nightsMatch ? parseInt(nightsMatch[1]) : 0;
  if (!nights && checkIn && checkOut) {
    nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  }

  // Fees — "You earn" section
  var nightFeeMatch      = body.match(/(\d[\d,]+)\s*(?:×\s*\d+\s*night|night fee)/i);
  var cleaningFeeMatch   = body.match(/Cleaning fee[:\s]+₹?\s*([\d,]+)/i);
  var hostSvcMatch       = body.match(/Host service fee[:\s\(]+[\d.]+%\)?[:\s]+[-−]?₹?\s*([\d,]+)/i);
  var youEarnMatch       = body.match(/Total\s*\(INR\)[:\s]+₹?\s*([\d,]+)/i) ||
                           body.match(/You earn[:\s]+₹?\s*([\d,]+)/i);
  var guestSvcMatch      = body.match(/Guest service fee[:\s]+₹?\s*([\d,]+)/i);
  var guestPaidMatch     = body.match(/Guest paid[:\s]+₹?\s*([\d,]+)/i) ||
                           body.match(/Total\s*\(INR\)[:\s]+₹?\s*([\d,]+)/i);

  function parseAmount(match) {
    if (!match) return 0;
    return parseFloat(String(match[1]).replace(/,/g,'')) || 0;
  }

  // Adults count
  var adultsMatch = body.match(/(\d+)\s+guest/i);

  if (!checkIn) return null;

  return {
    confirmationCode: confCode || ('AB-' + Date.now()),
    guestName:        guestName,
    checkIn:          checkIn,
    checkOut:         checkOut || '',
    nights:           nights,
    adults:           adultsMatch ? parseInt(adultsMatch[1]) : 1,
    nightFee:         parseAmount(nightFeeMatch),
    cleaningFee:      parseAmount(cleaningFeeMatch),
    hostServiceFee:   parseAmount(hostSvcMatch),
    youEarn:          parseAmount(youEarnMatch),
    guestServiceFee:  parseAmount(guestSvcMatch),
    guestPaid:        parseAmount(guestPaidMatch),
  };
}

function parseFlexDate(str) {
  if (!str) return null;
  try {
    var d = new Date(str);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  } catch(e) {}
  return null;
}

function checkAirbnbConfExists(confCode) {
  if (!confCode) return false;
  var rows = sheetToObjects(SHEETS.STAYS);
  return rows.some(function(r) { return String(r.source || '') === confCode; });
}

// ── AIRBNB REVIEW PARSER ─────────────────────────────────────────────────
// Email: from:automated@airbnb.com subject:"<GuestName> left a 5-star review!"
// Stars appear in subject or body. Match to a stay within 14 days of checkout.

function pollAirbnbReviews() {
  var threads = GmailApp.search(
    'from:automated@airbnb.com subject:"left a" subject:"review" is:unread',
    0, 20
  );

  threads.forEach(function(thread) {
    var msg  = thread.getMessages()[0];
    var subj = msg.getSubject();
    var body = msg.getPlainBody();

    try {
      // Extract guest name and star rating from subject
      // e.g. "Vikram Ramasubramanian left a 5-star review!"
      var nameMatch  = subj.match(/^(.+?)\s+left a/i);
      var starMatch  = subj.match(/(\d)-star/i) || body.match(/(\d)-star/i) ||
                       body.match(/(\d)\s+out of\s+5/i);

      if (!nameMatch || !starMatch) { msg.markRead(); return; }

      var guestName = nameMatch[1].trim();
      var stars     = parseInt(starMatch[1]);
      var reviewDate = msg.getDate().toISOString().slice(0, 10);

      // Find matching stay: same guest, checkout within last 14 days
      var matchedStayId = findStayForReview(guestName, reviewDate, 'airbnb');
      if (!matchedStayId) {
        Logger.log('Review: no matching stay for ' + guestName + ' within 14 days');
        // Still log it — might match later when stay is created
        sendEmail('⭐ Review received (unmatched): ' + guestName,
          stars + ' stars · ' + reviewDate + '\nCould not match to a stay. Check manually.');
        msg.markRead();
        return;
      }

      // Update D1 via Worker
      callWorker('POST', 'saveReview', {
        stayId:       matchedStayId,
        rating:       stars,
        source:       'airbnb',
        reviewDate:   reviewDate,
        guestName:    guestName,
        createdBy:    'auto',
      });

      // Update Sheets
      updateStayField(matchedStayId, 'review', stars + '★');

      Logger.log('Airbnb review matched: ' + guestName + ' → ' + matchedStayId + ' (' + stars + '★)');
      sendEmail('⭐ ' + stars + '-star review: ' + guestName,
        'Stay ID: ' + matchedStayId + '\nDate: ' + reviewDate + '\nSource: Airbnb');
      msg.markRead();
    } catch(e) {
      Logger.log('Error processing review: ' + e.message);
    }
  });
}

// ── GOOGLE REVIEW PARSER ─────────────────────────────────────────────────
// Subject: "<GuestName> left a review for Dvaraka- Luxury Villas of Guruvayur"
// Google reviews don't include star rating in email — just notify and log as 'received'

function pollGoogleReviews() {
  var threads = GmailApp.search(
    'subject:"left a review for Dvaraka" is:unread',
    0, 20
  );

  threads.forEach(function(thread) {
    var msg  = thread.getMessages()[0];
    var subj = msg.getSubject();
    var body = msg.getPlainBody();

    try {
      var nameMatch = subj.match(/^(.+?)\s+left a review/i);
      if (!nameMatch) { msg.markRead(); return; }

      var guestName  = nameMatch[1].trim();
      var reviewDate = msg.getDate().toISOString().slice(0, 10);

      // Google review emails don't contain star count — extract from body if possible
      var starMatch = body.match(/(\d)\s*(?:out of 5|stars?|★)/i);
      var stars     = starMatch ? parseInt(starMatch[1]) : 0; // 0 = unknown

      var matchedStayId = findStayForReview(guestName, reviewDate, 'google');

      if (matchedStayId) {
        callWorker('POST', 'saveReview', {
          stayId:     matchedStayId,
          rating:     stars,
          source:     'google',
          reviewDate: reviewDate,
          guestName:  guestName,
          createdBy:  'auto',
        });
        updateStayField(matchedStayId, 'review', stars ? stars + '★ G' : 'G★');
      }

      sendEmail('🌟 Google review: ' + guestName,
        (stars ? stars + ' stars · ' : 'Stars unknown · ') + reviewDate +
        (matchedStayId ? '\nStay: ' + matchedStayId : '\nNo matching stay found — check manually.') +
        '\n\nCheck Google Business Profile for full review text.');
      msg.markRead();
    } catch(e) {
      Logger.log('Google review error: ' + e.message);
    }
  });
}

// Find a stay matching guestName with checkout within 14 days before reviewDate
function findStayForReview(guestName, reviewDate, source) {
  var reviewDt    = new Date(reviewDate);
  var windowStart = new Date(reviewDt); windowStart.setDate(windowStart.getDate() - 14);
  var guestLower  = guestName.toLowerCase().trim();

  // Check D1 via Worker first
  try {
    var resp = callWorker('GET', 'findStayForReview', {
      guestName:  guestName,
      reviewDate: reviewDate,
    });
    if (resp && resp.success && resp.data && resp.data.stayId) {
      return resp.data.stayId;
    }
  } catch(e) { Logger.log('Worker findStayForReview error: ' + e.message); }

  // Fallback: check Sheets
  var rows = sheetToObjects(SHEETS.STAYS);
  var match = null;
  rows.forEach(function(r) {
    if (match) return;
    var rName = String(r.guestName || r.bookerName || '').toLowerCase().trim();
    if (rName.indexOf(guestLower.split(' ')[0].toLowerCase()) < 0) return;
    var checkout = new Date(r.checkOut || r.checkout_date || '');
    if (isNaN(checkout)) return;
    if (checkout >= windowStart && checkout <= reviewDt) match = r.stayId;
  });
  return match;
}

// Helper: update a single field in the Stays sheet for a given stayId
function updateStayField(stayId, field, value) {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    var sheet = ss.getSheetByName(SHEETS.STAYS);
    var data  = sheet.getDataRange().getValues();
    var h     = data[0];
    var idIdx = h.indexOf('stayId');
    var fIdx  = h.indexOf(field);
    if (idIdx < 0 || fIdx < 0) return;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(stayId)) {
        sheet.getRange(i + 1, fIdx + 1).setValue(value);
        return;
      }
    }
  } catch(e) { Logger.log('updateStayField error: ' + e.message); }
}

// ============================================================
// PART 3: DRIVE FILE WATCHER — AUTO SET READY FOR CHECK-IN
// ============================================================
// Triggered every 10 minutes.
// Checks guest folders in the current month for:
//   - OnlineCheckIn-* file
//   - ID-* file
// When both exist, calls Worker to set status = ready_for_checkin

function pollDriveCheckIns() {
  var root         = DriveApp.getFolderById(CONFIG.driveRootId);
  var gf           = root.getFoldersByName('Guests');
  if (!gf.hasNext()) return;
  var guestsFolder = gf.next();

  var now    = new Date();
  var year   = String(now.getFullYear());
  var month  = now.getMonth();
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthLabel = String(month + 1).padStart(2, '0') + '-' + monthNames[month];

  // Navigate to current month folder
  var yf = guestsFolder.getFoldersByName(year);
  if (!yf.hasNext()) return;
  var yearFolder = yf.next();
  var mf = yearFolder.getFoldersByName(monthLabel);
  if (!mf.hasNext()) return;
  var monthFolder = mf.next();

  // Check each guest folder
  var folders = monthFolder.getFolders();
  while (folders.hasNext()) {
    var folder = folders.next();
    var name   = folder.getName(); // GuestName-DD-StayID

    // Extract StayID (last segment after last dash-group)
    var parts  = name.split('-');
    if (parts.length < 3) continue;
    var stayId = parts.slice(-2).join('-'); // e.g. DWK-AB123

    try {
      var hasCheckIn = false;
      var hasId      = false;
      var files = folder.getFiles();
      while (files.hasNext()) {
        var fname = files.next().getName();
        if (fname.match(/^OnlineCheckIn[-_]/i)) hasCheckIn = true;
        if (fname.match(/^ID[-_]/i))            hasId      = true;
      }

      if (hasCheckIn && hasId) {
        // Both docs present — mark ready for check-in if not already
        var resp = callWorker('POST', 'setReadyForCheckIn', {
          stayId:    stayId,
          createdBy: 'auto',
        });
        if (resp && resp.success && resp.data && resp.data.changed) {
          Logger.log('Auto ready_for_checkin: ' + stayId);
          sendEmail('🔑 Guest ready for check-in: ' + name,
            'Stay ID: ' + stayId +
            '\nBoth OnlineCheckIn and ID documents found in Drive.' +
            '\nRaman has been notified on his Check-in screen.');
        }
      }
    } catch(e) {
      Logger.log('pollDriveCheckIns folder error (' + name + '): ' + e.message);
    }
  }
}

// ============================================================
// PART 4: WORKER HELPER
// ============================================================
function callWorker(method, action, payload) {
  try {
    var url  = WORKER_URL + '/' + action;
    var opts = {
      method:            method.toLowerCase(),
      headers:           { 'Content-Type': 'application/json', 'X-Actor': 'auto' },
      muteHttpExceptions: true,
    };
    if (method === 'GET' && payload) {
      var qs = Object.keys(payload).map(function(k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(payload[k]);
      }).join('&');
      url += '?' + qs;
    } else if (method === 'POST') {
      opts.payload = JSON.stringify(payload);
    }
    var resp = UrlFetchApp.fetch(url, opts);
    return JSON.parse(resp.getContentText());
  } catch(e) {
    Logger.log('callWorker error (' + action + '): ' + e.message);
    return null;
  }
}

// ============================================================
// PART 5: TRIGGER SETUP (run once manually)
// ============================================================
function setupTriggers() {
  // Remove existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (['pollGmail','pollDriveCheckIns'].indexOf(t.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Gmail poller: every 5 minutes
  ScriptApp.newTrigger('pollGmail')
    .timeBased()
    .everyMinutes(5)
    .create();

  // Drive file watcher: every 10 minutes
  ScriptApp.newTrigger('pollDriveCheckIns')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('Triggers set up successfully.');
}

// ============================================================
// EXISTING FUNCTION UPDATES
// ============================================================
// In your existing confirmCheckIn() and createBooking() functions,
// change the folder creation line from:
//   var folder = getOrCreateGuestFolder(guestName, stayId);
// to:
//   var folder = getOrCreateGuestFolder(guestName, stayId, data.checkInDate || data.checkIn);
