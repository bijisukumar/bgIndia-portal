// ============================================================
// bgIndia Portal — STANDALONE LOCATION BACKFILL SCRIPT v3
// ============================================================
// CREATE A NEW STANDALONE Apps Script project:
//   1. https://script.google.com → New project
//   2. Paste this entire file, replace all code
//   3. Enable "Drive API" advanced service:
//      Services (+ button) → Google Drive API → Add
//   4. Save, name it "bgIndia Location Backfill v3"
//   5. Run runDryRun() first — check email + CSV
//   6. If good, run runBackfill() → download SQL → run against D1
// ============================================================

var OWNER_EMAIL   = 'bijisukumar@gmail.com';
var DRIVE_ROOT_ID = '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva';
var MAIN_SHEET_ID = '1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ';
var STAYS_SHEET   = 'Stays';
var FORM_SHEET_ID = '1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0';
var WORKER_URL    = 'https://manage.luxuryvillasofguruvayur.com/api';

var FOLDER_2026 = '1IOisLwV7QxihMSRvlalolq1sMtW51QFt';
var FOLDER_2025 = '15fXmazoHTIeUf6Jq9bsaZHzZghzLBcaU';
var FOLDER_2024 = '1HYV_PRNezuHWC9iyL80TTtPuaNqBgJQs';

// Temp folder for Google Doc copies (created in Drive root)
var TEMP_FOLDER_NAME = '_bgIndia_backfill_temp';

// ── ENTRY POINTS ──────────────────────────────────────────────────────────
function runDryRun()  { processAll(true);  }
function runBackfill(){ processAll(false); }

// ── BATCH ENTRY POINTS (use these to avoid 6-min timeout) ─────────────────
// Run in order: step1 → step2 → step3 → step4 → stepFinish
// Each saves progress to Drive. Safe to re-run if one fails.

function step1_loadStays() {
  var stays = loadStaysFromSheet().concat(loadStaysFromWorker());
  var map = {};
  stays.forEach(function(s){ var id=s.stayId||s.stay_id||''; if(id&&!map[id])map[id]=s; });
  saveProgress('stays', Object.values(map));
  Logger.log('Saved ' + Object.values(map).length + ' stays');
}

function step2_readForms() {
  var data = readFormResponseSheet();
  saveProgress('guestData', data);
  Logger.log('Saved ' + data.length + ' form records');
}

function step3_read2026() {
  var existing = loadProgress('guestData') || [];
  var data = readYearFolder(FOLDER_2026, '2026', getTempFolder());
  var combined = dedup(existing.concat(data));
  saveProgress('guestData', combined);
  Logger.log('2026: ' + data.length + ' records. Total: ' + combined.length);
}

function step4_read2025() {
  var existing = loadProgress('guestData') || [];
  var data = readYearFolder(FOLDER_2025, '2025', getTempFolder());
  var combined = dedup(existing.concat(data));
  saveProgress('guestData', combined);
  Logger.log('2025: ' + data.length + ' records. Total: ' + combined.length);
}

function step5_read2024() {
  var existing = loadProgress('guestData') || [];
  var data = readYearFolder(FOLDER_2024, '2024', getTempFolder());
  var combined = dedup(existing.concat(data));
  saveProgress('guestData', combined);
  Logger.log('2024: ' + data.length + ' records. Total: ' + combined.length);
}

function step6_matchAndReport() {
  var stayList  = loadProgress('stays')     || [];
  var guestData = loadProgress('guestData') || [];
  Logger.log('Matching ' + guestData.length + ' guests against ' + stayList.length + ' stays');
  finishProcessing(true, stayList, guestData);   // true = dry run
}

function step7_generateSQL() {
  var stayList  = loadProgress('stays')     || [];
  var guestData = loadProgress('guestData') || [];
  Logger.log('Generating SQL for ' + guestData.length + ' guests');
  finishProcessing(false, stayList, guestData);  // false = full run
}

// ── PROGRESS HELPERS ───────────────────────────────────────────────────────
function getTempFolder() {
  var root = DriveApp.getFolderById(DRIVE_ROOT_ID);
  var tf = root.getFoldersByName(TEMP_FOLDER_NAME);
  return tf.hasNext() ? tf.next() : root.createFolder(TEMP_FOLDER_NAME);
}

function saveProgress(key, data) {
  var root = DriveApp.getFolderById(DRIVE_ROOT_ID);
  var fname = 'backfill_progress_' + key + '.json';
  del(root, fname);
  root.createFile(fname, JSON.stringify(data), 'application/json');
}

function loadProgress(key) {
  var root = DriveApp.getFolderById(DRIVE_ROOT_ID);
  var files = root.getFilesByName('backfill_progress_' + key + '.json');
  if (!files.hasNext()) return null;
  return JSON.parse(files.next().getBlob().getDataAsString());
}

function cleanProgress() {
  var root = DriveApp.getFolderById(DRIVE_ROOT_ID);
  ['stays','guestData'].forEach(function(k) { del(root, 'backfill_progress_' + k + '.json'); });
  Logger.log('Progress files cleaned');
}

// Utility: clean up temp folder after run
function cleanupTemp() {
  var root = DriveApp.getFolderById(DRIVE_ROOT_ID);
  var tf = root.getFoldersByName(TEMP_FOLDER_NAME);
  while (tf.hasNext()) { var f = tf.next(); f.setTrashed(true); }
  Logger.log('Temp folder cleaned up');
}

