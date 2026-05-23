// ============================================================
// BG INDIA PORTAL — APPS SCRIPT ADDITIONS
// APPEND this entire file to the bottom of your existing
// Apps Script (V20). Do NOT delete the existing code.
//
// After pasting:
//   1. Run setupTriggers() once manually
//   2. Redeploy: Deployments → Manage → New version → Deploy
// ============================================================

var WORKER_URL = 'https://manage.luxuryvillasofguruvayur.com/api';

// ============================================================
// PART 1: UPDATED DRIVE FOLDER STRUCTURE
// ============================================================
// New structure: Guests/YYYY/MM-MonthName/GuestName-DD-StayID
// Example:       Guests/2026/05-May/Vikram Ramasubramanian-17-DWK-AB123
//
// This REPLACES your existing getOrCreateGuestFolder() function.
// After pasting, your old getOrCreateGuestFolder() will be
// overridden by this one (JavaScript uses the last definition).
//
// ALSO update the two calls in confirmCheckIn() and createBooking():
//   FIND:    var folder = getOrCreateGuestFolder(guestName, stayId);
//   REPLACE: var folder = getOrCreateGuestFolder(guestName, stayId, data.checkInDate || data.checkIn);

function getOrCreateGuestFolder(guestName, stayId, checkInDate) {
  var root = DriveApp.getFolderById(CONFIG.driveRootId);

  // Get or create Guests root
  var gf = root.getFoldersByName('Guests');
  var guestsFolder = gf.hasNext() ? gf.next() : root.createFolder('Guests');

  // Parse check-in date for year/month/day
  var d = checkInDate ? new Date(checkInDate) : new Date();
  if (isNaN(d)) d = new Date();
  var year  = String(d.getFullYear());
  var month = d.getMonth();
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthLabel = String(month + 1).padStart(2, '0') + '-' + monthNames[month];
  var day = String(d.getDate()).padStart(2, '0');

  // Year folder
  var yf = guestsFolder.getFoldersByName(year);
  var yearFolder = yf.hasNext() ? yf.next() : guestsFolder.createFolder(year);

  // Month folder
  var mf = yearFolder.getFoldersByName(monthLabel);
  var monthFolder = mf.hasNext() ? mf.next() : yearFolder.createFolder(monthLabel);

  // Guest folder: GuestName-DD-StayID
  var folderName = (guestName || 'Guest') + '-' + day + '-' + stayId;
  var ef = monthFolder.getFoldersByName(folderName);
  if (ef.hasNext()) return ef.next();
  var newFolder = monthFolder.createFolder(folderName);

  // Store folder URL back to D1 via Worker
  try {
    callWorker('POST', 'updateDriveFolder', {
      stayId:         stayId,
      driveFolderId:  newFolder.getId(),
      driveFolderUrl: newFolder.getUrl(),
    });
  } catch(e) { Logger.log('updateDriveFolder Worker call failed: ' + e.message); }

  return newFolder;
}

// ============================================================
// PART 2: GOOGLE FORM SUBMIT TRIGGER
// ============================================================
// This fires whenever a guest submits the online check-in form.
// It finds the matching open stay, renames and moves the uploaded
// files (ID card, registration form) into the correct guest folder.
//
// Set up: Triggers → Add Trigger → onGuestFormSubmit → From spreadsheet
//         → On form submit (on the GUEST FORM spreadsheet)

