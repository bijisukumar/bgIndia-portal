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

// ── CHANGELOG (newest first — this file is the source of truth for live) ────
// v1.2  2026-07-12
//   • Unified email log: sendAlert() now routes through the Worker's
//     sendGuestEmail action (Resend + infra_alert_log) instead of
//     GmailApp.sendEmail directly — every owner alert this file sends
//     (booking imported, cancellation, review, errors) now lands in
//     the same D1 log as the guest-facing check-in emails, instead of
//     only being visible in this Gmail account's Sent folder. No
//     change to Gmail reading/parsing or booking create/cancel/review
//     logic — only sendAlert()'s internals changed.
// v1.1  2026-07-05
//   • pollAirbnbCancellations(): reads Airbnb "Canceled: Reservation <code>"
//     emails and cancels the matching stay via the cancelByConfirmation
//     Worker action. Wired into pollNewReservations().
//   • Room-fee parse fix: nightFee now captures the room TOTAL. It was
//     capturing the per-night rate ("₹4,910 x 2 nights" → 4,910), which made
//     gross (= nightFee + cleaningFee) understated. Now multiplies out or
//     reads the "N nights room fee ₹TOTAL" line.
// v1.0  (baseline, pre-changelog)
//   • Poll Airbnb "Reservation confirmed" emails → create bookings in D1.
//   • Poll Airbnb reviews. Drive folder + Sheets backup + owner email.
// ============================================================

// ── CONFIG ────────────────────────────────────────────────────────────────
var WORKER_URL    = 'https://manage.stayvibe360.com/api';
var OWNER_EMAIL   = 'kerala.luxuryvillas@gmail.com';   // where booking alerts are sent
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

// Main poller — runs every 5 minutes via trigger. Apps Script does NOT skip
// a scheduled run just because the previous one is still going, so a run
// that takes longer than 5 minutes (slow Gmail/Drive/Worker calls) can
// genuinely overlap with the next one, both reading the same is:unread
// threads. LockService turns that into a clean skip instead of a race.
function pollNewReservations() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    Logger.log('pollNewReservations: previous run still in progress — skipping this trigger');
    return;
  }
  try {
    Logger.log('=== pollNewReservations START ' + new Date().toISOString() + ' ===');
    try {
      pollAirbnbBookings();
    } catch(e) {
      Logger.log('pollAirbnbBookings ERROR: ' + e.message);
      sendAlert('🚨 Poller error', e.message + '\n' + (e.stack||''));
    }
    try {
      pollAirbnbCancellations();
    } catch(e) {
      Logger.log('pollAirbnbCancellations ERROR: ' + e.message);
    }
    try {
      pollAirbnbReviews();
    } catch(e) {
      Logger.log('pollAirbnbReviews ERROR: ' + e.message);
    }
    Logger.log('=== pollNewReservations END ===');
  } finally {
    lock.releaseLock();
  }
}

