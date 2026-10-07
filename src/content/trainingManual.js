// The owner training manual's words. Kept apart from the page that renders
// them (screens/TrainingManual.jsx) so the copy can be edited without touching
// layout. Everything here describes the app as it works TODAY — when a block is
// added, moved or changes behaviour, change it here too.
//
// Inline markup, usable in any string:
//   **bold**           emphasis
//   [[Label]]          a button or label exactly as it appears on screen
//   {{id|link text}}   a link to another section of this manual
//
// Deliberately generic: no villa, manager or town names, because the same
// manual is served on every host (dwarka, demo, and each customer's own).

export const UPDATED = '7 October 2026'

export const TITLE = 'Owner Training Manual'
export const TAGLINE = 'Run your villa from one screen.'
export const INTRO = [
  `Your home screen is built from **blocks**. Some tell you something needs doing today. Some tell you how you are doing. Some are shortcuts to the tools you use all week.`,
  `This manual walks through every one: **what it is, why it is there, and what to do with it.** Tap any name in the contents to jump straight to it, or use the 🔗 beside a heading to copy a link you can send to someone.`,
]

// ── Headings and short intros the page puts around the content ───────────
// They are wording like any other, so they are served with it rather than
// hardcoded in the page — nothing of the manual's text belongs in public JS.
export const LAYOUT = {
  nav: [
    ['map', 'Home map'], ['home-blocks', 'Home blocks'], ['screens', 'Screens'],
    ['guest-pages', 'Guest pages'], ['manager', 'Your manager'], ['routines', 'Routines'],
    ['by-goal', 'Find by goal'], ['faq', 'FAQ'],
  ],
  // Which block kinds are shown, in this order, under "Home blocks".
  kindGroups: [
    ['act',      'Needs you',          'These appear only when something is waiting for you.'],
    ['health',   'Health check',       'This one is always on screen, so you can see that it was checked.'],
    ['insight',  'How you are doing',  'Read-only: nothing to tap, just something to learn from.'],
    ['shortcut', 'Shortcut',           'A quick way into a tool you use often.'],
  ],
  ideas:      { h: 'Three ideas that make everything easier' },
  map:        {
    h: 'Your home screen at a glance',
    sub: 'Top to bottom, in the order they appear. Tap any row to jump to its explanation. Blocks with nothing to say are not shown, so your own screen will often be shorter.',
    legendTitle: 'How to read it',
    legendTile: 'Opens a tool, sometimes with tabs inside.',
    legendTip: 'The coloured bar on the left of each row matches the label, so you can tell at a glance what kind of block you are looking at.',
  },
  blocks:     { h: 'The blocks on your home screen' },
  screens:    { h: 'The tiles, and the screens inside them', sub: 'Below the blocks are your menu tiles. Each opens a tool; some have tabs or further screens, listed under the tile.' },
  guestPages: { h: 'Pages your guests and partners see', sub: 'Three public pages need no login. You send the link; what people do there flows back into your screens.' },
  manager:    { h: 'What your on-site manager sees' },
  firstWeek:  { h: 'Your first week', sub: 'Seven set-up steps. After these, the home screen runs itself.' },
  routines:   { h: 'Routines that keep it working' },
  byGoal:     { h: 'Find it by what you want to do', sub: 'The nine things owners most often say would help them, listed most-requested first, and where in the app each one lives.' },
  glossary:   { h: 'Words used in the app' },
  faq:        { h: 'Common questions' },
}

// ── Three ideas that make everything else easier ─────────────────────────
export const IDEAS = [
  {
    icon: '🔕',
    title: 'Quiet is good news',
    body: `Alert blocks only appear when something needs you. If **Needs attention**, **Review chase** and **Your last 48 hrs** are missing, you are caught up. Two blocks stay on screen as green "all clear" banners — **Duplicate bookings** and **Upcoming gaps** — so you can see at a glance that they were checked.`,
  },
  {
    icon: '🧭',
    title: 'Every stay follows one path',
    body: `Booked → Confirmed → Docs uploaded → Pending review → Ready for check-in → Checked in → Ready for check-out → Checked out → Closed. You move some steps forward and your on-site manager moves others. Most blocks are simply "what is waiting at one step of that path".`,
  },
  {
    icon: '🧾',
    title: 'Reports are only as good as what is recorded',
    body: `The platform you pick on a booking decides which commission is worked out. The extras, expenses and stock your team logs feed the Dashboard. Record things the day they happen and the numbers you see can be trusted.`,
  },
]

// ── Block kinds (colours live in the page) ────────────────────────────────
export const KINDS = {
  act:      { label: 'Needs you',    blurb: 'Asks you to do something' },
  health:   { label: 'Health check', blurb: 'Tells you something is working' },
  insight:  { label: 'Insight',      blurb: 'Tells you how you are doing' },
  shortcut: { label: 'Shortcut',     blurb: 'Takes you to a tool' },
}

// ── Home screen, in the order it appears top to bottom ───────────────────
export const HOME_ORDER = [
  'needs-attention',
  'duplicate-bookings',
  'review-chase',
  'checkin-links',
  'last-48',
  'channel-mix',
  'upcoming-gaps',
]

// The menu tiles under the blocks, as grouped on screen.
export const TILE_GROUPS = [
  { label: 'Serviced villas', ids: ['serviced-villas', 'marketing', 'agent-links', 'flexibility'] },
  { label: 'People & operations', ids: ['guest-repository', 'quick-reports', 'maintenance', 'staff-perks'] },
]