function onGuestFormSubmit(e) {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.guestFormSheetId);
    var sheet = ss.getSheets()[0];
    var data  = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    var headers   = data[0];
    var lastRow   = data[data.length - 1];
    var lcHeaders = headers.map(function(h) { return String(h).toLowerCase().trim(); });

    // Extract key fields from the submission
    function getField(keyword) {
      var idx = lcHeaders.findIndex(function(h) { return h.includes(keyword); });
      return idx >= 0 ? String(lastRow[idx] || '').trim() : '';
    }

    var bookerName  = getField('bookers full name') || getField('booker');
    var checkInDate = getField('check in date');
    var checkOutDate= getField('check out date');
    var email       = getField('email address');
    var phone       = getField('phone number');

    if (!bookerName) {
      Logger.log('onGuestFormSubmit: no booker name found');
      return;
    }

    // Find matching open stay in D1
    var matchResp = callWorker('GET', 'findOpenStay', {
      guestName:   bookerName,
      checkInDate: checkInDate,
    });

    var stayId      = null;
    var guestFolder = null;

    if (matchResp && matchResp.success && matchResp.data && matchResp.data.stayId) {
      stayId = matchResp.data.stayId;
      var folderId = matchResp.data.driveFolderId;

      if (folderId) {
        try { guestFolder = DriveApp.getFolderById(folderId); }
        catch(e) { Logger.log('Could not open folder ' + folderId + ': ' + e.message); }
      }

      // If no folder yet, create it
      if (!guestFolder) {
        guestFolder = getOrCreateGuestFolder(bookerName, stayId, checkInDate);
      }
    } else {
      // No matching stay found — create folder anyway and notify owner
      Logger.log('onGuestFormSubmit: no matching stay for ' + bookerName + ' on ' + checkInDate);
      sendEmail('⚠️ Check-in form: no matching stay',
        'Guest: ' + bookerName + '\nCheck-in: ' + checkInDate +
        '\nNo open stay found in D1. Please create a booking first, ' +
        'then the documents will need to be moved manually.');
      return;
    }

    // Move uploaded files from form responses to guest folder
    // Google Forms puts file uploads into a folder in Drive automatically
    // We find them by looking at URLs in the form response row
    var movedCount = 0;
    lastRow.forEach(function(cell, i) {
      var val = String(cell || '');
      // Form file upload columns contain Drive URLs
      if (!val.startsWith('https://drive.google.com')) return;

      var fileIdMatch = val.match(/id=([a-zA-Z0-9_-]+)/) ||
                        val.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (!fileIdMatch) return;

      var fileId = fileIdMatch[1];
      try {
        var file = DriveApp.getFileById(fileId);
        var colLabel = String(headers[i] || '').toLowerCase();

        // Rename based on column type
        var newName;
        if (colLabel.includes('id') || colLabel.includes('aadhaar') ||
            colLabel.includes('passport') || colLabel.includes('identity')) {
          newName = 'ID-' + stayId + '-' + bookerName.split(' ')[0] + getFileExtension(file.getName());
        } else {
          newName = 'OnlineCheckIn-' + stayId + '-' + bookerName.split(' ')[0] + getFileExtension(file.getName());
        }

        file.setName(newName);

        // Move to guest folder
        var parents = file.getParents();
        while (parents.hasNext()) { file.removeFromFolder(parents.next()); }
        file.addToFolder(guestFolder);
        movedCount++;
        Logger.log('Moved: ' + newName + ' → ' + guestFolder.getName());
      } catch(e) {
        Logger.log('File move error: ' + e.message);
      }
    });

    // Update stay status to docs_uploaded in D1
    callWorker('POST', 'updateStayStatus', {
      stayId:    stayId,
      status:    'docs_uploaded',
      createdBy: 'auto',
    });

    sendEmail('📋 Check-in form received: ' + bookerName,
      'Stay ID: ' + stayId +
      '\nCheck-in: ' + checkInDate + ' → ' + checkOutDate +
      '\nEmail: ' + email + ' · Phone: ' + phone +
      '\nFiles moved to guest folder: ' + movedCount +
      '\nStatus set to: docs_uploaded' +
      '\n\nReview and click "Mark ready for check-in" in Complete Booking screen.');

  } catch(e) {
    sendErrorEmail('onGuestFormSubmit', e, '');
  }
}

function getFileExtension(filename) {
  var parts = String(filename || '').split('.');
  return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
}

// ============================================================
// PART 3: GMAIL POLLER — AIRBNB BOOKINGS + REVIEWS
// ============================================================
// Runs every 5 minutes via time-based trigger.

