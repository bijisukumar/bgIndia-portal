// ============================================================
//  BG INDIA PORTAL — GOOGLE APPS SCRIPT BACKEND  V20
//  Deploy as Web App: Execute as Me | Anyone
//
//  CLEANUP NOTE (2026-06-24): this file previously had TWO
//  definitions of getOrCreateGuestFolder() — an old 2-argument
//  version here in the V20 section, and a newer 3-argument
//  version further down (added later to support year/month
//  folder organization). JavaScript silently uses whichever
//  definition comes LAST, so the old one below was already dead
//  code with no effect — but keeping two copies of a function
//  with the same name risks someone editing the wrong one later
//  and wondering why nothing changes. The old version is now
//  commented out and marked for deletion; the real, active one
//  is further down under "ACTIVE: 3-argument version".
// ============================================================

var CONFIG = {
  ownerEmail:       'bijisukumar@gmail.com',
  driveRootId:      '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva',
  spreadsheetId:    '1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ',
  guestFormSheetId: '1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0',
};

var SHEETS = {
  STAYS:         'Stays',
  VILLA_INCOME:  'VillaIncome',
  VILLA_EXPENSE: 'VillaExpense',
  KITCHEN:       'Kitchen',
  BREAKFAST:     'Breakfast',
  CAR_RENTAL:    'CarRental',
  RENTAL_INCOME: 'RentalIncome',
  COCONUT:       'CoconutHarvest',
  RUBBER:        'RubberHarvest',
  ESTATE_LEDGER: 'EstateLedger',
};

// 45-column Stays schema — columns grouped logically
// Dates: checkIn, checkOut, nights, bookedDate, confirmedAt  (cols 4-8)
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

function setCorsHeaders(output) { return output; }

// ── EMAIL ────────────────────────────────────────────────────────────────
function sendEmail(subject, body) {
  try { GmailApp.sendEmail(CONFIG.ownerEmail, '[GVR Portal] ' + subject, body); }
  catch(e) { Logger.log('Email failed: ' + e.message); }
}
function sendErrorEmail(context, err, extra) {
  sendEmail('🚨 ERROR: ' + context,
    'Context: ' + context + '\nMessage: ' + err.message + '\nStack: ' + (err.stack||'n/a') +
    (extra ? '\n\nExtra:\n' + extra : ''));
}

// ── ENTRY POINTS ─────────────────────────────────────────────────────────
function doGet(e) {
  var action = e.parameter.action, result;
  try {
    switch (action) {
      case 'getPendingCheckIns':  result = getPendingCheckIns();            break;
      case 'getActiveStay':       result = getActiveStay(e.parameter);      break;
      case 'getVillaDashboard':   result = getVillaDashboard(e.parameter);  break;
      case 'getStays':            result = getStays(e.parameter);           break;
      case 'getRamanUnpaid':      result = getRamanUnpaid(e.parameter);     break;
      case 'getRamanHistory':     result = getRamanHistory(e.parameter);    break;
      case 'getGuests':           result = getGuests(e.parameter);          break;
      case 'getCoconutHarvests':  result = getCoconutHarvests(e.parameter); break;
      case 'getRubberHarvests':   result = getRubberHarvests(e.parameter);  break;
      case 'getRentalIncome':     result = getRentalIncome(e.parameter);    break;
      case 'getEstateDashboard':  result = getEstateDashboard(e.parameter); break;
      default: result = { status: 'BG India Portal API ready', version: '20' };
    }
    return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success:true, data:result })).setMimeType(ContentService.MimeType.JSON));
  } catch(err) {
    sendErrorEmail('doGet:' + (action||'?'), err, JSON.stringify(e.parameter||{}));
    return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success:false, error:err.message })).setMimeType(ContentService.MimeType.JSON));
  }
}

function doPost(e) {
  var data, action, result;
  try {
    data   = e.parameter && e.parameter.payload ? JSON.parse(e.parameter.payload)
           : e.postData && e.postData.contents  ? JSON.parse(e.postData.contents)
           : e.parameter || {};
    action = data.action;
    switch (action) {
      case 'bulkInsertStay':        result = bulkInsertStay(data);        break;
      case 'confirmCheckIn':        result = confirmCheckIn(data);        break;
      case 'createBooking':         result = createBooking(data);         break;
      case 'deleteHistRows':        result = deleteHistRows(data);        break;
      case 'deleteTestRows':        result = deleteTestRows(data);        break;
      case 'markRamanPaid':         result = markRamanPaid(data);         break;
      case 'repairStay':            result = repairStay(data);            break;
      case 'saveBreakfastEntry':    result = saveBreakfastEntry(data);    break;
      case 'saveCarRental':         result = saveCarRental(data);         break;
      case 'saveCoconutHarvest':    result = saveCoconutHarvest(data);    break;
      case 'saveEstateTransaction': result = saveEstateTransaction(data); break;
      case 'saveKitchenEntry':      result = saveKitchenEntry(data);      break;
      case 'saveRentalIncome':      result = saveRentalIncome(data);      break;
      case 'saveRubberHarvest':     result = saveRubberHarvest(data);     break;
      case 'saveVillaExpense':      result = saveVillaExpense(data);      break;
      case 'saveVillaRentalIncome': result = saveVillaRentalIncome(data); break;
      case 'upsertGuest':           result = upsertGuest(data);           break;
      default: throw new Error('Unknown action: ' + action);
    }
    return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success:true, data:result })).setMimeType(ContentService.MimeType.JSON));
  } catch(err) {
    sendErrorEmail('doPost:' + (action||'?'), err, JSON.stringify(data||{},null,2));
    return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success:false, error:err.message })).setMimeType(ContentService.MimeType.JSON));
  }
}

// ── SHEET HELPERS ─────────────────────────────────────────────────────────
function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1,1,1,headers.length).setBackground('#1E2535').setFontColor('#C8903A').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendRow(sheetName, headers, row) {
  getOrCreateSheet(sheetName, headers).appendRow(row);
}

function sheetToObjects(sheetName) {
  var ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h,i) { obj[h] = row[i]; });
    return obj;
  });
}

function generateStayId() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var id = 'DWK-';
  for (var i=0; i<5; i++) id += chars.charAt(Math.floor(Math.random()*chars.length));
  return id;
}

function ts() { return new Date().toISOString(); }

// ============================================================
// STALE — COMMENTED OUT, SAFE TO DELETE LATER
// ============================================================
// This was the ORIGINAL getOrCreateGuestFolder (2-argument: no
// checkInDate). It created flat folders named "GuestName — StayId"
// directly under Guests/, with no year/month organization.
//
// It has had ZERO effect since the 3-argument version (further
// down this file, search "ACTIVE: 3-argument version") was added —
// JavaScript uses whichever function definition appears LAST when
// a name is declared twice, and the 3-arg version comes later in
// file order. Keeping the source here, commented, in case anything
// ever needs to reference the old flat-folder naming scheme; delete
// this whole block once you're confident nothing does.
//
// function getOrCreateGuestFolder(guestName, stayId) {
//   var root = DriveApp.getFolderById(CONFIG.driveRootId);
//   var gf = root.getFoldersByName('Guests');
//   var guestsFolder = gf.hasNext() ? gf.next() : root.createFolder('Guests');
//   var name = guestName + ' — ' + stayId;
//   var ex = guestsFolder.getFoldersByName(name);
//   return ex.hasNext() ? ex.next() : guestsFolder.createFolder(name);
// }

