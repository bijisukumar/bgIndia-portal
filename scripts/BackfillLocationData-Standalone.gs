// ============================================================
// bgIndia Portal — STANDALONE LOCATION BACKFILL SCRIPT
// ============================================================
// CREATE A NEW STANDALONE Apps Script project:
//   1. Go to https://script.google.com
//   2. Click "+ New project"
//   3. Paste this ENTIRE file — replace all default code
//   4. Save (Ctrl+S), name it "bgIndia Location Backfill"
//   5. Run runDryRun() first — review the validation report
//   6. If satisfied, run runBackfill() to generate SQL
//   7. Download the SQL from Drive, run against D1
//
// NO other files or V20 script needed — fully self-contained.
// ============================================================

// ── CONFIG ────────────────────────────────────────────────────────────────
var OWNER_EMAIL    = 'bijisukumar@gmail.com';
var DRIVE_ROOT_ID  = '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva';
var MAIN_SHEET_ID  = '1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ';
var STAYS_SHEET    = 'Stays';

// Check-in form response sheet (Google Form linked sheet — has Full Home Address)
var FORM_SHEET_ID  = '1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0';

// Check-in DOCX folder structure:
// 2026: LVG Guest-Checkin/2026/MM-Month/GuestFolder/GuestName-LVGGuestCheckIn.docx
// 2025: LVG Guest-Checkin/2025/MM-Month/GuestFolder/...
// 2024: LVG Guest-Checkin/2024/MM-Month/GuestFolder/...
var FOLDER_2026    = '1IOisLwV7QxihMSRvlalolq1sMtW51QFt';
var FOLDER_2025    = '15fXmazoHTIeUf6Jq9bsaZHzZghzLBcaU';
var FOLDER_2024    = '1HYV_PRNezuHWC9iyL80TTtPuaNqBgJQs';

// ── STEP 1: DRY RUN — run this first ──────────────────────────────────────
// Scans all check-in docs, matches to Stays sheet, shows coverage stats.
// Produces a validation CSV in Drive — review it before running backfill.
function runDryRun() {
  Logger.log('=== DRY RUN STARTED ===');
  var result = processAll(true);
  Logger.log('=== DRY RUN COMPLETE ===');
  Logger.log('Matched: '   + result.matched);
  Logger.log('Unmatched: ' + result.unmatched);
  Logger.log('Coverage: '  + result.coveragePct + '%');
  Logger.log('Report: '    + result.reportUrl);
  GmailApp.sendEmail(OWNER_EMAIL,
    '[bgIndia] Dry Run: ' + result.matched + ' matched, ' + result.unmatched + ' unmatched (' + result.coveragePct + '% coverage)',
    result.summary + '\n\nValidation CSV: ' + result.reportUrl
  );
}

// ── STEP 2: FULL BACKFILL — run after reviewing dry run ───────────────────
// Generates SQL UPDATE file in Drive. Download and run against D1.
function runBackfill() {
  Logger.log('=== BACKFILL STARTED ===');
  var result = processAll(false);
  Logger.log('=== BACKFILL COMPLETE ===');
  Logger.log('SQL file: ' + result.sqlUrl);
  GmailApp.sendEmail(OWNER_EMAIL,
    '[bgIndia] Backfill SQL ready — ' + result.matched + ' stays updated',
    result.summary + '\n\nSQL file: ' + result.sqlUrl +
    '\n\nTo apply:\n' +
    'wrangler d1 execute bgindia-db --file=backfill-location.sql --remote'
  );
}

