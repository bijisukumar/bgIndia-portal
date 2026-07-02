// ============================================================
// GUEST CHECK-IN FORM — BOUND SCRIPT  v2.2
// ============================================================
// Paste into Apps Script editor of:
//   "GVR Registration-Check-In form (Responses)"
//
// Only WORKER_URL and TENANT_ID need to be set here per client —
// everything else loads dynamically from the tenants table in D1
// via getTenantConfig (see v2.1 below).
//
// ── VERSION HISTORY (newest first) — bump on every change ──
// v2.2  2026-07-02  Car/plate check-in photos: added
//                    processPendingDocumentUploads() to upload them
//                    to the guest's Drive folder; left in D1 for 5
//                    days (in-app viewing) instead of immediate
//                    delete, unlike ID/passport docs.
// v2.1  2026-06-01  Multi-app split + tenant config foundation —
//                    CLIENT now loaded dynamically from D1 tenants
//                    table via getTenantConfig, replacing the
//                    hardcoded CLIENT block. Only WORKER_URL/
//                    TENANT_ID stay hardcoded per client.
// —     2026-06-12  Fix: guest_documents lifecycle — verification,
//                    14-day cleanup, status update.
// —     2026-05-31  Fix: guest confirmation email — check-in after
//                    4pm / check-out by 11am wording.
// —     2026-05-28  Feat: include extra floor beds in TXT + emails.
// —     2026-05-26  Fix: clean filename + mark doc uploaded after
//                    Drive upload; upload docs even if folder
//                    already existed.
// —     2026-05-25  Several fixes/feats same day: email owner
//                    immediately on processing error; add
//                    guestContactPhone to CLIENT + ETA in guest
//                    email; clean up TXT/email formats;
//                    getOrCreateGuestFolder passes folderCreated:1;
//                    cleanup expired guest_documents at end of each
//                    run; folder_created flag + timestamped doc
//                    uploads; pass processingNote to
//                    updateDriveFolder for audit log.
// ============================================================

// ── ONLY THESE TWO VALUES CHANGE PER CLIENT ───────────────
var WORKER_URL = 'https://manage.luxuryvillasofguruvayur.com/api';
var TENANT_ID  = 'dwarka';  // matches tenants.tenant_id in D1
// ─────────────────────────────────────────────────────────

// CLIENT config loaded dynamically from D1 on first use
var _CLIENT = null;

function getClient() {
  if (_CLIENT) return _CLIENT;
  try {
    var resp = callWorker('GET', 'getTenantConfig', { tenantId: TENANT_ID });
    if (resp && resp.success && resp.data) {
      _CLIENT = {
        villaName:        resp.data.villaName,
        villaId:          resp.data.tenantId,
        phone1:           resp.data.phone1,
        phone2:           resp.data.phone2,
        guestContactPhone: resp.data.guestContact,
        ownerEmail:       resp.data.ownerEmail  || 'kerala.luxuryvillas@gmail.com',
        ownerEmailCC:     resp.data.ownerEmailCC || 'bijisukumar@gmail.com',
        driveRootId:      resp.data.driveRootId  || '1NglE0BgsxS4wULHuO2N0ydFIErk6rrf2',
        address:          resp.data.address,
        checkinTime:      resp.data.checkinTime  || '16:00',
        checkoutTime:     resp.data.checkoutTime || '11:00',
        breakfastRate:    resp.data.breakfastRate || 275,
      };
      Logger.log('✅ Tenant config loaded: ' + _CLIENT.villaName);
      return _CLIENT;
    }
  } catch(e) {
    Logger.log('getTenantConfig error: ' + e.message + ' — using fallback');
  }
  // Fallback to hardcoded values if API call fails
  _CLIENT = {
    villaName:         'Guruvayur Villa (Dwarka)',
    villaId:           'dwarka',
    phone1:            '+91 99950 43283',
    phone2:            '+91 97287 65101',
    guestContactPhone: '+91 97287 65101',
    ownerEmail:        'kerala.luxuryvillas@gmail.com',
    ownerEmailCC:      'bijisukumar@gmail.com',
    driveRootId:       '1NglE0BgsxS4wULHuO2N0ydFIErk6rrf2',
    address:           'Edappully Gandhinagar Rd, Palayoor, Guruvayur, Kerala 680101',
    checkinTime:       '16:00',
    checkoutTime:      '11:00',
    breakfastRate:     275,
  };
  return _CLIENT;
}