function pollGmail() {
  try { pollAirbnbBookings(); } catch(e) { Logger.log('pollAirbnbBookings: ' + e.message); }
  try { pollAirbnbReviews();  } catch(e) { Logger.log('pollAirbnbReviews: '  + e.message); }
  try { pollGoogleReviews();  } catch(e) { Logger.log('pollGoogleReviews: '  + e.message); }
}

// ── AIRBNB BOOKING CONFIRMATION ───────────────────────────────────────────
function pollAirbnbBookings() {
  var threads = GmailApp.search(
    'from:automated@airbnb.com (subject:"Reservation confirmed" OR subject:"New reservation") is:unread',
    0, 10
  );

  threads.forEach(function(thread) {
    var msg  = thread.getMessages()[0];
    var subj = msg.getSubject();
    var body = msg.getPlainBody();

    try {
      var booking = parseAirbnbConfirmation(body, subj);
      if (!booking) {
        Logger.log('Could not parse Airbnb email: ' + subj);
        return;
      }

      // Skip if already imported (check by Airbnb confirmation code in source field)
      if (checkAirbnbConfExists(booking.confirmationCode)) {
        Logger.log('Already imported: ' + booking.confirmationCode);
        msg.markRead();
        return;
      }

      // Create booking in D1 via Worker
      var resp = callWorker('POST', 'createBooking', {
        villaId:         'dwarka',
        source:          'airbnb',
        guestName:       booking.guestName,
        checkInDate:     booking.checkIn,
        checkOutDate:    booking.checkOut,
        nights:          booking.nights,
        adults:          booking.adults || 1,
        gross:           (booking.nightFee || 0) + (booking.cleaningFee || 0),
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
      });

      if (resp && resp.success) {
        var stayId    = resp.data.stayId;
        var folderUrl = resp.data.folderUrl || '';
        Logger.log('Airbnb booking created: ' + booking.confirmationCode + ' → ' + stayId);
        msg.markRead();

        // Backup to Sheets
        appendRow(SHEETS.STAYS, STAYS_HEADERS, buildStayRow({
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
        }, folderUrl));

        sendEmail(
          '✈️ Airbnb booking auto-imported: ' + booking.guestName,
          'Confirmation: '  + booking.confirmationCode +
          '\nStay ID: '     + stayId +
          '\nGuest: '       + booking.guestName +
          '\nCheck-in: '    + booking.checkIn +
          '\nCheck-out: '   + booking.checkOut +
          '\nNights: '      + booking.nights +
          '\nNight fee: ₹'  + (booking.nightFee || 0) +
          '\nCleaning fee: ₹' + (booking.cleaningFee || 0) +
          '\nHost service fee: -₹' + (booking.hostServiceFee || 0) +
          '\nYou earn: ₹'   + (booking.youEarn || 0) +
          '\nGuest paid: ₹' + (booking.guestPaid || 0) +
          '\n\nGo to Complete Booking screen to review and confirm details.'
        );
      } else {
        Logger.log('Worker createBooking failed: ' + JSON.stringify(resp));
      }
    } catch(e) {
      Logger.log('Airbnb booking error: ' + e.message);
      sendErrorEmail('pollAirbnbBookings', e, subj);
    }
  });
}