// ── The blocks ────────────────────────────────────────────────────────────
export const BLOCKS = [
  {
    id: 'needs-attention', icon: '🚨', name: 'Needs attention', kind: 'act', when: 'when a guest is waiting',
    tldr: 'Guests who have filled in their check-in form and are waiting for your yes — approve them right here.',
    shows: 'Only when a guest has filled in their check-in form and is waiting for you.',
    what: [
      `A red list at the very top of your home screen. Each row is a guest who has submitted the online check-in form: their name, check-in date, nights and contact, a **Pending review** tag and, if an agent or partner made the booking, **Booked by …**.`,
      `Tap a guest to select them, then choose what to do from the buttons underneath:`,
    ],
    bullets: [
      `[[✅ Onboard Guest]] — approve. The guest moves to **Ready for check-in** and your manager is told they can check them in.`,
      `[[📂 Open booking]] — opens that booking in {{complete-booking|Complete booking}}, to look over the details and documents first.`,
      `[[📁 View folder]] — opens the guest's uploaded documents, when there are any.`,
      `[[Void (keep record)]] — for a booking made in error. It stays on record for reference but is no longer active.`,
      `[[Delete]] — removes the booking permanently. It is blocked automatically if staff commission has already been paid on it; void it instead.`,
    ],
    why: `Your manager cannot check a guest in until you have seen their details and said yes. This block sits above everything else so a waiting guest can never be overlooked — and most of the time the answer is simply "yes, welcome", which takes one tap.`,
    gain: `No guest is left waiting at the gate because a form went unnoticed, and approving takes one tap.`,
    note: `When unsure, **void rather than delete**. A voided booking can still be looked up later; a deleted one cannot.`,
  },
  {
    id: 'duplicate-bookings', icon: '✅', name: 'Duplicate bookings — calendar health', kind: 'health', when: 'always',
    tldr: 'A green light — or a red alarm — that your platform calendars are in step.',
    shows: 'Always. Green when all is well, red when something needs a look.',
    what: [
      `A health check on your channel calendars.`,
      `**Green:** "No duplicate bookings in the last 2 months — calendar sync is healthy."`,
      `**Red:** every time in the last two months a booking arrived for dates that were already taken — who tried to book which dates, who they clashed with and how many nights overlapped — grouped by platform. Tap the banner to open it.`,
    ],
    why: `A villa listed on more than one platform only works if every calendar stays in step. When one stops syncing, two families can be promised the same nights. A red banner is the early warning.`,
    gain: `Catch a calendar problem days ahead, not when two families reach the same door.`,
    steps: [
      `Tap the red banner and note which platform is named.`,
      `Open {{channel-calendar|Channel calendar}} and look for "sync failed" beside that platform.`,
      `Sort it out with the guest or the platform, then tap [[Mark resolved]]. The incident stays on record.`,
    ],
  },
  {
    id: 'review-chase', icon: '⭐', name: 'Review chase', kind: 'act', when: 'after check-outs',
    tldr: 'Guests who have left but not reviewed you, with a one-tap request.',
    shows: 'When a guest has checked out and no star rating has been recorded yet.',
    what: [
      `A list of guests who have left but not yet reviewed you, each with the platform they booked through, how many days ago they left and how many times you have already chased. Tap a guest to open their actions:`,
    ],
    bullets: [
      `[[💬 Send WhatsApp review request]] — opens WhatsApp with a ready-written message to that guest. The chase is logged, so you can see how often you have asked.`,
      `**Close with a rating** — tap 1 to 5 stars and [[Close]] once the review appears. This closes the stay.`,
      `[[No review]] — close it without a rating.`,
      `[[Auto-close N old →]] — once guests have been gone 20 days or more, clears all of them in one tap.`,
    ],
    why: `Reviews are what fill future calendars, and nobody remembers who they have already nudged. This list does the remembering — and closing a stay marks it complete.`,
    gain: `More reviews with nothing to remember, and tidy, fully closed stays.`,
    note: `WhatsApp opens with the message ready; **you tap send**. Nothing is ever sent to a guest without you.`,
  },
  {
    id: 'checkin-links', icon: '🔗', name: 'Check-in links', kind: 'shortcut', when: 'always, folded',
    tldr: 'The check-in form links you send to guests, one per booking platform.',
    shows: 'Always — folded to a single line, "🔗 CHECK-IN LINKS · N active". Tap it to open.',
    what: [
      `The check-in form links you give to guests, **one per booking source** (for example Airbnb, direct, VRBO). Each row shows the link, how many times it has been opened, and these buttons:`,
    ],
    bullets: [
      `[[📋 Copy]] — copies the full link, ready to paste into a message.`,
      `[[Deactivate]] / [[Activate]] — turns a link off or on. A guest who opens a deactivated link is told it is not valid.`,
      `[[+ New]] — creates a link for a new partner: give it a short partner name and, if you like, a label.`,
    ],
    why: `Before arrival you need each guest's ID and arrival details (and, for foreign nationals, the Form C registration the law requires). One link per source means a guest arrives at the form already tagged with how they booked — you never have to ask "which platform was this?" — and a submitted form shows up in {{needs-attention|Needs attention}}.`,
    gain: `Every guest arrives at the right form, already tagged with how they booked.`,
    steps: [
      `Copy the link that matches how the guest booked and send it with your pre-arrival message. (The [[📝 Send check-in link]] button in {{complete-booking|Complete booking}} does this in one tap.)`,
      `Switch a link off when you stop working with that partner.`,
    ],
  },
  {
    id: 'last-48', icon: '🕓', name: 'Your last 48 hrs', kind: 'act', when: 'when something changed',
    tldr: 'What was booked or cancelled in the last two days.',
    shows: 'When a booking was made or cancelled in the last 48 hours.',
    what: [
      `A short feed of what just changed: each new booking (✅) or cancellation (❌) with the guest's name, the platform badge and the dates.`,
    ],
    why: `Bookings and cancellations arrive from several places, and notification emails get buried. This is the one "what changed since I last looked" list.`,
    gain: `Every new booking and cancellation in one place, whichever platform it came from.`,
    steps: [
      `Read the list, then tap [[OK — got it]]. It is remembered on every device you use. An item only comes back if it changes — for example, a booking you already acknowledged is later cancelled.`,
    ],
  },
  {
    id: 'channel-mix', icon: '💡', name: 'Channel mix — this month', kind: 'insight', when: 'when platform bookings check in', featured: true,
    tldr: 'How much the booking platforms took from you this month, in rupees.',
    shows: 'In any month with at least one booking that came through a booking platform (Airbnb, Booking.com, MakeMyTrip and so on). If every booking this month is direct there is nothing to compare, so it stays out of the way.',
    what: [
      `One question, answered in rupees: **how much did the booking platforms take from me this month?**`,
      `The chip beside the heading shows the month's total commission — the money the platforms keep out of your payout. Tap the block to see it by platform: how many bookings each one brought, what they were worth before commission (**gross**), and what each one charged (**commission**).`,
      `Under the list is a simple "what if". If you had given those guests a direct-booking incentive worth **half** the commission you paid, you would still be ahead by the other half. It is an illustration, not a forecast: it exists to show that a direct-booking discount costs less than a platform commission.`,
    ],
    detail: [
      { name: 'What counts as "this month"', text: `Bookings whose **check-in date** falls in the current calendar month. Cancelled and void bookings are left out.` },
      { name: 'Where the commission comes from', text: `When a booking's financials are saved, the app applies a standard rate for its platform — for example 3% for Airbnb's host fee, 15% for Booking.com and 18% for MakeMyTrip. Direct bookings carry none. Channel mix simply adds up what was recorded.` },
      { name: 'Where the full picture lives', text: `This block is the monthly teaser. For a whole year, open {{dashboard|Dashboard}} → Financials: **Commissions**, **Direct ratio**, the **Direct booking savings** insight and the full **P&L**.` },
    ],
    why: `Platforms are very good at sending guests, but they charge for it every time, and that cost is invisible until somebody adds it up. Channel mix adds it up for you every month. It exists to answer one business question: **is it worth winning more of these guests directly?**`,
    gain: `See exactly what the platforms cost you in rupees — the number that makes the case for booking direct.`,
    steps: [
      `Glance at the chip at the start of each month. Is it going up or down?`,
      `Tap in and see which platform costs you the most.`,
      `If it is high, put the direct tools to work: share your direct link, send guests the {{flexibility|Flexibility}} page (early check-in and late check-out are a perk of booking direct), and offer returning guests a direct rate in your quote.`,
    ],
    example: `Three Airbnb stays worth ₹60,000 and one Booking.com stay worth ₹40,000 check in this month. Airbnb's 3% comes to ₹1,800 and Booking.com's 15% to ₹6,000, so the chip reads **₹7,800 commission**. The "what if" line says an incentive worth ₹3,900 would still leave you ₹3,900 better off than paying the commission.`,
    faq: [
      { q: `I cannot see Channel mix.`, a: `No platform booking checks in this month, so there is nothing to compare. It returns the moment one does.` },
      { q: `Does it include bookings I have not recorded?`, a: `No. It can only add up what has been recorded, which is why recording each booking promptly matters.` },
      { q: `Is the "what if" a promise?`, a: `No. It is an illustration that uses half of the commission you actually paid, so it can never produce a negative figure.` },
    ],
  },
  {
    id: 'upcoming-gaps', icon: '📅', name: 'Upcoming gaps — next 60 days', kind: 'insight', when: 'always',
    tldr: 'Empty stretches of two or more nights in the next 60 days.',
    shows: 'Always. When there are no gaps it shows a green "Fully booked" line instead.',
    what: [
      `Looks 60 days ahead for stretches of **two or more nights** when nobody is booked. Each gap lists its dates, the number of nights and how many days away it begins.`,
      `If there are none you will see: "Fully booked — no gaps of 2+ nights in the next 60 days".`,
    ],
    why: `An empty stretch you notice three weeks out can still be sold; one you notice the day before cannot. This block gives you the dates while there is still time to act.`,
    gain: `Empty nights found while there is still time to sell them.`,
    steps: [
      `Tap the block to see the gaps.`,
      `Fill them: send a win-back message to past guests (see {{guest-repository|Guest repository}}), run a limited-time offer, or create a tracked flyer in {{marketing|Marketing}}.`,
      `Open {{dashboard|Dashboard}} → Marketing to see whether the gap falls in a peak season.`,
    ],
    note: `Single-night holes are not flagged, because they rarely sell. A night counts as taken from the check-in date up to the night before check-out.`,
  },
]