// ── CORE ──────────────────────────────────────────────────────────────────
function processAll(dryRun) {
  Logger.log('=== ' + (dryRun?'DRY RUN':'BACKFILL') + ' v3 STARTED ===');
  var tempFolder = getTempFolder();

  var sheetStays  = loadStaysFromSheet();
  var workerStays = loadStaysFromWorker();
  var stayMap = {};
  sheetStays.concat(workerStays).forEach(function(s) {
    var id = s.stayId || s.stay_id || '';
    if (id && !stayMap[id]) stayMap[id] = s;
  });
  var stayList = Object.values(stayMap);
  Logger.log('Stays loaded: ' + stayList.length);

  var guestData = [];
  guestData = guestData.concat(readFormResponseSheet());
  guestData = guestData.concat(readAllDocxFolders(tempFolder));
  guestData = dedup(guestData);
  Logger.log('Unique guest records: ' + guestData.length);

  finishProcessing(dryRun, stayList, guestData);
}

function finishProcessing(dryRun, stayList, guestData) {
  var matched = [], unmatched = [];
  guestData.forEach(function(g) {
    if (!g.bookerName || g.bookerName.length < 2) { unmatched.push(g); return; }
    var stay = findMatch(g.bookerName, g.checkIn, stayList);
    if (stay) matched.push({ guest:g, stay:stay });
    else       unmatched.push(g);
  });

  matched.forEach(function(m) {
    var g = m.guest;
    if (g.homeAddress && (!g.city || !g.state)) {
      var loc = geocode(g.homeAddress);
      if (loc.city)    g.city    = loc.city;
      if (loc.state)   g.state   = loc.state;
      if (loc.country && loc.country !== 'India') g.country = loc.country;
      if (loc.pincode) g.pincode = loc.pincode;
    }
  });

  // Build CSV
  var csv = ['Status,StayId,BookerName,CheckIn,Source,City,State,Country,Pincode,IdType,IdNum,Email,Phone,Score,Address'];
  matched.forEach(function(m) {
    var g=m.guest, sid=m.stay.stayId||m.stay.stay_id;
    csv.push(['MATCHED',sid,q(g.bookerName),g.checkIn,g.source,
      q(g.city),q(g.state),g.country,g.pincode,g.govtIdType,q(g.govtIdNum),
      q(g.email),q(g.phone),m.stay._score,q(g.homeAddress)].join(','));
  });
  unmatched.forEach(function(g) {
    csv.push(['UNMATCHED','',q(g.bookerName),g.checkIn,g.source,
      q(g.city),q(g.state),g.country,g.pincode,g.govtIdType,q(g.govtIdNum),
      q(g.email),q(g.phone),'',q(g.homeAddress)].join(','));
  });

  var root = DriveApp.getFolderById(DRIVE_ROOT_ID);
  var csvName = 'backfill-v3-' + today() + '.csv';
  del(root, csvName);
  var csvFile = root.createFile(csvName, csv.join('\n'), 'text/csv');

  // Stats
  var pct = stayList.length ? Math.round(matched.length/stayList.length*100) : 0;

  // ── UNMATCHED ANALYSIS ─────────────────────────────────────────────────
  // Categorise why each unmatched record failed
  var unmatchedAnalysis = unmatched.map(function(g) {
    var reason = '';
    if (!g.bookerName || g.bookerName.length < 2) {
      reason = 'NO_NAME: booker name missing or too short';
    } else if (!g.checkIn || g.checkIn.length < 8) {
      reason = 'NO_DATE: check-in date missing or unparseable';
    } else {
      // Try to find partial matches to understand why full match failed
      var bn = g.bookerName.toLowerCase().trim();
      var bFirst = bn.split(/\s+/)[0];
      var partialNames = stayList.filter(function(s) {
        var sn = String(s.bookerName||s.guestName||s.booker_name||s.guest_name||'').toLowerCase();
        return sn.indexOf(bFirst) >= 0 && bFirst.length > 2;
      });
      if (partialNames.length === 0) {
        reason = 'NAME_NOT_IN_DB: "'+g.bookerName+'" — first name "'+bFirst+'" not found in any stay';
      } else {
        // Name found but date didn't match
        var ciDate = new Date(g.checkIn);
        var closestDiff = 999;
        var closestStay = '';
        partialNames.forEach(function(s) {
          var stayCI = String(s.checkIn||s.checkin_date||'');
          if (stayCI) {
            var diff = Math.abs((ciDate - new Date(stayCI)) / 86400000);
            if (diff < closestDiff) { closestDiff = diff; closestStay = s.stayId||s.stay_id; }
          }
        });
        if (closestDiff <= 30) {
          reason = 'DATE_MISMATCH: name matches stay '+closestStay+' but dates differ by '+Math.round(closestDiff)+' days (form:'+g.checkIn+')';
        } else {
          reason = 'DATE_TOO_FAR: name "'+g.bookerName+'" found in DB but nearest stay is '+Math.round(closestDiff)+' days away';
        }
      }
    }
    return { bookerName: g.bookerName, checkIn: g.checkIn, source: g.source,
             email: g.email, reason: reason };
  });

  // Group by reason category
  var reasonGroups = {};
  unmatchedAnalysis.forEach(function(u) {
    var cat = u.reason.split(':')[0];
    if (!reasonGroups[cat]) reasonGroups[cat] = [];
    reasonGroups[cat].push(u);
  });

  var analysisLines = ['', '── UNMATCHED ANALYSIS (' + unmatched.length + ' records) ──'];
  Object.keys(reasonGroups).forEach(function(cat) {
    var group = reasonGroups[cat];
    analysisLines.push('');
    analysisLines.push(cat + ' (' + group.length + ' records):');
    group.forEach(function(u) {
      analysisLines.push('  • "' + u.bookerName + '" (' + u.checkIn + ') [' + u.source + ']');
      analysisLines.push('    → ' + u.reason);
      if (u.email) analysisLines.push('    email: ' + u.email);
    });
  });

  var summary = [
    (dryRun?'📋 DRY RUN v3':'✅ BACKFILL v3'),
    'Stays total:    ' + stayList.length,
    'Guest records:  ' + guestData.length,
    'Matched:        ' + matched.length + ' (' + pct + '%)',
    'Unmatched:      ' + unmatched.length,
    'With city:      ' + matched.filter(function(m){return m.guest.city;}).length + '/' + matched.length,
    'With email:     ' + matched.filter(function(m){return m.guest.email;}).length + '/' + matched.length,
    'With govt ID:   ' + matched.filter(function(m){return m.guest.govtIdNum;}).length + '/' + matched.length,
    '',
    'CSV: ' + csvFile.getUrl(),
  ].concat(analysisLines).join('\n');

  Logger.log(summary);

  var sqlUrl = '';
  if (!dryRun && matched.length > 0) {
    var sql = buildSql(matched);
    var sqlName = 'backfill-v3-' + today() + '.sql';
    del(root, sqlName);
    sqlUrl = root.createFile(sqlName, sql, 'text/plain').getUrl();
    Logger.log('SQL: ' + sqlUrl);
    summary += '\n\nSQL: ' + sqlUrl;
  }

  GmailApp.sendEmail(OWNER_EMAIL,
    '[bgIndia] Backfill v3 '+(dryRun?'Dry Run':'DONE')+': '+matched.length+' matched ('+pct+'%)',
    summary);

  Logger.log('=== DONE: matched='+matched.length+' unmatched='+unmatched.length+' ===');
}

