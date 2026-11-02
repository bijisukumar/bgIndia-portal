# Script properties and triggers

**clasp syncs neither of these.** It pushes and pulls files; script properties
and time-based triggers live only in the Apps Script editor and exist in no
commit. A project rebuilt from this repo will have all its code, run cleanly
when you press Run, and then quietly never fire — because the trigger is not
code and the config it reads is not either.

That failure is silent in both directions, which is why this file exists.

Confirmed on 2026-11-02 by reading the live code pulled from all three
projects. Re-check it whenever a `setup*` function changes.

---

## StayVibe to Agoda — `apps-script/agoda-bridge`

Copies the nights StayVibe says are taken into a private Google Calendar that
Agoda imports, because Agoda refuses calendar links from sites not on its own
approved list.

### Properties

| Name | Who sets it | What it is |
|---|---|---|
| `AGODA_FEED_URL` | **by hand** | The StayVibe export link for the Agoda row. Carries an access token, which is why it is not in the repo. Nothing is copied while it is missing, and the calendar Agoda already reads is left alone rather than emptied. |
| `BRIDGE_CALENDAR_ID` | the script | Which Google Calendar it owns. Written on first `setup()`. |
| `BRIDGE_LAST_OK` | the script | Last successful run. |
| `BRIDGE_LAST_SUMMARY` | the script | Last outcome, success or failure, shown on the Channel calendar screen. |

Only the first is yours to set. The other three are the script's own bookkeeping
and should be left alone.

### Trigger

| Function | Schedule | Installed by |
|---|---|---|
| `syncNow` | every **15 min** | `installTrigger_()`, called from `setup()` |

`setup()` is the single entry point: it checks the feed URL, creates the
calendar, installs the trigger and runs one sync. Run it once per project, then
never again.

---

## PollNewReservationAndProcess — `apps-script/poll-reservations`

Reads Airbnb's mail: new reservations, cancellations, alteration requests and
reviews.

### Properties

| Name | Who sets it | What it is |
|---|---|---|
| `SYSTEM_TOKEN` | **by hand** | Authenticates every call to the worker. Without it each call is refused and the poller does nothing but log. |

### Trigger

| Function | Schedule | Installed by |
|---|---|---|
| `pollNewReservations` | every **5 min** | `setupTrigger()` |

### Hardcoded, not properties

`WORKER_URL`, `TENANT_ID`, `OWNER_EMAIL`, `DRIVE_ROOT_ID` are constants at the
top of the file. They are in the repo and move with a push — the tenant id in
particular, so this file is **not** reusable for a second host as it stands.

---

## process checkin form — `apps-script/guest-form`

The bound script on the check-in form: guest documents into Drive, confirmation
emails, enquiry follow-ups.

### Properties

| Name | Who sets it | What it is |
|---|---|---|
| `SYSTEM_TOKEN` | **by hand** | Same worker auth as the poller. |
| `docRepairToken_fix` / `docRepairToken_preview` | the script | Where a long Drive scan got to, so a run that times out resumes instead of starting over. Deleted when the scan finishes. Safe to remove by hand if one is ever left stranded. |

### Triggers

| Function | Schedule | Installed by |
|---|---|---|
| `sendEnquiryFollowUpReminders` | daily at **09:00** | `setupEnquiryReminderTrigger()` |
| `processPendingDocumentUploads` | every **5 min** | `setupDocumentUploadTrigger()` |
| `processPendingCheckInForms` | time-based | **nothing — created by hand** |

That last row is the one to watch. `processPendingCheckInForms` is what turns a
submitted check-in form into a Drive folder and a confirmation email, and no
function in the file installs its trigger: it was made in the editor and exists
in no code anywhere. Rebuild this project from the repo and everything will
look right while check-in forms quietly stop being processed.

It is also the job that failed on 2026-09-13 with a transient Google error, so
it is worth knowing it is the hand-made one.

### Hardcoded, not properties

Same four constants as the poller, same caveat about `TENANT_ID`.

---

## After rebuilding or recreating any project

1. Set the properties marked **by hand** above.
2. Run that project's `setup*` function to install its triggers.
3. For `guest-form`, add the `processPendingCheckInForms` trigger **manually**
   — clock icon in the editor, time-driven.
4. Check the clock icon lists every trigger the table above names.

A missing trigger reports nothing. The only symptom is work silently not
happening, found days later by its absence.
