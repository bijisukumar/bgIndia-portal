// ============================================================
// AgodaCalendarBridge.gs   v1.1   (2026-11-22)
// StayVibe360 calendar  ->  a private Google Calendar  ->  Agoda
// ============================================================
// WHY THIS EXISTS
//   Agoda's "Import a calendar from another site" only accepts links from
//   websites on its own approved list. A StayVibe360 link is refused with
//   "Please enter a valid link" before Agoda even looks at it (checked
//   2026-10-10: Agoda never contacted our server). A Google Calendar address
//   IS accepted. So this script copies the nights StayVibe says are taken
//   (every other platform, direct bookings, held nights) into a Google
//   Calendar that only this script writes to, and Agoda imports THAT.
//
//   The nights go to Agoda as dates only. Nothing about guests is copied:
//   StayVibe's calendar link never carries names or contact details.
//
// SET UP (once, about ten minutes, signed in as the Google account that
// should own the calendar, e.g. the villa account kerala.luxuryvillas@gmail.com)
//   1. https://script.google.com  ->  New project  ->  name it
//      "StayVibe to Agoda".
//   2. Replace the default code with this whole file.
//   3. Set the AGODA_FEED_URL script property: StayVibe -> Channel calendar -> "Share your
//      calendar back"  ->  the AGODA row  ->  Copy link. (Not the Vrbo or
//      Airbnb row: each platform's link leaves out that platform's own
//      bookings.)
//   4. Left side, "Services" (+)  ->  "Google Calendar API"  ->  Add.
//   5. Choose the function  setup  at the top and press Run. Allow access
//      when Google asks (it needs your calendar and one outside web request).
//      setup creates the calendar, starts the 15-minute timer and runs a
//      first copy. The log says "Done" when it worked.
//   6. In Google Calendar (web), find "StayVibe to Agoda" in the left list,
//      three dots  ->  Settings and sharing  ->  Integrate calendar  ->
//      copy "Secret address in iCal format". Leave the calendar PRIVATE:
//      the secret address works without sharing it with anyone.
//   7. Agoda Partner Portal  ->  Calendar  ->  Calendar connections  ->
//      Import  ->  paste that address, name it, Import.
//
// AFTER THAT it runs by itself every 15 minutes. How to tell it is alive:
//   StayVibe shows "Read N min ago" under the Agoda link (this script is the
//   one reading it) and, from v1.1, a second line, "Google calendar copied N min
//   ago", that this script sends after every run (see REPORTS IN below). If
//   either says hours or days, open the script's Executions page.
//
// REPORTS IN (v1.1)
//   After every run, whether it worked or not, the script tells StayVibe how it
//   went: one small web request to the Agoda link's own address with "/report"
//   in place of ".ics". There is nothing new to set: the token already in
//   AGODA_FEED_URL is the credential, and it only lets this script say how ITS
//   copy went (it opens nothing else). What it sends is counts (blocks, nights,
//   added, moved, removed) and, if a run failed, a short error with any web
//   address taken out. No names, no contacts. A report that cannot be sent
//   never stops the copy, and a StayVibe that has not been updated yet simply
//   ignores it. StayVibe turns the line amber, shows the red warning on Home and
//   emails the owner when the script has been silent for an hour or keeps
//   failing. What it cannot show is what Agoda has imported from the Google
//   calendar: Agoda does that on its own timetable.
//
// ANOTHER TIME ZONE
//   Dates are read in India's time unless the property is somewhere else. For
//   a property in another zone set the optional script property
//   BRIDGE_TIMEZONE (for example America/Chicago): it only decides which
//   night counts as "today", so a stay that ended is dropped on the right
//   morning. Nothing else in this file is about one property.
//
// IF SOMETHING LOOKS WRONG
//   status()     prints when it last copied successfully and how many nights.
//   forceSync()  copies even when the safety stop below held something back.
//
// SAFETY
//   * A failed or non-calendar answer from StayVibe changes nothing.
//   * If one run would remove most of the blocks that are there (it looks
//     like the feed broke, not like bookings were cancelled), it adds and
//     updates but holds the removals back and says so in the log. Run
//     forceSync() if the removals are genuine.
//   * It only touches events it created (tagged sv_uid). Anything you type
//     into that calendar by hand is left alone.
//
// Dates are passed as plain "YYYY-MM-DD" strings through the Calendar API's
// all-day fields (end date exclusive, the same rule iCal uses), so there is no
// time-zone arithmetic that could move a night by a day.
// ============================================================