// ── AIRBNB CANCELLATION POLLER ────────────────────────────────────────────
function pollAirbnbCancellations() {
  var threads = GmailApp.search(
    'from:automated@airbnb.com subject:"Canceled: Reservation" is:unread',
    0, 20
  );
  Logger.log('Unread Airbnb cancellation threads: ' + threads.length);
  if (threads.length === 0) return;

  threads.forEach(function(thread) {
    var msg     = thread.getMessages()[0];
    var subject = msg.getSubject();
    var body    = msg.getPlainBody();
    Logger.log('Processing cancellation: ' + subject);

    try {
      // Conf code from subject: "Canceled: Reservation HMZ9QHBPXE for Dec 10 – 11, 2026"
      var confMatch = subject.match(/\b(HM[A-Z0-9]{6,12})\b/) ||
                      body.match(/\b(HM[A-Z0-9]{6,12})\b/);
      var confCode  = confMatch ? confMatch[1] : null;

      if (!confCode) {
        Logger.log('No conf code in cancellation: ' + subject);
        sendAlert('⚠️ Cancellation email — no conf code parsed', 'Subject: ' + subject);
        msg.markRead();
        return;
      }

      var resp = callWorker('POST', 'cancelByConfirmation', { confirmationCode: confCode });

      if (resp && resp.success) {
        var d = resp.data || {};
        if (d.cancelled) {
          Logger.log('✅ Cancelled ' + d.stayId + ' (' + d.guestName + ')');
          sendAlert('❌ Airbnb cancellation: ' + (d.guestName || confCode),
            'Reservation ' + confCode + ' was cancelled on Airbnb.' +
            '\nStay ' + d.stayId + ' set to cancelled — removed from active bookings & revenue.' +
            '\n\nSubject: ' + subject);
        } else if (d.alreadyCancelled) {
          Logger.log('Already cancelled: ' + d.stayId);
        } else if (d.matched === false) {
          Logger.log('No stay for conf ' + confCode + ' (never imported) — nothing to cancel.');
        }
      } else {
        Logger.log('cancelByConfirmation failed: ' + JSON.stringify(resp));
        sendAlert('⚠️ Cancellation not applied: ' + confCode,
          'Worker response: ' + JSON.stringify(resp) + '\nSubject: ' + subject +
          '\nPlease cancel this booking manually.');
      }

      msg.markRead();
    } catch(e) {
      Logger.log('Error processing cancellation "' + subject + '": ' + e.message);
    }
  });
}

// Dedupe label for the review poller. Read state is NOT a safe marker —
// the owner reads this mailbox in Outlook and on a phone, so a review mail
// is routinely opened by a human within the 5-minute poll window. Once read,
// an is:unread search skips it forever and the review is silently lost.
// That is why only 3 reviews ever landed automatically. A label we own is
// unaffected by anyone reading the mail.
// Do not rename this without relabelling the existing threads in Gmail.
// The label IS the dedupe record — threads already handled carry it, and a
// new name matches none of them, so every past review would be reprocessed
// and re-alerted. Quoted in the query below so a hyphen in the name stays
// safe from Gmail's operator parsing.
var REVIEW_DONE_LABEL = 'portal-review-done';

function getReviewDoneLabel() {
  return GmailApp.getUserLabelByName(REVIEW_DONE_LABEL)
      || GmailApp.createLabel(REVIEW_DONE_LABEL);
}

// Run this by hand when the poller reports 0 threads and you can see review
// mail in the mailbox. It walks the query outwards one clause at a time, so
// the clause that kills the match is obvious instead of guessed at.
function debugReviewSearch() {
  var base = 'from:automated@airbnb.com subject:"left a" subject:"review"';
  var queries = [
    ['from only',            'from:automated@airbnb.com'],
    ['base',                 base],
    ['base + 30d',           base + ' newer_than:30d'],
    ['base + 30d + label',   base + ' newer_than:30d -label:"' + REVIEW_DONE_LABEL + '"'],
  ];
  queries.forEach(function(q) {
    var n = GmailApp.search(q[1], 0, 20);
    Logger.log(q[0] + ' → ' + n.length + '   [' + q[1] + ']');
    n.slice(0, 5).forEach(function(t) {
      Logger.log('      ' + t.getMessages()[0].getSubject());
    });
  });
}

