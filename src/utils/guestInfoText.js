// The guest's check-in form as a plain-text record: the GuestInfo-<stay>.txt file in the guest's Drive folder (2026-10-27).
//
// Biji's rule: capture as much of what the guest filled in as the portal holds, so that when a guest says "I listed everyone" or
// "I gave my ID" the file shows what actually arrived: every answer, names and ages included, and "(not given)" for each answer
// that was left blank. Pure: the Worker reads the rows and hands them here (getGuestInfoText), the tests feed it fixtures, and a
// change of wording is a deploy, not a paste into Google.
//
// ID, passport and visa numbers are shown as "ending 4821", never whole: this text is also pasted into the owner's check-in
// email, and the scan itself sits in the same folder for anyone who needs the full number.
import { collectGuests, ageLabelFromDob } from './guestList.js'
import { fmtTime } from './stayTimes.js'
import { stampLong } from './tz.js'

const BLANK = '(not given)'
const W = 15   // width of a label column
const text = v => (v == null ? '' : String(v)).trim()
const count = v => parseInt(v, 10) || 0

// "ending 4821": enough to match the scan in the folder; a number of four characters or fewer is not repeated at all.
export function endingIn(number) {
  const n = text(number).replace(/\s+/g, '')
  if (!n) return ''
  return n.length <= 4 ? 'number given' : `ending ${n.slice(-4)}`
}

// "2 adults + 1 child = 3 guests"
export function partyText(adults, children) {
  const a = count(adults), c = count(children), t = a + c
  return `${a} adult${a === 1 ? '' : 's'}${c ? ` + ${c} ${c === 1 ? 'child' : 'children'}` : ''} = ${t} guest${t === 1 ? '' : 's'}`
}

// "1992-04-18 (age 34 at check-in)"; a date that is not a real date is shown as typed, an empty one as BLANK
function born(dob, checkin) {
  const d = text(dob)
  if (!d) return BLANK
  const label = ageLabelFromDob(d, checkin)
  return label ? `${d} (age ${label} at check-in)` : d
}

// The stamp the Apps Script looks for in a file already in the folder, to tell whether the guest has sent the form again since it
// was written. A line of its own in the text, built here so the two can never drift apart.
export function formStamp(submittedAt) {
  const s = text(submittedAt)
  return s ? `${'Form recorded'.padEnd(W + 2)}: ${s} UTC` : ''
}