// ── THE ONE THING YOU SET ─────────────────────────────────────
// The feed link carries an access token, so it lives in a Script Property
// rather than in this file: this script is kept in a git repository, and a
// token committed there is a token everyone with repo access can read.
//
// Set it once, then never touch this file for it:
//   Project Settings -> Script Properties -> Add
//   name   AGODA_FEED_URL
//   value  StayVibe -> Channel calendar -> Share your calendar back ->
//          the Agoda row -> Copy link
var FEED_URL_PROP = 'AGODA_FEED_URL';
function feedUrl_() {
  return String(PropertiesService.getScriptProperties().getProperty(FEED_URL_PROP) || '').trim();
}
// ──────────────────────────────────────────────────────────────

var BRIDGE_VERSION       = '1.1';
var CALENDAR_NAME        = 'StayVibe to Agoda';
var DEFAULT_TIMEZONE     = 'Asia/Kolkata';   // used unless the BRIDGE_TIMEZONE script property names the property's own zone
var BLOCK_TITLE          = 'Not available';
var SYNC_EVERY_MINUTES   = 15;     // Apps Script accepts 1, 5, 10, 15 or 30
var WINDOW_PAST_DAYS     = 400;    // how far back it looks to tidy old events
var WINDOW_FUTURE_DAYS   = 1100;
var MASS_REMOVE_MIN      = 6;      // safety stop: only applies with at least this many live blocks...
var MASS_REMOVE_FRACTION = 0.6;    // ...and when a single run would remove more than this share of them
var PROP_CALENDAR_ID     = 'BRIDGE_CALENDAR_ID';
var PROP_LAST_OK         = 'BRIDGE_LAST_OK';
var PROP_LAST_SUMMARY    = 'BRIDGE_LAST_SUMMARY';
var PROP_TIMEZONE        = 'BRIDGE_TIMEZONE';

// ── ENTRY POINTS ──────────────────────────────────────────────

// Run once from the editor.
function setup() {
  assertFeedUrl_();
  assertCalendarService_();
  var cal = getOrCreateCalendar_();
  installTrigger_();
  var result = runSync_(false);
  if (result && result.ok) {
    Logger.log('Done. "' + CALENDAR_NAME + '" now holds ' + result.blocks + ' night block(s) and will refresh every ' + SYNC_EVERY_MINUTES + ' minutes.');
    Logger.log('NEXT: Google Calendar (web) -> ' + CALENDAR_NAME + ' -> Settings and sharing -> Integrate calendar -> copy "Secret address in iCal format", and paste it into Agoda\'s Calendar connections -> Import.');
  } else {
    Logger.log('Set up, but the first copy did not complete. See the lines above, fix, and run syncNow.');
  }
  return cal.id;
}

// What the timer calls.
function syncNow() { return runSync_(false); }

// Same, but lets a large removal through (see SAFETY above).
function forceSync() { return runSync_(true); }

function status() {
  var p = PropertiesService.getScriptProperties();
  Logger.log('Last successful copy: ' + (p.getProperty(PROP_LAST_OK) || 'never'));
  Logger.log('Last result: ' + (p.getProperty(PROP_LAST_SUMMARY) || '(none)'));
  Logger.log('Calendar id: ' + (p.getProperty(PROP_CALENDAR_ID) || '(not created yet)'));
  Logger.log('Timers: ' + ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'syncNow'; }).length);
}

// ── THE COPY ──────────────────────────────────────────────────

// One run: copy, then tell StayVibe how it went (v1.1). A run that found another copy still going returns null and reports
// nothing: that other run reports for itself.
function runSync_(allowMassRemove) {
  var started = Date.now();
  var result = copyOnce_(allowMassRemove);
  if (result) reportToStayVibe_(result, started);
  return result;
}

