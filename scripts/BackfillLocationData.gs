// ============================================================
// BACKFILL LOCATION DATA FROM CHECK-IN FORMS
// ============================================================
// This Apps Script reads ALL check-in form responses (2024, 2025, 2026),
// parses the Full Home Address field, matches to D1 stays by
// booker name + check-in date, and generates a SQL backfill file.
//
// HOW TO RUN:
//   1. Open your main Apps Script (V20)
//   2. Paste this entire file at the bottom
//   3. Run backfillLocationData() once manually
//   4. It creates a file "backfill-location.sql" in your Drive root
//   5. Download it, then run:
//      wrangler d1 execute bgindia-db --file=backfill-location.sql --remote
//
// It will also email you a summary report.
// ============================================================

// Sheet IDs for all check-in form response sheets
var FORM_SHEETS = {
  '2026': '1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0',
  // Add 2024/2025 sheet IDs here if they are separate spreadsheets.
  // If all responses are in the same sheet (1Lt1...), leave as-is.
  // To find older sheet IDs: open the folder link → right-click sheet → Get link → copy ID
};

// Folder IDs for check-in documents (PDFs/images — used as fallback)
var FORM_FOLDERS = {
  '2026': '1IOisLwV7QxihMSRvlalolq1sMtW51QFt',
  '2024_2025': '1AKfO9T3_dusEalco9wF-aXaMghSpuzc8',
};