function parseAirbnbConfirmation(body, subject) {
  // Confirmation code — Airbnb uses HMXXXXXXXX format
  var confMatch = body.match(/\b(HM[A-Z0-9]{6,12})\b/) ||
                  body.match(/Confirmation code[:\s]+([A-Z0-9]{8,12})/i);
  var confCode  = confMatch ? confMatch[1] : ('AB-' + Date.now());

  // Guest name from subject: "FirstName LastName has reserved" or "New reservation from Name"
  var nameMatch = subject.match(/^([A-Za-z\s\-]+?)\s+(?:has reserved|left a)/i) ||
                  body.match(/Guest name[:\s]+(.+)/i) ||
                  subject.match(/from\s+([A-Za-z\s]+)/i);
  var guestName = nameMatch ? nameMatch[1].trim() : 'Airbnb Guest';

  // Dates — try multiple formats
  var checkIn  = extractAirbnbDate(body, 'Check-in');
  var checkOut = extractAirbnbDate(body, 'Check-out') || extractAirbnbDate(body, 'Checkout');

  // Nights
  var nightsMatch = body.match(/(\d+)\s+night/i);
  var nights = nightsMatch ? parseInt(nightsMatch[1]) : 0;
  if (!nights && checkIn && checkOut) {
    nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  }

  // Fee amounts — handle ₹, commas, various formats
  function extractAmount(pattern) {
    var m = body.match(pattern);
    if (!m) return 0;
    return parseFloat(String(m[1]).replace(/[,₹\s]/g, '')) || 0;
  }

  var nightFee      = extractAmount(/(\d[\d,]+)\s*(?:×\s*\d+\s*night|x\s*\d+\s*night)/i) ||
                      extractAmount(/Night fee[:\s]+₹?\s*([\d,]+)/i);
  var cleaningFee   = extractAmount(/Cleaning fee[:\s]+₹?\s*([\d,]+)/i);
  var hostSvcFee    = extractAmount(/Host service fee[^:]*:[:\s]+[-−]?₹?\s*([\d,]+)/i);
  var youEarn       = extractAmount(/Total\s*\(INR\)[:\s]+₹?\s*([\d,]+)/i) ||
                      extractAmount(/You earn[:\s]+₹?\s*([\d,]+)/i);
  var guestSvcFee   = extractAmount(/Guest service fee[:\s]+₹?\s*([\d,]+)/i);
  var guestPaid     = extractAmount(/Guest paid[:\s]+₹?\s*([\d,]+)/i);
  var adultsMatch   = body.match(/(\d+)\s+guest/i);

  if (!checkIn) return null; // Cannot create booking without a date

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

function extractAirbnbDate(body, label) {
  // Try: "Check-in: Thursday, May 22, 2026" or "Check-in: 2026-05-22"
  var pattern1 = new RegExp(label + '[:\\s]+([A-Za-z]+,?\\s+[A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4})', 'i');
  var pattern2 = new RegExp(label + '[:\\s]+(\\d{4}-\\d{2}-\\d{2})', 'i');
  var m = body.match(pattern1) || body.match(pattern2);
  if (!m) return null;
  try {
    var d = new Date(m[1]);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  } catch(e) { return null; }
}

function checkAirbnbConfExists(confCode) {
  if (!confCode || confCode.startsWith('AB-')) return false;
  var rows = sheetToObjects(SHEETS.STAYS);
  return rows.some(function(r) {
    return String(r.source || '').trim() === String(confCode).trim();
  });
}

// ── AIRBNB REVIEWS ────────────────────────────────────────────────────────
// Subject: "<GuestName> left a 5-star review!"
// From:     automated@airbnb.com

function pollAirbnbReviews() {
  var after2 = new Date();
  after2.setDate(after2.getDate() - 30);
  var dateFilter2 = 'after:' + after2.toISOString().slice(0,10).replace(/-/g,'/');
  var threads = GmailApp.search(
    'from:automated@airbnb.com subject:"left a" subject:"review" is:unread ' + dateFilter2,
    0, 20
  );

  threads.forEach(function(thread) {
    var msg  = thread.getMessages()[0];
    var subj = msg.getSubject();
    var body = msg.getPlainBody();

    try {
      var nameMatch = subj.match(/^(.+?)\s+left a/i);
      var starMatch = subj.match(/(\d)-star/i) || body.match(/(\d)-star/i);
      if (!nameMatch || !starMatch) { msg.markRead(); return; }

      var guestName  = nameMatch[1].trim();
      var stars      = parseInt(starMatch[1]);
      var reviewDate = msg.getDate().toISOString().slice(0, 10);

      // Find matching stay via Worker (guest checkout within 14 days)
      var matchResp = callWorker('GET', 'findStayForReview', {
        guestName:  guestName,
        reviewDate: reviewDate,
      });

      var matchedStayId = (matchResp && matchResp.success && matchResp.data)
        ? matchResp.data.stayId : null;

      // Fallback: check Sheets
      if (!matchedStayId) matchedStayId = findStayForReviewInSheets(guestName, reviewDate);

      if (matchedStayId) {
        callWorker('POST', 'saveReview', {
          stayId:     matchedStayId,
          rating:     stars,
          source:     'airbnb',
          reviewDate: reviewDate,
          guestName:  guestName,
          createdBy:  'auto',
        });
        updateStayField(matchedStayId, 'review', stars + '★ Airbnb');
        Logger.log('Review saved: ' + guestName + ' → ' + matchedStayId + ' (' + stars + '★)');
      }

      sendEmail(
        '⭐ ' + stars + '-star Airbnb review: ' + guestName,
        (matchedStayId ? 'Stay: ' + matchedStayId : '⚠️ No matching stay found — check manually') +
        '\nDate: ' + reviewDate
      );
      msg.markRead();
    } catch(e) { Logger.log('pollAirbnbReviews error: ' + e.message); }
  });
}

// ── GOOGLE REVIEWS ────────────────────────────────────────────────────────
// Subject: "<GuestName> left a review for Dvaraka- Luxury Villas of Guruvayur"

function pollGoogleReviews() {
  // Only process emails from the last 30 days to avoid re-processing old reviews
  var after = new Date();
  after.setDate(after.getDate() - 30);
  var dateFilter = 'after:' + after.toISOString().slice(0,10).replace(/-/g,'/');
  var threads = GmailApp.search(
    'subject:"left a review for Dvaraka" is:unread ' + dateFilter,
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
      // Google emails rarely include star count — try to extract from body
      var starMatch  = body.match(/(\d)\s*(?:out of 5|stars?)/i);
      var stars      = starMatch ? parseInt(starMatch[1]) : 0;

      var matchResp     = callWorker('GET', 'findStayForReview', { guestName: guestName, reviewDate: reviewDate });
      var matchedStayId = (matchResp && matchResp.success && matchResp.data) ? matchResp.data.stayId : null;
      if (!matchedStayId) matchedStayId = findStayForReviewInSheets(guestName, reviewDate);

      if (matchedStayId) {
        callWorker('POST', 'saveReview', {
          stayId: matchedStayId, rating: stars, source: 'google',
          reviewDate: reviewDate, guestName: guestName, createdBy: 'auto',
        });
        updateStayField(matchedStayId, 'review', (stars ? stars + '★ ' : '') + 'Google');
      }

      sendEmail(
        '🌟 Google review: ' + guestName,
        (stars ? stars + ' stars · ' : 'Rating unknown · ') + reviewDate +
        (matchedStayId ? '\nStay: ' + matchedStayId : '\n⚠️ No matching stay — check manually') +
        '\n\nCheck Google Business Profile for full review text.'
      );
      msg.markRead();
    } catch(e) { Logger.log('pollGoogleReviews error: ' + e.message); }
  });
}

