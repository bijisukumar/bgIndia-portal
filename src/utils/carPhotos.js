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

// The plate numbers on a stay ("KL 08 AB 1234, TN 38 X 9"): what is there, as a list. An entry needs at least three letters or digits to
// count as a number, so a stray "-" or "n/a" never lets a photo go.
const alnum = s => String(s || '').replace(/[^A-Za-z0-9]/g, '')
export function plateNumbers(value) {
  return String(value == null ? '' : value).split(/[,;\n]/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => alnum(s).length >= 3)
}
export const hasPlateNumber = value => plateNumbers(value).length > 0

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