function backfillLocationData() {
  var results  = [];  // [{bookerName, checkIn, address, city, state, country, pincode, matched, stayId}]
  var unmatched = [];
  var sqlLines = [];
  var processed = 0;

  // ── STEP 1: Read all form response sheets ──────────────────────────────
  Object.keys(FORM_SHEETS).forEach(function(year) {
    var sheetId = FORM_SHEETS[year];
    try {
      var ss      = SpreadsheetApp.openById(sheetId);
      var sheet   = ss.getSheets()[0];
      var data    = sheet.getDataRange().getValues();
      if (data.length < 2) return;

      var headers = data[0];
      var lc      = headers.map(function(h) { return String(h).toLowerCase().trim(); });

      function colIdx(keyword) {
        for (var i = 0; i < lc.length; i++) {
          if (lc[i].indexOf(keyword) >= 0) return i;
        }
        return -1;
      }

      var addrIdx    = colIdx('full home address') >= 0 ? colIdx('full home address') : colIdx('address');
      var bookerIdx  = colIdx('bookers full name') >= 0 ? colIdx('bookers full name') : colIdx('booker');
      var checkInIdx = colIdx('check in date') >= 0 ? colIdx('check in date') : colIdx('check-in');
      var emailIdx   = colIdx('email address') >= 0 ? colIdx('email address') : colIdx('email');
      var phoneIdx   = colIdx('phone number') >= 0 ? colIdx('phone number') : colIdx('phone');
      var purposeIdx = colIdx('purpose of stay') >= 0 ? colIdx('purpose of stay') : colIdx('purpose');
      var guestIdx   = colIdx('list all guest') >= 0 ? colIdx('list all guest') : -1;

      Logger.log('Year ' + year + ': ' + (data.length-1) + ' responses');

      data.slice(1).forEach(function(row) {
        processed++;
        var bookerName  = bookerIdx  >= 0 ? String(row[bookerIdx]  || '').trim() : '';
        var checkIn     = checkInIdx >= 0 ? normaliseFormDate(row[checkInIdx]) : '';
        var homeAddress = addrIdx    >= 0 ? String(row[addrIdx]    || '').trim() : '';
        var email       = emailIdx   >= 0 ? String(row[emailIdx]   || '').trim() : '';
        var phone       = phoneIdx   >= 0 ? String(row[phoneIdx]   || '').trim() : '';
        var purpose     = purposeIdx >= 0 ? String(row[purposeIdx] || '').trim() : '';

        if (!bookerName || !homeAddress) return; // skip empty rows

        // Parse address → city, state, country, pincode
        var loc = parseAddress(homeAddress);

        results.push({
          bookerName:  bookerName,
          checkIn:     checkIn,
          homeAddress: homeAddress,
          city:        loc.city,
          state:       loc.state,
          country:     loc.country,
          pincode:     loc.pincode,
          fromCity:    loc.city,
          email:       email,
          phone:       phone,
          purpose:     purpose,
        });
      });
    } catch(e) {
      Logger.log('Error reading sheet ' + year + ': ' + e.message);
    }
  });

  Logger.log('Parsed ' + results.length + ' form responses from ' + processed + ' rows');

  // ── STEP 2: Match each response to a stay in D1 via Worker ────────────
  // We batch-read all stays from Sheets (faster than calling Worker per row)
  var allStays = sheetToObjects(SHEETS.STAYS);
  Logger.log('Loaded ' + allStays.length + ' stays from Sheets');

  results.forEach(function(r) {
    var match = findMatchingStay(r.bookerName, r.checkIn, allStays);

    if (match) {
      r.matched = true;
      r.stayId  = match.stayId || match.stay_id;

      // Generate SQL UPDATE
      var sql = "UPDATE stays SET " +
        "home_address = " + sqlStr(r.homeAddress) + ", " +
        "city         = " + sqlStr(r.city)        + ", " +
        "state        = " + sqlStr(r.state)       + ", " +
        "country      = " + sqlStr(r.country)     + ", " +
        "from_city    = " + sqlStr(r.city)        + ", " +
        "pincode      = " + sqlStr(r.pincode)     + ", " +
        "guest_email  = COALESCE(NULLIF(guest_email,''),  " + sqlStr(r.email)  + "), " +
        "guest_phone  = COALESCE(NULLIF(guest_phone,''),  " + sqlStr(r.phone)  + "), " +
        "updated_by   = 'system', " +
        "updated_at   = datetime('now') " +
        "WHERE stay_id = " + sqlStr(r.stayId) + ";";

      sqlLines.push("-- " + r.bookerName + " · " + r.checkIn + " → " + r.stayId);
      sqlLines.push(sql);
      sqlLines.push('');
    } else {
      r.matched = false;
      unmatched.push(r);
    }
  });

  // ── STEP 3: Write SQL file to Drive ───────────────────────────────────
  var header = [
    '-- ============================================================',
    '-- bgIndia Portal — Location Backfill',
    '-- Generated: ' + new Date().toISOString(),
    '-- Matched: ' + sqlLines.filter(function(l){ return l.startsWith('UPDATE'); }).length + ' stays',
    '-- Unmatched: ' + unmatched.length,
    '-- ============================================================',
    '',
    '-- Add pincode column if not already added:',
    "ALTER TABLE stays ADD COLUMN pincode TEXT;",
    '',
  ];

  var footer = [
    '',
    '-- VERIFICATION',
    "SELECT COUNT(*) as updated FROM stays WHERE from_city IS NOT NULL AND from_city != '';",
  ];

  var fullSql = header.concat(sqlLines).concat(footer).join('\n');

  // Save to Drive
  var root    = DriveApp.getFolderById(CONFIG.driveRootId);
  var fname   = 'backfill-location-' + new Date().toISOString().slice(0,10) + '.sql';
  var oldFiles = root.getFilesByName(fname);
  while (oldFiles.hasNext()) { oldFiles.next().setTrashed(true); }
  var file = root.createFile(fname, fullSql, 'text/plain');

  Logger.log('SQL file created: ' + file.getUrl());

  // ── STEP 4: Email summary report ──────────────────────────────────────
  var matchedCount   = results.filter(function(r){ return r.matched; }).length;
  var unmatchedNames = unmatched.map(function(r){
    return '  • ' + r.bookerName + ' (check-in: ' + r.checkIn + ') → Address: ' + r.homeAddress;
  }).join('\n');

  var report = [
    '📍 Location Backfill Report',
    '===========================',
    'Form responses parsed: ' + results.length,
    'Stays matched:         ' + matchedCount,
    'Unmatched (exceptions): ' + unmatched.length,
    '',
    'SQL file saved to Drive:',
    file.getUrl(),
    '',
    'NEXT STEP:',
    '1. Open the Drive link above',
    '2. Download the .sql file',
    '3. Run: wrangler d1 execute bgindia-db --file=backfill-location-YYYY-MM-DD.sql --remote',
    '',
  ].join('\n');

  if (unmatched.length > 0) {
    report += '⚠️ UNMATCHED EXCEPTIONS (' + unmatched.length + '):\n';
    report += 'These form responses could not be matched to a stay.\n';
    report += 'Manual review needed — check if booking was via Airbnb (different name)\n';
    report += 'or if the stay was cancelled.\n\n';
    report += unmatchedNames;
  }

  sendEmail('📍 Location backfill ready — ' + matchedCount + ' matched', report);
  Logger.log('Done. Matched: ' + matchedCount + ', Unmatched: ' + unmatched.length);

  return { matched: matchedCount, unmatched: unmatched.length, fileUrl: file.getUrl() };
}

