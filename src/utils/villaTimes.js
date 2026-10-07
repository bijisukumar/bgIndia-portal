// The villa's standard check-in and check-out times, for stayTimes() and the guest
// messages. From the host config (hosts/<id>/config.js), the same source the
// owner's welcome message already uses for "after 4:00 PM / by 11:00 AM".
import { CONFIG } from '../config'
import { DEFAULT_VILLA_ID } from './villaContext'

function theVilla() {
  const villas = CONFIG.villas || []
  return villas.find(x => x.id === DEFAULT_VILLA_ID) || villas[0] || {}
}

export function villaTimeDefaults() {
  const v = theVilla()
  return { checkin: v.checkinTime || '4:00 PM', checkout: v.checkoutTime || '11:00 AM' }
}

// What stayHolds() (src/utils/stayHolds.js) needs to say whether an agreed time would
// keep a night back: the standard times and the hours the villa needs to reset. The
// server uses the live 'turnaround_hours' setting; here it is the host file's number,
// which the setting is kept in step with. Only used to tell the owner what an
// approval is about to do; the server's answer is what is acted on.
export function villaHoldRules() {
  const v = theVilla()
  const t = CONFIG.turnaround || {}
  return {
    stdIn: t.defaultCheckinTime || v.checkinTime || '16:00',
    stdOut: t.defaultCheckoutTime || v.checkoutTime || '11:00',
    turnaroundHours: t.turnaroundHours || 6,
  }
}