// Convenience aliases
var OWNER_EMAIL = 'kerala.luxuryvillas@gmail.com';
var DRIVE_ROOT  = '1NglE0BgsxS4wULHuO2N0ydFIErk6rrf2';

// ── MAIN TRIGGER — fires on every form submission ─────────────────────────
function onGuestFormSubmit(e) {
  try {
    var CLIENT = getClient();
    OWNER_EMAIL = CLIENT.ownerEmail;
    DRIVE_ROOT  = CLIENT.driveRootId;

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

    var city     = get('city')    || '';
    var state    = get('state')   || '';
    var country  = get('country') || '';
    var pincode  = get('pincode') || get('pin code') || get('postal code') || '';
    var fromCity = city;

    if (!city && homeAddress) {
      var parts = homeAddress.split(',').map(function(p) { return p.trim(); });
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
        'Headers: ' + headers.join(' | '));
      return;
    }

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
      Logger.log('No open stay found for: ' + bookerName + ' — creating provisional booking');
      var provResp = callWorker('POST', 'createProvisionalBooking', {
        guestName:    bookerName,
        checkInDate:  checkInDate,
        checkOutDate: checkOutDate,
        guestEmail:   email,
        guestPhone:   phone,
        villaId:      TENANT_ID,
        source:       'guest_form',
      });
      if (!provResp || !provResp.success) {
        sendAlert('🚨 Failed to auto-create provisional booking',
          'Guest: ' + bookerName + '\nCheck-in: ' + checkInDate +
          '\nError: ' + JSON.stringify(provResp));
        return;
      }
      stayId = provResp.data.stayId;
      Logger.log('Provisional booking created: ' + stayId);
      guestFolder = getOrCreateGuestFolder(bookerName, stayId, checkInDate);
      try {
        var nights = checkInDate && checkOutDate
          ? Math.max(1, Math.round((new Date(checkOutDate) - new Date(checkInDate)) / 86400000))
          : 1;
        guestFolder.createFile('Provisional-' + stayId + '.txt', [
          'Villa: ' + CLIENT.villaName,
          'Guest: ' + bookerName,
          'Check-in: ' + checkInDate,
          'Phone: ' + phone,
          'Email: ' + email,
          'Nights: ' + nights,
          'Status: Provisional — pending owner review',
        ].join('\n'), 'text/plain');
      } catch(txtErr) { Logger.log('TXT create error: ' + txtErr.message); }
      sendAlert('🔶 Provisional booking auto-created — pending review',
        'Guest submitted check-in form but NO matching booking was found.\n\n' +
        'A provisional booking has been auto-created:\n' +
        '  Stay ID:   ' + stayId + '\n  Guest:     ' + bookerName +
        '\n  Check-in:  ' + checkInDate + '\n  Check-out: ' + checkOutDate +
        '\n  Email:     ' + email + '\n  Phone:     ' + phone +
        '\n\nDrive folder: ' + guestFolder.getUrl() +
        '\n\n👉 Open the portal → Owner Home → approve or edit before Raman can check in.');
    }

    var moved = { checkin: 0, id: 0 };
    lastRow.forEach(function(cell, i) {
      var val = String(cell || '');
      if (val.indexOf('drive.google.com') < 0) return;
      var fileIdMatch = val.match(/id=([a-zA-Z0-9_-]+)/) ||
                        val.match(/\/d\/([a-zA-Z0-9_-]+)\//);
      if (!fileIdMatch) return;
      try {
        var file   = DriveApp.getFileById(fileIdMatch[1]);
        var col    = String(headers[i] || '').toLowerCase();
        var ext    = getExtension(file.getName());
        var isIdDoc = col.indexOf('aadhaar') >= 0 || col.indexOf('adhar') >= 0 ||
                      col.indexOf('passport') >= 0 || col.indexOf('govt') >= 0 ||
                      col.indexOf('foreign id') >= 0 ||
                      (col.indexOf('upload') >= 0 && col.indexOf('id') >= 0);
        var newName = isIdDoc
          ? 'ID-' + stayId + '-' + firstName(bookerName) + ext
          : 'OnlineCheckIn-' + stayId + '-' + firstName(bookerName) + ext;
        if (isIdDoc) moved.id++; else moved.checkin++;
        file.setName(newName);
        var parents = file.getParents();
        while (parents.hasNext()) { try { parents.next().removeFile(file); } catch(ex) {} }
        guestFolder.addFile(file);
        Logger.log('Moved: ' + newName);
      } catch(ex) { Logger.log('File move error col ' + i + ': ' + ex.message); }
    });

    callWorker('POST', 'updateStayLocation', {
      stayId: stayId, homeAddress: homeAddress, city: city,
      state: state, country: country, fromCity: fromCity,
      pincode: pincode, phone: phone, email: email,
    });

    try {
      var markerName = 'OnlineCheckIn-' + stayId + '-' + firstName(bookerName) + '.txt';
      guestFolder.createFile(markerName, [
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
      ].join('\n'), 'text/plain');
      Logger.log('Created: ' + markerName);
    } catch(me) { Logger.log('Marker error: ' + me.message); }

    callWorker('POST', 'updateStayStatus', { stayId: stayId, status: 'docs_uploaded', createdBy: 'auto' });

    sendAlert('📋 Check-in form received: ' + bookerName,
      'Stay ID: ' + stayId + '\nCheck-in: ' + checkInDate + ' → ' + checkOutDate +
      '\nEmail: ' + email + '\nPhone: ' + phone +
      '\nAdults: ' + adults + (children ? ' · Children: ' + children : '') +
      '\nCitizenship: ' + citizenship + '\nETA: ' + eta +
      '\nPurpose: ' + purpose + '\nGuests: ' + guestList +
      '\n\nFiles moved:\n  OnlineCheckIn: ' + moved.checkin + '\n  ID documents: ' + moved.id +
      '\nDrive folder: ' + guestFolder.getUrl() +
      '\n\nStatus: docs_uploaded → verify docs → Complete Booking → Mark ready for check-in.');

    Logger.log('onGuestFormSubmit complete: ' + stayId);
  } catch(err) {
    Logger.log('onGuestFormSubmit ERROR: ' + err.message + '\n' + (err.stack || ''));
    sendAlert('🚨 Form submit script error', err.message + '\n' + (err.stack || ''));
  }
}