// ── AIRBNB REVIEW POLLER ──────────────────────────────────────────────────
function pollAirbnbReviews() {
  var doneLabel = getReviewDoneLabel();
  // 30-day window rather than "unread": anything missed while this was
  // read-gated gets picked up on the next run instead of staying lost.
  var threads = GmailApp.search(
    'from:automated@airbnb.com subject:"left a" subject:"review" ' +
    'newer_than:30d -label:"' + REVIEW_DONE_LABEL + '"',
    0, 20
  );
  Logger.log('Unprocessed Airbnb review threads: ' + threads.length);
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
        thread.addLabel(doneLabel);
        return;
      }

      // Find matching stay in D1 by guest name
      var currentYear = new Date().getFullYear();
      var matchedStay = null;
      var ambiguous   = null;

      for (var y = 0; y <= 1; y++) {
        var resp = callWorker('GET', 'getStays', { villaId: 'dwarka', year: String(currentYear - y) });
        if (resp && resp.success && Array.isArray(resp.data)) {
          // Match by first name (Airbnb only shows first name in review emails)
          var firstName = guestName.split(' ')[0].toLowerCase();
          // Match booked_by_name as well as guest_name. An Airbnb review is
          // written by the account holder — the person who BOOKED — who is
          // often not the person whose name ends up on the stay. Abhishek's
          // review found nothing because his booking sits under the guest
          // who checked in, with "Abhishek M Shet" recorded only in
          // booked_by_name.
          var candidates = resp.data.filter(function(s) {
            var byGuest  = (s.guest_name || '').toLowerCase().indexOf(firstName) === 0;
            var byBooker = (s.booked_by_name || '').toLowerCase().indexOf(firstName) === 0;
            return (byGuest || byBooker) &&
                   ['cancelled', 'void'].indexOf(s.status) === -1;
          });

          // A first-name prefix is a weak signal, so narrow before choosing.
          // An Airbnb review belongs on the Airbnb booking — the row holding
          // the confirmation code and the money — not on a duplicate check-in
          // row that happens to share the guest's name. Suni's review landed
          // on exactly such a duplicate: both rows were named Suni, both
          // checked out the same day, so the old date sort tied and picked
          // whichever came back first.
          if (candidates.length > 1) {
            var real = candidates.filter(function(s) {
              return (s.airbnb_conf && String(s.airbnb_conf).trim()) || Number(s.gross) > 0;
            });
            if (real.length > 0) candidates = real;
          }

          if (candidates.length > 1) {
            candidates.sort(function(a, b) {
              return new Date(b.checkout_date||b.checkin_date) - new Date(a.checkout_date||a.checkin_date);
            });
            // Still more than one after narrowing, and no date separates them:
            // that is a guess, not a match. Guessing is what put the review on
            // the wrong stay. Surface it and let a human choose.
            var topDate = candidates[0].checkout_date || candidates[0].checkin_date;
            var tied = candidates.filter(function(s) {
              return (s.checkout_date || s.checkin_date) === topDate;
            });
            if (tied.length > 1) {
              ambiguous = tied;
              break;
            }
          }

          if (candidates.length > 0) {
            matchedStay = candidates[0];
            break;
          }
        }
      }

      if (ambiguous) {
        Logger.log('Ambiguous review match for ' + guestName + ' — ' + ambiguous.length + ' candidates');
        sendAlert('⭐ Review received — which stay? ' + guestName,
          'Airbnb shows only a first name, and more than one stay matches with' +
          '\nnothing to separate them. Not guessing — please set it by hand.\n' +
          '\nGuest:  ' + guestName +
          '\nRating: ' + rating + '★' +
          '\nDate:   ' + reviewDate +
          (reviewText ? '\n\nReview:\n' + reviewText : '') +
          (specialThanks.length ? '\n\nHighlights: ' + specialThanks.join(', ') : '') +
          '\n\nCandidates:\n' + ambiguous.map(function(s) {
            return '  ' + s.stay_id + '  ' + s.guest_name +
                   '  ' + (s.checkin_date || '?') + '→' + (s.checkout_date || '?') +
                   '  ' + s.status +
                   '  gross ' + (s.gross || 0) +
                   (s.airbnb_conf ? '  conf ' + s.airbnb_conf : '');
          }).join('\n'));
        thread.addLabel(doneLabel);
        return;
      }

      if (!matchedStay) {
        Logger.log('No matching stay found for reviewer: ' + guestName);
        sendAlert('⭐ Review received — no stay match: ' + guestName,
          'Guest: ' + guestName + '\nRating: ' + rating + '★\nDate: ' + reviewDate +
          '\nReview: ' + reviewText +
          '\n\nPlease manually update the stay rating in the portal.');
        thread.addLabel(doneLabel);
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
        // Label only once the review is actually stored. A failed save stays
        // unlabelled so the next run retries it — the old code marked the
        // mail read regardless, so a transient worker error lost the review
        // permanently with nothing but a log line to show for it.
        thread.addLabel(doneLabel);
      } else {
        Logger.log('saveReview failed (will retry next run): ' + JSON.stringify(saveResp));
      }

    } catch(e) {
      // Deliberately not labelled — an exception should retry, not vanish.
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

  // ── DATE SANITY CHECK ────────────────────────────────────────────────────
  // Dates and nights come from two unrelated regexes (a date-label match vs
  // a "(\d+) night" match), so they can silently disagree — this is exactly
  // what happened for the "Anusha Chandran" reservation: nights=2 was
  // extracted correctly but checkOut came back equal to checkIn, and
  // nothing ever cross-checked that before writing to D1. Self-heal from
  // nights when we have it (trustworthy — it comes from a separate part of
  // the email); otherwise drop the bad checkOut so the booking still
  // imports (correct guest/financials) with an empty checkout rather than
  // a wrong one, which is easy to spot and fix later.
  if (checkOut && checkOut <= checkIn) {
    if (nights > 0) {
      var fixedCheckOut = new Date(checkIn);
      fixedCheckOut.setDate(fixedCheckOut.getDate() + nights);
      Logger.log('⚠️ checkOut (' + checkOut + ') <= checkIn (' + checkIn + ') — recomputed from nights=' + nights + ' as ' + fixedCheckOut.toISOString().slice(0,10));
      checkOut = fixedCheckOut.toISOString().slice(0, 10);
    } else {
      Logger.log('⚠️ checkOut (' + checkOut + ') <= checkIn (' + checkIn + ') and nights unknown — dropping checkOut, booking will import with it blank');
      checkOut = null;
    }
  }

  // ── FEES — strip ₹, commas, spaces ─────────────────────────────────────
  function amt(pattern) {
    var m = body.match(pattern);
    if (!m) return 0;
    return parseFloat(String(m[1]).replace(/[,₹\s\u20B9]/g, '')) || 0;
  }

  // Room fee TOTAL (not the per-night rate — that was the bug that
  // understated gross). Airbnb shows it two ways:
  //   "2 nights room fee   ₹9,820.00"   <- total (preferred)
  //   "₹4,910.00 x 2 nights"            <- rate x nights (multiply out)
  var nightFee = amt(/\d+\s+nights?\s+room\s+fee\s+₹?\s*([\d,\.]+)/i);
  if (!nightFee) {
    var rx = body.match(/([\d,\.]+)\s*(?:×|x)\s*(\d+)\s*night/i);
    if (rx) {
      var rate = parseFloat(String(rx[1]).replace(/[,₹\s\u20B9]/g, '')) || 0;
      var n    = parseInt(rx[2]) || nights || 1;
      nightFee = rate * n;
    }
  }

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

// Unified email log (2026-07-12): routes through the Worker's
// sendGuestEmail action (Resend + infra_alert_log) instead of calling
// GmailApp.sendEmail directly, so these owner-facing Airbnb alerts land
// in the same D1 log as every other email instead of only being
// visible in this Gmail account's Sent folder. Every pollAirbnbBookings
// / pollAirbnbCancellations / pollAirbnbReviews call site is unchanged —
// they all just call sendAlert(subject, body) as before; only this
// function's internals changed. The actual Gmail-reading, parsing, and
// booking create/cancel/review-save logic elsewhere in this file is
// completely untouched.
function sendAlert(subject, body) {
  try {
    var resp = callWorker('POST', 'sendGuestEmail', {
      to: OWNER_EMAIL, subject: '[GVR Portal] ' + subject, body: body,
      villaId: 'dwarka', category: 'owner_airbnb',
    });
    if (!resp || !resp.success) {
      Logger.log('sendAlert (via Worker) failed: ' + JSON.stringify(resp));
    }
  } catch(e) {
    Logger.log('sendAlert failed: ' + e.message);
  }
}
