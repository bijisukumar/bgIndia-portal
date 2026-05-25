// ============================================================
// GUEST CHECK-IN FORM — BOUND SCRIPT
// ============================================================
// Paste this into the Apps Script editor of:
//   "GVR Registration-Check-In form (Responses)"
//   https://docs.google.com/spreadsheets/d/1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0
//
// Replace ALL existing code in that editor with this file.
//
// Setup (one time):
//   1. Paste this file into the script editor
//   2. Save (Ctrl+S)
//   3. Triggers → Add Trigger:
//        Function:     onGuestFormSubmit
//        Deployment:   Head
//        Event source: From spreadsheet
//        Event type:   On form submit
//   4. Authorise when prompted
// ============================================================

var WORKER_URL  = 'https://manage.luxuryvillasofguruvayur.com/api';
var OWNER_EMAIL = 'kerala.luxuryvillas@gmail.com';
var DRIVE_ROOT  = '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva';

// ── MAIN TRIGGER — fires on every form submission ─────────────────────────
function onGuestFormSubmit(e) {
  try {
    var sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    var lastRow = data[data.length - 1];
    var lc      = headers.map(function(h) { return String(h).toLowerCase().trim(); });

    function get(keyword) {
      for (var i = 0; i < lc.length; i++) {
        if (lc[i].indexOf(keyword) >= 0) return String(lastRow[i] || '').trim();
      }
      return '';
    }

    var bookerName   = get('bookers full name') || get('booker') || get('full name');
    var checkInDate  = normaliseDate(get('check in date')  || get('check-in'));
    var checkOutDate = normaliseDate(get('check out date') || get('check-out'));
    var email        = get('email address') || get('email');
    var phone        = get('phone number')  || get('phone');
    var adults       = get('guest count(adults)') || get('adults');
    var children     = get('guest count(children)') || get('children');
    var citizenship  = get('citizenship');
    var eta          = get('estimated time') || get('eta');
    var purpose      = get('purpose of stay') || get('purpose');
    var guestList    = get('list all guest') || get('guest names');
    var homeAddress  = get('full home address') || get('address');

    // Try structured fields first (new form layout)
    // If form has separate City/State/Country/Pincode fields, use them directly
    var city     = get('city')    || '';
    var state    = get('state')   || '';
    var country  = get('country') || '';
    var pincode  = get('pincode') || get('pin code') || get('postal code') || '';
    var fromCity = city;

    // Fallback: parse from full home address if structured fields not filled
    if (!city && homeAddress) {
      var parts = homeAddress.split(',').map(function(p) { return p.trim(); });
      // Extract pincode
      var pinMatch = homeAddress.match(/\b(\d{6})\b/);
      if (pinMatch && !pincode) pincode = pinMatch[1];

      if (parts.length >= 3) {
        var last       = parts[parts.length - 1].replace(/\d+/g, '').trim();
        var secondLast = parts[parts.length - 2].trim();
        var thirdLast  = parts[parts.length - 3].trim();
        var knownCountries = ['USA','UK','United States','United Kingdom',
          'Australia','Canada','UAE','Singapore','Germany','France','Malaysia',
          'New Zealand','Netherlands','Bahrain','Qatar','Oman','Kuwait'];
        var isCountry = knownCountries.some(function(cn) {
          return last.toLowerCase().indexOf(cn.toLowerCase()) >= 0;
        });
        if (isCountry) {
          country = last; state = secondLast; fromCity = thirdLast; city = thirdLast;
        } else {
          country = 'India';
          state   = last.replace(/[-–].*/,'').trim();
          fromCity = secondLast; city = secondLast;
        }
      } else if (parts.length === 2) {
        fromCity = parts[0]; city = parts[0]; state = parts[1];
        if (!country) country = 'India';
      } else if (parts.length === 1) {
        fromCity = parts[0]; city = parts[0];
        if (!country) country = 'India';
      }
    }
    if (!country) country = 'India';

    Logger.log('Form submit: booker=' + bookerName + '  checkIn=' + checkInDate);

    if (!bookerName) {
      sendAlert('⚠️ Form submitted — booker name missing',
        'Could not find booker name in the latest form response.\n' +
        'Please check the response sheet manually.\n' +
        'Headers: ' + headers.join(' | '));
      return;
    }

    // ── Match to an open stay in D1 ──────────────────────────────────────
    var matchResp = callWorker('GET', 'findOpenStay', {
      guestName:   bookerName,
      checkInDate: checkInDate,
    });

    var stayId      = null;
    var guestFolder = null;

    if (matchResp && matchResp.success && matchResp.data && matchResp.data.stayId) {
      stayId = matchResp.data.stayId;
      Logger.log('Matched stay: ' + stayId);

      if (matchResp.data.driveFolderId) {
        try { guestFolder = DriveApp.getFolderById(matchResp.data.driveFolderId); }
        catch(ex) { Logger.log('Could not open folder by ID: ' + ex.message); }
      }
      if (!guestFolder) {
        guestFolder = getOrCreateGuestFolder(bookerName, stayId, checkInDate);
      }
    } else {
      // ── FALLBACK: no matching booking — auto-create provisional ──────────
      Logger.log('No open stay found for: ' + bookerName + ' — creating provisional booking');

      var provResp = callWorker('POST', 'createProvisionalBooking', {
        guestName:   bookerName,
        checkInDate: checkInDate,
        checkOutDate: checkOutDate,
        guestEmail:  email,
        guestPhone:  phone,
        villaId:     'dwarka',
        source:      'guest_form',
      });

      if (!provResp || !provResp.success) {
        sendAlert('🚨 Failed to auto-create provisional booking',
          'Guest: ' + bookerName +
          '\nCheck-in: ' + checkInDate +
          '\nError: ' + JSON.stringify(provResp));
        return;
      }

      stayId = provResp.data.stayId;
      Logger.log('Provisional booking created: ' + stayId);

      // Create Drive folder for provisional booking
      guestFolder = getOrCreateGuestFolder(bookerName, stayId, checkInDate);

      // Create provisional info TXT in folder
      try {
        var nights = checkInDate && checkOutDate
          ? Math.max(1, Math.round((new Date(checkOutDate) - new Date(checkInDate)) / 86400000))
          : 1;
        var txtLines = [
          'Villa: Guruvayur Villa (Dwarka)',
          'Guest: ' + bookerName,
          'Check-in: ' + checkInDate,
          'Phone: ' + phone,
          'Email: ' + email,
          'Nights: ' + nights,
          'Status: Provisional — pending owner review',
        ];
        guestFolder.createFile('Provisional-' + stayId + '.txt', txtLines.join('\n'), 'text/plain');
      } catch(txtErr) { Logger.log('TXT create error: ' + txtErr.message); }

      // Notify owner — provisional booking created, needs review
      sendAlert('🔶 Provisional booking auto-created — pending review',
        'Guest submitted check-in form but NO matching booking was found.' +
        '\n\nA provisional booking has been auto-created:' +
        '\n  Stay ID:   ' + stayId +
        '\n  Guest:     ' + bookerName +
        '\n  Check-in:  ' + checkInDate +
        '\n  Check-out: ' + checkOutDate +
        '\n  Email:     ' + email +
        '\n  Phone:     ' + phone +
        '\n\nDrive folder: ' + guestFolder.getUrl() +
        '\n\n👉 Open the portal → Owner Home → approve or edit before Raman can check in.');
    }

    // ── Rename and move uploaded files ───────────────────────────────────
    // Google Forms saves file uploads to Drive automatically.
    // Each upload appears as a Drive URL in the response row.
    var moved = { checkin: 0, id: 0 };

    lastRow.forEach(function(cell, i) {
      var val = String(cell || '');
      if (val.indexOf('drive.google.com') < 0) return;

      var fileIdMatch = val.match(/id=([a-zA-Z0-9_-]+)/) ||
                        val.match(/\/d\/([a-zA-Z0-9_-]+)\//);
      if (!fileIdMatch) return;

      try {
        var file    = DriveApp.getFileById(fileIdMatch[1]);
        var col     = String(headers[i] || '').toLowerCase();
        var ext     = getExtension(file.getName());
        var newName;

        var isIdDoc = col.indexOf('aadhaar') >= 0 || col.indexOf('adhar') >= 0 ||
                      col.indexOf('passport') >= 0 || col.indexOf('govt') >= 0 ||
                      col.indexOf('foreign id') >= 0 ||
                      (col.indexOf('upload') >= 0 && col.indexOf('id') >= 0);

        if (isIdDoc) {
          newName = 'ID-' + stayId + '-' + firstName(bookerName) + ext;
          moved.id++;
        } else {
          newName = 'OnlineCheckIn-' + stayId + '-' + firstName(bookerName) + ext;
          moved.checkin++;
        }

        file.setName(newName);

        var parents = file.getParents();
        while (parents.hasNext()) {
          try { parents.next().removeFile(file); } catch(ex) {}
        }
        guestFolder.addFile(file);
        Logger.log('Moved: ' + newName + ' → ' + guestFolder.getName());
      } catch(ex) {
        Logger.log('File move error col ' + i + ': ' + ex.message);
      }
    });

    // ── Set status to docs_uploaded in D1 ────────────────────────────────
    // Also update location fields on the stay
    callWorker('POST', 'updateStayLocation', {
      stayId:      stayId,
      homeAddress: homeAddress,
      city:        city,
      state:       state,
      country:     country,
      fromCity:    fromCity,
      pincode:     pincode,
      phone:       phone,
      email:       email,
    });

    // Create OnlineCheckIn marker file so Drive watcher triggers ready_for_checkin
    try {
      var markerName = 'OnlineCheckIn-' + stayId + '-' + firstName(bookerName) + '.txt';
      var lines = [
        'Guest Registration Form Submitted',
        'Stay ID:     ' + stayId,
        'Guest:       ' + bookerName,
        'Check-in:    ' + checkInDate + ' to ' + checkOutDate,
        'Submitted:   ' + new Date().toISOString(),
        'Adults:      ' + adults + (children ? ' | Children: ' + children : ''),
        'Citizenship: ' + citizenship,
        'ETA:         ' + eta,
        'Purpose:     ' + purpose,
        'Location:    ' + city + (state?', '+state:'') + (country?', '+country:''),
        'Pincode:     ' + pincode,
        'Email:       ' + email,
        'Phone:       ' + phone,
      ];
      guestFolder.createFile(markerName, lines.join('\n'), 'text/plain');
      Logger.log('Created: ' + markerName);
    } catch(me) { Logger.log('Marker error: ' + me.message); }

    callWorker('POST', 'updateStayStatus', {
      stayId:    stayId,
      status:    'docs_uploaded',
      createdBy: 'auto',
    });

    // ── Notify owner ─────────────────────────────────────────────────────
    sendAlert(
      '📋 Check-in form received: ' + bookerName,
      'Stay ID: '      + stayId +
      '\nCheck-in: '   + checkInDate + ' → ' + checkOutDate +
      '\nEmail: '      + email +
      '\nPhone: '      + phone +
      '\nAdults: '     + adults + (children ? ' · Children: ' + children : '') +
      '\nCitizenship: '+ citizenship +
      '\nETA: '        + eta +
      '\nPurpose: '    + purpose +
      '\nGuests: '     + guestList +
      '\n\nFiles moved to guest folder:' +
      '\n  OnlineCheckIn : ' + moved.checkin +
      '\n  ID documents  : ' + moved.id +
      '\nDrive folder: ' + guestFolder.getUrl() +
      '\n\nStatus set to: docs_uploaded' +
      '\nNext: verify docs in Drive, then open Complete Booking → Mark ready for check-in.'
    );

    Logger.log('onGuestFormSubmit complete: ' + stayId);

  } catch(err) {
    Logger.log('onGuestFormSubmit ERROR: ' + err.message + '\n' + (err.stack || ''));
    sendAlert('🚨 Form submit script error', err.message + '\n' + (err.stack || ''));
  }
}

// ── DRIVE FOLDER HELPER ───────────────────────────────────────────────────
// Creates: Guests/YYYY/MM-MonthName/GuestName-DD-StayID
// Example: Guests/2026/05-May/Vikram Ramasubramanian-08-DWK-AB123


// ── PROCESS PENDING CHECK-IN FORMS ─────────────────────────────────────
// Triggered every 5 minutes (set up in Apps Script triggers)
// Finds stays in pending_review with no Drive folder and:
// 1. Creates Drive folder
// 2. Creates TXT summary file
// 3. Sends confirmation email to owner and guest
function processPendingCheckInForms() {
  Logger.log('=== processPendingCheckInForms START ===');

  var resp = callWorker('GET', 'getPendingReviewStays', {});
  if (!resp || !resp.success || !resp.data) {
    Logger.log('No pending review stays or error: ' + JSON.stringify(resp));
    return;
  }

  var stays = resp.data;
  Logger.log('Found ' + stays.length + ' pending_review stays');

  stays.forEach(function(stay) {
    // Skip if already has a folder
    if (stay.driveFolderUrl) {
      Logger.log('Stay ' + stay.stayId + ' already has folder, skipping');
      return;
    }

    Logger.log('Processing stay: ' + stay.stayId + ' for ' + stay.guestName);

    try {
      // Create Drive folder
      var folder = getOrCreateGuestFolder(stay.guestName, stay.stayId, stay.checkIn);
      if (!folder) {
        Logger.log('Failed to create folder for ' + stay.stayId);
        return;
      }

      // Fetch full stay details for TXT file
      var fullStay = callWorker('GET', 'findOpenStay', {
        guestName: stay.guestName,
        checkInDate: stay.checkIn
      });

      var nights = stay.nights || 1;
      var checkOut = stay.checkOut || '';

      // Build TXT content
      var lines = [
        'Villa: Guruvayur Villa (Dwarka)',
        'Guest: ' + stay.guestName,
        'Check-in: ' + stay.checkIn,
        'Check-out: ' + (checkOut || 'TBD'),
        'Nights: ' + nights,
        'Phone: ' + (stay.phone || 'Not provided'),
        'Email: ' + (stay.email || 'Not provided'),
        'Status: Pending Owner Review',
        '',
        'ADDITIONAL REQUESTS:',
      ];

      // Add requests if available
      if (fullStay && fullStay.data) {
        var s = fullStay.data;
        if (s.request_breakfast) lines.push('  Breakfast: YES' + (s.breakfast_choice ? ' — ' + s.breakfast_choice : ''));
        if (s.request_cab)       lines.push('  Cab service: YES');
        if (s.request_early_checkin) lines.push('  Early check-in: REQUESTED');
        if (s.request_late_checkout) lines.push('  Late check-out: REQUESTED');
      }

      lines.push('');
      lines.push('Submitted via: Guest Check-in Form');
      lines.push('Generated: ' + new Date().toISOString());

      folder.createFile('GuestInfo-' + stay.stayId + '.txt', lines.join('
'), 'text/plain');
      Logger.log('TXT file created for ' + stay.stayId);

      // Update D1 with folder URL
      callWorker('POST', 'updateDriveFolder', {
        stayId:         stay.stayId,
        driveFolderId:  folder.getId(),
        driveFolderUrl: folder.getUrl(),
      });
      Logger.log('Drive folder URL saved to D1 for ' + stay.stayId);

      // Send confirmation emails
      sendCheckinConfirmationEmails(stay, folder.getUrl(), lines.join('
'));

    } catch(e) {
      Logger.log('Error processing ' + stay.stayId + ': ' + e.message);
    }
  });

  Logger.log('=== processPendingCheckInForms END ===');
}

// ── SEND CHECK-IN CONFIRMATION EMAILS ───────────────────────────────────
function sendCheckinConfirmationEmails(stay, folderUrl, txtContent) {
  var guestName  = stay.guestName  || 'Guest';
  var guestEmail = stay.email      || '';
  var checkIn    = stay.checkIn    || '';
  var checkOut   = stay.checkOut   || '';
  var nights     = stay.nights     || 1;
  var stayId     = stay.stayId     || '';

  var subject = 'Your Check-in Registration — Guruvayur Villa (Dwarka)';

  var guestBody =
    'Dear ' + guestName + ',\n\n' +
    'Thank you for completing your check-in registration for Guruvayur Villa (Dwarka).\n\n' +
    'Please verify the following details we have on record:\n\n' +
    '  Stay ID:      ' + stayId + '\n' +
    '  Check-in:     ' + checkIn + '\n' +
    '  Check-out:    ' + checkOut + '\n' +
    '  Nights:       ' + nights + '\n' +
    '  Phone:        ' + (stay.phone  || 'Not provided') + '\n' +
    '  Email:        ' + (stay.email  || 'Not provided') + '\n\n' +
    txtContent.split('ADDITIONAL REQUESTS:')[1] ? 
      'Your additional requests:\n' + txtContent.split('ADDITIONAL REQUESTS:')[1].trim() + '\n\n' : '' +
    'If any of the above is incorrect, please contact us immediately at +91 97287 65101.\n\n' +
    'Our team will verify your details and confirm your check-in shortly.\n\n' +
    'Warm regards,\n' +
    'Guruvayur Villa (Dwarka)\n' +
    '+91 99950 43283\n' +
    '+91 97287 65101';

  var ownerBody =
    '🔶 NEW GUEST CHECK-IN FORM SUBMITTED\n\n' +
    'Guest: '     + guestName  + '\n' +
    'Stay ID: '   + stayId     + '\n' +
    'Check-in: '  + checkIn    + '\n' +
    'Check-out: ' + checkOut   + '\n' +
    'Nights: '    + nights     + '\n' +
    'Phone: '     + (stay.phone  || 'Not provided') + '\n' +
    'Email: '     + (stay.email  || 'Not provided') + '\n\n' +
    'Full details:\n' + txtContent + '\n\n' +
    'Drive folder: ' + folderUrl + '\n\n' +
    'ACTION REQUIRED: Please review and approve in the Owner Portal.';

  // Send to owner
  try {
    MailApp.sendEmail(OWNER_EMAIL, '🔶 Guest Check-in Received — ' + guestName + ' (' + checkIn + ')', ownerBody);
    Logger.log('Owner email sent to ' + OWNER_EMAIL);
  } catch(e) {
    Logger.log('Owner email error: ' + e.message);
  }

  // Send to guest
  if (guestEmail) {
    try {
      MailApp.sendEmail(guestEmail, subject, guestBody);
      Logger.log('Guest email sent to ' + guestEmail);
    } catch(e) {
      Logger.log('Guest email error: ' + e.message);
    }
  } else {
    Logger.log('No guest email — skipping guest confirmation');
  }
}

function getOrCreateGuestFolder(guestName, stayId, checkInDate) {
  var root = DriveApp.getFolderById(DRIVE_ROOT);

  var gf = root.getFoldersByName('Guests');
  var guestsFolder = gf.hasNext() ? gf.next() : root.createFolder('Guests');

  var d = checkInDate ? new Date(checkInDate) : new Date();
  if (isNaN(d)) d = new Date();

  var year       = String(d.getFullYear());
  var month      = d.getMonth();
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthLabel = String(month + 1).padStart(2, '0') + '-' + monthNames[month];
  var day        = String(d.getDate()).padStart(2, '0');

  var yf = guestsFolder.getFoldersByName(year);
  var yearFolder = yf.hasNext() ? yf.next() : guestsFolder.createFolder(year);

  var mf = yearFolder.getFoldersByName(monthLabel);
  var monthFolder = mf.hasNext() ? mf.next() : yearFolder.createFolder(monthLabel);

  var folderName = (guestName || 'Guest') + '-' + day + '-' + stayId;
  var ef = monthFolder.getFoldersByName(folderName);
  if (ef.hasNext()) return ef.next();

  var newFolder = monthFolder.createFolder(folderName);

  // Tell Worker the folder ID so it can link it to the stay in D1
  callWorker('POST', 'updateDriveFolder', {
    stayId:         stayId,
    driveFolderId:  newFolder.getId(),
    driveFolderUrl: newFolder.getUrl(),
  });

  Logger.log('Created folder: ' + folderName);
  return newFolder;
}

// ── HELPERS ───────────────────────────────────────────────────────────────

function firstName(fullName) {
  return String(fullName || '').split(' ')[0] || 'Guest';
}

function getExtension(filename) {
  var parts = String(filename || '').split('.');
  return parts.length > 1 ? '.' + parts[parts.length - 1].toLowerCase() : '';
}

// Normalise various date formats → YYYY-MM-DD
function normaliseDate(str) {
  if (!str) return '';
  try {
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return str.trim();
    // Google Sheets date serial or locale string
    var d = new Date(str);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  } catch(e) {}
  return str;
}


// ── SYSTEM TOKEN — reads from Script Properties ──────────────────────────
function getSystemToken() {
  try {
    return PropertiesService.getScriptProperties().getProperty('SYSTEM_TOKEN') || '';
  } catch(e) {
    Logger.log('getSystemToken error: ' + e.message);
    return '';
  }
}

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

// ── TEST FUNCTION — run manually to verify setup ──────────────────────────
// Run this from the script editor to confirm the Worker connection works.
function testConnection() {
  var resp = callWorker('GET', 'getOpenStays', {});
  Logger.log('Worker response: ' + JSON.stringify(resp));
  if (resp && resp.success) {
    Logger.log('✅ Connected. Open stays: ' + (resp.data ? resp.data.length : 0));
  } else {
    Logger.log('❌ Connection failed or no data returned');
  }
}