// Helper: build a Stays row array from data object (uses STAYS_HEADERS order)
function buildStayRow(d, folderUrl) {
  folderUrl = folderUrl || '';
  var gc = (parseInt(d.adults)||0)+(parseInt(d.children)||0)+(parseInt(d.infants)||0);
  return [
    d.stayId||'', d.villaId||'dwarka', d.guestName||'', d.bookerName||d.guestName||'',
    d.checkIn||'', d.checkOut||'', d.nights||0, d.bookedDate||'', d.confirmedAt||d.checkIn||'',
    gc||d.guestCount||0, d.adults||0, d.children||0, d.infants||0,
    d.citizenship||'Indian', d.govtId||'', d.phone||'', d.email||'',
    d.channel||'Direct', d.breakfastPrepaid||'No', d.additionalGuests||'No', d.transport||'No',
    d.purpose||'', d.eta||'', d.carNumber||'', d.carPhoto||'', d.platePhoto||'', folderUrl,
    d.status||'checked_out',
    d.gross||0, d.commPct||0, d.commAmt||0, d.gst||0, d.extraCharges||0, d.net||0,
    d.ramanComm||0, d.ramanPaid||'No', d.ramanPaidDate||'', d.ramanMonthly||0,
    d.cabService||0, d.carRental||0, d.carRentalMargin||0,
    d.cleaners||0, d.maintenance||0, d.review||'', d.source||''
  ];
}

// ── BULK INSERT ───────────────────────────────────────────────────────────
function bulkInsertStay(data) {
  appendRow(SHEETS.STAYS, STAYS_HEADERS, buildStayRow(data));
  return { inserted: true, stayId: data.stayId };
}

// ── DELETE / REPAIR ───────────────────────────────────────────────────────
function deleteHistRows(data) {
  var ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = ss.getSheetByName(SHEETS.STAYS);
  var rows = sheet.getDataRange().getValues();
  var stayIdIdx = rows[0].indexOf('stayId');
  var deleted = 0;
  for (var i = rows.length-1; i >= 1; i--) {
    if (String(rows[i][stayIdIdx]).startsWith('HIST-')) {
      sheet.deleteRow(i+1);
      deleted++;
    }
  }
  Logger.log('Deleted ' + deleted + ' HIST- rows');
  return { deleted: deleted };
}

function deleteTestRows(data) {
  var ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var deleted = 0;
  var staysSheet = ss.getSheetByName('Stays');
  if (staysSheet) {
    var sd = staysSheet.getDataRange().getValues();
    var gIdx = sd[0].indexOf('guestName');
    for (var i = sd.length-1; i>=1; i--) {
      if (String(sd[i][gIdx]).indexOf('DELETE ME') >= 0) { staysSheet.deleteRow(i+1); deleted++; }
    }
  }
  var expSheet = ss.getSheetByName('VillaExpense');
  if (expSheet) {
    var ed = expSheet.getDataRange().getValues();
    var cIdx = ed[0].indexOf('category');
    for (var j = ed.length-1; j>=1; j--) {
      if (String(ed[j][cIdx]).indexOf('TEST-EXPENSE') >= 0) { expSheet.deleteRow(j+1); deleted++; }
    }
  }
  return { deleted: deleted };
}

function repairStay(data) {
  var ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = ss.getSheetByName('Stays');
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var idIdx = headers.indexOf('stayId');
  for (var i=1; i<rows.length; i++) {
    if (String(rows[i][idIdx]) === String(data.stayId)) {
      var updates = ['checkIn','checkOut','guestName','bookerName','nights','gross','net','channel','status','bookedDate','confirmedAt'];
      updates.forEach(function(field) {
        if (data[field] !== undefined && data[field] !== null) {
          var col = headers.indexOf(field);
          if (col >= 0) sheet.getRange(i+1, col+1).setValue(data[field]);
        }
      });
      return { repaired: true, stayId: data.stayId, row: i+1 };
    }
  }
  return { repaired: false, stayId: data.stayId, error: 'Not found' };
}