// ── READ DOCX FILES ────────────────────────────────────────────────────────
function readAllDocxFolders(tempFolder) {
  var results = [];
  [[FOLDER_2026,'2026'],[FOLDER_2025,'2025'],[FOLDER_2024,'2024']].forEach(function(p) {
    try {
      var r = readYearFolder(p[0], p[1], tempFolder);
      Logger.log('Year ' + p[1] + ': ' + r.length + ' records');
      results = results.concat(r);
    } catch(e) { Logger.log('Year ' + p[1] + ' error: ' + e.message); }
  });
  return results;
}

function readYearFolder(folderId, year, tempFolder) {
  var results = [];
  var monthFolders = DriveApp.getFolderById(folderId).getFolders();
  while (monthFolders.hasNext()) {
    var mf = monthFolders.next();
    var guestFolders = mf.getFolders();
    while (guestFolders.hasNext()) {
      var gf = guestFolders.next();
      var files = gf.getFiles();
      var docxFile = null;
      while (files.hasNext()) {
        var f = files.next();
        var mt = f.getMimeType();
        var fn = f.getName().toLowerCase();
        // Only process the check-in DOCX — not IDs, not car photos
        if ((mt.indexOf('wordprocessing') >= 0 || mt.indexOf('document') >= 0) &&
            (fn.indexOf('checkin') >= 0 || fn.indexOf('check-in') >= 0 ||
             fn.indexOf('lvg') >= 0 || fn.indexOf('gvr') >= 0)) {
          docxFile = f; break;
        }
      }
      if (!docxFile) continue;
      try {
        var parsed = parseDocx(docxFile, year, tempFolder);
        if (parsed) results.push(parsed);
      } catch(e) {
        Logger.log('parseDocx error ' + docxFile.getName() + ': ' + e.message);
      }
    }
  }
  return results;
}

