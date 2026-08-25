// ============================================================
//  CONFIG LOADER
//
//  Config comes from the API at runtime (platform_tenant_config, served by
//  getAppConfig) and is resolved from the hostname. That is what lets one
//  build serve every host: adding <newhost>.stayvibe360.com becomes a
//  database row and a custom domain, not a new Pages project and a deploy.
//
//  hosts/<hostId>/config.js is still bundled, but only as the fallback for
//  when the API cannot be reached. It is no longer the source of truth.
//
//  HOW THIS AVOIDS A STALE-READ BUG: a dozen screens read CONFIG at module
//  scope (`const villa = CONFIG.villas[0]`), which runs the moment the module
//  is evaluated. So the object must be filled in *before* the app's module
//  graph loads. Each entry point calls initConfig() and only then dynamically
//  imports App — see src/apps/<app>/main.jsx.
//
//  Top-level await would have been tidier, but the build targets Chrome 87 /
//  Safari 14 and TLA needs Chrome 89 / Safari 15. Raising that floor to save
//  a few lines would lock older phones out of the guest check-in form.
// ============================================================

import { CONFIG as BUNDLED } from '@host-config'

const CACHE_KEY = 'sv_cfg_' + (typeof location !== 'undefined' ? location.hostname : 'unknown')
const FETCH_TIMEOUT_MS = 4000

// Exported object identity never changes — importers hold this reference and
// see whatever it contains once initConfig() has run.
export const CONFIG = { ...BUNDLED }

export let CONFIG_SOURCE = 'bundled'

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }          // private mode, storage disabled, bad JSON
}

function writeCache(config) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(config)) } catch { /* not fatal */ }
}

async function fetchConfig() {
  // Abort rather than hang: this gates first render, so a stuck request would
  // leave a guest looking at a blank page.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch('/api/getAppConfig', { signal: ctrl.signal })
    if (!res.ok) return null
    const body = await res.json()
    return body?.success && body?.data?.config ? body.data.config : null
  } catch {
    return null                    // offline, aborted, non-JSON — all equivalent
  } finally {
    clearTimeout(timer)
  }
}

// Replace the contents wholesale rather than merging over the bundled copy.
// A merge would fill a new host's gaps with Dwarka's values — their branding,
// pricing and WhatsApp templates. Replacement makes a missing field show up
// as missing instead of quietly showing another host's data.
function replaceConfig(next, source) {
  for (const k of Object.keys(CONFIG)) delete CONFIG[k]
  Object.assign(CONFIG, next)
  CONFIG_SOURCE = source
}

let started = null

export function initConfig() {
  if (started) return started
  const cached = readCache()
  if (cached) {
    // Repeat visit: render straight from cache and refresh in the background,
    // so only the very first load pays for the round trip.
    replaceConfig(cached, 'cache')
    started = Promise.resolve()
    fetchConfig().then(fresh => { if (fresh) writeCache(fresh) })
    return started
  }
  started = fetchConfig().then(fresh => {
    if (fresh) { replaceConfig(fresh, 'runtime'); writeCache(fresh) }
    // else: CONFIG keeps its bundled contents and CONFIG_SOURCE stays
    // 'bundled', which the debug panel surfaces.
  })
  return started
}