// ── UPSERT GUEST ──────────────────────────────────────────────────────────
function upsertGuest(data) {
  var ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = ss.getSheetByName('Guests');
  var HEADERS = ['name','phone','email','country','fromCity','firstStay','lastStay','totalStays','totalNights'];
  if (!sheet) {
    sheet = ss.insertSheet('Guests');
    sheet.appendRow(HEADERS);
    sheet.getRange(1,1,1,HEADERS.length).setBackground('#1E2535').setFontColor('#C8903A').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var nameIdx = headers.indexOf('name');
  for (var i=1; i<rows.length; i++) {
    if (String(rows[i][nameIdx]).toLowerCase().trim() === String(data.name).toLowerCase().trim()) {
      var r = i+1;
      var get = function(col) { return sheet.getRange(r, headers.indexOf(col)+1).getValue(); };
      var set = function(col, val) { sheet.getRange(r, headers.indexOf(col)+1).setValue(val); };
      set('lastStay', data.lastStay||'');
      set('totalStays', (parseInt(get('totalStays'))||0) + (data.totalStays||1));
      set('totalNights', (parseInt(get('totalNights'))||0) + (data.totalNights||0));
      if (data.phone) set('phone', data.phone);
      if (data.email) set('email', data.email);
      if (data.country) set('country', data.country);
      return { upserted:'updated', name:data.name };
    }
  }
  sheet.appendRow([data.name||'',data.phone||'',data.email||'',data.country||'',
    data.fromCity||'',data.firstStay||'',data.lastStay||'',data.totalStays||1,data.totalNights||0]);
  return { upserted:'inserted', name:data.name };
}

// ── RAMAN COMMISSION ──────────────────────────────────────────────────────
function getRamanUnpaid(params) {
  var rows = sheetToObjects(SHEETS.STAYS).filter(function(r) {
    return r.ramanPaid !== 'Yes' && parseFloat(r.ramanComm||0) > 0;
  });
  var quarters = {};
  rows.forEach(function(r) {
    var d = new Date(r.checkIn||'');
    if (isNaN(d)) return;
    var q = 'Q' + Math.ceil((d.getMonth()+1)/3) + ' ' + d.getFullYear();
    if (!quarters[q]) quarters[q] = { label:q, stays:[], total:0 };
    quarters[q].stays.push(r);
    quarters[q].total += parseFloat(r.ramanComm||0);
  });
  return {
    totalUnpaid: rows.reduce(function(s,r){ return s+parseFloat(r.ramanComm||0); },0),
    unpaidCount: rows.length,
    quarters: Object.values(quarters).sort(function(a,b){ return a.label>b.label?1:-1; }),
  };
}

function markRamanPaid(data) {
  var paidDate = data.paidDate || new Date().toISOString().substring(0,10);
  var quarter = data.quarter || null;
  var ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = ss.getSheetByName(SHEETS.STAYS);
  var rows = sheet.getDataRange().getValues();
  var h = rows[0];
  var paidIdx = h.indexOf('ramanPaid'), dateIdx = h.indexOf('ramanPaidDate');
  var ciIdx = h.indexOf('checkIn'), commIdx = h.indexOf('ramanComm');
  var updated = 0, totalPaid = 0;
  for (var i=1; i<rows.length; i++) {
    if (String(rows[i][paidIdx])==='Yes') continue;
    if (parseFloat(rows[i][commIdx]||0)===0) continue;
    if (quarter) {
      var d = new Date(rows[i][ciIdx]||'');
      if (isNaN(d)) continue;
      var q = 'Q'+Math.ceil((d.getMonth()+1)/3)+' '+d.getFullYear();
      if (q!==quarter) continue;
    }
    sheet.getRange(i+1,paidIdx+1).setValue('Yes');
    sheet.getRange(i+1,dateIdx+1).setValue(paidDate);
    totalPaid += parseFloat(rows[i][commIdx]||0);
    updated++;
  }
  sendEmail('Raman paid ₹'+totalPaid.toLocaleString('en-IN'),
    'Marked '+updated+' stays\n'+(quarter||'All')+'\nDate: '+paidDate);
  return { updated:updated, totalPaid:totalPaid, paidDate:paidDate };
}

function getRamanHistory(params) {
  var rows = sheetToObjects(SHEETS.STAYS).filter(function(r) {
    return r.ramanPaid==='Yes' && parseFloat(r.ramanComm||0)>0;
  });
  var payments = {};
  rows.forEach(function(r) {
    var key = r.ramanPaidDate||'unknown';
    if (!payments[key]) payments[key] = { date:key, stays:0, total:0 };
    payments[key].stays++;
    payments[key].total += parseFloat(r.ramanComm||0);
  });
  return Object.values(payments).sort(function(a,b){ return b.date>a.date?1:-1; });
}

// ── CHECK-IN ──────────────────────────────────────────────────────────────
function getPendingCheckIns() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.guestFormSheetId);
    var sheet = ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    var headers = data[0];
    var rows = data.slice(1);
    var lcHeaders = headers.map(function(h){ return String(h).toLowerCase().trim(); });

    var ALIASES = [
      { key:'_email',            fn: function(h){ return h.includes('email address'); } },
      { key:'_phone',            fn: function(h){ return h.includes('phone number'); } },
      { key:'_guestNames',       fn: function(h){ return h.includes('list all guest'); } },
      { key:'_citizenship',      fn: function(h){ return h==='citizenship'; } },
      { key:'_additionalGuests', fn: function(h){ return h.includes('additional guest'); } },
      { key:'_eta',              fn: function(h){ return h.includes('estimated time'); } },
      { key:'_purpose',          fn: function(h){ return h.includes('purpose of stay'); } },
      { key:'_breakfast',        fn: function(h){ return h.includes('breakfast'); } },
      { key:'_transport',        fn: function(h){ return h.includes('airport'); } },
      { key:'_adultsCount',      fn: function(h){ return h.includes('guest count(adults)'); } },
      { key:'_childrenCount',    fn: function(h){ return h.includes('guest count') && h.includes('children'); } },
      { key:'_infantsCount',     fn: function(h){ return h.includes('guest count') && h.includes('infants'); } },
      { key:'_checkInDate',      fn: function(h){ return h.includes('check in date'); } },
      { key:'_checkOutDate',     fn: function(h){ return h.includes('check out date'); } },
      { key:'_bookerName',       fn: function(h){ return h.includes('bookers full name'); } },
      { key:'_visaInfo',         fn: function(h){ return h.includes('visa information')||h.includes('govt of india'); } },
      { key:'_aadhaar',          fn: function(h){ return (h.includes('aadhaar')||h.includes('adhar'))&&!h.includes('foreign'); } },
      { key:'_aadhaarUpload',    fn: function(h){ return h.includes('upload your id')&&!h.includes('foreign'); } },
      { key:'_passportNum',      fn: function(h){ return h.includes('foreign government id'); } },
      { key:'_passportUpload',   fn: function(h){ return h.includes('upload your foreign id'); } },
    ];

    var aliasMap = {};
    ALIASES.forEach(function(a) {
      var idx = -1;
      for (var i=0; i<lcHeaders.length; i++) { if (a.fn(lcHeaders[i])) { idx=i; break; } }
      aliasMap[a.key] = idx;
    });

    var confirmedKeys = [];
    try {
      var stays = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName('Stays');
      if (stays) {
        var sd = stays.getDataRange().getValues();
        var bIdx = sd[0].indexOf('bookerName'), cIdx = sd[0].indexOf('checkIn');
        sd.slice(1).forEach(function(row) {
          if (row[bIdx]) {
            var key = String(row[bIdx]).toLowerCase().trim();
            var dt  = String(row[cIdx]||'').substring(0,10);
            confirmedKeys.push(key+'|'+dt);
            confirmedKeys.push(key);
          }
        });
      }
    } catch(e) { Logger.log('Stays read error: '+e.message); }

    var bIdx2 = aliasMap['_bookerName'], cIdx2 = aliasMap['_checkInDate'];
    var results = [];
    rows.slice(-20).reverse().forEach(function(row) {
      var booker  = bIdx2>=0 ? String(row[bIdx2]||'').toLowerCase().trim() : '';
      var checkin = cIdx2>=0 ? String(row[cIdx2]||'').substring(0,10) : '';
      if (confirmedKeys.indexOf(booker+'|'+checkin)>=0 || confirmedKeys.indexOf(booker)>=0) return;
      var obj = {};
      headers.forEach(function(h,i){ obj[h.trim()]=row[i]; });
      obj['_timestamp'] = row[0];
      ALIASES.forEach(function(a) {
        var idx = aliasMap[a.key];
        obj[a.key] = idx>=0 ? (row[idx]!==undefined&&row[idx]!==null?row[idx]:'') : '';
      });
      obj['_adultsCount']   = obj['_adultsCount']   || 0;
      obj['_childrenCount'] = obj['_childrenCount'] || 0;
      obj['_infantsCount']  = obj['_infantsCount']  || 0;
      results.push(obj);
    });
    return results;
  } catch(e) {
    sendErrorEmail('getPendingCheckIns', e, '');
    return [];
  }
}

function getGuests(params) {
  var ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = ss.getSheetByName('Guests');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length<2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj={}; headers.forEach(function(h,i){ obj[h]=row[i]; }); return obj;
  });
}

function getStays(params) {
  var villaId = params.villaId||'dwarka';
  var year = params.year||new Date().getFullYear();
  var rows = sheetToObjects(SHEETS.STAYS);
  return rows.filter(function(r) {
    if (r.villaId!==villaId) return false;
    if (String(year)==='all') return true;
    var ci = String(r.checkIn||'');
    return ci.indexOf(String(year))!==-1;
  });
}