// ── CORE PROCESSOR ────────────────────────────────────────────────────────
function processAll(dryRun) {
  // 1. Load all stays from Sheets (our source of truth for matching)
  var allStays = loadStaysFromSheet();
  Logger.log('Loaded ' + allStays.length + ' stays from Sheets');

  // 2. Collect guest data from all sources
  var guestData = [];

  // Source A: Google Form response sheet (richest — has Full Home Address)
  var formData = readFormResponseSheet();
  Logger.log('Form responses: ' + formData.length);
  guestData = guestData.concat(formData);

  // Source B: DOCX check-in forms in Drive folders (2024/2025/2026)
  var docxData = readAllDocxFolders();
  Logger.log('DOCX check-in docs: ' + docxData.length);
  guestData = guestData.concat(docxData);

  // Deduplicate by bookerName+checkIn (form response wins over DOCX)
  guestData = deduplicateGuestData(guestData);
  Logger.log('Unique guest records after dedup: ' + guestData.length);

  // 3. Match each guest record to a stay
  var matched   = [];
  var unmatched = [];

  guestData.forEach(function(g) {
    var stay = findMatchingStay(g.bookerName, g.checkIn, allStays);
    if (stay) {
      matched.push({ guest: g, stay: stay });
    } else {
      unmatched.push(g);
    }
  });

  // 4. Build validation CSV report
  var csvLines = [
    'Status,StayId,BookerName,CheckIn,Source,City,State,Country,Pincode,GovtIdType,GovtIdNum,Email,Phone,MatchScore,Notes'
  ];

  matched.forEach(function(m) {
    csvLines.push([
      'MATCHED',
      m.stay.stayId,
      csvEscape(m.guest.bookerName),
      m.guest.checkIn,
      m.guest.source,
      csvEscape(m.guest.city),
      csvEscape(m.guest.state),
      m.guest.country,
      m.guest.pincode,
      m.guest.govtIdType,
      csvEscape(m.guest.govtIdNum),
      csvEscape(m.guest.email),
      csvEscape(m.guest.phone),
      m.stay._matchScore,
      ''
    ].join(','));
  });

  unmatched.forEach(function(g) {
    csvLines.push([
      'UNMATCHED',
      '',
      csvEscape(g.bookerName),
      g.checkIn,
      g.source,
      csvEscape(g.city),
      csvEscape(g.state),
      g.country,
      g.pincode,
      g.govtIdType,
      csvEscape(g.govtIdNum),
      csvEscape(g.email),
      csvEscape(g.phone),
      '',
      'No matching stay found — may be Airbnb booking or cancelled'
    ].join(','));
  });

  // Save CSV report to Drive
  var root    = DriveApp.getFolderById(DRIVE_ROOT_ID);
  var csvName = 'backfill-validation-' + todayStr() + '.csv';
  deleteIfExists(root, csvName);
  var csvFile = root.createFile(csvName, csvLines.join('\n'), 'text/csv');
  Logger.log('Validation CSV: ' + csvFile.getUrl());

  // 5. Coverage stats
  var totalStays    = allStays.length;
  var matchedCount  = matched.length;
  var coveragePct   = totalStays > 0 ? Math.round(matchedCount / totalStays * 100) : 0;

  // Field completeness of matched records
  var withCity    = matched.filter(function(m){ return m.guest.city; }).length;
  var withEmail   = matched.filter(function(m){ return m.guest.email; }).length;
  var withPhone   = matched.filter(function(m){ return m.guest.phone; }).length;
  var withId      = matched.filter(function(m){ return m.guest.govtIdNum; }).length;
  var withAddress = matched.filter(function(m){ return m.guest.homeAddress; }).length;

  var summary = [
    '📍 Location Backfill ' + (dryRun ? 'DRY RUN' : 'RESULTS'),
    '==========================================',
    'Total stays in sheet:    ' + totalStays,
    'Guest records found:     ' + guestData.length,
    'Stays matched:           ' + matchedCount + ' (' + coveragePct + '% coverage)',
    'Unmatched (exceptions):  ' + unmatched.length,
    '',
    'DATA QUALITY (of matched):',
    '  With home address:     ' + withAddress + '/' + matchedCount,
    '  With city:             ' + withCity    + '/' + matchedCount,
    '  With email:            ' + withEmail   + '/' + matchedCount,
    '  With phone:            ' + withPhone   + '/' + matchedCount,
    '  With govt ID:          ' + withId      + '/' + matchedCount,
    '',
    'UNMATCHED EXCEPTIONS:',
    unmatched.map(function(g) {
      return '  • ' + g.bookerName + ' (' + g.checkIn + ') [' + g.source + ']';
    }).join('\n') || '  None',
  ].join('\n');

  Logger.log(summary);

  // 6. Generate SQL (only in full run)
  var sqlUrl = '';
  if (!dryRun && matched.length > 0) {
    var sqlLines = buildSql(matched);
    var sqlName  = 'backfill-location-' + todayStr() + '.sql';
    deleteIfExists(root, sqlName);
    var sqlFile = root.createFile(sqlName, sqlLines.join('\n'), 'text/plain');
    sqlUrl = sqlFile.getUrl();
    Logger.log('SQL file: ' + sqlUrl);
  }

  return {
    matched:     matchedCount,
    unmatched:   unmatched.length,
    coveragePct: coveragePct,
    summary:     summary,
    reportUrl:   csvFile.getUrl(),
    sqlUrl:      sqlUrl,
  };
}