// ── Menu tiles and the screens inside them ────────────────────────────────
export const TILES = [
  {
    id: 'serviced-villas', icon: '🏡', name: 'Serviced Villas', opens: 'Home tile',
    tagline: 'The control room for the villa itself.',
    what: [
      `Where a booking is created, completed, tracked and reported on. Inside you will find a card for each property with eight shortcuts, and below it a live **Upcoming Guests** list.`,
    ],
    why: `Everything that happens to a stay — from the first enquiry to the final report — starts or ends here.`,
    gain: `One place for the whole life of a booking.`,
    screens: [
      {
        id: 'upcoming-guests', icon: '🗓️', name: 'Upcoming Guests', opens: 'Serviced Villas · bottom card',
        does: [`Your arrivals, soonest first. Each row shows the date, the guest, nights, party size and home city, a status pill (**Confirmed**, **Pending**, **Docs in**, **Ready**, **In-house**, **Checkout**) and "in N days". Filter with the **30d · 60d · 90d · 120d · All** buttons. Tap a guest to open that booking in {{complete-booking|Complete booking}}.`],
        gain: `A glance at who is coming, and how ready each stay is.`,
      },
      {
        id: 'new-booking', icon: '📋', name: 'New booking', opens: 'Serviced Villas',
        does: [`Record a booking that has reached you — a phone call, a WhatsApp message, a platform notification.`],
        why: `Everything else — the calendar, the alerts, the income reports, your manager's check-in list — hangs off this one record.`,
        gain: `One entry creates the Stay ID, the document folder and the email trail.`,
        insideLabel: 'On the screen',
        inside: [
          { name: 'Booking status', text: `Where the booking stands: Booked, Confirmed, Registered, Checked In or Checked Out.` },
          { name: 'Booking details', text: `The booker's name, check-in and check-out dates (nights are worked out for you) and an estimated guest count.` },
          { name: 'Channel & tariff', text: `Which platform it came from, the nightly rate and any extra charges. For Airbnb there are extra fields copied from its confirmation email — night fee, cleaning fee, host service fee (3%, filled in for you) and the amount **you earn**. Enter that last figure and the tariff fills itself in.` },
          { name: 'Revenue preview', text: `A live summary of what you earn and what the guest paid, before you save.` },
          { name: 'On save', text: `The booking gets a **Stay ID**, a folder is created for the guest's documents, and you are emailed a confirmation. A "next steps" card follows: send the guest their check-in link, the guest completes the form, your manager checks them in, then record the income.` },
        ],
      },
      {
        id: 'guest-enquiries', icon: '📨', name: 'Guest enquiries', opens: 'Serviced Villas',
        does: [
          `A small CRM for people who have asked but not yet booked. It tracks every enquiry from the first message to a confirmed booking or a lost one, so no one is forgotten and you learn why some do not book.`,
        ],
        why: `Most enquiries are lost for ordinary reasons: nobody replied quickly, nobody followed up. This screen makes both automatic habits.`,
        gain: `Faster replies, steady follow-ups and a clear view of what converts.`,
        insideLabel: 'Screens inside',
        inside: [
          { name: 'The list', text: `Search by name, phone or email, or filter by status — **New, Quoted, Follow-Up Needed, Negotiating, Confirmed, Lost, Cancelled** — each with a count. Every card shows:`, bullets: [
            `The guest, with a **Repeat · N×** badge for returning guests, plus contact and source (Website, Airbnb, Booking.com, WhatsApp, Phone, Referral).`,
            `Dates, nights, party size, the quote or final offer, and a **Follow up by** date.`,
            `"N days since last contact", amber after a day and red after three, beside a one-tap [[💬 Nudge]] that opens WhatsApp with a friendly follow-up and logs it as contact.`,
          ] },
          { name: 'Possible matches — same guest?', text: `When an enquiry has the same dates as an existing stay under a slightly different name, you are asked to link them ([[✓ Same guest — link]]) or dismiss it ([[Not a match]]), so enquiries do not sit open after the guest has already booked.` },
          { name: 'Archive', text: `Enquiries whose dates have passed, or that are Lost or Cancelled, fold away into a collapsed Archive so the main list only shows what is still live.` },
          { name: '+ New (New enquiry)', text: `Guest details (typing a name searches your past guests, so a returning guest is recognised), the stay request with an availability check, party size, purpose (Vacation, Wedding, Temple Visit, Family Function, Dance, Other) and source, then pricing from your rate card with discount type or repeat-guest percentage, quote and final offer.` },
          { name: 'Enquiry detail (tap a card)', text: `Everything for one enquiry:`, bullets: [
            `**Pricing** — adjust dates or guests and tap **Adjust & get pricing**; pick a discount type; add extra charges.`,
            `**The quote** — [[📋 Generate & copy WhatsApp quote]] or [[💬 Send quote in WhatsApp]] (it opens the guest's chat with the quote ready; you tap send). It opens with a link to your villa's pictures and details, then dates, timings, rate and answers to common questions. There are three versions: first contact, returning guest (leads with their discount) and travel partner (shows the commission).`,
            `**Actions** — change **Status**; [[✓ Confirm Booking]] (creates the stay); [[✕ Mark Lost]] with a reason (Price, Dates Unavailable, Chose Another Property, Change of Plans, No Response, Other).`,
            `**Log communication** with a follow-up date, and the **Communication timeline**.`,
          ] },
          { name: 'Conversion Dashboard', text: `How well enquiries turn into bookings:`, bullets: [
            `**Summary** — enquiries, confirmed, lost, **conversion rate**, **revenue won** and **revenue lost**.`,
            `**Source analysis** — which sources bring enquiries and bookings.`,
            `**Repeat guest metrics** — repeat guests, repeat revenue and average discount.`,
            `**Why enquiries are lost** — the reasons, counted.`,
          ] },
        ],
      },
      {
        id: 'complete-booking', icon: '🏨', name: 'Complete booking', opens: 'Serviced Villas',
        does: [
          `Where you take a booking from "received" to "ready for check-in" and see it through to closed: add the money, confirm the documents, and move the stay along its path.`,
        ],
        why: `A booking is only useful if its money, documents and status are right. This is the one screen where all three are kept honest.`,
        gain: `Accurate income per stay, and a clear hand-off to your manager.`,
        insideLabel: 'On the screen',
        inside: [
          { name: 'Checked-in guests', text: `For guests currently staying: [[💬 Send comfort check]] (a WhatsApp "hope you have settled in"), [[📧 Send checkout email now]] (a manual backup — the checkout-day email normally goes out by itself around 6:00 AM) and [[🙏 Send farewell message]].` },
          { name: 'Select guest', text: `Your upcoming stays with their status and days to check-in. [[🔗 Merge bookings]] links two records when the person who booked is not the person who stayed, so the money sits with the right guest.` },
          { name: 'Guest info', text: `Name, phone (a leading 0 is removed and +91 added when you save, because WhatsApp rejects both otherwise), adults and children, requested arrival time, **Booked by**, and the check-in and check-out dates with the **day of the week** spelled out, which is easier to read aloud to a guest.` },
          { name: 'Channel & tariff', text: `The platform, the nightly rate, and itemised **extra charges** chosen from a list (for example Additional Guest or Floor Bed). For Airbnb there is a fee breakdown with occupancy tax shown separately.` },
          { name: 'Extended stay reference', text: `25% and 50% of what the guest actually paid per night, as a quick guide for pricing early check-in, late check-out or a half-day.` },
          { name: 'Save financial details', text: `Saves the figures. This is what the Dashboard, Channel mix and Staff Perks later add up.` },
          { name: 'Messages', text: `[[💬 Send WhatsApp intro]] and [[📝 Send check-in link]] open WhatsApp with the text ready. You tap send.` },
          { name: 'Move lifecycle forward', text: `[[📁 Mark documents uploaded]], [[🔑 Mark ready for check-in]] (your manager is notified), [[❌ Cancel booking]], [[👻 Mark as No-Show]], [[💸 Record a refund]], [[🚫 Void stay]] (keeps the record) and [[🗑️ Delete permanently]].` },
          { name: 'Correct a mistake', text: `Undo a check-in or a check-out. It clears the recorded actual times and removes the staff commission if it has not been paid yet.` },
          { name: 'Stay lifecycle', text: `A guide on the page showing where this booking sits on the path, from Booked to Closed.` },
          { name: 'Form C (foreign guests)', text: `For foreign nationals, the registration details required by law — nationality, passport and visa, and whether the documents were scanned — read back from the check-in form.` },
        ],
      },
      {
        id: 'dashboard', icon: '📊', name: 'Dashboard', opens: 'Serviced Villas',
        does: [`Your numbers: what came in, what it cost and what you kept, across any year, month, platform or guest. Four tabs:`],
        why: `You cannot improve what you cannot see. This replaces the monthly spreadsheet.`,
        gain: `Revenue, profit and trends without building a single report.`,
        insideLabel: 'Tabs',
        inside: [
          { name: '💰 Financials', text: `Pick a year (or **All**) and a month (or **All**) to see:`, bullets: [
            `**Four cards** — Gross revenue (with bookings and nights), Net to owner (and its share of gross), Commissions (paid to platforms) and Direct ratio (direct against platform bookings).`,
            `**P&L** for the full year — gross revenue, upsell (floor beds, extended check-out, add-ons), discounts, channel commission, staff commission and expenses, ending in **Net to owner**.`,
            `**Revenue breakdown** — room tariff, floor bed, other extras, car rental, kitchen, breakfast and events.`,
            `**Revenue per guest** for a chosen month.`,
            `**Key insights** — best month, top channel, **direct booking savings** and average nights per stay.`,
          ] },
          { name: '📣 Marketing', text: `Where to put your marketing effort, and when:`, bullets: [
            `**Plan ahead — next 3 months** — each month with its season tag and how full it is, with a warning when a peak month is under 60% booked.`,
            `**Occupancy** for the year, month by month.`,
            `**Peak-season calendar** — festivals and holidays that drive demand.`,
            `**Marketing playbook** — what to do four months, three months, two months, six weeks and two weeks before a peak.`,
          ] },
          { name: '👥 Guests', text: `Your bookings as a list:`, bullets: [
            `**Needs attention — unclosed stays** — guests past check-out whose stay was never closed.`,
            `**Currently staying** and **Upcoming bookings**.`,
            `**Bookings by month**, with how many days ahead each was booked.`,
            `**Year summary** — bookings, checked out, active, upcoming, cancelled and unclosed.`,
          ] },
          { name: '📊 Statistics', text: `Three charts for spotting patterns:`, bullets: [
            `**Monthly trend** over up to ten years.`,
            `**Earnings comparison** between years.`,
            `**Booking lead time** — how far ahead guests book, from impulsive to well planned.`,
          ] },
        ],
      },
      {
        id: 'channel-calendar', icon: '🗓️', name: 'Channel calendar', opens: 'Serviced Villas',
        does: [
          `One calendar for every platform, working in both directions. You paste each platform's calendar link once; the app pulls in the dates it has blocked and shows them together with your own bookings. It then gives each platform a private link of its own to import back, so every platform blocks the nights taken on the others — your direct bookings included.`,
        ],
        why: `If Airbnb and Booking.com each think a night is free, you can be double-booked. Reading the platforms puts them all on one calendar and outlines any clash; giving each one its own link is what stops the clash happening. A booking you take by WhatsApp or phone is something no platform can learn about any other way.`,
        gain: `Platforms stay in step without you updating each one by hand.`,
        insideLabel: 'On the screen',
        inside: [
          { name: '+ Feed', text: `Add a platform: its name, an optional label, and its calendar link (on Airbnb: calendar settings → "Export Calendar").` },
          { name: 'Connected feeds', text: `Each platform with its last-synced time or a clear "sync failed" message. [[Pause]] / [[Resume]] or [[Remove]] a feed (a paused platform stops being passed on to the others). [[🔄 Sync now]] refreshes immediately. The app also refreshes a calendar whenever you open this screen, and whenever a platform reads its link below.` },
          { name: 'Share your calendar back', text: `One row per platform, each with [[Create link]]. Tap [[📋 Copy link]] and paste it into that platform's calendar import (look for "Import calendar" in its calendar settings). The link holds every night taken anywhere else — never that platform's own bookings — and dates only: no guest names, contacts or booking numbers. Each row shows when the platform last read its link, and warns if it has not for over a day. [[New link]] replaces a link (the old one stops working at once); [[Remove]] withdraws it.` },
          { name: 'Calendar', text: `A month grid with each platform in its own colour and a ⚠️ outline wherever two platforms overlap. Use the arrows or **Today** to move around.` },
        ],
        note: `Platforms read a link on their own schedule — Airbnb about every 3 hours, Vrbo about every 30 minutes — so a booking can take a few hours to show up on the others. That delay is theirs, not the app's. Booking.com and Agoda only offer calendar links when the villa is listed as a single unit, and Booking.com not at all while a channel manager is connected. This screen is the other half of the {{duplicate-bookings|Duplicate bookings}} banner on your home screen.`,
      },
      {
        id: 'inventory', icon: '📦', name: 'Inventory', opens: 'Serviced Villas',
        does: [`Stock of everything guests and housekeeping use — water, snacks, toiletries, bedroom essentials — with what it costs you and what you charge.`],
        why: `Items consumed during a stay are billed at checkout, so prices must be right; and nothing frustrates a guest like running out. Your manager uses the same screen to restock.`,
        gain: `Know what is running low, and what each item really costs.`,
        insideLabel: 'Tabs',
        inside: [
          { name: '📦 Stock', text: `Current stock by category (Kitchen, Bathroom, Bedroom, Other). Tap a quantity to edit it; low items are flagged. **⚙ preferred levels** sets a target per item — an item is flagged low when it falls to 10% of its target.` },
          { name: '💰 Prices', text: `Cost and sell price for each item. Sell prices are the ones used at checkout for kitchen incidentals.` },
          { name: '➕ Restock', text: `Enter what you bought: quantity, rate per unit and GST%. The total cost and the net rupees per unit are worked out for you. Add a new item from here, and see **Recent restocks**.` },
        ],
      },
      {
        id: 'expenses', icon: '🧾', name: 'Expenses', opens: 'Serviced Villas · also your manager\'s home',
        does: [`A running log of what the villa costs to run — electricity, maintenance, repairs, laundry, deep cleaning, supplies and so on. The category list is set per villa.`],
        why: `Profit is only real once expenses are counted. Everything logged here flows into the **Expenses** line of the Dashboard's P&L.`,
        gain: `Real profit, not just revenue — and a receipt that fills in its own form.`,
        insideLabel: 'Tabs',
        inside: [
          { name: '+ Add expense', text: `Date, amount, category, who it was paid to and a description. [[📷 Scan receipt]] reads a photo of the bill and fills in the vendor, amount, date and category for you to check — the photo itself is not kept. You are emailed when an expense is saved.` },
          { name: 'History', text: `Every expense with **This month's total**. Filter by category, and edit or delete an entry.` },
        ],
      },
      {
        id: 'notification-settings', icon: '🔔', name: 'Notification settings', opens: 'Serviced Villas',
        does: [`Tells the app which email address receives your alerts — check-ins, check-outs, kitchen incidentals and villa expenses — and shows the most recent email attempts so you can see that they are being sent.`],
        why: `Alerts only help if they reach you. This is the one place to point them at the right inbox.`,
        gain: `Every important event lands in your inbox, and you can check that it did.`,
      },
    ],
  },
  {
    id: 'marketing', icon: '📣', name: 'Marketing', opens: 'Home tile',
    tagline: 'Flyers, QR codes and tracking — know what actually brings bookings.',
    what: [
      `Create a **campaign** for each place you promote — a WhatsApp group, an Instagram post, a printed flyer, a travel agent. Each gets its own tracked link, a QR code and a printable flyer.`,
    ],
    why: `Most marketing is guesswork: you post in five places and cannot tell which one worked. Because every campaign has its own link, you can see how many people clicked, how many enquired and how many booked.`,
    gain: `Spend time only where bookings come from.`,
    insideLabel: 'On the screen',
    inside: [
      { name: '+ New', text: `Name the campaign (for example the group or person it is for), pick a channel — WhatsApp, Instagram, Facebook, Print, Email, Temple group, Travel agent or Other — and add notes about who and why.` },
      { name: 'Each campaign', text: `Shows its channel and a **Clicks → Inquiries → Bookings** bar with the **conversion** percentage. Tap [[🖼️ Flyer]] to preview the printable flyer and its tracking link, then [[⬇️ Download PNG]] to save it ready to share on WhatsApp or Instagram. [[Pause]] / [[Resume]] it, or tap [[×]] to delete it (that removes its analytics too).` },
      { name: 'Total clicks', text: `The top of the screen adds up clicks, enquiries and bookings across every campaign.` },
    ],
    steps: [
      `Tap [[+ New]] and create a campaign for the next place you will promote.`,
      `Download the flyer and share it — the QR code and link carry the campaign's tracking.`,
      `Come back in a week and see which campaigns turned clicks into bookings. Do more of those.`,
    ],
  },
  {
    id: 'agent-links', icon: '🤝', name: 'Agent quote links', opens: 'Home tile',
    tagline: 'Let travel agents quote themselves — without your rate card.',
    what: [
      `A personal link for each travel agent or sales partner. They open it, enter dates and number of guests, and instantly see an estimate: nights, bedrooms needed, rate per night, subtotal and total. No login and no phone call.`,
    ],
    why: `Agents ask for quotes constantly, usually while you are busy. A self-serve link answers them at once, and it only ever shows the answer for the dates they asked about — never your full rate card.`,
    gain: `Partners get quotes in seconds; you get your time back.`,
    insideLabel: 'On the screen',
    inside: [
      { name: '+ New', text: `Enter the agent or agency name and, if you want to reward them, a discount percentage. A link is created.` },
      { name: 'Each link', text: `Shows the agent's name, the discount (**% off**), the link and how many quotes it has generated. [[📋 Copy]] it to send to the agent, or [[Pause]] / [[Resume]] it.` },
    ],
  },
  {
    id: 'flexibility', icon: '🕐', name: 'Flexibility requests', opens: 'Home tile',
    tagline: 'Early check-in and late check-out — requested online, answered with the facts in front of you.',
    what: [
      `A page your direct guests use to ask for an earlier arrival or later departure, and an inbox where you answer them. The guest page explains why standard timings are what they are, offers two options — **Must have** (you hold the neighbouring night for a fraction of its price) or **ask on the day** (free if the villa happens to be free) — and has a request form.`,
    ],
    why: `These requests used to arrive as scattered calls and messages, each needing you to check the calendar and work out a price. Now every request arrives with the answer already worked out.`,
    gain: `Guests ask the right way; you decide in seconds; and it is a reason to book direct.`,
    insideLabel: 'On the screen',
    inside: [
      { name: 'Links to share with guests', text: `Four buttons copy a link to the guest page, each opening at a different place: **Flexible check-in / check-out** (the top), **Bedroom access** (only if your villa prices by bedroom), **Request form** and **Timings explained**. They always use your villa's own public address.` },
      { name: 'Each request', text: `Shows the guest, their contact and booking source, what they need, the times they asked for, how firm it is (**Must have**, **Will check on arrival** or **Nice to have**) and whether they **want to book direct**.` },
      { name: 'Can you do it?', text: `A verdict from your calendar: **Adjoining day is free**, **Booked either side — but this still fits** (allowing time to turn the villa around) or **No room to turn the villa around**, with the earliest hand-over and latest departure that would work.` },
      { name: 'What to charge', text: `The nightly rate with **25%** and **50%** worked out. Pick one, add a private note, then [[Approve]] or [[Can't do]].` },
      { name: 'Booked through a platform?', text: `Their request is marked **OTA lead**: there is nothing to price, but they are asking for your direct rates — an invitation to win them next time.` },
    ],
  },
  {
    id: 'guest-repository', icon: '👥', name: 'Guest repository', opens: 'Home tile',
    tagline: 'Your guests as relationships, not rows.',
    what: [
      `Every guest you have hosted, with their stay history and contact details, automatically sorted into groups you can act on.`,
    ],
    why: `A returning guest costs nothing to win; a new one costs a platform commission. This is where you find the guests worth a message.`,
    gain: `Know your best guests, and exactly who to contact and with what.`,
    insideLabel: 'Tabs',
    inside: [
      { name: '👥 Guests', text: `Totals (guests, repeat guests, guests with contact details), then **Segments** — **VIP** (5 or more stays), **Frequent visitor** (3 or more), **Temple regular**, **Wedding guest**, **Overseas** and **Family traveller**. Search by name, city or country, or filter by segment. Tap a guest for their profile: type, stay history (how they booked, where from, their review), contact with a WhatsApp button, and **Marketing actions** — a suggested offer for that kind of guest.` },
      { name: '🎯 Marketing', text: `Where your guests come from and why: **Guests by state**, **Purpose of stay**, **Channel — bookings vs revenue**, and a **Data quality** check showing how many guests are missing details.` },
    ],
  },
  {
    id: 'quick-reports', icon: '🗄️', name: 'Quick Reports (DB Admin)', opens: 'Home tile',
    tagline: 'Ready-made answers for questions the Dashboard does not cover.',
    what: [
      `A set of read-only reports — total stays, revenue by booking channel, bookings and revenue by year, your five most recent bookings, repeat guests, average tariff and nights by year, **direct against platform split**, unpaid and paid staff commission, full inventory stock and low-stock items. Pick one and run it.`,
      `Owners of other villas see this as **Quick Reports**. The platform operator's login also unlocks saved queries, a SQL editor and a schema viewer, which is why the tile is called DB Admin there.`,
    ],
    why: `Sooner or later you will want a number the Dashboard does not show. These reports answer the most common ones without needing anyone to write a query.`,
    gain: `Answers on demand, with no spreadsheet and no waiting.`,
  },
  {
    id: 'maintenance', icon: '🛠️', name: 'Maintenance', opens: 'Home tile',
    tagline: 'Staff logins and a few settings.',
    what: [
      `The back-office room. For most owners it holds three things you will actually use.`,
    ],
    inside: [
      { name: 'Staff & Access', text: `Everyone who has a login for your villa. **Reset a PIN** (the new PIN is shown once, so share it straight away — only a scrambled version is stored), **lock or unlock** an account (it takes effect at their next login), or **add a new staff login** with a pay type: **Commission only**, **Salaried** or **Salary + commission**, and the commission for a one-night and a two-night-or-longer stay.` },
      { name: 'Training manual access', text: `Decide who can read this manual. Either **anyone with the link**, or **only people with a passcode** that you make for each person, each with its own time limit — from two hours to no limit. A passcode is shown once when you make it, can be given more time or revoked whenever you like, and you can see whether and when it has been opened. You are never locked out of your own manual while you are signed in.` },
      { name: 'Keep car and plate photos in Drive', text: `A switch. Off by default: the plate number is saved as text either way, and the photos expire after 5 days. Turn it on to keep the photos permanently, at an ongoing storage cost.` },
    ],
    why: `Staff change. This lets you add, reset or lock a login yourself, in seconds, without waiting for anyone.`,
    gain: `Control of who can sign in, without needing technical help.`,
  },
  {
    id: 'staff-perks', icon: '📊', name: 'Staff Perks', opens: 'Home tile',
    tagline: 'What you owe your on-site manager, always up to date.',
    what: [
      `Your manager's commission, tracked automatically. The moment a guest is checked out, a commission entry is created; this screen shows what is unpaid, and lets you mark it paid.`,
    ],
    why: `Commission is easy to lose track of when it is worked out in your head or on paper. Here every stay that earned one is listed, with a record of what has been paid.`,
    gain: `Pay on time, pay the right amount, and never wonder what is outstanding.`,
    insideLabel: 'Tabs',
    inside: [
      { name: '⏳ Unpaid', text: `**Total outstanding**, grouped by quarter. Tick the stays you are paying and tap **Pay N selected**, or **Mark all paid**. A **GPay** button opens a UPI payment to your manager for that amount, ready for you to confirm.` },
      { name: '📋 History', text: `The **all-time summary**, **paid to date**, a breakdown by year and month, and any stays that were checked out but never got a commission entry — flagged so you can review and add them by hand.` },
    ],
    note: `Your manager has their own **My earnings** screen. It shows which stays are paid and which are pending, but **never any amounts**.`,
  },
]