// ── PROCESS PENDING CHECK-IN FORMS ────────────────────────
function processPendingCheckInForms() {
  Logger.log('=== processPendingCheckInForms START ===');
  var CLIENT = getClient();
  OWNER_EMAIL = CLIENT.ownerEmail;
  DRIVE_ROOT  = CLIENT.driveRootId;

  var resp = callWorker('POST', 'getPendingReviewStays', {});
  if (!resp || !resp.success || !resp.data) {
    Logger.log('No pending review stays or error: ' + JSON.stringify(resp));
    try { GmailApp.sendEmail(OWNER_EMAIL, '[GVR Portal] ⚠️ processPendingCheckInForms — worker call failed',
      'getPendingReviewStays returned: ' + JSON.stringify(resp)); } catch(e) {}
    return;
  }

  var stays = resp.data;
  Logger.log('Found ' + stays.length + ' pending_review stays');

  stays.forEach(function(stay) {
    var docsResp = callWorker('GET', 'getGuestDocuments', { stayId: stay.stayId });
    var hasPendingDocs = docsResp && docsResp.success && docsResp.data && docsResp.data.length > 0;
    if (stay.folderCreated && !hasPendingDocs) {
      Logger.log('Stay ' + stay.stayId + ' fully processed, skipping'); return;
    }
    Logger.log('Processing: ' + stay.stayId + ' for ' + stay.guestName);
    try {
      var folder = null;
      if (stay.driveFolderUrl && stay.folderCreated) {
        try {
          var folderIdMatch = stay.driveFolderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
          if (folderIdMatch) folder = DriveApp.getFolderById(folderIdMatch[1]);
        } catch(fe) { Logger.log('Could not get existing folder: ' + fe.message); }
      }
      if (!folder) {
        folder = getOrCreateGuestFolder(stay.guestName, stay.stayId, stay.checkIn);
        if (!folder) {
          GmailApp.sendEmail(OWNER_EMAIL, '[GVR Portal] ⚠️ Folder creation failed — ' + stay.stayId,
            'Could not create Drive folder for ' + stay.guestName);
          return;
        }
      }
      var fullStay = callWorker('GET', 'findOpenStay', { guestName: stay.guestName, checkInDate: stay.checkIn });
      var s = (fullStay && fullStay.data) ? fullStay.data : {};
      var adults   = parseInt(s.adults)   || 1;
      var children = parseInt(s.children) || 0;
      var lines = [
        '============================================================',
        '  GUEST REGISTRATION — ' + CLIENT.villaName,
        '============================================================',
        '',
        'STAY DETAILS',
        '  Check-in :  ' + stay.checkIn + ' (after ' + CLIENT.checkinTime + ')',
        '  Check-out:  ' + (s.checkoutDate || stay.checkOut || 'TBD') + ' (by ' + CLIENT.checkoutTime + ')',
        '  Nights   :  ' + (s.nights || stay.nights || 1),
        '',
        'GUEST DETAILS',
        '  Name     :  ' + stay.guestName,
        '  Nationality: ' + (s.nationality || 'Indian'),
        '  Adults   :  ' + adults,
      ];
      if (children > 0) lines.push('  Children :  ' + children);
      lines.push('  Total    :  ' + (adults + children) + ' guest(s)');
      if (s.phone || stay.phone) lines.push('  Phone    :  ' + (s.phone || stay.phone));
      if (s.email || stay.email) lines.push('  Email    :  ' + (s.email || stay.email));
      lines.push('');
      var hasTravel = s.purposeOfVisit || s.modeOfTransport || s.eta;
      if (hasTravel) {
        lines.push('TRAVEL');
        if (s.purposeOfVisit)  lines.push('  Purpose  :  ' + s.purposeOfVisit);
        if (s.modeOfTransport) lines.push('  Transport:  ' + s.modeOfTransport);
        if (s.vehicleNumber)   lines.push('  Vehicle  :  ' + s.vehicleNumber);
        if (s.eta)             lines.push('  ETA      :  ' + s.eta);
        lines.push('');
      }
      var hasRequests = s.requestBreakfast || s.requestCab || s.requestEarlyCheckin || s.requestLateCheckout || s.requestExtraBeds;
      lines.push('ADDITIONAL REQUESTS');
      if (hasRequests) {
        if (s.requestBreakfast)    lines.push('  ✓  Breakfast — ' + (s.breakfastChoice || 'Idli'));
        if (s.requestCab)          lines.push('  ✓  Cab service');
        if (s.requestEarlyCheckin) lines.push('  ✓  Early check-in');
        if (s.requestLateCheckout) lines.push('  ✓  Late check-out');
        if (s.requestExtraBeds)    lines.push('  ✓  Extra floor beds — ' + (s.extraBedsCount || 1) + ' bed(s)');
      } else { lines.push('  None requested'); }
      lines.push('');
      lines.push('============================================================');

      folder.createFile('GuestInfo-' + stay.stayId + '.txt', lines.join('\n'), 'text/plain');

      // Upload ID docs from D1
      var docUploadedCount = 0;
      var docFailedCount   = 0;
      try {
        var dr = callWorker('GET', 'getGuestDocuments', { stayId: stay.stayId });
        if (dr && dr.success && dr.data && dr.data.length > 0) {
          dr.data.forEach(function(doc) {
            if (!doc.file_b64) return;
            try {
              var decoded   = Utilities.base64Decode(doc.file_b64);
              var ts        = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMdd-HHmmss');
              var typeLabel = doc.doc_type === 'govt_id' ? 'ID' : doc.doc_type === 'passport' ? 'Passport' : 'Visa';
              folder.createFile(Utilities.newBlob(decoded, 'image/jpeg', typeLabel + '-' + stay.stayId + '-' + ts + '.jpg'));
              var markResp = callWorker('POST', 'markDocumentUploaded', { docId: doc.doc_id });
              if (markResp && markResp.success) { docUploadedCount++; }
              else { docFailedCount++; Logger.log('markDocumentUploaded failed for ' + doc.doc_id + ': ' + JSON.stringify(markResp)); }
            } catch(docErr) { docFailedCount++; Logger.log('Doc upload error [' + doc.doc_type + ']: ' + docErr.message); }
          });
        }
      } catch(docsErr) { Logger.log('getGuestDocuments error: ' + docsErr.message); }

      // Verify all docs reached folder_created=1 before deleting from D1
      var allDocsConfirmed = false;
      try {
        var statusResp = callWorker('GET', 'getDocumentStatus', { stayId: stay.stayId });
        if (statusResp && statusResp.success && statusResp.data) {
          var pending = statusResp.data.filter(function(d) { return d.folder_created === 0; });
          if (pending.length === 0) {
            allDocsConfirmed = true;
          } else {
            Logger.log('⚠️ ' + pending.length + ' doc(s) still folder_created=0 after upload loop — will NOT delete from D1');
            try {
              GmailApp.sendEmail(OWNER_EMAIL,
                '[GVR Portal] ⚠️ Doc upload incomplete — ' + stay.stayId,
                'Stay: ' + stay.stayId + ' (' + stay.guestName + ')\n' +
                'Uploaded: ' + docUploadedCount + ' | Failed: ' + docFailedCount + '\n' +
                'Docs still pending in D1:\n' +
                pending.map(function(d) { return '  ' + d.doc_type + ' — ' + d.doc_id; }).join('\n') +
                '\n\nDocs remain in D1 and will be retried next run. They will be auto-deleted after 14 days if never processed.'
              );
            } catch(me) {}
          }
        }
      } catch(verifyErr) { Logger.log('Doc status verify error: ' + verifyErr.message); }

      callWorker('POST', 'updateDriveFolder', {
        stayId: stay.stayId, driveFolderId: folder.getId(),
        driveFolderUrl: folder.getUrl(), folderCreated: 1,
        processingNote: 'processPendingCheckInForms — ' + new Date().toISOString(),
      });

      // Only delete from D1 and advance status if all docs confirmed uploaded
      if (allDocsConfirmed) {
        try {
          var delResp = callWorker('GET', 'deleteGuestDocuments', { stayId: stay.stayId });
          Logger.log('Deleted ' + ((delResp && delResp.data && delResp.data.deleted) || 0) + ' doc(s) from D1 for ' + stay.stayId);
        } catch(delErr) { Logger.log('deleteGuestDocuments error: ' + delErr.message); }
        try {
          callWorker('POST', 'updateStayStatus', { stayId: stay.stayId, status: 'docs_uploaded', createdBy: 'auto' });
          Logger.log('Status → docs_uploaded for ' + stay.stayId);
        } catch(statusErr) { Logger.log('updateStayStatus error: ' + statusErr.message); }
      } else {
        Logger.log('Skipping D1 delete and status update for ' + stay.stayId + ' — pending docs remain');
      }

      sendCheckinConfirmationEmails(stay, folder.getUrl(), lines.join('\n'), s, CLIENT);

    } catch(e) {
      Logger.log('Error processing ' + stay.stayId + ': ' + e.message);
      try { GmailApp.sendEmail(OWNER_EMAIL, '[GVR Portal] ⚠️ Processing error — ' + stay.stayId,
        'Error: ' + e.message + '\nStay: ' + stay.stayId); } catch(me) {}
    }
  });

  processPendingDocumentUploads();

  try {
    var cleanResp = callWorker('POST', 'cleanupExpiredDocuments', {});
    if (cleanResp && cleanResp.success) {
      Logger.log('Cleanup: deleted ' + (cleanResp.data.deleted || 0) + ' doc(s), stale unprocessed: ' + (cleanResp.data.staleUnprocessed || 0));
      if ((cleanResp.data.staleUnprocessed || 0) > 0) {
        try {
          GmailApp.sendEmail(OWNER_EMAIL,
            '[GVR Portal] ⚠️ Stale unprocessed docs cleaned — ' + cleanResp.data.staleUnprocessed + ' doc(s)',
            cleanResp.data.staleUnprocessed + ' doc(s) were in guest_documents with folder_created=0 for 14+ days and were auto-deleted.\n' +
            'These docs were never uploaded to Drive. Guest may need to resubmit if not already resolved.'
          );
        } catch(me) {}
      }
    }
  } catch(e) { Logger.log('Cleanup error: ' + e.message); }

  Logger.log('=== processPendingCheckInForms END ===');
}

