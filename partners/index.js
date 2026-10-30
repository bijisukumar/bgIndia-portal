// THE PARTNER LIBRARY: every booking platform StayVibe knows, one file each. Nothing about a platform lives in the code: its name,
// colours, commission, whether it itemises its fees, how its bookings reach us and how its calendar is connected are all read from
// these files. A host lists the partners it uses in hosts/<id>/config.js (`partners: { airbnb: {}, bookingcom: {} ... }`) and
// overrides only what differs for it. See partners/README.md.
import { AIRBNB } from './airbnb.js'
import { BOOKING_COM } from './booking-com.js'
import { VRBO } from './vrbo.js'
import { AGODA } from './agoda.js'
import { EXPEDIA } from './expedia.js'
import { MAKEMYTRIP } from './makemytrip.js'
import { GOIBIBO } from './goibibo.js'
import { CLEARTRIP } from './cleartrip.js'
import { DIRECT } from './direct.js'
import { AGENT } from './agent.js'
import { OTHER } from './other.js'

export { AIRBNB, BOOKING_COM, VRBO, AGODA, EXPEDIA, MAKEMYTRIP, GOIBIBO, CLEARTRIP, DIRECT, AGENT, OTHER }

// To teach StayVibe a new platform for EVERY host: add a file beside these, import it here and add it to this list.
export const PARTNER_LIBRARY = [AIRBNB, BOOKING_COM, VRBO, AGODA, EXPEDIA, MAKEMYTRIP, GOIBIBO, CLEARTRIP, DIRECT, AGENT, OTHER]

// A platform nobody has described gets one of these colours, picked from its name, so a calendar added by pasting a new link
// looks the same every time.
export const FALLBACK_COLORS = ['#14B8A6', '#A8805A', '#9CA3AF', '#6366F1']