// ── Pages your guests and partners see ───────────────────────────────────
export const GUEST_PAGES = [
  {
    id: 'checkin-form', icon: '📝', name: 'Check-in form', path: '/checkin/…',
    who: 'Guests, with a link you send',
    text: [
      `A public form — no login — where each guest enters their personal details, stay details and ID. Foreign nationals complete a Form C block for each person. It opens already showing which platform the guest booked through.`,
      `When it is submitted the stay moves to **Pending review**, which is what puts the guest in {{needs-attention|Needs attention}}. You make the links in {{checkin-links|Check-in links}}.`,
    ],
  },
  {
    id: 'quote-page', icon: '🧮', name: 'Partner quote page', path: '/quote/…',
    who: 'Travel agents and sales partners',
    text: [
      `A public calculator: the partner enters dates and guests and sees nights, bedrooms needed, rate and total. It shows only the answer for that query, never your rate card. You make the links in {{agent-links|Agent quote links}}.`,
    ],
  },
  {
    id: 'flex-page', icon: '🕐', name: 'Flexibility page', path: '/flexibility',
    who: 'Direct guests',
    text: [
      `Explains your standard timings and how far you can stretch them, then takes the request. It has two tabs: **Existing booking** (the guest finds their booking by name, contact and dates) and **New request** (for someone who has not booked yet). Requests land in {{flexibility|Flexibility requests}}.`,
      `Link straight to a section with an address ending in **#rooms** (bedroom pricing, if you offer it), **#request** (the form) or **#why** (why the timings are what they are).`,
    ],
  },
]