// ── DOCX READER: Upload+convert via Drive REST API ──────────────────────────
// Drive.Files.copy with convert:true is unreliable for DOCX.
// The correct method: use the Drive v2 upload API to re-upload the file
// with ?convert=true which forces Google to create a Google Doc copy.
// Then read with DocumentApp, then delete the copy.
function parseDocx(file, year, tempFolder) {
  var content = '';
  var tempDocId = null;

  // Method 1: Re-upload DOCX as Google Doc via multipart upload
  try {
    var blob = file.getBlob();
    var metadata = JSON.stringify({
      title: 'tmp_backfill_' + file.getId(),
      mimeType: 'application/vnd.google-apps.document',
      parents: [{ id: tempFolder.getId() }]
    });
    var boundary = '-------314159265358979';
    var body = '--' + boundary + '\r\n' +
      'Content-Type: application/json\r\n\r\n' +
      metadata + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: ' + blob.getContentType() + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      Utilities.base64Encode(blob.getBytes()) + '\r\n' +
      '--' + boundary + '--';

    var resp = UrlFetchApp.fetch(
      'https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&convert=true',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
          'Content-Type': 'multipart/mixed; boundary="' + boundary + '"',
        },
        payload: body,
        muteHttpExceptions: true,
      }
    );

    var result = JSON.parse(resp.getContentText());
    if (result.id) {
      tempDocId = result.id;
      var doc = DocumentApp.openById(tempDocId);
      content = doc.getBody().getText();
    } else {
      Logger.log('Upload convert failed for ' + file.getName() + ': ' + resp.getContentText().slice(0,200));
    }
  } catch(e) {
    Logger.log('parseDocx upload error ' + file.getName() + ': ' + e.message);
  } finally {
    if (tempDocId) {
      try { DriveApp.getFileById(tempDocId).setTrashed(true); } catch(e2) {}
    }
  }

  // Method 2 fallback: read the DOCX blob bytes, extract text from XML
  // DOCX is a ZIP — word/document.xml contains the text
  if (!content || content.length < 30) {
    try {
      content = extractTextFromDocxBlob(file.getBlob());
    } catch(e) {
      Logger.log('DOCX XML extract failed ' + file.getName() + ': ' + e.message);
    }
  }

  if (!content || content.length < 30) {
    Logger.log('No content extracted for: ' + file.getName());
    return null;
  }
  if (content.trim().startsWith('<!') || content.trim().startsWith('<html')) return null;

  return parseCheckInText(content, year, file.getName());
}

// Extract plain text from DOCX blob by unzipping and reading word/document.xml
function extractTextFromDocxBlob(blob) {
  // Utilities.unzip requires application/zip content type
  var zipBlob = blob.setContentType('application/zip');
  var zipBlobs = Utilities.unzip(zipBlob);
  var docXml = null;
  for (var i = 0; i < zipBlobs.length; i++) {
    if (zipBlobs[i].getName() === 'word/document.xml') {
      docXml = zipBlobs[i].getDataAsString('UTF-8');
      break;
    }
  }
  if (!docXml) return '';
  // Strip XML tags, preserve whitespace/newlines between paragraphs
  var text = docXml
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tc>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/\r\n|\r/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
  return text;
}

