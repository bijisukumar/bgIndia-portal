// Default villa id for this host's deployment, sourced from
// hosts/<hostId>/config.js. Screens import this instead of hardcoding a
// villa id, so a new host's build reads/writes their own villa's data
// instead of silently falling back to a different host's.
import { CONFIG } from '../config'

export const DEFAULT_VILLA_ID = CONFIG.villas.find(v => v.active)?.id || CONFIG.villas[0]?.id
