// ============================================================
// bgIndia Portal — STANDALONE LOCATION BACKFILL SCRIPT v2
// ============================================================
// CREATE A NEW STANDALONE Apps Script project:
//   1. Go to https://script.google.com → New project
//   2. Paste this ENTIRE file — replace all default code
//   3. Save, name it "bgIndia Location Backfill v2"
//   4. Run runDryRun() first → review email + CSV
//   5. If satisfied, run runBackfill() → download SQL → run against D1
//
// Fully self-contained — no V21 script dependency.
// ============================================================

var OWNER_EMAIL   = 'bijisukumar@gmail.com';
var DRIVE_ROOT_ID = '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva';
var MAIN_SHEET_ID = '1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ';
var STAYS_SHEET   = 'Stays';
var FORM_SHEET_ID = '1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0';
var WORKER_URL    = 'https://manage.luxuryvillasofguruvayur.com/api';

// Year folder IDs
var FOLDER_2026 = '1IOisLwV7QxihMSRvlalolq1sMtW51QFt';
var FOLDER_2025 = '15fXmazoHTIeUf6Jq9bsaZHzZghzLBcaU';
var FOLDER_2024 = '1HYV_PRNezuHWC9iyL80TTtPuaNqBgJQs';

// ── ENTRY POINTS ──────────────────────────────────────────────────────────
function runDryRun()  { processAll(true);  }
function runBackfill(){ processAll(false); }

// ── CORE ──────────────────────────────────────────────────────────────────
function processAll(dryRun) {
  Logger.log('=== ' + (dryRun ? 'DRY RUN' : 'BACKFILL') + ' STARTED ===');

  // Load stays from TWO sources: Sheets (HIST- rows) + D1 via Worker
  var sheetStays  = loadStaysFromSheet();
  var workerStays = loadStaysFromWorker();
  var allStays    = sheetStays.concat(workerStays);
  // Deduplicate by stayId
  var seen = {}; var stayList = [];
  allStays.forEach(function(s) {
    var id = s.stayId || s.stay_id || '';
    if (!seen[id]) { seen[id] = true; stayList.push(s); }
  });
  Logger.log('Total stays: ' + stayList.length + ' (' + sheetStays.length + ' sheet + ' + workerStays.length + ' D1)');

  // Collect guest data from all DOCX folders + form sheet
  var guestData = [];
  guestData = guestData.concat(readFormResponseSheet());
  guestData = guestData.concat(readAllDocxFolders());
  guestData = dedup(guestData);
  Logger.log('Unique guest records: ' + guestData.length);

  // Match
  var matched = [], unmatched = [];
  guestData.forEach(function(g) {
    if (!g.bookerName || g.bookerName.length < 2) { unmatched.push(g); return; }
    var stay = findMatch(g.bookerName, g.checkIn, stayList);
    if (stay) matched.push({ guest: g, stay: stay });
    else       unmatched.push(g);
  });

  // For unmatched, try Google Places API to get city/state from address
  unmatched.forEach(function(g) {
    if (g.homeAddress && (!g.city || !g.state)) {
      var loc = geocodeAddress(g.homeAddress);
      if (loc.city)  g.city    = loc.city;
      if (loc.state) g.state   = loc.state;
      if (loc.country && loc.country !== 'India') g.country = loc.country;
      if (loc.pincode) g.pincode = loc.pincode;
    }
  });
  // Same for matched with missing city
  matched.forEach(function(m) {
    var g = m.guest;
    if (g.homeAddress && (!g.city || !g.state)) {
      var loc = geocodeAddress(g.homeAddress);
      if (loc.city)  g.city    = loc.city;
      if (loc.state) g.state   = loc.state;
      if (loc.country && loc.country !== 'India') g.country = loc.country;
      if (loc.pincode) g.pincode = loc.pincode;
    }
  });

  // Build CSV report
  var csv = ['Status,StayId,BookerName,CheckIn,Source,Address,City,State,Country,Pincode,IdType,IdNum,Email,Phone,Score'];
  matched.forEach(function(m) {
    csv.push([
      'MATCHED', m.stay.stayId||m.stay.stay_id,
      q(m.guest.bookerName), m.guest.checkIn, m.guest.source,
      q(m.guest.homeAddress), q(m.guest.city), q(m.guest.state),
      m.guest.country, m.guest.pincode,
      m.guest.govtIdType, q(m.guest.govtIdNum),
      q(m.guest.email), q(m.guest.phone), m.stay._score
    ].join(','));
  });
  unmatched.forEach(function(g) {
    csv.push([
      'UNMATCHED','',
      q(g.bookerName), g.checkIn, g.source,
      q(g.homeAddress), q(g.city), q(g.state),
      g.country, g.pincode,
      g.govtIdType, q(g.govtIdNum),
      q(g.email), q(g.phone), ''
    ].join(','));
  });

  var root    = DriveApp.getFolderById(DRIVE_ROOT_ID);
  var csvName = 'backfill-validation-v2-' + today() + '.csv';
  del(root, csvName);
  var csvFile = root.createFile(csvName, csv.join('\n'), 'text/csv');

  // Stats
  var withCity  = matched.filter(function(m){ return m.guest.city; }).length;
  var withEmail = matched.filter(function(m){ return m.guest.email; }).length;
  var withPhone = matched.filter(function(m){ return m.guest.phone; }).length;
  var withId    = matched.filter(function(m){ return m.guest.govtIdNum; }).length;
  var pct = stayList.length ? Math.round(matched.length/stayList.length*100) : 0;

  var summary = [
    (dryRun ? '📋 DRY RUN REPORT' : '✅ BACKFILL COMPLETE'),
    'Total stays:      ' + stayList.length + ' (Sheets + D1)',
    'Guest records:    ' + guestData.length,
    'Matched:          ' + matched.length + ' (' + pct + '% coverage)',
    'Unmatched:        ' + unmatched.length,
    '',
    'Of matched records:',
    '  With address:   ' + matched.filter(function(m){return m.guest.homeAddress;}).length,
    '  With city:      ' + withCity,
    '  With email:     ' + withEmail,
    '  With phone:     ' + withPhone,
    '  With govt ID:   ' + withId,
    '',
    'Validation CSV: ' + csvFile.getUrl(),
    '',
    'UNMATCHED (first 20):',
    unmatched.slice(0,20).map(function(g){
      return '  • ' + g.bookerName + ' (' + g.checkIn + ') [' + g.source + ']';
    }).join('\n'),
  ].join('\n');

  Logger.log(summary);
  Logger.log('=== MATCHED: ' + matched.length + ' UNMATCHED: ' + unmatched.length + ' ===');

  var sqlUrl = '';
  if (!dryRun && matched.length > 0) {
    var sql    = buildSql(matched);
    var sqlName = 'backfill-location-v2-' + today() + '.sql';
    del(root, sqlName);
    var sqlFile = root.createFile(sqlName, sql, 'text/plain');
    sqlUrl = sqlFile.getUrl();
    Logger.log('SQL: ' + sqlUrl);
    summary += '\n\nSQL file: ' + sqlUrl +
      '\nRun: wrangler d1 execute bgindia-db --file=' + sqlName + ' --remote';
  }

  GmailApp.sendEmail(OWNER_EMAIL,
    '[bgIndia] ' + (dryRun?'Dry Run':'Backfill') + ': ' + matched.length + ' matched / ' + pct + '% coverage',
    summary
  );

  return { matched: matched.length, unmatched: unmatched.length, pct: pct };
}

