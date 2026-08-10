// ============================================================
//  INSTALL APP BANNER — Android / Chrome
//  Staff were being walked through Chrome's ⋮ menu by hand to get the
//  portal onto their home screen. The site has shipped a valid manifest
//  and service worker all along, so Chrome already offers a native
//  install prompt — it just sits buried in a menu nobody opens. This
//  surfaces it in-app.
//
//  Deliberately mounted inside the authenticated shell only: guests
//  landing on the public check-in or flexibility pages must never be
//  asked to install a staff tool.
// ============================================================
import { useEffect, useState } from 'react'

const SNOOZE_KEY = 'sv_install_snooze_until'

// Already installed → Chrome won't fire the event anyway, but checking
// keeps the banner from flashing in the installed app itself.
function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator.standalone === true
}

function snooze(days) {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 86400000)) } catch {}
}

function isSnoozed() {
  try { return Date.now() < Number(localStorage.getItem(SNOOZE_KEY) || 0) } catch { return false }
}

export default function InstallAppBanner() {
  // main.jsx catches the event before React mounts and parks it on window —
  // Chrome fires it once and does not replay it, so reading the stash is the
  // difference between the banner working and never appearing at all.
  const [evt, setEvt]   = useState(() => window.__installPrompt || null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isInstalled()) return
    const pick = () => setEvt(window.__installPrompt || null)
    // 'installpromptready' is our own signal from main.jsx; the native event
    // is listened for too in case this mounts before Chrome gets round to it.
    window.addEventListener('installpromptready', pick)
    window.addEventListener('beforeinstallprompt', pick)
    const done = () => { window.__installPrompt = null; setEvt(null) }
    window.addEventListener('appinstalled', done)
    return () => {
      window.removeEventListener('installpromptready', pick)
      window.removeEventListener('beforeinstallprompt', pick)
      window.removeEventListener('appinstalled', done)
    }
  }, [])

  if (!evt || isInstalled() || isSnoozed()) return null

  async function install() {
    setBusy(true)
    try {
      evt.prompt()
      const choice = await evt.userChoice
      // The event is single-use whatever the answer — Chrome will hand us a
      // fresh one on a later visit if they said no.
      if (choice?.outcome === 'dismissed') snooze(7)
    } catch { /* prompt already consumed — nothing useful to report */ }
    finally {
      window.__installPrompt = null
      setEvt(null)
      setBusy(false)
    }
  }

  function notNow() {
    snooze(30)
    setEvt(null)
  }

  return (
    <div style={{
      position:'fixed', left:0, right:0, bottom:0, zIndex:900,
      padding:'12px 14px calc(12px + env(safe-area-inset-bottom))',
      background:'var(--dark-card)',
      borderTop:'1px solid var(--border)',
      boxShadow:'0 -6px 24px rgba(0,0,0,0.45)',
      display:'flex', alignItems:'center', gap:'12px',
    }}>
      <img src="/icons/icon-192.png" alt="" width="40" height="40"
        style={{borderRadius:'9px', flexShrink:0}} />

      <div style={{flex:1, minWidth:0}}>
        <div style={{color:'var(--text)', fontWeight:'700', fontSize:'0.88rem'}}>
          Add StayVibe to your home screen
        </div>
        <div style={{color:'var(--text-dim)', fontSize:'0.74rem', lineHeight:'1.45'}}>
          Opens full screen, no browser bar — and you stay signed in.
        </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:'6px', flexShrink:0}}>
        <button onClick={install} disabled={busy}
          style={{padding:'9px 14px', borderRadius:'9px',
            border:'1px solid rgba(200,144,58,0.45)',
            background:'rgba(200,144,58,0.16)', color:'var(--gold)',
            fontWeight:'700', fontSize:'0.82rem', cursor:'pointer', whiteSpace:'nowrap'}}>
          {busy ? '…' : 'Install'}
        </button>
        <button onClick={notNow} disabled={busy}
          style={{padding:'4px 14px', borderRadius:'9px', border:'none',
            background:'transparent', color:'var(--text-dim)',
            fontSize:'0.74rem', cursor:'pointer', whiteSpace:'nowrap'}}>
          Not now
        </button>
      </div>
    </div>
  )
}
