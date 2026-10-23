// A deploy reaches an INSTALLED app in two loads: the first load is answered by the OLD service worker (which
// starts fetching the new one in the background), and only the second load shows the new code. So after every
// deploy the owner looked at the old screen and judged a fix "not working" (2026-10-23: "Checked in 5:30 PM"
// long after the corrected screen was live). The new worker takes over by itself (skipWaiting + clientsClaim in
// the Vite PWA config); this reloads the page ONCE when it does, so the new code appears without a second manual
// load.
//
// Two safeguards. Only when a worker was ALREADY in control when the page opened (on a first visit the worker
// taking control is not an update). And only while the page is young: a reload later than that could throw away
// what someone has typed or photographed (Raman leaves the page to use the camera), so a late update is left to
// show up at the next normal load.
const YOUNG_PAGE_MS = 30000

export function reloadWhenUpdated() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
  const hadController = !!navigator.serviceWorker.controller
  let done = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || done) return
    if (typeof performance !== 'undefined' && performance.now() > YOUNG_PAGE_MS) return
    done = true
    window.location.reload()
  })
}