// stay:   the stayvibe_stays row, camelCase: stayId, bookedVia (the channel in words: "Airbnb", "Direct"), guestName, bookedByName,
//         phone, email, checkin, checkout, nights,
//         adults, children, dob, gender, nationality, homeAddress, homeAddressLine2, city, state, country, fromCity, pincode,
//         guestList, purposeOfVisit, modeOfTransport, vehicleNumber, eta, govtIdType, govtIdNum, requestEarlyCheckin,
//         requestLateCheckout, formSubmitted (the checkin_form_submitted flag), submittedAt (checkin_form_submitted_at, a stored UTC
//         time: some rows have the flag and no time)
// prefs:  requestBreakfast, breakfastChoice, requestCab, requestExtraBeds, extraBedsCount, etd (expected departure, 'HH:MM')
// kyc:    one entry per foreign guest (stayvibe_stay_kyc): seq, name, nationality, dob, gender, passportNumber, passportIssueDate,
//         passportIssuePlace, passportExpiry, visaNumber, visaType, visaIssueDate, visaIssuePlace, arrivalDateIndia,
//         portOfArrival, nextDestination, homeCountry, homeCountryAddress, docsLater
// formCount: what the check-in form said when its head count was not the booked one (stayvibe_change_requests, kind
//         checkin_form): { adults, children, status } or null
// Returns { text, stamp, namesListed, partyOnForm, partyBooked }.
export function buildGuestInfoText({ villaName, checkinTime, checkoutTime, tz, stay, prefs, kyc, formCount }) {
  const s = stay || {}, p = prefs || {}, foreign = Array.isArray(kyc) ? kyc : []
  const out = []
  const row = (label, value) => out.push(`  ${label.padEnd(W)}:  ${text(value) || BLANK}`)
  const rowIf = (label, value) => { if (text(value)) out.push(`  ${label.padEnd(W)}:  ${text(value)}`) }
  const head = (label, value) => out.push(`${label.padEnd(W + 2)}: ${value}`)
  const section = title => { out.push('', title) }

  const bookedA = count(s.adults), bookedC = count(s.children), booked = bookedA + bookedC
  const asked = formCount ? { adults: count(formCount.adults), children: count(formCount.children) } : null
  const askedTotal = asked ? asked.adults + asked.children : null
  const differs = askedTotal != null && askedTotal !== booked
  const partyOnForm = askedTotal != null ? askedTotal : booked

  const guests = collectGuests({
    name: s.guestName, dob: s.dob, guestList: s.guestList, onDate: s.checkin,
    kyc: foreign.map(k => ({ name: k.name, nationality: k.nationality, dob: k.dob })),
  })

  const stamp = formStamp(s.submittedAt)

  out.push('============================================================')
  out.push(`  GUEST REGISTRATION — ${text(villaName) || 'the property'}`)
  out.push('============================================================')
  head('Stay ID', text(s.stayId))
  // A stay can carry the "form sent" flag with no time: older rows, and a record a merge filled in (2026-10-28: Achala's and
  // P. B Krishnan's, whose files first said "no check-in form on record" above their own date of birth and address).
  head('Form submitted', s.submittedAt ? (stampLong(text(s.submittedAt), tz) || text(s.submittedAt))
    : s.formSubmitted ? 'yes (the time was not recorded)' : 'no check-in form on record')
  if (stamp) out.push(stamp)

  section('STAY DETAILS')
  if (text(s.bookedByName) && text(s.bookedByName).toLowerCase() !== text(s.guestName).toLowerCase()) row('Booked under', s.bookedByName)
  rowIf('Booked via', s.bookedVia)
  row('Check-in', `${text(s.checkin) || 'TBD'}${checkinTime ? ` (after ${fmtTime(checkinTime)})` : ''}`)
  row('Check-out', `${text(s.checkout) || 'TBD'}${checkoutTime ? ` (by ${fmtTime(checkoutTime)})` : ''}`)
  row('Nights', s.nights || 1)

  section('GUESTS')
  if (differs) {
    row('Booked for', partyText(bookedA, bookedC))
    row('Form says', partyText(asked.adults, asked.children))
    const st = text(formCount.status)
    out.push(`${' '.repeat(W + 5)}>> The form's head count is not the booked one${
      st === 'declined' ? ': the owner declined it, the booking stays as booked.'
        : st === 'approved' ? ': the owner approved it.'
        : ': the owner decides before check-in.'}`)
  } else {
    row('Party', partyText(bookedA, bookedC))
  }
  // "3 of 6 guests": the names the guest gave against the guests the form counts. More names than guests is said as it is.
  row('Names given', guests.length > partyOnForm
    ? `${guests.length} names for ${partyOnForm} guest${partyOnForm === 1 ? '' : 's'}`
    : `${guests.length} of ${partyOnForm} guest${partyOnForm === 1 ? '' : 's'}`)
  guests.forEach((g, i) => {
    out.push(`      ${i + 1}. ${g.name}${g.ageLabel ? ` (age ${g.ageLabel})` : ''}${g.nationality ? `, ${g.nationality}` : ''}`)
  })
  if (text(s.guestList)) {
    out.push('  As typed in "other guests":')
    for (const l of text(s.guestList).split(/\r?\n/)) out.push(`      ${l.trim()}`)
  } else {
    row('Other guests', '(none listed)')
  }

  section('PRIMARY GUEST')
  row('Name', s.guestName)
  row('Date of birth', born(s.dob, s.checkin))
  row('Gender', s.gender)
  row('Nationality', s.nationality || 'Indian')
  row('Phone', s.phone)
  row('Email', s.email)
  row('Address', s.homeAddress)
  rowIf('Address line 2', s.homeAddressLine2)
  // State and pincode are Indian address fields: a blank one is worth showing for an Indian guest, noise for anyone else
  const indian = text(s.nationality || 'Indian').toLowerCase() === 'indian'
  row('City', s.city)
  if (indian) { row('State', s.state); row('Pincode', s.pincode) } else { rowIf('State', s.state); rowIf('Pincode', s.pincode) }
  row('Country', s.country)
  rowIf('Travelling from', s.fromCity)
  row('ID', text(s.govtIdType) ? `${text(s.govtIdType)}, ${endingIn(s.govtIdNum) || 'no number given'}` : (text(s.govtIdNum) ? endingIn(s.govtIdNum) : ''))

  if (foreign.length) {
    section(`FOREIGN GUESTS (Form C) — ${foreign.length}`)
    for (const k of foreign) {
      const bits = [text(k.nationality), text(k.gender)].filter(Boolean)
      out.push(`  ${count(k.seq) || foreign.indexOf(k) + 1}. ${text(k.name) || BLANK}${bits.length ? ` — ${bits.join(', ')}` : ''}`)
      out.push(`      Born          :  ${born(k.dob, s.checkin)}`)
      out.push(`      Passport      :  ${endingIn(k.passportNumber) || BLANK}${text(k.passportIssueDate) ? `, issued ${text(k.passportIssueDate)}` : ''}${text(k.passportIssuePlace) ? ` at ${text(k.passportIssuePlace)}` : ''}${text(k.passportExpiry) ? `, expires ${text(k.passportExpiry)}` : ''}`)
      if (count(k.docsLater)) {
        out.push('      Visa          :  to be shown at check-in')
      } else {
        out.push(`      Visa          :  ${endingIn(k.visaNumber) ? `${text(k.visaType) ? `${text(k.visaType)}, ` : ''}${endingIn(k.visaNumber)}` : BLANK}${text(k.visaIssueDate) ? `, issued ${text(k.visaIssueDate)}` : ''}${text(k.visaIssuePlace) ? ` at ${text(k.visaIssuePlace)}` : ''}`)
      }
      if (text(k.arrivalDateIndia) || text(k.portOfArrival) || text(k.nextDestination)) {
        out.push(`      In India      :  arrived ${text(k.arrivalDateIndia) || BLANK}${text(k.portOfArrival) ? ` at ${text(k.portOfArrival)}` : ''}${text(k.nextDestination) ? `, next stop ${text(k.nextDestination)}` : ''}`)
      }
      if (text(k.homeCountry) || text(k.homeCountryAddress)) {
        out.push(`      Home          :  ${[text(k.homeCountry), text(k.homeCountryAddress)].filter(Boolean).join(' — ')}`)
      }
    }
  }

  section('TRAVEL')
  row('Purpose', s.purposeOfVisit)
  row('Transport', s.modeOfTransport)
  rowIf('Vehicle', s.vehicleNumber)
  row('Arrival (ETA)', s.eta ? fmtTime(s.eta) : '')
  row('Departure', p.etd ? fmtTime(p.etd) : '')

  section('ADDITIONAL REQUESTS')
  const reqs = []
  if (p.requestBreakfast) reqs.push(`Breakfast — ${text(p.breakfastChoice) || 'Idli'}`)
  if (p.requestCab) reqs.push('Cab service')
  if (s.requestEarlyCheckin) reqs.push('Early check-in')
  if (s.requestLateCheckout) reqs.push('Late check-out')
  if (p.requestExtraBeds) reqs.push(`Extra floor beds — ${count(p.extraBedsCount) || 1} bed(s)`)
  if (reqs.length) for (const r of reqs) out.push(`  ✓  ${r}`)
  else out.push('  None requested')

  out.push('', '============================================================')
  return { text: out.join('\n'), stamp, namesListed: guests.length, partyOnForm, partyBooked: booked }
}