function getActiveStay(params) {
  var villaId = params.villaId||'dwarka';
  var stays = sheetToObjects(SHEETS.STAYS).filter(function(s){
    return s.villaId===villaId && s.status==='active';
  });
  if (!stays.length) return null;
  stays.sort(function(a,b){ return new Date(b.checkIn)-new Date(a.checkIn); });
  return stays[0];
}

function confirmCheckIn(data) {
  var bookerName = (data.bookerName||data.guestName||'').toLowerCase().trim();
  var checkInDate = String(data.checkInDate||'').substring(0,10);
  try {
    var sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName('Stays');
    if (sheet) {
      var sd = sheet.getDataRange().getValues();
      var h = sd[0];
      var bIdx=h.indexOf('bookerName'), cIdx=h.indexOf('checkIn'), sIdx=h.indexOf('stayId');
      for (var i=1; i<sd.length; i++) {
        if (String(sd[i][bIdx]).toLowerCase().trim()===bookerName &&
            String(sd[i][cIdx]).substring(0,10)===checkInDate) {
          throw new Error('Already confirmed: '+data.bookerName+' ('+sd[i][sIdx]+')');
        }
      }
    }
  } catch(e) {
    if (e.message.indexOf('Already confirmed')===0) throw e;
    Logger.log('Dup check error: '+e.message);
  }

  var stayId = generateStayId();
  var guestName = data.guestName||'Guest';
  // Uses the ACTIVE 3-argument getOrCreateGuestFolder (see further down
  // this file) — passes the check-in date so folders get organized by
  // year/month rather than landing flat under Guests/.
  var folder = getOrCreateGuestFolder(guestName, stayId, data.checkInDate || data.checkIn);
  var folderUrl = folder.getUrl();
  var carPhotoUrl='', platePhotoUrl='';
  try {
    if (data.carPhotoB64) {
      carPhotoUrl = folder.createFile(Utilities.newBlob(Utilities.base64Decode(data.carPhotoB64),'image/jpeg','car-photo.jpg')).getUrl();
    }
    if (data.platePhotoB64) {
      platePhotoUrl = folder.createFile(Utilities.newBlob(Utilities.base64Decode(data.platePhotoB64),'image/jpeg','plate-photo.jpg')).getUrl();
    }
  } catch(e) { Logger.log('Photo error: '+e.message); }

  var nights = (function(){
    try {
      var ci=new Date(data.checkInDate), co=new Date(data.checkOutDate);
      return Math.round((co-ci)/(1000*60*60*24));
    } catch(e){ return 0; }
  })();

  appendRow(SHEETS.STAYS, STAYS_HEADERS, buildStayRow({
    stayId: stayId, villaId: data.villaId||'dwarka',
    guestName: guestName, bookerName: data.bookerName||guestName,
    checkIn: data.checkInDate, checkOut: data.checkOutDate, nights: nights,
    bookedDate: '', confirmedAt: ts(),
    adults: data.adultsCount||0, children: data.childrenCount||0, infants: data.infantsCount||0,
    citizenship: data.citizenship||'Indian', govtId: data.govtId||'',
    phone: data.phone||'', email: data.email||'',
    channel: data.channel||'Direct', breakfastPrepaid: data.breakfastPrepaid||'No',
    additionalGuests: data.additionalGuests||'No', transport: data.transport||'No',
    purpose: data.purpose||'', eta: data.eta||'', carNumber: data.carNumber||'',
    carPhoto: carPhotoUrl, platePhoto: platePhotoUrl,
    status: 'active', gross:0, commPct:0, commAmt:0, gst:0, extraCharges:0, net:0,
    ramanComm:0, ramanPaid:'No', source:'checkin',
  }, folderUrl));

  sendEmail('Check-in: '+guestName,
    'Stay: '+stayId+'\nGuests: '+((parseInt(data.adultsCount)||0)+(parseInt(data.childrenCount)||0))+
    '\nCheck-in: '+data.checkInDate+'\nCheck-out: '+data.checkOutDate+'\nCar: '+(data.carNumber||'—')+'\nFolder: '+folderUrl);
  return { stayId:stayId, folderUrl:folderUrl };
}

// ============================================================
// STALE — COMMENTED OUT, CANDIDATE FOR DELETION ~2026-08-23
// ============================================================
// CONFIRMED DEAD CODE (2026-06-24): this function has a real bug
// (references an undefined variable 'guestName' instead of
// 'bookerName' — would throw ReferenceError if it ever ran), but it
// is NOT actually reachable from anything in normal use:
//   - The real Airbnb auto-import path (pollAirbnbBookings, further
//     down this file) calls callWorker('POST', 'createBooking', ...)
//     — that's the Cloudflare WORKER's createBooking action
//     (functions/api/[[route]].js), a completely different function
//     living in a different codebase, unaffected by this bug.
//   - The "New booking" screen in the React app (NewBooking.jsx)
//     calls api.createBooking(...), which POSTs directly to
//     /api/createBooking — i.e. the same Worker action above. It
//     never touches this Apps Script at all.
//   - The ONLY thing that calls this local function is the doPost(e)
//     switch statement below (case 'createBooking') — meaning it only
//     runs if something POSTs directly to this Apps Script's own web
//     app URL with {action: 'createBooking', ...} in the body, which
//     nothing in the actual product does today.
// Commented out rather than deleted outright, in case anything
// turns up in the next ~60 days that did rely on it after all. If no
// failures or "Unknown action: createBooking" errors show up in that
// window, safe to delete this whole block for real.
//
// function createBooking(data) {
//   var stayId = generateStayId();
//   var bookerName = data.bookerName||'Guest';
//   var folder = getOrCreateGuestFolder(guestName, stayId, data.checkInDate || data.checkIn);
//   var folderUrl = folder.getUrl();
//   appendRow(SHEETS.STAYS, STAYS_HEADERS, buildStayRow({
//     stayId:stayId, villaId:data.villaId||'dwarka',
//     guestName:bookerName, bookerName:bookerName,
//     checkIn:data.checkInDate, checkOut:data.checkOutDate, nights:data.nights||0,
//     bookedDate:'', confirmedAt:ts(),
//     channel:data.channel||'Direct', status:data.status||'booked',
//     gross:data.gross||0, commPct:data.commPct||0, commAmt:data.commAmt||0,
//     extraCharges:data.extraCharges||0, net:data.net||0,
//     source:'booking',
//   }, folderUrl));
//   sendEmail('New booking: '+bookerName,
//     'Stay: '+stayId+'\n'+data.checkInDate+' → '+data.checkOutDate+'\nGross: ₹'+(data.gross||0));
//   return { stayId:stayId, folderUrl:folderUrl };
// }