function copyOnce_(allowMassRemove) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) { Logger.log('Another copy is still running; skipping this one.'); return null; }
  try {
    assertFeedUrl_();
    assertCalendarService_();
    var today = todayIso_();

    // 1. Ask StayVibe. Anything other than a calendar changes nothing.
    var res = UrlFetchApp.fetch(feedUrl_(), { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'StayVibe-Agoda-Bridge/' + BRIDGE_VERSION } });
    var code = res.getResponseCode();
    var body = res.getContentText();
    if (code !== 200 || !/BEGIN:VCALENDAR/i.test(body)) {
      return fail_('StayVibe answered HTTP ' + code + (code === 200 ? ' but not with a calendar' : '') + '; nothing changed.');
    }

    // 2. What should be blocked: every night in the feed that has not passed.
    var desired = [];
    var seen = {};
    parseIcsEvents_(body).forEach(function (ev) {
      if (ev.end <= today) return;             // already over (also drops the feed's empty-calendar placeholder)
      if (seen[ev.uid]) return;
      seen[ev.uid] = true;
      desired.push(ev);
    });

    // 3. What the calendar holds now (only events this script made).
    var cal = getOrCreateCalendar_();
    var existing = listBridgeEvents_(cal.id, today);

    // 4. The difference.
    var plan = planMirror_(desired, existing);
    var liveRemovals = plan.removes.filter(function (e) { return e.end > today; });
    var liveBefore = existing.filter(function (e) { return e.end > today; }).length;
    var held = 0;
    if (!allowMassRemove && liveBefore >= MASS_REMOVE_MIN && liveRemovals.length > liveBefore * MASS_REMOVE_FRACTION) {
      held = liveRemovals.length;
      plan.removes = plan.removes.filter(function (e) { return e.end <= today; });   // old events are always tidied
      Logger.log('HELD BACK: this run would remove ' + held + ' of ' + liveBefore + ' current blocks, which looks like the feed broke rather than ' +
        'bookings being cancelled. Added/updated only. If the removals are genuine, run forceSync().');
    }

    // 5. Apply.
    plan.inserts.forEach(function (d) {
      api_(function () {
        Calendar.Events.insert({
          summary: BLOCK_TITLE,
          description: 'Kept up to date by the StayVibe to Agoda script. Do not edit.',
          start: { date: d.start }, end: { date: d.end },
          transparency: 'opaque',
          extendedProperties: { private: { sv_uid: d.uid } }
        }, cal.id);
      });
    });
    plan.patches.forEach(function (p) {
      api_(function () { Calendar.Events.patch({ start: { date: p.start }, end: { date: p.end } }, cal.id, p.id); });
    });
    plan.removes.forEach(function (e) {
      api_(function () { Calendar.Events.remove(cal.id, e.id); });
    });

    var blocks = desired.length;
    var summary = blocks + ' block(s) in the feed; +' + plan.inserts.length + ' added, ' + plan.patches.length + ' moved, -' + plan.removes.length +
      ' removed' + (held ? ', ' + held + ' removal(s) held back' : '') + '.';
    var props = PropertiesService.getScriptProperties();
    props.setProperty(PROP_LAST_SUMMARY, new Date().toISOString() + ' ' + summary);
    if (!held) props.setProperty(PROP_LAST_OK, new Date().toISOString());
    Logger.log(summary);
    return { ok: true, blocks: blocks, nights: nightsIn_(desired), inserted: plan.inserts.length, patched: plan.patches.length, removed: plan.removes.length, held: held };
  } catch (e) {
    return fail_('Stopped: ' + (e && e.message ? e.message : e));
  } finally {
    lock.releaseLock();
  }
}

function fail_(message) {
  message = cleanText_(message, 300);   // an error from Google or the network can quote the feed address, token included
  Logger.log(message);
  try { PropertiesService.getScriptProperties().setProperty(PROP_LAST_SUMMARY, new Date().toISOString() + ' ' + message); } catch (e) { /* not fatal */ }
  return { ok: false, error: message };
}

// ── PURE HELPERS (no Google services: the part that is tested offline) ─────

// Reads the VEVENTs of an iCal file into [{uid, start:'YYYY-MM-DD', end:'YYYY-MM-DD'}].
// End is exclusive, as in iCal. Cancelled and "free" events are ignored.
function parseIcsEvents_(text) {
  var unfolded = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
  var lines = unfolded.split('\n');
  var out = [];
  var cur = null;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.uid && cur.start && cur.status !== 'CANCELLED' && cur.transp !== 'TRANSPARENT') {
        var end = cur.end || addDaysIso_(cur.start, 1);
        if (end > cur.start) out.push({ uid: cur.uid, start: cur.start, end: end });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    var m = /^([A-Za-z-]+)(?:;[^:]*)?:(.*)$/.exec(line);
    if (!m) continue;
    var name = m[1].toUpperCase();
    var val = m[2];
    if (name === 'UID') cur.uid = val.trim();
    else if (name === 'DTSTART') cur.start = isoDate_(val);
    else if (name === 'DTEND') cur.end = isoDate_(val);
    else if (name === 'STATUS') cur.status = val.trim().toUpperCase();
    else if (name === 'TRANSP') cur.transp = val.trim().toUpperCase();
  }
  return out;
}