// ── What your on-site manager sees ───────────────────────────────────────
export const MANAGER = {
  intro: [
    `Your manager signs in with their own PIN and sees a different home screen — built around today's arrivals, not your reports. What they record flows straight into your numbers.`,
  ],
  screens: [
    { icon: '🏠', name: 'Home', text: `Today's arrivals and who is in the house. Guests appear only after **you** mark them ready for check-in. A red **Overdue — still open** list asks them to close stays so you can settle their commission.` },
    { icon: '🔑', name: 'Check-in', text: `Two tabs, **Check-in** and **In-house**. Pick a guest, review the booking summary, requested arrival time and extra services, photograph the car and number plate (the plate is read for them), confirm the check-in, then **Ready for check-out** and **Complete check-out** at the end. They can also ask a guest for a review on WhatsApp while they are still at the gate.` },
    { icon: '🍽️', name: 'Kitchen incidentals', text: `Charges for items a guest used, priced from your Inventory or entered ad hoc, with an itemised message the guest can be sent on WhatsApp. You are emailed when it is saved.` },
    { icon: '🥞', name: 'Breakfast', text: `Rate per person times number of guests.` },
    { icon: '🚗', name: 'Car rental', text: `Destination, trip amount, your commission on it and the net to the villa.` },
    { icon: '🧾', name: 'Expenses and Inventory', text: `The same screens you have, so they can log a bill or restock after a purchase.` },
    { icon: '💼', name: 'My earnings', text: `A snapshot of which of their stays are paid and which are pending, with no amounts shown.` },
  ],
  flows: `Breakfast, car rental and kitchen entries appear in your Dashboard's revenue breakdown. A check-out creates the commission that appears in **Staff Perks**. Expenses reduce your net to owner.`,
}

