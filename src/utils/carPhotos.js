// How long a guest's car and plate PHOTOS are kept, and when a photo may go.
//
// The photos are filed in the guest's own Google Drive folder at check-in (a copy stays in the app for five days). They are a
// convenience: what has to be kept for good is the plate NUMBER, which sits on the stay (vehicle_number). So a photo is deleted once it
// is older than the host's retention AND its stay has a number on record; a photo whose stay has none is kept, and the owner is asked
// to type the number in (Complete booking > Guest info).
//
// The standard plan keeps photos one month. A longer time is a paid extra: the operator sets it for that host as
// `carPhotos: { keepMonths: N }` in hosts/<id>/config.js (the host's own place for every such setting; nothing else changes).
export const DEFAULT_CAR_PHOTO_MONTHS = 1
export const MAX_CAR_PHOTO_MONTHS = 60

// Months a host keeps its car and plate photos: its own setting if it is a whole number from 1 to 60, else the standard plan's.
export function carPhotoMonths(config) {
  const n = Math.floor(Number(config && config.carPhotos && config.carPhotos.keepMonths))
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_CAR_PHOTO_MONTHS) : DEFAULT_CAR_PHOTO_MONTHS
}

// What is on a stay's car-number line ("KL 08 AB 1234, TN 38 X 9"), as a list. The line is free text: it is filled from the guest's own
// form, from the caretaker (read off the plate photo) and from the owner, so it can hold anything ("No car", "Will update", "Train 4421").
// An entry needs at least three letters or digits to be kept at all.
const alnum = s => String(s || '').replace(/[^A-Za-z0-9]/g, '')
export function plateNumbers(value) {
  return String(value == null ? '' : value).split(/[,;\n]/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => alnum(s).length >= 3)
}

// Does this entry LOOK like a number plate? Only that lets a photo go, so it is deliberately strict (a plate that is not recognised only
// keeps its photos, and the owner is asked to look; a note that is mistaken for a plate would lose the only record of the car). Indian
// plates are two letters (the state), one or two digits (the district), up to three letters (the series, absent on old plates) and one to
// four digits: KL 08 AB 1234, TN 38 X 9, DL 8C AF 5030; or the Bharat series, two digits, BH, four digits, one or two letters. Of the 14
// numbers on record when this was written (2026-11-03), 12 were plates and two were not: digits only, and two words.
const PLATE = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/
const BH_PLATE = /^\d{2}BH\d{4}[A-Z]{1,2}$/
export function looksLikePlate(entry) {
  const key = alnum(entry).toUpperCase()
  return PLATE.test(key) || BH_PLATE.test(key)
}
export const hasPlateNumber = value => plateNumbers(value).some(looksLikePlate)

// What is saved when the owner types the car numbers: upper case, one spelling per car (spacing and case ignored), at most six.
export function cleanPlateList(value) {
  const seen = new Set()
  const out = []
  for (const n of plateNumbers(value)) {
    const key = alnum(n).toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(n.toUpperCase().slice(0, 20))
    if (out.length === 6) break
  }
  return out.join(', ')
}
