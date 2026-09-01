/**
 * Which doors this hostname is allowed to show.
 *
 * One build serves every host, so "is this the marketing front door or a
 * tenant's own portal?" cannot be answered at build time. It also cannot be
 * answered from the resolved tenant: join.stayvibe360.com has no tenant row of
 * its own, so it falls back to DEFAULT_VILLA_ID and reports itself as dwarka -
 * indistinguishable from the real dwarka portal.
 *
 * So it is an explicit list. Acquisition hosts pitch the platform; every other
 * host is somebody's working portal, where "New Host Registration" and the
 * demo route are noise at best and confusing at worst - a guest or a staff
 * member has no business being offered a signup for the product they are
 * already inside.
 *
 * www.stayvibe360.com and the apex were listed here too, from when this app was
 * the marketing entry point. Both are served by the static site in
 * bijisukumar/stayvibe-web now, so this bundle never runs there and the
 * entries only invited the reader to look for behaviour that cannot happen.
 */
const ACQUISITION_HOSTS = new Set([
  'join.stayvibe360.com',
])

export function isAcquisitionHost(hostname = window.location.hostname) {
  const h = String(hostname || '').toLowerCase()
  if (ACQUISITION_HOSTS.has(h)) return true
  // Local development and Pages preview builds get the full set, so the
  // marketing doors stay testable without owning one of those hostnames.
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.pages.dev')
}
