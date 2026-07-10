// Default villa id for this host's deployment, sourced from
// hosts/<hostId>/config.js. Screens import this instead of hardcoding a
// villa id, so a new host's build reads/writes their own villa's data
// instead of silently falling back to a different host's.
//
// This is a deliberately mutable exported binding (not a frozen constant):
// once a tenant owns more than one property, the PropertyPicker screen
// (shown right after login) resolves which property is "active" for the
// session and reassigns it here via setActiveVillaId(). ES module bindings
// are live references, so every one of the ~26 existing files that already
// does `import { DEFAULT_VILLA_ID } from '../../utils/villaContext'` picks
// up the change automatically — no need to touch each call site or thread
// a villaId prop through every screen. The picker always resolves before
// any protected route renders, so by the time a screen actually reads this
// value it's already final for the session.
import { CONFIG } from '../config'

export let DEFAULT_VILLA_ID = CONFIG.villas.find(v => v.active)?.id || CONFIG.villas[0]?.id

const STORAGE_KEY = 'ge_active_property'

export function setActiveVillaId(villaId) {
  DEFAULT_VILLA_ID = villaId
  try { sessionStorage.setItem(STORAGE_KEY, villaId) } catch {}
}

// Restores a previously-picked property for this session (e.g. after a
// page refresh) — returns the restored id, or null if nothing was stored.
export function restoreActiveVillaId() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) { DEFAULT_VILLA_ID = stored; return stored }
  } catch {}
  return null
}

export function clearActiveVillaId() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
}