// ── SOURCE A: GOOGLE FORM RESPONSE SHEET ──────────────────────────────────
function readFormResponseSheet() {
  var results = [];
  try {
    var ss      = SpreadsheetApp.openById(FORM_SHEET_ID);
    var sheet   = ss.getSheets()[0];
    var data    = sheet.getDataRange().getValues();
    if (data.length < 2) return results;

    var headers = data[0];
    var lc      = headers.map(function(h){ return String(h).toLowerCase().trim(); });

    function col(keyword) {
      for (var i = 0; i < lc.length; i++) {
        if (lc[i].indexOf(keyword) >= 0) return i;
      }
      return -1;
    }

    var idxAddr    = col('full home address');
    var idxBooker  = col('bookers full name');
    var idxCheckIn = col('check in date');
    var idxEmail   = col('email address');
    var idxPhone   = col('phone number');
    var idxGovtId  = col('adhar') >= 0 ? col('adhar') : col('government id');
    var idxPassNum = col('passport number');
    var idxPurpose = col('purpose');

    data.slice(1).forEach(function(row) {
      var bookerName  = idxBooker  >= 0 ? String(row[idxBooker]  || '').trim() : '';
      var checkIn     = idxCheckIn >= 0 ? normDate(row[idxCheckIn])             : '';
      var homeAddress = idxAddr    >= 0 ? String(row[idxAddr]    || '').trim() : '';
      var email       = idxEmail   >= 0 ? String(row[idxEmail]   || '').trim() : '';
      var phone       = idxPhone   >= 0 ? String(row[idxPhone]   || '').trim() : '';
      var govtIdRaw   = idxGovtId  >= 0 ? String(row[idxGovtId]  || '').trim() : '';
      var passNum     = idxPassNum >= 0 ? String(row[idxPassNum]  || '').trim() : '';
      var purpose     = idxPurpose >= 0 ? String(row[idxPurpose]  || '').trim() : '';

      if (!bookerName) return;

      // Determine ID type and number
      var govtIdType = '', govtIdNum = '';
      if (passNum) {
        govtIdType = 'Passport'; govtIdNum = passNum;
      } else if (govtIdRaw) {
        // Format: "AADHAR - 421928926428" or just the number
        var aadharMatch = govtIdRaw.match(/\d{12}/);
        if (aadharMatch) {
          govtIdType = 'Aadhaar'; govtIdNum = aadharMatch[0];
        } else {
          govtIdType = 'Other'; govtIdNum = govtIdRaw.replace(/^(AADHAR|AADHAAR|PASSPORT)[:\s\-]*/i, '').trim();
        }
      }

      var loc = parseAddress(homeAddress);

      results.push({
        source:      'GoogleForm',
        bookerName:  bookerName,
        checkIn:     checkIn,
        homeAddress: homeAddress,
        city:        loc.city,
        state:       loc.state,
        country:     loc.country,
        pincode:     loc.pincode,
        fromCity:    loc.city,
        email:       email,
        phone:       cleanPhone(phone),
        govtIdType:  govtIdType,
        govtIdNum:   govtIdNum,
        purpose:     purpose,
      });
    });
  } catch(e) {
    Logger.log('readFormResponseSheet error: ' + e.message);
  }
  Logger.log('Form sheet: ' + results.length + ' records');
  return results;
}

