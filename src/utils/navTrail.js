// ============================================================
//  navTrail.js — a back arrow that always gets you OUT
//
//  `navigate(-1)` means "the page I happened to come from". Usually that is
//  what you want, but it fails in two ways:
//    * A window opened cold on a screen (a reopened installed app, a link, a
//      reload) has nothing behind it, so the arrow does nothing.
//    * A trail that has gone Maintenance -> Staff & Access -> Maintenance ->
//      ... walks you round the same screens for as long as it is pressed.
//
//  useBack() is the arrow's handler. It looks at the pages behind this one:
//    - the nearest one that is not this same screen and not one of this
//      screen's own children is where you came from: go back to it (the
//      normal case, and one step further when the page behind is a duplicate
//      or a child you have just climbed out of);
//    - if there is none (opened cold, or the history is unknown), go UP to
//      this screen's parent, replacing this entry, so the trail cannot loop.
//
//  <NavTrail /> is mounted once inside each router. It records which path
//  sits at each position of this tab's history (React Router keeps the
//  position in window.history.state.idx). Without it useBack still works:
//  it simply always goes up.
// ============================================================
import { useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const KEY = 'sv_navtrail'

function read() {
  try { return JSON.parse(sessionStorage.getItem(KEY)) || {} } catch { return {} }
}
function write(map) {
  try { sessionStorage.setItem(KEY, JSON.stringify(map)) } catch { /* private mode: going up still works */ }
}
// Position of the current entry in this tab's history (0 for the first one).
function position() {
  const s = window.history.state
  return s && Number.isInteger(s.idx) ? s.idx : 0
}

// The screen one level up from a path, for when nothing useful is behind it.
// Screens are routed as /owner/<hub>/<screen>, so removing the last segment
// is right almost everywhere; the exceptions are listed.
export function parentOf(pathname) {
  const path = (pathname || '/').replace(/\/+$/, '') || '/'
  const OVERRIDES = {
    '/infra/error-log': '/owner/maintenance',
    '/test': '/owner/maintenance',
    '/debug': '/owner/maintenance',
  }
  if (OVERRIDES[path]) return OVERRIDES[path]
  // estate screens live under /pollachi/* and /pavutumuri/*; their hubs under /owner/*
  const estate = path.match(/^\/(pollachi|pavutumuri)\/./)
  if (estate) return `/owner/${estate[1]}`
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  // a section root such as /owner, /raman or /infra is not a screen: go home
  return parts.length <= 1 ? '/' : '/' + parts.join('/')
}

export function NavTrail() {
  const { pathname, key } = useLocation()
  useEffect(() => {
    const map = read()
    map[position()] = pathname
    write(map)
  }, [pathname, key])
  return null
}

// A function for a back arrow's onClick (or a post-save "go back" timer).
// `parent` is optional: pass it only where parentOf() would guess wrong.
export function useBack(parent) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return useCallback(() => {
    const here = position()
    const trail = read()
    const me = pathname.replace(/\/+$/, '') || '/'
    for (let i = here - 1; i >= 0; i--) {
      const p = trail[i]
      if (!p) break                                  // unknown: do not guess
      if (p === me || p.startsWith(me + '/')) continue // the same screen again, or one of its children
      navigate(i - here)                             // back to where this person actually came from
      return
    }
    navigate(parent || parentOf(me), { replace: true })
  }, [navigate, pathname, parent])
}
