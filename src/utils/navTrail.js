// ============================================================
//  navTrail.js — a back arrow that always gets you OUT
//
//  `navigate(-1)` means "the page I happened to come from". Usually that is
//  the parent, but not always: an app window reopened at /owner/maintenance
//  has nothing behind it (the arrow does nothing), and a trail that has
//  gone Maintenance -> Staff & Access -> Maintenance -> ... walks you round
//  the same two screens for as long as you press it.
//
//  useBack(parent) knows where the entry behind this one is. If it IS the
//  parent it simply goes back (so the browser's own history stays tidy). If
//  not, it goes UP to the parent and replaces this entry, so the trail can
//  never loop and a screen opened cold still has a way out.
//
//  <NavTrail /> is mounted once inside the router; it records which path
//  sits at each position of this tab's history (React Router keeps the
//  position in window.history.state.idx). Without it useBack still works:
//  it just always goes up.
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

export function NavTrail() {
  const { pathname, key } = useLocation()
  useEffect(() => {
    const map = read()
    map[position()] = pathname
    write(map)
  }, [pathname, key])
  return null
}

// A function for a back arrow's onClick. `parent` is the screen one level up,
// e.g. useBack('/owner/maintenance') on Staff & Access.
export function useBack(parent) {
  const navigate = useNavigate()
  return useCallback(() => {
    const here = position()
    if (here > 0 && read()[here - 1] === parent) navigate(-1)
    else navigate(parent, { replace: true })
  }, [navigate, parent])
}