// ── PARSE THE TEXT CONTENT OF A CHECK-IN DOC ─────────────────────────────
function parseCheckInText(content, year, filename) {
  // ── BOOKER NAME ───────────────────────────────────────────────────────
  // Handles all observed formats:
  //   "Booked By/Approved Guest: Sangeeth"
  //   "Booked By/Approved Guest:Amith"  (no space)
  //   "Booked By/Approved GuestBivin"   (no colon)
  //   Exported text may have newlines between label and name
  var bookerName = '';
  var bookerMatch = content.match(
    /Booked By\/Approved Guest[:\s]*([^\n\r|]{2,50})/i
  ) || content.match(
    /Booked By[:\s]*([^\n\r|]{2,50})/i
  ) || content.match(
    /Approved Guest[:\s]*([^\n\r|]{2,50})/i
  );

  if (bookerMatch) {
    var raw = bookerMatch[1];
    // FIX: if captured value contains "/ Approved Guest:" extract after last colon
    if (raw.indexOf('Approved Guest') >= 0 || raw.indexOf('Booking Partner') >= 0) {
      var parts = raw.split(':');
      raw = parts[parts.length - 1];
    }
    // Strip "Booking Partner..." and everything after
    raw = raw.replace(/Booking Partner.*/i, '')
             .replace(/Number of Guests.*/i, '')
             .replace(/Nights of stay.*/i, '')
             .replace(/Check[\s-]in.*/i, '')
             .replace(/^[\s\/\-:]+/, '')  // leading slashes/colons
             .trim();
    // Reject garbage
    var garbage = ['booking partner','approved guest','booked by','number of','check in',
                   'check-in','check out','nights','list','name:','direct','airbnb',''];
    var isGarbage = garbage.some(function(g){ return raw.toLowerCase().indexOf(g)>=0; });
    if (!isGarbage && raw.length >= 2 && raw.length <= 60) bookerName = raw;
  }

  // Try folder name as fallback for booker name
  if (!bookerName && filename) {
    // filename like "AmithRamachandranNair-LVGGuestCheckIn.docx"
    var fnParts = filename.replace(/-LVGGuestCheckIn.*/i,'').replace(/-GVRGuestCheckIn.*/i,'');
    // CamelCase → words: "AmithRamachandranNair" → "Amith Ramachandran Nair"
    fnParts = fnParts.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    if (fnParts.length >= 2 && fnParts.length <= 60 && fnParts.indexOf('-') < 0) {
      bookerName = fnParts;
    }
  }

  // ── CHECK-IN DATE ─────────────────────────────────────────────────────
  var checkIn = '';
  var ciMatch = content.match(/Check[-\s]in[:\s]+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?[,\s]+(?:\d{4})?)/i) ||
                content.match(/Check[-\s]in[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i) ||
                content.match(/Check[-\s]in[:\s]+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?)/i);
  if (ciMatch) {
    var rawD = ciMatch[1].replace(/\b(\d+)(st|nd|rd|th)\b/gi,'$1');
    if (!/\d{4}/.test(rawD)) rawD += ' ' + year;
    checkIn = normDate(rawD);
    // Sanity check — reject "after 4 2026" type garbage
    if (checkIn && (checkIn.indexOf('aft') >= 0 || checkIn.length > 12)) checkIn = '';
  }

  // ── GOVT ID ───────────────────────────────────────────────────────────
  var govtIdType = '', govtIdNum = '';
  var idMatch = content.match(/Adhar\/Passport Number[:\s|]*([^\n|]{3,30})/i) ||
                content.match(/Aadhar[:\s|]+([^\n|]{3,30})/i);
  if (idMatch) {
    var idRaw = idMatch[1].replace(/^\||\|$/g,'').trim();
    var digits = idRaw.replace(/[\s\-]/g,'');
    if (/^\d{12}$/.test(digits))      { govtIdType='Aadhaar'; govtIdNum=digits; }
    else if (/^[A-Z]\d{7}$/.test(idRaw)) { govtIdType='Passport'; govtIdNum=idRaw; }
    else if (idRaw.length > 2 && idRaw !== '|' &&
             idRaw.toLowerCase() !== 'email' &&
             !idRaw.toLowerCase().startsWith('booking')) {
      govtIdType='Other'; govtIdNum=idRaw;
    }
  }

  // ── EMAIL & PHONE ─────────────────────────────────────────────────────
  var emailM = content.match(/Email[:\s|]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  var email  = emailM ? emailM[1].toLowerCase().trim() : '';

  var phoneM = content.match(/Phone[^:\n|]*[:\s|]+(\+?[\d\s\-\(\)\.]{7,20})/i);
  var phone  = phoneM ? cleanPhone(phoneM[1]) : '';

  // ── PURPOSE ───────────────────────────────────────────────────────────
  var purposeM = content.match(/Purpose of (?:Visit|Stay)[:\s|]*([^\n|]{2,50})/i);
  var purpose  = purposeM ? purposeM[1].replace(/^\||\|$/g,'').trim() : '';

  // ── ADDRESS from Guest row 1 ──────────────────────────────────────────
  // After XML strip, each table cell is on its own line.
  // Row 1 structure: line="1", line+1="GuestName/Age", line+2="Address"
  var homeAddress = '';
  var lines = content.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
  for (var i = 0; i < lines.length - 2; i++) {
    if (lines[i] === '1') {
      var nextLine = lines[i+1] || '';
      var addrLine = lines[i+2] || '';
      // Verify line+1 looks like a name/age field (contains / with digit, or just a name)
      var looksLikeName = /\/\d/.test(nextLine) || (nextLine.split(' ').length >= 2);
      // Verify line+2 looks like an address (has comma or digit or length > 8)
      var looksLikeAddr = addrLine.length > 5 && 
        (addrLine.indexOf(',') >= 0 || addrLine.indexOf('.') >= 0 || /\d/.test(addrLine));
      if (looksLikeName && looksLikeAddr) {
        homeAddress = addrLine;
        break;
      }
    }
  }

  // Fallback: look for line with 6-digit PIN code
  if (!homeAddress) {
    for (var j = 0; j < lines.length; j++) {
      if (/\b\d{6}\b/.test(lines[j]) && lines[j].indexOf('@') < 0 && lines[j].length > 8) {
        homeAddress = lines[j]; break;
      }
    }
  }

  var loc = parseAddress(homeAddress);

  if (!bookerName && !email) return null;

  return {
    source:      'DOCX-' + year,
    bookerName:  bookerName || '',
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

// ── FORM RESPONSE SHEET ───────────────────────────────────────────────────
function readFormResponseSheet() {
  var results = [];
  try {
    var data = SpreadsheetApp.openById(FORM_SHEET_ID).getSheets()[0].getDataRange().getValues();
    if (data.length < 2) return results;
    var h = data[0], lc = h.map(function(x){ return String(x).toLowerCase().trim(); });
    function col(kw){ for(var i=0;i<lc.length;i++) if(lc[i].indexOf(kw)>=0) return i; return -1; }
    var iA=col('full home address'), iB=col('bookers full name'), iCI=col('check in date'),
        iE=col('email address'), iP=col('phone number'),
        iId=col('adhar')>=0?col('adhar'):col('government id'), iPn=col('passport number'),
        iPu=col('purpose');
    data.slice(1).forEach(function(row) {
      var booker=iB>=0?String(row[iB]||'').trim():'';
      if (!booker) return;
      var addr=iA>=0?String(row[iA]||'').trim():'';
      var ci=iCI>=0?normDate(row[iCI]):'';
      var email=iE>=0?String(row[iE]||'').toLowerCase().trim():'';
      var phone=iP>=0?cleanPhone(String(row[iP]||'')):'';
      var idRaw=iId>=0?String(row[iId]||'').trim():'';
      var passNum=iPn>=0?String(row[iPn]||'').trim():'';
      var idType='', idNum='';
      if (passNum) { idType='Passport'; idNum=passNum; }
      else if (idRaw) {
        var am=idRaw.replace(/[\s\-]/g,'').match(/\d{12}/);
        if (am) { idType='Aadhaar'; idNum=am[0]; }
        else { idType='Other'; idNum=idRaw.replace(/^(AADHAR|AADHAAR|PASSPORT)[:\s\-]*/i,'').trim(); }
      }
      var loc=parseAddress(addr);
      results.push({source:'GoogleForm', bookerName:booker, checkIn:ci,
        homeAddress:addr, city:loc.city, state:loc.state, country:loc.country,
        pincode:loc.pincode, email:email, phone:phone, govtIdType:idType, govtIdNum:idNum,
        purpose:iPu>=0?String(row[iPu]||'').trim():''});
    });
  } catch(e) { Logger.log('Form sheet: '+e.message); }
  Logger.log('Form responses: '+results.length);
  return results;
}

// ── LOAD STAYS ─────────────────────────────────────────────────────────────
function loadStaysFromSheet() {
  try {
    var sheet = SpreadsheetApp.openById(MAIN_SHEET_ID).getSheetByName(STAYS_SHEET);
    if (!sheet) return [];
    var data=sheet.getDataRange().getValues(), h=data[0];
    return data.slice(1).map(function(row){
      var o={}; h.forEach(function(k,i){o[k]=row[i];}); return o;
    }).filter(function(r){ return r.stayId||r.stay_id; });
  } catch(e){ Logger.log('Sheet stays: '+e.message); return []; }
}

function loadStaysFromWorker() {
  try {
    var resp = callWorker('GET','getStays',{villaId:'dwarka',year:'all'});
    if (resp&&resp.success&&Array.isArray(resp.data)) return resp.data;
  } catch(e){ Logger.log('Worker stays: '+e.message); }
  return [];
}

// ── MATCHING ──────────────────────────────────────────────────────────────
function findMatch(bookerName, checkIn, stayList) {
  if (!bookerName||bookerName.length<2) return null;
  var bn=bookerName.toLowerCase().trim();
  var bParts=bn.split(/\s+/), bFirst=bParts[0], bLast=bParts[bParts.length-1];
  var ciDate=checkIn?new Date(checkIn):null;
  if (ciDate&&isNaN(ciDate)) ciDate=null;

  var best=null, bestScore=0;
  stayList.forEach(function(stay) {
    var sn=String(stay.bookerName||stay.guestName||stay.booker_name||stay.guest_name||'').toLowerCase().trim();
    if (!sn||sn.length<2) return;
    var sParts=sn.split(/\s+/), sFirst=sParts[0], sLast=sParts[sParts.length-1];

    var ns=0;
    if (sn===bn)                                              ns=100;
    else if (sFirst===bFirst&&sLast===bLast)                  ns=95;
    else if (sn.indexOf(bFirst)>=0&&sn.indexOf(bLast)>=0)    ns=80;
    else if (sFirst===bFirst&&sn.indexOf(bLast)>=0)          ns=75;
    else if (sFirst===bFirst)                                 ns=50;
    else if (sLast===bLast&&bLast.length>3)                  ns=45;
    else if (sn.indexOf(bFirst)>=0&&bFirst.length>3)         ns=35;
    if (ns<35) return;

    var ds=0;
    var stayCI=String(stay.checkIn||stay.checkin_date||stay.checkInDate||'');
    if (ciDate&&stayCI) {
      var diff=Math.abs((ciDate-new Date(stayCI))/86400000);
      if (diff===0) ds=100; else if(diff<=1) ds=65; else if(diff<=3) ds=35; else if(diff<=7) ds=15;
    } else { ds=20; }

    var total=ns+ds;
    if (total>bestScore&&total>=80) { bestScore=total; best=Object.assign({},stay); best._score=total; }
  });
  return best;
}

// ── ADDRESS PARSER ────────────────────────────────────────────────────────
function parseAddress(addr) {
  var r={city:'',state:'',country:'India',pincode:''};
  if (!addr) return r;
  // Normalise: dots used as separators → commas
  var s=addr.replace(/\.\s+/g,', ').replace(/\.\s*$/,'');
  // PIN code
  s=s.replace(/\bPIN[:\.\s]*(\d{6})\b/gi,function(m,p){r.pincode=p;return'';});
  if (!r.pincode){var pm=s.match(/\b(\d{6})\b/);if(pm){r.pincode=pm[1];s=s.replace(pm[0],'');}}
  var sl=s.toLowerCase();

  // Countries
  var cmap={'usa':'USA','united states':'USA','u.s':'USA','uk':'UK','united kingdom':'UK',
    'australia':'Australia','canada':'Canada','uae':'UAE','dubai':'UAE','sharjah':'UAE',
    'singapore':'Singapore','germany':'Germany','france':'France','malaysia':'Malaysia',
    'new zealand':'New Zealand','bahrain':'Bahrain','qatar':'Qatar','oman':'Oman',
    'kuwait':'Kuwait','saudi':'Saudi Arabia'};
  Object.keys(cmap).forEach(function(k){if(sl.indexOf(k)>=0)r.country=cmap[k];});

  // States
  var stmap={'karnataka':'Karnataka','tamil nadu':'Tamil Nadu','kerala':'Kerala',
    'maharashtra':'Maharashtra','delhi':'Delhi','telangana':'Telangana',
    'andhra pradesh':'Andhra Pradesh','gujarat':'Gujarat','rajasthan':'Rajasthan',
    'goa':'Goa','uttar pradesh':'Uttar Pradesh','west bengal':'West Bengal',
    'madhya pradesh':'Madhya Pradesh','punjab':'Punjab','haryana':'Haryana',
    'odisha':'Odisha','jharkhand':'Jharkhand','uttarakhand':'Uttarakhand',
    'himachal pradesh':'Himachal Pradesh',
    // Common district→state inferences
    'ernakulam':'Kerala','thrissur':'Kerala','kozhikode':'Kerala','kannur':'Kerala',
    'kollam':'Kerala','thiruvananthapuram':'Kerala','pathanamthitta':'Kerala',
    'alappuzha':'Kerala','kottayam':'Kerala','palakkad':'Kerala',
    'malappuram':'Kerala','idukki':'Kerala','wayanad':'Kerala','kasaragod':'Kerala',
    'bengaluru':'Karnataka','mysuru':'Karnataka','mangaluru':'Karnataka',
    'coimbatore':'Tamil Nadu','madurai':'Tamil Nadu','trichy':'Tamil Nadu',
    'hyderabad':'Telangana','warangal':'Telangana',
    'ahmedabad':'Gujarat','surat':'Gujarat',
    'kolkata':'West Bengal','bhubaneswar':'Odisha'};
  Object.keys(stmap).forEach(function(k){if(sl.indexOf(k)>=0&&!r.state)r.state=stmap[k];});

  // Cities (includes suburb→city mappings)
  var ctmap={
    'whitefield':'Bangalore','koramangala':'Bangalore','indiranagar':'Bangalore',
    'electronic city':'Bangalore','sarjapur':'Bangalore','marathahalli':'Bangalore',
    'hebbal':'Bangalore','yelahanka':'Bangalore','jp nagar':'Bangalore',
    'hsr layout':'Bangalore','btm layout':'Bangalore','jayanagar':'Bangalore',
    'bangalore':'Bangalore','bengaluru':'Bangalore',
    'mysore':'Mysore','mysuru':'Mysore',
    'mangalore':'Mangalore','mangaluru':'Mangalore',
    'dombivili':'Mumbai','dombivali':'Mumbai','thane':'Mumbai','mulund':'Mumbai',
    'bandra':'Mumbai','andheri':'Mumbai','powai':'Mumbai','borivali':'Mumbai',
    'mumbai':'Mumbai','bombay':'Mumbai','navi mumbai':'Mumbai',
    'pune':'Pune','nagpur':'Nagpur',
    'chennai':'Chennai','madras':'Chennai','anna nagar':'Chennai','adyar':'Chennai',
    'velachery':'Chennai','porur':'Chennai','chrompet':'Chennai','tambaram':'Chennai',
    'coimbatore':'Coimbatore','madurai':'Madurai','trichy':'Trichy','salem':'Salem',
    'delhi':'Delhi','new delhi':'Delhi','gurgaon':'Gurgaon','gurugram':'Gurgaon',
    'noida':'Noida','faridabad':'Faridabad','ghaziabad':'Ghaziabad','dwarka':'Delhi',
    'hyderabad':'Hyderabad','secunderabad':'Hyderabad','gachibowli':'Hyderabad',
    'hitec city':'Hyderabad','kondapur':'Hyderabad','manikonda':'Hyderabad',
    'ahmedabad':'Ahmedabad','surat':'Surat','vadodara':'Vadodara',
    'kolkata':'Kolkata','calcutta':'Kolkata','salt lake':'Kolkata',
    'kochi':'Kochi','cochin':'Kochi','ernakulam':'Kochi','aluva':'Kochi',
    'mulanthuruthy':'Kochi','kakkanad':'Kochi','edappally':'Kochi',
    'thrissur':'Thrissur','trichur':'Thrissur','tcr':'Thrissur',
    'chavakkad':'Thrissur','guruvayur':'Thrissur','guruvayoor':'Thrissur',
    'irinjalakuda':'Thrissur','chalakudy':'Thrissur','kunnamkulam':'Thrissur',
    'kozhikode':'Kozhikode','calicut':'Kozhikode',
    'kannur':'Kannur','cannanore':'Kannur','mattannur':'Kannur','thalassery':'Kannur',
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
    'chicago':'Chicago','houston':'Houston',
    'gokulam':'Kannur', // Bivin Babu's area
  };
  Object.keys(ctmap).forEach(function(k){if(sl.indexOf(k)>=0&&!r.city)r.city=ctmap[k];});

  // Fallback from comma-separated parts
  if (!r.city) {
    var parts=s.split(/[,]+/).map(function(p){return p.trim();}).filter(function(p){
      return p.length>2&&!/^\d+$/.test(p)&&p.toLowerCase()!=='india'&&p.toLowerCase()!=='kerala';
    });
    if (parts.length>=2) r.city=parts[parts.length-2];
    else if (parts.length===1) r.city=parts[0];
    r.city=(r.city||'').replace(/^(flat|house|no\.|plot|h\.no|door|ph\.?\s?\d|phase\s?\d)[^,]*/i,'').trim();
  }
  return r;
}

// ── GEOCODE ────────────────────────────────────────────────────────────────
function geocode(address) {
  var r={city:'',state:'',country:'India',pincode:''};
  if (!address||address.length<5) return r;
  try {
    Utilities.sleep(200); // rate limit
    var resp=Maps.newGeocoder().geocode(address+(address.toLowerCase().indexOf('india')<0?', India':''));
    if (!resp||!resp.results||!resp.results.length) return r;
    var comps=resp.results[0].address_components||[];
    comps.forEach(function(c){
      var t=c.types||[];
      if (t.indexOf('locality')>=0) r.city=c.long_name;
      else if (t.indexOf('sublocality_level_1')>=0&&!r.city) r.city=c.long_name;
      if (t.indexOf('administrative_area_level_1')>=0) r.state=c.long_name;
      if (t.indexOf('country')>=0) r.country=c.long_name;
      if (t.indexOf('postal_code')>=0) r.pincode=c.long_name;
    });
  } catch(e){ Logger.log('geocode error: '+e.message); }
  return r;
}

// ── SQL BUILDER ────────────────────────────────────────────────────────────
function buildSql(matched) {
  var lines=[
    '-- bgIndia Portal — Location Backfill v3',
    '-- Generated: '+new Date().toISOString(),
    '-- Matched: '+matched.length,
    '',
    '-- Ignore "duplicate column" errors for ALTER TABLE:',
    "ALTER TABLE stays ADD COLUMN home_address TEXT;",
    "ALTER TABLE stays ADD COLUMN city TEXT;",
    "ALTER TABLE stays ADD COLUMN state TEXT;",
    "ALTER TABLE stays ADD COLUMN country TEXT DEFAULT 'India';",
    "ALTER TABLE stays ADD COLUMN from_city TEXT;",
    "ALTER TABLE stays ADD COLUMN pincode TEXT;",
    "ALTER TABLE stays ADD COLUMN govt_id_type TEXT;",
    "ALTER TABLE stays ADD COLUMN govt_id_num TEXT;",
    '',
  ];
  // Deduplicate by stay_id
  var byStay={};
  matched.forEach(function(m){
    var sid=m.stay.stayId||m.stay.stay_id;
    if (!byStay[sid]||m.stay._score>byStay[sid].stay._score) byStay[sid]=m;
  });
  Object.keys(byStay).forEach(function(sid){
    var m=byStay[sid], g=m.guest;
    lines.push('-- '+g.bookerName+' · '+(g.checkIn||'?')+' → '+sid+' [score:'+m.stay._score+']');
    var sets=["  updated_by = 'system'","  updated_at = datetime('now')"];
    if (g.homeAddress) sets.push('  home_address = '+s(g.homeAddress));
    if (g.city)        sets.push('  city = '+s(g.city),'  from_city = '+s(g.city));
    if (g.state)       sets.push('  state = '+s(g.state));
    sets.push("  country = "+s(g.country||'India'));
    if (g.pincode)    sets.push('  pincode = '+s(g.pincode));
    if (g.govtIdType) sets.push('  govt_id_type = '+s(g.govtIdType));
    if (g.govtIdNum)  sets.push('  govt_id_num = '+s(g.govtIdNum));
    if (g.email)      sets.push('  guest_email = COALESCE(NULLIF(guest_email,\'\'),'+s(g.email)+')');
    if (g.phone)      sets.push('  guest_phone = COALESCE(NULLIF(guest_phone,\'\'),'+s(g.phone)+')');
    lines.push('UPDATE stays SET\n'+sets.join(',\n')+'\nWHERE stay_id = '+s(sid)+';');
    lines.push('');
  });
  lines.push("SELECT 'Updated' lbl, COUNT(*) cnt FROM stays WHERE from_city IS NOT NULL AND from_city!='';");
  lines.push("SELECT 'Missing city' lbl, COUNT(*) cnt FROM stays WHERE (from_city IS NULL OR from_city='') AND status NOT IN ('cancelled');");
  return lines.join('\n');
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function dedup(data) {
  var seen={}, res=[];
  data.forEach(function(g){
    var k=(g.bookerName||'').toLowerCase().trim()+'|'+(g.checkIn||'');
    if (!seen[k]){seen[k]=true;res.push(g);}
  });
  return res;
}
function normDate(val){
  if (!val) return '';
  if (val instanceof Date) return isNaN(val)?'':val.toISOString().slice(0,10);
  var v=String(val).trim().replace(/\b(\d+)(st|nd|rd|th)\b/gi,'$1');
  try{var d=new Date(v);if(!isNaN(d))return d.toISOString().slice(0,10);}catch(e){}
  return v;
}
function cleanPhone(p){return String(p||'').replace(/[^+\d]/g,'').slice(0,15);}
function s(v){if(!v||String(v).trim()==='')return 'NULL';return"'"+String(v).replace(/'/g,"''")+"'";}
function q(v){if(!v)return'';var sv=String(v);
  if(sv.indexOf(',')>=0||sv.indexOf('"')>=0||sv.indexOf('\n')>=0)return'"'+sv.replace(/"/g,'""')+'"';
  return sv;}
function today(){return new Date().toISOString().slice(0,10);}
function del(folder,name){var f=folder.getFilesByName(name);while(f.hasNext())f.next().setTrashed(true);}
function callWorker(method,action,payload){
  try{
    var url=WORKER_URL+'/'+action, opts={method:method.toLowerCase(),
      headers:{'Content-Type':'application/json','X-Actor':'auto'},muteHttpExceptions:true};
    if(method==='GET'&&payload&&Object.keys(payload).length>0)
      url+='?'+Object.keys(payload).map(function(k){
        return encodeURIComponent(k)+'='+encodeURIComponent(String(payload[k]||''));}).join('&');
    if(method==='POST') opts.payload=JSON.stringify(payload||{});
    return JSON.parse(UrlFetchApp.fetch(url,opts).getContentText());
  }catch(e){Logger.log('callWorker('+action+'): '+e.message);return null;}
}