// ── MATCHING LOGIC ────────────────────────────────────────────────────────
// Match by booker name (fuzzy) + check-in date (±1 day tolerance)
function findMatchingStay(bookerName, checkIn, allStays) {
  if (!bookerName) return null;

  var bn    = bookerName.toLowerCase().trim();
  var bFirst = bn.split(' ')[0];
  var bLast  = bn.split(' ').slice(-1)[0];
  var ciDate = checkIn ? new Date(checkIn) : null;

  var scored = [];

  allStays.forEach(function(stay) {
    var sn    = String(stay.bookerName || stay.guestName || stay.booker_name || stay.guest_name || '').toLowerCase().trim();
    if (!sn) return;

    var sFirst = sn.split(' ')[0];
    var sLast  = sn.split(' ').slice(-1)[0];

    // Name score
    var nameScore = 0;
    if (sn === bn)                           nameScore = 100;  // exact
    else if (sn.indexOf(bFirst) >= 0 && sn.indexOf(bLast) >= 0) nameScore = 80;  // first+last
    else if (sFirst === bFirst)              nameScore = 50;   // first name only
    else if (sLast === bLast)                nameScore = 40;   // last name only
    else if (sn.indexOf(bFirst) >= 0)        nameScore = 30;   // first name substring
    if (nameScore === 0) return;

    // Date score
    var dateScore = 0;
    if (ciDate && stay.checkIn) {
      var stayDate = new Date(stay.checkIn);
      var diffDays = Math.abs((ciDate - stayDate) / 86400000);
      if (diffDays === 0)      dateScore = 100;
      else if (diffDays <= 1)  dateScore = 70;
      else if (diffDays <= 3)  dateScore = 30;
    } else if (!ciDate) {
      dateScore = 20; // no date to match — use name only
    }

    var totalScore = nameScore + dateScore;
    if (totalScore >= 80) {  // minimum confidence threshold
      scored.push({ stay: stay, score: totalScore });
    }
  });

  if (scored.length === 0) return null;

  // Return highest-scored match
  scored.sort(function(a,b) { return b.score - a.score; });
  return scored[0].stay;
}

// ── ADDRESS PARSER ────────────────────────────────────────────────────────
// Handles various Indian address formats:
//   "#188, Phase I, Palm Meadows, Whitefield, Bangalore, Karnataka 560066"
//   "THANDAYAMAGATTIL HOUSE, PO CHAVAKKAD, TCR, KERALA"
//   "123 Main St, Brooklyn, NY 11201, USA"

