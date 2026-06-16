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
var DRIVE_ROOT_ID = '1NglE0BgsxS4wULHuO2N0ydFIErk6rrf2';  // StayOps folder under kerala.luxuryvillas@gmail.com
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
  try {
    pollAirbnbReviews();
  } catch(e) {
    Logger.log('pollAirbnbReviews ERROR: ' + e.message);
  }
  Logger.log('=== pollNewReservations END ===');
}

// ── AIRBNB REVIEW POLLER ──────────────────────────────────────────────────
function pollAirbnbReviews() {
  var threads = GmailApp.search(
    'from:automated@airbnb.com subject:"left a" subject:"review" is:unread',
    0, 20
  );
  Logger.log('Unread Airbnb review threads: ' + threads.length);
  if (threads.length === 0) return;

  threads.forEach(function(thread) {
    var msg     = thread.getMessages()[0];
    var subject = msg.getSubject();
    var body    = msg.getPlainBody();
    Logger.log('Processing review: ' + subject);

    try {
      // Parse star rating from subject: "Sreeram left a 5-star review!"
      var ratingMatch = subject.match(/(\d+)-star/i);
      var rating      = ratingMatch ? parseInt(ratingMatch[1]) : 5;

      // Parse guest name from subject: "Sreeram left a 5-star review!"
      var nameMatch   = subject.match(/^([A-Za-z\s]+?)\s+left a/i);
      var guestName   = nameMatch ? nameMatch[1].trim() : '';

      // Parse review text — public review only, stop at "+ More" or "+N more"
      var reviewText  = '';
      var specialThanks = [];

      // Public review: text before "Note from" or "+ More" or "+N more"
      // Look for content after "Overall rating" line or just grab first meaningful paragraph
      var bodyClean = body.replace(/https?:\/\/\S+/g, '').replace(/\r\n/g, '\n');

      // Find the review text block — stops at Note from / +More / Special thanks
      var reviewMatch = bodyClean.match(/Overall rating[\s\S]*?\n\n([\s\S]+?)(?:\n\n(?:Note from|Special thanks|\+\d* ?[Mm]ore|Read full|Write a)|$)/i);
      if (!reviewMatch) {
        // Fallback: grab first long paragraph that looks like a review
        reviewMatch = bodyClean.match(/\n\n((?:[A-Z][^+\n]{30,}[\s\S]*?))(?:\n\nNote from|\n\nSpecial thanks|\n\n\+)/i);
      }
      if (reviewMatch) {
        reviewText = reviewMatch[1]
          .replace(/\+\s*[Mm]ore.*$/s, '')  // cut at +More
          .replace(/\+\d+\s*more.*$/si, '') // cut at +12 more
          .replace(/\n+/g, ' ')
          .trim();
      }

      // Special thanks checkboxes only — no Note from guest
      var thanksSection = bodyClean.match(/Special thanks\s*\n([\s\S]*?)(?:\n\n|\+\d+\s*more|Read full|Write a|$)/i);
      if (thanksSection) {
        thanksSection[1].split('\n').forEach(function(line) {
          var t = line.replace(/^[\s✓✔\-\*•]+/, '').trim();
          if (t.length > 3 && t.length < 80 && !/^https?/.test(t)) {
            specialThanks.push(t);
          }
        });
      }

      var fullReviewText = reviewText;
      if (specialThanks.length > 0) {
        fullReviewText += (fullReviewText ? '\n\n' : '') + 'Special thanks: ' + specialThanks.join(', ');
      }

      // Parse review date — use email date
      var reviewDate  = new Date(msg.getDate()).toISOString().slice(0, 10);

      Logger.log('Review parsed: ' + guestName + ' | ' + rating + '★ | ' + reviewDate);

      if (!guestName) {
        Logger.log('Could not parse guest name from: ' + subject);
        msg.markRead();
        return;
      }

      // Find matching stay in D1 by guest name
      var currentYear = new Date().getFullYear();
      var matchedStay = null;

      for (var y = 0; y <= 1; y++) {
        var resp = callWorker('GET', 'getStays', { villaId: 'dwarka', year: String(currentYear - y) });
        if (resp && resp.success && Array.isArray(resp.data)) {
          // Match by first name (Airbnb only shows first name in review emails)
          var firstName = guestName.split(' ')[0].toLowerCase();
          var candidates = resp.data.filter(function(s) {
            return (s.guest_name || '').toLowerCase().startsWith(firstName) &&
                   !['cancelled'].includes(s.status);
          });
          // Pick most recent if multiple
          if (candidates.length > 0) {
            candidates.sort(function(a, b) {
              return new Date(b.checkout_date||b.checkin_date) - new Date(a.checkout_date||a.checkin_date);
            });
            matchedStay = candidates[0];
            break;
          }
        }
      }

      if (!matchedStay) {
        Logger.log('No matching stay found for reviewer: ' + guestName);
        sendAlert('⭐ Review received — no stay match: ' + guestName,
          'Guest: ' + guestName + '\nRating: ' + rating + '★\nDate: ' + reviewDate +
          '\nReview: ' + reviewText +
          '\n\nPlease manually update the stay rating in the portal.');
        msg.markRead();
        return;
      }

      Logger.log('Matched stay: ' + matchedStay.stay_id + ' for ' + matchedStay.guest_name);

      // Save review to D1
      var saveResp = callWorker('POST', 'saveReview', {
        stayId:      matchedStay.stay_id,
        rating:      rating,
        source:      'airbnb',
        reviewDate:  reviewDate,
        reviewText:  reviewText,
        highlights:  specialThanks.join(', '),
        guestName:   matchedStay.guest_name,
      });

      if (saveResp && saveResp.success) {
        Logger.log('✅ Review saved: ' + matchedStay.stay_id + ' — ' + rating + '★');

        // Close the stay if still open
        if (!['closed','cancelled'].includes(matchedStay.status)) {
          callWorker('POST', 'closeStayWithReview', {
            stayId:       matchedStay.stay_id,
            rating:       rating,
            closedReason: 'airbnb_review',
          });
          Logger.log('Stay closed: ' + matchedStay.stay_id);
        }

        sendAlert('⭐ ' + rating + '-star review from ' + matchedStay.guest_name,
          'Guest:    ' + matchedStay.guest_name +
          '\nStay:     ' + matchedStay.stay_id +
          '\nRating:   ' + rating + '★' +
          '\nDate:     ' + reviewDate +
          (reviewText           ? '\n\nReview:\n'    + reviewText                    : '') +
          (specialThanks.length ? '\n\nHighlights: ' + specialThanks.join(', ')      : '') +
          '\n\n' + (matchedStay.status === 'closed' ? 'Stay was already closed.' : 'Stay closed automatically.')
        );
      } else {
        Logger.log('saveReview failed: ' + JSON.stringify(saveResp));
      }

      msg.markRead();

    } catch(e) {
      Logger.log('Error processing review "' + subject + '": ' + e.message);
    }
  });
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

      Logger.log('Parsed: ' + booking.guestName +
                 ' | in:' + booking.checkIn + ' out:' + booking.checkOut +
                 ' | conf:' + booking.confirmationCode +
                 ' | adults:' + booking.adults + ' children:' + booking.children + ' infants:' + booking.infants +
                 ' | guestPaid:' + booking.guestPaid);

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
        children:        booking.children || 0,
        infants:         booking.infants  || 0,
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

      // ── Backup to Sheets — DISABLED (D1 is source of truth) ────────────
      // Sheets backup removed — all data lives in D1 portal
      // Uncomment appendToStaysSheet call below if you need Sheets backup restored
      /*
      try {
        appendToStaysSheet({ stayId, guestName: booking.guestName, ... });
      } catch(se) { Logger.log('Sheets backup error: ' + se.message); }
      */

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
        (booking.children > 0 ? '\nChildren:         ' + booking.children : '') +
        (booking.infants  > 0 ? '\nInfants:          ' + booking.infants  : '') +
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
  // Airbnb plain-text emails are ALL CAPS labels with values on same line separated by spaces.
  // Real format (from debug): "Check-in     Checkout               Tue, Nov 3   Thu, Nov 5"
  // "GUESTS  2 adults, 1 child, 1 infant"
  // "TOTAL (INR)   ₹12,347.54"  "YOU EARN   ₹10,495.40"

  // Confirmation code
  var confMatch = body.match(/\b(HM[A-Z0-9]{6,12})\b/) ||
                  body.match(/CONFIRMATION CODE\s+([A-Z0-9]{8,12})/i) ||
                  body.match(/Confirmation code[:\s]+([A-Z0-9]{8,12})/i);
  var confCode  = confMatch ? confMatch[1] : ('AB-' + Date.now());

  // Guest name from subject
  var nameMatch = subject.match(/^Reservation confirmed\s*[-–]\s*([A-Za-z\s]+?)\s+arrives/i) ||
                  subject.match(/^([A-Za-z\s\-\.]+?)\s+(?:has reserved|left a)/i) ||
                  body.match(/Guest name[:\s]+(.+)/i) ||
                  subject.match(/from\s+([A-Za-z\s]+)/i);
  var guestName = nameMatch ? nameMatch[1].trim() : 'Airbnb Guest';

  // ── DATES ──────────────────────────────────────────────────────────────
  // Airbnb plain text format: "Check-in     Checkout               Tue, Nov 3   Thu, Nov 5"
  // All on ONE line with lots of spaces between labels and values.
  var checkIn  = null;
  var checkOut = null;

  // Pattern 1: both dates on one line — "Check-in ... Checkout ... Mon DD ... Mon DD"
  var bothDates = body.match(/Check-in\s+Checkout\s+([A-Za-z]+,?\s+[A-Za-z]+\s+\d{1,2})\s+([A-Za-z]+,?\s+[A-Za-z]+\s+\d{1,2})/i);
  if (bothDates) {
    checkIn  = inferYear(bothDates[1]);
    checkOut = inferYear(bothDates[2]);
    Logger.log('Dates from combined line: ' + checkIn + ' / ' + checkOut);
  }

  // Pattern 2: separate lines — "Check-in: Thu, Nov 3" / "Checkout: Thu, Nov 5"
  if (!checkIn)  checkIn  = extractDate(body, 'Check-in') || extractDate(body, 'Check-in date');
  if (!checkOut) checkOut = extractDate(body, 'Check-out') || extractDate(body, 'Checkout') || extractDate(body, 'Check-out date');

  // Pattern 3: subject fallback for check-in only
  if (!checkIn) {
    checkIn = extractDateFromSubject(subject);
    Logger.log('Used subject date fallback: ' + checkIn);
  }

  if (!checkIn) {
    Logger.log('Could not find check-in date');
    return null;
  }

  // ── NIGHTS ─────────────────────────────────────────────────────────────
  var nightsMatch = body.match(/(\d+)\s+night/i);
  var nights = nightsMatch ? parseInt(nightsMatch[1]) : 0;
  if (!nights && checkIn && checkOut) {
    nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  }

  // ── FEES — strip ₹, commas, spaces ─────────────────────────────────────
  function amt(pattern) {
    var m = body.match(pattern);
    if (!m) return 0;
    return parseFloat(String(m[1]).replace(/[,₹\s\u20B9]/g, '')) || 0;
  }

  // Night fee: "₹4,910.00 x 2 nights" or "2 nights room fee   ₹9,820.00"
  var nightFee = amt(/([\d,\.]+)\s*(?:×|x)\s*\d+\s*night/i) ||
                 amt(/(₹[\d,\.]+)\s*x\s*\d+\s*night/i) ||
                 amt(/\d+\s+nights?\s+room\s+fee\s+₹?\s*([\d,\.]+)/i);

  var cleaningFee = amt(/Cleaning fee\s+₹?\s*([\d,\.]+)/i);

  // Host service fee — may have leading minus/dash before ₹
  // Host service fee format: 'Host service fee (3.0%)   -₹324.60' — minus before ₹
  var hostSvcFee  = amt(/Host service fee[^\n]*[-−\u2212]₹([\d,\.]+)/i) ||
                    amt(/Host service fee[^\n]*₹\s*([\d,\.]+)/i);

  // YOU EARN — all caps in this email format
  var youEarn = amt(/YOU EARN\s+₹?\s*([\d,\.]+)/i) ||
                amt(/You earn\s+₹?\s*([\d,\.]+)/i);

  var guestSvcFee = amt(/Guest service fee\s+₹?\s*([\d,\.]+)/i);

  // GUEST PAID TOTAL — "GUEST PAID ... TOTAL (INR)   ₹12,347.54"
  // Grab the TOTAL (INR) that appears AFTER "GUEST PAID" section header
  var guestPaid = 0;
  var gpSection = body.match(/GUEST PAID[\s\S]*?TOTAL\s*\(INR\)\s+₹?([\d,\.]+)/i);
  if (gpSection) {
    guestPaid = parseFloat(String(gpSection[1]).replace(/[,]/g, '')) || 0;
  } else {
    // Fallback: nightFee + cleaningFee + guestSvcFee
    guestPaid = (nightFee || 0) + (cleaningFee || 0) + (guestSvcFee || 0);
  }

  // ── GUEST COUNT — "GUESTS  2 adults, 1 child, 1 infant" ───────────────
  var adults   = 1;
  var children = 0;
  var infants  = 0;
  var adultsM   = body.match(/(\d+)\s+adult/i);
  var childrenM = body.match(/(\d+)\s+child/i);
  var infantsM  = body.match(/(\d+)\s+infant/i);
  if (adultsM) {
    adults   = parseInt(adultsM[1]);
    children = childrenM ? parseInt(childrenM[1]) : 0;
    infants  = infantsM  ? parseInt(infantsM[1])  : 0;
  } else {
    var guestM = body.match(/(\d+)\s+guest/i);
    adults = guestM ? parseInt(guestM[1]) : 1;
  }

  return {
    confirmationCode: confCode,
    guestName:        guestName,
    checkIn:          checkIn,
    checkOut:         checkOut || '',
    nights:           nights,
    adults:           adults,
    children:         children,
    infants:          infants,
    nightFee:         nightFee,
    cleaningFee:      cleaningFee,
    hostServiceFee:   hostSvcFee,
    youEarn:          youEarn,
    guestServiceFee:  guestSvcFee,
    guestPaid:        guestPaid,
  };
}