// ── PROCESS PENDING DOCUMENT UPLOADS (car/plate photos, etc.) ──────────
// Catches docs attached to stays that are already past pending_review
// (e.g. car/plate photos Raman takes at check-in, when status is already
// 'checked_in') — getPendingReviewStays alone would never surface these,
// since it's scoped to pending_review only. Self-contained: doesn't touch
// the pending_review guest-info-txt / confirmation-email flow above.
function processPendingDocumentUploads() {
  Logger.log('=== processPendingDocumentUploads START ===');
  var CLIENT = getClient();
  DRIVE_ROOT = CLIENT.driveRootId;

  var resp = callWorker('GET', 'getStaysWithPendingDocuments', {});
  if (!resp || !resp.success || !resp.data) {
    Logger.log('No stays with pending docs or error: ' + JSON.stringify(resp));
    return;
  }

  resp.data.forEach(function(stay) {
    Logger.log('Processing pending docs for: ' + stay.stayId + ' (' + stay.guestName + ')');
    try {
      var folder = null;
      if (stay.driveFolderUrl && stay.folderCreated) {
        try {
          var m = stay.driveFolderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
          if (m) folder = DriveApp.getFolderById(m[1]);
        } catch(fe) { Logger.log('Could not open existing folder: ' + fe.message); }
      }
      if (!folder) folder = getOrCreateGuestFolder(stay.guestName, stay.stayId, stay.checkIn);
      if (!folder) {
        Logger.log('Folder creation failed for ' + stay.stayId); return;
      }

      var dr = callWorker('GET', 'getGuestDocuments', { stayId: stay.stayId });
      if (!dr || !dr.success || !dr.data || dr.data.length === 0) return;

      var uploaded = 0, failed = 0;
      dr.data.forEach(function(doc) {
        if (!doc.file_b64) return;
        try {
          var decoded = Utilities.base64Decode(doc.file_b64);
          var ts      = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMdd-HHmmss');
          var label   = doc.doc_type === 'car_photo' ? 'CarPhoto'
                      : doc.doc_type === 'plate_photo' ? 'PlatePhoto'
                      : doc.doc_type === 'govt_id' ? 'ID'
                      : doc.doc_type === 'passport' ? 'Passport' : doc.doc_type;
          folder.createFile(Utilities.newBlob(decoded, 'image/jpeg', label + '-' + stay.stayId + '-' + ts + '.jpg'));
          var mr = callWorker('POST', 'markDocumentUploaded', { docId: doc.doc_id });
          if (mr && mr.success) uploaded++; else failed++;
        } catch(docErr) { failed++; Logger.log('Doc upload error [' + doc.doc_type + ']: ' + docErr.message); }
      });
      Logger.log(stay.stayId + ': uploaded ' + uploaded + ', failed ' + failed);

      if (!stay.folderCreated) {
        callWorker('POST', 'updateDriveFolder', {
          stayId: stay.stayId, driveFolderId: folder.getId(),
          driveFolderUrl: folder.getUrl(), folderCreated: 1,
          processingNote: 'processPendingDocumentUploads — ' + new Date().toISOString(),
        });
      }

      // Unlike the pending_review path (which deletes ID/passport docs
      // from D1 immediately once confirmed uploaded), car/plate photos are
      // intentionally left in D1 after upload — they're meant to stay
      // viewable in-app for a few days. cleanupExpiredDocuments sweeps
      // them after 5 days, not this function.
    } catch(e) {
      Logger.log('Error processing pending docs for ' + stay.stayId + ': ' + e.message);
    }
  });

  Logger.log('=== processPendingDocumentUploads END ===');
}