// ── VILLA INCOME / EXPENSE / KITCHEN / BREAKFAST / CAR ───────────────────
function saveVillaRentalIncome(data) {
  appendRow(SHEETS.VILLA_INCOME,
    ['timestamp','villaId','guestName','checkInDate','checkOutDate','nights','rooms','channel','tariffPerNight','extraCharges','gross','commPct','commAmt','net','notes'],
    [ts(),data.villaId||'dwarka',data.guestName,data.checkInDate,data.checkOutDate,data.nights,data.rooms,data.channel,data.tariffPerNight,data.extraCharges||0,data.gross,data.commPct,data.commAmt,data.net,data.notes||'']);
  return { saved:true };
}
function saveKitchenEntry(data) {
  appendRow(SHEETS.KITCHEN,
    ['timestamp','stayId','guestName','items','totalAmount','notes'],
    [ts(),data.stayId||'',data.guestName||'',JSON.stringify(data.items||[]),data.totalAmount||0,data.notes||'']);
  return { saved:true };
}
function saveBreakfastEntry(data) {
  appendRow(SHEETS.BREAKFAST,
    ['timestamp','stayId','guestName','date','guestCount','ratePerPerson','total','notes'],
    [ts(),data.stayId||'',data.guestName||'',data.date,data.guestCount||0,data.ratePerPerson||275,data.total||0,data.notes||'']);
  return { saved:true };
}
function saveCarRental(data) {
  appendRow(SHEETS.CAR_RENTAL,
    ['timestamp','stayId','guestName','date','destination','amount','commission','net','notes'],
    [ts(),data.stayId||'',data.guestName||'',data.date,data.destination||'',data.amount||0,data.commission||0,data.net||0,data.notes||'']);
  return { saved:true };
}
function saveVillaExpense(data) {
  appendRow(SHEETS.VILLA_EXPENSE,
    ['timestamp','villaId','date','category','amount','paidTo','description'],
    [ts(),data.villaId||'dwarka',data.date,data.category,data.amount,data.paidTo||'',data.description||'']);
  return { saved:true };
}

// ── RENTAL INCOME ─────────────────────────────────────────────────────────
function saveRentalIncome(data) {
  var month=data.month, year=data.year, props=data.properties||[];
  props.forEach(function(p,i) {
    var net=(parseFloat(p.rent)||0)+(parseFloat(p.carParking)||0)
      -(parseFloat(p.maintenance)||0)-(parseFloat(p.electricity)||0)
      -(parseFloat(p.water)||0)-(parseFloat(p.propertyTax)||0)
      -(parseFloat(p.landTax)||0)-(parseFloat(p.extraMaintenance)||0);
    appendRow(SHEETS.RENTAL_INCOME,
      ['timestamp','month','year','propertyId','propertyName','rent','maintenance','electricity','water','propertyTax','landTax','carParking','extraMaintenance','net'],
      [ts(),month,year,'rental_'+(i+1),'Property '+String.fromCharCode(65+i),
       p.rent||0,p.maintenance||0,p.electricity||0,p.water||0,p.propertyTax||0,p.landTax||0,p.carParking||0,p.extraMaintenance||0,net]);
  });
  return { saved:true };
}
function getRentalIncome(params) {
  return sheetToObjects(SHEETS.RENTAL_INCOME).filter(function(r) {
    return String(r.month)===String(params.month)&&String(r.year)===String(params.year);
  });
}

// ── COCONUT / RUBBER / ESTATE ─────────────────────────────────────────────
function saveCoconutHarvest(data) {
  appendRow(SHEETS.COCONUT,
    ['timestamp','estate','harvestDate','paymentDate','harvesterName','totalCount','rejectionCount','netCount','totalWeight','pricePerKg','totalAmount','rejectionRevenue','dehuskRate','dehuskTotal','transport','otherCharges','totalExpenses','netIncome','notes'],
    [ts(),data.estate||'pollachi',data.harvestDate,data.paymentDate||'',data.harvesterName||'',
     data.totalCount||0,data.rejectionCount||0,data.netCount||0,data.totalWeight||0,data.pricePerKg||0,
     data.totalAmount||0,data.rejectionRevenue||0,data.dehuskRate||1.5,data.dehuskTotal||0,
     data.transport||0,data.otherCharges||0,data.totalExpenses||0,data.netIncome||0,data.notes||'']);
  return { saved:true };
}
function getCoconutHarvests(params) {
  var year=params.year||new Date().getFullYear();
  var rows=sheetToObjects(SHEETS.COCONUT).filter(function(r){
    return r.estate==='pollachi'&&r.harvestDate&&String(r.harvestDate).indexOf(String(year))!==-1;
  });
  return {
    totalHarvests:rows.length,
    totalCount:rows.reduce(function(s,r){return s+(parseFloat(r.totalCount)||0);},0),
    grossRevenue:Math.round(rows.reduce(function(s,r){return s+(parseFloat(r.totalAmount)||0);},0)),
    netIncome:Math.round(rows.reduce(function(s,r){return s+(parseFloat(r.netIncome)||0);},0)),
    harvests:rows.map(function(r){return{date:r.harvestDate,count:r.totalCount,weight:r.totalWeight,pricePerKg:r.pricePerKg,harvester:r.harvesterName,netIncome:Math.round(parseFloat(r.netIncome)||0)};}).reverse(),
  };
}
function saveRubberHarvest(data) {
  appendRow(SHEETS.RUBBER,
    ['timestamp','estate','tappingDate','paymentDate','tapperName','latexKg','rejectionKg','netKg','pricePerKg','totalAmount','rejectionRevenue','tapperWages','transport','otherCharges','totalExpenses','netIncome','notes'],
    [ts(),data.estate||'pavutumuri',data.tappingDate,data.paymentDate||'',data.tapperName||'',
     data.latexKg||0,data.rejectionKg||0,data.netKg||0,data.pricePerKg||0,data.totalAmount||0,
     data.rejectionRevenue||0,data.tapperWages||0,data.transport||0,data.otherCharges||0,
     data.totalExpenses||0,data.netIncome||0,data.notes||'']);
  return { saved:true };
}
function getRubberHarvests(params) {
  var year=params.year||new Date().getFullYear();
  return sheetToObjects(SHEETS.RUBBER).filter(function(r){
    return r.estate==='pavutumuri'&&r.tappingDate&&String(r.tappingDate).indexOf(String(year))!==-1;
  });
}
function saveEstateTransaction(data) {
  appendRow(SHEETS.ESTATE_LEDGER,
    ['timestamp','estate','type','date','category','amount','paidTo','description'],
    [ts(),data.estate,data.type,data.date,data.category,data.amount,data.paidTo||'',data.description||'']);
  return { saved:true };
}
function getEstateTransactions(params) {
  return sheetToObjects(SHEETS.ESTATE_LEDGER).filter(function(r){
    return r.estate===params.estateId&&r.date&&String(r.date).indexOf(String(params.year))!==-1;
  });
}

