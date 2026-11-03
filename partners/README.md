# Partners: the booking platforms StayVibe knows

Nothing about a booking platform is written in the code. What a platform is called, the colours it has on the calendar, **what it keeps
of a booking**, whether it itemises its fees, how its bookings and its calendar reach us: all of it is read from the files in this
folder, one file per platform, and from the host's own `partners` block in `hosts/<id>/config.js`. A guard
(`scripts/check-partners.mjs`, run by every build) fails the build if a platform's name or rate is written in `src/` or `functions/`.

**Known partners are shared.** Every host that takes Airbnb bookings has the same Airbnb: it is one file, `airbnb.js`. Every
Booking.com host has the same `booking-com.js`. When a platform changes its rules for everyone, change its file here, once.

## For a new host (the onboarding kit)

1. In the host's `hosts/<id>/config.js`, list the partners the host uses, in the order they should be offered:

   ```js
   partners: {
     direct: {}, airbnb: {}, bookingcom: {}, agoda: {}, agent: {}, other: {},
   },
   ```

   `airbnb: {}` means "Airbnb, as everyone has it". That is all most hosts need. Leave out a platform the host does not use.
2. Only if the host's deal differs, write the difference under that partner (never the whole file):

   ```js
   agoda: { commission: { hostPct: 17 } },          // this host's Agoda rate
   bookingcom: { label: 'Booking' },                // another name on screens
   ```
3. Run `node scripts/seed-tenant-config.mjs <id> --apply` (or the owner's **Sync config**) so the live screens read the new block. Until
   then they use these files' own values, which are the same unless the host overrides one.
4. `enquirySources` in the same config is the short list for "where did the enquiry come from"; leave it out to build it from the
   partners above.

## When a platform changes its rules

* **For everyone**: edit its file (`airbnb.js` ...). Bookings already made keep the amounts they were saved with.
* **For one host only**: write the new rule under that host's partner.
* **From a date, keeping the old rule for older bookings**: give `commission` a list. A booking is worked out under the latest rule that
  had started by its own date (check-in date), so re-saving an old booking never rewrites its history:

  ```js
  airbnb: { commission: [
    { from: '2020-01-01', hostPct: 3,    guestPct: 14.2 },   // the old split-fee model
    { from: '2026-10-01', hostPct: 15.5, guestPct: 0 },      // host-only
  ] },
  ```

## Calendar watch: when a platform goes quiet

A platform learns of nights booked elsewhere only by reading the link StayVibe gives it, so when it stops reading, it can sell a night
that is already taken. StayVibe warns the owner (a red banner on Home and on the Channel calendar, and an email) when one has not read
its link for too long. How long is the platform's own `calendar.staleAfterHours` in its file: how often it reads, with room to spare
(Airbnb reads about every 3 hours, so 6; Vrbo about every half hour, 6; Agoda, through the bridge script every 15 minutes, 3). A platform
with no figure uses the host's default, 12. `calendar.readsEvery` is the words the warning uses ("it usually reads about every 3 hours")
and `calendar.quietWarning` what to check first. A host can change the defaults (never a platform's own figure) with a block in its config:

```js
calendarWatch: { linkStaleHours: 12, linkFirstReadHours: 48, feedStaleHours: 12 },
```

`feedStaleHours` is how long StayVibe may go without managing to read a platform's calendar. The rules are in `src/utils/calendarHealth.js`.

## A platform that is not here yet

* **For one host**: define it entirely in that host's `partners` block. The id must be the platform's name in lower case with no spaces or
  punctuation (`tripco`):

  ```js
  partners: { tripco: { label: 'TripCo', commission: { hostPct: 11 }, feeBreakdown: false, bookingsFrom: 'calendar' } },
  ```
* **For every host**: copy the nearest file here (`booking-com.js` for a platform that gives a percentage, `airbnb.js` for one that
  itemises its fees), change it, then `import` it in `index.js` and add it to `PARTNER_LIBRARY`.

No other code changes: the booking screens, the calendar links, the calendar colours, the new-booking alert and the review wording
all pick the new platform up.

## What a partner file says

| Field | Meaning |
| --- | --- |
| `id` | Short key: the name in lower case, letters and numbers only. Used in a host's `partners` block. |
| `label` | How it reads on screens, calendar entries and messages. |
| `group` | `channel` (a platform that takes a cut), or the host's own doors: `direct`, `agent`, `other`. |
| `names` | Every spelling that shows as this label (`booking.com`, `booking_com`), lower case, exactly as stored in a booking's source. |
| `icon`, `color`, `textColor` | The mark on the caretaker's list; the platform's bars and tags on the calendar. |
| `legendRank` | Order on the calendar-links screen and the legend. Leave out to show it only when used. |
| `commission` | `{ hostPct, guestPct }`: the % of the booking (night fee + cleaning fee) the platform keeps from the host's payout, and any % it adds to the guest's price. Or a dated list (above). |
| `feeBreakdown` | `true` if its confirmation lists the fees in rupees (night fee, cleaning, host fee, you earn, guest fee, guest paid): Complete booking then shows those lines and the booking holds the real amounts. `false` for a platform that gives only a percentage. |
| `bookingsFrom` | `email`: a confirmation email is read and a stay is made. `calendar`: only its calendar shows a blocked date (the owner is told and adds the stay). |
| `reviewKey` | The key under `guestMessages.reviewRequest.platforms / .links` in the host's config. |
| `calendar` | How its calendar takes our link: `via` (`link`, or `google-bridge` for a platform that refuses our address), `whereToPaste`, `readsEvery`, a `note`, and `reservedPrefix` (how its own calendar names a real booking rather than a closed night). |
| `doors`, `prefixes`, `doorLabels`, `enquiryDoors`, `hubLabel`, `guestFormLabel` | Only on the host's own kinds of booking (`direct.js`, `agent.js`, `other.js`). |

Each booking keeps the amounts it was saved with, so changing a rate here changes what NEW bookings are worked out with, and what a
re-save of a booking uses from its own date. It never rewrites past money.