// ── Routines ─────────────────────────────────────────────────────────────
export const FIRST_WEEK = [
  `Connect your platform calendars in {{channel-calendar|Channel calendar}} → [[+ Feed]], then give each platform its own link under **Share your calendar back**, so they block each other's nights.`,
  `Set where alerts go in {{notification-settings|Notification settings}}.`,
  `Create a check-in link for each platform you use in {{checkin-links|Check-in links}}.`,
  `Check your item prices and target levels in {{inventory|Inventory}}.`,
  `Add your manager's login (and any other staff) in {{maintenance|Maintenance}} → Staff & Access.`,
  `Record your next booking in {{new-booking|New booking}} and walk it through {{complete-booking|Complete booking}}.`,
  `Create your first tracked flyer in {{marketing|Marketing}}.`,
]

export const ROUTINES = [
  {
    when: 'Every morning', time: 'about 2 minutes', icon: '☀️',
    items: [
      `If {{needs-attention|Needs attention}} is showing, approve the waiting guests with [[Onboard Guest]].`,
      `Check the {{duplicate-bookings|Duplicate bookings}} banner. Red? Open {{channel-calendar|Channel calendar}}.`,
      `Read {{last-48|Your last 48 hrs}}, then [[OK — got it]].`,
      `Glance at {{upcoming-gaps|Upcoming gaps}}.`,
      `In {{guest-enquiries|Guest enquiries}}, [[💬 Nudge]] anyone showing three or more days since last contact.`,
    ],
  },
  {
    when: 'After each check-out', time: 'a minute', icon: '🧳',
    items: [
      `Open {{review-chase|Review chase}} and send the review request while the stay is fresh.`,
      `Confirm the stay's money is saved in {{complete-booking|Complete booking}}.`,
    ],
  },
  {
    when: 'Every week', time: '10 minutes', icon: '📆',
    items: [
      `{{dashboard|Dashboard}} → Financials for the month so far.`,
      `{{staff-perks|Staff Perks}} → pay what is unpaid.`,
      `{{inventory|Inventory}} → restock anything flagged low.`,
      `{{expenses|Expenses}} → make sure the week's bills are logged.`,
    ],
  },
  {
    when: 'Every month', time: '20 minutes', icon: '🗓️',
    items: [
      `Look at the {{channel-mix|Channel mix}} chip. Is the platforms' share rising?`,
      `{{dashboard|Dashboard}} → Marketing to plan the next three months.`,
      `{{guest-repository|Guest repository}} → message the guests in the segments the season suits.`,
      `{{marketing|Marketing}} → see which campaigns paid off and repeat them.`,
    ],
  },
]