// "20261012" or "20261012T140000Z" -> "2026-10-12"; anything else -> null.
function isoDate_(v) {
  var m = /^(\d{4})(\d{2})(\d{2})/.exec(String(v).trim());
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}

function addDaysIso_(iso, n) {
  var p = iso.split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n));
  return d.toISOString().slice(0, 10);
}

// desired: [{uid,start,end}]   existing: [{id,uid,start,end}]
// -> { inserts:[{uid,start,end}], patches:[{id,uid,start,end}], removes:[{id,uid,start,end}] }
function planMirror_(desired, existing) {
  var byUid = {};
  existing.forEach(function (e) { (byUid[e.uid] = byUid[e.uid] || []).push(e); });
  var plan = { inserts: [], patches: [], removes: [] };
  desired.forEach(function (d) {
    var have = byUid[d.uid];
    if (!have) { plan.inserts.push({ uid: d.uid, start: d.start, end: d.end }); return; }
    var keep = have[0];
    if (keep.start !== d.start || keep.end !== d.end) plan.patches.push({ id: keep.id, uid: d.uid, start: d.start, end: d.end });
    for (var i = 1; i < have.length; i++) plan.removes.push(have[i]);   // duplicates of the same night
    delete byUid[d.uid];
  });
  Object.keys(byUid).forEach(function (uid) {                          // no longer in the feed
    byUid[uid].forEach(function (e) { plan.removes.push(e); });
  });
  return plan;
}

// ── REPORTING BACK: THE PURE PART (v1.1) ──────────────────────

// How many nights a list of {start, end} blocks covers (end exclusive, plain "YYYY-MM-DD" dates).
function nightsIn_(events) {
  var total = 0;
  (events || []).forEach(function (ev) {
    var a = String(ev.start).split('-');
    var b = String(ev.end).split('-');
    var days = Math.round((Date.UTC(Number(b[0]), Number(b[1]) - 1, Number(b[2])) - Date.UTC(Number(a[0]), Number(a[1]) - 1, Number(a[2]))) / 86400000);
    if (days > 0) total += days;
  });
  return total;
}

// One line of text that is safe to send and to show: any web address is taken out (an error message can carry the one that holds the
// token), control characters go, and it is cut to `max` characters.
function cleanText_(text, max) {
  return String(text == null ? '' : text)
    .replace(/https?:\/\/\S+/gi, '<link>')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 160);
}

// Where the report goes: the feed link with ".ics" replaced by "/report" (same address, same token). Anything that is not a StayVibe
// calendar link gives '' and nothing is sent.
function reportUrlFor_(feedUrl) {
  var m = /^(https:\/\/[^\s\/]+\/api\/ical\/[A-Za-z0-9_-]{20,80})\.ics$/.exec(String(feedUrl || '').trim());
  return m ? m[1] + '/report' : '';
}

// What a finished run tells StayVibe. `result` is what copyOnce_ returned: { ok:true, blocks, nights, inserted, patched, removed, held }
// or { ok:false, error }.
function buildReport_(result, ms) {
  var r = result || {};
  var report = { ok: r.ok === true, ms: Math.max(0, Math.round(ms || 0)), version: BRIDGE_VERSION, everyMinutes: SYNC_EVERY_MINUTES };
  if (report.ok) {
    report.blocks = r.blocks || 0;
    report.nights = r.nights || 0;
    report.added = r.inserted || 0;
    report.moved = r.patched || 0;
    report.removed = r.removed || 0;
    report.held = r.held || 0;
  } else {
    report.error = cleanText_(r.error || 'The copy did not finish.', 160);
  }
  return report;
}

// ── GOOGLE SERVICES ───────────────────────────────────────────

// Tells StayVibe how the run went (v1.1). The credential is the feed link itself: the report goes to its address with "/report" in
// place of ".ics". Best effort: a report that cannot be sent (StayVibe not updated yet, a network blip) changes nothing, because the
// copy has already been done.
function reportToStayVibe_(result, started) {
  try {
    var url = reportUrlFor_(feedUrl_());
    if (!url) return;
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      followRedirects: true,
      payload: JSON.stringify(buildReport_(result, Date.now() - started)),
      headers: { 'User-Agent': 'StayVibe-Agoda-Bridge/' + BRIDGE_VERSION }
    });
    var code = res.getResponseCode();
    if (code !== 200) Logger.log('StayVibe did not take the report (HTTP ' + code + '). The copy itself is not affected.');
  } catch (e) {
    Logger.log('Could not report to StayVibe: ' + cleanText_(e && e.message ? e.message : e, 160) + ' The copy itself is not affected.');
  }
}