// Fallback review matching in Sheets (when Worker not available)
function findStayForReviewInSheets(guestName, reviewDate) {
  var reviewDt    = new Date(reviewDate);
  var windowStart = new Date(reviewDt);
  windowStart.setDate(windowStart.getDate() - 14);
  var first = guestName.split(' ')[0].toLowerCase();

  var rows = sheetToObjects(SHEETS.STAYS);
  var match = null;
  rows.forEach(function(r) {
    if (match) return;
    var rName = String(r.guestName || r.bookerName || '').toLowerCase();
    if (rName.indexOf(first) < 0) return;
    var checkout = new Date(r.checkOut || '');
    if (isNaN(checkout)) return;
    if (checkout >= windowStart && checkout <= reviewDt) match = r.stayId;
  });
  return match;
}

// ============================================================
// PART 4: DRIVE FILE WATCHER
// ============================================================
// Runs every 10 minutes. Only checks folders for stays that
// are currently open (booked/confirmed/docs_uploaded).
// When both OnlineCheckIn-* and ID-* files are present,
// auto-sets status = ready_for_checkin.

function pollDriveCheckIns() {
  // Get open stays from Worker (not yet at ready_for_checkin or beyond)
  var resp = callWorker('GET', 'getOpenStays', {});
  if (!resp || !resp.success || !resp.data || !resp.data.length) {
    Logger.log('pollDriveCheckIns: no open stays or Worker unavailable');
    return;
  }

  var openStays = resp.data; // [{stayId, guestName, checkinDate, driveFolderId, status}]

  openStays.forEach(function(stay) {
    if (!stay.driveFolderId) return; // no folder yet — skip

    try {
      var folder = DriveApp.getFolderById(stay.driveFolderId);
      var hasCheckIn = false;
      var hasId      = false;

      var files = folder.getFiles();
      while (files.hasNext()) {
        var fname = files.next().getName();
        if (fname.match(/^OnlineCheckIn[-_]/i)) hasCheckIn = true;
        if (fname.match(/^ID[-_]/i))            hasId      = true;
      }

      if (hasCheckIn && hasId) {
        // Both docs present — transition to ready_for_checkin
        var setResp = callWorker('POST', 'setReadyForCheckIn', {
          stayId:    stay.stayId,
          createdBy: 'auto',
        });
        if (setResp && setResp.success && setResp.data && setResp.data.changed) {
          Logger.log('Auto ready_for_checkin: ' + stay.stayId + ' (' + stay.guestName + ')');
          sendEmail(
            '🔑 Guest ready for check-in: ' + stay.guestName,
            'Stay ID: '   + stay.stayId +
            '\nCheck-in: ' + stay.checkinDate +
            '\nBoth OnlineCheckIn and ID documents found in Drive.' +
            '\nStatus automatically set to: ready_for_checkin' +
            '\nRaman can now see this guest on his Check-in screen.'
          );
        }
      }
    } catch(e) {
      Logger.log('pollDriveCheckIns error for ' + stay.stayId + ': ' + e.message);
    }
  });
}