// ── Find it by what you want to do ───────────────────────────────────────
// The nine goals are the same options offered on the sign-up form's "What
// would help you most?" question, listed most-requested first.
export const BY_GOAL = [
  {
    goal: 'Marketing & advertising', icon: '📣',
    means: `Getting more of the right guests, and knowing what worked.`,
    where: [
      `{{marketing|Marketing}} — a tracked link, QR code and flyer per campaign, with clicks, enquiries and bookings counted.`,
      `{{dashboard|Dashboard}} → Marketing — the next three months, occupancy, peak seasons and a playbook.`,
      `{{guest-repository|Guest repository}} — guests grouped into segments, each with a suggested offer.`,
      `{{upcoming-gaps|Upcoming gaps}} — the dates that most need a push.`,
      `{{flexibility|Flexibility requests}} — a perk that gives guests a reason to book direct.`,
    ],
  },
  {
    goal: 'Automation', icon: '⚙️',
    means: `Things that happen without you remembering to do them.`,
    where: [
      `Platform calendars refresh by themselves — in the background, whenever a platform reads its link, and whenever you open {{channel-calendar|Channel calendar}} — each platform gets a link that blocks the nights taken on the others, and a clash is flagged in {{duplicate-bookings|Duplicate bookings}}.`,
      `The checkout-day email goes to a guest around 6:00 AM on the day they leave, when they are checked in and you have their email address.`,
      `A check-out creates your manager's commission automatically ({{staff-perks|Staff Perks}}).`,
      `Alert emails reach you for check-ins, check-outs, kitchen charges and expenses.`,
      `A receipt photo fills in an expense, and a car photo fills in the number plate.`,
      `Welcome, check-in link, comfort check, farewell, review and follow-up messages are written for you. WhatsApp opens with the text ready; you tap send.`,
    ],
  },
  {
    goal: 'Quicker response times', icon: '⚡',
    means: `Replying to guests and partners in minutes, not hours.`,
    where: [
      `{{guest-enquiries|Guest enquiries}} — price an enquiry from your rate card and send the quote on WhatsApp in a few taps.`,
      `{{agent-links|Agent quote links}} — partners quote themselves, any time.`,
      `{{flexibility|Flexibility requests}} — each request arrives with the calendar verdict and the price already worked out.`,
      `[[💬 Nudge]] — a one-tap follow-up for a quiet enquiry.`,
    ],
  },
  {
    goal: 'Convert more enquiries', icon: '🎯',
    means: `Turning "how much is it?" into a booking.`,
    where: [
      `{{guest-enquiries|Guest enquiries}} — every enquiry has a status, a follow-up date and a days-since-contact counter, so none go cold unnoticed.`,
      `The quote opens with your villa's pictures, then answers the common questions, with returning guests and partners getting tailored versions.`,
      `Conversion Dashboard — your conversion rate, which sources convert, and the reasons enquiries are lost.`,
    ],
  },
  {
    goal: 'Income & expense visibility', icon: '💰',
    means: `Knowing, any day, what you earned, what it cost and what you kept.`,
    where: [
      `{{dashboard|Dashboard}} → Financials — gross, net to owner, commissions, direct ratio and a full P&L.`,
      `{{expenses|Expenses}} — a categorised log, with a receipt scanner.`,
      `{{complete-booking|Complete booking}} — the money for each stay, itemised.`,
      `{{channel-mix|Channel mix}} — what the platforms cost you this month.`,
      `{{staff-perks|Staff Perks}} and {{inventory|Inventory}} — the costs of staff and stock.`,
    ],
  },
  {
    goal: 'Alerts & notifications', icon: '🔔',
    means: `Hearing about the things that matter, once, in one place.`,
    where: [
      `Home alert blocks — {{needs-attention|Needs attention}}, {{review-chase|Review chase}} and {{last-48|Your last 48 hrs}}.`,
      `{{duplicate-bookings|Duplicate bookings}} — an early warning for calendar problems.`,
      `{{notification-settings|Notification settings}} — where email alerts are sent.`,
    ],
  },
  {
    goal: 'AI concierge', icon: '🤖', notYet: true,
    means: `An assistant that answers guests for you.`,
    where: [
      `**This is not part of the app today.** A guest-facing AI assistant has not been built.`,
      `What already answers guests without you: the {{flex-page|Flexibility page}}, the {{quote-page|partner quote page}}, and written messages that cover the common questions.`,
      `Where the app already uses AI: reading a receipt photo into an expense, and reading a number plate from a check-in photo.`,
    ],
  },
  {
    goal: 'Let staff run more of it', icon: '🧑‍🍳',
    means: `Handing everyday work to your manager, with you still in control.`,
    where: [
      `{{manager|Your manager's screens}} — check-in and check-out, kitchen, breakfast, car rental, expenses and inventory.`,
      `You stay in charge of the gate: guests only appear for check-in after you approve them.`,
      `{{maintenance|Maintenance}} → Staff & Access — add, reset or lock a login yourself.`,
      `{{staff-perks|Staff Perks}} — commission worked out and tracked for you.`,
    ],
  },
  {
    goal: 'Get off Excel', icon: '📗',
    means: `One place instead of a spreadsheet for every question.`,
    where: [
      `Bookings, guests, enquiries, expenses, stock and income all live in the same system, so nothing has to be copied between sheets.`,
      `{{dashboard|Dashboard}} replaces the monthly summary sheet; {{quick-reports|Quick Reports}} answer one-off questions.`,
      `{{guest-repository|Guest repository}} replaces the contact list.`,
    ],
  },
]