// Infer year for a date string like "Tue, Nov 3" or "Nov 3"
function inferYear(dateStr) {
  try {
    var now  = new Date();
    var year = now.getFullYear();
    var d    = new Date(dateStr.trim() + ' ' + year);
    // If more than 60 days in the past, use next year
    if (!isNaN(d) && (now - d) > 60 * 86400000) d.setFullYear(year + 1);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  } catch(e) { return null; }
}

function extractDate(body, label) {
  // p1: "Check-in: Thursday, May 22, 2026" — day-of-week + month + date + year
  var p1 = new RegExp(label + '[:\\s]+([A-Za-z]+,?\\s+[A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4})', 'i');
  // p2: "Check-in: 2026-05-22" — ISO format
  var p2 = new RegExp(label + '[:\\s]+(\\d{4}-\\d{2}-\\d{2})', 'i');
  // p3: "Check-in: 22 May 2026" — date + month + year
  var p3 = new RegExp(label + '[:\\s]+(\\d{1,2}\\s+[A-Za-z]+\\s+\\d{4})', 'i');
  // p4: "Check-in: Tue, Nov 3" — Airbnb short format without year
  var p4 = new RegExp(label + '[:\\s]+(?:[A-Za-z]+,\\s+)?([A-Za-z]+\\s+\\d{1,2})(?:\\s|$|\\n)', 'i');

  var m = body.match(p1) || body.match(p2) || body.match(p3);
  if (m) {
    try {
      var d = new Date(m[1].replace(/(\d+)(st|nd|rd|th)/gi,'$1'));
      return isNaN(d) ? null : d.toISOString().slice(0, 10);
    } catch(e) { return null; }
  }

  // p4 fallback — no year in email, infer year
  var m4 = body.match(p4);
  if (m4) {
    try {
      var now  = new Date();
      var year = now.getFullYear();
      var d4   = new Date(m4[1] + ' ' + year);
      // If parsed date is more than 60 days in the past, bump to next year
      if (!isNaN(d4) && (now - d4) > 60 * 86400000) d4.setFullYear(year + 1);
      return isNaN(d4) ? null : d4.toISOString().slice(0, 10);
    } catch(e) { return null; }
  }

  return null;
}

// Extract date from subject line e.g. "arrives Jun 6" or "arrives Jun 6-10"
function extractDateFromSubject(subject) {
  // "arrives Jun 6" — single date, assume current/next year
  var m = subject.match(/arrives\s+([A-Za-z]+)\s+(\d{1,2})(?:-\d+)?/i);
  if (!m) return null;
  try {
    var year = new Date().getFullYear();
    var d    = new Date(m[1] + ' ' + m[2] + ' ' + year);
    // If date is in the past, use next year
    if (d < new Date()) d.setFullYear(year + 1);
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

  // Sheets fallback check DISABLED — D1 is source of truth
  return false;
  /*
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    ...
  } catch(e) { return false; }
  */
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