// ============================================================
// PART 5: WORKER HELPER
// ============================================================
function callWorker(method, action, payload) {
  try {
    var url  = WORKER_URL + '/' + action;
    var opts = {
      method:             method.toLowerCase(),
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getSystemToken() },
      muteHttpExceptions: true,
    };
    if (method === 'GET' && payload && Object.keys(payload).length > 0) {
      var qs = Object.keys(payload).map(function(k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(payload[k]);
      }).join('&');
      url += '?' + qs;
    }
    if (method === 'POST') {
      opts.payload = JSON.stringify(payload || {});
    }
    var resp = UrlFetchApp.fetch(url, opts);
    return JSON.parse(resp.getContentText());
  } catch(e) {
    Logger.log('callWorker (' + action + ') error: ' + e.message);
    return null;
  }
}

// Helper — update a single field in Stays sheet
function updateStayField(stayId, field, value) {
  try {
    var sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(SHEETS.STAYS);
    var data  = sheet.getDataRange().getValues();
    var h = data[0];
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
// PART 6: TRIGGER SETUP — run this function once manually
// ============================================================
function setupTriggers() {
  // Remove existing poller triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (['pollGmail', 'pollDriveCheckIns'].indexOf(fn) >= 0) {
      ScriptApp.deleteTrigger(t);
      Logger.log('Removed existing trigger: ' + fn);
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

  Logger.log('✅ Triggers set up: pollGmail (5min) + pollDriveCheckIns (10min)');
  Logger.log('Also set up onFormSubmit manually: Triggers → Add Trigger → onGuestFormSubmit → From spreadsheet → On form submit');
}

// ============================================================
// ONE-TIME UTILITY — run once manually to mark all old review
// emails as read so the poller doesn't re-process them.
// After running, delete or ignore this function.
// ============================================================
function markOldReviewEmailsRead() {
  var count = 0;

  // Mark old Google review emails as read
  var gThreads = GmailApp.search('subject:"left a review for Dvaraka"', 0, 500);
  gThreads.forEach(function(t) { t.markRead(); count++; });

  // Mark old Airbnb review emails as read
  var aThreads = GmailApp.search('from:automated@airbnb.com subject:"left a" subject:"review"', 0, 500);
  aThreads.forEach(function(t) { t.markRead(); count++; });

  Logger.log('Marked ' + count + ' review email threads as read.');
}