// ── SEND CHECK-IN CONFIRMATION EMAILS ────────────────────
function sendCheckinConfirmationEmails(stay, folderUrl, txtContent, stayDetails, CLIENT) {
  if (!CLIENT) CLIENT = getClient();
  var guestName  = stay.guestName || 'Guest';
  var guestEmail = (stayDetails && stayDetails.email) || stay.email || '';
  var checkIn    = stay.checkIn  || '';
  var checkOut   = (stayDetails && stayDetails.checkoutDate) || stay.checkOut || '';
  var nights     = (stayDetails && stayDetails.nights) || stay.nights || 1;
  var adults     = (stayDetails && stayDetails.adults)   || 1;
  var children   = (stayDetails && stayDetails.children) || 0;
  var phone      = (stayDetails && stayDetails.phone)    || stay.phone || '';
  var eta        = (stayDetails && stayDetails.eta) ? stayDetails.eta : '';

  var reqLines = [];
  if (stayDetails) {
    if (stayDetails.requestBreakfast)    reqLines.push('  ✓ Breakfast — ' + (stayDetails.breakfastChoice || 'Idli'));
    if (stayDetails.requestCab)          reqLines.push('  ✓ Cab service');
    if (stayDetails.requestEarlyCheckin) reqLines.push('  ✓ Early check-in');
    if (stayDetails.requestLateCheckout) reqLines.push('  ✓ Late check-out');
    if (stayDetails.requestExtraBeds)    reqLines.push('  ✓ Extra floor beds — ' + (stayDetails.extraBedsCount || 1) + ' bed(s)');
  }
  var reqSection = reqLines.length > 0
    ? 'ADDITIONAL REQUESTS:\n' + reqLines.join('\n') + '\n\n'
    : 'ADDITIONAL REQUESTS: None\n\n';

  // Format times as "4:00 PM" from "16:00"
  function fmt(t) {
    if (!t) return '';
    var parts = t.split(':'); var h = parseInt(parts[0]); var m = parts[1] || '00';
    return (h > 12 ? h-12 : h) + ':' + m + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  var guestBody =
    'Dear ' + guestName + ',\n\n' +
    'Thank you for completing your check-in registration. ' +
    'Please verify the details we have on record:\n\n' +
    'STAY DETAILS\n' +
    '  Check-in :  ' + checkIn  + ' (after ' + fmt(CLIENT.checkinTime)  + ')\n' +
    '  Check-out:  ' + checkOut + ' (by '    + fmt(CLIENT.checkoutTime) + ')\n' +
    '  Nights   :  ' + nights + '\n' +
    (eta ? '  ETA      :  ' + eta + '\n' : '') + '\n' +
    'GUEST DETAILS\n' +
    '  Adults   :  ' + adults + (children > 0 ? '\n  Children :  ' + children : '') + '\n' +
    (phone      ? '  Phone    :  ' + phone      + '\n' : '') +
    (guestEmail ? '  Email    :  ' + guestEmail + '\n' : '') +
    '\n' + reqSection +
    'If anything looks incorrect, please contact us at ' + CLIENT.guestContactPhone + '.\n\n' +
    'We look forward to welcoming you to ' + CLIENT.villaName + '!\n\n' +
    'Warm regards,\n' + CLIENT.villaName + '\n' +
    CLIENT.phone1 + '  |  ' + CLIENT.guestContactPhone;

  var ownerBody =
    'NEW CHECK-IN FORM SUBMITTED\n' +
    '============================================================\n' +
    'Guest    :  ' + guestName  + '\n' +
    'Check-in :  ' + checkIn    + '\n' +
    'Check-out:  ' + checkOut   + '\n' +
    'Nights   :  ' + nights     + '\n' +
    'Adults   :  ' + adults + (children > 0 ? '  |  Children: ' + children : '') + '\n' +
    (phone      ? 'Phone    :  ' + phone      + '\n' : '') +
    (guestEmail ? 'Email    :  ' + guestEmail + '\n' : '') +
    '\n' + reqSection +
    '------------------------------------------------------------\n' +
    txtContent + '\n' +
    '------------------------------------------------------------\n' +
    'Drive folder: ' + folderUrl + '\n\n' +
    '>> ACTION REQUIRED: Review and approve in the Owner Portal <<';

  try { GmailApp.sendEmail(CLIENT.ownerEmail, 'Guest Check-in Received — ' + guestName + ' (' + checkIn + ')', ownerBody); } catch(e) { Logger.log('Owner email error: ' + e.message); }
  try { GmailApp.sendEmail(CLIENT.ownerEmailCC, 'Guest Check-in Received — ' + guestName + ' (' + checkIn + ')', ownerBody); } catch(e) { Logger.log('CC email error: ' + e.message); }
  if (guestEmail) {
    try { GmailApp.sendEmail(guestEmail, 'Your Check-in Registration — ' + CLIENT.villaName, guestBody); Logger.log('Guest email sent to ' + guestEmail); }
    catch(e) { Logger.log('Guest email error: ' + e.message); }
  }
}

// ── DRIVE FOLDER ──────────────────────────────────────────
function getOrCreateGuestFolder(guestName, stayId, checkInDate) {
  var root = DriveApp.getFolderById(DRIVE_ROOT);
  var gf = root.getFoldersByName('Guests');
  var guestsFolder = gf.hasNext() ? gf.next() : root.createFolder('Guests');
  var d = checkInDate ? new Date(checkInDate) : new Date();
  if (isNaN(d)) d = new Date();
  var year = String(d.getFullYear());
  var month = d.getMonth();
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthLabel = String(month + 1).padStart(2, '0') + '-' + monthNames[month];
  var day = String(d.getDate()).padStart(2, '0');
  var yf = guestsFolder.getFoldersByName(year);
  var yearFolder = yf.hasNext() ? yf.next() : guestsFolder.createFolder(year);
  var mf = yearFolder.getFoldersByName(monthLabel);
  var monthFolder = mf.hasNext() ? mf.next() : yearFolder.createFolder(monthLabel);
  var folderName = (guestName || 'Guest') + '-' + day + '-' + stayId;
  var ef = monthFolder.getFoldersByName(folderName);
  if (ef.hasNext()) return ef.next();
  var newFolder = monthFolder.createFolder(folderName);
  callWorker('POST', 'updateDriveFolder', {
    stayId: stayId, driveFolderId: newFolder.getId(),
    driveFolderUrl: newFolder.getUrl(), folderCreated: 1,
    processingNote: 'Created by getOrCreateGuestFolder — ' + new Date().toISOString(),
  });
  Logger.log('Created folder: ' + folderName);
  return newFolder;
}

// ── HELPERS ───────────────────────────────────────────────
function firstName(n) { return String(n || '').split(' ')[0] || 'Guest'; }
function getExtension(f) { var p = String(f||'').split('.'); return p.length > 1 ? '.'+p[p.length-1].toLowerCase() : ''; }
function normaliseDate(str) {
  if (!str) return '';
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return str.trim();
    var d = new Date(str);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  } catch(e) {}
  return str;
}
function getSystemToken() {
  try { return PropertiesService.getScriptProperties().getProperty('SYSTEM_TOKEN') || ''; }
  catch(e) { return ''; }
}
function callWorker(method, action, payload) {
  try {
    var url  = WORKER_URL + '/' + action;
    var opts = {
      method: method.toLowerCase(),
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getSystemToken() },
      muteHttpExceptions: true,
    };
    if (method === 'GET' && payload && Object.keys(payload).length > 0) {
      url += '?' + Object.keys(payload).map(function(k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(String(payload[k]||''));
      }).join('&');
    }
    if (method === 'POST') opts.payload = JSON.stringify(payload || {});
    return JSON.parse(UrlFetchApp.fetch(url, opts).getContentText());
  } catch(e) { Logger.log('callWorker (' + action + '): ' + e.message); return null; }
}
function sendAlert(subject, body) {
  try { GmailApp.sendEmail(OWNER_EMAIL, '[GVR Portal] ' + subject, body); }
  catch(e) { Logger.log('sendAlert failed: ' + e.message); }
}
function testConnection() {
  var resp = callWorker('GET', 'getTenantConfig', { tenantId: TENANT_ID });
  Logger.log('Tenant config: ' + JSON.stringify(resp));
  if (resp && resp.success) Logger.log('✅ Connected: ' + resp.data.villaName);
  else Logger.log('❌ Connection failed');
}

function testPendingStays() {
  var resp = callWorker('POST', 'getPendingReviewStays', {});
  Logger.log('Response: ' + JSON.stringify(resp));
}