// ── VILLA DASHBOARD ───────────────────────────────────────────────────────
function getVillaDashboard(params) {
  var villaId=params.villaId||'dwarka';
  var year=parseInt(params.year)||new Date().getFullYear();
  var stays=sheetToObjects(SHEETS.STAYS).filter(function(r){
    return r.villaId===villaId&&String(r.checkIn||'').indexOf(String(year))!==-1&&r.status!=='cancelled';
  });
  var kitchen=sheetToObjects(SHEETS.KITCHEN);
  var breakfast=sheetToObjects(SHEETS.BREAKFAST);
  var carRental=sheetToObjects(SHEETS.CAR_RENTAL);
  var expenses=sheetToObjects(SHEETS.VILLA_EXPENSE).filter(function(r){
    return r.villaId===villaId&&String(r.date||'').indexOf(String(year))!==-1;
  });
  var months={};
  for (var m=0;m<12;m++) months[m]={revenue:0,fees:0,bookings:0,direct:0,nights:0,breakdown:{tariff:0,carRental:0,kitchen:0,breakfast:0,events:0}};
  stays.forEach(function(r){
    var m=new Date(r.checkIn||'').getMonth();
    if (isNaN(m)) return;
    var gross=parseFloat(r.gross||0);
    months[m].revenue+=gross; months[m].fees+=parseFloat(r.commAmt||0);
    months[m].bookings+=1; months[m].nights+=parseInt(r.nights||0);
    months[m].breakdown.tariff+=gross;
    months[m].breakdown.carRental+=parseFloat(r.carRentalMargin||r.carRental||0);
    if ((r.channel||'Direct')==='Direct') months[m].direct+=1;
  });
  kitchen.forEach(function(r){var m=new Date(r.timestamp||'').getMonth();if(!isNaN(m))months[m].breakdown.kitchen+=parseFloat(r.totalAmount||0);});
  breakfast.forEach(function(r){var m=new Date(r.timestamp||'').getMonth();if(!isNaN(m))months[m].breakdown.breakfast+=parseFloat(r.total||0);});
  carRental.forEach(function(r){var m=new Date(r.timestamp||'').getMonth();if(!isNaN(m))months[m].breakdown.carRental+=parseFloat(r.net||0);});
  var totalExp=expenses.reduce(function(s,r){return s+(parseFloat(r.amount)||0);},0);
  Object.keys(months).forEach(function(m){
    var mo=months[m];
    mo.profit=Math.round(mo.revenue-mo.fees-(totalExp/12));
    mo.margin=mo.revenue>0?Math.round((mo.profit/mo.revenue)*100):0;
    mo.directRatio=mo.bookings>0?mo.direct+'/'+mo.bookings:'—';
  });
  var quarterly={
    Q1:[0,1,2].reduce(function(s,m){return s+(months[m].profit||0);},0),
    Q2:[3,4,5].reduce(function(s,m){return s+(months[m].profit||0);},0),
    Q3:[6,7,8].reduce(function(s,m){return s+(months[m].profit||0);},0),
    Q4:[9,10,11].reduce(function(s,m){return s+(months[m].profit||0);},0),
  };
  var mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var bestIdx=Object.keys(months).reduce(function(b,m){return months[m].revenue>months[b].revenue?m:b;},0);
  var chCounts={};
  stays.forEach(function(r){chCounts[r.channel||'Direct']=(chCounts[r.channel||'Direct']||0)+1;});
  var topCh=Object.keys(chCounts).sort(function(a,b){return chCounts[b]-chCounts[a];})[0]||'—';
  var totalNights=stays.reduce(function(s,r){return s+(parseInt(r.nights)||0);},0);
  return {
    months:months, quarterly:quarterly, bestMonth:mn[bestIdx],
    directSaving:stays.filter(function(r){return (r.channel||'Direct')!=='Direct';}).reduce(function(s,r){return s+(parseFloat(r.commAmt)||0);},0),
    avgNights:stays.length>0?Math.round((totalNights/stays.length)*10)/10:0,
    topChannel:topCh,
    totalRevenue:Math.round(stays.reduce(function(s,r){return s+(parseFloat(r.gross)||0);},0)),
    totalNet:Math.round(stays.reduce(function(s,r){return s+(parseFloat(r.net)||0);},0)),
    totalBookings:stays.length,
  };
}

function getEstateDashboard(params) {
  var year=parseInt(params.year)||new Date().getFullYear();
  var coconut=sheetToObjects(SHEETS.COCONUT).filter(function(r){return r.harvestDate&&String(r.harvestDate).indexOf(String(year))!==-1;});
  var rubber=sheetToObjects(SHEETS.RUBBER).filter(function(r){return r.tappingDate&&String(r.tappingDate).indexOf(String(year))!==-1;});
  return {
    coconut:{totalHarvests:coconut.length,totalCount:coconut.reduce(function(s,r){return s+(parseFloat(r.totalCount)||0);},0),netIncome:Math.round(coconut.reduce(function(s,r){return s+(parseFloat(r.netIncome)||0);},0))},
    rubber:{totalHarvests:rubber.length,totalKg:rubber.reduce(function(s,r){return s+(parseFloat(r.netKg)||0);},0),netIncome:Math.round(rubber.reduce(function(s,r){return s+(parseFloat(r.netIncome)||0);},0))},
  };
}

// ── ONE-TIME UTILITIES ────────────────────────────────────────────────────
function fixAllHeaders() {
  var ss=SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var HEADERS={
    'Stays':STAYS_HEADERS,
    'VillaIncome':['timestamp','villaId','guestName','checkInDate','checkOutDate','nights','rooms','channel','tariffPerNight','extraCharges','gross','commPct','commAmt','net','notes'],
    'VillaExpense':['timestamp','villaId','date','category','amount','paidTo','description'],
    'Kitchen':['timestamp','stayId','guestName','items','totalAmount','notes'],
    'Breakfast':['timestamp','stayId','guestName','date','guestCount','ratePerPerson','total','notes'],
    'CarRental':['timestamp','stayId','guestName','date','destination','amount','commission','net','notes'],
    'RentalIncome':['timestamp','month','year','propertyId','propertyName','rent','maintenance','electricity','water','propertyTax','landTax','carParking','extraMaintenance','net'],
    'CoconutHarvest':['timestamp','estate','harvestDate','paymentDate','harvesterName','totalCount','rejectionCount','netCount','totalWeight','pricePerKg','totalAmount','rejectionRevenue','dehuskRate','dehuskTotal','transport','otherCharges','totalExpenses','netIncome','notes'],
    'RubberHarvest':['timestamp','estate','tappingDate','paymentDate','tapperName','latexKg','rejectionKg','netKg','pricePerKg','totalAmount','rejectionRevenue','tapperWages','transport','otherCharges','totalExpenses','netIncome','notes'],
    'EstateLedger':['timestamp','estate','type','date','category','amount','paidTo','description'],
    'Guests':['name','phone','email','country','fromCity','firstStay','lastStay','totalStays','totalNights'],
  };
  var report=[];
  Object.keys(HEADERS).forEach(function(name){
    var sheet=ss.getSheetByName(name);
    if(!sheet){report.push('⚠️ '+name+' — not found');return;}
    var h=HEADERS[name];
    var first=String(sheet.getRange(1,1).getValue()).trim();
    if(first!==h[0]&&first!==''){sheet.insertRowBefore(1);}
    sheet.getRange(1,1,1,h.length).setValues([h]);
    sheet.getRange(1,1,1,h.length).setBackground('#1E2535').setFontColor('#C8903A').setFontWeight('bold');
    sheet.setFrozenRows(1);
    report.push('✅ '+name+' — header set ('+h.length+' cols)');
  });
  Logger.log(report.join('\n'));
  return report.join('\n');
}