// ── LOAD STAYS ────────────────────────────────────────────────────────────
function loadStaysFromSheet() {
  try {
    var sheet = SpreadsheetApp.openById(MAIN_SHEET_ID).getSheetByName(STAYS_SHEET);
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var h = data[0];
    return data.slice(1).map(function(row) {
      var o = {}; h.forEach(function(k,i){ o[k]=row[i]; }); return o;
    }).filter(function(r){ return r.stayId||r.stay_id; });
  } catch(e) { Logger.log('loadStaysFromSheet error: '+e.message); return []; }
}

function loadStaysFromWorker() {
  try {
    var resp = callWorker('GET', 'getStays', { villaId:'dwarka', year:'all' });
    if (resp && resp.success && Array.isArray(resp.data)) return resp.data;
  } catch(e) { Logger.log('loadStaysFromWorker error: '+e.message); }
  return [];
}

// ── SOURCE A: FORM RESPONSE SHEET ─────────────────────────────────────────
function readFormResponseSheet() {
  var results = [];
  try {
    var data = SpreadsheetApp.openById(FORM_SHEET_ID).getSheets()[0].getDataRange().getValues();
    if (data.length < 2) return results;
    var h = data[0];
    var lc = h.map(function(x){ return String(x).toLowerCase().trim(); });
    function col(kw) { for(var i=0;i<lc.length;i++) if(lc[i].indexOf(kw)>=0) return i; return -1; }
    var iAddr=col('full home address'), iBook=col('bookers full name'),
        iCI=col('check in date'), iEmail=col('email address'), iPhone=col('phone number'),
        iId=col('adhar')>=0?col('adhar'):col('government id'), iPass=col('passport number'),
        iPurp=col('purpose');

    data.slice(1).forEach(function(row) {
      var booker = iBook>=0 ? String(row[iBook]||'').trim() : '';
      var addr   = iAddr>=0 ? String(row[iAddr]||'').trim() : '';
      var ci     = iCI>=0   ? normDate(row[iCI]) : '';
      var email  = iEmail>=0? String(row[iEmail]||'').toLowerCase().trim() : '';
      var phone  = iPhone>=0? cleanPhone(String(row[iPhone]||'')) : '';
      var idRaw  = iId>=0   ? String(row[iId]||'').trim() : '';
      var passNum= iPass>=0 ? String(row[iPass]||'').trim() : '';
      var purpose= iPurp>=0 ? String(row[iPurp]||'').trim() : '';
      if (!booker) return;

      var idType='', idNum='';
      if (passNum) { idType='Passport'; idNum=passNum; }
      else if (idRaw) {
        var am = idRaw.replace(/[\s\-]/g,'').match(/\d{12}/);
        if (am) { idType='Aadhaar'; idNum=am[0]; }
        else { idType='Other'; idNum=idRaw.replace(/^(AADHAR|AADHAAR|PASSPORT)[:\s\-]*/i,'').trim(); }
      }

      var loc = parseAddress(addr);
      results.push({ source:'GoogleForm', bookerName:booker, checkIn:ci,
        homeAddress:addr, city:loc.city, state:loc.state, country:loc.country,
        pincode:loc.pincode, email:email, phone:phone,
        govtIdType:idType, govtIdNum:idNum, purpose:purpose });
    });
  } catch(e) { Logger.log('readFormSheet: '+e.message); }
  Logger.log('Form sheet: '+results.length);
  return results;
}