// ── SOURCE B: DOCX CHECK-IN FORMS IN DRIVE FOLDERS ────────────────────────
function readAllDocxFolders() {
  var results = [];
  [[FOLDER_2026,'2026'], [FOLDER_2025,'2025'], [FOLDER_2024,'2024']].forEach(function(pair) {
    var folderId = pair[0], year = pair[1];
    try {
      var r = readYearFolder(folderId, year);
      Logger.log('Year ' + year + ': ' + r.length + ' DOCX records');
      results = results.concat(r);
    } catch(e) {
      Logger.log('Error reading ' + year + ' folder: ' + e.message);
    }
  });
  return results;
}

function readYearFolder(yearFolderId, year) {
  var results = [];
  // Iterate month sub-folders
  var monthFolders = DriveApp.getFolderById(yearFolderId).getFolders();
  while (monthFolders.hasNext()) {
    var monthFolder = monthFolders.next();
    // Iterate guest sub-folders
    var guestFolders = monthFolder.getFolders();
    while (guestFolders.hasNext()) {
      var guestFolder = guestFolders.next();
      // Find the DOCX check-in file
      var files = guestFolder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        var fname = file.getName().toLowerCase();
        var mime  = file.getMimeType();

        // Only process DOCX check-in forms (not ID documents)
        var isDocx = mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                  || mime === 'application/vnd.google-apps.document';
        var isCheckInDoc = fname.indexOf('checkin') >= 0 || fname.indexOf('check-in') >= 0
                        || fname.indexOf('lvg') >= 0     || fname.indexOf('gvr') >= 0;

        if (!isDocx || !isCheckInDoc) continue;

        try {
          var parsed = parseCheckInDocx(file, year);
          if (parsed) results.push(parsed);
        } catch(e) {
          Logger.log('Error parsing ' + file.getName() + ': ' + e.message);
        }
      }
    }
  }
  return results;
}

function parseCheckInDocx(file, year) {
  // Export DOCX as plain text for parsing
  var content;
  try {
    var exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id=' +
      file.getId() + '&exportFormat=txt';
    var resp = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });
    content = resp.getContentText();
  } catch(e) {
    // Fallback: try reading via DriveApp
    content = file.getAs('text/plain').getDataAsString();
  }

  if (!content || content.length < 50) return null;

  // ── Parse the check-in DOCX table structure ────────────────────────
  // Key fields from the document:
  //   "Booked By/Approved Guest: Sangeeth"
  //   "Check-in: May 12th"
  //   "Adhar/Passport Number: X9171135"
  //   "Email: sangeeth.sat@gmail.com"
  //   "Phone: +91 96337 30791"
  //   Guest 1 row has full address

  var bookerName  = '';
  var checkIn     = '';
  var checkOut    = '';
  var govtIdNum   = '';
  var govtIdType  = '';
  var email       = '';
  var phone       = '';
  var homeAddress = '';
  var purpose     = '';
  var nights      = '';
  var bookingPartner = '';

  // Booker name — "Booked By/Approved Guest: Name" or "Booked By: Name"
  var bookerMatch = content.match(/(?:Booked By\/Approved Guest|Booked By|Approved Guest)[:\s]+([^\n\|]+)/i);
  if (bookerMatch) bookerName = bookerMatch[1].trim();

  // Check-in date
  var ciMatch = content.match(/Check[-\s]in[:\s]+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?[,\s]+(?:\d{4})?)/i) ||
                content.match(/Check[-\s]in[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (ciMatch) checkIn = normDate(ciMatch[1] + (ciMatch[1].indexOf(year) < 0 ? ' ' + year : ''));

  // Booking partner
  var partnerMatch = content.match(/Booking Partner[:\s]+([^\n\|]+)/i);
  if (partnerMatch) bookingPartner = partnerMatch[1].trim();

  // Govt ID number (Aadhaar or Passport)
  var idMatch = content.match(/Adhar\/Passport Number[:\s]+([^\n\|]+)/i) ||
                content.match(/Aadhaar[:\s]+([0-9\s]{12,14})/i) ||
                content.match(/Passport[:\s#]+([A-Z]\d{7})/i);
  if (idMatch) {
    govtIdNum = idMatch[1].trim();
    if (/^\d{12}$/.test(govtIdNum.replace(/\s/g,''))) {
      govtIdType = 'Aadhaar'; govtIdNum = govtIdNum.replace(/\s/g,'');
    } else if (/^[A-Z]\d{7}$/.test(govtIdNum)) {
      govtIdType = 'Passport';
    } else {
      govtIdType = 'Other';
    }
  }

  // Email
  var emailMatch = content.match(/Email[:\s]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) email = emailMatch[1].trim().toLowerCase();

  // Phone
  var phoneMatch = content.match(/Phone[^:]*[:\s]+(\+?[\d\s\-]{8,15})/i);
  if (phoneMatch) phone = cleanPhone(phoneMatch[1]);

  // Purpose of visit
  var purposeMatch = content.match(/Purpose of (?:Visit|Stay)[:\|]*\s*([^\n\|]+)/i);
  if (purposeMatch) purpose = purposeMatch[1].trim();

  // Guest 1 address — in the guest table, Guest 1 has the home address
  // Pattern: "| 1 | GuestName/Age | Full Address |"
  var addrMatch = content.match(/\|\s*1\s*\|\s*[^\|]+\|\s*([^\|]{15,})\|/);
  if (addrMatch) {
    var raw = addrMatch[1].trim();
    // Sometimes the address is repeated (copy-paste artifact) — take first clean part
    homeAddress = raw.split(/\n/)[0].trim();
  }

  if (!bookerName && !email) return null; // skip blank rows

  var loc = parseAddress(homeAddress || '');

  return {
    source:         'DOCX-' + year,
    bookerName:     bookerName,
    checkIn:        checkIn,
    homeAddress:    homeAddress,
    city:           loc.city,
    state:          loc.state,
    country:        loc.country,
    pincode:        loc.pincode,
    fromCity:       loc.city,
    email:          email,
    phone:          phone,
    govtIdType:     govtIdType,
    govtIdNum:      govtIdNum,
    purpose:        purpose,
    bookingPartner: bookingPartner,
  };
}

// ── MATCHING LOGIC ────────────────────────────────────────────────────────
function loadStaysFromSheet() {
  var ss    = SpreadsheetApp.openById(MAIN_SHEET_ID);
  var sheet = ss.getSheetByName(STAYS_SHEET);
  if (!sheet) { Logger.log('Stays sheet not found'); return []; }
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h,i){ obj[h] = row[i]; });
    return obj;
  }).filter(function(r){ return r.stayId || r.stay_id; });
}