function setupMasterSheet() {
  var ss=SpreadsheetApp.create('BG India — Master Data');
  Logger.log('Created: '+ss.getId());
  Object.keys(SHEETS).forEach(function(k){if(!ss.getSheetByName(SHEETS[k]))ss.insertSheet(SHEETS[k]);});
  var file=DriveApp.getFileById(ss.getId());
  DriveApp.getFolderById(CONFIG.driveRootId).addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  Logger.log('Done: '+ss.getUrl());
}

// ============================================================
// BG INDIA PORTAL — APPS SCRIPT ADDITIONS
// Everything below this line was added in later sessions on top
// of the original V20 backend above.
// ============================================================

var WORKER_URL = 'https://manage.luxuryvillasofguruvayur.com/api';

// ============================================================
// PART 1: UPDATED DRIVE FOLDER STRUCTURE
//
// ACTIVE: 3-argument version. This is the REAL, currently-running
// getOrCreateGuestFolder — organizes folders as
// Guests/YYYY/MM-MonthName/GuestName-DD-StayID
// Example:  Guests/2026/05-May/Vikram Ramasubramanian-17-DWK-AB123
//
// (The old 2-argument version is commented out near the top of
// this file, in the V20 section — it has had no effect since this
// one was added, since JS uses the last-declared definition of a
// function name. Kept only as a comment for reference; safe to
// delete entirely once you're confident nothing needs it.)
// ============================================================

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
//
// Only processes emails from the last 30 days, to avoid re-scanning
// (and potentially re-processing) very old review threads on every run.

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
//
// Only process emails from the last 30 days to avoid re-processing old reviews