function parseAddress(address) {
  var result = { city:'', state:'', country:'India', pincode:'' };
  if (!address) return result;

  var clean = address.trim();

  // Extract PIN code (6-digit Indian pincode)
  var pinMatch = clean.match(/\b(\d{6})\b/);
  if (pinMatch) {
    result.pincode = pinMatch[1];
    clean = clean.replace(pinMatch[0], '').trim();
  }

  // Known countries (non-India)
  var countryMap = {
    'USA': 'USA', 'United States': 'USA', 'US': 'USA',
    'UK': 'UK', 'United Kingdom': 'UK', 'England': 'UK',
    'Australia': 'Australia', 'Canada': 'Canada',
    'UAE': 'UAE', 'Dubai': 'UAE', 'Singapore': 'Singapore',
    'Germany': 'Germany', 'France': 'France', 'Malaysia': 'Malaysia',
    'New Zealand': 'New Zealand', 'Netherlands': 'Netherlands',
  };
  var foundCountry = null;
  Object.keys(countryMap).forEach(function(k) {
    if (clean.toLowerCase().indexOf(k.toLowerCase()) >= 0) {
      foundCountry = countryMap[k];
    }
  });
  if (foundCountry) {
    result.country = foundCountry;
    clean = clean.replace(new RegExp(foundCountry + '[,]?\\s*', 'gi'), '').trim();
  }

  // Known Indian states
  var stateMap = {
    'Karnataka': 'Karnataka', 'KA': 'Karnataka',
    'Kerala': 'Kerala', 'KL': 'Kerala',
    'Tamil Nadu': 'Tamil Nadu', 'TN': 'Tamil Nadu',
    'Maharashtra': 'Maharashtra', 'MH': 'Maharashtra',
    'Delhi': 'Delhi', 'New Delhi': 'Delhi',
    'Telangana': 'Telangana', 'TS': 'Telangana',
    'Andhra Pradesh': 'Andhra Pradesh', 'AP': 'Andhra Pradesh',
    'Gujarat': 'Gujarat', 'GJ': 'Gujarat',
    'Rajasthan': 'Rajasthan', 'RJ': 'Rajasthan',
    'Uttar Pradesh': 'Uttar Pradesh', 'UP': 'Uttar Pradesh',
    'West Bengal': 'West Bengal', 'WB': 'West Bengal',
    'Goa': 'Goa', 'Haryana': 'Haryana', 'Punjab': 'Punjab',
    'Odisha': 'Odisha', 'Jharkhand': 'Jharkhand',
    'Madhya Pradesh': 'Madhya Pradesh', 'MP': 'Madhya Pradesh',
    'Himachal Pradesh': 'Himachal Pradesh',
    'Uttarakhand': 'Uttarakhand',
  };
  var foundState = null;
  Object.keys(stateMap).forEach(function(k) {
    if (clean.toLowerCase().indexOf(k.toLowerCase()) >= 0) {
      if (!foundState || k.length > foundState.length) foundState = k;
    }
  });
  if (foundState) {
    result.state = stateMap[foundState];
    clean = clean.replace(new RegExp(foundState + '[,]?\\s*', 'gi'), '').trim();
  }

  // Known city abbreviations / alternates
  var cityMap = {
    'Bangalore': 'Bangalore', 'Bengaluru': 'Bangalore', 'BLR': 'Bangalore',
    'Chennai': 'Chennai', 'Madras': 'Chennai', 'MAA': 'Chennai',
    'Mumbai': 'Mumbai', 'Bombay': 'Mumbai', 'BOM': 'Mumbai',
    'Delhi': 'Delhi', 'New Delhi': 'Delhi',
    'Hyderabad': 'Hyderabad', 'HYD': 'Hyderabad',
    'Pune': 'Pune', 'Kochi': 'Kochi', 'Cochin': 'Kochi',
    'Thrissur': 'Thrissur', 'TCR': 'Thrissur', 'Trichur': 'Thrissur',
    'Guruvayur': 'Guruvayur', 'Guruvayoor': 'Guruvayur',
    'Coimbatore': 'Coimbatore', 'CBE': 'Coimbatore',
    'Ahmedabad': 'Ahmedabad', 'Surat': 'Surat',
    'Kolkata': 'Kolkata', 'Calcutta': 'Kolkata',
    'Chandigarh': 'Chandigarh', 'Jaipur': 'Jaipur',
    'Lucknow': 'Lucknow', 'Noida': 'Noida', 'Gurgaon': 'Gurgaon',
    'Whitefield': 'Bangalore', // known suburb → parent city
    'Koramangala': 'Bangalore',
    'Indiranagar': 'Bangalore',
    'Electronic City': 'Bangalore',
    'Anna Nagar': 'Chennai',
    'Adyar': 'Chennai',
    'Bandra': 'Mumbai',
    'Powai': 'Mumbai',
    'Gachibowli': 'Hyderabad',
    'HITEC City': 'Hyderabad',
    'Calicut': 'Kozhikode', 'Kozhikode': 'Kozhikode',
    'Chavakkad': 'Thrissur', // Chavakkad is in Thrissur district
    'Palakkad': 'Palakkad', 'PKD': 'Palakkad',
    'Malappuram': 'Malappuram',
    'Kannur': 'Kannur', 'Kasaragod': 'Kasaragod',
    'Thiruvananthapuram': 'Thiruvananthapuram', 'TVM': 'Thiruvananthapuram',
    'Kollam': 'Kollam', 'Alappuzha': 'Alappuzha',
    'Pathanamthitta': 'Pathanamthitta', 'Idukki': 'Idukki',
    'Ernakulam': 'Kochi', 'Aluva': 'Kochi',
    'Wayanad': 'Wayanad',
  };

  var foundCity = null;
  Object.keys(cityMap).forEach(function(k) {
    if (clean.toLowerCase().indexOf(k.toLowerCase()) >= 0) {
      if (!foundCity || k.length > (foundCity||'').length) foundCity = k;
    }
  });
  if (foundCity) {
    result.city = cityMap[foundCity];
  } else {
    // Fallback: take second-to-last comma-separated part as city
    var parts = clean.split(',').map(function(p){ return p.trim(); }).filter(Boolean);
    if (parts.length >= 2) {
      result.city = parts[parts.length - 1] || parts[parts.length - 2] || '';
    } else if (parts.length === 1) {
      result.city = parts[0];
    }
    // Remove common street/house prefixes
    result.city = result.city.replace(/^#?\d+.*?,\s*/,'').trim();
  }

  return result;
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function normaliseFormDate(val) {
  if (!val) return '';
  try {
    if (val instanceof Date) return val.toISOString().slice(0,10);
    var d = new Date(val);
    if (!isNaN(d)) return d.toISOString().slice(0,10);
  } catch(e) {}
  return String(val).trim();
}

function sqlStr(val) {
  if (!val || String(val).trim() === '') return 'NULL';
  return "'" + String(val).replace(/'/g, "''") + "'";
}