function findMatchingStay(bookerName, checkIn, allStays) {
  if (!bookerName) return null;
  var bn      = String(bookerName).toLowerCase().trim();
  var bFirst  = bn.split(/\s+/)[0];
  var bLast   = bn.split(/\s+/).slice(-1)[0];
  var ciDate  = checkIn ? new Date(checkIn) : null;

  var best = null, bestScore = 0;

  allStays.forEach(function(stay) {
    var sn = String(stay.bookerName || stay.guestName || stay.booker_name || stay.guest_name || '').toLowerCase().trim();
    if (!sn) return;
    var sFirst = sn.split(/\s+/)[0];
    var sLast  = sn.split(/\s+/).slice(-1)[0];

    // Name score
    var nameScore = 0;
    if (sn === bn)                                        nameScore = 100;
    else if (sFirst === bFirst && sLast === bLast)        nameScore = 90;
    else if (sn.indexOf(bFirst) >= 0 && sn.indexOf(bLast) >= 0) nameScore = 75;
    else if (sFirst === bFirst)                           nameScore = 50;
    else if (sLast  === bLast)                            nameScore = 45;
    else if (sn.indexOf(bFirst) >= 0)                    nameScore = 35;
    if (nameScore < 35) return; // too different

    // Date score
    var dateScore = 0;
    var stayCheckIn = stay.checkIn || stay.checkin_date || stay.checkInDate || '';
    if (ciDate && stayCheckIn) {
      var diff = Math.abs((ciDate - new Date(stayCheckIn)) / 86400000);
      if (diff === 0)     dateScore = 100;
      else if (diff <= 1) dateScore = 60;
      else if (diff <= 3) dateScore = 30;
      else if (diff <= 7) dateScore = 10;
    } else {
      dateScore = 15; // no date — weight name more
    }

    var total = nameScore + dateScore;
    if (total > bestScore && total >= 85) {
      bestScore = total;
      best = stay;
      best._matchScore = total;
    }
  });

  return best;
}