// ── Words used in the app ────────────────────────────────────────────────
export const GLOSSARY = [
  { term: 'Channel / platform / OTA', def: `A website that sells your nights for you — Airbnb, Booking.com, MakeMyTrip and so on. "OTA" means online travel agent.` },
  { term: 'Direct booking', def: `A guest who booked with you, not through a platform. No commission is charged.` },
  { term: 'Commission', def: `The fee a platform keeps from each booking. Rates differ by platform.` },
  { term: 'Gross', def: `What a booking is worth before any commission.` },
  { term: 'Net to owner', def: `What you keep: gross, less channel commission, staff commission and expenses.` },
  { term: 'Stay ID', def: `The reference number every booking gets when it is created.` },
  { term: 'Lifecycle', def: `The path a stay follows from Booked to Closed.` },
  { term: 'Provisional / Pending review', def: `A booking whose guest has submitted the check-in form but which you have not yet approved.` },
  { term: 'Turnaround', def: `The hours needed to clean and reset the villa between one guest leaving and the next arriving.` },
  { term: 'iCal feed', def: `A calendar link a platform provides, which lets another system read its booked dates.` },
  { term: 'Form C', def: `The registration of foreign nationals that Indian law requires for each foreign guest.` },
  { term: 'Segment', def: `A group of guests that share something — for example VIPs with five or more stays.` },
  { term: 'Conversion rate', def: `The share of enquiries that became confirmed bookings.` },
  { term: 'Nudge / chase', def: `A friendly follow-up message. A nudge goes to an enquiry; a chase asks a past guest for a review.` },
  { term: 'Void vs Delete', def: `Void keeps the record but stops it counting. Delete removes it for good.` },
]

// ── Common questions ─────────────────────────────────────────────────────
export const FAQ = [
  {
    q: `A block I expected is missing. Is something broken?`,
    a: `Almost certainly not. Most blocks only appear when there is something to show — see "Quiet is good news" at the top. {{channel-mix|Channel mix}}, for instance, needs at least one platform booking checking in this month.`,
  },
  {
    q: `Do messages send themselves?`,
    a: `WhatsApp messages never do. The app opens WhatsApp with the text ready and you tap send. The checkout-day email is the one automatic message, sent around 6:00 AM to guests who are checked in, leave that day and have an email address on file.`,
  },
  {
    q: `How often does the calendar sync?`,
    a: `The app refreshes each platform's calendar in the background a few times a day, whenever a platform reads the link you gave it, and whenever you open {{channel-calendar|Channel calendar}}; use [[🔄 Sync now]] there to refresh at once. How soon a booking shows up on another platform then depends on how often that platform reads its link — Airbnb about every 3 hours.`,
  },
  {
    q: `A night is still open on one platform after it was booked on another. Why?`,
    a: `Each platform only reads its link every few hours, so for a while the night still looks free there. Most platforms let you require some advance notice for a booking, which keeps same-day and next-day bookings from slipping through that gap. Under **Share your calendar back** in {{channel-calendar|Channel calendar}} you can see when each platform last read its link.`,
  },
  {
    q: `Is it safe to paste a calendar link into a platform?`,
    a: `A link holds dates only — no names, contacts or booking numbers — and its address is long and random, so it cannot be guessed. If you ever think one has been shared by mistake, tap [[New link]] and the old one stops working at once.`,
  },
  {
    q: `Can I undo a check-out?`,
    a: `Yes. In {{complete-booking|Complete booking}}, under **Correct a mistake**, you can undo a check-out (back to Ready for check-in, or to Checked in) or undo a check-in. It clears the recorded actual times and removes the staff commission if it has not been paid.`,
  },
  {
    q: `What is the difference between Void and Delete?`,
    a: `Void keeps the booking on record but stops it counting. Delete removes it permanently, and is blocked if staff commission has been paid on it. When in doubt, void.`,
  },
  {
    q: `Why does my number plate / receipt scan sometimes come back empty?`,
    a: `Reading a photo is best effort. When it cannot read it, the form is left for you to fill in by hand, and nothing is lost. A clear, well-lit photo helps.`,
  },
  {
    q: `Can I share this manual with someone outside my business?`,
    a: `Yes. Send them the address — or lock it first. In {{maintenance|Maintenance}} → Training manual access you can require a passcode and make one for each person, with a time limit you choose. They enter it on a passcode screen, and when it runs out so does their access.`,
  },
  {
    q: `Can my manager see my money?`,
    a: `No. Their earnings screen shows which stays are paid or pending, and never any amounts. Reports and the Dashboard are for owners only.`,
  },
]