// ── SOURCE B: DOCX CHECK-IN FORMS ─────────────────────────────────────────
function readAllDocxFolders() {
  var results = [];
  [[FOLDER_2026,'2026'],[FOLDER_2025,'2025'],[FOLDER_2024,'2024']].forEach(function(p){
    try {
      var r = readYearFolder(p[0], p[1]);
      Logger.log('Year '+p[1]+': '+r.length+' records');
      results = results.concat(r);
    } catch(e) { Logger.log('Folder '+p[1]+' error: '+e.message); }
  });
  return results;
}

function readYearFolder(yearFolderId, year) {
  var results = [];
  var monthFolders = DriveApp.getFolderById(yearFolderId).getFolders();
  while (monthFolders.hasNext()) {
    var monthFolder = monthFolders.next();
    var guestFolders = monthFolder.getFolders();
    while (guestFolders.hasNext()) {
      var guestFolder = guestFolders.next();
      // Try DOCX first
      var files = guestFolder.getFiles();
      var docxFile = null, pdfFile = null, aadhaarPdf = null;
      while (files.hasNext()) {
        var f = files.next();
        var fn = f.getName().toLowerCase();
        var mt = f.getMimeType();
        if ((mt.indexOf('wordprocessing')>=0 || mt.indexOf('document')>=0) &&
            (fn.indexOf('checkin')>=0||fn.indexOf('check-in')>=0||fn.indexOf('lvg')>=0||fn.indexOf('gvr')>=0))
          docxFile = f;
        if (mt==='application/pdf') {
          pdfFile = f;
          if (fn.indexOf('aadhaar')>=0||fn.indexOf('adhar')>=0||fn.indexOf('uid')>=0||fn.indexOf('unique')>=0)
            aadhaarPdf = f;
        }
      }
      var parsed = null;
      if (docxFile) {
        parsed = parseCheckInDocx(docxFile, year);
      }
      // If no DOCX or DOCX missing city, try reading Aadhaar/Passport PDF for address
      if (pdfFile && (!parsed || !parsed.city)) {
        var pdfData = parsePdf(pdfFile);
        if (parsed) {
          // Merge PDF address data into parsed
          if (!parsed.city    && pdfData.city)    parsed.city    = pdfData.city;
          if (!parsed.state   && pdfData.state)   parsed.state   = pdfData.state;
          if (!parsed.pincode && pdfData.pincode) parsed.pincode = pdfData.pincode;
          if (!parsed.homeAddress && pdfData.homeAddress) parsed.homeAddress = pdfData.homeAddress;
          if (!parsed.govtIdNum && pdfData.govtIdNum) {
            parsed.govtIdNum  = pdfData.govtIdNum;
            parsed.govtIdType = pdfData.govtIdType;
          }
        } else if (pdfData.name) {
          parsed = pdfData;
          parsed.source = 'PDF-'+year;
        }
      }
      if (parsed) results.push(parsed);
    }
  }
  return results;
}