// ── SQL BUILDER ────────────────────────────────────────────────────────────
function buildSql(matched) {
  var lines = [
    '-- ============================================================',
    '-- bgIndia Portal — Location Backfill SQL',
    '-- Generated: ' + new Date().toISOString(),
    '-- Matched stays: ' + matched.length,
    '-- ============================================================',
    '',
    '-- Add new columns (safe to re-run — errors for existing cols are ok):',
    "ALTER TABLE stays ADD COLUMN home_address TEXT;",
    "ALTER TABLE stays ADD COLUMN city         TEXT;",
    "ALTER TABLE stays ADD COLUMN state        TEXT;",
    "ALTER TABLE stays ADD COLUMN country      TEXT DEFAULT 'India';",
    "ALTER TABLE stays ADD COLUMN from_city    TEXT;",
    "ALTER TABLE stays ADD COLUMN pincode      TEXT;",
    "ALTER TABLE stays ADD COLUMN govt_id_type TEXT;",
    "ALTER TABLE stays ADD COLUMN govt_id_num  TEXT;",
    '',
  ];

  matched.forEach(function(m) {
    var g    = m.guest;
    var stay = m.stay;
    var sid  = stay.stayId || stay.stay_id;

    lines.push('-- ' + g.bookerName + ' · ' + g.checkIn + ' → ' + sid + ' [' + g.source + ']');
    lines.push('UPDATE stays SET');
    lines.push('  home_address = ' + sqlStr(g.homeAddress) + ',');
    lines.push('  city         = ' + sqlStr(g.city)        + ',');
    lines.push('  state        = ' + sqlStr(g.state)       + ',');
    lines.push('  country      = ' + sqlStr(g.country || 'India') + ',');
    lines.push('  from_city    = ' + sqlStr(g.city)        + ',');
    lines.push('  pincode      = ' + sqlStr(g.pincode)     + ',');
    lines.push('  govt_id_type = ' + sqlStr(g.govtIdType)  + ',');
    lines.push('  govt_id_num  = ' + sqlStr(g.govtIdNum)   + ',');
    lines.push('  guest_email  = COALESCE(NULLIF(guest_email, \'\'), ' + sqlStr(g.email) + '),');
    lines.push('  guest_phone  = COALESCE(NULLIF(guest_phone, \'\'), ' + sqlStr(g.phone) + '),');
    lines.push('  updated_by   = \'system\',');
    lines.push('  updated_at   = datetime(\'now\')');
    lines.push('WHERE stay_id = ' + sqlStr(sid) + ';');
    lines.push('');
  });

  lines.push('-- VERIFICATION');
  lines.push("SELECT 'Updated stays:' label, COUNT(*) cnt FROM stays WHERE from_city IS NOT NULL AND from_city != '';");
  lines.push("SELECT 'With govt ID:' label, COUNT(*) cnt FROM stays WHERE govt_id_num IS NOT NULL AND govt_id_num != '';");
  lines.push("SELECT 'Missing city:' label, COUNT(*) cnt FROM stays WHERE (from_city IS NULL OR from_city = '') AND status NOT IN ('cancelled');");

  return lines;
}