function pollGoogleReviews() {
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
//
// ⚠️ KNOWN ISSUE (2026-06-24): this sends 'X-Actor: auto' but NO
// Authorization header. The Worker (functions/api/[[route]].js)
// requires 'Authorization: Bearer <SYSTEM_TOKEN>' on every action
// except the two public guest-facing endpoints — so every call
// through THIS function is being silently rejected (401), and
// callWorker() swallows the error and returns null. Confirmed live
// via Executions log: pollDriveCheckIns logged "no open stays or
// Worker unavailable" on a run where stays genuinely existed — that
// message fires specifically on a failed/empty Worker response, not
// only when there's nothing to do.
//
// NOT fixed here yet, on purpose — pollGmail/pollDriveCheckIns/etc
// are at least partially working today (folder creation for a real
// guest check-in was confirmed to succeed), so changing this
// function's auth before the new, separately-authenticated
// callWorkerWithSystemToken() (further below) has run cleanly for a
// few days risks breaking something partially-working in exchange
// for fixing something not working at all yet. Once
// callWorkerWithSystemToken() is proven solid, this function should
// be updated the same way — or all its call sites switched over to
// callWorkerWithSystemToken() directly and this one retired.
// ============================================================
function callWorker(method, action, payload) {
  try {
    var url  = WORKER_URL + '/' + action;
    var opts = {
      method:             method.toLowerCase(),
      headers:            { 'Content-Type': 'application/json', 'X-Actor': 'auto' },
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
// PART 7: ENQUIRY FOLLOW-UP REMINDERS (2-day / 5-day)
// ============================================================
// Runs once a day. Asks the Worker for any active (non-confirmed/
// lost/cancelled) enquiry that's gone 2+ or 5+ days without contact
// and hasn't already been emailed for that exact threshold. Sends one
// owner email per stale enquiry, with a ready-to-tap WhatsApp link —
// most mail clients auto-linkify a bare https://wa.me/... URL, so this
// stays plain text like every other email in this script rather than
// introducing HTML emails as a one-off.
//
// Uses callWorkerWithSystemToken() (below), NOT the older callWorker()
// above — see that function's comment for why they're separate.
//
// Sends nothing as silently as it skips sending duplicates: if
// getStaleEnquiries returns zero rows, this just logs and exits — no
// email noise on a quiet day.

function sendEnquiryFollowUpReminders() {
  var resp = callWorkerWithSystemToken('GET', 'getStaleEnquiries', {});
  if (!resp || !resp.success) {
    Logger.log('sendEnquiryFollowUpReminders: getStaleEnquiries failed: ' + JSON.stringify(resp));
    logScriptEvent('sendEnquiryFollowUpReminders', 'error', 'getStaleEnquiries failed or returned no response');
    if (!resp) {
      sendEmail('⚠️ Enquiry reminders — Worker call failed',
        'getStaleEnquiries returned nothing. This usually means the SYSTEM_TOKEN ' +
        'Script Property is missing or wrong. Check Project Settings → Script ' +
        'Properties → SYSTEM_TOKEN matches the value in Cloudflare exactly.');
    }
    return;
  }

  var rows = resp.data || [];
  Logger.log('sendEnquiryFollowUpReminders: ' + rows.length + ' stale enquiry(ies) found');
  logScriptEvent('sendEnquiryFollowUpReminders', 'info', rows.length + ' stale enquiry(ies) found this run');

  rows.forEach(function(enq) {
    var days = enq.days_since_contact;
    // Prefer the 5-day threshold if both qualify (a guest stale enough for
    // 5 days has obviously also passed 2) — but only send ONE email per
    // enquiry per run, and only for a threshold not already sent.
    var threshold = (days >= 5 && !enq.reminder_5day_sent_at) ? '5day'
                   : (days >= 2 && !enq.reminder_2day_sent_at) ? '2day'
                   : null;
    if (!threshold) return;  // shouldn't happen given the query, but guard anyway

    var waLink = buildEnquiryWaLink(enq.phone, enq.guest_name);
    var stayInfo = (enq.checkin_date && enq.checkout_date)
      ? enq.checkin_date + ' \u2192 ' + enq.checkout_date + ' \u00b7 ' + (enq.nights || 0) + 'n \u00b7 ' + (enq.guests_count || 1) + 'p'
      : 'Dates not yet set';
    var amount = enq.final_offer_amount || enq.quote_amount || 0;

    var subjectLabel = threshold === '5day' ? '5+ days, no response' : '2+ days, no response';
    var subject = '\ud83d\udd14 Enquiry follow-up: ' + enq.guest_name + ' \u2014 ' + subjectLabel;

    var body =
      'This enquiry has gone ' + days + ' day' + (days === 1 ? '' : 's') + ' without any contact logged.\n\n' +
      'GUEST\n' +
      '  Name    :  ' + enq.guest_name + '\n' +
      (enq.phone ? '  Phone   :  ' + enq.phone + '\n' : '') +
      (enq.email ? '  Email   :  ' + enq.email + '\n' : '') +
      '  Source  :  ' + (enq.source || '\u2014') + '\n' +
      '  Status  :  ' + (enq.status || '\u2014') + '\n\n' +
      'STAY\n' +
      '  ' + stayInfo + '\n' +
      (amount ? '  Quoted/offered: \u20b9' + Math.round(amount).toLocaleString('en-IN') + '\n' : '') +
      (enq.notes ? '\nNOTES\n  ' + enq.notes + '\n' : '') +
      '\n------------------------------------------------------------\n' +
      'Tap to message them on WhatsApp (asks if they had any\n' +
      'questions, or if they\'ve decided to go another way \u2014 either\n' +
      'way, we\'d appreciate knowing):\n\n' +
      (waLink || '(no phone number on file \u2014 reach out by email instead)') +
      '\n------------------------------------------------------------\n\n' +
      'Quicker responses tend to convert better \u2014 worth a check-in.';

    try {
      sendEmail(subject, body);
      var markResp = callWorkerWithSystemToken('POST', 'markReminderSent', { enquiryId: enq.enquiry_id, threshold: threshold });
      if (!markResp || !markResp.success) {
        Logger.log('WARNING: markReminderSent failed for ' + enq.enquiry_id + ' — this enquiry may get re-emailed tomorrow: ' + JSON.stringify(markResp));
        logScriptEvent('sendEnquiryFollowUpReminders', 'warning',
          'markReminderSent failed for ' + enq.guest_name + ' (' + threshold + ') — may re-email tomorrow', enq.enquiry_id);
      }
      Logger.log('Sent ' + threshold + ' reminder for ' + enq.guest_name + ' (' + enq.enquiry_id + ')');
      logScriptEvent('sendEnquiryFollowUpReminders', 'success',
        'Sent ' + threshold + ' reminder for ' + enq.guest_name + ' (' + days + ' days since contact)', enq.enquiry_id);
    } catch(e) {
      Logger.log('sendEnquiryFollowUpReminders: failed for ' + enq.enquiry_id + ': ' + e.message);
      logScriptEvent('sendEnquiryFollowUpReminders', 'error',
        'Exception for ' + enq.guest_name + ': ' + e.message, enq.enquiry_id);
    }
  });
}

// Generic, correctly-authenticated Worker call — reads SYSTEM_TOKEN from
// this script's own Script Properties and sends it as a Bearer token,
// matching exactly what the Worker requires on every action.
//
// WHY THIS EXISTS SEPARATELY FROM callWorker() (PART 5 above): see that
// function's comment block for the full explanation. Short version:
// callWorker() sends no valid auth and every call through it is being
// silently rejected. This function is currently used ONLY by the
// enquiry reminder feature below — once it's proven solid over a few
// days of clean runs, it (or the same fix) should be applied to
// callWorker()'s other callers too.
//
// ONE-TIME SETUP REQUIRED: Project Settings (gear icon, left sidebar) →
// Script Properties → Add property → key: SYSTEM_TOKEN, value: the exact
// same value set in Cloudflare Pages → bgindia-portal → Settings →
// Environment variables → SYSTEM_TOKEN.
function callWorkerWithSystemToken(method, action, payload) {
  try {
    var token = PropertiesService.getScriptProperties().getProperty('SYSTEM_TOKEN');
    if (!token) {
      Logger.log('callWorkerWithSystemToken (' + action + '): SYSTEM_TOKEN Script Property not set');
      return null;
    }
    var url  = WORKER_URL + '/' + action;
    var opts = {
      method:             method.toLowerCase(),
      headers:            { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true,
    };
    if (method === 'GET' && payload && Object.keys(payload).length > 0) {
      var qs = Object.keys(payload).map(function(k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(String(payload[k] || ''));
      }).join('&');
      url += '?' + qs;
    }
    if (method === 'POST') opts.payload = JSON.stringify(payload || {});
    var httpResp = UrlFetchApp.fetch(url, opts);
    var code = httpResp.getResponseCode();
    if (code === 401) {
      Logger.log('callWorkerWithSystemToken (' + action + '): 401 Unauthorized — SYSTEM_TOKEN does not match Cloudflare');
      return null;
    }
    return JSON.parse(httpResp.getContentText());
  } catch(e) {
    Logger.log('callWorkerWithSystemToken (' + action + ') error: ' + e.message);
    return null;
  }
}

// Writes a structured log entry into the Worker's processing_log table
// (D1) via the logScriptEvent action — same table already used for
// check-in error logging, viewable from D1 Admin / the D1 console at any
// time, rather than only from Apps Script's own Executions panel (which
// isn't checked day to day, and which ages out after ~30 days).
// Best-effort: a logging failure should never break the calling function,
// so this never throws — it just falls back to Logger.log if the Worker
// call itself fails (e.g. same SYSTEM_TOKEN issue this whole thing exists
// to guard against).
function logScriptEvent(source, eventType, note, refId) {
  try {
    var resp = callWorkerWithSystemToken('POST', 'logScriptEvent', {
      source: source, eventType: eventType, note: note, refId: refId || null,
    });
    if (!resp || !resp.success) {
      Logger.log('logScriptEvent: failed to write to D1, falling back to Logger only — ' + JSON.stringify(resp));
    }
  } catch(e) {
    Logger.log('logScriptEvent error: ' + e.message);
  }
}

// Builds a wa.me link from a raw phone string. Only assumes India's '91'
// country code for a bare <=10-digit number with no '+' in the original
// string — anything that already looks international (has a '+', or is
// already longer than 10 digits) is left untouched. Blindly prepending
// '91' onto an already-international number (e.g. a Qatar guest's
// +974...) would corrupt it into a wrong, undeliverable number.
function buildEnquiryWaLink(rawPhone, guestName) {
  var raw = String(rawPhone || '').trim();
  if (!raw) return null;
  var digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  var looksInternational = raw.indexOf('+') >= 0 || digits.length > 10;
  var num = looksInternational ? digits : ('91' + digits);
  var firstName = String(guestName || '').split(' ')[0] || 'there';
  var msg = encodeURIComponent(
    'Hi ' + firstName + ', just checking in \u2014 were you able to look over the details for your stay? ' +
    'Happy to answer any questions you have. And if you\'ve decided to go a different way, no worries at all, ' +
    'just let us know so we can keep things updated on our end. Thank you! \ud83d\ude4f'
  );
  return 'https://wa.me/' + num + '?text=' + msg;
}

// ============================================================
// PART 6: TRIGGER SETUP — run this function once manually
// ============================================================
function setupTriggers() {
  // Remove existing poller triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (['pollGmail', 'pollDriveCheckIns', 'sendEnquiryFollowUpReminders'].indexOf(fn) >= 0) {
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

  // Enquiry follow-up reminders (2-day / 5-day stale check): once daily.
  // Runs at 9am in the script's timezone (Triggers UI shows/lets you
  // adjust this — Apps Script picks a window, not an exact minute).
  ScriptApp.newTrigger('sendEnquiryFollowUpReminders')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log('✅ Triggers set up: pollGmail (5min) + pollDriveCheckIns (10min) + sendEnquiryFollowUpReminders (daily ~9am)');
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