function parseCheckInDocx(file, year) {
  var content = '';
  try {
    var url = 'https://docs.google.com/feeds/download/documents/export/Export?id='+file.getId()+'&exportFormat=txt';
    var resp = UrlFetchApp.fetch(url, {
      headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
      muteHttpExceptions:true
    });
    content = resp.getContentText();
  } catch(e) {
    try { content = file.getAs('text/plain').getDataAsString(); } catch(e2){}
  }
  if (!content || content.length < 50) return null;

  // ── BOOKER NAME ───────────────────────────────────────────────────────
  // Handles: "Booked By/Approved Guest:Amith" (no space after colon)
  //          "Booked By/Approved GuestBivin Babu" (no colon at all)
  //          "Booked By/Approved Guest: Sangeeth"
  var bookerName = '';
  var bookerMatch = content.match(/Booked By\/Approved Guest[:\s]*([^|\n\r]+)/i) ||
                    content.match(/Booked By[:\s]*([^|\n\r]+)/i) ||
                    content.match(/Approved Guest[:\s]*([^|\n\r]+)/i);
  if (bookerMatch) {
    // Clean: remove everything from "Booking Partner" onwards
    bookerName = bookerMatch[1]
      .replace(/Booking Partner.*/i, '')
      .replace(/Number of Guests.*/i, '')
      .replace(/Nights of stay.*/i, '')
      .trim();
  }
  // Validate — reject garbage values
  if (!bookerName || bookerName.toLowerCase().indexOf('booking partner') >= 0 ||
      bookerName.toLowerCase() === 'list' || bookerName.toLowerCase() === 'name:' ||
      bookerName.length < 2) {
    bookerName = '';
  }

  // ── CHECK-IN DATE ─────────────────────────────────────────────────────
  var checkIn = '';
  var ciMatch = content.match(/Check[-\s]in[:\s]+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?[,\s]+(?:\d{4})?)/i) ||
                content.match(/Check[-\s]in[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i) ||
                content.match(/Check[-\s]in[:\s]+([A-Za-z]+ \d{1,2})/i);
  if (ciMatch) {
    var rawDate = ciMatch[1].replace(/\b(\d+)(st|nd|rd|th)\b/gi,'$1');
    if (rawDate.indexOf(year) < 0) rawDate += ' ' + year;
    checkIn = normDate(rawDate);
  }

  // ── GOVT ID ───────────────────────────────────────────────────────────
  var govtIdType='', govtIdNum='';
  var idMatch = content.match(/Adhar\/Passport Number[:\s|]*([^\n|]+)/i) ||
                content.match(/Aadhaar[:\s]+([0-9\s]{11,15})/i) ||
                content.match(/Passport[:\s#]+([A-Z]\d{7})/i);
  if (idMatch) {
    var raw = idMatch[1].trim().replace(/^\||\|$/g,'').trim();
    var digits = raw.replace(/[\s\-]/g,'');
    if (/^\d{12}$/.test(digits)) { govtIdType='Aadhaar'; govtIdNum=digits; }
    else if (/^[A-Z]\d{7}$/.test(raw)) { govtIdType='Passport'; govtIdNum=raw; }
    else if (raw.length > 2 && raw !== '|') { govtIdType='Other'; govtIdNum=raw; }
  }

  // ── EMAIL & PHONE ─────────────────────────────────────────────────────
  var emailMatch = content.match(/Email[:\s|]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  var email = emailMatch ? emailMatch[1].trim().toLowerCase() : '';

  var phoneMatch = content.match(/Phone[^:|\n]*[:\s|]+(\+?[\d\s\-\(\)]{7,18})/i);
  var phone = phoneMatch ? cleanPhone(phoneMatch[1]) : '';

  // ── PURPOSE ───────────────────────────────────────────────────────────
  var purposeMatch = content.match(/Purpose of (?:Visit|Stay)[:\s|]*([^\n|]+)/i);
  var purpose = purposeMatch ? purposeMatch[1].replace(/^\||\|$/g,'').trim() : '';

  // ── ADDRESS from guest table row 1 ────────────────────────────────────
  // Match table row: "| 1 | GuestName/Age | Address |"
  // The address field uses periods, commas, spaces — need to capture all of it
  var homeAddress = '';
  var addrPatterns = [
    /\|\s*1\s*\|[^|]+\|\s*([^|]{10,})\s*\|/,          // standard 3-col table
    /Guest 1[:\s]+[^,\n]+[,\n]+([^|]{10,})/i,           // "Guest 1: Name, Address"
  ];
  for (var ap=0; ap<addrPatterns.length; ap++) {
    var am2 = content.match(addrPatterns[ap]);
    if (am2) {
      homeAddress = am2[1].trim()
        .replace(/\n/g, ', ')
        .replace(/\s+/g,' ')
        .replace(/,\s*,/g,',')
        .trim();
      // Remove if it's just the guest name repeated
      if (homeAddress.split(',').length < 2 && homeAddress.indexOf(' ') < 0) homeAddress = '';
      if (homeAddress) break;
    }
  }

  var loc = parseAddress(homeAddress);

  if (!bookerName && !email) return null;

  return {
    source:      'DOCX-'+year,
    bookerName:  bookerName,
    checkIn:     checkIn,
    homeAddress: homeAddress,
    city:        loc.city,
    state:       loc.state,
    country:     loc.country,
    pincode:     loc.pincode,
    email:       email,
    phone:       phone,
    govtIdType:  govtIdType,
    govtIdNum:   govtIdNum,
    purpose:     purpose,
  };
}

// ── PARSE PDF (Aadhaar / Passport) FOR ADDRESS ────────────────────────────
// Used as fallback when DOCX address is missing/incomplete
function parsePdf(file) {
  var result = { source:'PDF', name:'', homeAddress:'', city:'', state:'', country:'India',
                 pincode:'', govtIdType:'', govtIdNum:'' };
  try {
    var content = '';
    try {
      var url = 'https://docs.google.com/feeds/download/documents/export/Export?id='+
        file.getId()+'&exportFormat=txt';
      var resp = UrlFetchApp.fetch(url, {
        headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
        muteHttpExceptions:true
      });
      content = resp.getContentText();
    } catch(e) {}

    if (!content || content.length < 20) {
      // Read as plain text via MimeType conversion
      try { content = file.getAs('text/plain').getDataAsString(); } catch(e2){}
    }
    if (!content) return result;

    // Name — Aadhaar or Passport
    var nameMatch = content.match(/^([A-Z][a-z]+ [A-Z][a-zA-Z ]+)$/m) ||
                    content.match(/Given Name\(s\)[:\s]+([A-Z ]+)/i) ||
                    content.match(/Vikram|Amith|Sangeeth|Bivin/); // last resort

    // Aadhaar address block
    var addrMatch = content.match(/Address:\s*([\s\S]{10,200})(?=\n\n|\d{4} \d{4} \d{4}|$)/i) ||
                    content.match(/#\d+[,.]?[^,\n]+(,\s*[^,\n]+){2,}/);
    if (addrMatch) {
      result.homeAddress = addrMatch[1].replace(/\n/g,', ').replace(/\s+/g,' ').trim();
      var loc = parseAddress(result.homeAddress);
      result.city    = loc.city;
      result.state   = loc.state;
      result.country = loc.country;
      result.pincode = loc.pincode;
    }

    // Aadhaar number
    var uidMatch = content.match(/(\d{4}\s\d{4}\s\d{4})/);
    if (uidMatch) { result.govtIdType='Aadhaar'; result.govtIdNum=uidMatch[1].replace(/\s/g,''); }

    // Passport number
    var ppMatch = content.match(/Passport No\.\s*([A-Z]\d{7})/i) ||
                  content.match(/\b([A-Z]\d{7})\b/);
    if (ppMatch && !result.govtIdNum) { result.govtIdType='Passport'; result.govtIdNum=ppMatch[1]; }

    // PIN code from address
    if (!result.pincode) {
      var pinMatch = content.match(/\bPIN[:\s]+(\d{6})\b/i) || content.match(/\b(\d{6})\b/);
      if (pinMatch) result.pincode = pinMatch[1];
    }

  } catch(e) { Logger.log('parsePdf error: '+e.message); }
  return result;
}

// ── GEOCODE via Google Maps API (fallback for missing city/state) ──────────
// Uses Apps Script's built-in Maps service — no API key needed
function geocodeAddress(address) {
  var result = { city:'', state:'', country:'India', pincode:'' };
  if (!address || address.length < 5) return result;
  try {
    var resp = Maps.newGeocoder().geocode(address + ', India');
    if (!resp || !resp.results || !resp.results.length) return result;
    var components = resp.results[0].address_components || [];
    components.forEach(function(c) {
      var types = c.types || [];
      if (types.indexOf('locality') >= 0)              result.city    = c.long_name;
      else if (types.indexOf('sublocality_level_1') >= 0 && !result.city) result.city = c.long_name;
      if (types.indexOf('administrative_area_level_1') >= 0) result.state   = c.long_name;
      if (types.indexOf('country') >= 0)               result.country = c.long_name;
      if (types.indexOf('postal_code') >= 0)           result.pincode = c.long_name;
    });
  } catch(e) {
    Logger.log('geocode error for "'+address+'": '+e.message);
  }
  return result;
}

// ── MATCHING ──────────────────────────────────────────────────────────────
function findMatch(bookerName, checkIn, allStays) {
  if (!bookerName || bookerName.length < 2) return null;
  var bn     = bookerName.toLowerCase().trim();
  var bParts = bn.split(/\s+/);
  var bFirst = bParts[0];
  var bLast  = bParts[bParts.length-1];
  var ciDate = checkIn ? new Date(checkIn) : null;

  var best = null, bestScore = 0;

  allStays.forEach(function(stay) {
    var sRaw = String(stay.bookerName||stay.guestName||stay.booker_name||stay.guest_name||'');
    var sn   = sRaw.toLowerCase().trim();
    if (!sn || sn.length < 2) return;
    var sParts = sn.split(/\s+/);
    var sFirst = sParts[0];
    var sLast  = sParts[sParts.length-1];

    // Name score — flexible matching
    var nameScore = 0;
    if (sn === bn)                                           nameScore = 100;
    else if (sFirst===bFirst && sLast===bLast)               nameScore = 95;
    else if (sn.indexOf(bFirst)>=0 && sn.indexOf(bLast)>=0) nameScore = 80;
    else if (sFirst===bFirst && sn.indexOf(bLast)>=0)        nameScore = 75;
    else if (sFirst===bFirst)                                nameScore = 50;
    else if (sLast===bLast && bLast.length>3)                nameScore = 45;
    else if (sn.indexOf(bFirst)>=0 && bFirst.length>3)       nameScore = 35;
    if (nameScore < 35) return;

    // Date score
    var dateScore = 0;
    var stayCI = stay.checkIn||stay.checkin_date||stay.checkInDate||'';
    if (ciDate && stayCI) {
      var diff = Math.abs((ciDate - new Date(stayCI)) / 86400000);
      if (diff === 0)     dateScore = 100;
      else if (diff <= 1) dateScore = 65;
      else if (diff <= 3) dateScore = 35;
      else if (diff <= 7) dateScore = 15;
    } else if (!ciDate) {
      dateScore = 20; // no date — name-only match
    }

    var total = nameScore + dateScore;
    if (total > bestScore && total >= 80) {
      bestScore = total;
      best = Object.assign({}, stay);
      best._score = total;
    }
  });
  return best;
}

// ── SQL BUILDER ────────────────────────────────────────────────────────────
function buildSql(matched) {
  var lines = [
    '-- bgIndia Portal — Location Backfill v2',
    '-- Generated: ' + new Date().toISOString(),
    '-- Matched: ' + matched.length,
    '',
    '-- Add columns (ignore "duplicate column" errors — already added):',
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

  // Deduplicate matched by stay_id (take highest score)
  var byStay = {};
  matched.forEach(function(m) {
    var sid = m.stay.stayId || m.stay.stay_id;
    if (!byStay[sid] || m.stay._score > byStay[sid].stay._score) byStay[sid] = m;
  });

  Object.keys(byStay).forEach(function(sid) {
    var m = byStay[sid], g = m.guest;
    lines.push('-- ' + g.bookerName + ' · ' + (g.checkIn||'?') + ' → ' + sid + ' [score:'+m.stay._score+']');
    var sets = [
      "  updated_by   = 'system'",
      "  updated_at   = datetime('now')",
    ];
    if (g.homeAddress) sets.push("  home_address = "+s(g.homeAddress));
    if (g.city)        sets.push("  city         = "+s(g.city),
                                 "  from_city    = "+s(g.city));
    if (g.state)       sets.push("  state        = "+s(g.state));
    if (g.country)     sets.push("  country      = "+s(g.country||'India'));
    if (g.pincode)     sets.push("  pincode      = "+s(g.pincode));
    if (g.govtIdType)  sets.push("  govt_id_type = "+s(g.govtIdType));
    if (g.govtIdNum)   sets.push("  govt_id_num  = "+s(g.govtIdNum));
    if (g.email)       sets.push("  guest_email  = COALESCE(NULLIF(guest_email,''), "+s(g.email)+")");
    if (g.phone)       sets.push("  guest_phone  = COALESCE(NULLIF(guest_phone,''), "+s(g.phone)+")");
    lines.push('UPDATE stays SET');
    lines.push(sets.join(',\n'));
    lines.push('WHERE stay_id = '+s(sid)+';');
    lines.push('');
  });

  lines.push("SELECT 'Updated:' label, COUNT(*) cnt FROM stays WHERE from_city IS NOT NULL AND from_city != '';");
  lines.push("SELECT 'Missing city:' label, COUNT(*) cnt FROM stays WHERE (from_city IS NULL OR from_city='') AND status NOT IN ('cancelled');");
  return lines.join('\n');
}

// ── ADDRESS PARSER ─────────────────────────────────────────────────────────
// Handles dots AND commas as separators (Bivin Babu uses dots)
function parseAddress(addr) {
  var r = { city:'', state:'', country:'India', pincode:'' };
  if (!addr) return r;

  // Normalise: replace dots used as separators with commas
  // But don't replace dots in abbreviations (P.O., St.)
  var s2 = addr.replace(/\.\s+/g, ', ').replace(/\.\s*$/, '');
  s2 = s2.replace(/PIN[:\.\s]+(\d{6})/gi, function(m,p){ r.pincode=p; return ''; });

  // 6-digit pincode
  if (!r.pincode) {
    var pm = s2.match(/\b(\d{6})\b/);
    if (pm) { r.pincode = pm[1]; s2 = s2.replace(pm[0],''); }
  }

  var sl = s2.toLowerCase();

  // Countries
  var cmap = {'usa':'USA','united states':'USA','uk':'UK','united kingdom':'UK',
    'australia':'Australia','canada':'Canada','uae':'UAE','dubai':'UAE',
    'singapore':'Singapore','germany':'Germany','france':'France','malaysia':'Malaysia',
    'new zealand':'New Zealand','bahrain':'Bahrain','qatar':'Qatar','oman':'Oman',
    'kuwait':'Kuwait','saudi arabia':'Saudi Arabia','saudi':'Saudi Arabia'};
  Object.keys(cmap).forEach(function(k){if(sl.indexOf(k)>=0)r.country=cmap[k];});

  // States
  var stmap = {
    'karnataka':'Karnataka','tamil nadu':'Tamil Nadu','kerala':'Kerala',
    'maharashtra':'Maharashtra','delhi':'Delhi','new delhi':'Delhi',
    'telangana':'Telangana','andhra pradesh':'Andhra Pradesh',
    'gujarat':'Gujarat','rajasthan':'Rajasthan','goa':'Goa',
    'uttar pradesh':'Uttar Pradesh','west bengal':'West Bengal',
    'madhya pradesh':'Madhya Pradesh','punjab':'Punjab','haryana':'Haryana',
    'odisha':'Odisha','jharkhand':'Jharkhand','uttarakhand':'Uttarakhand',
    'himachal pradesh':'Himachal Pradesh','chandigarh':'Chandigarh',
    'bengaluru':'Karnataka','mysuru':'Karnataka','mangaluru':'Karnataka',
    'ernakulam':'Kerala','thrissur':'Kerala','kozhikode':'Kerala',
    'kannur':'Kerala','kollam':'Kerala','thiruvananthapuram':'Kerala',
    'pathanamthitta':'Kerala','alappuzha':'Kerala','kottayam':'Kerala',
    'palakkad':'Kerala','malappuram':'Kerala','idukki':'Kerala','wayanad':'Kerala',
    'kasaragod':'Kerala','coimbatore':'Tamil Nadu','madurai':'Tamil Nadu',
    'trichy':'Tamil Nadu','tirunelveli':'Tamil Nadu','vellore':'Tamil Nadu',
    'hyderabad':'Telangana','warangal':'Telangana',
    'ahmedabad':'Gujarat','surat':'Gujarat','vadodara':'Gujarat',
    'kolkata':'West Bengal','bhubaneswar':'Odisha','bhopal':'Madhya Pradesh',
    'indore':'Madhya Pradesh','jaipur':'Rajasthan','lucknow':'Uttar Pradesh',
    'noida':'Uttar Pradesh','gurgaon':'Haryana','faridabad':'Haryana',
  };
  Object.keys(stmap).forEach(function(k){
    if(sl.indexOf(k)>=0&&!r.state)r.state=stmap[k];
  });

  // Cities (including suburb→city mappings)
  var ctmap = {
    'whitefield':'Bangalore','koramangala':'Bangalore','indiranagar':'Bangalore',
    'electronic city':'Bangalore','sarjapur':'Bangalore','marathahalli':'Bangalore',
    'hebbal':'Bangalore','yelahanka':'Bangalore','jp nagar':'Bangalore',
    'bangalore':'Bangalore','bengaluru':'Bangalore',
    'mysore':'Mysore','mysuru':'Mysore',
    'mangalore':'Mangalore','mangaluru':'Mangalore',
    'dombivili':'Mumbai','dombivali':'Mumbai','thane':'Mumbai',
    'bandra':'Mumbai','andheri':'Mumbai','powai':'Mumbai','mulund':'Mumbai',
    'mumbai':'Mumbai','bombay':'Mumbai',
    'pune':'Pune','nagpur':'Nagpur',
    'chennai':'Chennai','madras':'Chennai','anna nagar':'Chennai',
    'adyar':'Chennai','velachery':'Chennai','porur':'Chennai',
    'coimbatore':'Coimbatore','madurai':'Madurai','trichy':'Trichy',
    'delhi':'Delhi','new delhi':'Delhi','gurgaon':'Gurgaon','gurugram':'Gurgaon',
    'noida':'Noida','faridabad':'Faridabad','ghaziabad':'Ghaziabad',
    'hyderabad':'Hyderabad','secunderabad':'Hyderabad','gachibowli':'Hyderabad',
    'hitec city':'Hyderabad','kondapur':'Hyderabad',
    'ahmedabad':'Ahmedabad','surat':'Surat','vadodara':'Vadodara',
    'kolkata':'Kolkata','calcutta':'Kolkata',
    'kochi':'Kochi','cochin':'Kochi','ernakulam':'Kochi',
    'aluva':'Kochi','mulanthuruthy':'Kochi','kakkanad':'Kochi',
    'thrissur':'Thrissur','trichur':'Thrissur','tcr':'Thrissur',
    'chavakkad':'Thrissur','guruvayur':'Thrissur','guruvayoor':'Thrissur',
    'kozhikode':'Kozhikode','calicut':'Kozhikode',
    'kannur':'Kannur','cannanore':'Kannur','mattannur':'Kannur',
    'kollam':'Kollam','karunagappally':'Kollam','vadakkumthala':'Kollam',
    'alappuzha':'Alappuzha','alleppey':'Alappuzha',
    'thiruvananthapuram':'Thiruvananthapuram','trivandrum':'Thiruvananthapuram',
    'kottayam':'Kottayam','palakkad':'Palakkad','malappuram':'Malappuram',
    'wayanad':'Wayanad','idukki':'Idukki','kasaragod':'Kasaragod',
    'pathanamthitta':'Pathanamthitta',
    'chandigarh':'Chandigarh','jaipur':'Jaipur','lucknow':'Lucknow',
    'bhopal':'Bhopal','indore':'Indore','bhubaneswar':'Bhubaneswar',
    'dubai':'Dubai','sharjah':'Sharjah','abu dhabi':'Abu Dhabi',
    'singapore':'Singapore','kuala lumpur':'Kuala Lumpur',
    'sydney':'Sydney','melbourne':'Melbourne','london':'London',
    'toronto':'Toronto','new york':'New York','dallas':'Dallas',
  };
  Object.keys(ctmap).forEach(function(k){
    if(sl.indexOf(k)>=0&&!r.city)r.city=ctmap[k];
  });

  // Fallback: parse comma/dot-separated parts
  if (!r.city) {
    var parts = s2.split(/[,]+/).map(function(p){return p.trim();}).filter(Boolean);
    // Remove parts that are pure numbers, very short, or "India"
    parts = parts.filter(function(p){
      return p.length>2 && !/^\d+$/.test(p) && p.toLowerCase()!=='india';
    });
    if (parts.length >= 2) {
      r.city = parts[parts.length-2];
    } else if (parts.length === 1) {
      r.city = parts[0];
    }
    // Clean street-level noise
    r.city = r.city.replace(/^(flat|house|no|plot|door|h\.?no|ph\.? ?[0-9]|phase)[^\,]*/i,'').trim();
  }

  return r;
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function dedup(data) {
  var seen = {}, result = [];
  data.forEach(function(g) {
    var key = (g.bookerName||'').toLowerCase().trim()+'|'+(g.checkIn||'');
    if (!seen[key]) { seen[key]=true; result.push(g); }
  });
  return result;
}

function normDate(val) {
  if (!val) return '';
  if (val instanceof Date) return isNaN(val)?'':val.toISOString().slice(0,10);
  var v = String(val).trim().replace(/\b(\d+)(st|nd|rd|th)\b/gi,'$1');
  try { var d=new Date(v); if(!isNaN(d)) return d.toISOString().slice(0,10); } catch(e){}
  return v;
}

function cleanPhone(p) {
  return String(p||'').replace(/[^+\d]/g,'').slice(0,15);
}

function s(v) {  // SQL string escape
  if(!v||String(v).trim()==='')return 'NULL';
  return "'"+String(v).replace(/'/g,"''")+"'";
}

function q(v) {  // CSV quote
  if(!v)return'';
  var sv=String(v);
  if(sv.indexOf(',')>=0||sv.indexOf('"')>=0||sv.indexOf('\n')>=0)
    return'"'+sv.replace(/"/g,'""')+'"';
  return sv;
}

function today() { return new Date().toISOString().slice(0,10); }

function del(folder, name) {
  var f=folder.getFilesByName(name);
  while(f.hasNext())f.next().setTrashed(true);
}

function callWorker(method, action, payload) {
  try {
    var url = WORKER_URL+'/'+action;
    var opts = {
      method:method.toLowerCase(),
      headers:{'Content-Type':'application/json','X-Actor':'auto'},
      muteHttpExceptions:true
    };
    if (method==='GET'&&payload&&Object.keys(payload).length>0)
      url+='?'+Object.keys(payload).map(function(k){
        return encodeURIComponent(k)+'='+encodeURIComponent(String(payload[k]||''));
      }).join('&');
    if (method==='POST') opts.payload=JSON.stringify(payload||{});
    var r=UrlFetchApp.fetch(url,opts);
    return JSON.parse(r.getContentText());
  } catch(e) { Logger.log('callWorker('+action+'): '+e.message); return null; }
}