// ── ADDRESS PARSER ────────────────────────────────────────────────────────
function parseAddress(address) {
  var r = { city:'', state:'', country:'India', pincode:'' };
  if (!address) return r;
  var s = address.trim();

  // PIN code
  var pin = s.match(/\b(\d{6})\b/);
  if (pin) { r.pincode = pin[1]; s = s.replace(pin[0],'').trim(); }

  // ZIP code (USA 5-digit)
  var zip = s.match(/\b(\d{5})\b/);
  if (zip && !pin) r.pincode = zip[1];

  // Countries
  var countries = {
    'usa':'USA','united states':'USA','u.s.a':'USA',
    'uk':'UK','united kingdom':'UK','england':'UK',
    'australia':'Australia','canada':'Canada',
    'uae':'UAE','dubai':'UAE','sharjah':'UAE','abu dhabi':'UAE',
    'singapore':'Singapore','germany':'Germany','france':'France',
    'malaysia':'Malaysia','new zealand':'New Zealand',
    'netherlands':'Netherlands','bahrain':'Bahrain','kuwait':'Kuwait',
    'qatar':'Qatar','oman':'Oman','saudi arabia':'Saudi Arabia',
  };
  var sl = s.toLowerCase();
  Object.keys(countries).forEach(function(k) {
    if (sl.indexOf(k) >= 0) r.country = countries[k];
  });

  // Indian states
  var states = {
    'karnataka':'Karnataka','tamil nadu':'Tamil Nadu','kerala':'Kerala',
    'maharashtra':'Maharashtra','delhi':'Delhi','new delhi':'Delhi',
    'telangana':'Telangana','andhra pradesh':'Andhra Pradesh',
    'gujarat':'Gujarat','rajasthan':'Rajasthan','goa':'Goa',
    'uttar pradesh':'Uttar Pradesh','west bengal':'West Bengal',
    'madhya pradesh':'Madhya Pradesh','punjab':'Punjab',
    'haryana':'Haryana','odisha':'Odisha','jharkhand':'Jharkhand',
    'himachal pradesh':'Himachal Pradesh','uttarakhand':'Uttarakhand',
    'chandigarh':'Chandigarh',
    // Abbreviations
    'ka':'Karnataka','tn':'Tamil Nadu','kl':'Kerala',
    'mh':'Maharashtra','ts':'Telangana','ap':'Andhra Pradesh',
    'gj':'Gujarat','rj':'Rajasthan','up':'Uttar Pradesh',
    'wb':'West Bengal','mp':'Madhya Pradesh',
    // District names that map to state
    'kannur':'Kerala','kollam':'Kerala','thrissur':'Kerala',
    'palakkad':'Kerala','malappuram':'Kerala','kozhikode':'Kerala',
    'ernakulam':'Kerala','wayanad':'Kerala','idukki':'Kerala',
    'pathanamthitta':'Kerala','alappuzha':'Kerala',
    'thiruvananthapuram':'Kerala','kasaragod':'Kerala',
    'bengaluru':'Karnataka','mysuru':'Karnataka','mangaluru':'Karnataka',
    'chennai':'Tamil Nadu','coimbatore':'Tamil Nadu','madurai':'Tamil Nadu',
    'mumbai':'Maharashtra','pune':'Maharashtra','nagpur':'Maharashtra',
    'hyderabad':'Telangana','warangal':'Telangana',
    'ahmedabad':'Gujarat','surat':'Gujarat','vadodara':'Gujarat',
    'kolkata':'West Bengal',
  };
  Object.keys(states).forEach(function(k) {
    if (sl.indexOf(k) >= 0) {
      if (!r.state) r.state = states[k];
    }
  });

  // Cities / suburbs
  var cities = {
    // Karnataka
    'whitefield':'Bangalore','koramangala':'Bangalore','indiranagar':'Bangalore',
    'electronic city':'Bangalore','sarjapur':'Bangalore','jp nagar':'Bangalore',
    'yelahanka':'Bangalore','hebbal':'Bangalore','marathahalli':'Bangalore',
    'bangalore':'Bangalore','bengaluru':'Bangalore','blr':'Bangalore',
    'mysore':'Mysore','mysuru':'Mysore','mangalore':'Mangalore','mangaluru':'Mangalore',
    'hubli':'Hubli','dharwad':'Hubli',
    // Tamil Nadu
    'chennai':'Chennai','madras':'Chennai','anna nagar':'Chennai',
    'adyar':'Chennai','t nagar':'Chennai','velachery':'Chennai',
    'coimbatore':'Coimbatore','madurai':'Madurai','trichy':'Trichy',
    'salem':'Salem','tirunelveli':'Tirunelveli','vellore':'Vellore',
    // Kerala
    'trivandrum':'Thiruvananthapuram','thiruvananthapuram':'Thiruvananthapuram',
    'tvm':'Thiruvananthapuram',
    'kochi':'Kochi','ernakulam':'Kochi','cochin':'Kochi','aluva':'Kochi',
    'thrissur':'Thrissur','trichur':'Thrissur','tcr':'Thrissur',
    'chavakkad':'Thrissur','guruvayur':'Thrissur','guruvayoor':'Thrissur',
    'kozhikode':'Kozhikode','calicut':'Kozhikode',
    'palakkad':'Palakkad','pkd':'Palakkad',
    'kannur':'Kannur','cannanore':'Kannur',
    'kollam':'Kollam','quilon':'Kollam',
    'alappuzha':'Alappuzha','alleppey':'Alappuzha',
    'malappuram':'Malappuram','kottayam':'Kottayam',
    'idukki':'Idukki','wayanad':'Wayanad','kasaragod':'Kasaragod',
    'pathanamthitta':'Pathanamthitta',
    // Maharashtra
    'mumbai':'Mumbai','bombay':'Mumbai','bandra':'Mumbai','powai':'Mumbai',
    'andheri':'Mumbai','thane':'Mumbai','pune':'Pune','nagpur':'Nagpur',
    // Delhi
    'delhi':'Delhi','new delhi':'Delhi','noida':'Noida','gurgaon':'Gurgaon',
    'gurugram':'Gurgaon','faridabad':'Faridabad','ghaziabad':'Ghaziabad',
    // Telangana
    'hyderabad':'Hyderabad','secunderabad':'Hyderabad',
    'gachibowli':'Hyderabad','hitec city':'Hyderabad','kondapur':'Hyderabad',
    // Others
    'ahmedabad':'Ahmedabad','surat':'Surat','vadodara':'Vadodara',
    'kolkata':'Kolkata','calcutta':'Kolkata',
    'chandigarh':'Chandigarh','jaipur':'Jaipur','lucknow':'Lucknow',
    'bhopal':'Bhopal','indore':'Indore','patna':'Patna',
    'bhubaneswar':'Bhubaneswar','raipur':'Raipur',
    // UAE
    'dubai':'Dubai','sharjah':'Sharjah','abu dhabi':'Abu Dhabi',
    // Singapore / others
    'singapore':'Singapore',
  };
  Object.keys(cities).forEach(function(k) {
    if (sl.indexOf(k) >= 0) {
      if (!r.city) r.city = cities[k];
    }
  });

  // Fallback: take last 2 comma-separated parts as city/state
  if (!r.city) {
    var parts = s.split(',').map(function(p){ return p.trim(); }).filter(Boolean);
    if (parts.length >= 2) {
      // Strip PIN and common junk from last parts
      var last = parts[parts.length-1].replace(/\d+/,'').trim();
      var secondLast = parts[parts.length-2].replace(/\d+/,'').trim();
      if (last.length > 2 && !r.state) r.state = last;
      if (secondLast.length > 2 && !r.city) r.city = secondLast;
    } else if (parts.length === 1 && parts[0].length > 2) {
      r.city = parts[0];
    }
  }

  return r;
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function deduplicateGuestData(data) {
  var seen = {};
  var result = [];
  data.forEach(function(g) {
    var key = (g.bookerName||'').toLowerCase().trim() + '|' + (g.checkIn||'');
    if (!seen[key]) {
      seen[key] = true;
      result.push(g);
    }
    // GoogleForm wins: if we already have a form entry, skip DOCX entry
  });
  return result;
}

function normDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val)) return '';
    return val.toISOString().slice(0,10);
  }
  var s = String(val).trim();
  // Handle "May 12th 2026", "12/05/2026", "2026-05-12" etc.
  s = s.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  try {
    var d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0,10);
  } catch(e) {}
  return s;
}

function cleanPhone(phone) {
  if (!phone) return '';
  // Normalise to +91XXXXXXXXXX format where possible
  return String(phone).replace(/[\s\-\(\)]/g,'').trim();
}

function sqlStr(val) {
  if (val === null || val === undefined || String(val).trim() === '') return 'NULL';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function csvEscape(val) {
  if (!val) return '';
  var s = String(val);
  if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
    return '"' + s.replace(/"/g,'""') + '"';
  }
  return s;
}

function todayStr() {
  return new Date().toISOString().slice(0,10);
}

function deleteIfExists(folder, name) {
  var files = folder.getFilesByName(name);
  while (files.hasNext()) { files.next().setTrashed(true); }
}