// The time zone dates are read in: the property's own (the BRIDGE_TIMEZONE script property), India's when it is not set. A zone name
// Google does not know is logged and ignored rather than stopping every copy.
function zone_() {
  var z = '';
  try { z = String(PropertiesService.getScriptProperties().getProperty(PROP_TIMEZONE) || '').trim(); } catch (e) { z = ''; }
  if (z) {
    try { Utilities.formatDate(new Date(), z, 'yyyy-MM-dd'); return z; }
    catch (e) { Logger.log('BRIDGE_TIMEZONE "' + z + '" is not a time zone Google knows; using ' + DEFAULT_TIMEZONE + ' instead.'); }
  }
  return DEFAULT_TIMEZONE;
}

function assertFeedUrl_() {
  if (!/^https:\/\/[^\s\/]+\/api\/ical\/[A-Za-z0-9_-]{20,80}\.ics$/.test(feedUrl_())) {
    throw new Error('The script property ' + FEED_URL_PROP + ' is not set to a StayVibe calendar link. ' +
      'Project Settings -> Script Properties -> Add: name ' + FEED_URL_PROP + ', value from ' +
      'StayVibe -> Channel calendar -> Share your calendar back -> the Agoda row -> Copy link. ' +
      'Nothing is copied until it is set, and the calendar Agoda already reads is left untouched.');
  }
}

function assertCalendarService_() {
  if (typeof Calendar === 'undefined' || !Calendar.Events) {
    throw new Error('The Google Calendar service is not switched on. Left side of the editor: Services (+) -> Google Calendar API -> Add.');
  }
}

function todayIso_() {
  return Utilities.formatDate(new Date(), zone_(), 'yyyy-MM-dd');
}

// The calendar this script writes to: the one it made before, or a new one.
function getOrCreateCalendar_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_CALENDAR_ID);
  if (id) {
    var found = null;
    try { found = CalendarApp.getCalendarById(id); } catch (e) { found = null; }
    if (found) return { id: id, cal: found };
    Logger.log('The calendar this script made earlier is gone; making a new one (the secret address will change: paste it into Agoda again).');
  }
  var created = CalendarApp.createCalendar(CALENDAR_NAME, {
    timeZone: zone_(),
    summary: 'Nights blocked elsewhere, copied from StayVibe360 for Agoda to import. Written by a script; do not edit.'
  });
  props.setProperty(PROP_CALENDAR_ID, created.getId());
  Logger.log('Created the calendar "' + CALENDAR_NAME + '".');
  return { id: created.getId(), cal: created };
}

// Events this script made, as [{id, uid, start, end}] with plain date strings.
function listBridgeEvents_(calendarId, today) {
  var out = [];
  var token = null;
  var timeMin = addDaysIso_(today, -WINDOW_PAST_DAYS) + 'T00:00:00Z';
  var timeMax = addDaysIso_(today, WINDOW_FUTURE_DAYS) + 'T00:00:00Z';
  do {
    var args = { timeMin: timeMin, timeMax: timeMax, singleEvents: true, showDeleted: false, maxResults: 250 };
    if (token) args.pageToken = token;
    var page = Calendar.Events.list(calendarId, args);
    (page.items || []).forEach(function (ev) {
      var uid = ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private.sv_uid;
      if (!uid || !ev.start || !ev.start.date || !ev.end || !ev.end.date) return;   // not ours, or not all-day
      out.push({ id: ev.id, uid: uid, start: ev.start.date, end: ev.end.date });
    });
    token = page.nextPageToken || null;
  } while (token);
  return out;
}

// One Calendar API call, retried once after a pause (rate limits).
function api_(fn) {
  try { return fn(); }
  catch (e) {
    Utilities.sleep(1500);
    return fn();
  }
}

function installTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncNow') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncNow').timeBased().everyMinutes(SYNC_EVERY_MINUTES).create();
  Logger.log('Timer set: syncNow every ' + SYNC_EVERY_MINUTES + ' minutes.');
}
